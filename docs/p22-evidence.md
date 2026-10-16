# P22 — animation quality & performance (observed)

## Clip-set usage (ROMA 470)

Pack vocabulary per fighter: Idle/Walk/Hold/Attack/Hit/Death/Charge/Block/
BlockHit/Dodge (+NetCast, retiarius only). Before: `blockhit` was tabled but
never played; `charge` and `netcast` were not even tabled. After:

- `clips.js` gained 12 entries (charge x10, netcast x2) generated from the
  pack JSONs (`gen-clips.js`): `verify-clips.js` reports **102/102 match, 0
  missing**, so frame timing is pack-exact (charge 700ms, netcast 850ms).
- Runner wiring (`app.js`, runner-side only, replay record untouched):
  stages 2-3 re-enter at `charge`; the killing blow plays `blockhit` when
  the loser's last variety defense was `block` (guard shattered), else
  `hit`; a retiarius opening the bout leads with `netcast`.
- Headless-Firefox observation over 9 live bouts (retiarius player, DDRAW +
  WIN/LOSS mix, 50ms clip poll): all 11 wired clips SEEN —
  idle, walk, charge, attack, netcast, hit, block, blockhit, dodge, death,
  hold. Variety stays outcome-independent; every finale still resolves to
  the RGS stage result.

## Thraex fix

`thraex.png` does not exist under Characters/PNG (the pick 404'd and the
fighter rendered nothing). `sprites.js` now maps thraex to
`Variants/PNG/thraex_appearance_1.png`, whose 40 tag ranges + durations are
identical to secutor's (verified), so timing is frame-exact with distinct
pixels. Observed: `scene.player.loaded === true` and the screenshot
`thraex-arena.png` shows the crested Thraex standing over the dead champion
on a Trial WIN (+$2.00).

## Performance (mobile-portrait 390x844, software rendering)

rAF-gap collector over 3000 frames spanning the heaviest bout (DDRAW,
3 stages + transitions, full speed): median 17.1ms, p95 17.2ms,
max 33.2ms, **0.0% frames over 25ms, 0.0% over 50ms**. No mitigations
needed — the bout holds 60fps; headless software rendering is the
pessimistic case versus a real device GPU.

Verdict: full clip set used with pack-exact timing, 60fps holds. PASS.
