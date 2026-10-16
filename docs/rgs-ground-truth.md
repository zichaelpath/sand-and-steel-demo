# RGS Ground Truth — SAND & STEEL (Phase 0)

Source of truth: the official Engine (Stake Engine) developer documentation and
SDK repositories. Docs win over this repo and over the GDD wherever they differ.
All quotes below were read from the live docs on 2026-10-15/16. No API shapes
were invented: anything not found in the docs is marked NOT DOCUMENTED.

## 1. URLs used

Developer portal (marketing + entry point):

- https://engine.io — "Engine. Games built here. Played everywhere."
  ("Engine Studio is where creators build and publish casino games… every
  approved game goes live on Stake." / "Engine Integration is where operators
  bring every game on Engine to their players.")
- https://stake-engine.com — canonical link points to https://studio.engine.io,
  but the bare domain currently serves a domain-parking page. Do not rely on it.
- https://studio.engine.io — Engine Studio web app (login required for
  dashboard/team/game pages). The public documentation is a route group inside
  this same app, e.g.:
- https://studio.engine.io/docs (docs index)
- https://studio.engine.io/docs/rgs (RGS overview: launch URL, money, bet levels)
- https://studio.engine.io/docs/rgs/wallet (Wallet endpoints: exact
  request/response shapes, response codes)
- https://studio.engine.io/docs/rgs/example (fifty-fifty tutorial: math + Svelte
  frontend + publish flow)
- https://studio.engine.io/docs/approval-guidelines (general requirements)
- https://studio.engine.io/docs/approval-guidelines/rgs-communication
- https://studio.engine.io/docs/approval-guidelines/math-verification (RTP band,
  critical/non-critical tests, bet-level templates)
- https://studio.engine.io/docs/approval-guidelines/submission-checklist
- https://studio.engine.io/docs/approval-guidelines/game-replay-requirements
  (mandatory Bet Replay + `GET /bet/replay/...` schema)
- https://studio.engine.io/docs/approval-guidelines/front-end-communication
- https://studio.engine.io/docs/approval-guidelines/jurisdiction-requirements
  (social-mode restricted phrases)
- https://studio.engine.io/docs/approval-guidelines/general-disclaimer
- https://studio.engine.io/docs/approval-guidelines/game-tile-requirements
- https://studio.engine.io/docs/approval-guidelines/game-quality-rankings
- https://studio.engine.io/docs/front-end (Web SDK overview)
- https://studio.engine.io/docs/front-end/getting-started (Node 22.16.0, pnpm
  10.5.0, Storybook, build, Local Testing redirect)
- https://studio.engine.io/docs/front-end/dependencies (PixiJS 8, Svelte 5, …)
- https://studio.engine.io/docs/payments (Profit Share 10% / Guaranteed 7.5%)
- https://studio.engine.io/docs/distribution (Only on Stake vs network rates)
- https://studio.engine.io/docs/terms (renders the licence contract below)
- https://studio.engine.io/api/contracts/latest → `{"id":"019fb259-…"}` and
  https://studio.engine.io/api/contracts/019fb259-948a-7365-9150-b1348e35d164
  (Game Licence Terms and Conditions, Medium Rare N.V.; 36-month term, 10% GGR
  licence fee, Negative Rollover, $1,000 payout threshold, tax on Developer,
  identity verification, exclusivity clause 4.14)
- https://discord.com/invite/stakeengine (linked from engine.io)

SDK repositories (public, GitHub org `engineio`):

- https://github.com/engineio/ts-client — "Typescript client to communicate
  with the Stake Engine API." npm package `stake-engine` (`RGSClient`,
  `Authenticate`/`Play`/`EndRound`/`Event`, `balanceUpdate`/`roundActive`
  events, `API_MULTIPLIER`, `DisplayAmount`). Its README still points API docs
  at `https://stake-engine.com/docs/rgs` (stale host; live docs are the
  studio.engine.io routes above).
- https://github.com/engineio/math-sdk — "Python-based engine for defining game
  rules, simulating outcomes, and optimizing win distributions." Requires
  Python >= 3.12 (+ Rust/Cargo for the optimizer). Extra docs at
  https://engineio.github.io/math-sdk/
- https://github.com/engineio/web-sdk — "Svelte 5, PixiJS 8 and TurboRepo"
  monorepo, sample games lines/ways/cluster/scatter/price/number-picker.
  "You can use anything as long as it compiles to a static website."

Checked and ruled OUT:

