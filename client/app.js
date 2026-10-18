/* SAND & STEEL — Phase 3b arena client (P09–P12b), extending the Phase 2 shell.
 *
 * Stateless RGS integration. The ONLY game-network calls are the five shapes
 * in rgs-client.js (ground truth: docs/rgs-ground-truth.md). Balance is
 * updated from RGS responses ONLY. No game state persists between rounds —
 * fighter selection, mute, and turbo are local UI prefs (localStorage) only.
 *
 * Phase 2 flows preserved: auth-gated BET, config-driven stake selector,
 * display-only currency, Trial/Armed modes with explicit Armed confirm,
 * spacebar = bet, help/paytable overlay, refresh recovery, stub harness
 * (?stub=1, ?hang=1). Harness-only extras: ?force=<code> (stub deals that
 * bout shape through the certified evaluateBout mapping — never on live)
 * and ?fast=1 (scales bout timing for automated runs; choreography logic
 * identical). Force codes: WIN, LOSS, NARROW, DECISIVE, DRAW (1 draw, then
 * stage 2), FLOOR (draw, then stage-2 loss on the 1x floor), DDRAW (2 draws,
 * then stage 3), DLOSS (2 draws, then stage-3 loss on the 5x floor), DD1000
 * (double draw to the 1000x/1500x decisive).
 *
 * Phase 3 additions:
 *  P09: code-drawn arena backdrop (client/arena.js) — bright dusk sky, sand
 *       floor, swaying crowd strip, two banners, no vignette. The crowd clock
 *       freezes during the bout so the fighters own the motion.
 *  P10: ROMA 470 sprite integration (client/sprites.js + client/clips.js) —
 *       per-frame pack timing, idle/walk/attack/hit/block/dodge/death/hold.
 *       House champion decision (fixed): rebel_champion is the house
 *       champion; the player picks from murmillo/secutor/retiarius/thraex.
 *       Secutor stays a player pick. Cosmetic only — never sent to the RGS.
 *  P11b: multi-stage outcome-first choreography (client/choreography.js SSv2)
 *       for the draw-escalation model (math/SPEC_V2.md): one RGS round
 *       resolves up to 3 stages; each stage is planned AFTER its RGS result
 *       is known and always resolves to it (narrow 1-2 HP / decisive 3+ HP /
 *       draw both at 1 HP / loss player at 0). Variety is uniform and
 *       outcome-independent (no near-miss framing). The full bout encodes to
 *       a <=32-byte /bet/event record for replayability.
 *  P12b: escalation result presentation — draws bank a visible floor
 *       ("DRAW — 1x guaranteed" / "DRAW — 5x locked"); terminal WIN shows
 *       "+amount" plainly; terminal LOSS (no payout) shows "DEFEAT" flat.
 *       A floor-paying stage loss still settles its floor and shows +amount.
 *       Banner stays readable >=1.5s before the panel re-arms. TURBO toggle
 *       shortens/skips stage cinematics (local pref, persisted).
 *  P14: Armed Bout presentation — ember arena grade, "ARMED BOUT" intro
 *       banner over the stage-1 walk-in, tighter beat budget (same 4-6s),
 *       persistent mode tag. Outcome-consistency untouched.
 *  P15: SFX + crowd via client/audio.js (Web Audio; auditioned Kenney /
 *       Pixabay picks): whoosh+blade per exchange, punchy hits, UI clicks,
 *       crowd swell on bout start and WIN only — never on loss. Mute
 *       silences everything.
 *  P16: Fablefly "THE BEAT OF BATTLE" ogg loop (2s equal-power crossfade —
 *       the file doesn't loop cleanly on its own): menu level on the bet
 *       panel, full level in bout, -6dB duck under the result banner.
 *  P17: juice within the rails (client/juice.js) — 50ms non-stacking
 *       hit-stop on decisive blows, sand-light dust on impacts, ±12px
 *       decaying kill-nudge. Scheduling, HP, finals, and holds untouched.
 */

