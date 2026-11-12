"""Strategy interface, backtester and hypothesis registry (stages 3-4)."""
from __future__ import annotations

import json
import itertools
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable

import numpy as np
import pandas as pd

from .config import SLEEVES, NON_TRADABLE, RESULTS_DIR, HOLDOUT_YEARS

# --------------------------------------------------------------------------
# Strategy registration
# --------------------------------------------------------------------------

@dataclass
class Strategy:
    name: str
    sleeve: str
    rationale: str
    failure_condition: str
    params: dict
    grid: dict
    fn: Callable[..., pd.DataFrame]
    author: str = "research-agent"
    tags: list = field(default_factory=list)

    def weights(self, prices: pd.DataFrame, **override) -> pd.DataFrame:
        p = {**self.params, **override}
        w = self.fn(prices, **p)
        w = w.reindex(index=prices.index).reindex(columns=prices.columns).fillna(0.0)
        for c in NON_TRADABLE & set(w.columns):
            w[c] = 0.0
        return w

    def variants(self) -> list[dict]:
        if not self.grid:
            return [dict(self.params)]
        keys = list(self.grid)
        out = []
        for combo in itertools.product(*[self.grid[k] for k in keys]):
            out.append({**self.params, **dict(zip(keys, combo))})
        return out


REGISTRY: dict[str, Strategy] = {}


def register(*, sleeve: str, name: str, rationale: str, failure_condition: str,
             params: dict, grid: dict | None = None, author: str = "research-agent",
             tags: list | None = None):
    """Decorator for strategy functions.

    The function receives a price DataFrame (dates x tickers, adjusted closes)
    and keyword params, and must return target weights (dates x tickers) that
    use ONLY information available at the close of each date. The engine
    trades them at the next close (weights are lagged one day).
    """
    if sleeve not in SLEEVES:
        raise ValueError(f"unknown sleeve {sleeve}")

    def deco(fn):
        key = f"{sleeve}.{name}"
        REGISTRY[key] = Strategy(name=name, sleeve=sleeve, rationale=rationale,
                                 failure_condition=failure_condition, params=params,
                                 grid=grid or {}, fn=fn, author=author, tags=tags or [])
        return fn
    return deco


def load_strategies() -> dict[str, Strategy]:
    import importlib, pkgutil
    import strategies as pkg
    for m in pkgutil.iter_modules(pkg.__path__):
        importlib.import_module(f"{pkg.__name__}.{m.name}")
    return REGISTRY

# --------------------------------------------------------------------------
# Backtest
# --------------------------------------------------------------------------

def periods_per_year(sleeve: str) -> int:
    return 365 if sleeve == "crypto" else 252


def vol_scale(w: pd.DataFrame, rets: pd.DataFrame, vol_target: float, ppy: int,
              max_leverage: float = 2.0, window: int = 63) -> pd.Series:
    """Leverage that scales TODAY's position vector to the vol target.

    Uses the trailing asset covariance (window days up to and including t)
    applied to the weights decided at t, so a flat or partly invested book is
    not levered up on stale, quiet strategy history.
    """
    R = rets.values
    W = w.values
    n, k = R.shape
    cs = np.cumsum(np.einsum("ti,tj->tij", R, R), axis=0)
    cm = np.cumsum(R, axis=0)
    lev = np.zeros(n)
    for t in range(window - 1, n):
        wt = W[t]
        if not np.any(wt):
            continue
        a = t - window
        S = cs[t] - (cs[a] if a >= 0 else 0)
        m = cm[t] - (cm[a] if a >= 0 else 0)
        cov = (S - np.outer(m, m) / window) / (window - 1)
        var = float(wt @ cov @ wt)
        if var > 1e-12:
            lev[t] = min(vol_target / (np.sqrt(var) * np.sqrt(ppy)), max_leverage)
    return pd.Series(lev, index=w.index)


@dataclass
class BTResult:
    returns: pd.Series        # daily net returns after vol targeting and costs
    gross: pd.Series
    turnover: pd.Series
    leverage: pd.Series
    weights: pd.DataFrame


