"""Volatility sleeve hypotheses.

Conventions used throughout:
  * Every signal is computed from closes up to and including date t (rolling /
    ewm windows only, never full-sample statistics). The engine lags weights
    by one day, so a decision made on the close of t is traded at t+1.
  * ^VIX / ^VIX3M are used as signals only (the engine zeroes their weights).
  * Tradable legs that did not yet exist (SVXY / VIXY before Oct 2011) are NaN;
    a weight is only placed on an asset when its price is available that day.
  * Risky short-vol legs are sized internally by inverse trailing realised vol
    (using the larger of a short and a long window) so that the engine's own
    63-day vol-target overlay does not lever a freshly entered SVXY position
    based on a quiet cash/SHY history. The engine still vol-targets to 10%.
"""
import numpy as np
import pandas as pd

from engine.core import register

ANN = np.sqrt(252)


def _empty(prices: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame(0.0, index=prices.index, columns=prices.columns)


def _rvol(px: pd.Series, short: int = 20, long: int = 63) -> pd.Series:
    """Conservative annualised realised vol: max of short and long windows."""
    r = px.pct_change(fill_method=None)
    s = r.rolling(short, min_periods=short).std() * ANN
    l = r.rolling(long, min_periods=short).std() * ANN
    return pd.concat([s, l], axis=1).max(axis=1)


def _ts_ratio(prices: pd.DataFrame, smooth: int = 1) -> pd.Series:
    """VIX / VIX3M. < 1 = contango (normal), > 1 = backwardation (stress)."""
    ratio = prices["^VIX"] / prices["^VIX3M"]
    if smooth > 1:
        ratio = ratio.rolling(smooth, min_periods=smooth).mean()
    return ratio


def _put(w: pd.DataFrame, col: str, value: pd.Series, prices: pd.DataFrame) -> None:
    """Assign weight only where the asset has a price (handles pre-inception NaN)."""
    w[col] = value.where(prices[col].notna(), 0.0).fillna(0.0)


# --------------------------------------------------------------------------
# 1. Term-structure carry: short VIX futures only in sufficiently steep contango
# --------------------------------------------------------------------------
@register(
    sleeve="vol", name="ts_carry_svxy",
    rationale=("Short-dated VIX futures roll down a contango curve, so short-VIX ETFs earn a "
               "roll yield / insurance premium; harvest it only when VIX/VIX3M is clearly "
               "below 1 and step aside to SHY when the curve flattens or inverts, which "
               "historically precedes or coincides with vol spikes."),
    failure_condition=("In-sample Sharpe < 0.5, or max drawdown worse than 2x the 8% sleeve "
                       "budget, or a single-day loss > 5% after vol targeting (i.e. the curve "
                       "filter fails to get us out before a spike like Feb 2018 / Mar 2020)."),
    params={"threshold": 0.92, "smooth": 3, "target": 0.15},
    grid={"threshold": [0.88, 0.92, 0.96], "smooth": [1, 3]},
)
def ts_carry_svxy(prices: pd.DataFrame, threshold: float = 0.92, smooth: int = 3,
                  target: float = 0.15) -> pd.DataFrame:
    w = _empty(prices)
    ratio = _ts_ratio(prices, smooth)
    on = (ratio < threshold)
    size = (target / _rvol(prices["SVXY"])).clip(upper=1.0)
    svxy = size.where(on, 0.0)
    _put(w, "SVXY", svxy, prices)
    # Residual in SHY only once SVXY exists: no levered-T-bill pre-history that
    # would flatter the backtest before the hypothesis is even tradable.
    _put(w, "SHY", (1.0 - w["SVXY"]).clip(lower=0.0).where(prices["SVXY"].notna(), 0.0), prices)
    return w


# --------------------------------------------------------------------------
# 2. Variance-risk-premium timing of equity beta (covers 2005+, incl. 2008)
# --------------------------------------------------------------------------
@register(
    sleeve="vol", name="vrp_spy_timing",
    rationale=("When implied vol (VIX) sits well above trailing realised SPY vol, option "
               "sellers are being paid a large insurance premium and forward equity returns "
               "per unit risk are higher; when realised exceeds implied (negative VRP) the "
               "market is in a disorderly regime, so hold Treasuries instead."),
    failure_condition=("Sharpe < 0.5 or not better than a SPY 200d-trend benchmark on a "
                       "risk-adjusted basis; drawdown worse than 16%."),
    params={"rv_window": 21, "threshold": 0.0, "smooth": 5},
    grid={"rv_window": [10, 21], "threshold": [-2.0, 0.0, 2.0]},
)
def vrp_spy_timing(prices: pd.DataFrame, rv_window: int = 21, threshold: float = 0.0,
                   smooth: int = 5) -> pd.DataFrame:
    w = _empty(prices)
    spy_r = prices["SPY"].pct_change(fill_method=None)
    rv = spy_r.rolling(rv_window, min_periods=rv_window).std() * ANN * 100.0
    vrp = (prices["^VIX"] - rv)
    if smooth > 1:
        vrp = vrp.rolling(smooth, min_periods=smooth).mean()
    on = vrp > threshold
    valid = vrp.notna()
    _put(w, "SPY", on.astype(float).where(valid, 0.0), prices)
    _put(w, "TLT", ((~on) & valid).astype(float), prices)
    return w


# --------------------------------------------------------------------------
# 3. VIX-spike mean reversion into SPY
# --------------------------------------------------------------------------
@register(
    sleeve="vol", name="vix_spike_reversion",
    rationale=("Fear spikes overshoot: forced deleveraging and hedging demand push VIX far "
               "above its recent norm, after which VIX mean-reverts and equities rebound. "
               "Buy SPY once a spike (VIX z-score vs trailing 60d) has peaked and VIX has "
               "begun to fall, hold for a fixed horizon, otherwise sit in SHY."),
    failure_condition=("Sharpe < 0.5, or most of the PnL coming from a single episode, or "
                       "losses concentrated in prolonged bear markets (2008) where spikes "
                       "keep re-occurring."),
    params={"z_entry": 2.0, "hold": 20, "off_peak": 0.10},
    grid={"z_entry": [1.5, 2.0, 2.5], "hold": [10, 20]},
)
def vix_spike_reversion(prices: pd.DataFrame, z_entry: float = 2.0, hold: int = 20,
                        off_peak: float = 0.10) -> pd.DataFrame:
    w = _empty(prices)
    vix = prices["^VIX"]
    mu = vix.rolling(60, min_periods=60).mean()
    sd = vix.rolling(60, min_periods=60).std()
    z = (vix - mu) / sd
    spiked = (z.rolling(10, min_periods=1).max() > z_entry)          # spike within last 2 weeks
    peak = vix.rolling(10, min_periods=1).max()
    fading = vix < peak * (1.0 - off_peak)                            # VIX has come off its peak
    trigger = (spiked & fading).astype(float)
    # Hold SPY for `hold` days after the latest trigger.
    active = trigger.rolling(hold, min_periods=1).max().fillna(0.0)
    _put(w, "SPY", active, prices)
    _put(w, "SHY", 1.0 - active, prices)
    return w


# --------------------------------------------------------------------------
# 4. Volatility-managed SPY (Moreira & Muir 2017)
# --------------------------------------------------------------------------
@register(
    sleeve="vol", name="vol_managed_spy",
    rationale=("Equity volatility is persistent but its expected return is not proportional, "
               "so scaling SPY exposure by inverse recent variance raises Sharpe and, by "
               "cutting exposure as vol clusters, shortens drawdowns. Residual cash in SHY."),
    failure_condition=("Sharpe not above unmanaged SPY over the same window, or drawdown "
                       "worse than 16% (scaling reacts too slowly to gap-down crashes)."),
    params={"window": 21, "power": 2, "ref_vol": 0.15},
    grid={"window": [10, 21, 42], "power": [1, 2]},
)
def vol_managed_spy(prices: pd.DataFrame, window: int = 21, power: int = 2,
                    ref_vol: float = 0.15) -> pd.DataFrame:
    w = _empty(prices)
    r = prices["SPY"].pct_change(fill_method=None)
    rv = r.ewm(span=window, min_periods=window).std() * ANN
    expo = ((ref_vol / rv) ** power).clip(upper=1.0)
    _put(w, "SPY", expo, prices)
    _put(w, "SHY", (1.0 - w["SPY"]).clip(lower=0.0), prices)
    return w


# --------------------------------------------------------------------------
# 5. Term-structure regime rotation with a crisis hedge
# --------------------------------------------------------------------------
@register(
    sleeve="vol", name="ts_regime_hedge",
    rationale=("An inverted VIX curve (VIX > VIX3M) marks acute stress in which equities "
               "have negative drift and duration / long-vol rally. Hold SPY in contango; "
               "switch to TLT plus a small long-VIX (VIXY) sleeve in backwardation to convert "
               "crisis convexity into return. VIXY is only held while inverted because it "
               "decays heavily in contango."),
    failure_condition=("Sharpe < 0.5, or whipsaw costs around ratio ~1 dominating, or the "
                       "VIXY leg having negative contribution in stress episodes."),
    params={"threshold": 1.0, "vixy_frac": 0.1, "smooth": 3},
    grid={"threshold": [0.95, 1.0], "vixy_frac": [0.0, 0.1, 0.2]},
)
def ts_regime_hedge(prices: pd.DataFrame, threshold: float = 1.0, vixy_frac: float = 0.1,
                    smooth: int = 3) -> pd.DataFrame:
    w = _empty(prices)
    ratio = _ts_ratio(prices, smooth)
    valid = ratio.notna()
    stress = (ratio > threshold) & valid
    calm = (~stress) & valid
    _put(w, "SPY", calm.astype(float), prices)
    vixy_ok = prices["VIXY"].notna()
    vixy = (stress & vixy_ok).astype(float) * vixy_frac
    _put(w, "VIXY", vixy, prices)
    _put(w, "TLT", stress.astype(float) - w["VIXY"], prices)
    return w


# --------------------------------------------------------------------------
# 6. Combined carry: term structure AND VRP must both favour short vol
# --------------------------------------------------------------------------
@register(
    sleeve="vol", name="vrp_carry_svxy",
    rationale=("Short-vol carry pays when two independent premia agree: the futures curve "
               "is in contango (roll yield) and implied vol exceeds realised vol (insurance "
               "premium). Requiring both, plus VIX not in an uptrend vs its 10d mean, should "
               "cut exposure ahead of vol shocks more reliably than either signal alone."),
    failure_condition=("Not improving drawdown vs ts_carry_svxy, Sharpe < 0.5, or "
                       "correlation > 0.85 with ts_carry_svxy (redundant)."),
    params={"ts_threshold": 0.95, "vrp_threshold": 2.0, "target": 0.15},
    grid={"ts_threshold": [0.92, 0.95, 1.0], "vrp_threshold": [0.0, 2.0]},
)
def vrp_carry_svxy(prices: pd.DataFrame, ts_threshold: float = 0.95,
                   vrp_threshold: float = 2.0, target: float = 0.15) -> pd.DataFrame:
    w = _empty(prices)
    vix = prices["^VIX"]
    ratio = _ts_ratio(prices, 1)
    spy_r = prices["SPY"].pct_change(fill_method=None)
    rv = spy_r.rolling(10, min_periods=10).std() * ANN * 100.0
    vrp = vix - rv
    calm_trend = vix <= vix.rolling(10, min_periods=10).mean() * 1.05
    on = (ratio < ts_threshold) & (vrp > vrp_threshold) & calm_trend
    size = (target / _rvol(prices["SVXY"])).clip(upper=1.0)
    _put(w, "SVXY", size.where(on, 0.0), prices)
    # Residual in SHY only once SVXY exists: no levered-T-bill pre-history that
    # would flatter the backtest before the hypothesis is even tradable.
    _put(w, "SHY", (1.0 - w["SVXY"]).clip(lower=0.0).where(prices["SVXY"].notna(), 0.0), prices)
    return w
