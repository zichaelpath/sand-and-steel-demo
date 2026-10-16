/* SAND & STEEL — unit tests for client/choreography.js v2 (Phase 3b, P11b).
 * Run: node --test client/choreography.test.js
 * Verifies outcome-first resolution, HP contract bands, replay round-trip,
 * 32-byte event budget, 4-6s stage timing, and variety independence.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const Choreo = require('./choreography.js');
const Clips = require('./clips.js');

function seqRng(values) {
  let i = 0;
  return () => values[(i++) % values.length];
}
// Deterministic pseudo-random stream (mulberry-ish) for sweep tests.
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

function clipMs(id, side, clip) { return Clips.totalMs(id, side, clip); }
const FIGHTERS = {
  player: { id: 'murmillo', side: 'right' },
  champ: { id: 'rebel_champion', side: 'left' },
};

describe('v2 variety is outcome-independent', () => {
  it('drawVariety takes no outcome input', () => {
    assert.strictEqual(Choreo.drawVariety.length, 1); // rng only
    const v = Choreo.drawVariety(streamRng(7));
    assert.ok(v.exchanges === 2 || v.exchanges === 3);
  });

  it('exchange/first/defense distribution is identical across results', () => {
    // Same variety object plans every result: variety never depends on it.
    const v = { exchanges: 3, first: 'player', defenses: ['hit', 'block', 'dodge'] };
    const rng = streamRng(1);
    for (const r of Choreo.STAGE_RESULTS) {
      const sp = Choreo.planStage(0, r, v, rng, 5);
      assert.deepStrictEqual(sp.exchanges.slice(0, 3).map((b) => b.defense), v.defenses);
      assert.strictEqual(sp.first, 'player');
    }
  });
});

describe('v2 outcome-first resolution + HP contract', () => {
  const varietyPool = [];
  for (let s = 1; s <= 40; s++) varietyPool.push(Choreo.drawVariety(streamRng(s)));

  it('narrow wins end the winner at 1-2 HP, loser at 0', () => {
    for (const [si, max] of [[0, 5], [1, 10], [2, 10]]) {
      for (const v of varietyPool) {
        const sp = Choreo.planStage(si, 'narrowWin', v, streamRng(si * 100 + 3), max);
        const fin = sp.exchanges[sp.exchanges.length - 1];
        assert.strictEqual(sp.winner, 'player');
        assert.deepStrictEqual(fin.hpAfter, { player: sp.endHp, champ: 0 });
        assert.ok(sp.endHp >= 1 && sp.endHp <= 2, 'narrow endHp ' + sp.endHp);
      }
    }
  });

  it('decisive wins end the winner at 3+ HP, loser at 0', () => {
    for (const [si, max] of [[0, 5], [1, 10], [2, 10]]) {
      for (const v of varietyPool) {
        const sp = Choreo.planStage(si, 'decisiveWin', v, streamRng(si * 100 + 9), max);
        const fin = sp.exchanges[sp.exchanges.length - 1];
        assert.strictEqual(sp.winner, 'player');
        assert.deepStrictEqual(fin.hpAfter, { player: sp.endHp, champ: 0 });
        assert.ok(sp.endHp >= 3, 'decisive endHp ' + sp.endHp);
      }
    }
  });

  it('draws end both fighters at exactly 1 HP', () => {
    for (const [si, max] of [[0, 5], [1, 10]]) {
      for (const v of varietyPool) {
        const sp = Choreo.planStage(si, 'draw', v, streamRng(5), max);
        assert.strictEqual(sp.winner, null);
        const fin = sp.exchanges[sp.exchanges.length - 1];
        assert.strictEqual(fin.kind, 'draw-finale');
        assert.deepStrictEqual(fin.hpAfter, { player: 1, champ: 1 });
      }
    }
  });

  it('losses end the player at 0 HP', () => {
    for (const v of varietyPool) {
      const sp = Choreo.planStage(0, 'loss', v, streamRng(11), 5);
      assert.strictEqual(sp.winner, 'champ');
      const fin = sp.exchanges[sp.exchanges.length - 1];
      assert.deepStrictEqual(fin.hpAfter, { player: 0, champ: sp.endHp });
    }
  });

  it('mid-bout HP never dips below caps (no early death, no healing finale)', () => {
    for (const r of Choreo.STAGE_RESULTS) {
      for (const v of varietyPool) {
        const sp = Choreo.planStage(1, r, v, streamRng(21), 10);
        for (const b of sp.exchanges) {
          assert.ok(b.hpAfter.player >= 0 && b.hpAfter.player <= 10);
          assert.ok(b.hpAfter.champ >= 0 && b.hpAfter.champ <= 10);
          if (b.kind === 'exchange') {
            assert.ok(b.hpAfter.player >= 1 && b.hpAfter.champ >= 1, 'no mid-bout death');
          }
        }
      }
    }
  });

  it('rejects contractual violations', () => {
    const v = { exchanges: 2, first: 'player', defenses: ['hit', 'hit'] };
    assert.throws(() => Choreo.planStage(0, 'narrowWin', v, 5, 5), RangeError); // 5 not 1-2
    assert.throws(() => Choreo.planStage(0, 'decisiveWin', v, 2, 5), RangeError); // 2 not 3+
    assert.throws(() => Choreo.planStage(3, 'loss', v, 2, 5), RangeError);
    assert.throws(() => Choreo.planStage(0, 'nope', v, 1, 5), RangeError);
  });
});

describe('v2 bout structure', () => {
  it('enforces draw-then-terminal ordering', () => {
    const v = { exchanges: 2, first: 'champ', defenses: ['block', 'dodge'] };
    const rng = streamRng(2);
    const d0 = Choreo.planStage(0, 'draw', v, rng, 5);
    const n1 = Choreo.planStage(1, 'narrowWin', v, rng, 10);
    assert.ok(Choreo.planBoutV2([d0, n1]));
    assert.throws(() => Choreo.planBoutV2([n1]), /stageIndex/); // stageIndex mismatch
    const term0 = Choreo.planStage(0, 'narrowWin', v, streamRng(8), 5);
    const d1 = Choreo.planStage(1, 'draw', v, streamRng(9), 10);
    assert.throws(() => Choreo.planBoutV2([term0, d1]), RangeError); // terminal first
    assert.throws(() => Choreo.planBoutV2([d0, d1]), RangeError); // ends on draw
  });
});

describe('v2 replay records', () => {
  it('encode->decode round-trips every bout shape within 32 bytes', () => {
    const shapes = [
      ['narrowWin'], ['decisiveWin'], ['loss'],
      ['draw', 'narrowWin'], ['draw', 'decisiveWin'], ['draw', 'loss'],
      ['draw', 'draw', 'narrowWin'], ['draw', 'draw', 'decisiveWin'], ['draw', 'draw', 'loss'],
    ];
    for (const shape of shapes) {
      for (let s = 0; s < 20; s++) {
        const rng = streamRng(shape.length * 1000 + s);
        const stages = shape.map((r, i) =>
          Choreo.planStage(i, r, Choreo.drawVariety(rng), rng));
        const bout = Choreo.planBoutV2(stages);
        const code = Choreo.encodeBout(bout);
        assert.ok(code.length <= 32, code + ' is ' + code.length + ' bytes');
        assert.ok(code.startsWith('SSv2'));
        const back = Choreo.decodeBout(code);
        assert.strictEqual(Choreo.encodeBout(back), code); // exact rebuild
        assert.deepStrictEqual(back.stages.map((x) => x.result), shape);
        assert.deepStrictEqual(
          back.stages.map((x) => x.exchanges[x.exchanges.length - 1].hpAfter),
          stages.map((x) => x.exchanges[x.exchanges.length - 1].hpAfter));
      }
    }
  });

  it('rejects non-v2 records', () => {
    assert.throws(() => Choreo.decodeBout('SSv1W2BHp'), /v2/);
    assert.throws(() => Choreo.decodeBout('nope'), /v2/);
  });
});

describe('v2 stage timing (4-6s HP battles)', () => {
  it('every roster pick x every result schedules inside [4000, 6000]ms', () => {
    const roster = ['murmillo', 'secutor', 'retiarius', 'thraex'];
    for (const pid of roster) {
      const f = { player: { id: pid, side: 'right' }, champ: FIGHTERS.champ };
      for (const r of Choreo.STAGE_RESULTS) {
        for (const first of [true, false]) {
          const v = { exchanges: 3, first: 'player', defenses: ['hit', 'block', 'dodge'] };
          const sp = Choreo.planStage(r === 'draw' ? 0 : 2, r, v, streamRng(4),
            r === 'draw' ? 5 : 10);
          void first;
          for (const isFirst of [true, false]) {
            const sch = Choreo.scheduleStage(sp, clipMs, f, isFirst);
            assert.ok(sch.totalMs >= 4000 && sch.totalMs <= 6000,
              pid + ' ' + r + ' first=' + isFirst + ': ' + sch.totalMs + 'ms');
          }
        }
      }
    }
  });
});

describe('v1 legacy compat', () => {
  it('old SSv1 records still decode', () => {
    const plan = Choreo.planBout('WIN', { exchanges: 2, first: 'player', defenses: ['block', 'hit'] });
    assert.strictEqual(Choreo.decodePlan(Choreo.encodePlan(plan)).outcome, 'WIN');
  });
});