def backtest(weights: pd.DataFrame, prices: pd.DataFrame, sleeve: str,
             vol_target: float | None = None, max_leverage: float = 2.0,
             cost_bps: float | None = None) -> BTResult:
    cfg = SLEEVES[sleeve]
    vt = cfg["vol_target"] if vol_target is None else vol_target
    cost = (cfg["cost_bps"] if cost_bps is None else cost_bps) / 1e4
    ppy = periods_per_year(sleeve)

    rets = prices.pct_change(fill_method=None).fillna(0.0).clip(-0.5, 1.0)
    w = weights.reindex_like(rets).fillna(0.0)
    lev = vol_scale(w, rets, vt, ppy, max_leverage)     # decided at close t from data <= t
    eff = w.mul(lev, axis=0).shift(1).fillna(0.0)       # position actually held each day
    held = w.shift(1).fillna(0.0)
    gross = (eff * rets).sum(axis=1)
    turnover = eff.diff().abs().sum(axis=1).fillna(0.0)
    net = gross - turnover * cost
    lev = lev.shift(1).fillna(0.0)
    first = held.abs().sum(axis=1).gt(0).idxmax() if held.abs().sum().sum() > 0 else net.index[0]
    sl = slice(first, None)
    return BTResult(net[sl], gross[sl], turnover[sl], lev[sl], eff[sl])


def stats(r: pd.Series, sleeve: str) -> dict:
    ppy = periods_per_year(sleeve)
    r = r.dropna()
    if len(r) < 30 or r.std() == 0:
        return {"sharpe": 0.0, "cagr": 0.0, "vol": 0.0, "max_dd": 0.0, "n": int(len(r)),
                "skew": 0.0, "kurt": 3.0, "hit": 0.0}
    eq = (1 + r).cumprod()
    dd = eq / eq.cummax() - 1
    years = len(r) / ppy
    return {
        "sharpe": float(r.mean() / r.std() * np.sqrt(ppy)),
        "cagr": float(eq.iloc[-1] ** (1 / years) - 1) if eq.iloc[-1] > 0 else -1.0,
        "vol": float(r.std() * np.sqrt(ppy)),
        "max_dd": float(dd.min()),
        "n": int(len(r)),
        "skew": float(r.skew()),
        "kurt": float(r.kurt() + 3),
        "hit": float((r > 0).mean()),
    }


def holdout_cutoff(index: pd.DatetimeIndex) -> pd.Timestamp:
    return index[-1] - pd.DateOffset(years=HOLDOUT_YEARS)

# --------------------------------------------------------------------------
# Hypothesis registry (one file per sleeve so agents never collide)
# --------------------------------------------------------------------------

def _reg_path(sleeve: str):
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    return RESULTS_DIR / f"registry_{sleeve}.json"


def read_registry(sleeve: str) -> dict:
    p = _reg_path(sleeve)
    if p.exists():
        return json.loads(p.read_text())
    return {"sleeve": sleeve, "trials": [], "postmortems": []}


def log_trial(sleeve: str, strategy: str, params: dict, st: dict, phase: str) -> None:
    reg = read_registry(sleeve)
    reg["trials"].append({
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "strategy": strategy, "phase": phase,
        "params": {k: (v if isinstance(v, (int, float, str, bool)) or v is None else str(v))
                   for k, v in params.items()},
        "sharpe": round(st["sharpe"], 4), "n": st["n"],
    })
    _reg_path(sleeve).write_text(json.dumps(reg, indent=1))


def trial_count(sleeve: str, strategy: str) -> int:
    reg = read_registry(sleeve)
    return max(1, sum(1 for t in reg["trials"] if t["strategy"] == strategy))


def trial_sharpes(sleeve: str, strategy: str) -> list[float]:
    reg = read_registry(sleeve)
    return [t["sharpe"] for t in reg["trials"] if t["strategy"] == strategy]
