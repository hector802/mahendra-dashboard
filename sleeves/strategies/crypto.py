"""Crypto (digital assets) sleeve hypotheses.

Conventions used by every strategy here:
  * Long/flat only (weights >= 0, gross <= 1). Shorting crypto is costly and
    unreliable (funding, borrow, exchange risk), so no shorts.
  * Signals use only trailing data up to each date's close; the engine lags
    weights by one day before trading.
  * A coin is eligible only after it has `min_hist` days of price history,
    so newly listed coins (SOL/AVAX in 2020) never enter on a short sample.
  * Signals are sampled once a week (Sunday close) and held, to keep turnover
    (15 bps per unit) under control.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from engine.core import register

BTC, ETH = "BTC-USD", "ETH-USD"


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def _weekly(w: pd.DataFrame, day: int = 6) -> pd.DataFrame:
    """Hold the weights observed at each week's `day` close until the next one."""
    mask = w.index.dayofweek == day
    return w.where(pd.Series(mask, index=w.index), np.nan).ffill().fillna(0.0)


def _risk_scaled_weekly(w: pd.DataFrame, prices: pd.DataFrame, target: float = 0.20,
                        window: int = 60, day: int = 6) -> pd.DataFrame:
    """Sample weights weekly and de-lever each book to an ex-ante vol of `target`.

    The engine's vol overlay scales by the strategy's *realised* trailing vol, which
    collapses after flat/partial periods and then levers a re-entry 2x into raw crypto
    (~80% vol). Sizing the book ourselves (never above gross 1) keeps raw vol near the
    sleeve target so the overlay only fine-tunes. Uses a trailing `window`-day
    covariance at each rebalance date (no look-ahead).
    """
    rets = prices.pct_change(fill_method=None)
    out = pd.DataFrame(np.nan, index=w.index, columns=w.columns)
    for t in w.index[w.index.dayofweek == day]:
        wt = w.loc[t]
        live = wt[wt > 0].index
        if len(live) == 0:
            out.loc[t] = 0.0
            continue
        hist = rets.loc[:t, live].tail(window)
        cov = hist.cov(min_periods=window // 2).fillna(0.0).values * 365
        pv = float(np.sqrt(max(wt[live].values @ cov @ wt[live].values, 0.0)))
        k = min(1.0, target / pv) if pv > 0 else 0.0
        out.loc[t] = wt * k
    return out.ffill().fillna(0.0)


def _eligible(prices: pd.DataFrame, min_hist: int) -> pd.DataFrame:
    """True once a coin has at least `min_hist` observed prices (trailing count)."""
    return prices.notna().cumsum().ge(min_hist) & prices.notna()


def _btc_regime(prices: pd.DataFrame, window: int) -> pd.Series:
    btc = prices[BTC]
    return (btc > btc.rolling(window, min_periods=window).mean()).fillna(False)


# --------------------------------------------------------------------------
# 1. BTC time-series trend, multi-lookback ensemble
# --------------------------------------------------------------------------

@register(
    sleeve="crypto", name="btc_trend_ensemble",
    rationale=("Time-series momentum in BTC: crypto flows are reflexive (rising prices attract "
               "retail/leverage inflows), so trailing returns over several horizons predict "
               "the next weeks' drift. Exposure = fraction of lookbacks with positive return."),
    failure_condition=("Sharpe below buy-and-hold BTC over a full cycle, or repeated whipsaw "
                       "losses in range-bound regimes (e.g. 2019, 2022 H2) exceeding the 20% DD budget."),
    params={"lookbacks": (20, 60, 120, 240)},
    grid={"lookbacks": [(20, 60, 120, 240), (10, 30, 60), (60, 120, 240)]},
)
def btc_trend_ensemble(prices: pd.DataFrame, lookbacks=(20, 60, 120, 240)) -> pd.DataFrame:
    w = pd.DataFrame(0.0, index=prices.index, columns=prices.columns)
    btc = prices[BTC]
    sig = sum((btc / btc.shift(L) - 1 > 0).astype(float) for L in lookbacks) / len(lookbacks)
    w[BTC] = sig.fillna(0.0)
    return _risk_scaled_weekly(w, prices)


# --------------------------------------------------------------------------
# 2. Cross-sectional momentum among majors, gated by BTC regime
# --------------------------------------------------------------------------

@register(
    sleeve="crypto", name="xs_momentum_btc_regime",
    rationale=("Cross-sectional momentum: capital rotates into the coins with the strongest "
               "narratives and liquidity; winners keep winning over 1-3 months. Only active when "
               "BTC is above its 100d average, since alt-coins crash together in bear markets."),
    failure_condition=("Top-k basket fails to beat the equal-weight eligible basket under the same "
                       "BTC filter, or alt-season reversals produce >20% drawdowns."),
    params={"lookback": 60, "top_k": 3, "regime_window": 100, "min_hist": 180},
    grid={"lookback": [30, 60, 90], "top_k": [3, 5]},
)
def xs_momentum_btc_regime(prices: pd.DataFrame, lookback: int = 60, top_k: int = 3,
                           regime_window: int = 100, min_hist: int = 180) -> pd.DataFrame:
    mom = prices / prices.shift(lookback) - 1
    mom = mom.where(_eligible(prices, min_hist))
    rank = mom.rank(axis=1, ascending=False)
    sel = (rank <= top_k) & mom.notna()
    w = sel.astype(float).div(sel.sum(axis=1).replace(0, np.nan), axis=0).fillna(0.0)
    w = w.mul(_btc_regime(prices, regime_window).astype(float), axis=0)
    return _risk_scaled_weekly(w, prices)


# --------------------------------------------------------------------------
# 3. BTC / ETH relative-strength rotation with absolute trend filter
# --------------------------------------------------------------------------

@register(
    sleeve="crypto", name="btc_eth_rotation",
    rationale=("The two deepest, most liquid coins alternate leadership (ETH outperforms in "
               "risk-on/DeFi phases, BTC in flight-to-quality). Hold the one with stronger "
               "trailing return, only if its own trailing return is positive; else flat."),
    failure_condition=("Sharpe below a static 50/50 BTC/ETH trend-filtered basket, i.e. the "
                       "relative-strength leg adds nothing beyond absolute trend."),
    params={"lookback": 60},
    grid={"lookback": [30, 60, 90]},
)
def btc_eth_rotation(prices: pd.DataFrame, lookback: int = 60) -> pd.DataFrame:
    w = pd.DataFrame(0.0, index=prices.index, columns=prices.columns)
    r = prices[[BTC, ETH]] / prices[[BTC, ETH]].shift(lookback) - 1
    r = r.where(_eligible(prices[[BTC, ETH]], 180))
    rb, re_ = r[BTC], r[ETH]
    btc_lead = rb.notna() & (re_.isna() | (rb >= re_))
    eth_lead = re_.notna() & ~btc_lead
    w[BTC] = (btc_lead & (rb > 0)).astype(float)
    w[ETH] = (eth_lead & (re_ > 0)).astype(float)
    return _risk_scaled_weekly(w, prices)


# --------------------------------------------------------------------------
# 4. Inverse-vol basket with per-coin trend filter
# --------------------------------------------------------------------------

@register(
    sleeve="crypto", name="invvol_trend_basket",
    rationale=("Diversified exposure to the crypto beta while sidestepping deep bear markets: "
               "each eligible coin is held only above its own moving average, sized by inverse "
               "trailing vol so DOGE/SOL do not dominate risk."),
    failure_condition=("Diversification fails (coin correlations -> 1 in crashes) so drawdowns "
                       "match BTC trend with lower Sharpe; or MA exits lag so DD > 20%."),
    params={"ma_window": 100, "vol_window": 60, "min_hist": 180},
    grid={"ma_window": [50, 100, 200]},
)
def invvol_trend_basket(prices: pd.DataFrame, ma_window: int = 100, vol_window: int = 60,
                        min_hist: int = 180) -> pd.DataFrame:
    rets = prices.pct_change(fill_method=None)
    vol = rets.rolling(vol_window, min_periods=vol_window // 2).std()
    trend = prices > prices.rolling(ma_window, min_periods=ma_window).mean()
    ok = trend & _eligible(prices, min_hist) & vol.gt(0)
    iv = (1.0 / vol).where(ok)
    # Normalise by inverse-vol sum across ALL eligible coins, so being in trend in
    # only a few coins means proportionally lower gross exposure (cash otherwise).
    iv_all = (1.0 / vol).where(_eligible(prices, min_hist) & vol.gt(0))
    w = iv.div(iv_all.sum(axis=1).replace(0, np.nan), axis=0).fillna(0.0)
    return _risk_scaled_weekly(w, prices)


# --------------------------------------------------------------------------
# 5. Donchian channel breakout (volatility breakout) on liquid majors
# --------------------------------------------------------------------------

@register(
    sleeve="crypto", name="donchian_breakout",
    rationale=("Crypto rallies start with range breakouts that trigger momentum/short-covering "
               "cascades. Enter a coin on a close at its N-day high, exit on a close at its "
               "N/2-day low (classic turtle). Applied to BTC, ETH, LTC (longest, deepest history)."),
    failure_condition=("False breakouts dominate (hit rate too low to cover 15 bps costs), or "
                       "Sharpe no better than the simpler BTC moving-average trend."),
    params={"entry": 55, "coins": (BTC, ETH, "LTC-USD"), "min_hist": 180},
    grid={"entry": [20, 55, 100]},
)
def donchian_breakout(prices: pd.DataFrame, entry: int = 55,
                      coins=(BTC, ETH, "LTC-USD"), min_hist: int = 180) -> pd.DataFrame:
    w = pd.DataFrame(0.0, index=prices.index, columns=prices.columns)
    exit_n = max(entry // 2, 5)
    elig = _eligible(prices, min_hist)
    pos = pd.DataFrame(0.0, index=prices.index, columns=list(coins))
    for c in coins:
        p = prices[c]
        hi = p.rolling(entry, min_periods=entry).max()     # includes today: close at new high
        lo = p.rolling(exit_n, min_periods=exit_n).min()
        state = pd.Series(np.nan, index=p.index)
        state[(p >= hi) & elig[c]] = 1.0
        state[(p <= lo) | ~elig[c]] = 0.0
        pos[c] = state.ffill().fillna(0.0)
    n = elig[list(coins)].sum(axis=1).replace(0, np.nan)
    for c in coins:
        w[c] = (pos[c] / n).fillna(0.0)
    return _risk_scaled_weekly(w, prices)


# --------------------------------------------------------------------------
# 6. Short-term reversal within an up-trending market
# --------------------------------------------------------------------------

@register(
    sleeve="crypto", name="st_reversal_uptrend",
    rationale=("Liquidity provision: over 1-2 weeks, coins that sold off hardest relative to "
               "peers (forced liquidations, leverage flushes) tend to mean-revert. Buy the "
               "bottom-k weekly losers among eligible coins, only while BTC is in an uptrend."),
    failure_condition=("Losers keep losing (momentum dominates at weekly horizon) so the strategy "
                       "underperforms the equal-weight eligible basket under the same BTC filter."),
    params={"lookback": 7, "bottom_k": 3, "regime_window": 100, "min_hist": 180},
    grid={"lookback": [7, 14], "bottom_k": [2, 3]},
)
def st_reversal_uptrend(prices: pd.DataFrame, lookback: int = 7, bottom_k: int = 3,
                        regime_window: int = 100, min_hist: int = 180) -> pd.DataFrame:
    r = prices / prices.shift(lookback) - 1
    r = r.where(_eligible(prices, min_hist))
    rank = r.rank(axis=1, ascending=True)
    sel = (rank <= bottom_k) & r.notna()
    w = sel.astype(float).div(sel.sum(axis=1).replace(0, np.nan), axis=0).fillna(0.0)
    w = w.mul(_btc_regime(prices, regime_window).astype(float), axis=0)
    return _risk_scaled_weekly(w, prices)
