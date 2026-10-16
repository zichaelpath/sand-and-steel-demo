# SAND & STEEL — Math Spec v2 (draw-escalation model)

Adopted 2026-10-15 on expert review (gambling-games domain expert via the user).
Supersedes the v1 binary win/loss model. Rationale: v1's 4x max win is
commercially weak; players expect a large max win (1,000x minimum) and a
mechanic with escalation drama.

## Model

One bout = one RGS round (stateless), fought in up to **3 stages**.
HP flavor (presentation): stage 1 = 5 HP each, stages 2-3 = 10 HP each.
A stage ends in one of four results:

- **narrow_win** — winner ends with 1-2 HP left.
- **decisive_win** — winner ends with 3+ HP left.
- **draw** — both fighters at 1 HP. Fighters get new weapons, return at full
  HP for the next stage. The draw **banks a guaranteed floor**:
  1x after the stage-1 draw, 5x after the stage-2 draw.
- **loss** — pays the banked floor (0x if no prior draw).

Stage 3 is final (no draws). Max 3 stages per bout (anti-boredom cap).

## Certified stage tables (TRIAL, cost 1.0x base bet)

Probabilities are CONDITIONAL on reaching the stage and sum to 1.0.
Payout mults are x BASE bet.

| Stage | narrow_win | decisive_win | draw | loss |
|-------|-----------|--------------|------|------|
| 1 | p=0.3280284192 @ 2x | p=0.0172646536 @ 8x | p=0.04 (bank 1x) | p=0.6147069272 @ 0x |
| 2 | p=0.3143605684 @ 4x | p=0.0165452931 @ 20x | p=0.08 (bank 5x) | p=0.5890941385 @ 1x |
| 3 | p=0.3416962700 @ 10x | p=0.0179840142 @ 1000x | p=0 (final) | p=0.6403197158 @ 5x |

## ARMED (cost 1.5x base bet)

Identical stage probabilities; every payout mult x 1.5
(stage 1: 3x/12x, stage 2: 6x/30x, stage 3: 15x/1500x; floors 1.5x/7.5x).
RTP is therefore identical to TRIAL by construction (cross-mode gap 0.00%).

## Verified properties (Trial; Armed identical by scaling)

- Theoretical RTP: **96.0000%** (band 96.0-96.7%; zero headroom, as before)
- Hit rate (payout > 0): **38.53%** (rule: no rarer than 1 in 50)
- P(max win 1000x): **1 in 17,377** (rule: more frequent than 1 in 10M)
- Volatility (SD per 1.0 bet): **~7.7** (rule: >= 0.6 for 1.0x modes)
- Max payout 1000x <= 1,000,000x cap; max cost mult 1.5x <= 50,000x cap
- Monte Carlo (3M rounds, seed 42): 96.32% (within noise for a 1000x game;
  183 max-wins seen vs ~173 expected)

## RGS mapping

One `/wallet/play` round resolves ALL stages. The RGS draws one [0,1) value
per stage reached (up to 3) and returns the terminal outcome plus the stage
breakdown in the round `state` array (for choreography + bet replay).
`math/bout.js` `evaluateBout(draws, mode)` is the certified reference mapping.
The client NEVER draws locally for real rounds.

## Presentation notes (for choreography)

- Outcome-first per stage: choreography is chosen AFTER the stage result is
  known and always resolves to it. No near-miss engineering, ever.
- Draw sequence: "DRAW — both fighters down to 1 HP! New weapons, round 2."
- Turbo mode (polish phase): shortens/skips stage cinematics.
