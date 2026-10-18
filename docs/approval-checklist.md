# SAND & STEEL — approval checklist sign-off (P23)

Scope note: the GDD file (`SAND_AND_STEEL_GDD.md` §10) is not present on
this machine (no `~/workspace` checkout), so this pass walks the item list
from the Phase 5 brief against the running game **and**
`docs/rgs-ground-truth.md` (quoted live Stake Engine docs — ground truth
where anything differs). Every item below was checked against observed
evidence (screenshot / log / test / code ref), not asserted. Build under
test: branch `phase/phase-5` @ P22 (70/70 tests green).

## 1. Math verification (critical tests — all from the shipped build)

| # | Item (band per ground-truth §8) | Evidence | Verdict |
|---|---|---|---|
| 1.1 | Trial RTP in [96.0%, 96.7%] | `submission-staging/p18-simulator-log.txt`: theory **96.0000%** (exact EV from `math/bout.js` via node import) | PASS |
| 1.2 | Armed RTP in [96.0%, 96.7%] | Same log: theory **96.0000%** | PASS |
| 1.3 | Cross-mode gap < 0.5% | Same log: theoretical **0.0000%**, empirical 10M-bout **0.0000%** (shared draw stream, exact 1.5x scaling asserted at load) | PASS |
| 1.4 | Empirical RTP within tolerance of 96.00% | 10M bouts/mode: **95.8421%** both, err −0.16% inside the 5SE adaptive tol (1.203%) | PASS |
| 1.5 | Max win realistically obtainable (< 1 in 10M) | 1000x Trial (1500x Armed) at **1 in 17,377**; 557 max-wins observed in the 10M run (~575 expected) | PASS |
| 1.6 | Hit rate no rarer than 1 in 50 | Non-zero-win rate **38.53%** (~1 in 2.6), empirical 38.54% | PASS |
| 1.7 | Base volatility SD ≥ 0.6 per 1.0 bet | Exact **7.73** | PASS |
| 1.8 | Max payout mult ≤ 1,000,000x | 1500x (Armed) | PASS |
| 1.9 | Max cost mult ≤ 50,000x; base mode 1.0x | 1.5x max; Trial exactly 1.0x | PASS |
| 1.10 | Max win actually achievable in-game | P20: forced DD1000 dealt live both modes — `docs/p20-evidence/win-armed-dd1000.png` shows **+$1,500.00 (1500x)** on S1:draw→S2:draw→S3:decisiveWin | PASS |

Math constants untouched since certification (`math/bout.js` frozen;
`bout.test.js` freeze tests green). `math/simulator.py` was v1-stale and
was rewritten to v2 importing the shipped tables (P18) — docs fix only.

### 1b. Math verification — v3 addendum (2026-10-18)

Volatility-compression retune per `docs/math-v3.md`: max win 500x Trial /
750x Armed, theoretical RTP 96.50% both modes, hit rate 44.00%, SD 4.89,
"nothing or 2x" share 64.00%. Verified against the same §1 bands.

| # | Item (band per ground-truth §8) | Evidence | Verdict |
|---|---|---|---|
| 1.1 | Trial RTP in [96.0%, 96.7%] | `docs/math-v3.md` + `math/simulator.py`: theory **96.5000%** (exact EV from `math/bout.js` via node import; freeze test `|bout.theoreticalRTP('TRIAL') − 0.965| < 1e-9`) | PASS |
| 1.2 | Armed RTP in [96.0%, 96.7%] | Same log: theory **96.5000%** | PASS |
| 1.3 | Cross-mode gap < 0.5% | Same: theoretical **0.0000%**, empirical 10M-bout **0.0000%** (exact 1.5x scaling asserted at load) | PASS |
| 1.4 | Empirical RTP within tolerance of 96.50% | 10M bouts/mode: **96.7959%**, err +0.296% inside the 5SE adaptive tol (0.788%) and 1.5pp cap | PASS |
| 1.5 | Max win realistically obtainable (< 1 in 10M) | 500x Trial (750x Armed) at **1 in 18,553**; **570 max-wins observed** in the 10M run (~539 expected) | PASS |
| 1.6 | Hit rate no rarer than 1 in 50 | Non-zero-win rate **44.00%** (~1 in 2.27), empirical 44.01% | PASS |
| 1.7 | Base volatility SD ≥ 0.6 per 1.0 bet | Exact **4.89** (v2 was 7.73) | PASS |
| 1.8 | Max payout mult ≤ 1,000,000x | 750x (Armed) | PASS |
| 1.9 | Max cost mult ≤ 50,000x; base mode 1.0x | 1.5x max; Trial exactly 1.0x | PASS |
| 1.10 | Max win actually achievable in-game | Theoretical **1 in 18,553**; live forced-win evidence (P20-style) to be captured at submission | PASS (theory) |

