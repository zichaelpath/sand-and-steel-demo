/* SAND & STEEL — Phase 4 unit tests (P14 armed presentation; P15/P16 audio; P17 juice).
 * Run: node --test client/phase4.test.js
 *
 * P14: armed pace stays inside the 4-6s stage budget, runs tighter than
 * trial for identical plans, and never changes events/end states. The armed
 * arena grade keeps trial geometry (same draw call shape) plus a warm
 * overlay — trial rendering is pixel-identical (no overlay).
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const Choreo = require('./choreography.js');
const Clips = require('./clips.js');
const Arena = require('./arena.js');
const Audio = require('./audio.js');
const Juice = require('./juice.js');

function clipMs(id, side, clip) { return Clips.totalMs(id, side, clip); }
const FIGHTERS = {
  player: { id: 'murmillo', side: 'right' },
  champ: { id: 'rebel_champion', side: 'left' },
};

function streamRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Minimal 2D-context double: records every call for shape comparison.
function fakeCtx() {
  const calls = [];
  const grad = { stops: [], addColorStop(o, c) { this.stops.push([o, c]); } };
  return {
    calls,
    fillStyle: null,
    createLinearGradient() { calls.push(['gradient']); return grad; },
    fillRect(x, y, w, h) { calls.push(['fillRect', x, y, w, h, this.fillStyle]); },
    beginPath() { calls.push(['beginPath']); },
    arc(x, y, r, a, b) { calls.push(['arc', Math.round(x), Math.round(y), Math.round(r)]); },
    ellipse(x, y, rx, ry) { calls.push(['ellipse', Math.round(x), Math.round(y), Math.round(rx), Math.round(ry)]); },
    fill() { calls.push(['fill', this.fillStyle]); },
  };
}

describe('P14 armed pace', () => {
  it('stays inside the 4-6s budget on every stage shape', () => {
    const rng = streamRng(4242);
    for (let stage = 0; stage < 3; stage++) {
      for (const r of Choreo.STAGE_RESULTS) {
        if (stage === 2 && r === 'draw') continue; // stage 3 is final
        const v = Choreo.drawVariety(rng);
        const sp = Choreo.planStage(stage, r, v, rng);
        for (const first of [true, false]) {
          const sch = Choreo.scheduleStage(sp, clipMs, FIGHTERS, first, { pace: 'armed' });
          assert.ok(sch.totalMs >= 4000 && sch.totalMs <= 6000,
            `stage=${stage} ${r} first=${first}: ${sch.totalMs}ms`);
          assert.strictEqual(sch.pace, 'armed');
        }
      }
    }
  });

  it('runs tighter than trial for identical plans, with identical beats', () => {
    const rng = streamRng(99);
    for (let k = 0; k < 12; k++) {
      const stage = k % 3;
      const results = stage === 2 ? ['narrowWin', 'decisiveWin', 'loss'] : Choreo.STAGE_RESULTS;
      const r = results[k % results.length];
      const v = Choreo.drawVariety(rng);
      const sp = Choreo.planStage(stage, r, v, rng);
      const trial = Choreo.scheduleStage(sp, clipMs, FIGHTERS, true);
      const armed = Choreo.scheduleStage(sp, clipMs, FIGHTERS, true, { pace: 'armed' });
      assert.ok(armed.totalMs <= trial.totalMs,
        `${r}: armed ${armed.totalMs}ms > trial ${trial.totalMs}ms`);
      assert.deepStrictEqual(
        armed.events.map((e) => e.action),
        trial.events.map((e) => e.action));
      assert.deepStrictEqual(
        armed.events.map((e) => e.hpAfter),
        trial.events.map((e) => e.hpAfter));
    }
  });

  it('defaults to trial pace when opts are omitted (back-compatible)', () => {
    const sp = Choreo.planStage(0, 'narrowWin',
      { exchanges: 2, first: 'player', defenses: ['hit', 'block'] }, 2);
    const a = Choreo.scheduleStage(sp, clipMs, FIGHTERS, true);
    const b = Choreo.scheduleStage(sp, clipMs, FIGHTERS, true, { pace: 'trial' });
    assert.strictEqual(a.totalMs, b.totalMs);
    assert.strictEqual(a.pace, 'trial');
  });
});

describe('P14 armed arena grade', () => {
  it('trial rendering has no warm overlay; armed adds exactly one', () => {
    const t = fakeCtx(), a = fakeCtx();
    const crowd = Arena.makeCrowd();
    Arena.drawArena(t, 960, 540, 1234, crowd);
    Arena.drawArena(a, 960, 540, 1234, crowd, { grade: 'armed' });
    const overlays = (c) => c.calls.filter(
      (k) => k[0] === 'fillRect' && k[5] === 'rgba(255, 90, 10, 0.10)');
    assert.strictEqual(overlays(t).length, 0);
    assert.strictEqual(overlays(a).length, 1);
  });

  it('armed keeps trial geometry (same shapes, warmer colors only)', () => {
    const t = fakeCtx(), a = fakeCtx();
    const crowd = Arena.makeCrowd();
    Arena.drawArena(t, 960, 540, 1234, crowd);
    Arena.drawArena(a, 960, 540, 1234, crowd, { grade: 'armed' });
    const shape = (c, stripOverlay) => c.calls
      .filter((k) => !(stripOverlay && k[0] === 'fillRect' && k[5] === 'rgba(255, 90, 10, 0.10)'))
      .map((k) => k[0])
      .join(',');
    assert.strictEqual(shape(a, true), shape(t, false));
  });
});

// Doubled Web Audio graph for engine tests (no browser needed).
function fakeAudioCtx() {
  const started = [];
  const gainParams = [];
  function param(v) {
    const p = { value: v, sets: [], setTargetAtTime(val, t, c) { this.sets.push([val, t, c]); this.value = val; } };
    gainParams.push(p);
    return p;
  }
  return {
    started, gainParams,
    currentTime: 0, destination: {},
    createGain() {
      const g = { gain: param(1), connected: null, connect(d) { this.connected = d; } };
      return g;
    },
    createBufferSource() {
      return {
        buffer: null, connected: null,
        connect(d) { this.connected = d; },
        start(t) { started.push(t); },
      };
    },
    decodeAudioData() { return Promise.resolve({ duration: 1 }); },
    resume() { return Promise.resolve(); },
  };
}

function fakeFetch(urls) {
  return (url) => {
    urls.push(url);
    return Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
  };
}

describe('P15 SFX picks + policy', () => {
  it('auditioned file table: exact paths, all voices covered', () => {
    const flat = Audio.allFiles();
    assert.ok(flat.includes('../assets/sfx/woosh/woosh4.ogg'));
    assert.ok(flat.includes('../assets/sfx/swords/sword1.ogg'));
    assert.ok(flat.includes('../assets/sfx/swords/hitHelmet2.ogg'));
    assert.ok(flat.includes('../assets/sfx/swords/swordMetal4.ogg'));
    assert.ok(flat.includes('../assets/sfx/swords/swordSlide1.ogg'));
    assert.ok(flat.includes('../assets/sfx/ui/click_001.ogg'));
    assert.ok(flat.includes('../assets/sfx/ui/confirmation_001.ogg'));
    assert.ok(flat.includes('../assets/sfx/ui/error_001.ogg'));
    assert.ok(flat.includes('../assets/sfx/crowd/crowd-cheer-applause.mp3'));
    assert.ok(flat.includes('../assets/sfx/crowd/cheering-crowd.mp3'));
    assert.ok(flat.includes('../assets/sfx/crowd/applause-loop.mp3'));
    assert.ok(flat.includes('../assets/music/the_beat_of_battleOGG.ogg'));
    // every fight voice resolves to a picked file with a mix gain
    for (const kind of ['attack', 'hit', 'block', 'dodge', 'finale', 'death', 'swap']) {
      for (const v of Audio.voicesForFight(kind)) {
        assert.ok(Audio.PICKS[v.voice] && Audio.PICKS[v.voice].length > 0, kind + '/' + v.voice);
        assert.ok(Audio.VOICE_GAIN[v.voice] > 0, 'gain ' + v.voice);
      }
    }
    assert.deepStrictEqual(Audio.voicesForFight('nope'), []);
  });

  it('crowd celebrates WIN only — never loss/draw/floor', () => {
    assert.strictEqual(Audio.crowdWinFor('WIN'), 'crowdWin');
    assert.strictEqual(Audio.crowdWinFor('LOSS'), null);
    assert.strictEqual(Audio.crowdWinFor('DRAW'), null);
    assert.strictEqual(Audio.crowdWinFor(undefined), null);
  });

  it('-6dB duck gain is ~0.501', () => {
    assert.ok(Math.abs(Audio.dbToGain(-6) - 0.5012) < 0.001);
  });

  it('mute silences everything: no voices start, master drops to zero', async () => {
    const ctx = fakeAudioCtx();
    const urls = [];
    const eng = Audio.create({ ctxFactory: () => ctx, fetchFn: fakeFetch(urls), muted: true });
    eng.unlock();
    await eng.loadAll();
    assert.ok(eng.state().files > 0);
    assert.strictEqual(eng.fight('attack'), false);
    assert.strictEqual(eng.fight('finale'), false);
    assert.strictEqual(eng.ui('click'), false);
    assert.strictEqual(eng.boutStart(), false);
    assert.strictEqual(eng.celebrate('WIN'), false);
    assert.strictEqual(ctx.started.length, 0);
    assert.strictEqual(eng.master.gain.value, 0);
  });

  it('unmuted engine starts voices; celebrate() still refuses non-WIN', async () => {
    const ctx = fakeAudioCtx();
    const urls = [];
    const eng = Audio.create({ ctxFactory: () => ctx, fetchFn: fakeFetch(urls) });
    eng.unlock();
    await eng.loadAll();
    assert.strictEqual(eng.fight('attack'), true); // whoosh + swing
    assert.strictEqual(eng.boutStart(), true);
    assert.strictEqual(eng.celebrate('LOSS'), false);
    const before = ctx.started.length;
    assert.strictEqual(eng.celebrate('WIN'), true);
    assert.ok(ctx.started.length > before);
    assert.strictEqual(eng.celebrate('LOSS'), false);
    assert.strictEqual(ctx.started.length, before + 2); // no loss voices leaked
  });
});

// Music-capable fake graph: envelopes + stop() for the loop scheduler.
function fakeMusicCtx() {
  const gains = []; // creation order: master, sfx, crowd, music
  function param(v) {
    return {
      value: v, sets: [],
      setTargetAtTime(val, t, c) { this.sets.push(['target', val]); this.value = val; },
      setValueAtTime(val, t) { this.sets.push(['set', val, t]); this.value = val; },
      linearRampToValueAtTime(val, t) { this.sets.push(['ramp', val, t]); this.value = val; },
      setValueCurveAtTime(curve, t, d) { this.sets.push(['curve', curve.length, t, d]); this.value = val0(curve); },
    };
  }
  function val0(curve) { return curve && curve.length ? curve[curve.length - 1] : 0; }
  const ctx = {
    gains, currentTime: 0, destination: {},
    createGain() {
      const g = { gain: param(-1), connect() {} };
      gains.push(g);
      return g;
    },
    createBufferSource() {
      return { buffer: null, connect() {}, start() {}, stop() {} };
    },
    decodeAudioData() { return Promise.resolve({ duration: 60.485 }); },
    resume() { return Promise.resolve(); },
  };
  return ctx;
}

describe('P16 music loop', () => {
  it('crossfade overlap is 2s; duck is -6dB', () => {
    assert.strictEqual(Audio.MUSIC_XFADE, 2.0);
    assert.strictEqual(Audio.DUCK_DB, -6);
  });

  it('musicStart refuses to run without a context (never throws, no timers)', () => {
    const eng = Audio.create({ ctxFactory: null, fetchFn: null });
    assert.strictEqual(eng.musicStart(), false);
    assert.strictEqual(eng.state().musicPlaying, false);
  });

  it('crossfade curves are equal-power (sin^2+cos^2=1, constant loudness)', () => {
    const fi = Audio.fadeCurveIn(), fo = Audio.fadeCurveOut();
    assert.strictEqual(fi.length, 64);
    assert.strictEqual(fo.length, 64);
    for (let i = 0; i < 64; i++) {
      assert.ok(Math.abs(fi[i] * fi[i] + fo[i] * fo[i] - 1) < 1e-12, 'i=' + i);
    }
    assert.ok(fi[0] < 0.001 && fi[63] > 0.999);
    assert.ok(fo[0] > 0.999 && fo[63] < 0.001);
  });

  it('segments chain gaplessly: next.start == prev.start + dur - xfade', async () => {
    const ctx = fakeMusicCtx();
    const eng = Audio.create({ ctxFactory: () => ctx, fetchFn: fakeFetch([]) });
    eng.unlock();
    await eng.loadAll();
    assert.strictEqual(eng.musicStart(), true);
    ctx.currentTime = 55; // force the lookahead pump to schedule segment 2
    eng.musicBusLevel('game');
    // reach into the pump via a second start-free tick: schedule manually
    // by advancing time and re-pumping through musicStart's interval path
    await new Promise((r) => setTimeout(r, 600));
    try {
      assert.ok(eng.music.segs.length >= 2, 'segs: ' + eng.music.segs.length);
      const [a, b] = eng.music.segs;
      assert.ok(Math.abs(b.start - (a.start + 60.485 - Audio.MUSIC_XFADE)) < 1e-6,
        `gap: a.start=${a.start} b.start=${b.start}`);
      // segment 2 (non-first) uses the equal-power curve pair, not ramps
      const segGains = ctx.gains.slice(4).map((g) => g.gain.sets.map((s) => s[0]).join('+'));
      assert.ok(segGains.some((s) => s.includes('curve')), JSON.stringify(segGains));
    } finally {
      eng.musicStop();
    }
    assert.strictEqual(eng.state().musicPlaying, false);
  });

  it('game level 0.60, menu 0.30, ducked game ~= 0.60 * 0.5012', async () => {
    const ctx = fakeMusicCtx();
    const eng = Audio.create({ ctxFactory: () => ctx, fetchFn: fakeFetch([]) });
    eng.unlock();
    await eng.loadAll();
    const musicBus = () => ctx.gains[3].gain;
    eng.musicBusLevel('game');
    assert.strictEqual(musicBus().value, 0.60);
    eng.setDucked(true);
    assert.ok(Math.abs(musicBus().value - 0.60 * 0.5012) < 0.002, musicBus().value);
    eng.setDucked(false);
    eng.musicBusLevel('menu');
    assert.strictEqual(musicBus().value, 0.30);
    eng.setDucked(true);
    assert.ok(Math.abs(musicBus().value - 0.30 * 0.5012) < 0.002, musicBus().value);
    eng.setDucked(false);
  });
});

describe('P17 juice rails', () => {
  function seqRng(values) {
    let i = 0;
    return () => values[(i++) % values.length];
  }

  it('hit-stop is 50ms, non-stacking, consumable by frame time', () => {
    const j = Juice.createJuice();
    assert.strictEqual(Juice.HIT_STOP_MS, 50);
    Juice.triggerHitStop(j);
    Juice.triggerHitStop(j); // simultaneous trade: still one freeze
    assert.strictEqual(j.hitStops, 1);
    assert.strictEqual(j.hitStopPending, 50);
    assert.strictEqual(Juice.consumeHitStop(j, 16), true);
    assert.strictEqual(Juice.consumeHitStop(j, 16), true);
    assert.strictEqual(Juice.consumeHitStop(j, 16), true); // ~3 frames
    assert.strictEqual(Juice.consumeHitStop(j, 16), true); // 50-48=2 entry left
    assert.strictEqual(Juice.consumeHitStop(j, 16), false); // drained
    Juice.triggerHitStop(j); // re-arms after drain
    assert.strictEqual(j.hitStops, 2);
  });

  it('nudge kicks away from the attacker and decays to zero', () => {
    const j = Juice.createJuice();
    Juice.triggerNudge(j, 'player');
    assert.strictEqual(j.nudgeX, Juice.NUDGE_X);
    assert.strictEqual(j.nudgeY, Juice.NUDGE_Y);
    assert.ok(Math.abs(j.nudgeX) <= 12); // subtle: never obscures
    Juice.triggerNudge(j, 'champ');
    assert.strictEqual(j.nudgeX, -Juice.NUDGE_X);
    for (let i = 0; i < 200; i++) Juice.decayNudge(j, 16);
    assert.strictEqual(j.nudgeX, 0);
    assert.strictEqual(j.nudgeY, 0);
  });

  it('dust puffs are sand-colored, slow, and sized (6 / 10 big)', () => {
    const parts = [];
    Juice.spawnDust(parts, 100, 200, false, seqRng([0.5]));
    assert.strictEqual(parts.length, 6);
    for (const p of parts) {
      assert.strictEqual(p.kind, 'dust');
      assert.ok(Juice.DUST_COLORS.includes(p.c), p.c);
      assert.strictEqual(p.grav, 150);
      assert.ok(p.sz >= 4 && p.sz <= 7);
    }
    Juice.spawnDust(parts, 100, 200, true, seqRng([0.1, 0.9]));
    assert.strictEqual(parts.length, 16);
  });
});
