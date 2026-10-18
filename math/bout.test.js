/* SAND & STEEL — unit tests for math/bout.js v3 (draw-escalation model).
 * Run: node --test math/bout.test.js
 *
 * Freeze tests: they must fail on any change to the certified v3 tables.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const bout = require('./bout.js');

const EXPECTED_TRIAL = [
  {
    narrowWin:   { p: 0.08,                            mult: 2 },
    decisiveWin: { p: 0.0,                             mult: 8 }, // tier exists; never pays in v3
    draw:        { p: 0.36 },                          // banks 1x
    loss:        { p: 0.56,                            mult: 0 },
  },
  {
    narrowWin:   { p: 0.08,                            mult: 4 },
    decisiveWin: { p: 0.01,                            mult: 50 }, // 50x fattened middle tier
    draw:        { p: 0.08 },                          // banks 5x
    loss:        { p: 0.83,                            mult: 1 },
  },
  {
    narrowWin:   { p: 0.28,                            mult: 10 },
    decisiveWin: { p: 0.0018714927048260406,           mult: 500 }, // max win 500x
    draw:        { p: 0 },                             // no draws at the final stage
    loss:        { p: 0.718128507295174,               mult: 5 },
  },
];

describe('certified constants (freeze test)', () => {
  it('TRIAL stage tables match the certified v3 spec exactly', () => {
    assert.deepStrictEqual(bout.TRIAL.stages, EXPECTED_TRIAL);
  });

  it('TRIAL costMult is 1.0 and HP flavor is [5,10,10]', () => {
    assert.strictEqual(bout.TRIAL.costMult, 1.0);
    assert.deepStrictEqual(bout.TRIAL.hp, [5, 10, 10]);
  });

  it('ARMED mirrors TRIAL probabilities with every payout mult x 1.5', () => {
    assert.strictEqual(bout.ARMED.costMult, 1.5);
    for (let i = 0; i < 3; i++) {
      for (const k of ['narrowWin', 'decisiveWin', 'draw', 'loss']) {
        assert.strictEqual(bout.ARMED.stages[i][k].p, EXPECTED_TRIAL[i][k].p);
        if ('mult' in EXPECTED_TRIAL[i][k]) {
          assert.strictEqual(
            bout.ARMED.stages[i][k].mult, EXPECTED_TRIAL[i][k].mult * 1.5);
        }
      }
    }
  });

  it('each stage distribution sums to 1.0', () => {
    for (const m of [bout.TRIAL, bout.ARMED]) {
      for (const s of m.stages) {
        const sum = s.narrowWin.p + s.decisiveWin.p + (s.draw ? s.draw.p : 0) + s.loss.p;
        assert.ok(Math.abs(sum - 1.0) < 1e-12, 'stage sums to ' + sum);
      }
    }
  });

  it('RTP_TARGET is exactly 0.965', () => {
    assert.strictEqual(bout.RTP_TARGET, 0.965);
  });

  it('Trial stage-3 decisive max win is 500x (was 1000x in v2)', () => {
    assert.strictEqual(bout.TRIAL.stages[2].decisiveWin.mult, 500);
  });

  it('stage-2 decisive is the new 50x middle tier', () => {
    assert.strictEqual(bout.TRIAL.stages[1].decisiveWin.mult, 50);
  });
});

describe('theoretical RTP', () => {
  it('Trial RTP is 96.50% (within 1e-9)', () => {
    assert.ok(Math.abs(bout.theoreticalRTP('TRIAL') - 0.965) < 1e-9);
  });

  it('Armed RTP equals Trial RTP exactly (scaling construction)', () => {
    assert.ok(Math.abs(bout.theoreticalRTP('ARMED') - bout.theoreticalRTP('TRIAL')) < 1e-12);
  });

  it('both modes sit inside the Stake band [96.0%, 96.7%]', () => {
    for (const m of ['TRIAL', 'ARMED']) {
      const r = bout.theoreticalRTP(m);
      assert.ok(r >= 0.96 - 1e-9 && r <= 0.967, m + ' RTP ' + r);
    }
  });
});

describe('evaluateBout draw mapping', () => {
  it('draw 0.0 -> stage-1 narrow win @2x', () => {
    const b = bout.evaluateBout([0.0], 'TRIAL');
    assert.strictEqual(b.stages.length, 1);
    assert.strictEqual(b.stages[0].result, 'narrowWin');
    assert.strictEqual(b.payoutMult, 2);
  });

  it('draw stage carries null payout: [0.40, 0.0] -> draw, then stage-2 narrow @4x', () => {
    const b = bout.evaluateBout([0.40, 0.0], 'TRIAL');
    assert.strictEqual(b.stages.length, 2);
    assert.strictEqual(b.stages[0].result, 'draw');
    assert.strictEqual(b.stages[0].payoutMult, null);
    assert.strictEqual(b.stages[1].result, 'narrowWin');
    assert.strictEqual(b.payoutMult, 4);
  });

  it('draw 0.50 -> stage-1 loss @0x', () => {
    const b = bout.evaluateBout([0.50], 'TRIAL');
    assert.strictEqual(b.payoutMult, 0);
  });

  it('draw then 50x decisive: [0.40, 0.085] -> draw, stage-2 decisive @50x', () => {
    const b = bout.evaluateBout([0.40, 0.085], 'TRIAL');
    assert.strictEqual(b.stages.length, 2);
    assert.strictEqual(b.stages[0].result, 'draw');
    assert.strictEqual(b.stages[1].result, 'decisiveWin');
    assert.strictEqual(b.payoutMult, 50);
  });

  it('draw, draw, stage-2 loss: [0.40, 0.50] -> banked 1x floor', () => {
    const b = bout.evaluateBout([0.40, 0.50], 'TRIAL');
    assert.deepStrictEqual(b.stages.map(s => s.result), ['draw', 'loss']);
    assert.strictEqual(b.payoutMult, 1);
  });

  it('double draw then stage-3 narrow: [0.40, 0.10, 0.27] -> @10x', () => {
    const b = bout.evaluateBout([0.40, 0.10, 0.27], 'TRIAL');
    assert.deepStrictEqual(b.stages.map(s => s.result), ['draw', 'draw', 'narrowWin']);
    assert.strictEqual(b.payoutMult, 10);
  });

  it('double draw then stage-3 loss: [0.40, 0.10, 0.99] -> banked 5x floor', () => {
    const b = bout.evaluateBout([0.40, 0.10, 0.99], 'TRIAL');
    assert.deepStrictEqual(b.stages.map(s => s.result), ['draw', 'draw', 'loss']);
    assert.strictEqual(b.payoutMult, 5);
  });

  it('the 500x max win: [0.40, 0.10, 0.281] -> double draw, stage-3 decisive', () => {
    const b = bout.evaluateBout([0.40, 0.10, 0.281], 'TRIAL');
    assert.strictEqual(b.stages[2].result, 'decisiveWin');
    assert.strictEqual(b.payoutMult, 500);
  });

  it('single draw with no follow-up draw throws (incomplete bout)', () => {
    assert.throws(() => bout.evaluateBout([0.40], 'TRIAL'), RangeError);
  });

  it('ARMED scales payouts: [0.0] -> 3x (2 x 1.5)', () => {
    const b = bout.evaluateBout([0.0], 'ARMED');
    assert.strictEqual(b.payoutMult, 3);
  });

  it('ARMED max win: double-draw decisive -> 750x (500 x 1.5)', () => {
    const b = bout.evaluateBout([0.40, 0.10, 0.281], 'ARMED');
    assert.strictEqual(b.payoutMult, 750);
  });

  it('rejects bad inputs', () => {
    assert.throws(() => bout.evaluateBout([], 'TRIAL'), RangeError);
    assert.throws(() => bout.evaluateBout([0, 0, 0, 0], 'TRIAL'), RangeError);
    assert.throws(() => bout.evaluateBout([1.0], 'TRIAL'), RangeError);
    assert.throws(() => bout.evaluateBout([-0.1], 'TRIAL'), RangeError);
    assert.throws(() => bout.evaluateBout([0.5], 'NOPE'), RangeError);
  });
});

describe('payoutFor / totalCostFor', () => {
  it('payoutFor multiplies baseBet by the terminal mult', () => {
    const b = bout.evaluateBout([0.40, 0.10, 0.281], 'TRIAL');
    assert.strictEqual(bout.payoutFor('TRIAL', b, 1000000), 500000000);
  });

  it('totalCostFor: Trial 1.0x, Armed 1.5x', () => {
    assert.strictEqual(bout.totalCostFor('TRIAL', 1000000), 1000000);
    assert.strictEqual(bout.totalCostFor('ARMED', 1000000), 1500000);
  });
});