- https://docs.stake.com — public *affiliate* API (campaign analytics, referred
  users), authenticated via `x-access-token`. Nothing to do with game RGS.
- https://stakeengine.com, https://stakeengine.dev, https://stakeengine.io,
  https://docs.engine.io, https://developers.engine.io — parked, unresolvable,
  or 404. The live product lives at engine.io / studio.engine.io.

## 2. Auth flow (quoting the docs)

> "Every flow starts with /wallet/authenticate, called when the game first
> loads. It authenticates the sessionID for use with /wallet/play,
> /wallet/balance, /wallet/end-round and /bet/event. Until it has been called,
> those endpoints return 400 ERR_VAL because the session is not authenticated."
> (RGS overview)

> "Request POST /wallet/authenticate {\"sessionID\": \"xxxxxxx\"}" (Wallet
> endpoints). Response: `balance {amount, currency}`, `config {minBet, maxBet,
> stepBet, defaultBetLevel, betLevels, gameModes [{mode, costMultiplier,
> maxBet}], user {id}, jurisdiction {...}}`, and `round` "only present when the
> player has an unfinished round… Frontends should resume it. round.event holds
> the last value recorded with /bet/event, if any."

Launch URL (game reads these query params; served from
`https://{team}.live.engine.io/{game}/v{version}/?...`):

> "sessionID — Unique session ID for the player. Required for every request the
> game makes. rgs_url — The RGS host… Never hardcode it: it can change at any
> time. lang… currency… device (desktop, mobile or tablet)… social (true when
> the operator is a social/sweepstakes casino)… demo (true for a demo
> play-money launch). rgs_url is a bare host name with no scheme, for example
> rgs2.engine.io. Prefix it with https:// and append the endpoint path."

## 3. Play-request fields (exact, quoting Wallet endpoints)

> "Play request — Starts a game round and debits the bet from the player's
> balance. amount is the base bet, as an integer with six decimal places; the
> debit is amount multiplied by the mode's cost multiplier. mode is the bet
> mode name."
>
> Request `POST /wallet/play`: `{"amount": 100000, "sessionID": "xxxxxxx",
> "mode": "BASE"}`

Response (`round` object):

> `{"balance": {"amount": 100000, "currency": "USD"}, "round": {"betID":
> 123456, "amount": 100000, "payout": 200000, "payoutMultiplier": 2,
> "active": true, "mode": "BASE", "state": [...]}}`
>
> "state holds the game events for the round. If active is false, the round
> paid nothing and is already closed; otherwise call /wallet/end-round once the
> round has finished playing."

End round: `POST /wallet/end-round {"sessionID": "xxxxxx"}` → returns
`balance`. "Completes the active round, paying out any win and ending all
activity for that round." Basic flow: "A round that pays nothing is closed by
/wallet/play itself… A round with a win stays active until you call
/wallet/end-round, which pays it out. Check round.active rather than assuming.
A player can have only one active round. Calling /wallet/play while a round is
still active returns 400 ERR_VAL."

Event (resume cursor): `POST /bet/event {"sessionID", "event"}` —
"Records how far the player has got through the active round… event is a
non-empty string of at most 32 bytes. It is only stored while a round is
active." Response echoes `{"event": "xxxxxx"}`.

Balance: `POST /wallet/balance {"sessionID": "xxxxxx"}` → `balance`.

