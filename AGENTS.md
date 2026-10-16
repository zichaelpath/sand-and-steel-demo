# AGENTS.md — SAND & STEEL worker brief

You are working on SAND & STEEL, a gladiator-arena casino game for Stake Engine.
Full game design doc + 27-prompt build plan:
https://docs.google.com/document/d/1CSuOMR9hYAkQpXnBABWQgeccTulkB6v3jgjTg6Nhv9U/edit

## Standing rules (non-negotiable)
1. The official Stake Engine SDK/RGS docs are ground truth. If this repo or the
   GDD disagrees with them, the docs win. Never invent API shapes or endpoints.
2. The math constants in math/ are CERTIFIED. Do not change any of them without
   Dietrich's explicit approval. Changing them requires re-running the simulator
   and re-submission of the game.
3. Every task ends with a TESTABLE SCENE: run the thing, interact with it,
   screenshot or describe the observed behavior. A headless-only test never
   counts as done.
4. Git: one branch per phase (phase-0, phase-1, ...). Commit often with clear
   messages. Never force-push main. Dietrich reviews every diff before merge.
5. No destructive system commands (no rm -rf outside the repo, no sudo package
   changes without asking). No exfiltration of keys or credentials anywhere.

## Useful references
- math/simulator.py — Monte Carlo verification of the certified RTP (96.00%
  both modes). Re-run after any math-adjacent change.
- The GDD's Part 2 is the prompt library: work prompts in order, one at a
  time, unless Dietrich says otherwise.
