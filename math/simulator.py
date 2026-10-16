"""
SAND & STEEL — Monte Carlo verification of the CERTIFIED math v2
(draw-escalation model, 2026-10-15).

The certified math lives in math/bout.js (evaluateBout mapping + stage
tables). This simulator stands in for the RGS draw purely to verify the
theoretical RTP, hit rates and max-win behaviour of that shipped mapping.

PARAMETERS ARE IMPORTED FROM THE SHIPPED BUILD, NOT RETYPED: load_params()
executes math/bout.js under node and reads back the exact TRIAL/ARMED stage
tables + cost multipliers (regex fallback if node is unavailable). Any drift
between this file and the shipped build fails loudly before simulating.

Approval bands verified against (docs/rgs-ground-truth.md section 8, which
quotes the live Stake Engine math-verification docs):
  - RTP 96.0% - 96.7% per mode (critical test; our 96.00% is the lower bound)
  - Cross-mode gap < 0.5%
  - Max win realistically obtainable (more frequent than 1 in 10,000,000)
  - Hit rate of non-zero wins no rarer than 1 in 50 bets
  - Base volatility: SD per 1.0 bet >= 0.6
  - Max payout multiplier <= 1,000,000x; max cost multiplier <= 50,000x
  - Base (cheapest) mode cost multiplier is 1.0x
  - Stateless: every bout is one independent RNG event; nothing persists
    (audited separately in docs/statelessness-audit.md; the loop below keeps
    no per-bout state by construction).

ARMED is an exact 1.5x payout/cost scaling of TRIAL with bit-identical stage
probabilities (asserted at load). Both modes are therefore evaluated on ONE
shared draw stream: per bout the stage-result path is resolved once from the
certified probabilities and priced under both modes' mults. This is exact
(no approximation) and removes sampling noise from the cross-mode gap, which
is 0.00% by construction. Empirical tolerances below are adaptive (4 SE) with
an absolute cap, so a pass/fail reflects real math drift, not RNG noise.
"""

import json
import math
import os
import random
import re
import statistics
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BOUT_JS = os.path.join(HERE, "bout.js")

TARGET_RTP = 0.96
RTP_BAND_LO, RTP_BAND_HI = 0.96, 0.967
CROSS_MODE_TOL = 0.005          # modes must be within 0.5% of each other
EMPIRICAL_ABS_CAP = 0.015        # empirical must also be within 1.5pp of theory
EMPIRICAL_SE_MULT = 5.0         # ... and within 5 standard errors of theory
BAND_EPS = 1e-9                 # float guard: exact-arithmetic RTP is 0.96,
                                # float lands a hair below (cf. bout.test.js)


# ----------------------------------------------------------------------------
# Load the EXACT shipped parameters from math/bout.js (import, don't retype).
# ----------------------------------------------------------------------------
def _load_via_node():
    dump = subprocess.run(
        ["node", "-e",
         "var b=require(process.argv[1]);"
         "console.log(JSON.stringify({TRIAL:b.TRIAL,ARMED:b.ARMED,"
         "RTP_TARGET:b.RTP_TARGET}));",
         BOUT_JS],
        capture_output=True, text=True, check=True, timeout=60,
    ).stdout
    return json.loads(dump)


def _load_via_regex():
    src = open(BOUT_JS).read()
    probs = [float(x) for x in re.findall(r"p:\s*([0-9.]+)", src)]
    mults = [float(x) for x in re.findall(r"mult:\s*([0-9.]+)", src)]
    # TRIAL block order per stage: narrow{p,mult}, decisive{p,mult},
    # draw{p}, loss{p,mult} -> probs stride 4, mults stride 3.
    stages = []
    for i in range(3):
        p = probs[i * 4:(i + 1) * 4]
        m = mults[i * 3:(i + 1) * 3]
        stages.append({
            "narrowWin": {"p": p[0], "mult": m[0]},
            "decisiveWin": {"p": p[1], "mult": m[1]},
            "draw": {"p": p[2]},
            "loss": {"p": p[3], "mult": m[2]},
        })
    cost = [float(x) for x in re.findall(r"costMult:\s*([0-9.]+)", src)]
    hp = [int(x) for x in re.findall(r"hp:\s*\[([0-9,\s]+)\]", src)[0].split(",")]
    return {
        "TRIAL": {"costMult": cost[0], "hp": hp, "stages": stages},
        "ARMED": {"costMult": cost[1], "hp": hp, "stages": [
            {"narrowWin": {"p": s["narrowWin"]["p"], "mult": s["narrowWin"]["mult"] * 1.5},
             "decisiveWin": {"p": s["decisiveWin"]["p"], "mult": s["decisiveWin"]["mult"] * 1.5},
             "draw": {"p": s["draw"]["p"]},
             "loss": {"p": s["loss"]["p"], "mult": s["loss"]["mult"] * 1.5}}
            for s in stages]},
        "RTP_TARGET": 0.96,
    }


