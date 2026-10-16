/* SAND & STEEL — code-drawn arena backdrop (Phase 3, P09).
 *
 * All art is drawn in code on a 2D canvas: no image assets, no external
 * sources. Composition is BRIGHT and flat (vignette-free by requirement) so
 * the fighters and UI pop against it:
 *   - gradient dusk sky (warm gold — bright, never dark purple),
 *   - low sun disc with a soft halo,
 *   - stone wall with crenellations,
 *   - crowd-silhouette strip in layered rows with a slight animated sway,
 *   - two red-and-gold banners flanking the pit,
 *   - sand floor with speckle texture + a pale center ellipse.
 *
 * The backdrop stays STATIC during the bout so the fighters own the motion:
 * the combat runner freezes the crowd clock (frozenT) for the whole bout and
 * resumes it afterwards. Nothing here reads game state — pure presentation.
 */

(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SandSteelArena = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Deterministic decor so the arena looks identical every load.
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Precompute crowd seats + sand speckle once (positions in unit space).
  function makeCrowd() {
    var rnd = mulberry(470);
    var seats = [];
    var row, i;
    for (row = 0; row < 4; row++) {
      for (i = 0; i < 90; i++) {
        seats.push({
          x: rnd(),
          r: row,
          o: rnd() * 6.283,
          c: ['#4a3a32', '#5a463a', '#6b5040', '#3a2d26'][Math.floor(rnd() * 4)],
          skin: ['#c9a06a', '#a87c4e', '#8a5f3a', '#d9b47e'][Math.floor(rnd() * 4)],
        });
      }
    }
    var sand = [];
    for (i = 0; i < 420; i++) {
      sand.push({ x: rnd(), y: rnd(), s: 1 + rnd() * 2 });
    }
    return { seats: seats, sand: sand };
  }

  // Draw the full backdrop. tMs drives the crowd sway; pass a FROZEN value
  // during the bout so the backdrop is static while fighters move.
  //
  // P14 (Armed grade): opts.grade is 'trial' (default) or 'armed'. Armed
  // keeps the EXACT same geometry and layout — only the lighting grade
  // shifts warmer (ember sky, stronger halo, faint heat overlay) so players
  // can always tell which mode they are in. Pure presentation: no game
  // state is read or changed here.
  function drawArena(ctx, W, H, tMs, crowd, opts) {
    var grade = (opts && opts.grade === 'armed') ? 'armed' : 'trial';
    var i, s, x, y;
    // --- bright dusk sky: warm gold gradient, never dark ---
    var sky = ctx.createLinearGradient(0, 0, 0, H * 0.52);
    if (grade === 'armed') {
      sky.addColorStop(0, '#ffdf9e');
      sky.addColorStop(0.55, '#ffbe5e');
      sky.addColorStop(1, '#e07f2e');
    } else {
      sky.addColorStop(0, '#ffe9b0');
      sky.addColorStop(0.55, '#ffcf7d');
      sky.addColorStop(1, '#f0a850');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, Math.ceil(H * 0.52));

    // --- sun + halo (armed: stronger, hotter halo) ---
    ctx.fillStyle = grade === 'armed'
      ? 'rgba(255, 230, 180, 0.75)'
      : 'rgba(255, 246, 220, 0.55)';
    ctx.beginPath(); ctx.arc(W * 0.5, H * 0.40, grade === 'armed' ? 60 : 52, 0, 6.284); ctx.fill();
    ctx.fillStyle = grade === 'armed' ? '#ffe9a8' : '#fff3c4';
    ctx.beginPath(); ctx.arc(W * 0.5, H * 0.40, 32, 0, 6.284); ctx.fill();

    // --- stone wall + crenellations (warm sandstone, bright) ---
    ctx.fillStyle = '#a08b6d';
    ctx.fillRect(0, H * 0.30, W, H * 0.10);
    ctx.fillStyle = '#b39d7c';
    for (x = 0; x < W; x += 48) {
      ctx.fillRect(x, H * 0.30 - 14, 30, 16);
    }
    ctx.fillStyle = 'rgba(120, 90, 50, 0.35)';
    ctx.fillRect(0, H * 0.30 + H * 0.10 - 4, W, 4);

    // --- crowd-silhouette strip: 4 layered rows, slight sway ---
    for (i = 0; i < crowd.seats.length; i++) {
      s = crowd.seats[i];
      x = s.x * W;
      y = H * 0.315 + s.r * (H * 0.024) + Math.sin(tMs / 450 + s.o) * 2;
      ctx.fillStyle = s.c;
      ctx.beginPath(); ctx.arc(x, y, Math.max(3, H * 0.011), 0, 6.284); ctx.fill();
      ctx.fillStyle = s.skin;
      ctx.beginPath(); ctx.arc(x, y - H * 0.011, Math.max(1.6, H * 0.006), 0, 6.284); ctx.fill();
    }

    // --- two banners (house red + gold trim, gold sun sigil) ---
    var bx = [W * 0.08, W * 0.92];
    for (i = 0; i < 2; i++) {
      x = bx[i];
      ctx.fillStyle = '#a83232';
      ctx.fillRect(x - 16, H * 0.30 - 6, 32, 74);
      ctx.fillStyle = '#e8b64c';
      ctx.fillRect(x - 16, H * 0.30 - 6, 32, 6);
      ctx.fillRect(x - 16, H * 0.30 + 62, 32, 6);
      ctx.beginPath(); ctx.arc(x, H * 0.30 + 30, 9, 0, 6.284); ctx.fill();
    }

    // --- sand floor: warm gradient + pale center ellipse + speckle ---
    var sg = ctx.createLinearGradient(0, H * 0.40, 0, H);
    if (grade === 'armed') {
      sg.addColorStop(0, '#d9984a');
      sg.addColorStop(1, '#a86a2c');
    } else {
      sg.addColorStop(0, '#d9a960');
      sg.addColorStop(1, '#b3813e');
    }
    ctx.fillStyle = sg;
    ctx.fillRect(0, Math.floor(H * 0.40), W, H - Math.floor(H * 0.40));
    ctx.fillStyle = 'rgba(255, 240, 200, 0.35)';
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.74, W * 0.42, H * 0.19, 0, 0, 6.284);
    ctx.fill();
    ctx.fillStyle = 'rgba(90, 60, 25, 0.35)';
    for (i = 0; i < crowd.sand.length; i++) {
      s = crowd.sand[i];
      ctx.fillRect(s.x * W, H * 0.42 + s.y * H * 0.56, s.s, s.s);
    }
    // NOTE: no vignette — the composition stays bright edge to edge so the
    // game tile reads against the platform background (tile guidance).
    // Armed heat grade: a faint full-frame warm overlay, laid last so it
    // tints everything (fighters are drawn later, ungraded — they own the
    // motion and stay readable).
    if (grade === 'armed') {
      ctx.fillStyle = 'rgba(255, 90, 10, 0.10)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  return { makeCrowd: makeCrowd, drawArena: drawArena };
}));
