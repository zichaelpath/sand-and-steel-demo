/* SAND & STEEL — audio engine (Phase 4, P15 SFX + P16 music).
 *
 * Web Audio graph: sources -> [sfxBus | crowdBus | musicBus] -> master -> out.
 * Every sound ships in the repo under assets/ (no external fetches):
 *
 * Auditioned picks (measured in headless Chromium via OfflineAudioContext
 * decode; durations/peaks below are the actual file stats, not guesses):
 *
 *  Swing whooshes (low zero-crossing ~3-5k/s, sustained noise):
 *   woosh4.ogg  0.35s peak .93 — standard swing whoosh
 *   woosh6.ogg  0.30s peak .91 — short/quiet (dodges)
 *   woosh1.ogg  0.38s peak .88 — alternate swing whoosh
 *  Blade swings (bright, zc ~8-11k/s, 0.2-0.3s):
 *   sword1.ogg  0.21s peak .91 — standard swing
 *   sword4.ogg  0.30s peak .85 — alternate swing
 *   sword9.ogg  0.28s peak .85 — alternate swing
 *   sword8.ogg  0.54s peak .82 — long blade (killing blow)
 *  Impacts, punchy (fast attack, high crest):
 *   hitHelmet2.ogg  0.37s peak .89 — standard hit (punchiest of the set)
 *   hitHelmet4.ogg  0.44s peak .81 — alternate hit
 *   swordMetal4.ogg 0.40s peak .95 — block/clash (brightest metal)
 *   swordStone2.ogg 0.30s peak .89 — duller thud (death weight)
 *   swordSlide1.ogg 0.75s sustained metal — draw weapon-swap shimmer
 *  UI (Kenney Interface Sounds):
 *   click_001.ogg         0.10s — buttons / mode / fighter cards
 *   confirmation_001.ogg  0.29s — bet accepted
 *   error_001.ogg         0.16s — bet rejected / failed
 *   open_001.ogg          0.15s — help opened
 *   close_001.ogg         0.15s — help closed (open's mirror)
 *   back_001.ogg          0.06s — armed confirm cancelled
 *   toggle_001.ogg        0.14s — mute / turbo toggles
 *  Crowd (Pixabay Content License, free commercial use, ships in-game only):
 *   crowd-cheer-applause.mp3  4.44s, loudest (rms .199) — bout-start swell
 *   cheering-crowd.mp3        8.14s, swells in from zero — WIN celebration
 *   applause-loop.mp3         7.08s — quiet bed under the WIN banner only
 *
 * COMPLIANCE: crowd swells play on bout start and on WIN only — never on
 * a loss, never on a draw transition. UI/fight SFX are cosmetic feedback;
 * no sound ever reads or changes game state. The mute toggle silences
 * EVERYTHING (master gain to zero + no new voices scheduled).
 *
 * Mix (P15): SFX sit under the music bed; hits stay punchy via transient,
 * not level. Linear bus gains: music game 0.60 / menu 0.30 (P16 owns the
 * loop + ducking), crowd 0.55, hits 0.50, swings/whoosh 0.32, UI 0.30.
 *
 * Node-safe: the module never touches window/document at load. create()
 * takes injectable {ctxFactory, fetchFn} so unit tests run headless with
 * doubles; the browser passes the real Web Audio + fetch.
 */

