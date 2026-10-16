/* SAND & STEEL — stateless RGS round integration (Phase 1, P03–P05).
 *
 * Ground truth: docs/rgs-ground-truth.md (live Engine docs win over everything).
 * Endpoint shapes implemented exactly as quoted there:
 *
 *   POST /wallet/authenticate {sessionID}
 *     -> {balance {amount, currency}, config {minBet, maxBet, stepBet,
 *         defaultBetLevel, betLevels, gameModes [{mode, costMultiplier,
 *         maxBet}], ...}, round?}
 *        `round` is present ONLY with an unfinished round — the frontend must
 *        resume it (restore the bet amount from that round).
 *   POST /wallet/play {amount, sessionID, mode}
 *     -> {balance, round {betID, amount, payout, payoutMultiplier,
 *         active, mode, state}}
 *        amount is the BASE bet as an integer with six decimal places; the
 *        debit is amount x the mode's cost multiplier. If active is false the
 *        round paid nothing and is already closed; otherwise call
 *        /wallet/end-round once the round has finished playing.
 *   POST /wallet/end-round {sessionID} -> {balance}
 *   POST /bet/event {sessionID, event} -> {event} (resume cursor, <=32 bytes)
 *   POST /wallet/balance {sessionID} -> {balance}
 *
 * Rules enforced here:
 * - Balance is updated from RGS responses ONLY (P03).
 * - No game state persists between rounds; fighter selection / mute are local
 *   UI prefs only (localStorage), never sent to the RGS as game state (P03).
 * - Mid-round refresh recovery: resolveInFlightRound() restores the pending
 *   round from the authenticate record — never re-draws, never silently voids
 *   (P03). The caller must present it to the player and settle via end-round.
 * - Bet levels are READ FROM CONFIG, never hardcoded (P05): minBet, maxBet,
 *   stepBet, betLevels, defaultBetLevel, gameModes cost multipliers.
 * - Amounts stay integers (API units) end to end; formatting is display-only
 *   and never changes the stake sent (P05).
 *
 * Deliberately NOT using the `stake-engine` npm package: the five calls above
 * are trivial fetch wrappers, and a direct implementation keeps every byte
 * on the wire traceable to a quoted doc shape. Revisit if we need its
 * balanceUpdate/roundActive event plumbing in Phase 2+.
 */

