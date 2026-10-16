# P19 — Statelessness audit (adversarial pass, observed behavior)

Harness: `?stub=1&fast=1` in headless Firefox (selenium-webdriver +
system geckodriver) against a local static server. The stub RGS mirrors
the documented shapes: one `/play` round resolves ALL stages, paying
rounds stay `active` until `/end-round`, the active round persists in
`sessionStorage` as the stand-in RGS record. Audit script (re-runnable):
`/tmp/opencode/phase5-harness/stateless.js` (+ `tabkill.js`); every STEP
below printed OK on 2026-10-16. Full suite 65/65 green before and after.

## 1. Refresh mid-bout — Trial (WIN, hanging round #1005)

- `?hang=1` leaves the paying round open post-choreography. Observed status:
  `Round 1005 left open (hang=1) — reload to test recovery.` Balance showed
  the debit only ($92.60 → $91.60 on a $1.00 bet): no payout credited yet.
- Reload (same tab): resume bar appears —
  `Unfinished TRIAL round #1005 — bet $1.00, stood at "SSv2…". It will be
  settled from its record — never re-drawn, never voided.`
- `Replay & settle from record` replays the recorded choreography cursor
  beat-for-beat, shows the same WIN banner (+$2.00), then `end-round`
  credits exactly +$2.00 ($91.60 → $93.60). Status:
  `Resumed round 1005 settled from its record — never re-drawn.`
- Second reload: resume bar hidden, balance unchanged ($93.60). The round
  resolved exactly once; no double-settle path exists.

## 2. Refresh mid-bout — Armed (FLOOR: draw → stage-2 loss, round #1006)

- Same flow at 1.5x cost: debit $1.50 pre-reload, resume credits +$1.50
  (banked 1x floor × 1.5). Balance math exact to the cent. The resumed
  stake restores from the round record, not `defaultBetLevel`
  (`renderStakeSelector`, `app.js:1114`).

## 3. Kill the tab mid-bout

- Killed the tab with round open; fresh tab boots at the stub default
  $100.00 with no resume bar. This is a **stub-harness limitation**, not a
  game bug: the stub keeps its stand-in RGS record in `sessionStorage`
  (same-tab refresh only). On live, the RGS holds the round server-side and
  `authenticate` returns it; the client resolves it via
  `Rgs.resolveInFlightRound` (`rgs-client.js:153`, active-only, never
  re-draws, never silently voids) and settles via `end-round`. No game code
  branches on tab lifetime.

## 4. Change fighters mid-session

- Switching Murmillo → Retiarius prints
  `Fighter: Retiarius (local UI pref — not sent to the RGS).` The fighter id
  lives in `localStorage` (`ss.fighterId`) and is never included in any RGS
  request (`app.js:1017-1025`). A forced WIN placed after the switch paid
  exactly 2x base ($101.50 → $102.50, delta +$1.00): math untouched.

## 5. Toggle modes rapidly

- Six rapid Trial/Armed toggles, then an Armed bet: the confirm gate opened
  with zero balance movement (no request sent pre-confirm), and the placed
  round resolved as `mode=ARMED` at 1.5x cost (delta +$1.50 on a $1.00
  forced WIN: −$1.50 + $3.00). Mode at send-time is what the RGS gets;
  toggling never strands a confirm bar (`confirmBar.hidden = true` on every
  mode/stake change).

## 6. Bet at min / max

- Min level $0.10, forced WIN: delta +$0.10 (−$0.10 + $0.20). Exact.
- Max level $10.00, forced LOSS: delta −$10.00, banner `DEFEAT` / class
  `loss`, no fanfare. Exact.

## 7. Exactly-once settlement (guards)

- `endRound` on a settled round rejects `ERR_VAL: no active round`, balance
  unchanged (double-settle impossible).
- `play` while a round is active fails `ERR_VAL: a round is already active`
  (`Bet failed: ERR_VAL: a round is already active`), balance unchanged
  (double-play impossible; mirrors live 400 ERR_VAL).

## 8. Nothing carries between rounds

- Consecutive forced WIN → LOSS: `betID` strictly increased (1007 → 1008),
  each round carried its own `{betID, amount, payout, mode, state}` record;
  the Last-win meter reset `+$2.00` → `—`; loss banner `DEFEAT`/`loss` with
  no win styling. Streaks, upgrades, and memory do not exist: the only
  persisted values are local UI prefs (fighter, mute, turbo) and the
  in-flight RGS record itself.

Verdict: every round resolves exactly once from the RGS record, balances
always match the RGS to the cent, and no state leaks between rounds. PASS.