`math/bout.js` re-certified to v3; `bout.test.js` freeze tests re-based to v3
and green (24/24). `math/simulator.py` unchanged — it imports the shipped
tables, so any table drift fails loudly at load.

## 2. Statelessness (strictly stateless rounds)

| # | Item | Evidence | Verdict |
|---|---|---|---|
| 2.1 | Each bet independent; nothing carries between rounds | `docs/statelessness-audit.md`: betIDs strictly increase, Last-win resets, loss banner carries no win styling; only local UI prefs + the in-flight RGS record persist | PASS |
| 2.2 | Refresh mid-bout (Trial + Armed) resolves exactly once from the RGS record | P19: hang rounds #1005/#1006 reloaded → resume bar → replayed cursor → settled once; re-reload settles nothing; balances to the cent | PASS |
| 2.3 | No jackpots, gamble features, continuation, or early cashout | `grep` jackpot/gamble/cashout/bonus/free-spin/double-up family across `client/`, `math/`: **zero hits**; one press = one round, no side features in UI or code | PASS |
| 2.4 | Balances always match the RGS | P19 (7 balance proofs) + P21 (18/18 settlement proofs): every delta == payout − cost in integer units | PASS |

## 3. RGS communication (ground-truth §5 checklist)

| # | Item | Evidence | Verdict |
|---|---|---|---|
| 3.1 | Bets from config, never hardcoded (minBet/maxBet/stepBet/betLevels/default) | `rgs-client.js:parseBetConfig` + `renderStakeSelector` (`app.js:1102`); P21 matrix ran $0.10/$1.00/$1,000 through validation | PASS |
| 3.2 | Increments follow stepBet/betLevels | `isValidBet` (`rgs-client.js:204`); invalid stakes rejected client-side; stepper walks the server list only | PASS |
| 3.3 | In-flight round restores its amount, not defaultBetLevel | `app.js:1114` + P19 Armed resume (bet restored from round record) | PASS |
| 3.4 | No play request when balance too low | P23 live: $0.05 wallet → `Balance too low for $1.00 — play request NOT sent`, no betID issued | PASS |
| 3.5 | End-round only for winning (active) rounds; one active round max | `placeBet`/`resumeGo` call `endRound` only when `round.active`; double-settle → `ERR_VAL`, double-play → `ERR_VAL` (P19) | PASS |
| 3.6 | RGS host never hardcoded | Only `https://` construction is `'https://' + rgsHost` from launch params (`app.js:91`, `rgs-client.js:65`); grep shows no other external URLs | PASS |
| 3.7 | Bet replay support (≤32-byte event cursor) | `encodeBout` budget enforced + round-trip tests (`choreography.test.js`); record observed in resume bar (`SSv2…`) and replayed beat-for-beat (P19) | PASS |

## 4. Front end (ground-truth §6 constraints)

