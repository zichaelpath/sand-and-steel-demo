/* SAND & STEEL — unit tests for client/rgs-client.js (Phase 1, P03–P05).
 * Run: node --test client/rgs-client.test.js
 * All network I/O goes through an injected stub fetch — no live RGS needed.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const rgs = require('./rgs-client.js');

// Standard-template-shaped authenticate config ($0.10–$1,000, default $1.00),
// mirroring the doc example — but the module under test never hardcodes it.
function standardConfig() {
  return {
    minBet: 100000,
    maxBet: 1000000000,
    stepBet: 100000,
    defaultBetLevel: 1000000,
    betLevels: [100000, 200000, 500000, 1000000, 2000000, 5000000, 10000000],
    gameModes: [
      { mode: 'TRIAL', costMultiplier: 1.0, maxBet: 1000000000 },
      { mode: 'ARMED', costMultiplier: 1.5, maxBet: 1000000000 },
    ],
  };
}

// Minimal stub fetch: route table of "METHOD path" -> {status, body}.
// Records every request for shape assertions.
function stubFetch(routes) {
  const calls = [];
  const fn = async (url, opts) => {
    const u = new URL(url);
    const key = opts.method + ' ' + u.pathname;
    calls.push({ key, body: JSON.parse(opts.body) });
    const hit = routes[key];
    const status = hit ? hit.status : 404;
    const body = hit ? hit.body : { error: 'ERR_VAL', message: 'no route' };
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  };
  fn.calls = calls;
  return fn;
}

describe('play request shape (P03 — docs win)', () => {
  it('sends exactly {amount, sessionID, mode} with the BASE bet in API units', async () => {
    const fetchFn = stubFetch({
      'POST /wallet/play': {
        status: 200,
        body: {
          balance: { amount: 99000000, currency: 'USD' },
          round: { betID: 1, amount: 1000000, payout: 0, payoutMultiplier: 0, active: false, mode: 'TRIAL', state: [] },
        },
      },
    });
    const res = await rgs.play('rgs2.engine.io', 'sess-1', 1000000, 'TRIAL', fetchFn);
    assert.deepStrictEqual(fetchFn.calls[0].body, { amount: 1000000, sessionID: 'sess-1', mode: 'TRIAL' });
    assert.strictEqual(res.round.active, false);
  });

  it('rejects non-integer amounts before any network call', async () => {
    const fetchFn = stubFetch({});
    await assert.rejects(rgs.play('h', 's', 1.5, 'TRIAL', fetchFn), /positive integer/);
    await assert.rejects(rgs.play('h', 's', 0, 'TRIAL', fetchFn), /positive integer/);
    assert.strictEqual(fetchFn.calls.length, 0);
  });

  it('surfaces RGS error codes (insufficient balance, busy round)', async () => {
    const poor = stubFetch({ 'POST /wallet/play': { status: 400, body: { error: 'ERR_IPB', message: 'broke' } } });
    await assert.rejects(rgs.play('h', 's', 1000000, 'TRIAL', poor), /broke/);
    const busy = stubFetch({ 'POST /wallet/play': { status: 400, body: { error: 'ERR_VAL', message: 'round active' } } });
    const err = await rgs.play('h', 's', 1000000, 'TRIAL', busy).catch((e) => e);
    assert.strictEqual(err.code, 'ERR_VAL');
  });
});

describe('refresh recovery (P03 — resume, never re-draw/void)', () => {
  it('returns null when no round record is present', () => {
    assert.strictEqual(rgs.resolveInFlightRound({ balance: {}, config: standardConfig() }), null);
    assert.strictEqual(rgs.resolveInFlightRound(null), null);
  });

  it('returns null for an already-closed round', () => {
    const auth = { round: { betID: 7, amount: 1000000, payout: 0, payoutMultiplier: 0, active: false, mode: 'TRIAL', state: [] } };
    assert.strictEqual(rgs.resolveInFlightRound(auth), null);
  });

  it('returns a resume descriptor copied from the active round record', () => {
    const round = { betID: 9, amount: 1500000, payout: 4000000, payoutMultiplier: 4, active: true, mode: 'ARMED', state: ['a'], event: 'reel-stop' };
    const resumed = rgs.resolveInFlightRound({ round });
    assert.deepStrictEqual(resumed, {
      betID: 9, amount: 1500000, payout: 4000000, payoutMultiplier: 4,
      mode: 'ARMED', state: ['a'], event: 'reel-stop',
    });
    // The record is copied, not referenced — callers cannot mutate history.
    assert.notStrictEqual(resumed, round);
  });

  it('derives outcome from the RGS payout only', () => {
    assert.strictEqual(rgs.deriveOutcome({ payout: 0 }), 'LOSS');
    assert.strictEqual(rgs.deriveOutcome({ payout: 2000000 }), 'WIN');
  });
});

describe('bet config (P05 — read, never hardcode)', () => {
  it('parses the standard template and validates divisibility', () => {
    const cfg = rgs.parseBetConfig(standardConfig());
    assert.strictEqual(cfg.minBet, 100000);
    assert.strictEqual(cfg.defaultBetLevel, 1000000);
    assert.ok(rgs.isValidBet(cfg, 1000000));
    assert.ok(rgs.isValidBet(cfg, 100000));
    assert.ok(!rgs.isValidBet(cfg, 150000)); // not divisible by stepBet
    assert.ok(!rgs.isValidBet(cfg, 50000)); // below minBet
  });

  it('rejects malformed configs instead of guessing', () => {
    assert.throws(() => rgs.parseBetConfig(null), /required/);
    assert.throws(() => rgs.parseBetConfig({ ...standardConfig(), betLevels: [] }), /non-empty/);
    assert.throws(() => rgs.parseBetConfig({ ...standardConfig(), minBet: 0.5 }), /integer/);
  });

  it('computes the Armed total from the live cost multiplier', () => {
    const cfg = rgs.parseBetConfig(standardConfig());
    assert.strictEqual(rgs.totalCostFor(cfg, 'ARMED', 1000000), 1500000);
    assert.strictEqual(rgs.totalCostFor(cfg, 'TRIAL', 1000000), 1000000);
  });
});

describe('money (P05 — integers end to end, display-only formatting)', () => {
  it('formats API units per currency without touching the integer', () => {
    const stake = 1000000;
    assert.ok(rgs.formatAmount(stake, 'USD').includes('1.00'));
    assert.ok(rgs.formatAmount(1500000, 'USD').includes('1.50'));
    assert.strictEqual(stake, 1000000); // formatting never mutates the stake
  });

  it('requires integer units', () => {
    assert.throws(() => rgs.formatAmount(1.5, 'USD'), /integer/);
  });

  it('builds the P04 Armed confirm copy from live values', () => {
    const cfg = rgs.parseBetConfig(standardConfig());
    const text = rgs.armedConfirmText(1000000, 'USD', cfg);
    assert.ok(text.includes('Armed Bout'), text);
    assert.ok(text.includes('1.50'), text);
    assert.ok(text.includes('1.00'), text);
    assert.ok(text.includes('paytable'), text); // v2: multi-stage payouts live in the paytable
  });
});

describe('event cursor', () => {
  it('posts to /bet/event with the exact shape', async () => {
    const fetchFn = stubFetch({ 'POST /bet/event': { status: 200, body: { event: 'reel-stop' } } });
    const res = await rgs.recordEvent('rgs2.engine.io', 'sess-1', 'reel-stop', fetchFn);
    assert.deepStrictEqual(fetchFn.calls[0], {
      key: 'POST /bet/event',
      body: { sessionID: 'sess-1', event: 'reel-stop' },
    });
    assert.strictEqual(res.event, 'reel-stop');
  });

  it('enforces the non-empty / <=32-byte rule client-side', async () => {
    const fetchFn = stubFetch({});
    await assert.rejects(rgs.recordEvent('h', 's', '', fetchFn), /non-empty/);
    await assert.rejects(rgs.recordEvent('h', 's', 'x'.repeat(33), fetchFn), /32/);
    assert.strictEqual(fetchFn.calls.length, 0);
  });
});
