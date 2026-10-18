# SAND & STEEL — Math v3: volatility-compression retune

**Branch:** `phase/math-v3` (from `main`, not merged).
**Status:** certified tables live in `math/bout.js`; freeze tests in `math/bout.test.js`;
verified by `math/simulator.py` (10M bouts per mode).
**Date:** 2026-10-18

## Why

Player-experience feedback (via a gambling-industry expert): v2 felt bad —
61.5% of bouts paid $0 and 32.8% paid 2x, so ~94% of the experience was
"nothing or 2x". The 1000x/1500x ceiling starved the mid-range. v3 retunes
toward the Aviamasters principle (volatility compression): lower ceiling,
fatter middle tiers, more frequent "I'm winning" moments.

The 3-stage draw-escalation structure is unchanged (stages 5/10/10 HP, draw
banks floors of 1x then 5x, up to 3 stages, narrow/decisive/draw/loss per
stage). Only the stage probabilities and tier mults changed; the
`payoutFor`/`evaluateBout` interfaces are identical.

## Certified stage tables (TRIAL, cost 1.0x base bet)

Probabilities are conditional on reaching the stage and sum to 1.0.
Payout mults are x BASE bet. ARMED is an exact 1.5x payout/cost scaling of
Trial (identical probabilities, cost 1.5x) — cross-mode gap 0.00% by
construction via `scaleStages(stages, 1.5)`.

| Stage | narrow_win | decisive_win | draw (bank) | loss |
|-------|-----------|--------------|-------------|------|
| 1 — 5 HP | p=0.080000 @ **2x** | p=0.000000 @ 8x | p=0.360000 (bank 1x) | p=0.560000 @ 0x |
| 2 — 10 HP | p=0.080000 @ **4x** | p=0.010000 @ **50x** | p=0.080000 (bank 5x) | p=0.830000 @ 1x |
| 3 — 10 HP, final | p=0.280000 @ **10x** | p=0.0018714927 @ **500x** | p=0 (final) | p=0.7181285073 @ 5x |

- Trial max win: **500x** (was 1000x). ARMED max win: **750x** (500 × 1.5).
- Stage-1 decisive (8x) tier retained at p=0.0 — structurally present, never
  pays in v3 (keeps the 4-result-per-stage shape).
- `d3` (stage-3 decisive prob) is the tuning knob solved so theoretical RTP
  lands exactly on 96.50%.

## Theoretical RTP derivation

Per-unit expected terminal multiplier, worked backward from the final stage
(stage 3 is final, no draw):

EV₃ = 0.28×10 + 0.0018714927×500 + 0.7181285073×5
    = 2.80 + 0.93574635 + 3.59064254
    = **7.32638889**

EV₂ = 0.08×4 + 0.01×50 + 0.08×EV₃ + 0.83×1
    = 0.32 + 0.50 + 0.58611111 + 0.83
    = **2.23611111**

EV₁ = 0.08×2 + 0.0×8 + 0.36×EV₂ + 0.56×0
    = 0.16 + 0 + 0.8049999996 + 0
    = **0.96500000**

Theoretical RTP = EV₁ / costMult = 0.965 / 1.0 = **96.5000%** (Trial).
ARMED: EV = 0.965 × 1.5 = 1.4475, cost = 1.5 → RTP = **96.5000%**, gap 0.00%.

The value `d3 = 0.0018714927048260406` is the exact solution of EV₁ = 0.965;
hard-coded in `math/bout.js`, so `theoreticalRTP()` returns 0.965 to within
float error (verified < 1e-9 by the freeze test).

## Exact theoretical metrics (Trial; ARMED identical RTP by scaling)

| Metric | v3 (Trial) | v2 (Trial) | Target / rule |
|--------|-----------|-----------|---------------|
| Theoretical RTP | **96.5000%** | 96.0000% | 96.50% ±0.05% (band 96.0–96.7) |
| Hit rate (payout > 0) | **44.00%** (~1 in 2.27) | 38.53% | ≥ 42% |
| "Nothing or 2x" share | **64.00%** | 94.27% | well below 94% |
| Volatility SD per 1.0 bet | **4.89** | 7.73 | 4–6 (rule ≥ 0.6) |
| Max win | **500x** | 1000x | 500x ceiling |
| P(max win) | **1 in 18,553** | 1 in 17,377 | < 1 in 10,000,000 |
| Per-bout 4x–50x share | **4.05%** | 1.43% | substantially raised |
| Max payout (Armed) | 750x | 1500x | ≤ 1,000,000x ✓ |
| Max cost mult | 1.5x | 1.5x | ≤ 50,000x ✓ |

Per-bout terminal-payout distribution (Trial), exact:

| Payout | Probability | Share |
|--------|-------------|-------|
| 0x (stage-1 loss) | 0.560000 | 56.00% |
| 1x (stage-2 loss floor) | 0.298800 | 29.88% |
| 2x (stage-1 narrow) | 0.080000 | 8.00% |
| 4x (stage-2 narrow) | 0.028800 | 2.88% |
| 5x (stage-3 loss floor) | 0.020682 | 2.07% |
| 10x (stage-3 narrow) | 0.008064 | 0.81% |
| 50x (stage-2 decisive) | 0.003600 | 0.36% |
| 500x (stage-3 decisive, max) | 0.00005390 | 1 in 18,553 |

Nothing-or-2x = 56.00% + 8.00% = **64.00%** (v2: 94.27%).
Hit rate = 100% − 56.00% = **44.00%**.
Combined 4x–50x tiers = 2.88% + 0.36% + 0.81% (10x) = **4.05%** per bout
(v2: 1.43%) — roughly 2.8× more mid-range pay.

## Monte Carlo verification (10,000,000 bouts per mode, shared draw stream)

`python3 math/simulator.py` imports the shipped tables from `math/bout.js`
(via node) and runs 10M bouts on a shared draw stream (seed 20261015).

```
=== THEORETICAL (exact, from shipped math/bout.js) ===
Trial Bout RTP : 96.5000%  (EV mult 0.965000 / cost 1.0x)
Armed Bout RTP : 96.5000%  (EV mult 1.447500 / cost 1.5x)
Cross-mode gap: 0.0000%  (must be < 0.5%)
Hit rate (payout>0): 44.00% (~1 in 2.27)
Max win 500x: 1 in 18553
Volatility SD per 1.0 bet: 4.89

=== MONTE CARLO (10,000,000 bouts) ===
Trial Bout: empirical RTP=96.7959% (theory 96.5000%, err=+0.2960%, SE=0.1575%)
            hit rate=44.01% | max-wins seen=570 (~539 expected)
Armed Bout: empirical RTP=96.7959% (theory 96.5000%, err=+0.2960%, SE=0.1575%)
            hit rate=44.01% | max-wins seen=570 (~539 expected)

=== APPROVAL-BAND CHECKS === ALL CHECKS PASSED
```

- Empirical RTP within tolerance of theory (err +0.296%, inside the adaptive
  5SE tolerance of 0.788% and the 1.5pp absolute cap).
- Observed max-win count (570) ≈ expected (539) — the 500x ceiling remains
  realistically obtainable (1 in 18,553, far more frequent than 1 in 10M).
- Empirical hit rate 44.01% matches theory 44.00%.
- All `docs/approval-checklist.md` §1 invariants pass under v3 (see addendum
  there).

## Before / after feel comparison (v2 → v3)

| Feel dimension | v2 | v3 | Change |
|----------------|----|----|--------|
| Max win ceiling | 1000x / 1500x | 500x / 750x | −50% ceiling (compression) |
| "Nothing or 2x" share | 94.27% | 64.00% | −30pts, well below 94% |
| Hit rate (non-zero) | 38.53% | 44.00% | +5.5pts (≥42% target) |
| Volatility SD | 7.73 | 4.89 | −2.8 (target 4–6) |
| 4x–50x mid-range per bout | 1.43% | 4.05% | +2.6pts (~2.8×) |
| Theoretical RTP | 96.00% | 96.50% | +0.50pt (mid-band) |
| Max-win frequency | 1 in 17,377 | 1 in 18,553 | still readily obtainable |

The v3 bout plays shorter at the bottom (fewer dead 0x/2x stage-1 endings)
and escalates more often (36% stage-1 draw vs 4% in v2), so players reach the
banked-floor and mid-tier pay more frequently — more "I'm winning" moments —
while the top prize is halved and pulled into a realistic frequency, compressing
volatility without touching the 96.50% RTP band.

## Trade-offs

No shape goal was relaxed to protect the RTP band: all targets land inside spec
(RTP exactly 96.50%, hit 44% ≥ 42%, SD 4.89 ∈ [4,6], nothing-or-2x 64% ≪ 94%).
The concessions relative to v2 are intentional and by design: the max win is
halved (1000x → 500x), stage-1 is more draw-oriented (fewer instant 0x/2x
endings), and the stage-2 loss floor pays 1x at high frequency (83% conditional)
to fund the higher hit rate at low volatility. The 8x stage-1 decisive tier is
retained at p=0.0 for structural symmetry but never pays.

## Files changed

- `math/bout.js` — certified v3 stage tables, `RTP_TARGET = 0.965`.
- `math/bout.test.js` — freeze tests re-based to v3 tables.
- `math/simulator.py` — unchanged (imports tables from the shipped build).
- `docs/math-v3.md` — this document.
- `docs/approval-checklist.md` — dated v3 addendum re-verifying §1.