(function () {
  'use strict';

  var Rgs = window.SandSteelRgs;
  var Bout = window.SandSteelMath || null;
  var Clips = window.SandSteelClips;
  var Arena = window.SandSteelArena;
  var Sprites = window.SandSteelSprites;
  var Choreo = window.SandSteelChoreo;
  var Sfx = window.SandSteelAudio || null;
  var Juice = window.SandSteelJuice || null;

  var PLAYER_OPTIONS = Sprites.PLAYER_OPTIONS;
  var HOUSE_CHAMPION = Sprites.HOUSE_CHAMPION; // fixed house champion (P10)
  var NAMES = Sprites.DISPLAY_NAMES;

  var SP = Sprites.createPlayer(Clips);

  // Arena geometry (960x540 canvas space).
  var ARENA_W = 960, ARENA_H = 540;
  var PLAYER_HOME = { x: 330, y: 472 };
  var CHAMP_HOME = { x: 630, y: 472 };
  var WALK_FROM = 190; // fighters walk in from ±WALK_FROM during walk-in
  var FIGHTER_SCALE = 2.4;
  var READABILITY_MS = 1600; // P12: banner readable this long before re-arm

  function $(id) { return document.getElementById(id); }

  function spriteUrl(id) { return Sprites.spriteUrl(id); }

  function readLaunchConfig(query) {
    var rgsHost = query.get('rgs_url') || '';
    return {
      sessionID: query.get('sessionID') || '',
      rgsHost: rgsHost,
      authenticateUrl: rgsHost ? 'https://' + rgsHost + '/wallet/authenticate' : '',
      lang: query.get('lang') || 'en',
      currency: query.get('currency') || '',
      device: query.get('device') || '',
      social: query.get('social') === 'true',
      demo: query.get('demo') === 'true',
      stub: query.get('stub') === '1',
      hang: query.get('hang') === '1',
      force: (query.get('force') || '').toUpperCase(), // harness only
      fast: query.get('fast') === '1', // harness only
    };
  }

  // Local UI prefs only — never sent to the RGS, never treated as game state.
  var prefs = {
    load: function () {
      try {
        var f = localStorage.getItem('ss.fighterId');
        return {
          fighterId: PLAYER_OPTIONS.indexOf(f) >= 0 ? f : PLAYER_OPTIONS[0],
          mute: localStorage.getItem('ss.mute') === '1',
          turbo: localStorage.getItem('ss.turbo') === '1',
        };
      } catch (e) { return { fighterId: PLAYER_OPTIONS[0], mute: false, turbo: false }; }
    },
    save: function (p) {
      try {
        localStorage.setItem('ss.fighterId', p.fighterId);
        localStorage.setItem('ss.mute', p.mute ? '1' : '0');
        localStorage.setItem('ss.turbo', p.turbo ? '1' : '0');
      } catch (e) { /* private mode: prefs just don't persist */ }
    },
  };

  function fighterName(id) { return NAMES[id] || id; }

  /* Stub RGS — harness only (?stub=1). Mirrors the doc shapes:
   * authenticate -> {balance, config, round?}; play debits base x the mode's
   * cost multiplier and holds paying rounds active until end-round; the
   * active round persists in sessionStorage so a reload exercises refresh
   * recovery. ?force=<code> (or window.__ssForce) deals that bout shape
   * through the certified evaluateBout mapping — harness ONLY, never live. */
  function makeStubRgs(opts) {
    var KEY = 'ss.stub.';
    function get(k, fallback) {
      try {
        var v = sessionStorage.getItem(KEY + k);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    }
    function set(k, v) {
      try { sessionStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {}
    }
    if (get('balance', null) == null) {
      set('balance', { amount: 100000000, currency: 'USD' }); // $100.00
    }
    var CONFIG = {
      minBet: 100000, maxBet: 1000000000, stepBet: 100000,
      defaultBetLevel: 1000000,
      betLevels: [100000, 200000, 500000, 1000000, 2000000, 5000000, 10000000],
      gameModes: [
        { mode: 'TRIAL', costMultiplier: 1.0, maxBet: 1000000000 },
        { mode: 'ARMED', costMultiplier: 1.5, maxBet: 1000000000 },
      ],
    };
    var betCounter = get('betCounter', 1000);

    function modeParams(mode) {
      var m = String(mode).toUpperCase();
      var gm = CONFIG.gameModes.filter(function (g) { return g.mode === m; })[0];
      if (!gm) throw new Error('unknown mode: ' + mode);
      return gm;
    }

    // Harness-only forced bout shapes (?force=<code> or window.__ssForce).
    // Each maps to a fixed draw array on the correct side of the certified
    // stage boundaries and still flows through evaluateBout — the mapping
    // stays honest. Random (unforced) bouts draw sequentially: one [0,1)
    // per stage reached, exactly like the RGS deal in SPEC_V2.
    var FORCE_DRAWS = {
      WIN: [0.0],            // stage-1 narrow win
      LOSS: [0.999999],      // stage-1 loss @0x
      NARROW: [0.0],
      DECISIVE: [0.33],      // stage-1 decisive @8x/12x
      DRAW: [0.36, 0.0],     // single draw -> stage 2 (1x floor banked)
      FLOOR: [0.36, 0.99],   // draw -> stage-2 loss, pays the 1x floor
      DDRAW: [0.36, 0.35, 0.0],   // double draw -> stage 3 (5x floor banked)
      DLOSS: [0.36, 0.35, 0.99],  // double draw -> stage-3 loss, pays 5x floor
      DD1000: [0.36, 0.35, 0.35], // double draw -> stage-3 decisive (1000x/1500x)
    };

    function forcedDraws() {
      var f = '';
      try {
        f = String(window.__ssForce || opts.force || '').toUpperCase();
      } catch (e) { f = String(opts.force || '').toUpperCase(); }
      return Object.prototype.hasOwnProperty.call(FORCE_DRAWS, f)
        ? FORCE_DRAWS[f].slice() : null;
    }

    // Harness-only deal: stands in for the RGS deal off certified v2 math.
    function dealBout(mode) {
      var forced = forcedDraws();
      if (forced) {
        return { draws: forced, bout: Bout.evaluateBout(forced, mode) };
      }
      var draws = [Math.random()];
      for (;;) {
        try {
          return { draws: draws, bout: Bout.evaluateBout(draws, mode) };
        } catch (e) {
          if (e instanceof RangeError && /mid-bout/.test(e.message)) {
            draws.push(Math.random());
            continue;
          }
          throw e;
        }
      }
    }

    return {
      name: 'stub',
      config: CONFIG,
      authenticate: async function () {
        return { balance: get('balance'), config: CONFIG, round: get('round', null) };
      },
      play: async function (baseBetUnits, mode) {
        if (get('round', null) && get('round').active) {
          throw new Error('ERR_VAL: a round is already active');
        }
        var gm = modeParams(mode);
        var debit = Math.round(baseBetUnits * gm.costMultiplier);
        var bal = get('balance');
        if (bal.amount < debit) throw new Error('ERR_IPB: insufficient player balance');
        betCounter += 1;
        set('betCounter', betCounter);
        // Harness-only deal off the certified v2 mapping (never on live):
        // one RGS round resolves ALL stages; state carries the full stage
        // breakdown for choreography + bet replay.
        var deal = dealBout(mode);
        var bout = deal.bout;
        var payout = Bout.payoutFor(mode, bout, baseBetUnits);
        bal = { amount: bal.amount - debit, currency: bal.currency };
        set('balance', bal);
        var round = {
          betID: betCounter,
          amount: baseBetUnits,
          payout: payout,
          payoutMultiplier: bout.payoutMult,
          active: payout > 0,
          mode: String(mode).toUpperCase(),
          state: [{
            draws: deal.draws,
            stages: bout.stages,
            payoutMult: bout.payoutMult,
          }],
          event: null,
        };
        if (round.active) set('round', round);
        return { balance: get('balance'), round: round };
      },
      recordEvent: async function (event) {
        var r = get('round', null);
        if (r) { r.event = event; set('round', r); }
        else { set('lastChoreo', event); }
        return { event: event };
      },
      endRound: async function () {
        var r = get('round', null);
        if (!r || !r.active) throw new Error('ERR_VAL: no active round');
        var bal = get('balance');
        bal = { amount: bal.amount + r.payout, currency: bal.currency };
        set('balance', bal);
        set('round', null);
        return { balance: get('balance') };
      },
      clearRound: async function () { set('round', null); },
    };
  }

  /* Live RGS — thin adapter over rgs-client.js fetch wrappers. */
  function makeLiveRgs(launch) {
    return {
      name: 'live',
      authenticate: function () {
        return Rgs.authenticate(launch.rgsHost, launch.sessionID);
      },
      play: function (baseBetUnits, mode) {
        return Rgs.play(launch.rgsHost, launch.sessionID, baseBetUnits, mode);
      },
      recordEvent: function (event) {
        return Rgs.recordEvent(launch.rgsHost, launch.sessionID, event);
      },
      endRound: function () {
        return Rgs.endRound(launch.rgsHost, launch.sessionID);
      },
    };
  }

  function fmt(units, currency) { return Rgs.formatAmount(units, currency); }

  // Cost multiplier for a mode, read from the live authenticate config.
  function costMult(betConfig, mode) {
    if (!betConfig) return mode === 'ARMED' ? 1.5 : 1.0;
    var gm = betConfig.gameModes[String(mode).toUpperCase()];
    return gm ? gm.costMultiplier : 1.0;
  }

  async function boot() {
    var q = new URLSearchParams(window.location.search);
    var launch = readLaunchConfig(q);
    var user = prefs.load();
    var useStub = launch.stub || !launch.sessionID || !launch.rgsHost;
    var backend = useStub ? makeStubRgs(launch) : makeLiveRgs(launch);
    // Timing scale: ?fast=1 (harness) 8x; TURBO pref 3x (shortens stage
    // cinematics); choreography beats and end states are identical.
    function computeTimeScale() {
      try {
        if (launch.fast || window.__ssFast) return 8;
      } catch (e) { if (launch.fast) return 8; }
      return user.turbo ? 3 : 1;
    }
    var timeScale = computeTimeScale();

    var state = {
      balance: null, betConfig: null, resume: null,
      mode: 'TRIAL', baseBet: 0, displayCurrency: launch.currency || 'USD',
      busy: false, authenticated: false, boutActive: false,
      currentRoundId: null,
    };

    // --- static refs ---
    var statusEl = $('status'), configEl = $('config'), balanceEl = $('balance'),
      modeTrial = $('mode-trial'), modeArmed = $('mode-armed'),
      stakeSel = $('stake'), currencySel = $('currency'),
      betMinus = $('bet-minus'), betPlus = $('bet-plus'),
      deckBet = $('deck-bet'), deckWin = $('deck-win'),
      muteBox = $('mute'),
      turboBox = $('turbo'),
      betBtn = $('bet'), confirmBar = $('armed-confirm'),
      confirmText = $('armed-confirm-text'), confirmYes = $('armed-yes'),
      confirmNo = $('armed-no'), resultEl = $('result'),
      versusEl = $('versus'),
      stageLineEl = $('stage-line'),
      resumeBar = $('resume'), resumeText = $('resume-text'),
      resumeGo = $('resume-go'), resumeDismissNote = $('resume-note'),
      authErrorBar = $('auth-error'), authErrorText = $('auth-error-text'),
      authRetry = $('auth-retry'),
      cardsEl = $('fighter-cards'),
      costLine = $('cost-line'),
      helpOpen = $('help-open'), helpOverlay = $('help-overlay'),
      helpBody = $('help-body'), helpClose = $('help-close'),
      arenaCv = $('arena'), bannerEl = $('banner'),
      centerEl = $('center'),
      betHalf = $('bet-half'), betDouble = $('bet-double'), betAmount = $('bet-amount'),
      iconMute = $('icon-mute'), iconTurbo = $('icon-turbo'), iconHelp = $('icon-help'),
      statusbar = $('statusbar'), sbRound = $('sb-round'), sbBalance = $('sb-balance'),
      sbStatus = $('sb-status'), sbHp = $('sb-hp'),
      deckBalanceMobile = $('deck-balance-mobile'), deckWinMobile = $('deck-win-mobile');

    // P15: Web Audio engine (SFX + crowd; P16 adds the music loop). The
    // mute pref silences EVERYTHING via the master gain — and the engine
    // schedules no new voices while muted.
    var sound = Sfx ? Sfx.create({ muted: user.mute }) : null;
    function uiSound(kind) {
      try { if (sound) sound.ui(kind); } catch (e) {}
    }
    function unlockAudio() {
      try {
        if (sound && sound.unlock()) {
          // P16: start the Fablefly loop at menu level once decoded.
          var lp = sound.loadAll();
          if (lp && typeof lp.then === 'function') {
            lp.then(function () { try { sound.musicStart(); } catch (e) {} });
          }
        }
      } catch (e) {}
    }
    // Autoplay policy: the context resumes on the first user gesture.
    try {
      document.addEventListener('pointerdown', unlockAudio);
      document.addEventListener('keydown', unlockAudio);
    } catch (e) {}
    muteBox.checked = user.mute;
    muteBox.addEventListener('change', function () {
      user.mute = muteBox.checked; prefs.save(user);
      try { if (sound) sound.setMuted(user.mute); } catch (e) {}
      uiSound('toggle');
    });
    if (turboBox) {
      turboBox.checked = user.turbo;
      turboBox.addEventListener('change', function () {
        user.turbo = turboBox.checked; prefs.save(user);
        timeScale = computeTimeScale();
        uiSound('toggle');
        note('Turbo ' + (user.turbo ? 'ON — stage cinematics shortened.' : 'OFF — full stage cinematics.') +
          ' (local pref — not sent to the RGS).');
      });
    }

    /* --- P10: sprite images (cosmetic only) --- */
    var spriteCache = {};
    function spriteFor(id) {
      if (!spriteCache[id]) {
        var img = null;
        try {
          img = new Image();
          img.src = spriteUrl(id);
        } catch (e) { img = null; }
        spriteCache[id] = img;
      }
      return spriteCache[id];
    }
    [HOUSE_CHAMPION].concat(PLAYER_OPTIONS).forEach(spriteFor);

    function attachImage(f) {
      var img = spriteFor(f.id);
      f.img = img;
      if (img && img.complete && img.naturalWidth > 0) {
        f.loaded = true;
      } else if (img) {
        try {
          img.addEventListener('load', function onload() {
            f.loaded = true;
            img.removeEventListener('load', onload);
          });
        } catch (e) {}
      }
      return f;
    }

    /* --- P09/P10: arena scene --- */
    var crowd = Arena.makeCrowd();
    var actx = null;
    try {
      actx = (arenaCv && arenaCv.getContext) ? arenaCv.getContext('2d') : null;
    } catch (e) { actx = null; }
    if (actx) {
      try { actx.imageSmoothingEnabled = false; } catch (e) {}
    }

    var playerF = attachImage(SP.makeFighter(user.fighterId, 'right'));
    var champF = attachImage(SP.makeFighter(HOUSE_CHAMPION, 'left'));
    playerF.scale = FIGHTER_SCALE;
    champF.scale = FIGHTER_SCALE;
    playerF.x = PLAYER_HOME.x; playerF.y = PLAYER_HOME.y;
    champF.x = CHAMP_HOME.x; champF.y = CHAMP_HOME.y;

    var crowdT = 0; // crowd clock; frozen while boutActive (P09)
    var frozenCrowdT = 0;
    var parts = []; // impact / celebration particles
    // P22: full-ROMA clip usage tracking (runner-side only — the encoded
    // replay record is untouched). lastDefense drives the guard-shatter
    // blockhit on the killing blow; boutAttacks spots the bout opener for
    // the retiarius netcast. Both derive from variety/fighter pick only.
    var lastDefense = { player: null, champ: null };
    var boutAttacks = 0;
    var shake = 0;
    var boutClock = null; // active bout timeline or null
    var boutMode = null; // P14: mode of the round being played (grade source mid-bout)
    // P17: juice state — hit-stop freeze, kill-nudge, dust (rails in juice.js)
    var juice = Juice ? Juice.createJuice() : null;
    var idleSeed = 0;

    function resetStance(walkOut) {
      SP.setClip(playerF, 'idle');
      SP.setClip(champF, 'idle');
      playerF.flash = 0; champF.flash = 0;
      parts.length = 0;
      shake = 0;
      boutClock = null;
      lastDefense.player = null; lastDefense.champ = null;
      // P17: juice never leaks between bouts.
      try {
        if (Juice && juice) {
          juice.hitStopPending = 0; juice.hitStops = 0;
          juice.nudgeX = 0; juice.nudgeY = 0;
        }
      } catch (e) {}
      if (walkOut) {
        playerF.x = PLAYER_HOME.x; playerF.y = PLAYER_HOME.y;
        champF.x = CHAMP_HOME.x; champF.y = CHAMP_HOME.y;
      }
    }
    resetStance(true);

    /* --- P11b: stage HP bars (presentation only; finals come from the RGS) --- */
    var hpShown = { player: 5, champ: 5, max: 5 };
    function resetHp(max) {
      hpShown.player = max; hpShown.champ = max; hpShown.max = max;
      renderStatusbar();
    }
    function applyHp(hpAfter) {
      if (!hpAfter) return;
      hpShown.player = hpAfter.player;
      hpShown.champ = hpAfter.champ;
      renderStatusbar();
    }
    function drawHpBar(ctx, x, yTop, frac, label) {
      var W = 150, H = 14;
      var x0 = Math.round(x - W / 2), y0 = Math.round(yTop);
      ctx.fillStyle = 'rgba(20, 12, 4, 0.75)';
      ctx.fillRect(x0 - 2, y0 - 2, W + 4, H + 4);
      ctx.fillStyle = '#5a1414';
      ctx.fillRect(x0, y0, W, H);
      var w = Math.round(W * Math.max(0, Math.min(1, frac)));
      ctx.fillStyle = frac > 0.5 ? '#7fd35a' : frac > 0.25 ? '#e8b64c' : '#d94f3d';
      ctx.fillRect(x0, y0, w, H);
      ctx.fillStyle = 'rgba(20, 12, 4, 0.75)';
      ctx.fillRect(x0, y0 + H + 2, W, 13);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y0 + H + 12);
    }
    function drawHpBars(ctx) {
      var yTop = 36; // sky band: clear of the crowd strip and the fighters
      drawHpBar(ctx, playerF.x, yTop,
        hpShown.max ? hpShown.player / hpShown.max : 0,
        fighterName(user.fighterId) + ' ' + hpShown.player + '/' + hpShown.max);
      drawHpBar(ctx, champF.x, yTop,
        hpShown.max ? hpShown.champ / hpShown.max : 0,
        fighterName(HOUSE_CHAMPION) + ' ' + hpShown.champ + '/' + hpShown.max);
    }

    function spawnImpact(x, y, big) {
      // P24: sword-hit impact. The slash is a stroke-able arc particle —
      // drawn as a gold/white arc sweeping across the impact point and
      // fading over ~150ms (kind 'slash'). Sparks spray as short LINES
      // radiating from the impact (kind 'spark'), never squares.
      parts.push({
        kind: 'slash',
        x: x, y: y,
        vx: 0, vy: 0, // the arc is drawn around (x, y); it never travels
        r: 90 + Math.random() * 70 + (big ? 70 : 0),
        a0: Math.random() * 6.283,
        life: 150,
        t: 0,
        c: '#fff3c0',
      });
      var n = big ? 16 : 10, i, a, sp;
      for (i = 0; i < n; i++) {
        a = Math.random() * 6.283;
        sp = 90 + Math.random() * 260;
        parts.push({
          kind: 'spark', // P17: tagged kinds share one integrator
          x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
          grav: 500, sz: 4,
          life: 450 + Math.random() * 250, t: 0,
          c: i % 3 ? '#ffd97a' : '#ffffff',
          ang: a,
        });
      }
      for (i = 0; i < 8; i++) {
        a = Math.random() * 6.283;
        parts.push({
          kind: 'spark',
          x: x - 40 + Math.random() * 80, y: 500,
          vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 120,
          grav: 500, sz: 4,
          life: 500 + Math.random() * 300, t: 0,
          c: '#d9a960',
          ang: a,
        });
      }
    }

    // P17 juice helpers — cosmetic only, never touch game state.
    function dust(x, y, big) {
      try { if (Juice && juice) Juice.spawnDust(parts, x, y, big); } catch (e) {}
    }
    function hitStop() {
      try { if (Juice && juice) Juice.triggerHitStop(juice); } catch (e) {}
    }
    function killNudge(winner) {
      try { if (Juice && juice) Juice.triggerNudge(juice, winner); } catch (e) {}
    }

    function spawnGoldRain() {
      // WIN-ONLY celebration. Never spawned on a loss (P12). Tagged
      // kind:'celebrate' (P20) so win-styling is structurally separable from
      // combat sparks/dust and auditable on every final frame.
      for (var i = 0; i < 8; i++) {
        parts.push({
          kind: 'celebrate',
          x: Math.random() * ARENA_W, y: -10,
          vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 160,
          grav: 500, sz: 4,
          life: 2200, t: 0,
          c: ['#ffd97a', '#e8b64c', '#ffffff'][Math.floor(Math.random() * 3)],
        });
      }
    }

    function sideFighter(side) { return side === 'player' ? playerF : champF; }

    // P15: one cosmetic sound call per choreography beat. Never reads or
    // changes game state; safe to no-op when audio is locked/muted.
    function fightSound(kind) {
      try { if (sound) sound.fight(kind); } catch (e) {}
    }

    // Legacy SSv1 replay path (old WIN/LOSS records only — no new rounds
    // ever write this shape; kept so recorded rounds stay replayable).
    function applyActionLegacy(ev, plan) {
      var atk, def, loser, winner;
      if (ev.action === 'walk-in') {
        SP.setClip(playerF, 'walk');
        SP.setClip(champF, 'walk');
        playerF.x = PLAYER_HOME.x - WALK_FROM;
        champF.x = CHAMP_HOME.x + WALK_FROM;
      } else if (ev.action === 'attack') {
        atk = sideFighter(ev.beat.attacker);
        SP.setClip(atk, 'attack');
        fightSound('attack');
      } else if (ev.action === 'react') {
        def = sideFighter(ev.beat.defender);
        atk = sideFighter(ev.beat.attacker);
        if (ev.beat.defense === 'dodge') {
          SP.setClip(def, 'dodge');
          fightSound('dodge');
          spawnImpact(def.x, def.y - 200, false);
        } else if (ev.beat.defense === 'block') {
          SP.setClip(def, 'block');
          fightSound('block');
          def.flash = 0.5;
          shake = Math.max(shake, 6);
          spawnImpact(def.x + (def === playerF ? 60 : -60), def.y - 260, false);
          dust(def.x, def.y - 200, false);
        } else {
          SP.setClip(def, 'hit');
          fightSound('hit');
          def.flash = 1;
          shake = Math.max(shake, 9);
          spawnImpact(def.x, def.y - 260, true);
        }
        void atk;
      } else if (ev.action === 'finale-attack') {
        SP.setClip(sideFighter(plan.winner), 'attack');
      } else if (ev.action === 'finale-hit') {
        loser = sideFighter(plan.loser);
        SP.setClip(loser, 'hit');
        fightSound('finale');
        hitStop(); // P17: freeze on the decisive blow (legacy replays too)
        loser.flash = 1;
        shake = Math.max(shake, 12);
        spawnImpact(loser.x, loser.y - 260, true);
        dust(loser.x, loser.y - 200, false);
      } else if (ev.action === 'death') {
        loser = sideFighter(plan.loser);
        SP.setClip(loser, 'death');
        fightSound('death');
        killNudge(plan.winner); // P17: subtle camera nudge, blow's direction
        dust(loser.x, loser.y - 60, true);
        shake = Math.max(shake, 12);
        if (plan.outcome === 'WIN') {
          SP.setClip(sideFighter(plan.winner), 'hold'); // victory hold
        } else {
          SP.setClip(sideFighter(plan.winner), 'idle'); // subdued: no hold on loss
        }
      } else if (ev.action === 'hold') {
        if (plan.outcome === 'WIN') {
          SP.setClip(sideFighter(plan.winner), 'hold');
        }
      }
    }

    // P11b stage action. plan is a stage plan (winner/loser/hpMax, winner
    // null on draws). HP bars follow ev.hpAfter; the finale/standoff always
    // lands the RGS stage result exactly.
    function applyAction(ev, plan) {
      if (plan && plan.outcome) return applyActionLegacy(ev, plan);
      var atk, def, loser;
      var won = plan.winner === 'player';
      if (ev.action === 'walk-in') {
        SP.setClip(playerF, 'walk');
        SP.setClip(champF, 'walk');
        playerF.x = PLAYER_HOME.x - WALK_FROM;
        champF.x = CHAMP_HOME.x + WALK_FROM;
      } else if (ev.action === 'reset') {
        // Stages 2-3: fighters charge back in with new weapons (P22: the
        // pack's Charge loop, 700ms) at refilled HP.
        SP.setClip(playerF, 'charge');
        SP.setClip(champF, 'charge');
        playerF.x = PLAYER_HOME.x;
        champF.x = CHAMP_HOME.x;
        resetHp(plan.hpMax);
      } else if (ev.action === 'attack') {
        atk = sideFighter(ev.beat.attacker);
        // P22: a retiarius opening the bout leads with the net (NetCast
        // one-shot, 850ms). Fighter pick + bout position only — never the
        // outcome; the exchange resolves exactly as planned either way.
        if (boutAttacks === 0 && atk.id === 'retiarius') {
          SP.setClip(atk, 'netcast');
        } else {
          SP.setClip(atk, 'attack');
        }
        boutAttacks++;
        fightSound('attack'); // whoosh + blade
      } else if (ev.action === 'react') {
        def = sideFighter(ev.beat.defender);
        atk = sideFighter(ev.beat.attacker);
        lastDefense[ev.beat.defender] = ev.beat.defense;
        if (ev.beat.defense === 'dodge') {
          SP.setClip(def, 'dodge');
          fightSound('dodge'); // quiet whoosh only
          spawnImpact(def.x, def.y - 200, false);
        } else if (ev.beat.defense === 'block') {
          SP.setClip(def, 'block');
          fightSound('block'); // metal clash
          def.flash = 0.5;
          shake = Math.max(shake, 6);
          spawnImpact(def.x + (def === playerF ? 60 : -60), def.y - 260, false);
          dust(def.x, def.y - 200, false);
        } else {
          SP.setClip(def, 'hit');
          fightSound('hit'); // punchy helmet hit
          def.flash = 1;
          shake = Math.max(shake, 9);
          spawnImpact(def.x, def.y - 260, true);
          dust(def.x, def.y - 200, false); // P17: sand kicks up on impacts
        }
        void atk;
        applyHp(ev.hpAfter);
      } else if (ev.action === 'finale-attack') {
        SP.setClip(sideFighter(ev.beat.attacker), 'attack');
      } else if (ev.action === 'finale-hit') {
        def = sideFighter(ev.beat.defender);
        // P22: a raised guard shattered by the killing blow plays blockhit;
        // anything else plays hit. Variety-derived, and the loser dies
        // identically either way — the outcome always resolves.
        SP.setClip(def, lastDefense[ev.beat.defender] === 'block' ? 'blockhit' : 'hit');
        fightSound('finale'); // layered killing-blow impact
        hitStop(); // P17: 2-3 frame freeze on the decisive blow
        def.flash = 1;
        shake = Math.max(shake, 12);
        spawnImpact(def.x, def.y - 260, true);
        dust(def.x, def.y - 200, false);
        applyHp(ev.hpAfter);
      } else if (ev.action === 'death') {
        loser = sideFighter(plan.loser);
        SP.setClip(loser, 'death');
        fightSound('death'); // dull thud under the fall
        killNudge(plan.winner); // P17: subtle camera nudge, blow's direction
        dust(loser.x, loser.y - 60, true); // P17: big sand burst where he lands
        shake = Math.max(shake, 12);
        if (won) {
          SP.setClip(sideFighter(plan.winner), 'hold'); // victory hold
        } else {
          SP.setClip(sideFighter(plan.winner), 'idle'); // subdued: no hold on loss
        }
        applyHp(ev.hpAfter);
      } else if (ev.action === 'standoff') {
        // Draw: both survive at 1 HP — no death, no hold, no fanfare.
        SP.setClip(playerF, 'idle');
        SP.setClip(champF, 'idle');
        applyHp(ev.hpAfter);
      } else if (ev.action === 'hold') {
        if (won) {
          SP.setClip(sideFighter(plan.winner), 'hold');
        }
        applyHp(ev.hpAfter);
      }
    }

    // Run one legacy v1 bout to its banner (SSv1 replay only). Timing scales
    // with timeScale (harness ?fast=1 only); beats and end states identical.
    // P14: optional mode sets the arena grade during the replay.
    function runBout(plan, mode) {
      return new Promise(function (resolve) {
        var schedule = Choreo.schedulePlan(plan, function (id, side, clip) {
          return Clips.totalMs(id, side, clip);
        }, {
          player: { id: playerF.id, side: 'right' },
          champ: { id: champF.id, side: 'left' },
        });
        frozenCrowdT = crowdT;
        state.boutActive = true;
        setFightMode(true);
        boutMode = mode || state.mode;
        hideBanner();
        resetStance(false);
        var evs = schedule.events.slice();
        var el = 0;
        boutClock = {
          plan: plan,
          update: function (dtMs) {
            // P17: hit-stop consumes real frame time before the scheduled
            // timeline advances — the freeze never changes totals.
            if (Juice && juice && Juice.consumeHitStop(juice, dtMs)) return;
            el += dtMs * timeScale;
            // walk-in glide toward home marks
            if (el < 600) {
              var k = Math.min(1, el / 600);
              playerF.x = PLAYER_HOME.x - WALK_FROM * (1 - k);
              champF.x = CHAMP_HOME.x + WALK_FROM * (1 - k);
            } else {
              playerF.x = PLAYER_HOME.x;
              champF.x = CHAMP_HOME.x;
            }
            while (evs.length && evs[0].at <= el) {
              var ev = evs.shift();
              if (ev.action === 'banner') {
                boutClock = null;
                state.boutActive = false;
                setFightMode(false);
                resolve(plan.outcome);
              } else {
                applyAction(ev, plan);
              }
            }
          },
        };
      });
    }

    // P11b: run one stage of a v2 bout. Resolves 'draw' when a draw
    // standoff lands (caller plays the floor transition), or 'terminal'
    // when a decisive finale lands (caller shows the terminal banner).
    // P14: mode selects the presentation grade/pace — 'ARMED' stages run
    // the warmer arena grade, the tighter (but still 4-6s) beat budget,
    // and an "ARMED BOUT" intro banner over the stage-1 walk-in. The
    // events, HP track, and finals are identical to Trial: mode never
    // touches outcome-consistency.
    function runStage(stagePlan, isFirst, mode) {
      return new Promise(function (resolve) {
        var pace = mode === 'ARMED' ? 'armed' : 'trial';
        var schedule = Choreo.scheduleStage(stagePlan, function (id, side, clip) {
          return Clips.totalMs(id, side, clip);
        }, {
          player: { id: playerF.id, side: 'right' },
          champ: { id: champF.id, side: 'left' },
        }, isFirst, { pace: pace });
        if (isFirst) {
          frozenCrowdT = crowdT;
          state.boutActive = true;
          setFightMode(true);
          boutMode = mode || state.mode;
          hideBanner();
          resetStance(false);
          if (boutMode === 'ARMED' && bannerEl) {
            bannerEl.hidden = false;
            bannerEl.className = 'armed';
            bannerEl.textContent = 'ARMED BOUT';
          }
        }
        resetHp(stagePlan.hpMax);
        var evs = schedule.events.slice();
        var el = 0;
        boutClock = {
          plan: stagePlan,
          update: function (dtMs) {
            // P17: hit-stop consumes real frame time before the scheduled
            // timeline advances — the freeze never changes totals.
            if (Juice && juice && Juice.consumeHitStop(juice, dtMs)) return;
            el += dtMs * timeScale;
            if (isFirst) {
              // walk-in glide toward home marks
              if (el < 600) {
                var k = Math.min(1, el / 600);
                playerF.x = PLAYER_HOME.x - WALK_FROM * (1 - k);
                champF.x = CHAMP_HOME.x + WALK_FROM * (1 - k);
              } else {
                playerF.x = PLAYER_HOME.x;
                champF.x = CHAMP_HOME.x;
              }
            }
            while (evs.length && evs[0].at <= el) {
              var ev = evs.shift();
              if (ev.action === 'banner') {
                boutClock = null;
                if (stagePlan.result !== 'draw') {
                  state.boutActive = false;
                  setFightMode(false);
                }
                resolve(stagePlan.result === 'draw' ? 'draw' : 'terminal');
              } else {
                if (isFirst && boutMode === 'ARMED' && ev.action === 'attack') {
                  hideBanner(); // intro yields to the first exchange
                }
                applyAction(ev, stagePlan);
              }
            }
          },
        };
      });
    }

    // Banked floor text after a draw stage (P12b). The floor is the next
    // stage's loss mult, read from the certified tables — never hardcoded.
    function floorMultText(stageIndex, mode) {
      var m = Bout[String(mode).toUpperCase()].stages[stageIndex + 1].loss.mult;
      return m + 'x';
    }

    // P11b/P12b draw transition: floor banner beat, weapon-swap flash, HP
    // refill. Shortened under TURBO/?fast; never skipped entirely (the floor
    // must stay readable).
    function drawTransition(stageIndex, mode) {
      var floor = floorMultText(stageIndex, mode);
      var word = stageIndex === 0 ? 'guaranteed' : 'locked';
      var text = 'DRAW — ' + floor + ' ' + word + ' · new weapons!';
      if (bannerEl) {
        bannerEl.hidden = false;
        bannerEl.className = 'draw';
        bannerEl.textContent = text;
      }
      stageLineEl.textContent = 'STAGE ' + (stageIndex + 1) + ' drawn — ' +
        floor + ' banked. Stage ' + (stageIndex + 2) + ' — fresh weapons, full HP.';
      resultEl.textContent = text;
      resultEl.className = '';
      // Weapon-swap visual: both fighters flash and reset to idle.
      playerF.flash = 1; champF.flash = 1;
      SP.setClip(playerF, 'idle');
      SP.setClip(champF, 'idle');
      fightSound('swap'); // P15: shimmer under the weapon swap, no crowd
      var beat = timeScale > 1 ? 450 : 1500;
      return new Promise(function (r) { setTimeout(r, beat); });
    }

    function stageLine(text) {
      if (stageLineEl) stageLineEl.textContent = text;
    }

    // P11b: play every stage of a v2 bout in order, with floor transitions
    // between draws. Returns the per-stage end states for the harness.
    // P15: live=true marks a fresh bout (crowd swell on bout start);
    // replays pass false so resumed rounds stay silent on crowd.
    async function runStages(boutPlan, mode, live) {
      var played = [];
      boutAttacks = 0; // P22: bout-opener tracking for the netcast (replays replay it identically)
      for (var i = 0; i < boutPlan.stages.length; i++) {
        var sp = boutPlan.stages[i];
        stageLine('STAGE ' + (i + 1) + ' of ' + boutPlan.stages.length +
          ' — ' + sp.hpMax + ' HP each');
        if (i === 0 && live) {
          try { if (sound) sound.boutStart(); } catch (e) {}
        }
        var end = await runStage(sp, i === 0, mode);
        played.push({ stageIndex: i, result: sp.result, endHp: sp.endHp });
        if (end === 'draw') {
          await drawTransition(i, mode);
        }
      }
      return played;
    }

    var lastT = 0;
    function frame(t) {
      var dt = Math.min(50, t - (lastT || t));
      lastT = t;
      if (!actx) return;
      try {
        // P17: while hit-stop freeze remains, fighters and particles hold
        // their pose (classic hit-stop) — the scene still draws every frame.
        var frozen = !!(Juice && juice && juice.hitStopPending > 0);
        if (!state.boutActive) {
          crowdT += dt;
          // Idle: both fighters breathe; portraits of the coming bout.
          SP.step(playerF, dt);
          SP.step(champF, dt);
        } else if (boutClock) {
          boutClock.update(dt);
          if (!frozen) {
            SP.step(playerF, dt * timeScale);
            SP.step(champF, dt * timeScale);
          }
        }
        if (!frozen) {
          for (var i = parts.length - 1; i >= 0; i--) {
            var p = parts[i];
            p.t += state.boutActive ? dt * timeScale : dt;
            if (p.t >= p.life) { parts.splice(i, 1); continue; }
            var k = state.boutActive ? timeScale : 1;
            p.x += p.vx * dt * k / 1000;
            p.y += p.vy * dt * k / 1000;
            p.vy += (p.grav == null ? 500 : p.grav) * dt * k / 1000;
          }
        }
        shake = Math.max(0, shake - dt / 40);
        // P17: kill-nudge decays alongside the shake, same frame.
        try { if (Juice && juice) Juice.decayNudge(juice, dt); } catch (e) {}
        var nx = juice ? juice.nudgeX : 0, ny = juice ? juice.nudgeY : 0;

        actx.save();
        if (shake > 0) {
          actx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        }
        if (nx || ny) actx.translate(nx, ny);
        // P09: frozen crowd clock during the bout — backdrop stays static.
        // P14: the grade follows the round in play mid-bout, else the
        // selected mode — the player can always tell which mode they're in.
        var grade = (state.boutActive ? boutMode : state.mode) === 'ARMED'
          ? 'armed' : 'trial';
        Arena.drawArena(actx, ARENA_W, ARENA_H,
          state.boutActive ? frozenCrowdT : crowdT, crowd, { grade: grade });
        SP.drawShadow(actx, playerF, 70, 14);
        SP.drawShadow(actx, champF, 70, 14);
        SP.draw(actx, playerF);
        SP.draw(actx, champF);
        if (state.boutActive) drawHpBars(actx); // P11b: stage HP above fighters
        for (i = 0; i < parts.length; i++) {
          p = parts[i];
          actx.globalAlpha = Math.max(0, 1 - p.t / p.life);
          if (p.kind === 'slash') {
            // P24: sword-hit effect — a stroked arc sweeping across the
            // impact point, gold/white, fading over ~150ms. Cosmetic only.
            var prog = p.t / p.life;
            var rad = p.r * Math.min(1, prog * 1.8);
            actx.strokeStyle = p.c;
            actx.lineWidth = 6;
            actx.beginPath();
            actx.arc(p.x, p.y, rad, p.a0, p.a0 + Math.PI, false);
            actx.stroke();
          } else if (p.kind === 'spark') {
            // Spark spray — short LINES radiating from the impact point,
            // never squares (P24).
            var len = (p.sz || 4) * 3 + 4;
            var dx = Math.cos(p.ang) * len / 2;
            var dy = Math.sin(p.ang) * len / 2;
            actx.strokeStyle = p.c;
            actx.lineWidth = 2;
            actx.beginPath();
            actx.moveTo(p.x - dx, p.y - dy);
            actx.lineTo(p.x + dx, p.y + dy);
            actx.stroke();
          } else {
            // Dust puffs (and celebration rain) draw as soft circles —
            // never squares (P24).
            var sz = p.sz || 4;
            actx.fillStyle = p.c;
            actx.beginPath();
            actx.arc(p.x, p.y, sz / 2, 0, 6.283);
            actx.fill();
          }
        }
        actx.globalAlpha = 1;
        actx.restore();
      } catch (e) { /* arena is cosmetic — never break the bet flow */ }
    }
    try {
      var raf = window.requestAnimationFrame.bind(window);
      (function loop(t) { frame(t || 0); raf(loop); })(0);
    } catch (e) { /* no rAF (node harness): arena simply doesn't animate */ }
    idleSeed = 1;

    function versusLine() {
      versusEl.textContent = fighterName(user.fighterId) + '  vs  ' +
        fighterName(HOUSE_CHAMPION) + ' (house champion)';
    }
    versusLine();

    /* --- P07 fighter cards (portraits via the sprite player) --- */
    function paintPortraits() {
      if (!cardsEl) return;
      var cards = cardsEl.querySelectorAll('canvas.portrait');
      for (var i = 0; i < cards.length; i++) {
        (function (cv) {
          var id = cv.getAttribute('data-fighter');
          var ctx = null;
          try { ctx = cv.getContext('2d'); } catch (e) { return; }
          if (!ctx) return;
          try { ctx.imageSmoothingEnabled = false; } catch (e) {}
          var img = spriteFor(id);
          function paint() {
            try {
              ctx.clearRect(0, 0, cv.width, cv.height);
              if (img && img.complete && img.naturalWidth > 0) {
                // Idle frame, right profile — same art as the arena.
                var clip = Clips.get(id, 'right', 'idle');
                var frameNo = clip.from + 2;
                ctx.drawImage(img,
                  (frameNo % 8) * 128, Math.floor(frameNo / 8) * 128,
                  128, 128, 0, 0, cv.width, cv.height);
              }
            } catch (e) {}
          }
          if (img && !img.complete) {
            try {
              img.addEventListener('load', function onload() {
                paint();
                img.removeEventListener('load', onload);
              });
            } catch (e) {}
          }
          paint();
        })(cards[i]);
      }
    }

    function renderCards() {
      if (!cardsEl) return;
      cardsEl.innerHTML = '';
      PLAYER_OPTIONS.forEach(function (id) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'fighter-card' + (id === user.fighterId ? ' selected' : '');
        b.setAttribute('data-id', id);
        b.setAttribute('aria-pressed', id === user.fighterId ? 'true' : 'false');
        var cv = document.createElement('canvas');
        cv.className = 'portrait';
        cv.width = 64; cv.height = 64;
        cv.setAttribute('data-fighter', id);
        cv.setAttribute('aria-hidden', 'true');
        var label = document.createElement('span');
        label.className = 'fname';
        label.textContent = fighterName(id);
        b.appendChild(cv);
        b.appendChild(label);
        b.addEventListener('click', function () {
          uiSound('click');
          user.fighterId = id; prefs.save(user);
          playerF = attachImage(SP.makeFighter(id, 'right'));
          playerF.scale = FIGHTER_SCALE;
          playerF.x = PLAYER_HOME.x; playerF.y = PLAYER_HOME.y;
          renderCards(); paintPortraits(); versusLine();
          note('Fighter: ' + fighterName(id) + ' (local UI pref — not sent to the RGS).');
        });
        cardsEl.appendChild(b);
      });
      paintPortraits();
    }

    renderCards();

    /* Mobile portrait (mockup A, max-width:700px): move the Trial/Armed
     * mode toggle into the segmented control inside the mobile bet deck so
     * it stays beside the bet amount. Desktop keeps the toggle in the
     * bet-deck panel untouched; the listeners are bound to the same
     * elements either way, so the move is purely presentational. */
    try {
      if (window.matchMedia &&
        window.matchMedia('(max-width: 700px)').matches) {
        var deckMobile = document.getElementById('deck-mobile');
        var seg = deckMobile ? deckMobile.querySelector('.seg') : null;
        if (seg) {
          seg.appendChild(modeTrial);
          seg.appendChild(modeArmed);
        }
      }
    } catch (e) {}

    /* --- P07/P12b: help / paytable overlay (rules copy derived from the
     * certified math module + live config, never hardcoded totals) --- */
    function pct(p) { return (p * 100).toFixed(1) + '%'; }
    function multText(m) { return m + 'x base bet'; }
    function buildHelp() {
      if (!helpBody || !Bout) return;
      var rtp = (Bout.RTP_TARGET * 100).toFixed(2) + '%';
      var names = { narrowWin: 'Narrow win', decisiveWin: 'Decisive win', draw: 'Draw', loss: 'Loss' };
      function stageRows(mode) {
        return Bout[mode].stages.map(function (s, i) {
          var cells = ['narrowWin', 'decisiveWin', 'draw', 'loss'].map(function (k) {
            var pay = ('mult' in s[k]) ? ' @ ' + multText(s[k].mult) : ' (banks floor)';
            return names[k] + ' ' + pct(s[k].p) + pay;
          }).join('<br>');
          return '<tr><td>' + mode.charAt(0) + mode.slice(1).toLowerCase() +
            ' S' + (i + 1) + '</td><td>' + cells + '</td></tr>';
        }).join('');
      }
      helpBody.innerHTML =
        '<table><tr><th>Stage</th><th>Outcomes (conditional on reaching it)</th></tr>' +
        stageRows('TRIAL') + stageRows('ARMED') + '</table>' +
        '<ul>' +
        '<li>One bout = one RGS round of up to 3 stages. Stage 1: 5 HP each; ' +
        'stages 2-3: 10 HP each (presentation).</li>' +
        '<li>A draw banks a guaranteed floor (1x after stage 1, 5x after ' +
        'stage 2 — x1.5 in Armed) and escalates with fresh weapons.</li>' +
        '<li>A stage loss pays the banked floor (nothing if no prior draw). ' +
        'Max win 1000x base (1500x Armed).</li>' +
        '<li>RTP ' + rtp + ' both modes. Every bout is stateless and independent.</li>' +
        '<li>Your gladiator faces the house champion (' +
        fighterName(HOUSE_CHAMPION) + '). The bout is presentation only: every ' +
        'outcome and payout comes from the Remote Game Server — your fighter ' +
        'choice is cosmetic only.</li>' +
        '<li>Stakes come from the server configuration; the bet must be within ' +
        'min/max and divisible by the step. The BET button is Spacebar.</li>' +
        '<li>Winnings are settled according to the amount received from the ' +
        'Remote Game Server.</li>' +
        '</ul>';
    }
    buildHelp();
    function setHelp(open) {
      if (!helpOverlay) return;
      helpOverlay.hidden = !open;
      if (open && helpClose) helpClose.focus();
    }
    if (helpOpen) helpOpen.addEventListener('click', function () { uiSound('open'); setHelp(true); });
    if (helpClose) helpClose.addEventListener('click', function () { uiSound('close'); setHelp(false); });
    if (helpOverlay) helpOverlay.addEventListener('click', function (e) {
      if (e.target === helpOverlay) { uiSound('close'); setHelp(false); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setHelp(false);
    });

    function note(msg) {
      statusEl.textContent = msg;
      if (configEl) configEl.textContent = JSON.stringify({
        launch: { rgsHost: launch.rgsHost, currency: state.displayCurrency, stub: useStub },
        balance: state.balance, mode: state.mode, baseBet: state.baseBet,
      }, null, 2);
    }

    function renderBalance() {
      balanceEl.textContent = state.balance
        ? 'Balance: ' + fmt(state.balance.amount, state.displayCurrency) +
          ' (' + state.balance.currency + ' · display ' + state.displayCurrency + ')'
        : 'Balance: —';
      // Side-deck mirror: balance visible at a glance next to the bets.
      var deckBal = $('deck-balance');
      if (deckBal) {
        deckBal.textContent = state.balance
          ? fmt(state.balance.amount, state.displayCurrency)
          : '—';
      }
      var deckBalMob = deckBalanceMobile;
      if (deckBalMob) {
        deckBalMob.textContent = state.balance
          ? fmt(state.balance.amount, state.displayCurrency)
          : '—';
      }
    }

    // Mobile fight-mode status bar (mockup C). Keeps round #, balance,
    // current result text and the player HP pips in sync.
    function renderStatusbar() {
      if (!statusbar) return;
      try {
        if (sbRound) sbRound.textContent = state.currentRoundId
          ? '#' + state.currentRoundId : '—';
        if (sbBalance) sbBalance.textContent = state.balance
          ? fmt(state.balance.amount, state.displayCurrency) : '—';
        if (sbStatus) sbStatus.textContent = resultEl ? resultEl.textContent : '—';
        if (sbHp && state.betConfig) {
          var max = hpShown.max || 5;
          var cur = Math.max(0, Math.min(max, hpShown.player));
          sbHp.innerHTML = '';
          for (var i = 0; i < max; i++) {
            var pip = document.createElement('i');
            if (cur >= i + 1) pip.className = 'full';
            else if (cur >= i + 0.5) pip.className = 'half';
            sbHp.appendChild(pip);
          }
        }
      } catch (e) {}
    }

    // Switch between the betting deck (mockup A) and the fight status bar
    // (mockup C). Purely presentational — game state is untouched.
    function setFightMode(fight) {
      try {
        if (!centerEl) return;
        if (fight) {
          centerEl.classList.add('fight-mode');
        } else {
          centerEl.classList.remove('fight-mode');
        }
      } catch (e) {}
      renderStatusbar();
    }

    function renderStakeSelector() {
      var cfg = state.betConfig;
      stakeSel.innerHTML = '';
      cfg.betLevels.forEach(function (level) {
        var o = document.createElement('option');
        o.value = String(level);
        o.textContent = fmt(level, state.displayCurrency);
        stakeSel.appendChild(o);
      });
      var def = cfg.betLevels.indexOf(cfg.defaultBetLevel) >= 0
        ? cfg.defaultBetLevel : cfg.betLevels[0];
      // P03 checklist: an in-flight round restores its amount, not the default.
      state.baseBet = (state.resume && cfg.betLevels.indexOf(state.resume.amount) >= 0)
        ? state.resume.amount : def;
      stakeSel.value = String(state.baseBet);
      renderBetAmount();
    }

    // Mobile bet-amount readout (mockup A: ½ • amount • 2x row).
    function renderBetAmount() {
      try {
        if (betAmount && state.betConfig) {
          betAmount.textContent = fmt(state.baseBet, state.displayCurrency);
        } else if (betAmount) {
          betAmount.textContent = '—';
        }
      } catch (e) {}
    }

    function currentTotal() {
      return Rgs.totalCostFor(state.betConfig, state.mode, state.baseBet);
    }

    function renderModeButtons() {
      var t = 'Trial', a = 'Armed';
      if (state.betConfig) {
        t += ' — ' + costMult(state.betConfig, 'TRIAL') + 'x cost';
        a += ' — ' + costMult(state.betConfig, 'ARMED') + 'x cost';
      }
      modeTrial.textContent = t;
      modeArmed.textContent = a;
    }

    function renderCostLine() {
      if (!costLine) return;
      if (!state.betConfig) { costLine.textContent = '—'; return; }
      var m = costMult(state.betConfig, state.mode);
      costLine.textContent = (state.mode === 'ARMED' ? 'Armed' : 'Trial') +
        ' — total cost ' + fmt(currentTotal(), state.displayCurrency) +
        ' (base ' + fmt(state.baseBet, state.displayCurrency) + ' × ' + m + ')';
    }

    function renderBetButton() {
      if (!state.betConfig) { betBtn.textContent = 'Fight'; return; }
      if (state.mode === 'ARMED') {
        betBtn.textContent = 'Armed Bout — costs ' +
          fmt(currentTotal(), state.displayCurrency) + ' — review…';
      } else {
        betBtn.textContent = 'Fight — ' + fmt(state.baseBet, state.displayCurrency);
      }
      renderCostLine();
      renderDeckMeters();
      renderBetAmount();
    }

    // P17b: control-deck meters — current bet + last win always visible.
    function renderDeckMeters() {
      try {
        if (deckBet && state.betConfig) {
          deckBet.textContent = fmt(currentTotal(), state.displayCurrency);
        } else if (deckBet) {
          deckBet.textContent = '—';
        }
      } catch (e) {}
    }
    function renderDeckWin(payoutUnits) {
      try {
        if (!deckWin) return;
        if (payoutUnits > 0) {
          deckWin.textContent = '+' + fmt(payoutUnits, state.displayCurrency);
          deckWin.className = 'positive';
          deckWin.id = 'deck-win';
        } else {
          deckWin.textContent = '—';
          deckWin.className = '';
          deckWin.id = 'deck-win';
        }
      } catch (e) {}
    }

    function setMode(m) {
      state.mode = m;
      modeTrial.classList.toggle('active', m === 'TRIAL');
      modeArmed.classList.toggle('active', m === 'ARMED');
      // P14: persistent mode indicator — the arena header always names the
      // mode so players know which one they're in, bout or idle.
      var tag = $('mode-tag');
      if (tag) {
        tag.textContent = m === 'ARMED' ? 'ARMED — 1.5x cost' : 'TRIAL';
        tag.className = m === 'ARMED' ? 'armed' : 'trial';
      }
      try { document.body.classList.toggle('armed', m === 'ARMED'); } catch (e) {}
      confirmBar.hidden = true;
      renderBetButton();
    }
    modeTrial.addEventListener('click', function () { uiSound('click'); setMode('TRIAL'); });
    modeArmed.addEventListener('click', function () { uiSound('click'); setMode('ARMED'); });
    stakeSel.addEventListener('change', function () {
      uiSound('click');
      state.baseBet = parseInt(stakeSel.value, 10);
      confirmBar.hidden = true;
      renderBetButton();
    });
    // P17b: bet-amount stepper (+/-) around the server-driven stake list.
    function stepStake(dir) {
      if (!state.betConfig || !stakeSel.options.length) return;
      var i = stakeSel.selectedIndex < 0 ? 0 : stakeSel.selectedIndex;
      var n = Math.max(0, Math.min(stakeSel.options.length - 1, i + dir));
      if (n === i) return;
      uiSound('click');
      stakeSel.selectedIndex = n;
      stakeSel.value = stakeSel.options[n].value;
      state.baseBet = parseInt(stakeSel.value, 10);
      confirmBar.hidden = true;
      renderBetButton();
    }
    // Mobile: halve / double the bet, snapping to the nearest valid bet
    // level from the live bet config, clamped at min/max. Purely a UI
    // control — the RGS still validates the final stake before accepting it.
    function snapBetLevel(target) {
      if (!state.betConfig || !state.betConfig.betLevels.length) return state.baseBet;
      var levels = state.betConfig.betLevels;
      var lo = state.betConfig.minBet, hi = state.betConfig.maxBet;
      var t = Math.max(lo, Math.min(hi, target));
      var best = levels[0];
      for (var i = 1; i < levels.length; i++) {
        if (Math.abs(levels[i] - t) < Math.abs(best - t)) best = levels[i];
      }
      return best;
    }
    function doBetHalf() {
      if (!state.betConfig || state.busy) return;
      var nv = snapBetLevel(state.baseBet / 2);
      if (nv === state.baseBet) return;
      uiSound('click');
      state.baseBet = nv;
      stakeSel.value = String(state.baseBet);
      confirmBar.hidden = true;
      renderBetButton();
    }
    function doBetDouble() {
      if (!state.betConfig || state.busy) return;
      var nv = snapBetLevel(state.baseBet * 2);
      if (nv === state.baseBet) return;
      uiSound('click');
      state.baseBet = nv;
      stakeSel.value = String(state.baseBet);
      confirmBar.hidden = true;
      renderBetButton();
    }
    if (betMinus) betMinus.addEventListener('click', function () { stepStake(-1); });
    if (betPlus) betPlus.addEventListener('click', function () { stepStake(1); });
    if (betHalf) betHalf.addEventListener('click', doBetHalf);
    if (betDouble) betDouble.addEventListener('click', doBetDouble);
    // Mobile icon strip (mockup A): mute / turbo / help overlaid on the
    // arena. These drive the same controls as the top bar on desktop.
    if (iconMute && muteBox) iconMute.addEventListener('click', function () {
      uiSound('click');
      muteBox.checked = !muteBox.checked;
      muteBox.dispatchEvent(new Event('change', { bubbles: false }));
    });
    if (iconTurbo && turboBox) iconTurbo.addEventListener('click', function () {
      uiSound('click');
      turboBox.checked = !turboBox.checked;
      turboBox.dispatchEvent(new Event('change', { bubbles: false }));
    });
    if (iconHelp) iconHelp.addEventListener('click', function () {
      uiSound('click');
      if (helpOverlay) { helpOverlay.hidden = false; if (helpClose) helpClose.focus(); }
    });
    currencySel.addEventListener('change', function () {
      // Display only: the integer stake sent to the RGS never changes.
      uiSound('click');
      state.displayCurrency = currencySel.value;
      renderBalance(); renderStakeSelector(); renderBetButton();
      note('Display currency: ' + state.displayCurrency + ' (formatting only).');
    });

    function setBusy(b, msg) {
      state.busy = b;
      betBtn.disabled = b;
      if (msg) statusEl.textContent = msg;
    }

    /* --- P12b: result presentation (no-LDW, escalation-aware) ---
     * Terminal WIN (any payout > 0, including a banked floor saved by a
     * stage loss): banner shows "+amount" plainly + gold rain (win-styled,
     * wins only). Terminal LOSS (no payout): banner shows "DEFEAT" — flat
     * styling, no fanfare, no particles, no win-styled effects of any kind.
     * Draw transitions are NOT results: they show the banked floor via
     * drawTransition(). The #result line mirrors the banner for screen
     * readers and the automated harness. */
    function hideBanner() {
      if (!bannerEl) return;
      bannerEl.hidden = true;
      bannerEl.textContent = '';
      bannerEl.className = '';
    }

    function showBanner(outcome, round) {
      var won = outcome === 'WIN';
      // P16: the music ducks -6dB under the result banner (restored after
      // the readability hold, when the bet panel re-arms).
      try { if (sound) sound.setDucked(true); } catch (e) {}
      if (bannerEl) {
        bannerEl.hidden = false;
        bannerEl.className = won ? 'win' : 'loss';
        bannerEl.textContent = won
          ? '+' + fmt(round.payout, state.displayCurrency)
          : 'DEFEAT';
      }
      // P15: crowd celebrates WIN only — the engine itself refuses
      // non-WIN outcomes, so a loss can never swell by accident.
      try { if (sound) sound.celebrate(outcome); } catch (e) {}
      var fname = fighterName(user.fighterId);
      resultEl.textContent = won
        ? 'WIN — ' + fname + ' triumphs! +' +
          fmt(round.payout, state.displayCurrency) +
          ' (' + round.payoutMultiplier + 'x).'
        : 'LOSS — ' + fname + ' falls in the sand. DEFEAT — no payout.';
      resultEl.className = won ? 'win' : 'loss';
      renderDeckWin(won ? round.payout : 0);
      renderStatusbar();
      if (won) spawnGoldRain(); // win-styled effects exist ONLY on wins
    }

    function readabilityHold() {
      var ms = timeScale > 1 ? 200 : READABILITY_MS;
      return new Promise(function (r) { setTimeout(r, ms); });
    }

    // One stateless bout: exactly one play request resolving ALL stages,
    // outcome-first choreography per stage, then settle per active.
    async function placeBet() {
      if (state.busy || !state.authenticated) return;
      var cfg = state.betConfig;
      if (!Rgs.isValidBet(cfg, state.baseBet)) {
        uiSound('error');
        note('Bet rejected client-side: outside min/max or not divisible by stepBet.');
        return;
      }
      if (state.balance && state.balance.amount < currentTotal()) {
        uiSound('error');
        note('Balance too low for ' + fmt(currentTotal(), state.displayCurrency) +
          ' — play request NOT sent (per checklist).');
        return;
      }
      unlockAudio(); // the bet press is a gesture: unlock + start loading
      setBusy(true, 'Placing bet…');
      hideBanner();
      stageLine('');
      resultEl.textContent = '';
      resultEl.className = '';
      state.currentRoundId = null;
      setFightMode(false);
      renderStatusbar();
      try {
        var res = await backend.play(state.baseBet, state.mode);
        state.currentRoundId = res.round.betID;
        // Balance comes from the RGS only — never computed locally.
        state.balance = res.balance;
        renderBalance();
        uiSound('confirm'); // P15: bet accepted by the RGS
        // P11b OUTCOME-FIRST: every stage result is known; each stage plan
        // must resolve to its result. Variety stays outcome-independent.
        var breakdown = res.round.state[0];
        var boutPlan = Choreo.planBoutV2(breakdown.stages.map(function (s) {
          return Choreo.planStage(s.stageIndex, s.result,
            Choreo.drawVariety(Math.random), Math.random);
        }));
        var eventRecord = Choreo.encodeBout(boutPlan);
        if (res.round.active) {
          // Record the choreography while the round is active so the round
          // stays replayable (resume + bet replay read this cursor).
          try { await backend.recordEvent(eventRecord); } catch (e) { /* best-effort */ }
        } else {
          // Closed (paying-nothing) rounds can't take /bet/event on live;
          // the stub keeps the last record for harness replayability.
          try { await backend.recordEvent(eventRecord); } catch (e) { /* best-effort */ }
        }
        setBusy(true, 'Bout in progress…');
        // P16: full music level under gameplay.
        try { if (sound) sound.musicBusLevel('game'); } catch (e) {}
        var played = await runStages(boutPlan, res.round.mode, true); // act out the known stages
        var outcome = Rgs.deriveOutcome(res.round); // payout > 0 -> WIN else LOSS
        showBanner(outcome, res.round);
        stageLine('Bout complete: ' + played.map(function (p) {
          return 'S' + (p.stageIndex + 1) + ':' + p.result;
        }).join(' → '));
        window.sandAndSteel.lastBout = {
          outcome: outcome,
          event: eventRecord,
          betID: res.round.betID,
          mode: res.round.mode,
          armed: res.round.mode === 'ARMED', // P14: presentation grade/pace source
          payoutMult: res.round.payoutMultiplier,
          draws: breakdown.draws,
          stages: breakdown.stages,
          played: played,
          playerClip: playerF.clip,
          champClip: champF.clip,
          playerDone: playerF.done,
          champDone: champF.done,
          bannerClass: bannerEl ? bannerEl.className : '',
          bannerText: bannerEl ? bannerEl.textContent : '',
          celebrationParts: parts.length,
          hitStops: juice ? juice.hitStops : 0, // P17: freeze beats landed
          nudgeSettled: juice ? (juice.nudgeX === 0 && juice.nudgeY === 0) : true,
        };
        if (res.round.active) {
          if (useStub && launch.hang) {
            // Harness-only (?stub=1&hang=1): stop before end-round so a reload
            // exercises refresh recovery. Never reachable on a live launch.
            var rr2 = res.round;
            rr2.event = eventRecord;
            showResume(rr2);
            note('Round ' + rr2.betID + ' left open (hang=1) — reload to test recovery.');
          } else {
            setBusy(true, 'Settling round…');
            var done = await backend.endRound();
            state.balance = done.balance;
            renderBalance();
            note('Round ' + res.round.betID + ' settled. ' + resultEl.textContent);
          }
        } else {
          // active === false: the RGS closed the (paying-nothing) round itself.
          note('Round ' + res.round.betID + ' closed by the RGS (no payout). ' + resultEl.textContent);
        }
        await readabilityHold(); // P12: banner readable before re-arm
        // P16: restore full menu-level music as the bet panel re-arms.
        try {
          if (sound) { sound.setDucked(false); sound.musicBusLevel('menu'); }
        } catch (e) {}
      } catch (e) {
        uiSound('error');
        note('Bet failed: ' + (e && e.message ? e.message : e));
      } finally {
        setBusy(false);
      }
    }

    function onBetPressed() {
      if (!state.authenticated || state.busy) return;
      if (state.mode === 'ARMED' && confirmBar.hidden) {
        // P04: explicit confirm showing the full cost, every time.
        confirmText.textContent = Rgs.armedConfirmText(
          state.baseBet, state.displayCurrency, state.betConfig);
        confirmBar.hidden = false;
        return;
      }
      confirmBar.hidden = true;
      placeBet();
    }

    betBtn.addEventListener('click', onBetPressed);
    // Approval checklist: spacebar = bet button (ignored while typing/selecting).
    document.addEventListener('keydown', function (e) {
      if (e.code !== 'Space' && e.key !== ' ') return;
      var t = e.target;
      var tag = t && t.tagName ? t.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (helpOverlay && !helpOverlay.hidden) return;
      e.preventDefault();
      onBetPressed();
    });
    confirmYes.addEventListener('click', function () {
      confirmBar.hidden = true;
      placeBet(); // the RGS request carries the full stake via amount x cost multiplier
    });
    confirmNo.addEventListener('click', function () {
      confirmBar.hidden = true;
      uiSound('back');
      note('Armed Bout cancelled — no request sent.');
    });

    function showResume(r) {
      state.resume = r;
      resumeText.textContent = 'Unfinished ' + r.mode + ' round #' + r.betID +
        ' — bet ' + fmt(r.amount, state.displayCurrency) +
        (r.event ? ', stood at "' + r.event + '"' : '') +
        '. It will be settled from its record — never re-drawn, never voided.';
      resumeBar.hidden = false;
    }

    // Resume: replay the recorded choreography, then settle exactly as the
    // RGS left the round. Never re-draws, never silently voids.
    resumeGo.addEventListener('click', async function () {
      if (!state.resume) return;
      setBusy(true, 'Resuming round ' + state.resume.betID + '…');
      try {
        var r = state.resume;
        var outcome = Rgs.deriveOutcome(r);
        var boutPlan = null;
        var legacyPlan = null;
        try {
          if (r.event && r.event.slice(0, 4) === Choreo.TAG2) {
            boutPlan = Choreo.decodeBout(r.event);
          } else if (r.event && r.event.slice(0, 4) === Choreo.TAG) {
            legacyPlan = Choreo.decodePlan(r.event);
          }
        } catch (e) { boutPlan = null; legacyPlan = null; }
        if (boutPlan) {
          try { if (sound) sound.musicBusLevel('game'); } catch (e) {}
          var played = await runStages(boutPlan, r.mode, false); // replay, beat for beat
          stageLine('Resumed: ' + played.map(function (p) {
            return 'S' + (p.stageIndex + 1) + ':' + p.result;
          }).join(' → '));
        } else if (legacyPlan) {
          await runBout(legacyPlan, r.mode); // pre-v2 record, beat for beat
        }
        showBanner(outcome, r);
        window.sandAndSteel.lastBout = {
          outcome: outcome,
          event: r.event,
          resumed: true,
          playerClip: playerF.clip,
          champClip: champF.clip,
          bannerClass: bannerEl ? bannerEl.className : '',
          bannerText: bannerEl ? bannerEl.textContent : '',
        };
        var done = await backend.endRound();
        state.balance = done.balance;
        renderBalance();
        state.resume = null;
        resumeBar.hidden = true;
        if (backend.clearRound) await backend.clearRound();
        await readabilityHold();
        try {
          if (sound) { sound.setDucked(false); sound.musicBusLevel('menu'); }
        } catch (e) {}
        note('Resumed round ' + r.betID + ' settled from its record — never re-drawn. ' +
          resultEl.textContent);
      } catch (e) {
        note('Resume failed: ' + (e && e.message ? e.message : e));
      } finally {
        setBusy(false);
      }
    });

    if (authRetry) {
      authRetry.addEventListener('click', function () {
        window.location.reload(); // re-run the full boot + authenticate
      });
    }

    // --- boot: authenticate, then check for an in-flight round ---
    // P06: nothing is playable until authenticate succeeds. On failure we
    // show a clean error state: no balance, no fake numbers, BET disabled,
    // and a retry that re-runs the whole boot.
    betBtn.disabled = true;
    renderModeButtons();
    try {
      var auth = await backend.authenticate();
      state.balance = auth.balance;
      if (!state.balance || !Number.isInteger(state.balance.amount)) {
        throw new Error('authenticate returned no usable balance');
      }
      state.displayCurrency = (auth.balance && auth.balance.currency) ||
        launch.currency || 'USD';
      currencySel.value = state.displayCurrency;
      state.betConfig = Rgs.parseBetConfig(auth.config);
      state.resume = Rgs.resolveInFlightRound(auth);
      state.authenticated = true;
      renderBalance(); renderStakeSelector(); renderModeButtons(); setMode('TRIAL');
      if (authErrorBar) authErrorBar.hidden = true;
      betBtn.disabled = false;
      if (state.resume) {
        showResume(state.resume);
        resumeDismissNote.textContent = '';
        note('Authenticated (' + backend.name + '). In-flight round found — resume it above.');
      } else {
        note('Authenticated (' + backend.name + ') — launch params read, no in-flight round.');
      }
    } catch (e) {
      var msg = (e && e.message ? e.message : e);
      // Clean error state: never show a balance we did not receive.
      state.balance = null;
      renderBalance();
      betBtn.disabled = true;
      if (authErrorBar) {
        authErrorBar.hidden = false;
        if (authErrorText) {
          authErrorText.textContent = 'Details: ' + msg +
            ' (sessionID ' + (launch.sessionID ? 'was provided' : 'missing') +
            ', rgs host ' + (launch.rgsHost ? 'was provided' : 'missing') + ').';
        }
      }
      note('Authenticate failed: ' + msg);
    }

    if (configEl && !configEl.textContent) {
      configEl.textContent = JSON.stringify(
        { rgsHost: launch.rgsHost, stub: useStub }, null, 2);
    }

    window.sandAndSteel = {
      config: launch, phase: 4, backend: backend, state: state,
      fighters: PLAYER_OPTIONS, champion: HOUSE_CHAMPION,
      placeBet: placeBet, audio: sound,
      runBout: runBout,
      runStage: runStage,
      runStages: runStages,
      lastBout: null,
      scene: {
        player: playerF, champ: champF,
        versusLine: versusLine,
        juice: juice, // P17: harness-observable freeze/nudge counters
        parts: parts, // P17: harness-observable live particle list
      },
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
