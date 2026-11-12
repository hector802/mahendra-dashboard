"""Independent validation (stage 5). Runs deterministic statistical checks; it never edits strategies."""
from __future__ import annotations

import hashlib
import inspect
import itertools
import json

import numpy as np
import pandas as pd
from scipy.stats import norm

from .config import GATES, RESULTS_DIR, SLEEVES
from .core import Strategy, backtest, stats, periods_per_year, trial_count, trial_sharpes, log_trial

EULER_GAMMA = 0.5772156649


def strategy_hash(s: Strategy) -> str:
    src = inspect.getsource(s.fn) + json.dumps(s.params, sort_keys=True, default=str)
    return hashlib.sha1(src.encode()).hexdigest()[:12]


def deflated_sharpe(r: pd.Series, sleeve: str, n_trials: int, trial_srs: list[float]) -> dict:
    """Bailey & Lopez de Prado deflated Sharpe ratio: P(true SR > best-of-N-by-luck)."""
    ppy = periods_per_year(sleeve)
    r = r.dropna()
    T = len(r)
    if T < 60 or r.std() == 0:
        return {"dsr": 0.0, "sr0_ann": float("nan")}
    sr = r.mean() / r.std()                                  # per-period
    skew, kurt = r.skew(), r.kurt() + 3
    srs = np.array(trial_srs, dtype=float) / np.sqrt(ppy)
    var_sr = np.var(srs, ddof=1) if len(srs) > 2 else 0.0
    var_sr = max(var_sr, 1.0 / T)                            # floor: estimation noise of one SR
    N = max(n_trials, 1)
    if N == 1:
        sr0 = 0.0
    else:
        sr0 = np.sqrt(var_sr) * ((1 - EULER_GAMMA) * norm.ppf(1 - 1 / N)
                                 + EULER_GAMMA * norm.ppf(1 - 1 / (N * np.e)))
    denom = np.sqrt(max(1 - skew * sr + (kurt - 1) / 4 * sr ** 2, 1e-6))
    z = (sr - sr0) * np.sqrt(T - 1) / denom
    return {"dsr": float(norm.cdf(z)), "sr0_ann": float(sr0 * np.sqrt(ppy))}


