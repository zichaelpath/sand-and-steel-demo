/* SAND & STEEL — unit tests for math/bout.js v2 (draw-escalation model).
 * Run: node --test math/bout.test.js
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const bout = require('./bout.js');

const EXPECTED_TRIAL = [
  {
    narrowWin:   { p: 0.3280284192, mult: 2 },
    decisiveWin: { p: 0.0172646536, mult: 8 },
    draw:        { p: 0.04 },
    loss:        { p: 0.6147069272, mult: 0 },
  },
  {
    narrowWin:   { p: 0.3143605684, mult: 4 },
    decisiveWin: { p: 0.0165452931, mult: 20 },
    draw:        { p: 0.08 },
    loss:        { p: 0.5890941385, mult: 1 },
  },
  {
    narrowWin:   { p: 0.3416962700, mult: 10 },
    decisiveWin: { p: 0.0179840142, mult: 1000 },
    draw:        { p: 0 },
    loss:        { p: 0.6403197158, mult: 5 },
  },
];

describe('certified constants (freeze test)', () => {
  it('TRIAL stage tables match the certified spec exactly', () => {
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

  it('RTP_TARGET is exactly 0.96', () => {
    assert.strictEqual(bout.RTP_TARGET, 0.96);
  });
});

describe('theoretical RTP', () => {
  it('Trial RTP is 96.00% (within 1e-9)', () => {
    assert.ok(Math.abs(bout.theoreticalRTP('TRIAL') - 0.96) < 1e-9);
  });

  it('Armed RTP equals Trial RTP exactly (scaling construction)', () => {
    assert.ok(Math.abs(bout.theoreticalRTP('ARMED') - bout.theoreticalRTP('TRIAL')) < 1e-12);
  });

  it('both modes sit inside the certified band [96.0%, 96.7%]', () => {
    for (const m of ['TRIAL', 'ARMED']) {
      const r = bout.theoreticalRTP(m);
      assert.ok(r >= 0.96 - 1e-9 && r <= 0.967, m + ' RTP ' + r); // 1e-9: exact-arithmetic RTP is 0.96; float lands a hair below
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

  it('draw 0.33 -> stage-1 decisive win @8x', () => {
    const b = bout.evaluateBout([0.33], 'TRIAL');
    assert.strictEqual(b.stages[0].result, 'decisiveWin');
    assert.strictEqual(b.payoutMult, 8);
  });

  it('draw 0.99 -> stage-1 loss @0x', () => {
    const b = bout.evaluateBout([0.99], 'TRIAL');
    assert.strictEqual(b.stages[0].result, 'loss');
    assert.strictEqual(b.payoutMult, 0);
  });

  it('draw then narrow win: [0.36, 0.0] -> draw, stage-2 narrow @4x', () => {
    const b = bout.evaluateBout([0.36, 0.0], 'TRIAL');
    assert.strictEqual(b.stages.length, 2);
    assert.strictEqual(b.stages[0].result, 'draw');
    assert.strictEqual(b.stages[1].result, 'narrowWin');
    assert.strictEqual(b.payoutMult, 4);
  });

  it('double draw then loss: [0.36, 0.35, 0.99] -> banked 5x floor', () => {
    const b = bout.evaluateBout([0.36, 0.35, 0.99], 'TRIAL');
    assert.deepStrictEqual(b.stages.map(s => s.result), ['draw', 'draw', 'loss']);
    assert.strictEqual(b.payoutMult, 5);
  });

  it('the 1000x: [0.36, 0.35, 0.35] -> double draw, stage-3 decisive', () => {
    const b = bout.evaluateBout([0.36, 0.35, 0.35], 'TRIAL');
    assert.strictEqual(b.stages[2].result, 'decisiveWin');
    assert.strictEqual(b.payoutMult, 1000);
  });

  it('single draw with no follow-up draw throws (incomplete bout)', () => {
    assert.throws(() => bout.evaluateBout([0.36], 'TRIAL'), RangeError);
  });

  it('ARMED scales payouts: [0.0] -> 3x (2 x 1.5)', () => {
    const b = bout.evaluateBout([0.0], 'ARMED');
    assert.strictEqual(b.payoutMult, 3);
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
    const b = bout.evaluateBout([0.36, 0.35, 0.35], 'TRIAL');
    assert.strictEqual(bout.payoutFor('TRIAL', b, 1000000), 1000000000);
  });

  it('totalCostFor: Trial 1.0x, Armed 1.5x', () => {
    assert.strictEqual(bout.totalCostFor('TRIAL', 1000000), 1000000);
    assert.strictEqual(bout.totalCostFor('ARMED', 1000000), 1500000);
  });
});
