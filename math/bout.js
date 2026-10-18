/* SAND & STEEL — certified bout math v3 (draw-escalation model, 2026-10-18).
 *
 * CERTIFIED CONSTANTS — changing ANY value below changes the certified math
 * and requires Dietrich's explicit approval + simulator re-run + re-submission.
 * See math/README.md, docs/math-v3.md (design record), math/simulator.py.
 *
 * Model: one bout = one RGS round (stateless), fought in up to 3 stages.
 * Each stage's probabilities are CONDITIONAL on reaching that stage.
 * A stage ends narrow_win | decisive_win | draw | loss. A draw banks a
 * guaranteed floor (1x after stage 1, 5x after stage 2) and advances to the
 * next stage with fresh HP; stage 3 is final. Losses pay the banked floor.
 *
 * Volatility-compression retune (v3): max win 500x (Trial) / 750x (Armed)
 * instead of 1000x/1500x, fatter middle tiers (new 50x stage-2 decisive),
 * higher hit rate, lower volatility. Theoretical RTP 96.50% both modes.
 *
 * On Stake Engine the RNG lives in the RGS: one /wallet/play round resolves
 * ALL stages (one [0,1) draw per stage reached), and the round `state`
 * array carries the stage breakdown for choreography + bet replay.
 * evaluateBout(draws, mode) is the certified reference mapping. The client
 * NEVER draws locally for real rounds — live outcomes come from /wallet/play
 * responses only. This module is used for verification, the debug page, and
 * the stub-RGS harness.
 *
 * Amounts: RGS API units are integers with six decimal places
 * ($1.00 = 1000000). payoutFor() takes and returns the same units it is
 * given. ARMED payout mults are Trial x 1.5 (may be fractional in units;
 * the RGS handles final rounding per its documented rules).
 */

