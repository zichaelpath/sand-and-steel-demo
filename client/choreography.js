/* SAND & STEEL — bout choreography planner (Phase 3b, P11b multi-stage).
 *
 * COMPLIANCE-CRITICAL, OUTCOME-FIRST design (per stage):
 *  - Each stage's RGS result is known BEFORE any choreography is chosen for
 *    that stage. The plan ALWAYS resolves to it:
 *      narrow_win / decisive_win -> the player wins (champ at 0 HP).
 *      loss                     -> the champ wins (player at 0 HP).
 *      draw                     -> both fighters at 1 HP, then a
 *        "DRAW — new weapons!" transition into the next stage at full HP.
 *    There is no path in this module that inverts, softens, or re-draws a
 *    stage result.
 *  - HP finals are part of the outcome contract, not variety:
 *      draw: both at exactly 1 HP.
 *      narrow win: winner ends with 1-2 HP.
 *      decisive win: winner ends with 3+ HP.
 *    Within those bands the exact remainder is uniform (variety within the
 *    outcome). Losses end the champ at uniform 1..max HP — identically
 *    distributed every time, never framed as a near-miss.
 *  - Choreography VARIETY (exchange count, opening attacker, per-exchange
 *    block/dodge/hit reactions) is drawn from an outcome-INDEPENDENT source
 *    (drawVariety takes NO outcome input) and is identically distributed for
 *    every stage result. NO near-miss engineering, ever.
 *  - Every bout plan encodes to a <=32-byte /bet/event string (encodeBout)
 *    so the round stays replayable per the bet-replay requirement:
 *    decodeBout rebuilds the EXACT same beats + HP track from the record —
 *    never re-drawn.
 *
 * Stage shape (4-6s HP battle, timed by the runner from pack clip durations):
 *   walk-in (stage 1) / reset (stages 2-3) -> 2-3 exchanges (attack vs
 *   block/dodge/hit, HP chips on hits) -> finale (winner lands the killing
 *   blow, loser dies; or mutual standoff on a draw) -> hold/transition ->
 *   stage banner (floor text on draws, terminal banner on finals).
 *
 * HP flavor (presentation, mirrors math/SPEC_V2.md): stage 1 = 5 HP each,
 * stages 2-3 = 10 HP each. Mid-bout HP chips come from variety (hits deal
 * 1, blocks/dodges deal 0); the finale always forces the exact contractual
 * final, capped so chips can never overshoot it early.
 *
 * Legacy: the v1 single-bout API (TAG SSv1, planBout/encodePlan/decodePlan/
 * schedulePlan over WIN/LOSS) is kept so old replay records still decode.
 */

