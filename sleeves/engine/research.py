"""Research sandbox for agents (stage 4). IN-SAMPLE ONLY: the holdout is cut off here.

Usage (from the sleeves/ directory):
    python -m engine.research --sleeve equity               # all strategies in the sleeve
    python -m engine.research --sleeve equity --only sector_momentum
Every run of every variant is logged to the sleeve registry, which validation
later uses to deflate Sharpe ratios for the number of trials.
"""
from __future__ import annotations

import argparse

from .config import SLEEVES, GATES
from .core import load_strategies, backtest, stats, holdout_cutoff, log_trial, periods_per_year
from .data import load_sleeve


def run(sleeve: str, only: str | None = None, variants: bool = True) -> list[dict]:
    regs = {k: s for k, s in load_strategies().items() if s.sleeve == sleeve}
    if only:
        regs = {k: s for k, s in regs.items() if s.name == only}
    prices = load_sleeve(sleeve)
    cut = holdout_cutoff(prices.index)
    ins = prices[prices.index < cut]                     # holdout never leaves this file
    out = []
    for key, strat in regs.items():
        vs = strat.variants() if variants else [strat.params]
        best = None
        for p in vs:
            try:
                bt = backtest(strat.weights(ins, **p), ins, sleeve)
                st = stats(bt.returns, sleeve)
            except Exception as e:  # noqa: BLE001
                print(f"  {strat.name} {p}: ERROR {e}")
                continue
            log_trial(sleeve, strat.name, p, st, "research")
            if best is None or st["sharpe"] > best[1]["sharpe"]:
                best = (p, st)
        base = backtest(strat.weights(ins), ins, sleeve)
        bst = stats(base.returns, sleeve)
        ok = bst["sharpe"] >= GATES["backtest_min_sharpe"] and bst["max_dd"] > -2.5 * SLEEVES[sleeve]["max_dd"]
        print(f"{strat.name:32s} default Sharpe {bst['sharpe']:5.2f}  CAGR {bst['cagr']:6.1%}  "
              f"DD {bst['max_dd']:6.1%}  turnover/yr {base.turnover.mean()*periods_per_year(sleeve):5.1f}  "
              f"variants {len(vs):3d}  best-variant Sharpe {best[1]['sharpe'] if best else float('nan'):5.2f}  "
              f"{'PASS' if ok else 'fail'}")
        out.append({"strategy": strat.name, "default": bst, "pass": ok})
    print(f"(in-sample ends {cut.date()}; holdout locked)")
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sleeve", required=True, choices=list(SLEEVES))
    ap.add_argument("--only")
    ap.add_argument("--no-variants", action="store_true")
    a = ap.parse_args()
    run(a.sleeve, a.only, not a.no_variants)
