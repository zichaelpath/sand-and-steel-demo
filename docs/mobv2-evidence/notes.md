# MOBv2 evidence — mobile arena-first UI (mockup A) + fight mode (mockup C)

This phase is layout/CSS/DOM only. No game logic, math, RGS seam, bet
settlement, or audio behavior was touched.

## Layout approximations vs the approved mockups
- The mockups draw the arena as a CSS gradient with SVG fighters. The actual
  game renders the arena through the code-drawn canvas (client/arena.js,
  ROMA sprites). Per the "layout only" rule, the canvas arena is retained and
  sized to fill the mockup's arena band (~60% betting / ~85% fight mode) rather
  than being replaced by a CSS scene.
- Mockup A does not show a fighter picker. Fighter selection is cosmetic /
  local-pref only, so on mobile portrait the fighter-card strip is hidden and
  the default fighter is used (the pref still persists to localStorage).
- Mockup A's overlaid "TRIAL/ARMED" arena badge is not reproduced; the mode is
  shown via the segmented Trial/Armed toggle in the control deck.

## Verification approach
- Headless Chrome (chrome-headless-shell) over CDP at 390x844 and 375x667.
- States captured: betting (mockup A), mid-fight (mockup C), settled (deck
  returns), plus one full bout settling WIN and one settling LOSS.
- Asserted: no page scroll (scrollHeight == innerHeight) at both widths in all
  states; FIGHT visible without scrolling in betting state; zero console errors.
