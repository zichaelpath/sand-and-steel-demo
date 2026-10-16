# SAND & STEEL — Developer-Account Application Packet (DRAFT)

> The human submits this. Draft prepared Phase 0 from the live Engine docs
> (see `docs/rgs-ground-truth.md`). All commercial figures below are quoted
> from https://studio.engine.io/docs/payments, /docs/distribution, and the
> Game Licence Terms and Conditions
> (https://studio.engine.io/api/contracts/019fb259-948a-7365-9150-b1348e35d164,
> counterparty Medium Rare N.V.).

## 1. Project one-pager

**SAND & STEEL** — gladiator-arena bout versus the house champion. The player
picks a fighter, the bout resolves as a single stateless RGS round, and the
frontend plays the result back as an arena fight. No persistence between
rounds; RGS deals from published certified math; no jackpots, gamble, or
early-cashout features (all prohibited by the approval guidelines).

Two bet modes (one RNG event per bout):

| Mode | Stake | P(win) | Pays | Theoretical RTP |
|---|---|---|---|---|
| Trial Bout | 1.0× base bet | 48% | 2× | 96.00% |
| Armed Bout | 1.5× base bet | 36% | 4× | 96.00% |

Math: `0.48×2.0/1.0 = 0.36×4.0/1.5 = 0.96` exactly; cross-mode gap 0.00%.
RTP sits exactly on the lower bound of the docs' mandatory 96.0%–96.7% band —
compliant with zero headroom (flagged in `docs/rgs-ground-truth.md` §8).

## 2. Math summary

- Stateless single-event mapping per mode; full Monte Carlo verification in
  `math/simulator.py` (10M rounds/mode + approval-band checks + session
  variance; expects `ALL CHECKS PASSED`).
- Hit rates 48% / 36% — far more frequent than the docs' 1-in-10M max-win
  achievability bar and the 1-in-50 non-zero-win guideline.
- Max wins 2× / 4× — far below the 1,000,000× cap; cost multiplier 1.5×, far
  below the 50,000× cap; base mode is 1.0× cost as required.
- Phase 1 delivers `bout.js` (RGS `state`/events outcome mapping); math publish
  files (books, lookup tables, index) will follow the Math SDK file format.

## 3. Asset provenance summary (all human-made, no AI assets)

| Asset | Source | Cost / Licence |
|---|---|---|
| Gladiator fighters | ROMA 470 Gladiators v0.3.0 (Crom170, itch.io) | $1, proprietary royalty-free commercial; credit appreciated |
| Music | Fablefly Music — THE BEAT OF BATTLE | $1, royalty-free commercial; credit "Fablefly Music" |
| UI, sword/woosh SFX, UI SFX | Kenney (UI Pack, Fantasy UI Borders, Foley, Interface Sounds) | CC0 public domain, no attribution needed |
| Crowd ambience SFX | Pixabay (Dragon Studio, roesisch, UNIVERSFIELD) | Pixabay Content License, free commercial use, no attribution; ships inside the game only |

No AI-generated assets anywhere in the project. Note for review: final game
must use unique audio/visual assets — web-sdk sample assets will not be
approved (frontend-communication guideline); our assets above are all
third-party licensed, not web-sdk samples. Crowd swells play on bout start
and on WIN only, never on loss.

## 4. Applicant identity-documents checklist (human to complete)

The licence agreement defines the Developer as whoever "completed MRNV's
online registration and identity verification process… through the identity
documents and information submitted," and licence fees are only payable once
"the Developer submitting all applicable identification and verification
documents requested by MRNV" (cl. 8.1b). Before submitting, the human must:

- [ ] Complete Studio team registration (team + first game submit flow).
- [ ] Submit government photo ID for identity verification (as requested by MRNV).
- [ ] Submit proof of address, if requested.
- [ ] If registering as a company: incorporation documents + authorised
      representative ID, as requested.
- [ ] Set team payment model (see §5a) and add the ERC-20 payout wallet
      (USDT/USDC) on the team's Wallet page; replacement wallets are held
      3 days.
- [ ] Tick-accept the Game Licence Terms and Conditions (Effective Date).

## 5. Commercial decisions — ALL UNDECIDED (human decides, do not submit as-is)

### (a) UNDECIDED — Payment model: 10% of actual GGR vs 7.5% guaranteed

- **Profit Share:** 10% of *actual* GGR (Only on Stake; 5% per operator on the
  network). Higher upside, more variance; negative months become carry-forward
  debt (never out of pocket); no payout until debt clears.
- **Guaranteed:** 7.5% of *expected* GGR = Total Bets × (1 − RTP) per mode
  (Only on Stake; 3.75% network). Stable, no debt; lower upside; docs
  "recommended for teams getting started."
- Model is per team (all games), changeable anytime; before first game is live
  the change is immediate, after that it applies from the next month.
  Licence contract baseline is 10% of aggregated GGR with Negative Rollover
  and a $1,000 monthly payout threshold. Distribution choice (Only on Stake vs
  network) is separate and fixed at launch.

### (b) UNDECIDED — 36-month exclusivity acknowledgement

- Licence Term: 36 months Initial Term, auto-renewing in 36-month Renewal
  Terms unless either party gives ≥ 3 months' written notice.
- Licence is "exclusive (subject to Clause 4.10)"; the game "will exclusively
  be offered on the Websites and will not be licenced or sold to any third
  parties which are not MRNV Affiliates" (cl. 4.14). MRNV may rename the game
  and owns any name it chooses (cl. 4.5–4.6).
- Human to confirm acceptance of the lock-in, the auto-renewal notice burden,
  and the exclusivity scope before ticking.

### (c) UNDECIDED — Tax responsibility acknowledgement

- "The Licence Fee is inclusive of Value Added Tax (VAT), sales taxes, and
  other duties, fees, excises or tariffs and withholding taxes, where
  applicable. Such… charges… shall be the responsibility of the Developer."
- Human (and human's accountant) to confirm who bears VAT/sales/withholding
  obligations in the Developer's jurisdiction before accepting.