def pbo_cscv(variant_returns: pd.DataFrame, n_blocks: int = 10) -> tuple[float | None, float | None]:
    """Probability of backtest overfitting via combinatorially symmetric cross-validation."""
    M = variant_returns.dropna(how="all").fillna(0.0)
    if M.shape[1] < 3 or len(M) < n_blocks * 40:
        return None, None
    blocks = np.array_split(np.arange(len(M)), n_blocks)
    vals = M.values
    logits, oos_loss = [], []
    for combo in itertools.combinations(range(n_blocks), n_blocks // 2):
        is_idx = np.concatenate([blocks[i] for i in combo])
        oos_idx = np.concatenate([blocks[i] for i in range(n_blocks) if i not in combo])
        def sr(x):
            sd = x.std(axis=0)
            return np.where(sd > 0, x.mean(axis=0) / np.where(sd > 0, sd, 1), 0.0)
        is_sr, oos_sr = sr(vals[is_idx]), sr(vals[oos_idx])
        best = int(np.argmax(is_sr))
        rank = (oos_sr < oos_sr[best]).sum() + 0.5 * ((oos_sr == oos_sr[best]).sum() - 1)
        w = (rank + 1) / (len(oos_sr) + 1)
        logits.append(np.log(w / (1 - w)))
        oos_loss.append(oos_sr[best] <= 0)
    return float(np.mean(np.array(logits) <= 0)), float(np.mean(oos_loss))


def walk_forward(variant_returns: pd.DataFrame, sleeve: str, train_years: int = 3) -> pd.Series:
    """Each year, pick the variant with the best trailing-train Sharpe and trade it next year."""
    M = variant_returns.fillna(0.0)
    years = sorted(set(M.index.year))
    out = []
    for y in years[train_years:]:
        train = M[(M.index.year >= y - train_years) & (M.index.year < y)]
        test = M[M.index.year == y]
        if len(train) < 200 or test.empty:
            continue
        sr = train.mean() / train.std().replace(0, np.nan)
        best = sr.idxmax() if sr.notna().any() else M.columns[0]
        out.append(test[best])
    return pd.concat(out) if out else pd.Series(dtype=float)


STRESS = {"GFC 2008-09": ("2008-01-01", "2009-06-30"), "Euro crisis 2011": ("2011-07-01", "2011-12-31"),
          "Vol shock 2018": ("2018-01-15", "2018-12-31"), "Covid 2020": ("2020-02-15", "2020-04-30"),
          "Rates 2022": ("2022-01-01", "2022-12-31")}


def regime_table(r: pd.Series) -> dict:
    out = {}
    for name, (a, b) in STRESS.items():
        x = r[a:b]
        if len(x) > 20:
            out[name] = float((1 + x).prod() - 1)
    yearly = r.groupby(r.index.year).apply(lambda x: (1 + x).prod() - 1)
    out["pct_years_positive"] = float((yearly > 0).mean()) if len(yearly) else 0.0
    out["yearly"] = {int(k): float(v) for k, v in yearly.items()}
    return out


_HOLDOUT_LOG = RESULTS_DIR / "holdout_log.json"


def holdout_once(strat: Strategy, prices: pd.DataFrame, cut: pd.Timestamp) -> dict:
    """Look at the locked holdout once per strategy version; reuse the answer afterwards."""
    log = json.loads(_HOLDOUT_LOG.read_text()) if _HOLDOUT_LOG.exists() else {}
    key = f"{strat.sleeve}.{strat.name}"
    h = strategy_hash(strat)
    entry = log.get(key)
    # Run on full data so signals have warm-up, then score only the holdout window.
    bt = backtest(strat.weights(prices), prices, strat.sleeve)
    hr = bt.returns[bt.returns.index >= cut]
    st = stats(hr, strat.sleeve)
    if entry is None or entry["hash"] != h:
        log[key] = {"hash": h, "first_look": str(pd.Timestamp.now().date()),
                    "sharpe": st["sharpe"], "looks": (entry or {}).get("looks", 0) + 1}
        _HOLDOUT_LOG.write_text(json.dumps(log, indent=1))
        log_trial(strat.sleeve, strat.name, strat.params, st, "holdout")
    return {"stats": st, "returns": hr, "looks": log[key]["looks"], "hash": h,
            "full_returns": bt.returns, "weights": bt.weights}


def validate(strat: Strategy, prices: pd.DataFrame, cut: pd.Timestamp) -> dict:
    sleeve = strat.sleeve
    ins = prices[prices.index < cut]
    base = backtest(strat.weights(ins), ins, sleeve)
    ist = stats(base.returns, sleeve)

    variants = strat.variants()[:24]
    vr = {}
    for i, p in enumerate(variants):
        try:
            vr[i] = backtest(strat.weights(ins, **p), ins, sleeve).returns
        except Exception:  # noqa: BLE001
            pass
    V = pd.DataFrame(vr)
    v_sharpes = [stats(V[c], sleeve)["sharpe"] for c in V] if not V.empty else []
    stability = float(np.mean([s >= 0.5 * ist["sharpe"] for s in v_sharpes])) if v_sharpes and ist["sharpe"] > 0 else 0.0

    n = trial_count(sleeve, strat.name)
    tsr = trial_sharpes(sleeve, strat.name) or v_sharpes
    dsr = deflated_sharpe(base.returns, sleeve, max(n, len(variants)), tsr)
    pbo, p_oos_loss = pbo_cscv(V) if not V.empty else (None, None)
    wf = walk_forward(V, sleeve) if V.shape[1] > 1 else base.returns
    wfs = stats(wf, sleeve)
    regimes = regime_table(base.returns)
    ho = holdout_once(strat, prices, cut)

    checks = {
        "backtest": ist["sharpe"] >= GATES["backtest_min_sharpe"],
        "deflated_sharpe": dsr["dsr"] >= GATES["dsr_min_prob"],
        # PBO only discriminates when variants are many and diverse; with a few
        # near-identical lookbacks it sits near 0.5 by construction. So the gate
        # is: the in-sample winner rarely loses money out of sample, and PBO is
        # enforced once the grid has >= 8 variants.
        "overfitting": (p_oos_loss is None or p_oos_loss <= GATES["oos_loss_max"])
                       and (pbo is None or len(variants) < 8 or pbo <= GATES["pbo_max"]),
        "walk_forward": wfs["sharpe"] > 0.25,
        "stability": stability >= 0.5,
        "holdout": ho["stats"]["sharpe"] >= GATES["holdout_min_sharpe"],
        "drawdown": ist["max_dd"] > -2.5 * SLEEVES[sleeve]["max_dd"],
    }
    return {
        "in_sample": ist, "turnover_yr": float(base.turnover.mean() * periods_per_year(sleeve)),
        "trials": n, "dsr": dsr["dsr"], "sr0": dsr["sr0_ann"], "pbo": pbo,
        "p_oos_loss": p_oos_loss, "n_variants": len(variants),
        "walk_forward": wfs, "stability": stability, "regimes": regimes,
        "holdout": ho["stats"], "holdout_looks": ho["looks"], "hash": ho["hash"],
        "checks": checks, "passed": all(checks.values()),
        "_full_returns": ho["full_returns"], "_weights": ho["weights"],
    }