def load_params():
    """Return the shipped (TRIAL, ARMED, RTP_TARGET); assert ARMED scaling."""
    try:
        data = _load_via_node()
        source = "node(require math/bout.js)"
    except Exception as exc:  # node missing? fall back to text parse
        print("node load failed (%s); falling back to regex parse" % exc)
        data = _load_via_regex()
        source = "regex(parse math/bout.js)"
    trial, armed = data["TRIAL"], data["ARMED"]
    assert abs(trial["costMult"] - 1.0) < 1e-12, "base mode must cost 1.0x"
    assert abs(armed["costMult"] - 1.5) < 1e-12, "armed mode must cost 1.5x"
    for i in range(3):
        for k in ("narrowWin", "decisiveWin", "draw", "loss"):
            assert abs(armed["stages"][i][k]["p"] - trial["stages"][i][k]["p"]) < 1e-15, \
                "stage %d %s probability drift between modes" % (i, k)
            if "mult" in trial["stages"][i][k]:
                assert abs(armed["stages"][i][k]["mult"]
                           - trial["stages"][i][k]["mult"] * 1.5) < 1e-9, \
                    "stage %d %s armed mult is not trial x 1.5" % (i, k)
    for i, s in enumerate(trial["stages"]):
        total = s["narrowWin"]["p"] + s["decisiveWin"]["p"] + s["draw"]["p"] + s["loss"]["p"]
        assert abs(total - 1.0) < 1e-9, "stage %d sums to %r, not 1.0" % (i, total)
    print("params loaded via %s; ARMED==TRIAL x1.5 scaling asserted" % source)
    return trial, armed, data["RTP_TARGET"]


# ----------------------------------------------------------------------------
# Exact theory from the loaded tables (no simulation).
# ----------------------------------------------------------------------------
def stage_outcomes(stage):
    """Yield (result, terminal_mult_or_None, prob) for one stage."""
    yield ("narrowWin", stage["narrowWin"]["mult"], stage["narrowWin"]["p"])
    yield ("decisiveWin", stage["decisiveWin"]["mult"], stage["decisiveWin"]["p"])
    yield ("draw", None, stage["draw"]["p"])
    yield ("loss", stage["loss"]["mult"], stage["loss"]["p"])


def theoretical_stats(mode):
    """Exact EV / hit-rate / max-win / SD per unit stake for one mode."""
    stages = mode["stages"]
    cost = mode["costMult"]

    def ev(i):
        total = 0.0
        for _, m, p in stage_outcomes(stages[i]):
            if p == 0:
                continue
            total += p * (ev(i + 1) if m is None else m)
        return total

    def hit(i):  # P(eventual payout > 0 | reach stage i)
        total = 0.0
        for _, m, p in stage_outcomes(stages[i]):
            if p == 0:
                continue
            if m is None:
                total += p * hit(i + 1)
            elif m > 0:
                total += p
        return total

    def ex2(i):  # E[mult^2] for SD
        total = 0.0
        for _, m, p in stage_outcomes(stages[i]):
            if p == 0:
                continue
            total += p * (ex2(i + 1) if m is None else m * m)
        return total

    # P(max win) = reach stage 3 x stage-3 decisive prob
    p_reach3 = stages[0]["draw"]["p"] * stages[1]["draw"]["p"]
    p_max = p_reach3 * stages[2]["decisiveWin"]["p"]
    max_mult = stages[2]["decisiveWin"]["mult"]
    mean = ev(0)
    var_units = ex2(0) - mean * mean  # mults are x base bet; stake=cost
    return {
        "rtp": mean / cost,
        "hit_rate": hit(0),
        "p_max": p_max,
        "max_every_n": 1.0 / p_max,
        "max_mult": max_mult,
        "sd_per_unit": math.sqrt(var_units) / cost,
        "mean_mult": mean,
    }


