/* SAND & STEEL — juice primitives (Phase 4, P17 feel pass).
 *
 * COMPLIANCE RAILS (hard limits, unit-tested):
 *  - Hit-stop freezes the PRESENTATION clock only (2-3 frames ≈ 50ms real
 *    time, non-stacking). Scheduled choreography totals, HP tracks, finals,
 *    and the readability hold are untouched — the outcome resolves exactly
 *    as the RGS dealt it, ~50ms later on the wall clock.
 *  - Dust puffs are sand-colored canvas rects at the impact point. They
 *    never cover the fighters' end states or the result banner.
 *  - The camera nudge is a small (±12px, -4px up) decaying offset applied
 *    beside the existing shake. It cannot obscure the result.
 *
 * Node-safe: pure logic over injected arrays, no DOM/audio at load.
 */

(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SandSteelJuice = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HIT_STOP_MS = 50; // 2-3 frames at 60fps
  var NUDGE_X = 12;
  var NUDGE_Y = -4;
  var NUDGE_TAU_MS = 180; // exponential decay constant
  // Sand-colored dust puffs at the impact point: slow rise, low gravity,
  // longer life than sparks. Colors run LIGHTER than the packed sand so the
  // burst reads against the floor without leaving the palette. big=true on
  // the killing blow.
  var DUST_COLORS = ['#f5ead0', '#e8d5a8', '#fff3c4'];

  function createJuice() {
    return {
      hitStopPending: 0, // real ms of presentation freeze left
      hitStops: 0, // harness-observable trigger count
      nudgeX: 0,
      nudgeY: 0,
    };
  }

  // Decisive blow landed: freeze ~3 frames. Non-stacking — a simultaneous
  // trade (draw-finale's paired hits) freezes once, not twice.
  function triggerHitStop(juice) {
    if (juice.hitStopPending <= 0) {
      juice.hitStopPending = HIT_STOP_MS;
      juice.hitStops += 1;
    }
  }

  // Consume the freeze against real frame time. Returns true while frozen
  // (caller skips fighter/particle stepping but still draws).
  function consumeHitStop(juice, dtMs) {
    if (juice.hitStopPending > 0) {
      juice.hitStopPending -= dtMs;
      return true;
    }
    return false;
  }

  // Killing blow: nudge the camera away from the attacker (the blow's
  // direction), slightly up. winner is 'player' (left) or 'champ' (right).
  function triggerNudge(juice, winner) {
    juice.nudgeX = winner === 'player' ? NUDGE_X : -NUDGE_X;
    juice.nudgeY = NUDGE_Y;
  }

  function decayNudge(juice, dtMs) {
    var k = Math.exp(-dtMs / NUDGE_TAU_MS);
    juice.nudgeX *= k;
    juice.nudgeY *= k;
    if (Math.abs(juice.nudgeX) < 0.05) juice.nudgeX = 0;
    if (Math.abs(juice.nudgeY) < 0.05) juice.nudgeY = 0;
  }

  // Sand-colored dust puffs at the impact point: slow rise, low gravity,
  // longer life than sparks. big=true on the killing blow.
  function spawnDust(parts, x, y, big, rnd) {
    var rand = rnd || Math.random;
    var n = big ? 10 : 6;
    for (var i = 0; i < n; i++) {
      parts.push({
        kind: 'dust',
        x: x + (rand() - 0.5) * 40,
        y: y + (rand() - 0.5) * 26,
        vx: (rand() - 0.5) * 140,
        vy: -30 - rand() * 80,
        grav: 150,
        sz: 4 + rand() * (big ? 5 : 3),
        life: 700 + rand() * 400,
        t: 0,
        c: DUST_COLORS[Math.floor(rand() * DUST_COLORS.length) % DUST_COLORS.length],
      });
    }
  }

  // Spark defaults (shared so the runner draws both kinds consistently).
  function sparkDefaults() {
    return { kind: 'spark', grav: 500, sz: 4 };
  }

  return {
    HIT_STOP_MS: HIT_STOP_MS,
    NUDGE_X: NUDGE_X,
    NUDGE_Y: NUDGE_Y,
    NUDGE_TAU_MS: NUDGE_TAU_MS,
    DUST_COLORS: DUST_COLORS,
    createJuice: createJuice,
    triggerHitStop: triggerHitStop,
    consumeHitStop: consumeHitStop,
    triggerNudge: triggerNudge,
    decayNudge: decayNudge,
    spawnDust: spawnDust,
    sparkDefaults: sparkDefaults,
  };
}));