(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SandSteelAudio = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BASE = '../assets/';
  var PICKS = {
    whoosh: [BASE + 'sfx/woosh/woosh4.ogg', BASE + 'sfx/woosh/woosh1.ogg'],
    dodgeWhoosh: [BASE + 'sfx/woosh/woosh6.ogg'],
    swing: [BASE + 'sfx/swords/sword1.ogg', BASE + 'sfx/swords/sword4.ogg',
      BASE + 'sfx/swords/sword9.ogg'],
    heavySwing: [BASE + 'sfx/swords/sword8.ogg'],
    hit: [BASE + 'sfx/swords/hitHelmet2.ogg', BASE + 'sfx/swords/hitHelmet4.ogg'],
    clash: [BASE + 'sfx/swords/swordMetal4.ogg'],
    thud: [BASE + 'sfx/swords/swordStone2.ogg'],
    weaponSwap: [BASE + 'sfx/swords/swordSlide1.ogg'],
    uiClick: [BASE + 'sfx/ui/click_001.ogg'],
    uiConfirm: [BASE + 'sfx/ui/confirmation_001.ogg'],
    uiError: [BASE + 'sfx/ui/error_001.ogg'],
    uiOpen: [BASE + 'sfx/ui/open_001.ogg'],
    uiClose: [BASE + 'sfx/ui/close_001.ogg'],
    uiBack: [BASE + 'sfx/ui/back_001.ogg'],
    uiToggle: [BASE + 'sfx/ui/toggle_001.ogg'],
    crowdStart: [BASE + 'sfx/crowd/crowd-cheer-applause.mp3'],
    crowdWin: [BASE + 'sfx/crowd/cheering-crowd.mp3'],
    crowdBed: [BASE + 'sfx/crowd/applause-loop.mp3'],
    music: [BASE + 'music/the_beat_of_battleOGG.ogg'],
  };

  // Per-voice linear gains (hits punchy, everything under the music).
  // Keys match PICKS (plus the ui/crowd aliases used by playVoice).
  var VOICE_GAIN = {
    whoosh: 0.32, dodgeWhoosh: 0.22, swing: 0.34, heavySwing: 0.50,
    hit: 0.50, clash: 0.42, thud: 0.40, weaponSwap: 0.30,
    ui: 0.30, crowdStart: 0.55, crowdWin: 0.55, crowdBed: 0.25,
  };
  var BUS_GAIN = { sfx: 0.9, crowd: 0.9, musicGame: 0.60, musicMenu: 0.30 };
    // P16 duck: music drops 6dB under the result banner.
  var DUCK_DB = -6;
  // P16 crossfade loop: overlap between consecutive music segments.
  var MUSIC_XFADE = 2.0;
  // Equal-power crossfade curves (64-pt sin/cos): constant loudness across
  // the splice, so the loop breathes neither up nor down.
  var FADE_CURVE_N = 64;
  function fadeCurveIn() {
    var c = new Array(FADE_CURVE_N);
    for (var i = 0; i < FADE_CURVE_N; i++) c[i] = Math.sin(0.5 * Math.PI * i / (FADE_CURVE_N - 1));
    return c;
  }
  function fadeCurveOut() {
    var c = new Array(FADE_CURVE_N);
    for (var i = 0; i < FADE_CURVE_N; i++) c[i] = Math.cos(0.5 * Math.PI * i / (FADE_CURVE_N - 1));
    return c;
  }

  function dbToGain(db) { return Math.pow(10, db / 20); }

  // Crowd policy (pure, unit-tested): a celebration bed is allowed ONLY on
  // a terminal WIN. Bout-start swells are always allowed (fresh bouts).
  // Anything else — loss, draw, floor — resolves to null: silence.
  function crowdWinFor(outcome) {
    return outcome === 'WIN' ? 'crowdWin' : null;
  }

  // Fight-event -> voice mapping (pure, unit-tested). Returns a list of
  // {voice, delayMs} so whoosh-then-blade pairs keep their transient order.
  // Voice names are PICKS keys.
  function voicesForFight(kind) {
    switch (kind) {
      case 'attack': return [{ voice: 'whoosh', delayMs: 0 }, { voice: 'swing', delayMs: 70 }];
      case 'hit': return [{ voice: 'hit', delayMs: 0 }];
      case 'block': return [{ voice: 'clash', delayMs: 0 }];
      case 'dodge': return [{ voice: 'dodgeWhoosh', delayMs: 0 }];
      case 'finale': return [
        { voice: 'whoosh', delayMs: 0 },
        { voice: 'heavySwing', delayMs: 70 },
        { voice: 'hit', delayMs: 120 },
      ];
      case 'death': return [{ voice: 'thud', delayMs: 0 }];
      case 'swap': return [{ voice: 'weaponSwap', delayMs: 0 }];
      default: return [];
    }
  }

  function allFiles() {
    var out = [];
    Object.keys(PICKS).forEach(function (k) {
      PICKS[k].forEach(function (f) { if (out.indexOf(f) < 0) out.push(f); });
    });
    return out;
  }

  function create(opts) {
    opts = opts || {};
    var ctxFactory = opts.ctxFactory || null;
    var fetchFn = opts.fetchFn || null;
    try {
      if (!ctxFactory && typeof window !== 'undefined' &&
        (window.AudioContext || window.webkitAudioContext)) {
        var AC = window.AudioContext || window.webkitAudioContext;
        ctxFactory = function () { return new AC(); };
      }
      if (!fetchFn && typeof fetch === 'function') fetchFn = fetch.bind(null);
    } catch (e) { /* node without doubles: engine stays inert, never throws */ }

    var eng = {
      muted: !!opts.muted,
      unlocked: false,
      loaded: false,
      ctx: null, master: null, buses: null,
      buffers: {}, // url -> AudioBuffer
      rr: {}, // round-robin cursor per voice (deterministic variety)
      musicModeName: 'menu',
      ducked: false,
      voicesStarted: 0, // harness-observable counter
      crowdStarted: 0, // harness-observable CROWD counter (compliance proof)
    };

    function ensureCtx() {
      if (eng.ctx || !ctxFactory) return eng.ctx;
      try {
        eng.ctx = ctxFactory();
        eng.master = eng.ctx.createGain();
        eng.master.gain.value = eng.muted ? 0 : 1;
        eng.master.connect(eng.ctx.destination);
        eng.buses = {
          sfx: eng.ctx.createGain(),
          crowd: eng.ctx.createGain(),
          music: eng.ctx.createGain(),
        };
        eng.buses.sfx.gain.value = BUS_GAIN.sfx;
        eng.buses.crowd.gain.value = BUS_GAIN.crowd;
        eng.buses.music.gain.value = BUS_GAIN.musicMenu;
        eng.buses.sfx.connect(eng.master);
        eng.buses.crowd.connect(eng.master);
        eng.buses.music.connect(eng.master);
      } catch (e) { eng.ctx = null; }
      return eng.ctx;
    }

    // Must be called from a user gesture at least once (autoplay policy).
    // Safe to call repeatedly; idempotent after the first unlock.
    eng.unlock = function () {
      var ctx = ensureCtx();
      if (!ctx) return false;
      try {
        if (typeof ctx.resume === 'function') {
          var p = ctx.resume();
          if (p && typeof p.then === 'function') p.then(function () {}, function () {});
        }
      } catch (e) {}
      eng.unlocked = true;
      return true;
    };

    eng.loadAll = function () {
      if (eng.loaded || !fetchFn) return Promise.resolve(false);
      var ctx = ensureCtx();
      if (!ctx) return Promise.resolve(false);
      var files = allFiles();
      return Promise.all(files.map(function (url) {
        return fetchFn(url).then(function (r) { return r.arrayBuffer(); })
          .then(function (ab) { return ctx.decodeAudioData(ab); })
          .then(function (buf) { eng.buffers[url] = buf; })
          .catch(function () { /* one bad file never breaks the game */ });
      })).then(function () {
        eng.loaded = true;
        return true;
      });
    };

    function pickFile(voice) {
      var list = PICKS[voice];
      if (!list || !list.length) return null;
      var i = eng.rr[voice] || 0;
      eng.rr[voice] = (i + 1) % list.length;
      return list[i % list.length];
    }

    // Low-level voice start. delayMs is real-time (events already arrive on
    // the scaled bout clock, so no timeScale conversion here).
    eng.playFile = function (url, busName, gain, delayMs) {
      if (eng.muted || !eng.unlocked || !eng.ctx || !eng.buffers[url]) return false;
      try {
        var t = eng.ctx.currentTime + Math.max(0, delayMs || 0) / 1000;
        var src = eng.ctx.createBufferSource();
        src.buffer = eng.buffers[url];
        var g = eng.ctx.createGain();
        g.gain.value = gain;
        src.connect(g);
        g.connect(eng.buses[busName] || eng.buses.sfx);
        src.start(t);
        eng.voicesStarted += 1;
        if (busName === 'crowd') eng.crowdStarted += 1;
        return true;
      } catch (e) { return false; }
    };

    eng.playVoice = function (voice, delayMs, gainOverride) {
      var url = pickFile(voice);
      if (!url) return false;
      var bus = voice === 'crowdWin' || voice === 'crowdStart' || voice === 'crowdBed'
        ? 'crowd' : 'sfx';
      var g = (gainOverride != null) ? gainOverride : (VOICE_GAIN[voice] || 0.3);
      return eng.playFile(url, bus, g, delayMs);
    };

    // Fight SFX entry point: one call per choreography beat kind.
    eng.fight = function (kind) {
      var vs = voicesForFight(kind);
      var any = false;
      vs.forEach(function (v) {
        if (eng.playVoice(v.voice, v.delayMs)) any = true;
      });
      return any;
    };

    eng.ui = function (kind) {
      var map = {
        click: 'uiClick', confirm: 'uiConfirm', error: 'uiError',
        open: 'uiOpen', close: 'uiClose', back: 'uiBack', toggle: 'uiToggle',
      };
      if (!map[kind]) return false;
      return eng.playVoice(map[kind], 0, VOICE_GAIN.ui);
    };

    // Bout-start swell (fresh bouts only — the caller decides).
    eng.boutStart = function () {
      return eng.playVoice('crowdStart', 0);
    };

    // WIN-only celebration. The engine enforces the policy itself so no
    // caller can accidentally swell a loss: non-WIN resolves to silence.
    eng.celebrate = function (outcome) {
      if (crowdWinFor(outcome) !== 'crowdWin') return false;
      var a = eng.playVoice('crowdWin', 0);
      var b = eng.playVoice('crowdBed', 1500);
      return a || b;
    };

    eng.setMuted = function (m) {
      eng.muted = !!m;
      try {
        if (eng.master && eng.ctx) {
          eng.master.gain.setTargetAtTime(
            eng.muted ? 0 : 1, eng.ctx.currentTime, 0.02);
        }
      } catch (e) {}
    };

    // P16 hooks (music loop owns the source; the bus/duck live here so
    // mute + duck compose on one gain stage each).
    eng.musicBusLevel = function (menuOrGame) {
      eng.musicModeName = menuOrGame === 'game' ? 'game' : 'menu';
      applyMusicLevel();
    };
    eng.setDucked = function (d) {
      eng.ducked = !!d;
      applyMusicLevel();
    };
    function applyMusicLevel() {
      try {
        if (!eng.buses || !eng.ctx) return;
        var base = eng.musicModeName === 'game' ? BUS_GAIN.musicGame : BUS_GAIN.musicMenu;
        var level = eng.ducked ? base * dbToGain(DUCK_DB) : base;
        eng.buses.music.gain.setTargetAtTime(level, eng.ctx.currentTime, 0.15);
      } catch (e) {}
    }

    // P16 music loop: Fablefly "THE BEAT OF BATTLE" (ogg) under gameplay.
    // The file does NOT loop cleanly on its own (measured: it starts near
    // silence but ends loud — a naive loop clicks, 13x the mean slope), so
    // the engine runs a 2s equal-power-ish crossfade loop: each segment
    // fades out over its last XFade seconds while the next fades in over
    // its first XFade. Segments chain gaplessly
    // (next.start == prev.start + dur - XFade) so there is no audible seam
    // by construction. Ducking/menu levels compose on the music BUS, never
    // in the segment envelopes.
    eng.music = {
      playing: false, buf: null, segs: [],
      nextStart: 0, timer: null, segmentsScheduled: 0,
    };

    function scheduleMusicSegment(t0, first) {
      var ctx = eng.ctx, buf = eng.music.buf, X = MUSIC_XFADE;
      try {
        var src = ctx.createBufferSource();
        src.buffer = buf;
        var g = ctx.createGain();
        // Equal-power splice curves where supported, linear fallback where
        // not (both are click-free: every envelope is sample-continuous).
        var canCurve = g.gain &&
          typeof g.gain.setValueCurveAtTime === 'function';
        if (first) {
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(1, t0 + 1.0);
        } else if (canCurve) {
          g.gain.setValueCurveAtTime(fadeCurveIn(), t0, X);
        } else {
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(1, t0 + X);
        }
        var t1 = t0 + buf.duration;
        if (canCurve) {
          g.gain.setValueCurveAtTime(fadeCurveOut(), Math.max(t0, t1 - X), X);
        } else {
          g.gain.setValueAtTime(1, Math.max(t0, t1 - X));
          g.gain.linearRampToValueAtTime(0.0001, t1);
        }
        src.connect(g);
        g.connect(eng.buses.music);
        src.start(t0);
        try { src.stop(t1 + 0.05); } catch (e) {}
        eng.music.segs.push({ start: t0, end: t1 });
        eng.music.nextStart = t1 - X;
        eng.music.segmentsScheduled += 1;
      } catch (e) { /* a failed segment never breaks the game */ }
    }

    function pumpMusic() {
      if (!eng.music.playing || !eng.ctx) return;
      try {
        var guard = 0;
        while (eng.music.nextStart < eng.ctx.currentTime + 8 && guard < 8) {
          scheduleMusicSegment(eng.music.nextStart, false);
          guard += 1;
        }
        var now = eng.ctx.currentTime;
        eng.music.segs = eng.music.segs.filter(function (s) { return s.end > now - 1; });
      } catch (e) {}
    }

    eng.musicStart = function () {
      if (eng.music.playing) return true;
      var ctx = ensureCtx();
      if (!ctx || !eng.buses) return false;
      var buf = eng.buffers[PICKS.music[0]];
      if (!buf) return false;
      eng.music.playing = true;
      eng.music.buf = buf;
      eng.music.segs = [];
      eng.music.segmentsScheduled = 0;
      try {
        scheduleMusicSegment(ctx.currentTime + 0.05, true);
        if (eng.music.timer) clearInterval(eng.music.timer);
        eng.music.timer = setInterval(pumpMusic, 500);
        pumpMusic();
      } catch (e) {}
      return true;
    };

    eng.musicStop = function () {
      eng.music.playing = false;
      try {
        if (eng.music.timer) clearInterval(eng.music.timer);
      } catch (e) {}
      eng.music.timer = null;
      eng.music.segs = [];
    };

    eng.state = function () {
      return {
        muted: eng.muted, unlocked: eng.unlocked, loaded: eng.loaded,
        files: Object.keys(eng.buffers).length,
        music: eng.musicModeName, ducked: eng.ducked,
        musicPlaying: eng.music.playing, musicSegs: eng.music.segmentsScheduled,
        voices: eng.voicesStarted, crowd: eng.crowdStarted,
      };
    };

    return eng;
  }

  return {
    PICKS: PICKS,
    VOICE_GAIN: VOICE_GAIN,
    BUS_GAIN: BUS_GAIN,
    DUCK_DB: DUCK_DB,
    MUSIC_XFADE: MUSIC_XFADE,
    fadeCurveIn: fadeCurveIn,
    fadeCurveOut: fadeCurveOut,
    dbToGain: dbToGain,
    crowdWinFor: crowdWinFor,
    voicesForFight: voicesForFight,
    allFiles: allFiles,
    create: create,
  };
}));