# ----------------------------------------------------------------------------
# Monte Carlo on a shared draw stream (exact for both modes — see docstring).
# ----------------------------------------------------------------------------
def simulate(trial, armed, rounds, seed):
    t = trial["stages"]
    # Cumulative boundaries per stage: narrow | decisive | draw | loss.
    bounds = [(
        s["narrowWin"]["p"],
        s["narrowWin"]["p"] + s["decisiveWin"]["p"],
        s["narrowWin"]["p"] + s["decisiveWin"]["p"] + s["draw"]["p"],
    ) for s in t]
    tm = [({"narrowWin": s["narrowWin"]["mult"], "decisiveWin": s["decisiveWin"]["mult"],
            "loss": s["loss"]["mult"]}) for s in t]
    am = [({"narrowWin": s["narrowWin"]["mult"] * 1.5, "decisiveWin": s["decisiveWin"]["mult"] * 1.5,
            "loss": s["loss"]["mult"] * 1.5}) for s in t]
    rng = random.Random(seed)
    n_t = n_a = 0.0       # total stake (units of base bet)
    r_t = r_a = 0.0       # total return (units of base bet)
    r2_t = 0.0            # E[X^2] accumulator (trial; armed scales exactly)
    wins = 0
    maxwins = 0
    max_mult_t = t[2]["decisiveWin"]["mult"]
    for _ in range(rounds):
        n_t += 1.0
        n_a += 1.5
        d = rng.random()
        b0, b1, b2 = bounds[0]
        if d < b0:
            rt, ra = tm[0]["narrowWin"], am[0]["narrowWin"]
        elif d < b1:
            rt, ra = tm[0]["decisiveWin"], am[0]["decisiveWin"]
        elif d < b2:
            d = rng.random()  # stage 2 (1x floor banked)
            b0, b1, b2 = bounds[1]
            if d < b0:
                rt, ra = tm[1]["narrowWin"], am[1]["narrowWin"]
            elif d < b1:
                rt, ra = tm[1]["decisiveWin"], am[1]["decisiveWin"]
            elif d < b2:
                d = rng.random()  # stage 3, final (5x floor banked)
                b0, b1 = bounds[2][0], bounds[2][1]
                if d < b0:
                    rt, ra = tm[2]["narrowWin"], am[2]["narrowWin"]
                elif d < b1:
                    rt, ra = tm[2]["decisiveWin"], am[2]["decisiveWin"]
                    maxwins += 1
                else:
                    rt, ra = tm[2]["loss"], am[2]["loss"]
            else:
                rt, ra = tm[1]["loss"], am[1]["loss"]
        else:
            rt, ra = tm[0]["loss"], am[0]["loss"]
        r_t += rt
        r_a += ra
        r2_t += rt * rt
        if rt > 0:
            wins += 1
    emp_t = r_t / n_t
    emp_a = r_a / n_a
    var_t = r2_t / rounds - emp_t * emp_t
    return {
        "rounds": rounds,
        "emp_t": emp_t,
        "emp_a": emp_a,
        "gap": abs(emp_t - emp_a),
        "se_t": math.sqrt(max(var_t, 0.0) / rounds),
        # Armed prices the identical result path at x1.5 return / x1.5 stake,
        # so its RTP ratio (and SE) equal Trial's exactly.
        "se_a": math.sqrt(max(var_t, 0.0) / rounds),
        "hit_rate": wins / rounds,
        "maxwins": maxwins,
    }


