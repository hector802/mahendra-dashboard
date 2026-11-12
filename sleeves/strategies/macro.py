"""Macro / Rates sleeve hypotheses (research agent).

Conventions
-----------
* All signals use trailing data only (rolling / ewm windows, no full-sample stats).
* Positions are set on the FIRST trading day of each week/month using that day's
  close and held until the next rebalance; the engine lags weights one more day.
  (Using the first day of a period avoids needing to know the calendar ahead.)
* Assets with insufficient history get NaN signals -> zero weight.
* FX: EURUSD/GBPUSD/AUDUSD long = long foreign ccy; JPY=X/CAD=X/CHF=X long =
  long USD. Signals are computed on the same price series that is traded, so
  no sign conversion is needed. FX prices exclude carry.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from engine.core import register

BONDS = ["TLT", "IEF", "SHY", "TIP", "LQD", "HYG"]
COMMOD = ["GLD", "SLV", "DBC", "USO"]
FX = ["EURUSD=X", "JPY=X", "GBPUSD=X", "AUDUSD=X", "CAD=X", "CHF=X", "UUP"]
ALL = BONDS + COMMOD + FX
LOOKBACKS = {"short": (21, 63, 126), "blend": (63, 126, 252), "long": (126, 252)}


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def _cols(prices: pd.DataFrame, names) -> list[str]:
    return [c for c in names if c in prices.columns]


def _rets(prices: pd.DataFrame) -> pd.DataFrame:
    return prices.pct_change(fill_method=None)


def _vol(prices: pd.DataFrame, window: int = 63) -> pd.DataFrame:
    v = _rets(prices).rolling(window, min_periods=int(window * 0.8)).std() * np.sqrt(252)
    return v.where(v > 1e-4)


def _rebalance(w: pd.DataFrame, freq: str = "W") -> pd.DataFrame:
    """Keep weights only on the first trading day of each period, hold in between."""
    keys = w.index.to_period(freq)
    first = pd.Series(keys != np.roll(keys, 1), index=w.index)
    first.iloc[0] = True
    return w.where(first, np.nan).ffill().fillna(0.0)


def _trailing_ret(prices: pd.DataFrame, n: int) -> pd.DataFrame:
    return prices / prices.shift(n) - 1


def _full(prices: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame(0.0, index=prices.index, columns=prices.columns)


# --------------------------------------------------------------------------
# 1. Multi-asset time-series momentum
# --------------------------------------------------------------------------

@register(
    sleeve="macro", name="ts_trend_multi",
    rationale=("Time-series momentum across bonds, commodities and FX (Moskowitz-Ooi-Pedersen): "
               "slow-moving macro information and investor under-reaction make trailing returns "
               "predict next-month returns. Inverse-vol sizing, blended lookbacks, sign signals."),
    failure_condition=("In-sample Sharpe < 0.3, or rolling 3y Sharpe negative in more than 40% of "
                       "windows, or losses concentrated in trend reversals with no crisis payoff (2008)."),
    params={"lookbacks": "blend", "freq": "W"},
    grid={"lookbacks": ["short", "blend", "long"], "freq": ["W", "M"]},
)
def ts_trend_multi(prices: pd.DataFrame, lookbacks: str = "blend", freq: str = "W") -> pd.DataFrame:
    # SHY kept: front-end trend tracks Fed cycles. (Excluding it to save costs was tried in-sample
    # and lowered net Sharpe 0.49 -> 0.42, so the original specification is retained.)
    cols = _cols(prices, ALL)
    px = prices[cols]
    sig = sum(np.sign(_trailing_ret(px, n)) for n in LOOKBACKS[lookbacks]) / len(LOOKBACKS[lookbacks])
    raw = sig / _vol(px)
    w = _full(prices)
    w[cols] = raw.div(raw.notna().sum(axis=1).replace(0, np.nan), axis=0).fillna(0.0)
    return _rebalance(w, freq)


# --------------------------------------------------------------------------
# 2. FX trend
# --------------------------------------------------------------------------

@register(
    sleeve="macro", name="fx_trend",
    rationale=("Currency trend: FX moves are driven by persistent policy-rate and growth "
               "divergences that central banks change gradually, so exchange-rate trends persist. "
               "Moving-average-crossover or return-sign signal per G10 pair, inverse-vol weighted."),
    failure_condition=("Sharpe < 0.2 in-sample, or edge disappears post-2012 (known decay of FX trend "
                       "as rates converged to zero), or performance relies on a single pair."),
    params={"signal": "ma", "speed": "slow"},
    grid={"signal": ["ma", "ret"], "speed": ["fast", "slow"]},
)
def fx_trend(prices: pd.DataFrame, signal: str = "ma", speed: str = "slow") -> pd.DataFrame:
    cols = _cols(prices, ["EURUSD=X", "JPY=X", "GBPUSD=X", "AUDUSD=X", "CAD=X", "CHF=X"])
    px = prices[cols]
    if signal == "ma":
        pairs = [(10, 50), (20, 100)] if speed == "fast" else [(50, 200), (20, 100)]
        sig = sum(np.sign(px.rolling(a, min_periods=a).mean() - px.rolling(b, min_periods=b).mean())
                  for a, b in pairs) / len(pairs)
    else:
        lbs = (21, 63) if speed == "fast" else (63, 126, 252)
        sig = sum(np.sign(_trailing_ret(px, n)) for n in lbs) / len(lbs)
    raw = sig / _vol(px)
    w = _full(prices)
    w[cols] = raw.div(raw.notna().sum(axis=1).replace(0, np.nan), axis=0).fillna(0.0)
    return _rebalance(w, "W")


# --------------------------------------------------------------------------
# 3. Cross-asset momentum ranking
# --------------------------------------------------------------------------

@register(
    sleeve="macro", name="xasset_momentum_rank",
    rationale=("Cross-sectional momentum across macro assets (Asness-Moskowitz-Pedersen 'value and "
               "momentum everywhere'): rank risk-adjusted 12-1 / 6-1 month returns, long the top k, "
               "short the bottom k. Captures relative capital flows between asset classes."),
    failure_condition=("Sharpe < 0.3, or long and short legs both lose (signal noise), or monthly "
                       "momentum crashes dominate drawdowns (e.g. 2009 reversals)."),
    params={"lookback": 252, "k": 3},
    grid={"lookback": [126, 252], "k": [3, 4]},
)
def xasset_momentum_rank(prices: pd.DataFrame, lookback: int = 252, k: int = 3) -> pd.DataFrame:
    cols = _cols(prices, [c for c in ALL if c != "SHY"])   # SHY is cash-like; exclude from ranking
    px = prices[cols]
    mom = (px.shift(21) / px.shift(lookback) - 1)           # skip most recent month
    vol = _vol(px, 126)
    score = mom / vol
    rank = score.rank(axis=1, ascending=False)
    n = score.notna().sum(axis=1)
    longs = (rank <= k)
    shorts = rank.gt(n - k, axis=0) & score.notna()
    enough = n >= 2 * k + 2
    inv = 1.0 / vol
    w = _full(prices)
    lw = (inv.where(longs)).div(inv.where(longs).sum(axis=1), axis=0)
    sw = (inv.where(shorts)).div(inv.where(shorts).sum(axis=1), axis=0)
    w[cols] = (lw.fillna(0.0) - sw.fillna(0.0)).where(enough, 0.0)
    return _rebalance(w, "M")


# --------------------------------------------------------------------------
# 4. Risk parity with trend filter
# --------------------------------------------------------------------------

@register(
    sleeve="macro", name="risk_parity_trend",
    rationale=("Long-only inverse-vol risk parity across duration, credit, inflation-linked, gold and "
               "commodities earns diversified risk premia; a moving-average filter drops assets in "
               "downtrends (Faber-style) to cut the deep drawdowns that sink plain risk parity (2008, 2022)."),
    failure_condition=("Sharpe below unfiltered inverse-vol portfolio, or max DD > 25% (2.5x sleeve "
                       "limit), or whipsaw costs consume the drawdown savings."),
    params={"ma": 200},
    grid={"ma": [150, 200, 250]},
)
def risk_parity_trend(prices: pd.DataFrame, ma: int = 200) -> pd.DataFrame:
    cols = _cols(prices, ["TLT", "IEF", "TIP", "LQD", "HYG", "GLD", "DBC"])
    px = prices[cols]
    inv = 1.0 / _vol(px)
    on = px > px.rolling(ma, min_periods=ma).mean()
    base = inv.div(inv.sum(axis=1), axis=0)                 # risk-parity weights over available assets
    w = _full(prices)
    w[cols] = base.where(on, 0.0).fillna(0.0)               # filtered-out risk goes to cash
    return _rebalance(w, "M")


# --------------------------------------------------------------------------
# 5. Credit-spread regime -> duration / credit timing
# --------------------------------------------------------------------------

@register(
    sleeve="macro", name="credit_regime_duration",
    rationale=("Credit leads rates: when high-yield underperforms Treasuries (HYG/IEF falling, spreads "
               "widening) growth expectations are deteriorating and a flight-to-quality bid lifts "
               "duration; when credit outperforms, carry in HY dominates and duration lags. "
               "Long TLT/IEF in stress regimes, long HYG in benign regimes. LQD/IEF used before HYG exists."),
    failure_condition=("Sharpe < 0.3, or the regime signal fails in inflation-driven selloffs where "
                       "credit and duration fall together (2022), producing losses on both legs."),
    params={"ma": 100},
    grid={"ma": [50, 100, 200]},
)
def credit_regime_duration(prices: pd.DataFrame, ma: int = 100) -> pd.DataFrame:
    hy = prices["HYG"].where(prices["HYG"].notna(), np.nan)
    ratio_hy = prices["HYG"] / prices["IEF"]
    ratio_ig = prices["LQD"] / prices["IEF"]
    # use HY ratio once it has `ma` days of history, IG ratio before that
    def regime(r):
        return np.sign(r - r.rolling(ma, min_periods=ma).mean())
    reg = regime(ratio_hy).where(regime(ratio_hy).notna(), regime(ratio_ig))
    vol = _vol(prices[["TLT", "IEF", "HYG", "LQD"]])
    w = _full(prices)
    risk_on = reg > 0
    risk_off = reg < 0
    credit = hy.notna() & vol["HYG"].notna()
    cr_asset_w_hy = (1.0 / vol["HYG"]).where(risk_on & credit, 0.0)
    cr_asset_w_ig = (1.0 / vol["LQD"]).where(risk_on & ~credit, 0.0)
    w["HYG"] = cr_asset_w_hy.fillna(0.0)
    w["LQD"] = cr_asset_w_ig.fillna(0.0)
    w["TLT"] = (0.5 / vol["TLT"]).where(risk_off, 0.0).fillna(0.0)
    w["IEF"] = (0.5 / vol["IEF"]).where(risk_off, 0.0).fillna(0.0)
    return _rebalance(w, "W")


# --------------------------------------------------------------------------
# 6. Gold / real-rates & breakevens
# --------------------------------------------------------------------------

@register(
    sleeve="macro", name="gold_real_rates",
    rationale=("Gold is a zero-coupon real asset; its opportunity cost is the real yield. Falling real "
               "yields (TIP rallying) or rising breakevens (TIP outperforming IEF) are bullish for gold "
               "and silver, rising real yields bearish. Trade GLD (and SLV) long/short on the trailing "
               "change in the real-rate / breakeven proxy."),
    failure_condition=("Sharpe < 0.3, or the gold/real-rate link breaks (as in 2022-24 when central-bank "
                       "buying kept gold rising despite surging real yields), or no better than GLD trend alone."),
    params={"lookback": 63, "proxy": "real"},
    grid={"lookback": [42, 63, 126], "proxy": ["real", "breakeven"]},
)
def gold_real_rates(prices: pd.DataFrame, lookback: int = 63, proxy: str = "real") -> pd.DataFrame:
    if proxy == "real":
        s = prices["TIP"]                               # TIP up <=> real yields down
    else:
        s = prices["TIP"] / prices["IEF"]               # ratio up <=> breakevens widening
    sig = np.sign(_trailing_ret(s.to_frame(), lookback).iloc[:, 0])
    vol = _vol(prices[["GLD", "SLV"]])
    w = _full(prices)
    w["GLD"] = (sig * 0.7 / vol["GLD"]).fillna(0.0)
    w["SLV"] = (sig * 0.3 / vol["SLV"]).fillna(0.0)
    return _rebalance(w, "W")


# --------------------------------------------------------------------------
# 7. Curve / duration momentum (TLT vs SHY)
# --------------------------------------------------------------------------

@register(
    sleeve="macro", name="duration_momentum",
    rationale=("Rate cycles are persistent because central banks move in long, telegraphed cycles: "
               "when long duration has out-returned the front end over the trailing window, stay "
               "long duration (TLT), short when the front end has out-returned it; "
               "SHY is used only as the signal benchmark. Captures easing/tightening cycles and bull/bear steepeners."),
    failure_condition=("Sharpe < 0.3, or losses concentrated in sharp policy pivots (2013 taper tantrum, "
                       "2022), or performance indistinguishable from simply holding TLT."),
    params={"lookback": 126},
    grid={"lookback": [63, 126, 252]},
)
def duration_momentum(prices: pd.DataFrame, lookback: int = 126) -> pd.DataFrame:
    px = prices[["TLT", "SHY"]]
    excess = _trailing_ret(px, lookback)
    sig = np.sign(excess["TLT"] - excess["SHY"])
    vol = _vol(px)
    w = _full(prices)
    # Trade TLT only: the signal is the long-end return in excess of the front end (term-premium
    # momentum); a SHY hedge leg needs ~10x notional per unit risk and its costs swamp the edge.
    w["TLT"] = (sig / vol["TLT"]).fillna(0.0)
    return _rebalance(w, "W")