(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SandSteelChoreo = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TAG = 'SSv1';
  var TAG2 = 'SSv2';
  var DEFENSES = ['block', 'dodge', 'hit']; // uniform, outcome-independent
  var DEFENSE_LETTER = { block: 'B', dodge: 'D', hit: 'H' };
  var LETTER_DEFENSE = { B: 'block', D: 'dodge', H: 'hit' };

  // v2 stage results (certified math vocabulary).
  var STAGE_RESULTS = ['narrowWin', 'decisiveWin', 'draw', 'loss'];
  var RESULT_LETTER = { narrowWin: 'N', decisiveWin: 'C', draw: 'T', loss: 'L' };
  var LETTER_RESULT = { N: 'narrowWin', C: 'decisiveWin', T: 'draw', L: 'loss' };
  // Presentation HP flavor per stage (mirrors SPEC_V2; math-owned values
  // live in math/bout.js — this copy only sizes the bars).
  var HP_BY_STAGE = [5, 10, 10];
  var HP_LETTER = { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: 'A' };
  var LETTER_HP = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, A: 10 };

  // Draw variety ONLY — no outcome input, so variety can never depend on it.
  // rng: function returning [0,1). Consumes 2 + nEx draws.
  function drawVariety(rng) {
    if (typeof rng !== 'function') throw new TypeError('rng must be a function');
    var exchanges = rng() < 0.5 ? 2 : 3;
    var first = rng() < 0.5 ? 'player' : 'champ';
    var defenses = [];
    for (var i = 0; i < exchanges; i++) {
      defenses.push(DEFENSES[Math.floor(rng() * DEFENSES.length) % DEFENSES.length]);
    }
    return { exchanges: exchanges, first: first, defenses: defenses };
  }

  function other(side) {
    return side === 'player' ? 'champ' : 'player';
  }

  // Variety WITHIN the outcome: the winner's exact remaining HP, uniform
  // inside the contractual band. rng is the same outcome-independent source;
  // the band itself comes from the (already known) result.
  function drawEndHp(rng, result, hpMax) {
    if (typeof rng !== 'function') throw new TypeError('rng must be a function');
    if (STAGE_RESULTS.indexOf(result) < 0) throw new RangeError('bad stage result: ' + result);
    if (HP_BY_STAGE.indexOf(hpMax) < 0 && (hpMax !== 5 && hpMax !== 10)) {
      throw new RangeError('bad hpMax: ' + hpMax);
    }
    if (result === 'draw') return 1;
    if (result === 'narrowWin') return 1 + Math.floor(rng() * 2); // 1-2
    if (result === 'decisiveWin') {
      var span = (hpMax - 1) - 3 + 1; // 3..hpMax-1
      return 3 + Math.floor(rng() * span);
    }
    return 1 + Math.floor(rng() * hpMax); // loss: champ ends 1..max, uniform
  }

  function checkVariety(variety) {
    if (!variety || (variety.exchanges !== 2 && variety.exchanges !== 3)) {
      throw new TypeError('variety.exchanges must be 2 or 3');
    }
    if (variety.first !== 'player' && variety.first !== 'champ') {
      throw new TypeError("variety.first must be 'player' or 'champ'");
    }
    if (!Array.isArray(variety.defenses) ||
        variety.defenses.length !== variety.exchanges) {
      throw new TypeError('variety.defenses must match exchanges');
    }
    variety.defenses.forEach(function (d) {
      if (DEFENSES.indexOf(d) < 0) throw new TypeError('bad defense: ' + d);
    });
  }

  // Outcome-first single stage. endHp: winner's remaining HP (both at 1 on
  // a draw). When omitted, drawn via drawEndHp(rng, result, hpMax) — pass
  // rng for live planning; pass an explicit endHp when rebuilding from a
  // replay record so nothing is re-drawn.
  function planStage(stageIndex, result, variety, endHpOrRng, hpMax) {
    if (stageIndex !== 0 && stageIndex !== 1 && stageIndex !== 2) {
      throw new RangeError('stageIndex must be 0, 1, or 2');
    }
    if (STAGE_RESULTS.indexOf(result) < 0) {
      throw new RangeError('bad stage result: ' + result);
    }
    checkVariety(variety);
    var max = hpMax || HP_BY_STAGE[stageIndex];
    var endHp;
    if (typeof endHpOrRng === 'function') {
      endHp = drawEndHp(endHpOrRng, result, max);
    } else if (typeof endHpOrRng === 'number') {
      endHp = endHpOrRng;
    } else {
      throw new TypeError('endHpOrRng must be an rng function or an explicit endHp');
    }
    // Validate the contractual final.
    if (result === 'draw' && endHp !== 1) throw new RangeError('draw must end both at 1 HP');
    if (result === 'narrowWin' && (endHp < 1 || endHp > 2)) {
      throw new RangeError('narrow win must end the winner at 1-2 HP');
    }
    if (result === 'decisiveWin' && endHp < 3) {
      throw new RangeError('decisive win must end the winner at 3+ HP');
    }
    if ((result === 'narrowWin' || result === 'decisiveWin' || result === 'loss') &&
        (endHp < 1 || endHp > max)) {
      throw new RangeError('endHp out of range for ' + max + ' HP');
    }

    var winner = result === 'draw' ? null : (result === 'loss' ? 'champ' : 'player');
    var loser = winner ? other(winner) : null;
    // Chip caps: mid-bout hits can never take a fighter below what the
    // finale requires — the finale alone decides the ending.
    var cap = { player: 1, champ: 1 };
    if (result === 'draw') { cap.player = 1; cap.champ = 1; }
    else { cap[winner] = endHp; cap[loser] = 1; }

    var hp = { player: max, champ: max };
    var beats = [];
    var attacker = variety.first;
    for (var i = 0; i < variety.exchanges; i++) {
      var defender = other(attacker);
      var defense = variety.defenses[i];
      if (defense === 'hit' && hp[defender] > cap[defender]) hp[defender] -= 1;
      beats.push({
        kind: 'exchange',
        attacker: attacker,
        defender: defender,
        defense: defense,
        hpAfter: { player: hp.player, champ: hp.champ },
      });
      attacker = other(attacker); // attacks alternate; symmetric by construction
    }
    if (result === 'draw') {
      // Mutual standoff: both trade a final blow and end at exactly 1 HP.
      hp.player = 1; hp.champ = 1;
      beats.push({
        kind: 'draw-finale',
        attacker: attacker, // whoever's turn is next opens the trade
        defender: other(attacker),
        hpAfter: { player: 1, champ: 1 },
      });
    } else {
      // Decisive finale — the ONLY beat that reads the outcome, and it
      // always resolves to it: the winner lands the killing blow.
      hp[winner] = endHp; hp[loser] = 0;
      beats.push({
        kind: 'finale',
        attacker: winner,
        defender: loser,
        hpAfter: { player: hp.player, champ: hp.champ },
      });
    }
    return {
      stageIndex: stageIndex,
      result: result,
      winner: winner,
      loser: loser,
      hpMax: max,
      endHp: endHp,
      first: variety.first,
      exchanges: beats,
    };
  }

  // A full bout = the ordered stage plans (1-3). Draws must be non-terminal
  // stages; the last stage must be terminal (never a draw — stage 3 is
  // final, and a bout never ends mid-escalation).
  function planBoutV2(stagePlans) {
    if (!Array.isArray(stagePlans) || stagePlans.length < 1 || stagePlans.length > 3) {
      throw new RangeError('stagePlans must be an array of 1-3 stage plans');
    }
    stagePlans.forEach(function (sp, i) {
      if (!sp || sp.stageIndex !== i) throw new TypeError('stage plan ' + i + ' has wrong stageIndex');
      if (i < stagePlans.length - 1 && sp.result !== 'draw') {
        throw new RangeError('non-final stage ' + i + ' must be a draw');
      }
      if (i === stagePlans.length - 1 && sp.result === 'draw') {
        throw new RangeError('final stage must be terminal, not a draw');
      }
    });
    return { stages: stagePlans.slice() };
  }

  // Compact replay record, always <= 32 bytes. Per stage: result letter +
  // exchange count + defense letters + opening attacker + winner-HP letter.
  // Example: "SSv2T2BHp1N2HDc2" (draw then player narrow win). Parsing is
  // positional so no separators are needed.
  function encodeStage(sp) {
    var s = RESULT_LETTER[sp.result];
    if (!s) throw new TypeError('bad stage result: ' + sp.result);
    var mid = sp.exchanges.filter(function (b) { return b.kind === 'exchange'; });
    s += String(mid.length);
    mid.forEach(function (b) { s += DEFENSE_LETTER[b.defense]; });
    s += sp.first === 'player' ? 'p' : 'c';
    s += HP_LETTER[sp.endHp];
    if (!HP_LETTER[sp.endHp]) throw new Error('endHp out of encodable range: ' + sp.endHp);
    return s;
  }

  function encodeBout(boutPlan) {
    if (!boutPlan || !Array.isArray(boutPlan.stages)) {
      throw new TypeError('bout plan with stages is required');
    }
    var s = TAG2;
    boutPlan.stages.forEach(function (sp) { s += encodeStage(sp); });
    if (s.length > 32) throw new Error('encoded bout exceeds 32 bytes');
    return s;
  }

  function decodeBout(s) {
    if (typeof s !== 'string' || s.slice(0, 4) !== TAG2) {
      throw new Error('not a SandSteel v2 choreography record');
    }
    var i = 4;
    var stages = [];
    while (i < s.length) {
      var result = LETTER_RESULT[s.charAt(i)];
      if (!result) throw new Error('bad stage result letter');
      var nEx = parseInt(s.charAt(i + 1), 10);
      if (nEx !== 2 && nEx !== 3) throw new Error('bad exchange count');
      var defenses = [];
      for (var k = 0; k < nEx; k++) {
        var d = LETTER_DEFENSE[s.charAt(i + 2 + k)];
        if (!d) throw new Error('bad defense letter');
        defenses.push(d);
      }
      var first = s.charAt(i + 2 + nEx) === 'p' ? 'player'
        : s.charAt(i + 2 + nEx) === 'c' ? 'champ' : null;
      if (!first) throw new Error('bad opening attacker');
      var endHp = LETTER_HP[s.charAt(i + 3 + nEx)];
      if (!endHp) throw new Error('bad end-HP letter');
      stages.push(planStage(stages.length, result,
        { exchanges: nEx, first: first, defenses: defenses }, endHp));
      i += 4 + nEx;
    }
    return planBoutV2(stages);
  }

  // Schedule one stage in ms from real pack clip durations (clipMs: ms for
  // one full play of fighter+side+clip). Returns {events, totalMs} where
  // events are {at, action, beat?, hpAfter?} sorted by time. Inter-beat
  // pauses auto-fit so the total stays inside [4000, 6000]ms. The first
  // stage opens with a walk-in; later stages open with a shorter reset
  // (fighters are already in the arena at refilled HP).
  //
  // P14 (Armed pace): opts.pace 'armed' tightens the autofit budget target
  // from 5900ms to 5000ms — same events, same end states, same [4000,6000]
  // budget, just less air between beats. Outcome-consistency is untouched:
  // the finale/standoff still lands the exact RGS stage result.
  function scheduleStage(stagePlan, clipMs, fighters, isFirst, opts) {
    var pace = (opts && opts.pace === 'armed') ? 'armed' : 'trial';
    var BUDGET = pace === 'armed' ? 5000 : 5900;
    var WALK_MS = 600;
    var RESET_MS = 400;
    var HOLD_MS = 350;
    var SHOWN_MS = 750; // banner/transition lands while the tail finishes
    var attacks = [];
    var i, b, aMs;
    for (i = 0; i < stagePlan.exchanges.length; i++) {
      b = stagePlan.exchanges[i];
      if (b.kind !== 'exchange') continue;
      var atk = b.attacker === 'player' ? fighters.player : fighters.champ;
      aMs = clipMs(atk.id, atk.side, 'attack');
      attacks.push({ beat: b, ms: aMs });
    }
    var fin = stagePlan.exchanges[stagePlan.exchanges.length - 1];
    var finAtk = fin.attacker === 'player' ? fighters.player : fighters.champ;
    var finMs = clipMs(finAtk.id, finAtk.side, 'attack');
    var opener = isFirst ? WALK_MS : RESET_MS;
    var fixed = opener + HOLD_MS + SHOWN_MS + finMs;
    attacks.forEach(function (a) { fixed += a.ms; });
    // The draw trade shares one blow slot (simultaneous reactions), so the
    // autofit budget is identical to a terminal finale.
    var gaps = attacks.length + 2;
    var pause = Math.floor((BUDGET - fixed) / gaps);
    pause = Math.max(80, Math.min(320, pause));
    var total = fixed + pause * gaps;

    var events = [];
    var t = 0;
    events.push({ at: 0, action: isFirst ? 'walk-in' : 'reset', hpAfter: null });
    t += opener;
    attacks.forEach(function (a) {
      events.push({ at: t, action: 'attack', beat: a.beat, hpAfter: null });
      events.push({ at: t + Math.floor(a.ms * 0.4), action: 'react', beat: a.beat, hpAfter: a.beat.hpAfter });
      t += a.ms + pause;
    });
    if (fin.kind === 'draw-finale') {
      // Simultaneous trade: one blow slot, both fighters react at the same
      // instant and land at exactly 1 HP each.
      var riposte = { kind: 'exchange', attacker: fin.defender, defender: fin.attacker, defense: 'hit', hpAfter: fin.hpAfter };
      events.push({ at: t, action: 'finale-attack', beat: fin, hpAfter: null });
      events.push({ at: t + Math.floor(finMs * 0.4), action: 'finale-hit', beat: fin, hpAfter: null });
      events.push({ at: t + Math.floor(finMs * 0.4), action: 'finale-hit', beat: riposte, hpAfter: fin.hpAfter });
      t += finMs + SHOWN_MS;
      events.push({ at: t, action: 'standoff', beat: fin, hpAfter: fin.hpAfter });
    } else {
      events.push({ at: t, action: 'finale-attack', beat: fin, hpAfter: null });
      events.push({ at: t + Math.floor(finMs * 0.4), action: 'finale-hit', beat: fin, hpAfter: null });
      events.push({ at: t + finMs, action: 'death', beat: fin, hpAfter: fin.hpAfter });
      t += finMs + SHOWN_MS;
      events.push({ at: t, action: 'hold', beat: fin, hpAfter: fin.hpAfter });
    }
    t += HOLD_MS;
    events.push({ at: t, action: 'banner', beat: fin, hpAfter: fin.hpAfter });
    return { events: events, totalMs: t, pauseMs: pause, pace: pace };
  }

  // --- v1 legacy (SSv1 WIN/LOSS single bout; kept for old replay records) ---

  function planBout(outcome, variety) {
    if (outcome !== 'WIN' && outcome !== 'LOSS') {
      throw new RangeError("outcome must be 'WIN' or 'LOSS', got " + outcome);
    }
    checkVariety(variety);

    var winner = outcome === 'WIN' ? 'player' : 'champ';
    var loser = other(winner);
    var beats = [];
    var attacker = variety.first;
    for (var i = 0; i < variety.exchanges; i++) {
      beats.push({
        kind: 'exchange',
        attacker: attacker,
        defender: other(attacker),
        defense: variety.defenses[i],
      });
      attacker = other(attacker);
    }
    beats.push({ kind: 'finale', attacker: winner, defender: loser });
    return {
      outcome: outcome,
      winner: winner,
      loser: loser,
      first: variety.first,
      exchanges: beats,
    };
  }

  function encodePlan(plan) {
    if (!plan || (plan.outcome !== 'WIN' && plan.outcome !== 'LOSS')) {
      throw new TypeError('plan with WIN/LOSS outcome is required');
    }
    var mid = plan.exchanges.filter(function (b) { return b.kind === 'exchange'; });
    var s = TAG + (plan.outcome === 'WIN' ? 'W' : 'L') + String(mid.length);
    mid.forEach(function (b) { s += DEFENSE_LETTER[b.defense]; });
    s += plan.first === 'player' ? 'p' : 'c';
    if (s.length > 32) throw new Error('encoded plan exceeds 32 bytes');
    return s;
  }

  function decodePlan(s) {
    if (typeof s !== 'string' || s.slice(0, 4) !== TAG) {
      throw new Error('not a SandSteel choreography record');
    }
    var outcome = s.charAt(4) === 'W' ? 'WIN' : s.charAt(4) === 'L' ? 'LOSS' : null;
    if (!outcome) throw new Error('bad outcome in choreography record');
    var nEx = parseInt(s.charAt(5), 10);
    if (nEx !== 2 && nEx !== 3) throw new Error('bad exchange count');
    var defenses = [];
    for (var i = 0; i < nEx; i++) {
      var d = LETTER_DEFENSE[s.charAt(6 + i)];
      if (!d) throw new Error('bad defense letter');
      defenses.push(d);
    }
    var first = s.charAt(6 + nEx) === 'p' ? 'player'
      : s.charAt(6 + nEx) === 'c' ? 'champ' : null;
    if (!first) throw new Error('bad opening attacker');
    return planBout(outcome, { exchanges: nEx, first: first, defenses: defenses });
  }

  function schedulePlan(plan, clipMs, fighters) {
    var WALK_MS = 600;
    var HOLD_MS = 350;
    var DEATH_SHOWN_MS = 750;
    var attacks = [];
    var i, b, aMs;
    for (i = 0; i < plan.exchanges.length; i++) {
      b = plan.exchanges[i];
      if (b.kind !== 'exchange') continue;
      var atk = b.attacker === 'player' ? fighters.player : fighters.champ;
      aMs = clipMs(atk.id, atk.side, 'attack');
      attacks.push({ beat: b, ms: aMs });
    }
    var finAtk = plan.winner === 'player' ? fighters.player : fighters.champ;
    var finMs = clipMs(finAtk.id, finAtk.side, 'attack');
    var fixed = WALK_MS + HOLD_MS + DEATH_SHOWN_MS + finMs;
    attacks.forEach(function (a) { fixed += a.ms; });
    var gaps = attacks.length + 2;
    var pause = Math.floor((5900 - fixed) / gaps);
    pause = Math.max(80, Math.min(320, pause));
    var total = fixed + pause * gaps;

    var events = [];
    var t = 0;
    events.push({ at: 0, action: 'walk-in' });
    t += WALK_MS;
    attacks.forEach(function (a) {
      events.push({ at: t, action: 'attack', beat: a.beat });
      events.push({ at: t + Math.floor(a.ms * 0.4), action: 'react', beat: a.beat });
      t += a.ms + pause;
    });
    events.push({ at: t, action: 'finale-attack', beat: plan.exchanges[plan.exchanges.length - 1] });
    events.push({ at: t + Math.floor(finMs * 0.4), action: 'finale-hit', beat: plan.exchanges[plan.exchanges.length - 1] });
    events.push({ at: t + finMs, action: 'death', beat: plan.exchanges[plan.exchanges.length - 1] });
    t += finMs + DEATH_SHOWN_MS;
    events.push({ at: t, action: 'hold', beat: plan.exchanges[plan.exchanges.length - 1] });
    t += HOLD_MS;
    events.push({ at: t, action: 'banner' });
    return { events: events, totalMs: t, pauseMs: pause };
  }

  return {
    TAG: TAG,
    TAG2: TAG2,
    DEFENSES: DEFENSES,
    STAGE_RESULTS: STAGE_RESULTS,
    HP_BY_STAGE: HP_BY_STAGE,
    drawVariety: drawVariety,
    drawEndHp: drawEndHp,
    planStage: planStage,
    planBoutV2: planBoutV2,
    encodeStage: encodeStage,
    encodeBout: encodeBout,
    decodeBout: decodeBout,
    scheduleStage: scheduleStage,
    planBout: planBout,
    encodePlan: encodePlan,
    decodePlan: decodePlan,
    schedulePlan: schedulePlan,
  };
}));