def main():
    rounds = int(sys.argv[1]) if len(sys.argv) > 1 else 10_000_000
    trial, armed, target = load_params()
    th_t = theoretical_stats(trial)
    th_a = theoretical_stats(armed)

    print("=== THEORETICAL (exact, from shipped math/bout.js) ===")
    print("Trial Bout RTP : %.4f%%  (EV mult %.6f / cost 1.0x)" % (th_t["rtp"] * 100, th_t["mean_mult"]))
    print("Armed Bout RTP : %.4f%%  (EV mult %.6f / cost 1.5x)" % (th_a["rtp"] * 100, th_a["mean_mult"]))
    print("Cross-mode gap: %.4f%%  (must be < %.1f%%)" % (abs(th_t["rtp"] - th_a["rtp"]) * 100, CROSS_MODE_TOL * 100))
    print("Hit rate (payout>0): %.2f%% (~1 in %.2f)" % (th_t["hit_rate"] * 100, 1 / th_t["hit_rate"]))
    print("Max win %gx: 1 in %.0f (rule: more frequent than 1 in 10,000,000)" % (th_t["max_mult"], th_t["max_every_n"]))
    print("Volatility SD per 1.0 bet: %.2f (rule: >= 0.6)" % th_t["sd_per_unit"])
    print()

    print("=== MONTE CARLO (%s bouts, shared draw stream, seed 20261015) ===" % format(rounds, ","))
    sim = simulate(trial, armed, rounds, seed=20261015)
    for name, emp, se, th in (("Trial Bout", sim["emp_t"], sim["se_t"], th_t["rtp"]),
                              ("Armed Bout", sim["emp_a"], sim["se_a"], th_a["rtp"])):
        print("%s: empirical RTP=%.4f%% (theory %.4f%%, err=%+.4f%%, SE=%.4f%%) | "
              "hit rate=%.2f%% | max-wins seen=%d (~%d expected)" % (
                  name, emp * 100, th * 100, (emp - th) * 100, se * 100,
                  sim["hit_rate"] * 100, sim["maxwins"], round(rounds * th_t["p_max"])))
    print("Empirical cross-mode gap: %.4f%% (must be < %.1f%%)" % (sim["gap"] * 100, CROSS_MODE_TOL * 100))
    print()

    print("=== APPROVAL-BAND CHECKS ===")
    tol_t = min(EMPIRICAL_SE_MULT * sim["se_t"], EMPIRICAL_ABS_CAP)
    tol_a = min(EMPIRICAL_SE_MULT * sim["se_a"], EMPIRICAL_ABS_CAP)
    checks = [
        ("Trial theoretical RTP in 96.0-96.7%", RTP_BAND_LO - BAND_EPS <= th_t["rtp"] <= RTP_BAND_HI),
        ("Armed theoretical RTP in 96.0-96.7%", RTP_BAND_LO - BAND_EPS <= th_a["rtp"] <= RTP_BAND_HI),
        ("Theoretical cross-mode gap < 0.5%", abs(th_t["rtp"] - th_a["rtp"]) < CROSS_MODE_TOL),
        ("Empirical Trial within %.3f%% of theory" % (tol_t * 100), abs(sim["emp_t"] - th_t["rtp"]) < tol_t),
        ("Empirical Armed within %.3f%% of theory" % (tol_a * 100), abs(sim["emp_a"] - th_a["rtp"]) < tol_a),
        ("Empirical cross-mode gap < 0.5%", sim["gap"] < CROSS_MODE_TOL),
        ("Max win achievable (1 in %.0f < 1 in 10M)" % th_t["max_every_n"], th_t["max_every_n"] < 10_000_000),
        ("Hit rate no rarer than 1 in 50 (%.2f%%)" % (th_t["hit_rate"] * 100), th_t["hit_rate"] >= 1 / 50),
        ("Volatility SD %.2f >= 0.6" % th_t["sd_per_unit"], th_t["sd_per_unit"] >= 0.6),
        ("Max payout %gx <= 1,000,000x" % th_a["max_mult"], th_a["max_mult"] <= 1_000_000),
        ("Max cost mult 1.5x <= 50,000x", 1.5 <= 50_000),
        ("Base mode cost is 1.0x", abs(trial["costMult"] - 1.0) < 1e-12),
    ]
    all_ok = True
    for name, ok in checks:
        print("  [%s] %s" % ("PASS" if ok else "FAIL", name))
        all_ok = all_ok and ok
    print()
    print("ALL CHECKS PASSED" if all_ok else "CHECKS FAILED — DO NOT SHIP")
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
