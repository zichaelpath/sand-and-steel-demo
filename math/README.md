# Math — SAND & STEEL

## Certified constants (DO NOT CHANGE without Dietrich's explicit approval)

Certified math is **v2** (draw-escalation model). The canonical source is
`math/bout.js` (frozen stage tables + `evaluateBout` reference mapping);
the design record is `math/SPEC_V2.md`. Summary (read the files, not this
table, for exact values):

- One bout = one RGS round of up to 3 stages (Trial cost 1.0x, Armed 1.5x).
- Stage tables (Trial, x base bet): S1 narrow 2x / decisive 8x / draw 4%
  (banks 1x) / loss 0x; S2 narrow 4x / decisive 20x / draw 8% (banks 5x) /
  loss 1x; S3 narrow 10x / decisive **1000x** / no draws / loss 5x.
- Armed: identical probabilities, every payout mult x 1.5.
- Theoretical RTP **96.00%** both modes, cross-mode gap 0.00%.

Changing ANY shipped value changes the certified math and requires
re-verification (re-run the simulator) and re-submission before going live.

Run: `python3 math/simulator.py` (default 10M bouts on a shared draw stream
+ approval-band checks; expects `ALL CHECKS PASSED`). The simulator imports
its parameters from the shipped `math/bout.js` (via node, regex fallback)
— it never retypes them.

Note: the docs' approval band is 96.0%–96.7% per mode (see
`docs/rgs-ground-truth.md` §8) — our 96.00% sits exactly on the lower bound,
so there is zero headroom for future tweaks.

## Bout logic

`bout.js` (the RGS `state`/events outcome mapping for Trial vs Armed) arrives
in Phase 1. `simulator.py` stands in for the RGS draw purely to verify the
theoretical RTP, hit rates, and max-win behaviour of that mapping.
