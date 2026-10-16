/* SAND & STEEL — fighter sprite integration (Phase 3, P10).
 *
 * HOUSE CHAMPION DECISION (fixed for the life of the game): the ROMA 470
 * pack ships murmillo, secutor, retiarius, thraex, rebel_champion (plus a
 * freed_rebel variant, not used). Four are player options —
 * murmillo / secutor / retiarius / thraex — and ONE is fixed as the house
 * champion: rebel_champion (matching the showcase demo on demo/showcase).
 * Secutor stays a player pick. The champion is cosmetic-opponent only: the
 * bout outcome always comes from the RGS, never from who faces whom.
 *
 * Animation player: 128x128 frames on the pack's 8-column sheets, driven by
 * the per-frame `duration` timing in client/clips.js (generated from the
 * pack JSON — never hand-tuned frame counts). Clips wired (P22: the full
 * pack vocabulary): idle, walk, charge (stage re-entry), attack, netcast
 * (retiarius opener), hit, block, blockhit (guard shattered on the kill),
 * dodge, death, hold (victory hold).
 * Side profiles: the player stands left and faces right (right_* clips);
 * the champion stands right and faces left (left_* clips). No canvas
 * mirroring — the pack ships true directional art.
 */

(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SandSteelSprites = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Player options vs the fixed house champion (see header decision).
  var PLAYER_OPTIONS = ['murmillo', 'secutor', 'retiarius', 'thraex'];
  var HOUSE_CHAMPION = 'rebel_champion';

  var DISPLAY_NAMES = {
    murmillo: 'Murmillo',
    secutor: 'Secutor',
    retiarius: 'Retiarius',
    thraex: 'Thraex',
    rebel_champion: 'Rebel Champion',
  };

  var FRAME = 128;
  var SHEET_COLS = 8;

  // Thraex has no Characters sheet: its art is the Variants appearance_1
  // sheet, whose 40 tag ranges + per-frame durations are IDENTICAL to
  // secutor's (verified at build time) — so the shared secutor timing table
  // drives it frame-exactly while the pixels stay distinct.
  var SPRITE_PATH = {
    thraex: '../assets/fighters/ROMA470_Gladiators_v0.3.0/Variants/PNG/thraex_appearance_1.png',
  };
  function spriteUrl(id) {
    if (SPRITE_PATH[id]) {
      return new URL(
        SPRITE_PATH[id],
        typeof document !== 'undefined' && document.baseURI
          ? document.baseURI
          : 'http://localhost/'
      ).toString();
    }
    return new URL(
      '../assets/fighters/ROMA470_Gladiators_v0.3.0/Characters/PNG/' + id + '.png',
      typeof document !== 'undefined' && document.baseURI
        ? document.baseURI
        : 'http://localhost/'
    ).toString();
  }

  // Clips module is injected (window.SandSteelClips in browser, require in
  // node) so this player stays testable without a DOM.
  function createPlayer(clipsApi) {
    function clipOf(fighterId, side, name) {
      return clipsApi.get(fighterId, side, name);
    }

    function makeFighter(fighterId, side) {
      return {
        id: fighterId,
        side: side, // 'right' (player, faces right) or 'left' (champion)
        clip: 'idle',
        idx: 0, // index into the clip's duration table
        acc: 0, // ms accumulated toward the next frame
        done: false, // true when a non-looping clip reaches its end
        x: 0, y: 0, // ground-anchor position (feet), canvas px
        scale: 2,
        flash: 0, // white hit-flash 0..1, decays in step()
        img: null, // HTMLImageElement, attached by attachImage()
        loaded: false,
      };
    }

    function setClip(f, name) {
      f.clip = name;
      f.idx = 0;
      f.acc = 0;
      f.done = false;
    }

    function isLoop(name) {
      // Pack loop:true tags: idle, walk, hold, charge. Everything else
      // (attack/hit/death/block/blockhit/dodge/netcast) plays once.
      return name === 'idle' || name === 'walk' || name === 'hold' || name === 'charge';
    }

    // Advance by dtMs using the pack's per-frame durations. Returns true
    // when a non-looping clip has just finished.
    function step(f, dtMs) {
      var clip = clipOf(f.id, f.side, f.clip);
      var n = clip.durs.length;
      if (f.done) return true;
      if (f.flash > 0) f.flash = Math.max(0, f.flash - dtMs / 300);
      f.acc += dtMs;
      var guard = 0;
      while (guard++ < 64) {
        var per = clip.durs[f.idx];
        if (f.acc < per) break;
        f.acc -= per;
        if (f.idx < n - 1) {
          f.idx++;
        } else if (isLoop(f.clip)) {
          f.idx = 0;
        } else {
          f.done = true;
          return true;
        }
      }
      return false;
    }

    // Absolute sheet frame number currently displayed.
    function frameNumber(f) {
      return clipOf(f.id, f.side, f.clip).from + f.idx;
    }

    // Total ms for one full play of a clip (pack timing, unscaled).
    function clipMs(fighterId, side, name) {
      return clipsApi.totalMs(fighterId, side, name);
    }

    function drawFrame(ctx, img, frameNo, dx, dy, dw, dh) {
      ctx.drawImage(
        img,
        (frameNo % SHEET_COLS) * FRAME,
        Math.floor(frameNo / SHEET_COLS) * FRAME,
        FRAME, FRAME, dx, dy, dw, dh
      );
    }

    // Draw with feet anchored at (f.x, f.y); ground line in the art is y=114.
    function draw(ctx, f) {
      if (!f.img || !f.loaded) return;
      var dw = FRAME * f.scale;
      var dh = FRAME * f.scale;
      drawFrame(ctx, f.img, frameNumber(f), f.x - dw / 2, f.y - 114 * f.scale, dw, dh);
      // P24: shaped hit-flash. The white is composited over the sprite's own
      // silhouette (source-atop) instead of a plain rect over the whole
      // frame — the flash always matches the current art. No rectangles in
      // the hit path: the flash layer is the offscreen copy itself.
      if (f.flash > 0) {
        var px = f.x - dw / 2;
        var py = f.y - 114 * f.scale;
        if (ensureFlashCanvas(f, dw, dh)) {
          var flash = f.flashCanvas;
          var fc = flash.getContext('2d');
          if (fc) {
            fc.clearRect(0, 0, dw, dh);
            drawFrame(fc, f.img, frameNumber(f), 0, 0, dw, dh);
            fc.globalCompositeOperation = 'source-atop';
            fc.fillStyle = '#fff';
            fc.fillRect(0, 0, dw, dh);
            ctx.globalAlpha = Math.max(0, f.flash) * 0.8;
            ctx.drawImage(flash, px, py);
            ctx.globalAlpha = 1;
          }
        }
      }
    }

    // Lazily build (once per fighter) the offscreen the hit-flash is drawn
    // from. Returns false when no 2D context is available (headless node).
    function ensureFlashCanvas(f, dw, dh) {
      if (f.flashCanvas && f.flashCanvas.width === dw && f.flashCanvas.height === dh) {
        return true;
      }
      if (typeof document === 'undefined' || !document.createElement) return false;
      var c = document.createElement('canvas');
      c.width = dw;
      c.height = dh;
      if (!c.getContext) return false;
      f.flashCanvas = c;
      return true;
    }

    function drawShadow(ctx, f, rx, ry) {
      ctx.fillStyle = 'rgba(60, 35, 10, 0.35)';
      ctx.beginPath();
      ctx.ellipse(f.x, f.y + 4, rx, ry, 0, 0, 6.284);
      ctx.fill();
    }

    return {
      makeFighter: makeFighter,
      setClip: setClip,
      step: step,
      isLoop: isLoop,
      frameNumber: frameNumber,
      clipMs: clipMs,
      draw: draw,
      drawShadow: drawShadow,
    };
  }

  return {
    PLAYER_OPTIONS: PLAYER_OPTIONS,
    HOUSE_CHAMPION: HOUSE_CHAMPION,
    DISPLAY_NAMES: DISPLAY_NAMES,
    FRAME: FRAME,
    SHEET_COLS: SHEET_COLS,
    spriteUrl: spriteUrl,
    createPlayer: createPlayer,
  };
}));
