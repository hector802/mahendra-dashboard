"""Book sleeve b_vol: Kakushadze & Serur, *151 Trading Strategies* (2018), §6.5 and §7.2-7.4.

Implemented exactly as pre-registered in catalogue/book_protocol.md (section
"b_vol · 151 · Volatility"). Conventions:
  * Every signal uses closes up to and including date t; the engine lags
    weights one day. Path-dependent rules (threshold rebalancing, the eq. 431
    open/close rule) are explicit state machines that walk forward through the
    dates, so truncating the data never changes earlier weights.
  * ^VIX / ^VIX3M are signals only (the engine zeroes their weights).
  * An instrument gets weight 0 on days it has no price (before inception).
  * "Month start" = first trading day of a calendar month, detected by
    comparing with the previous row's date (never by peeking at the next row).
"""
import numpy as np
import pandas as pd

from engine.core import register

ANN = np.sqrt(252)


def _empty(prices: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame(0.0, index=prices.index, columns=prices.columns)


def _cash_leg(prices: pd.DataFrame) -> pd.Series:
    """Name of the risk-free leg each day: BIL once it trades, SHY before.

    NOT FROM BOOK: SHY stands in for T-bills before BIL exists (May 2007).
    """
    return pd.Series(np.where(prices["BIL"].notna(), "BIL", "SHY"), index=prices.index)


def _month_starts(index: pd.DatetimeIndex) -> np.ndarray:
    per = index.to_period("M")
    first = np.ones(len(index), dtype=bool)
    first[1:] = per[1:] != per[:-1]
    return first


# --------------------------------------------------------------------------
# §6.5 Index volatility targeting with risk-free asset
# --------------------------------------------------------------------------
@register(
    sleeve="b_vol", name="index_vol_targeting",
    rationale=("151 §6.5: w_SPY = sigma*/sigma (21d realised), capped at L=1.5 (fn. 121), rest "
               "1-w in T-bills (BIL; NOT FROM BOOK: SHY before BIL exists); rebalance only when "
               "|dw|/w since last rebalance > kappa."),
    failure_condition=("In-sample Sharpe below buy-and-hold SPY's, or max drawdown worse than "
                       "2.5x the 8% sleeve budget."),
    params={"sigma_target": 0.15, "kappa": 0.10, "window": 21, "max_lev": 1.5},
    grid={"kappa": [0.05, 0.10, 0.20]},
    author="book-151", tags=["book"],
)
def index_vol_targeting(prices: pd.DataFrame, sigma_target: float = 0.15, kappa: float = 0.10,
                        window: int = 21, max_lev: float = 1.5) -> pd.DataFrame:
    w = _empty(prices)
    r = prices["SPY"].pct_change(fill_method=None)
    sigma = r.rolling(window, min_periods=window).std() * ANN
    target = (sigma_target / sigma).clip(upper=max_lev).values
    cash = _cash_leg(prices).values
    spy_w = np.zeros(len(prices))
    cur = np.nan
    for t in range(len(prices)):
        tgt = target[t]
        if np.isnan(tgt):
            spy_w[t] = 0.0 if np.isnan(cur) else cur
            continue
        if np.isnan(cur) or abs(tgt - cur) / cur > kappa:
            cur = tgt
        spy_w[t] = cur
    w["SPY"] = spy_w
    rest = 1.0 - spy_w                       # negative when levered (borrowing at the bill rate)
    active = spy_w != 0
    w["BIL"] = np.where(active & (cash == "BIL"), rest, 0.0)
    w["SHY"] = np.where(active & (cash == "SHY"), rest, 0.0)
    return w


# --------------------------------------------------------------------------
# §7.2 VIX futures basis trading (proxy)
# --------------------------------------------------------------------------
@register(
    sleeve="b_vol", name="vix_basis_proxy",
    rationale=("151 §7.2: eq. 431 on D=B/T; NOT FROM BOOK: UX1 unavailable so B=VIX3M-VIX, T=42, "
               "short UX1 -> long SVXY, long UX1 -> long VIXY; flat = no position."),
    failure_condition=("In-sample Sharpe < 0.3, or max drawdown worse than 2.5x the 8% sleeve "
                       "budget (e.g. caught long SVXY into Feb 2018 / Mar 2020)."),
    params={"open_th": 0.10, "close_th": 0.05, "T": 42},
    grid={},
    author="book-151", tags=["book"],
)
def vix_basis_proxy(prices: pd.DataFrame, open_th: float = 0.10, close_th: float = 0.05,
                    T: int = 42) -> pd.DataFrame:
    w = _empty(prices)
    D = ((prices["^VIX3M"] - prices["^VIX"]) / T).values
    state = 0                                 # +1 = long vol (VIXY), -1 = short vol (SVXY), 0 flat
    pos = np.zeros(len(prices))
    for t in range(len(prices)):
        d = D[t]
        if not np.isnan(d):
            if state == 1 and d > -close_th:
                state = 0
            elif state == -1 and d < close_th:
                state = 0
            if state == 0:
                if d < -open_th:
                    state = 1
                elif d > open_th:
                    state = -1
        pos[t] = state
    w["VIXY"] = np.where((pos == 1) & prices["VIXY"].notna().values, 1.0, 0.0)
    w["SVXY"] = np.where((pos == -1) & prices["SVXY"].notna().values, 1.0, 0.0)
    return w


# --------------------------------------------------------------------------
# §7.3 Volatility carry with two ETNs
# --------------------------------------------------------------------------
@register(
    sleeve="b_vol", name="vol_carry_two_etns",
    rationale=("151 §7.3: short VIXY (for VXX), long h VIXM (for VXZ), h = rho*sigma_X/sigma_Z "
               "(fn. 131) = OLS beta of VIXY on VIXM returns over trailing window; monthly."),
    failure_condition=("In-sample Sharpe < 0.3, or max drawdown worse than 2.5x the 8% sleeve "
                       "budget (short-term VXX spikes the book warns about)."),
    params={"window": 126},
    grid={"window": [63, 126]},
    author="book-151", tags=["book"],
)
def vol_carry_two_etns(prices: pd.DataFrame, window: int = 126) -> pd.DataFrame:
    w = _empty(prices)
    x = prices["VIXY"].pct_change(fill_method=None)
    z = prices["VIXM"].pct_change(fill_method=None)
    beta = (x.rolling(window, min_periods=window).cov(z)
            / z.rolling(window, min_periods=window).var()).values
    ms = _month_starts(prices.index)
    h = np.zeros(len(prices))
    cur = np.nan
    for t in range(len(prices)):
        if ms[t] and not np.isnan(beta[t]):
            cur = beta[t]
        h[t] = 0.0 if np.isnan(cur) else cur
    live = (h != 0) & prices["VIXY"].notna().values & prices["VIXM"].notna().values
    w["VIXY"] = np.where(live, -1.0, 0.0)
    w["VIXM"] = np.where(live, h, 0.0)
    return w


# --------------------------------------------------------------------------
# §7.4 Volatility risk premium
# --------------------------------------------------------------------------
@register(
    sleeve="b_vol", name="vol_risk_premium",
    rationale=("151 §7.4: at month start spread = VIX - realised SPY vol (%) since start of previous "
               "month; spread>0 hold SVXY for the month else BIL. NOT FROM BOOK: SVXY stands in for "
               "short straddles; SHY before BIL."),
    failure_condition=("In-sample Sharpe < 0.3, or max drawdown worse than 2.5x the 8% sleeve "
                       "budget (vol spikes the book says this loses in)."),
    params={},
    grid={},
    author="book-151", tags=["book"],
)
def vol_risk_premium(prices: pd.DataFrame) -> pd.DataFrame:
    w = _empty(prices)
    idx = prices.index
    r = prices["SPY"].pct_change(fill_method=None).values
    vix = prices["^VIX"].values
    ms = _month_starts(idx)
    svxy_ok = prices["SVXY"].notna().values
    cash = _cash_leg(prices).values
    hold = np.full(len(idx), "", dtype=object)
    cur = ""
    prev_start = None
    for t in range(len(idx)):
        if ms[t]:
            if prev_start is not None:
                # returns dated from the previous month's first trading day up to today
                rv = np.nanstd(r[prev_start:t + 1], ddof=1) * ANN * 100.0
                spread = vix[t] - rv
                cur = "SVXY" if (not np.isnan(spread) and spread > 0) else "CASH"
            prev_start = t
        hold[t] = cur
    # Strategy only runs once its instrument (SVXY) exists; no T-bill pre-history.
    w["SVXY"] = np.where((hold == "SVXY") & svxy_ok, 1.0, 0.0)
    is_cash = (hold == "CASH") & svxy_ok
    w["BIL"] = np.where(is_cash & (cash == "BIL"), 1.0, 0.0)
    w["SHY"] = np.where(is_cash & (cash == "SHY"), 1.0, 0.0)
    return w