(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SandSteelMath = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Certified stage tables (TRIAL). Payout mults are x BASE bet.
  // Order per stage for draw mapping: narrowWin, decisiveWin, draw, loss.
  var TRIAL_STAGES = [
    { // Stage 1 — 5 HP each
      narrowWin:   { p: 0.08,          mult: 2 },
      decisiveWin: { p: 0.0,           mult: 8 }, // tier exists; never pays in v3
      draw:        { p: 0.36 },                  // banks 1x
      loss:        { p: 0.56,          mult: 0 },
    },
    { // Stage 2 — 10 HP each (reached on stage-1 draw; 1x banked)
      narrowWin:   { p: 0.08,          mult: 4 },
      decisiveWin: { p: 0.01,          mult: 50 }, // 50x tier: fattened middle
      draw:        { p: 0.08 },                  // banks 5x
      loss:        { p: 0.83,          mult: 1 },
    },
    { // Stage 3 — 10 HP each, final (reached on stage-2 draw; 5x banked)
      narrowWin:   { p: 0.28,          mult: 10 },
      decisiveWin: { p: 0.0018714927048260406, mult: 500 }, // max win 500x
      draw:        { p: 0 }, // no draws at the final stage
      loss:        { p: 0.718128507295174, mult: 5 },
    },
  ];
  var TRIAL = { costMult: 1.0, hp: [5, 10, 10], stages: TRIAL_STAGES };

  // ARMED: identical stage probabilities; every payout mult x 1.5; cost 1.5x.
  // RTP is therefore identical to TRIAL by construction (gap 0.00%).
  function scaleStages(stages, f) {
    return stages.map(function (s) {
      var o = {};
      for (var k in s) {
        if (!Object.prototype.hasOwnProperty.call(s, k)) continue;
        o[k] = { p: s[k].p };
        if ('mult' in s[k]) o[k].mult = s[k].mult * f;
      }
      return o;
    });
  }
  var ARMED = { costMult: 1.5, hp: [5, 10, 10], stages: scaleStages(TRIAL_STAGES, 1.5) };

  var RTP_TARGET = 0.965;
  var MODES = { TRIAL: TRIAL, ARMED: ARMED };
  var RESULTS = ['narrowWin', 'decisiveWin', 'draw', 'loss'];

  function normalizeMode(mode) {
    if (typeof mode !== 'string') throw new TypeError('mode must be a string');
    var key = mode.toUpperCase();
    if (!MODES[key]) throw new RangeError('unknown mode: ' + key);
    return key;
  }

  function checkDraw(d) {
    if (typeof d !== 'number' || Number.isNaN(d)) {
      throw new TypeError('each draw must be a number');
    }
    if (d < 0 || d >= 1) {
      throw new RangeError('draws must be in [0, 1), got ' + d);
    }
  }

  // Pure mapping of RGS draws to a full bout outcome.
  // draws: array of 1-3 numbers in [0,1), one per stage reached.
  // Returns { mode, stages: [{ stageIndex, result, payoutMult|null }], payoutMult }.
  // payoutMult is the TERMINAL payout (x base bet); draw stages carry null.
  function evaluateBout(draws, mode) {
    if (!Array.isArray(draws) || draws.length < 1 || draws.length > 3) {
      throw new RangeError('draws must be an array of 1-3 numbers');
    }
    var key = normalizeMode(mode);
    var stages = MODES[key].stages;
    var out = { mode: key, stages: [], payoutMult: 0 };
    for (var i = 0; i < draws.length; i++) {
      checkDraw(draws[i]);
      var s = stages[i];
      var d = draws[i];
      var acc = 0, result = null;
      for (var r = 0; r < RESULTS.length; r++) {
        acc += s[RESULTS[r]].p;
        if (d < acc) { result = RESULTS[r]; break; }
      }
      if (result === null) result = 'loss'; // float safety net
      if (result === 'draw') {
        if (i === stages.length - 1) {
          throw new RangeError('draw is impossible on the final stage');
        }
        out.stages.push({ stageIndex: i, result: 'draw', payoutMult: null });
        continue;
      }
      var mult = s[result].mult;
      out.stages.push({ stageIndex: i, result: result, payoutMult: mult });
      out.payoutMult = mult;
      return out;
    }
    // Ran out of draws while still drawing: not a complete bout.
    throw new RangeError('draws ended mid-bout on a draw; supply up to 3 draws');
  }

  // Payout in the same units as baseBet (RGS API units in production).
  function payoutFor(mode, boutResult, baseBet) {
    normalizeMode(mode);
    if (!boutResult || typeof boutResult.payoutMult !== 'number') {
      throw new TypeError('boutResult must come from evaluateBout()');
    }
    if (typeof baseBet !== 'number' || !Number.isFinite(baseBet) || baseBet < 0) {
      throw new TypeError('baseBet must be a finite number >= 0');
    }
    return baseBet * boutResult.payoutMult;
  }

  // Exact theoretical RTP = E[terminal payout mult] / costMult.
  function theoreticalRTP(mode) {
    var m = MODES[normalizeMode(mode)];
    function stageEV(i) {
      var s = m.stages[i];
      var ev = s.narrowWin.p * s.narrowWin.mult
             + s.decisiveWin.p * s.decisiveWin.mult
             + s.loss.p * s.loss.mult;
      if (i < m.stages.length - 1) ev += s.draw.p * stageEV(i + 1);
      return ev;
    }
    return stageEV(0) / m.costMult;
  }

  // Total debit for entering a bout, in the same units as baseBet.
  function totalCostFor(mode, baseBet) {
    var m = MODES[normalizeMode(mode)];
    if (typeof baseBet !== 'number' || !Number.isFinite(baseBet) || baseBet < 0) {
      throw new TypeError('baseBet must be a finite number >= 0');
    }
    return baseBet * m.costMult;
  }

  return {
    TRIAL: TRIAL,
    ARMED: ARMED,
    RTP_TARGET: RTP_TARGET,
    RESULTS: RESULTS,
    evaluateBout: evaluateBout,
    payoutFor: payoutFor,
    theoreticalRTP: theoreticalRTP,
    totalCostFor: totalCostFor,
  };
}));
