# Phase 1 progress (one line per milestone)

- P02 DONE 2026-10-16: math/bout.js (certified TRIAL/ARMED/RTP_TARGET, evaluateOutcome, payoutFor; node --test 17/17 incl. exact-RTP + freeze tests) + client/debug.html single-draw/batch scene through evaluateOutcome.
- P03 DONE 2026-10-16: stateless RGS integration (client/rgs-client.js direct fetch per ground truth — no stake-engine dep; one play {amount, sessionID, mode}, balance from RGS only, resolveInFlightRound resume, node --test 15/15) + headless UI harness (trial win/loss, recovery) green.
- P04 DONE 2026-10-16: Armed entry accounting (totalCost = baseBet x live 1.5x costMultiplier, explicit "Armed Bout — costs 1.50 on a 1.00 bet — pays 4x on win" two-step confirm, RGS debits full stake via amount x multiplier; harness: pre-confirm balance untouched, $100-1.50+4=$102.50).
- P05 DONE 2026-10-16: bet levels & currencies from authenticate config (stake selector from betLevels/default $1.00, min/max/step validation, display-currency switch formats only — integer stake untouched; harness prefs/currency scenario green). Testable scenes: debug.html batch + index.html?stub=1 (all pages HTTP 200, 32/32 unit tests).