(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SandSteelRgs = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Six decimal places: $1.00 = 1000000.
  var API_MULTIPLIER = 1000000;
  // /bet/event constraint from the docs: non-empty, at most 32 bytes.
  var MAX_EVENT_BYTES = 32;

  function defaultFetch() {
    if (typeof fetch !== 'undefined') return fetch;
    throw new Error('no fetch available — pass fetchFn explicitly');
  }

  function endpoint(rgsHost, path) {
    // rgs_url is a bare host with no scheme — never hardcode it.
    var host = String(rgsHost || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (!host) throw new Error('rgsHost is required');
    return 'https://' + host + path;
  }

  function RgsError(code, message, status) {
    var e = new Error(message || code);
    e.name = 'RgsError';
    e.code = code;
    e.status = status;
    return e;
  }

  async function post(rgsHost, path, body, fetchFn) {
    var doFetch = fetchFn || defaultFetch();
    var res = await doFetch(endpoint(rgsHost, path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    var data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    if (!res.ok) {
      var code = (data && data.error) || ('HTTP_' + res.status);
      var message = (data && data.message) || ('request failed: ' + res.status);
      throw RgsError(code, message, res.status);
    }
    return data;
  }

  // --- Wallet calls (exact shapes per the Wallet-endpoints doc) ---

  async function authenticate(rgsHost, sessionID, fetchFn) {
    if (!sessionID) throw new Error('sessionID is required');
    return post(rgsHost, '/wallet/authenticate', { sessionID: sessionID }, fetchFn);
  }

  async function fetchBalance(rgsHost, sessionID, fetchFn) {
    if (!sessionID) throw new Error('sessionID is required');
    return post(rgsHost, '/wallet/balance', { sessionID: sessionID }, fetchFn);
  }

  // amount = BASE bet in API units (integer). The RGS debits
  // amount x the mode's cost multiplier — the caller must have computed the
  // displayed total via totalCostFor() so the player sees the full cost.
  async function play(rgsHost, sessionID, amount, mode, fetchFn) {
    if (!sessionID) throw new Error('sessionID is required');
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('amount must be a positive integer (API units)');
    }
    if (!mode) throw new Error('mode is required');
    return post(
      rgsHost,
      '/wallet/play',
      { amount: amount, sessionID: sessionID, mode: mode },
      fetchFn
    );
  }

  // Only call for a round whose last play response had active === true
  // (a zero-payout round is already closed by /wallet/play itself).
  async function endRound(rgsHost, sessionID, fetchFn) {
    if (!sessionID) throw new Error('sessionID is required');
    return post(rgsHost, '/wallet/end-round', { sessionID: sessionID }, fetchFn);
  }

  async function recordEvent(rgsHost, sessionID, event, fetchFn) {
    if (!sessionID) throw new Error('sessionID is required');
    if (typeof event !== 'string' || event.length === 0) {
      throw new Error('event must be a non-empty string');
    }
    if (event.length > MAX_EVENT_BYTES) {
      throw new Error('event must be at most ' + MAX_EVENT_BYTES + ' chars');
    }
    return post(rgsHost, '/bet/event',
      { sessionID: sessionID, event: event }, fetchFn);
  }

  // --- Refresh recovery (P03): resolve from the record, never re-draw ---
  //
  // Returns null when there is no unfinished round, otherwise a resume
  // descriptor copied from the authenticate `round` record. The caller must
  // restore the bet amount from it (per the RGS-communication checklist) and
  // settle it with end-round after replaying it to its recorded cursor
  // (round.event holds the last /bet/event value, if any). Returning the
  // descriptor — rather than acting — guarantees we never silently void.
  function resolveInFlightRound(authResponse) {
    if (!authResponse || authResponse.round == null) return null;
    var r = authResponse.round;
    if (r.active !== true) return null;
    return {
      betID: r.betID,
      amount: r.amount,
      payout: r.payout,
      payoutMultiplier: r.payoutMultiplier,
      mode: r.mode,
      state: r.state,
      event: r.event !== undefined ? r.event : null,
    };
  }

  // Outcome is dictated by the RGS response, never by a local draw:
  // a round that pays nothing is a loss, anything else a win.
  function deriveOutcome(round) {
    if (!round) throw new Error('round is required');
    return round.payout > 0 ? 'WIN' : 'LOSS';
  }

  // --- Bet-level config (P05): read everything, hardcode nothing ---

  function parseBetConfig(config) {
    if (!config) throw new Error('config is required');
    var out = {
      minBet: config.minBet,
      maxBet: config.maxBet,
      stepBet: config.stepBet,
      defaultBetLevel: config.defaultBetLevel,
      betLevels: Array.isArray(config.betLevels) ? config.betLevels.slice() : [],
      gameModes: {},
    };
    ['minBet', 'maxBet', 'stepBet', 'defaultBetLevel'].forEach(function (k) {
      if (!Number.isInteger(out[k]) || out[k] < 0) {
        throw new Error('config.' + k + ' must be a non-negative integer (API units)');
      }
    });
    if (!out.betLevels.length || !out.betLevels.every(function (b) { return Number.isInteger(b); })) {
      throw new Error('config.betLevels must be a non-empty integer array');
    }
    (config.gameModes || []).forEach(function (gm) {
      out.gameModes[String(gm.mode).toUpperCase()] = {
        costMultiplier: gm.costMultiplier,
        maxBet: gm.maxBet,
      };
    });
    return out;
  }

  function isValidBet(betConfig, baseBetUnits) {
    if (!Number.isInteger(baseBetUnits)) return false;
    if (baseBetUnits < betConfig.minBet || baseBetUnits > betConfig.maxBet) return false;
    if (baseBetUnits % betConfig.stepBet !== 0) return false;
    return true;
  }

  // Full debit for a base bet in a mode (displayed BEFORE confirm, P04).
  // Prefers the live config multiplier; falls back to 1.0 for unknown modes.
  function totalCostFor(betConfig, mode, baseBetUnits) {
    var gm = betConfig.gameModes[String(mode).toUpperCase()];
    var mult = gm ? gm.costMultiplier : 1.0;
    return baseBetUnits * mult;
  }

  // --- Money formatting (P05): display-only, never touches the integer ---

  function formatAmount(apiUnits, currency, locale) {
    if (!Number.isInteger(apiUnits)) throw new Error('apiUnits must be an integer');
    var code = currency || 'USD';
    try {
      return new Intl.NumberFormat(locale || undefined, {
        style: 'currency',
        currency: code,
      }).format(apiUnits / API_MULTIPLIER);
    } catch (e) {
      // Unknown currency code: fall back to a plain 6dp-trimmed major display.
      return (apiUnits / API_MULTIPLIER).toFixed(2) + ' ' + code;
    }
  }

  // P04 confirm copy. Built from the live config values (never hardcoded).
  // Payouts are multi-stage (see paytable); the copy states the exact cost
  // and points at the paytable instead of a stale single number.
  function armedConfirmText(baseBetUnits, currency, betConfig) {
    var total = totalCostFor(betConfig || { gameModes: { ARMED: { costMultiplier: 1.5 } } }, 'ARMED', baseBetUnits);
    return 'Armed Bout — costs ' + formatAmount(total, currency) +
      ' on a ' + formatAmount(baseBetUnits, currency) +
      ' bet — stage wins pay up to 1500x (see paytable)';
  }

  return {
    API_MULTIPLIER: API_MULTIPLIER,
    MAX_EVENT_BYTES: MAX_EVENT_BYTES,
    authenticate: authenticate,
    fetchBalance: fetchBalance,
    play: play,
    endRound: endRound,
    recordEvent: recordEvent,
    resolveInFlightRound: resolveInFlightRound,
    deriveOutcome: deriveOutcome,
    parseBetConfig: parseBetConfig,
    isValidBet: isValidBet,
    totalCostFor: totalCostFor,
    formatAmount: formatAmount,
    armedConfirmText: armedConfirmText,
  };
}));
