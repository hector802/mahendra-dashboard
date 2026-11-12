"""Equity L/S sleeve: research-agent hypotheses.

Conventions used throughout:
  * Signals are computed from prices up to and including each date's close.
  * Rebalancing happens on the first trading day of each new period (week or
    month), which is known on that day without peeking at future dates; the
    weights are then held (forward-filled) until the next rebalance.
  * Tickers with insufficient history (NaN signal) are simply excluded from
    the ranking on that date.
  * The engine lags weights one day and vol-targets, so gross ~1 is enough.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from engine.core import register

SECTORS = ["XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLU", "XLV", "XLY"]
FACTORS = ["MTUM", "QUAL", "USMV", "VLUE"]
INDICES = ["SPY", "QQQ", "IWM", "EFA", "EEM"]


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def _cols(prices: pd.DataFrame, names: list[str]) -> list[str]:
    return [c for c in names if c in prices.columns]


def _rebal_mask(index: pd.DatetimeIndex, freq: str) -> pd.Series:
    """True on the first trading day of each new period ('M' or 'W')."""
    per = index.to_period(freq)
    m = pd.Series(per != pd.Series(per).shift(1).values, index=index)
    m.iloc[0] = False
    return m


def _hold(target: pd.DataFrame, freq: str) -> pd.DataFrame:
    """Keep target weights only on rebalance days, forward-fill in between."""
    mask = _rebal_mask(target.index, freq)
    w = target.where(mask, np.nan).ffill().fillna(0.0)
    return w


def _empty(prices: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame(0.0, index=prices.index, columns=prices.columns)


def _long_short_rank(score: pd.DataFrame, n: int, min_names: int) -> pd.DataFrame:
    """Equal-weight long top-n / short bottom-n by score, row by row.
    Rows with fewer than min_names valid scores get zero weight."""
    valid = score.notna()
    cnt = valid.sum(axis=1)
    rk = score.rank(axis=1, ascending=False)            # 1 = highest
    rk_lo = score.rank(axis=1, ascending=True)          # 1 = lowest
    long_ = (rk <= n) & valid
    short = (rk_lo <= n) & valid
    w = long_.astype(float) / n - short.astype(float) / n
    w[cnt < max(min_names, 2 * n)] = 0.0
    return w


# --------------------------------------------------------------------------
# 1. Cross-sectional sector momentum (12-1)
# --------------------------------------------------------------------------

@register(
    sleeve="equity", name="sector_momentum_12_1",
    rationale=("Industry momentum (Moskowitz-Grinblatt 1999): sectors with strong trailing "
               "12-month returns, skipping the most recent month to avoid short-term reversal, "
               "keep outperforming as information diffuses slowly across industries. Long top-n "
               "sectors, short bottom-n, dollar neutral, monthly."),
    failure_condition=("Net in-sample Sharpe < 0.3 or a rolling 3-year Sharpe below zero for most "
                       "of the post-2009 period (momentum crashes dominate the premium)."),
    params={"lookback": 252, "skip": 21, "n": 3},
    grid={"lookback": [126, 252], "n": [2, 3]},
)
def sector_momentum_12_1(prices: pd.DataFrame, lookback: int = 252, skip: int = 21,
                         n: int = 3) -> pd.DataFrame:
    secs = _cols(prices, SECTORS)
    p = prices[secs]
    score = p.shift(skip) / p.shift(lookback) - 1
    w = _empty(prices)
    w[secs] = _long_short_rank(score, n, min_names=6)
    return _hold(w, "M")


# --------------------------------------------------------------------------
# 2. Dual momentum across US / developed / emerging equity
# --------------------------------------------------------------------------

@register(
    sleeve="equity", name="dual_momentum_regions",
    rationale=("Antonacci-style dual momentum: relative momentum picks the strongest of US, "
               "developed ex-US and EM equity; absolute (time-series) momentum moves to cash when "
               "even the winner's trailing return is negative, sidestepping prolonged bear markets."),
    failure_condition=("Sharpe not above buy-and-hold SPY in-sample, or whipsaw losses around "
                       "V-shaped recoveries (2020-style) exceeding the drawdown it avoids."),
    params={"lookback": 252},
    grid={"lookback": [126, 189, 252]},
)
def dual_momentum_regions(prices: pd.DataFrame, lookback: int = 252) -> pd.DataFrame:
    names = _cols(prices, ["SPY", "EFA", "EEM"])
    p = prices[names]
    mom = p / p.shift(lookback) - 1
    best = mom.fillna(-np.inf).idxmax(axis=1)
    best_val = mom.max(axis=1)                          # NaN when no history yet
    w = _empty(prices)
    for c in names:
        w[c] = ((best == c) & (best_val > 0)).astype(float)
    return _hold(w, "M")


# --------------------------------------------------------------------------
# 3. Short-term sector reversal
# --------------------------------------------------------------------------

@register(
    sleeve="equity", name="sector_short_reversal",
    rationale=("Short-horizon reversal (Lehmann 1990; Jegadeesh 1990) from liquidity provision: "
               "sectors that over/under-shot last week due to flow pressure tend to mean-revert. "
               "Long the weakest sectors, short the strongest, rebalanced weekly."),
    failure_condition=("Gross edge is too small to survive 5bp costs at weekly turnover (net "
                       "Sharpe < 0.3), or returns concentrate in 2008-09 only."),
    params={"lookback": 5, "n": 2},
    grid={"lookback": [5, 21], "n": [2, 3]},
)
def sector_short_reversal(prices: pd.DataFrame, lookback: int = 5, n: int = 2) -> pd.DataFrame:
    secs = _cols(prices, SECTORS)
    p = prices[secs]
    score = -(p / p.shift(lookback) - 1)                # losers get highest score
    w = _empty(prices)
    w[secs] = _long_short_rank(score, n, min_names=6)
    return _hold(w, "W")


# --------------------------------------------------------------------------
# 4. Low-volatility anomaly across sectors (beta-neutral)
# --------------------------------------------------------------------------

@register(
    sleeve="equity", name="sector_low_vol_bab",
    rationale=("Betting-against-beta / low-vol anomaly (Frazzini-Pedersen 2014): leverage-"
               "constrained investors overpay for high-beta assets. Long the lowest-beta sectors "
               "and short the highest-beta sectors, each leg scaled by 1/beta so the book is "
               "approximately beta neutral to SPY. Monthly."),
    failure_condition=("Sharpe < 0.3 in-sample, or P&L reduces to a disguised short-tech/long-"
                       "utilities rate bet that loses in every equity rally."),
    params={"window": 252, "n": 3},
    grid={"window": [126, 252], "n": [2, 3]},
)
def sector_low_vol_bab(prices: pd.DataFrame, window: int = 252, n: int = 3) -> pd.DataFrame:
    secs = _cols(prices, SECTORS)
    r = prices[secs + ["SPY"]].pct_change(fill_method=None)
    m = r["SPY"]
    var_m = m.rolling(window, min_periods=window // 2).var()
    beta = pd.DataFrame({c: r[c].rolling(window, min_periods=window // 2).cov(m) / var_m
                         for c in secs})
    beta = beta.clip(lower=0.2)                         # guard tiny/negative betas
    lo = beta.rank(axis=1, ascending=True) <= n
    hi = beta.rank(axis=1, ascending=False) <= n
    valid = beta.notna().sum(axis=1) >= 6
    # equal weight within legs, then scale legs to unit beta each
    lo_w = lo.astype(float) / n
    hi_w = hi.astype(float) / n
    b_lo = (lo_w * beta).sum(axis=1)
    b_hi = (hi_w * beta).sum(axis=1)
    raw = lo_w.div(b_lo, axis=0) - hi_w.div(b_hi, axis=0)
    raw = raw.where(valid, 0.0).replace([np.inf, -np.inf], 0.0).fillna(0.0)
    gross = raw.abs().sum(axis=1).replace(0, np.nan)
    raw = raw.div(gross, axis=0).fillna(0.0) * 2.0      # gross 2 (1 long, ~1 short)
    w = _empty(prices)
    w[secs] = raw
    return _hold(w, "M")


# --------------------------------------------------------------------------
# 5. Factor-ETF momentum rotation (hedged)
# --------------------------------------------------------------------------

@register(
    sleeve="equity", name="factor_momentum_rotation",
    rationale=("Factor momentum (Ehsani-Linnainmaa 2022; Gupta-Kelly 2019): equity factors' "
               "own returns are autocorrelated. Rank MTUM/QUAL/USMV/VLUE by trailing return in "
               "excess of SPY, long the leader, short SPY against it to isolate the factor "
               "spread from market beta. Monthly."),
    failure_condition=("Excess-of-SPY spread has Sharpe < 0.3, or the book is dominated by "
                       "noise because factor ETFs share >90% of variance with SPY."),
    params={"lookback": 126, "n": 1},
    grid={"lookback": [63, 126, 252], "n": [1, 2]},
)
def factor_momentum_rotation(prices: pd.DataFrame, lookback: int = 126,
                             n: int = 1) -> pd.DataFrame:
    facs = _cols(prices, FACTORS)
    p = prices[facs]
    rel = (p / p.shift(lookback)).div(prices["SPY"] / prices["SPY"].shift(lookback), axis=0) - 1
    valid = rel.notna().sum(axis=1)
    rk = rel.rank(axis=1, ascending=False)
    long_ = ((rk <= n) & rel.notna()).astype(float) / n
    long_[valid < 3] = 0.0
    w = _empty(prices)
    w[facs] = long_
    w["SPY"] = -long_.sum(axis=1)
    return _hold(w, "M")


# --------------------------------------------------------------------------
# 6. Sector breadth risk-on / risk-off
# --------------------------------------------------------------------------

@register(
    sleeve="equity", name="breadth_risk_switch",
    rationale=("Market breadth as a regime signal: when most sectors trade above their long-run "
               "average, the advance is broad and drawdown risk is low; narrowing breadth tends "
               "to precede bear markets (Zweig; Faber). Long SPY when the share of sectors above "
               "their moving average exceeds a threshold, flat otherwise. Weekly."),
    failure_condition=("Sharpe not above the plain SPY 200dma trend benchmark, or the filter "
                       "misses recoveries badly enough that CAGR is < half buy-and-hold."),
    params={"window": 200, "threshold": 0.5},
    grid={"window": [150, 200], "threshold": [0.4, 0.5, 0.6]},
)
def breadth_risk_switch(prices: pd.DataFrame, window: int = 200,
                        threshold: float = 0.5) -> pd.DataFrame:
    secs = _cols(prices, SECTORS)
    p = prices[secs]
    ma = p.rolling(window, min_periods=window).mean()
    above = (p > ma).where(ma.notna())
    share = above.mean(axis=1)                          # NaN-aware
    ok = ma.notna().sum(axis=1) >= 6
    w = _empty(prices)
    w["SPY"] = ((share > threshold) & ok).astype(float)
    return _hold(w, "W")


# --------------------------------------------------------------------------
# 7. Time-series momentum across equity indices (long/short)
# --------------------------------------------------------------------------

@register(
    sleeve="equity", name="index_tsmom",
    rationale=("Time-series momentum (Moskowitz-Ooi-Pedersen 2012): each equity index's own "
               "trailing return predicts its next-month sign, driven by under-reaction then "
               "delayed over-reaction. Long/short each of SPY/QQQ/IWM/EFA/EEM by the sign of "
               "its trailing return, inverse-vol weighted. Monthly."),
    failure_condition=("Sharpe < 0.3 or losses concentrated in sharp reversals (2009, 2020) that "
                       "exceed the crisis-alpha gains; high correlation (>0.85) with the "
                       "breadth/trend strategies would also make it redundant."),
    params={"lookback": 252, "vol_window": 63},
    grid={"lookback": [63, 126, 252]},
)
def index_tsmom(prices: pd.DataFrame, lookback: int = 252, vol_window: int = 63) -> pd.DataFrame:
    idx = _cols(prices, INDICES)
    p = prices[idx]
    sig = np.sign(p / p.shift(lookback) - 1)
    vol = p.pct_change(fill_method=None).rolling(vol_window, min_periods=vol_window // 2).std()
    raw = (sig / vol).replace([np.inf, -np.inf], np.nan)
    gross = raw.abs().sum(axis=1).replace(0, np.nan)
    w = _empty(prices)
    w[idx] = raw.div(gross, axis=0).fillna(0.0)
    return _hold(w, "M")