Replay (unauthenticated): `GET https://{rgs_url}/bet/replay/{game}/{version}/{mode}/{event}`
→ `{"payoutMultiplier": 25.0, "costMultiplier": 1.0, "state": {}}`.
"An unknown game, version, mode or event returns a plain 404 with no JSON
body." Replay query params: `replay=true, game (UUID), version, mode, event,
rgs_url` required; `currency, amount (API units), lang, device, social, demo`
optional. "PLAYER SESSION IS NOT REQUIRED FOR VIEWING BET REPLAY!"

## 4. Response codes (exact table, quoting Wallet endpoints)

Errors return `{"error": "ERR_*", "message": "..."}`:

- `400 ERR_VAL` — "Invalid request: for example an unknown or unauthenticated
  session, a session too old to place new bets, a bet outside the bet levels,
  an unknown mode, a play while a round is already active, or an end-round
  with no active round."
- `400 ERR_IPB` — "Insufficient player balance."
- `400 ERR_GLE` — "Gambling limits exceeded."
- `429 ERR_ACT` — "Slow down. The provably fair draw for the player could not
  be taken; retry shortly."
- `500 ERR_GEN` — "General server error."
- `400` with plain `Bad Request` body: "the request body is not valid JSON,
  has a field of the wrong type, or the sessionID is malformed."
- `423` on `/wallet/play`: "new bets are paused, for example during
  maintenance. Balance and end-round calls still work, so open rounds can be
  settled."
- `429` on a demo launch: "too many requests from the player's IP address."

## 5. Bet-level / currency handling (quoting the docs)

Money: "Monetary values on the RGS are integers with six decimal places of
precision… to place a $1 bet, pass 1000000 as the amount. Amounts are JSON
numbers, not strings. Currency affects only the display layer; it does not
affect gameplay logic."

Bet validation (RGS overview): "bets must satisfy these conditions: The bet
must fall between minBet and maxBet (returned from /wallet/authenticate). The
bet must be divisible by stepBet. It is recommended to use the predefined
betLevels to guide players. A bet that breaks either rule is rejected with 400
ERR_VAL." Plus: "config.gameModes lists each playable bet mode with its cost
multiplier and the largest bet allowed in that mode."

RGS communication checklist adds: "The frontend must use these values
(config.minBet, config.maxBet, config.stepBet, config.defaultBetLevel,
config.betLevels) and never hardcode them… Bet increments must follow
config.stepBet or config.betLevels… If the /authenticate response contains an
active round, the game must restore the bet amount from that round rather than
defaultBetLevel… Do not send a /play request when the player's balance is too
low… Only call /end-round for a winning bet."

Bet-level templates (math verification): "define the underlying base bet
amount and range from a maximum of $1 USD to $1000 USD" per template, assigned
by exposure/cost/volatility. "With the standard templates, the RGS rejects a
bet if… The total bet cost (bet amount × mode cost multiplier) exceeds
$500,000 USD (or equivalent)… The potential payout (bet amount × mode maximum
win multiplier) exceeds $50,000,000 USD (or equivalent)… returns HTTP 400
{\"error\": \"ERR_VAL\", \"message\": \"invalid amount\"}."

## 6. Frontend guidance (quoting the docs)

> "Using the web SDK is optional. Engine serves your front end as a static
> website, so you can build it with any framework as long as the build output
> has an index.html at its root. The web SDK is the quickest route because the
> RGS integration, UI and tooling are already set up." (Web SDK page)

> "The web SDK is a Svelte 5 and PixiJS 8 monorepo, built with Turborepo, for
> developing web-based games in a declarative way." Dependencies page lists
> pixi.js 8, svelte 5, turbo 2, pixi-svelte (in-house), @sveltejs/kit 2,
> storybook 9, xstate 5, @lingui/core 5, typescript, pnpm 10. Getting-started
> requires "Node.js version 22.16.0 or later" and "pnpm version 10.5.0".
> web-sdk README FAQ: "You can use anything as long as it compiles to a static
> website, it is only recommended to use the web-sdk for the easiest
> development and integration experience."

VERDICT on the Phase 0 assumption "HTML5 + PixiJS is the recommendation":
CONFIRMED with a correction — the docs recommend the *web SDK* (Svelte 5 +
PixiJS 8) as the quickest route, but plain PixiJS / any static-site framework
is explicitly allowed. Our plan (HTML5 + PixiJS, no Svelte dependency for the
game client) complies.

Strict frontend constraints (approval): build must be static files only, "must
consist only of static files and cannot reach external sources" (XSS policy —
no external fonts); "All images and fonts must be loaded from the Engine
Content Delivery Network (CDN)"; no Stake Engine loader/logo/splash; support
Popout S/L mini-player and mobile scaling with no scroll and no double-tap
zoom; spacebar = bet button; autoplay needs confirmation, no consecutive auto
bets from one click; any mode costing > 2× base bet needs pre-activation
confirmation; mute option; RTP per mode + max win per mode + full paytable +
general disclaimer in-game; "unique audio and visual assets. Assets such as
backgrounds, symbols and/or animations provided with the web-sdk sample games
will not be approved."

## 7. Testing-tool workflow (quoting the docs)

- Storybook (component/book/bookEvent stories) for local testing without RGS.
- "Click Play Game in the game's sidebar to launch the published front end in
  the player. The launch URL carries the query parameters the game needs."
- "To play your local DEV build against the RGS, open Local Testing in the
  player's menu bar… and set Redirect URL to your dev server, for example
  http://localhost:3001. The player then launches that URL with the same query
  string."
- "Bets" sidebar: "Watch bets placed to the RGS this session"; replay samples
  (`Z.replaySamples`); per-bet cost/payout/multiplier table.
- Social Mode toggle in the Studio play modal; four reviewer screen sizes;
  AI review `prompt.md` (read-only agent audit against guideline IDs: launch +
  RGS, currency, front end, game rules, language, social mode, replay,
  compliance).
- Review: "three independent reviewers rate your game from 0 to 3 stars…
  Average ≥ 2 stars (at least 6 of 9 points) → final approval. Average < 2
  stars → not published… locked for 3 days" then resubmission allowed.
- Submission form blocks unless: 3:4 tile + 16:9 cover, published front + math
  versions, math passes every critical test with at least one fitting bet-level
  template, open-review limit (1 until first game live, then 5).

## 8. Design-assumption verification — CONTRADICTIONS FLAGGED

### ❌ CONTRADICTION 1 — RTP band is NOT 90–98%. It is 96.0%–96.7%.

Math verification, Critical Tests: "RTP band — Every mode's RTP must sit
between 96.0% and 96.7%." The submission form "blocks a game that fails any
of" the critical tests. Our certified 96.00% both modes sits exactly on the
lower bound — compliant, but with zero headroom. Any future math tweak must
stay inside [96.0%, 96.7%], not [90%, 98%]. Related: "maximum win should be
realistically obtainable (typically more frequent than 1 in 10,000,000)" (not
1 in 20M); "hit-rate of non-zero wins… no rarer than 1 in 50 bets"; "Base
volatility — standard deviation of every 1.0× mode must be ≥ 0.6"; max payout
multiplier ≤ 1,000,000×; max cost multiplier ≤ 50,000×; base (cheapest) mode
must be 1.0× cost.

### ⚠️ CONTRADICTION 2 (partial) — bet range "$0.10–$1,000".

The docs never state a universal $0.10–$1,000 range. What they state:
authenticate example shows `minBet 100000` ($0.10), `maxBet 1000000000`
($1,000), `stepBet 100000`; and "Bet-level templates define the underlying
base bet amount and range from a maximum of $1 USD to $1000 USD", with the
assigned template depending on "maximum cost multiplier, maximum payout
amount, and game volatility/operator risk", and operators can set lower
limits. So $0.10 min / $1,000 max matches the *example* standard template but
the real values always come from `/wallet/authenticate` per currency and must
never be hardcoded. Our bout design must read them from config at runtime.

### ✅ CONFIRMED — stateless rounds.

Approval guidelines: "Engine games are strictly stateless: Each bet must be
independent of previous outcomes. Games cannot include jackpots, gamble
features, continuation, or early cashout options."

### ✅ CONFIRMED — no jackpots / gamble / early-cashout (same quote as above).

### ✅ CONFIRMED with nuance — "RGS owns the RNG".

Outcomes are "pre-calculated game results… payouts are dictated purely by the
RGS response and are not influenced by events on the frontend" (disclaimer
template); "Winnings are settled according to the amount received from the
Remote Game Server." The math SDK generates books/lookup tables/index that get
published and served by the RGS ("will output all the files required by the
RGS… found within library/publish_files/"). So there is no live RNG call from
the frontend — the RGS deals from our published, certified math. Our
`math/simulator.py` correctly models only the outcome mapping, not an RNG we
ship.

## 9. Commercial terms found (for the application packet)

- Payments page: Profit Share = 10% of actual GGR (Only on Stake) / 5% per
  operator (network). Guaranteed = 7.5% of expected GGR (Only on Stake) /
  3.75% (network). "Expected GGR = Total Bets × (1 − RTP)… uses the RTP of the
  game mode each bet was played in." Negative months carry forward as debt on
  Profit Share ("You never pay anything out of pocket"); no debt on
  Guaranteed. Model set per team, changeable (before first game live: immediate;
  after: next month). Payouts monthly on the 1st, ERC-20 USDT/USDC, any amount
  > $0.00.
- Licence contract: 36-month Initial Term + auto-renewing 36-month Renewal
  Terms (3 months' written notice to not renew); Licence Fee 10% of GGR
  aggregated across games, monthly in arrears, USDT; <$1,000 rolls over;
  Negative Rollover (negative GGR carried forward); fee "inclusive of VAT,
  sales taxes… and withholding taxes… shall be the responsibility of the
  Developer"; Developer completes "online registration and identity
  verification process… through the identity documents and information
  submitted"; game "exclusively… offered on the Websites and… not… licenced or
  sold to any third parties which are not MRNV Affiliates" (cl. 4.14), licence
  "exclusive (subject to Clause 4.10)"; MRNV may charge an RGS service fee.