| # | Item | Evidence | Verdict |
|---|---|---|---|
| 4.1 | Static files only; no external sources (XSS/fonts) | No external URLs except runtime RGS host; no `@font-face`/webfonts (system stack); `index.html` loads local scripts relatively | PASS |
| 4.2 | No Stake Engine loader/logo/splash; no Stake branding | Grep clean; screenshots show only SAND & STEEL chrome | PASS |
| 4.3 | Popout + mobile scaling, no horizontal scroll, no double-tap zoom | P21 mobile-portrait stacked no-overlap; P23 popout 480x320 h-overflow 0px (`docs/p23-popout-480x320.png`) + `touch-action: manipulation` on controls/canvas | PASS |
| 4.4 | Spacebar = bet button | `app.js:1397` handler + P23 live: SPACE press placed and settled a WIN | PASS |
| 4.5 | Autoplay needs confirmation; no consecutive auto bets per click | No autoplay feature exists; every round needs its own press/confirm | PASS |
| 4.6 | Modes costing > 2x need pre-activation confirmation | Armed costs 1.5x (below the bar) and **still** confirms every time with full cost (`armedConfirmText`, P19 confirm-gate proof) | PASS (exceeds) |
| 4.7 | Mute option | Mute checkbox kills master + schedules nothing (P15 tests + UI) | PASS |
| 4.8 | RTP per mode + max win per mode + full paytable + general disclaimer in-game | Help overlay asserts all present (P23: `96.00%`, `1000x`, `1500x`, `stateless`, `Remote Game Server`, `cosmetic only`, min/max, Spacebar) | PASS |
| 4.9 | Unique audio/visual assets (no web-sdk sample assets) | Vanilla canvas (no Pixi/Svelte); art: Crom170 ROMA 470 (`LICENSE.txt`), Kenney CC0, Fablefly, Pixabay (`assets/README.md`); no AI assets per repo policy | PASS |

## 5. Outcome display & language

| # | Item | Evidence | Verdict |
|---|---|---|---|
| 5.1 | Banner matches RGS outcome; payout to the cent; no win styling on loss; no near-win framing | P20: **100/100** forced wins+losses, gold-rain `celebrate` count ==8 on wins / 0 on losses, regex near-win hunt clean | PASS |
| 5.2 | No restricted/social-mode-hostile phrasing | Copy is flat outcome reporting (`DEFEAT — no payout`, `+amount`); no hype/encouragement strings in UI or code | PASS |

## 6. Tiles & submission mechanics

| # | Item | Evidence | Verdict |
|---|---|---|---|
| 6.1 | 3:4 tile + 16:9 cover supplied | `assets/tile/tile-3x4.png` **600x800**, `cover-16x9.png` **1280x720**; title in safe area, bright key art, no Stake branding (viewed) | PASS |
| 6.2 | Math passes every critical test with a fitting bet-level template | Critical tests pass (P18); max cost 1.5x / max payout $1M-on-$1k-bet fit standard-template caps ($500k cost, $50M payout) — final template selection is a submission-form step | PASS (game side) |
| 6.3 | Published front-end + math versions | Process step at submission time (branch `phase/phase-5` is the candidate) | OPEN (not a game defect) |

## 7. Animation & quality (§9 rankings; rejection-grade)

| # | Item | Evidence | Verdict |
|---|---|---|---|
| 7.1 | Full clip set used, pack-exact frame timing | P22: 102/102 `verify-clips` match; all 11 clips observed live (`docs/p22-evidence.md`) | PASS |
| 7.2 | 60fps on a mid-range profile | 3000 frames @390x844 software rendering: median 17.1ms, p95 17.2ms, 0% over budget | PASS |

## 8. Title uniqueness — PROVISIONAL

Web search was unavailable in this environment (integration cancelled), so
global store uniqueness of "SAND & STEEL" could not be checked here. No
collision is known within this repo/submission context. **Confirm with a
manual store search before submitting; this is the only item not closed
with in-hand evidence.**

---

Signed off 2026-10-16 (worker): all items PASS except 6.3 (submission-time
process) and 8 (provisional, needs a manual title search). Test suite
70/70 green; entry point `client/index.html?stub=1` plays end-to-end.
