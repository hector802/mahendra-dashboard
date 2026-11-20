"""b_etf sleeve: ETF strategies from Kakushadze & Serur, *151 Trading Strategies*, ch. 4.

Implemented exactly as pre-registered in catalogue/book_protocol.md (section b_etf).

Conventions (NOT FROM BOOK where marked, reported to the protocol owner):
* A "month" of lookback = 21 trading days (T=12m -> 252 days).          NOT FROM BOOK
* Monthly rebalance = first trading day of each calendar month, using that
  day's close; weights are held (ffill) until the next rebalance. With a
  3-month holding period the rebalance months are Jan/Apr/Jul/Oct.      NOT FROM BOOK
* An ETF enters a ranking only once it has the full lookback history.
* Weights are produced at close t; the engine trades them at close t+1.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from engine.core import register
from engine.data import get_hilo

SECTORS = ["XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLU", "XLV", "XLY"]
UNIVERSE = ["SPY", "EFA", "EEM", "IWM"] + SECTORS + ["TLT", "IEF", "LQD", "HYG", "GLD", "DBC", "VNQ"]
TREND_UNIVERSE = ["SPY", "EFA", "EEM", "IWM", "TLT", "IEF", "LQD", "HYG", "GLD", "DBC", "VNQ"]
TOP_N = 3            # protocol: "top decile" of 9 sectors -> top 3
DAYS_PER_MONTH = 21  # NOT FROM BOOK: trading-day approximation of a month


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def _cols(prices: pd.DataFrame, names) -> list[str]:
    return [c for c in names if c in prices.columns]


def _rebalance_mask(index: pd.DatetimeIndex, hold_months: int = 1) -> pd.Series:
    """True on the first trading day of each month (every `hold_months` months,
    anchored to calendar months so the schedule never depends on the sample)."""
    per = index.to_period("M")
    first = pd.Series(per != np.roll(per, 1), index=index)
    first.iloc[0] = True
    if hold_months > 1:
        month_no = pd.Series((index.year * 12 + index.month - 1) % hold_months == 0, index=index)
        first &= month_no
    return first


def _hold(w: pd.DataFrame, mask: pd.Series) -> pd.DataFrame:
    return w.where(mask, np.nan).ffill().fillna(0.0)


def _cum_ret(px: pd.DataFrame, months: int) -> pd.DataFrame:
    """Eq. 361: R^cum_i(t) = P_i(t) / P_i(t+T) - 1, T months in the past."""
    return px / px.shift(months * DAYS_PER_MONTH) - 1


def _top_n_mask(score: pd.DataFrame, n: int = TOP_N) -> pd.DataFrame:
    """Boolean frame: True for the n highest finite scores on each date."""
    rank = score.rank(axis=1, ascending=False, method="first")
    return (rank <= n) & score.notna()


def _empty(prices: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame(0.0, index=prices.index, columns=prices.columns)


# --------------------------------------------------------------------------
# 4.1 Sector momentum rotation
# --------------------------------------------------------------------------

@register(
    sleeve="b_etf", name="sector_momentum_rotation",
    rationale=("151 §4.1: long-only, equal weight the top 3 of 9 sector SPDRs by T-month cumulative "
               "return (eq. 361), held for the holding period; sector momentum persists. "
               "NOT FROM BOOK: 1m=21 trading days; 3m holds rebalance Jan/Apr/Jul/Oct."),
    failure_condition="In-sample Sharpe below equal-weight buy-and-hold of the 9 sectors, or below 0.3.",
    params={"T": 12, "hold": 1}, grid={"T": [6, 12], "hold": [1, 3]},
    author="book-151", tags=["book"],
)
def sector_momentum_rotation(prices: pd.DataFrame, T: int = 12, hold: int = 1) -> pd.DataFrame:
    w = _empty(prices)
    sec = _cols(prices, SECTORS)
    top = _top_n_mask(_cum_ret(prices[sec], T))
    w[sec] = top.astype(float) / TOP_N
    return _hold(w, _rebalance_mask(prices.index, hold))


# --------------------------------------------------------------------------
# 4.1.1 Sector momentum rotation with MA filter
# --------------------------------------------------------------------------

@register(
    sleeve="b_etf", name="sector_momentum_ma_filter",
    rationale=("151 §4.1.1: as §4.1 (top 3 sectors by 12m return, monthly) but a top-3 sector is bought "
               "only if P > MA(T') of daily prices (eq. 362); a failing slot stays in cash."),
    failure_condition="In-sample Sharpe not above the unfiltered sector_momentum_rotation, or below 0.3.",
    params={"T": 12, "T_ma": 200}, grid={"T_ma": [100, 200]},
    author="book-151", tags=["book"],
)
def sector_momentum_ma_filter(prices: pd.DataFrame, T: int = 12, T_ma: int = 200) -> pd.DataFrame:
    w = _empty(prices)
    sec = _cols(prices, SECTORS)
    px = prices[sec]
    top = _top_n_mask(_cum_ret(px, T))
    ma = px.rolling(T_ma, min_periods=T_ma).mean()
    w[sec] = (top & (px > ma)).astype(float) / TOP_N
    return _hold(w, _rebalance_mask(prices.index, 1))


# --------------------------------------------------------------------------
# 4.1.2 Dual-momentum sector rotation
# --------------------------------------------------------------------------

@register(
    sleeve="b_etf", name="dual_momentum_sector",
    rationale=("151 §4.1.2: hold the top 3 sectors by 12m return if SPY > MA(T'), else 100% TLT as the "
               "uncorrelated ETF (eq. 363); monthly. NOT FROM BOOK: cash until SPY's MA exists."),
    failure_condition="In-sample Sharpe not above sector_momentum_rotation, or max drawdown not smaller.",
    params={"T": 12, "T_ma": 200}, grid={"T_ma": [100, 200]},
    author="book-151", tags=["book"],
)
def dual_momentum_sector(prices: pd.DataFrame, T: int = 12, T_ma: int = 200) -> pd.DataFrame:
    w = _empty(prices)
    sec = _cols(prices, SECTORS)
    top = _top_n_mask(_cum_ret(prices[sec], T)).astype(float) / TOP_N
    spy = prices["SPY"]
    ma = spy.rolling(T_ma, min_periods=T_ma).mean()
    up = (spy > ma) & ma.notna()
    down = (spy <= ma) & ma.notna()
    w[sec] = top.mul(up.astype(float), axis=0)
    if "TLT" in w.columns:
        w["TLT"] = down.astype(float) * prices["TLT"].notna()
    return _hold(w, _rebalance_mask(prices.index, 1))


# --------------------------------------------------------------------------
# 4.4 Mean-reversion (IBS)
# --------------------------------------------------------------------------

@register(
    sleeve="b_etf", name="etf_ibs_reversion",
    rationale=("151 §4.4: IBS=(C-L)/(H-L) (eq. 370) on all 20 universe ETFs; dollar-neutral, long the "
               "2 lowest-IBS and short the 2 highest, equal weight, daily. NOT FROM BOOK: IBS of day t "
               "set at close t is traded by the engine at close t+1 (book: prior day's bar); H=L -> skip."),
    failure_condition="In-sample Sharpe below 0.3 after 5bp costs (daily turnover is high).",
    params={}, grid=None,
    author="book-151", tags=["book"],
)
def etf_ibs_reversion(prices: pd.DataFrame) -> pd.DataFrame:
    w = _empty(prices)
    cols = _cols(prices, UNIVERSE)
    ibs = {}
    for t in cols:
        try:
            h = get_hilo(t).reindex(prices.index)   # never use rows beyond the given index
        except Exception as e:  # noqa: BLE001
            print(f"[b_etf] no high/low for {t}: {e}")
            continue
        rng = h["high"] - h["low"]
        x = (h["close"] - h["low"]) / rng.where(rng > 0)
        ibs[t] = x.where(prices[t].notna())
    if not ibs:
        return w
    ibs = pd.DataFrame(ibs)
    n_ok = ibs.notna().sum(axis=1)
    lo = ibs.rank(axis=1, ascending=True, method="first") <= 2
    hi = ibs.rank(axis=1, ascending=False, method="first") <= 2
    valid = n_ok >= 4                               # need 2 longs and 2 distinct shorts
    sig = (lo.astype(float) * 0.5 - hi.astype(float) * 0.5).mul(valid.astype(float), axis=0)
    w[sig.columns] = sig
    return w


# --------------------------------------------------------------------------
# 4.6 Multi-asset trend following
# --------------------------------------------------------------------------

def _cap_weights(row: np.ndarray, cap: float) -> np.ndarray:
    """Normalise positive weights to sum 1 with w_i <= cap, redistributing the excess
    proportionally among uncapped names. If fewer than 1/cap names are eligible, the
    capped weights sum below 1 and the rest is cash (NOT FROM BOOK)."""
    w = np.where(np.isfinite(row) & (row > 0), row, 0.0)
    if w.sum() <= 0:
        return np.zeros_like(w)
    w = w / w.sum()
    fixed = np.zeros(len(w), dtype=bool)
    for _ in range(len(w)):
        over = (w > cap + 1e-12) & ~fixed
        if not over.any():
            break
        fixed |= over
        w[fixed] = cap
        free = ~fixed & (w > 0)
        rem = 1.0 - cap * fixed.sum()
        if not free.any() or rem <= 0:
            break
        w[free] = w[free] / w[free].sum() * rem
    return np.minimum(w, cap)


@register(
    sleeve="b_etf", name="multi_asset_trend",
    rationale=("151 §4.6: on 11 multi-asset ETFs keep those with R^cum(T)>0 and P>MA(T'), weight "
               "proportional to R^cum/sigma^2 (eq. 373, sigma=252d vol), cap w<=0.30, renormalise; monthly. "
               "NOT FROM BOOK: with <4 eligible ETFs the capped remainder is cash."),
    failure_condition="In-sample Sharpe below a 60/40 SPY/IEF benchmark, or below 0.3.",
    params={"T": 12, "T_ma": 200, "cap": 0.30}, grid={"T": [6, 12]},
    author="book-151", tags=["book"],
)
def multi_asset_trend(prices: pd.DataFrame, T: int = 12, T_ma: int = 200, cap: float = 0.30) -> pd.DataFrame:
    w = _empty(prices)
    cols = _cols(prices, TREND_UNIVERSE)
    px = prices[cols]
    rc = _cum_ret(px, T)
    ma = px.rolling(T_ma, min_periods=T_ma).mean()
    sig = px.pct_change(fill_method=None).rolling(252, min_periods=252).std() * np.sqrt(252)
    raw = rc / sig ** 2
    keep = (rc > 0) & (px > ma) & sig.gt(0) & raw.notna()
    raw = raw.where(keep)
    mask = _rebalance_mask(prices.index, 1)
    out = pd.DataFrame(np.nan, index=prices.index, columns=cols)
    for d in prices.index[mask.values]:
        out.loc[d] = _cap_weights(raw.loc[d].values.astype(float), cap)
    w[cols] = out.ffill().fillna(0.0)
    return w
