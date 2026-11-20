"""b_macro sleeve: FX & rates strategies from Kakushadze & Serur, *151 Trading Strategies*.

Implemented as pre-registered in catalogue/book_protocol.md (section "b_macro").

Conventions
-----------
* Spot series (=X) are signals only and always get zero weight. JPY=X, CAD=X, CHF=X are
  inverted to USD per foreign unit, so every spot series S(t) is "worth of one foreign unit in
  USD", as in book eq. (440).
* FX positions are taken in the currency trusts FXE FXB FXA FXY FXC FXF (USD per foreign unit,
  adjusted close includes interest). NOT FROM BOOK: a long (short) trust position is funded
  (collateralised) with an opposite BIL position, so each FX leg earns the trust return minus the
  USD bill return, i.e. the return of a forward (book §8.2 trades forwards).
* FX strategies rebalance on the first trading day of each month using data up to that close
  (being the first day of a new month is known from the previous date, so no calendar look-ahead).
  The month-end sample used by the HP filter is the last close of each COMPLETED month.
* Positions are only taken in trusts that already have a price; spot gaps are forward-filled.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import sparse
from scipy.sparse.linalg import spsolve

from engine.core import register

SLEEVE = "b_macro"
# trust -> (spot ticker, invert spot?)
FX = {
    "FXE": ("EURUSD=X", False),
    "FXB": ("GBPUSD=X", False),
    "FXA": ("AUDUSD=X", False),
    "FXY": ("JPY=X", True),
    "FXC": ("CAD=X", True),
    "FXF": ("CHF=X", True),
}
TRUSTS = list(FX)
CASH = "BIL"
CARRY_WINDOW = 126          # protocol: 126-day carry proxy
HP_N = 12                   # monthly data -> n = 12, lambda = 100 n^2 (book §8.1)
HP_MIN_MONTHS = 36          # NOT FROM BOOK: "estimation period usually spans several years" -> 3y
DUR_TLT, DUR_SHY = 17.0, 1.9  # protocol-fixed durations
DUR_IEF = 7.5               # NOT FROM BOOK: IEF modified duration for the barbell match


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def _zeros(prices: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame(0.0, index=prices.index, columns=prices.columns)


def _spot_usd(prices: pd.DataFrame) -> pd.DataFrame:
    """Spot in USD per foreign unit, columns named by trust; gaps forward-filled."""
    out = {}
    for tr, (sp, inv) in FX.items():
        if sp in prices:
            s = prices[sp].ffill()
            out[tr] = 1.0 / s if inv else s
    return pd.DataFrame(out, index=prices.index)


def _trust_live(prices: pd.DataFrame) -> pd.DataFrame:
    """True from a trust's first price onward."""
    return pd.DataFrame({t: prices[t].ffill().notna() for t in TRUSTS if t in prices},
                        index=prices.index)


def _month_starts(index: pd.DatetimeIndex) -> pd.Series:
    """First trading day of each month in the index (determined from the previous date only)."""
    keys = index.to_period("M")
    first = pd.Series(np.r_[True, keys[1:] != keys[:-1]], index=index)
    return first


def _hold(w: pd.DataFrame, on: pd.Series) -> pd.DataFrame:
    """Set weights on rebalance dates, hold in between."""
    return w.where(on, np.nan).ffill().fillna(0.0)


def _add_cash_leg(w: pd.DataFrame, prices: pd.DataFrame) -> pd.DataFrame:
    """NOT FROM BOOK: offset net trust exposure with BIL (USD borrowing/lending leg)."""
    if CASH in prices:
        net = w[[t for t in TRUSTS if t in w]].sum(axis=1)
        live = prices[CASH].ffill().notna()
        w[CASH] = (-net).where(live, 0.0)
    return w


def _forward_discount(prices: pd.DataFrame) -> pd.DataFrame:
    """Carry proxy (NOT FROM BOOK, protocol data workaround), eq. 443: D ~ r_f - r_d.

    r_f = annualised 126d log return of trust minus 126d log return of spot (USD per unit).
    r_d = annualised 126d log return of BIL.
    """
    spot = _spot_usd(prices)
    ann = 252.0 / CARRY_WINDOW
    tr = prices[[t for t in TRUSTS if t in prices]].ffill()
    lt = np.log(tr / tr.shift(CARRY_WINDOW))
    ls = np.log(spot / spot.shift(CARRY_WINDOW))
    rf = (lt - ls[lt.columns]) * ann
    if CASH not in prices:
        return rf * np.nan
    bil = prices[CASH].ffill()
    rd = np.log(bil / bil.shift(CARRY_WINDOW)) * ann
    return rf.sub(rd, axis=0)


def _hp_last(y: np.ndarray, lam: float) -> float:
    """Last value of the HP trend of y (eqs. 437-439): solve (I + lam K'K) s = y."""
    n = len(y)
    K = sparse.diags([np.ones(n - 2), -2 * np.ones(n - 2), np.ones(n - 2)], [0, 1, 2],
                     shape=(n - 2, n))
    A = sparse.eye(n, format="csc") + lam * (K.T @ K).tocsc()
    return float(spsolve(A, y)[-1])


def _one_sided_hp_monthly(spot: pd.Series, lam: float, min_months: int) -> pd.Series:
    """One-sided HP: for each completed month-end t, fit on month-end data up to t only and keep
    the last filtered value. Indexed by month (Period)."""
    s = spot.dropna()
    me = s.groupby(s.index.to_period("M")).last()       # last close of each month, PeriodIndex
    vals = me.values
    out = np.full(len(vals), np.nan)
    for i in range(min_months - 1, len(vals)):
        out[i] = _hp_last(vals[: i + 1], lam)
    return pd.Series(out, index=me.index)


def _strategy_returns(w: pd.DataFrame, prices: pd.DataFrame) -> pd.Series:
    """Daily simple return of a weight book held from the previous close."""
    r = prices.pct_change(fill_method=None).fillna(0.0)
    return (w.shift(1).fillna(0.0) * r.reindex(columns=w.columns).fillna(0.0)).sum(axis=1)


# --------------------------------------------------------------------------
# §8.1 moving averages with HP filter
# --------------------------------------------------------------------------

@register(
    sleeve=SLEEVE, name="fx_ma_hp_filter",
    rationale=("151 §8.1: one-sided HP filter (lambda=100*12^2) on month-end FX spot, buy currency "
               "when MA(T1)>MA(T2) of the trend else sell, via currency trusts; NOT FROM BOOK: "
               "36m minimum fit, BIL funding leg."),
    failure_condition="Default Sharpe below 0 in-sample, or below an unfiltered 2-MA rule on the same trusts.",
    params={"months": (3, 12)}, grid={"months": [(3, 12), (1, 6)]},
    author="book-151", tags=["book"])
def fx_ma_hp_filter(prices: pd.DataFrame, months=(3, 12)) -> pd.DataFrame:
    t1, t2 = int(months[0]), int(months[1])
    lam = 100.0 * HP_N ** 2
    spot = _spot_usd(prices)
    live = _trust_live(prices)
    starts = _month_starts(prices.index)
    sig = pd.DataFrame(np.nan, index=prices.index, columns=spot.columns)
    for tr in spot.columns:
        hp = _one_sided_hp_monthly(spot[tr], lam, HP_MIN_MONTHS)
        ma1 = hp.rolling(t1, min_periods=t1).mean()
        ma2 = hp.rolling(t2, min_periods=t2).mean()
        s = np.sign(ma1 - ma2).where(ma1.notna() & ma2.notna())
        # month-end value becomes usable on the first trading day of the next month
        s.index = s.index + 1
        m = pd.Series(prices.index.to_period("M"), index=prices.index).map(s)
        sig[tr] = m.where(starts)
    w = _zeros(prices)
    sig = sig.where(live.reindex(columns=sig.columns, fill_value=False))
    n = sig.notna().sum(axis=1).replace(0, np.nan)
    wt = sig.div(n, axis=0)
    # carry the rebalance-date decision forward; a month with no valid signal -> flat
    wt.loc[starts.values] = wt.loc[starts.values].fillna(0.0)
    wt = wt.ffill().fillna(0.0)
    for tr in wt.columns:
        w[tr] = wt[tr]
    return _add_cash_leg(w, prices)


# --------------------------------------------------------------------------
# §8.2.1 high-minus-low carry
# --------------------------------------------------------------------------

@register(
    sleeve=SLEEVE, name="fx_hml_carry",
    rationale=("151 §8.2.1: long the top half of currencies by forward discount D, short the bottom "
               "half, equal weight, monthly; NOT FROM BOOK: D proxied from trust-vs-spot returns."),
    failure_condition="Default Sharpe below 0 in-sample, or crash losses exceeding twice the sleeve DD limit.",
    params={}, grid={}, author="book-151", tags=["book"])
def fx_hml_carry(prices: pd.DataFrame) -> pd.DataFrame:
    D = _forward_discount(prices)
    live = _trust_live(prices)
    starts = _month_starts(prices.index)
    D = D.where(live.reindex(columns=D.columns, fill_value=False))
    w = _zeros(prices)
    rows = {}
    for dt in prices.index[starts.values]:
        d = D.loc[dt].dropna()
        k = len(d) // 2
        row = pd.Series(0.0, index=TRUSTS)
        if k >= 1:
            d = d.sort_values()
            row[d.index[-k:]] = 1.0 / (2 * k)    # top half long
            row[d.index[:k]] = -1.0 / (2 * k)    # bottom half short (middle one out if odd)
        rows[dt] = row
    if rows:
        wt = pd.DataFrame(rows).T.reindex(prices.index).ffill().fillna(0.0)
        for tr in TRUSTS:
            if tr in w:
                w[tr] = wt[tr]
    return _add_cash_leg(w, prices)


# --------------------------------------------------------------------------
# §8.3 dollar carry
# --------------------------------------------------------------------------

@register(
    sleeve=SLEEVE, name="dollar_carry",
    rationale=("151 §8.3: long all foreign currencies equally when the average forward discount is "
               "positive, short all when negative, monthly; NOT FROM BOOK: D proxied, BIL leg."),
    failure_condition="Default Sharpe below 0 in-sample.",
    params={}, grid={}, author="book-151", tags=["book"])
def dollar_carry(prices: pd.DataFrame) -> pd.DataFrame:
    D = _forward_discount(prices)
    live = _trust_live(prices)
    starts = _month_starts(prices.index)
    D = D.where(live.reindex(columns=D.columns, fill_value=False))
    dbar = D.mean(axis=1)                                 # eq. 444 over available currencies
    n = D.notna().sum(axis=1).replace(0, np.nan)
    sgn = np.sign(dbar)
    wt = D.notna().astype(float).mul(sgn / n, axis=0)
    wt = wt.where(starts, np.nan, axis=0)
    wt.loc[starts.values] = wt.loc[starts.values].fillna(0.0)   # no signal at a rebalance -> flat
    wt = wt.ffill().fillna(0.0)
    w = _zeros(prices)
    for tr in wt.columns:
        w[tr] = wt[tr]
    return _add_cash_leg(w, prices)


# --------------------------------------------------------------------------
# §8.4 momentum & carry combo
# --------------------------------------------------------------------------

@register(
    sleeve=SLEEVE, name="fx_momentum_carry_combo",
    rationale=("151 §8.4: combine fx_ma_hp_filter and fx_hml_carry with min-variance weights "
               "(eqs. 451-452) from trailing 252d strategy returns; NOT FROM BOOK: monthly "
               "re-estimation."),
    failure_condition="Default Sharpe below the better of its two components in-sample.",
    params={}, grid={}, author="book-151", tags=["book"])
def fx_momentum_carry_combo(prices: pd.DataFrame) -> pd.DataFrame:
    W1 = fx_ma_hp_filter(prices)
    W2 = fx_hml_carry(prices)
    R1 = _strategy_returns(W1, prices)
    R2 = _strategy_returns(W2, prices)
    # a day counts once both strategies held a position over it
    both = (W1.shift(1).abs().sum(axis=1) > 0) & (W2.shift(1).abs().sum(axis=1) > 0)
    starts = _month_starts(prices.index)
    w1 = pd.Series(np.nan, index=prices.index)
    win = 252
    for i in np.flatnonzero(starts.values):
        if i + 1 < win:
            continue
        sl = slice(i + 1 - win, i + 1)                    # trailing 252 days up to and incl. t
        if not both.iloc[sl].all():
            continue
        a, b = R1.iloc[sl].values, R2.iloc[sl].values
        s1, s2 = a.std(ddof=1), b.std(ddof=1)
        if s1 == 0 or s2 == 0:
            continue
        rho = np.corrcoef(a, b)[0, 1]
        den = s1 ** 2 + s2 ** 2 - 2 * s1 * s2 * rho
        if den <= 1e-16:
            continue
        w1.iloc[i] = (s2 ** 2 - s1 * s2 * rho) / den      # eq. 451; w2 = 1 - w1 (eq. 452)
    w1 = w1.ffill()
    ok = w1.notna()
    w1 = w1.fillna(0.0)
    w = W1.mul(w1, axis=0) + W2.mul(1.0 - w1, axis=0)
    return w.where(ok, 0.0)


# --------------------------------------------------------------------------
# §5.13 yield curve spread (flatteners & steepeners)
# --------------------------------------------------------------------------

@register(
    sleeve=SLEEVE, name="curve_steepener_flattener",
    rationale=("151 §5.13: duration-matched SHY vs TLT spread trade; steepener (long SHY, short TLT) "
               "when the lookback change of TLT/SHY is negative, else flattener; NOT FROM BOOK: "
               "timing signal."),
    failure_condition="Default Sharpe below 0 in-sample.",
    params={"lookback": 63}, grid={"lookback": [63, 126]},
    author="book-151", tags=["book"])
def curve_steepener_flattener(prices: pd.DataFrame, lookback: int = 63) -> pd.DataFrame:
    w = _zeros(prices)
    if "TLT" not in prices or "SHY" not in prices:
        return w
    ratio = prices["TLT"] / prices["SHY"]
    mom = ratio / ratio.shift(lookback) - 1
    # +1 = steepener (buy spread: long front leg SHY, short back leg TLT), -1 = flattener
    side = pd.Series(np.where(mom < 0, 1.0, -1.0), index=prices.index).where(mom.notna(), 0.0)
    w["SHY"] = side * 1.0
    w["TLT"] = -side * DUR_SHY / DUR_TLT                  # equal dollar duration
    return w


# --------------------------------------------------------------------------
# §5.2-5.3 barbell vs bullet
# --------------------------------------------------------------------------

@register(
    sleeve=SLEEVE, name="barbell_vs_bullet",
    rationale=("151 §5.2-5.3: long a SHY+TLT barbell duration-matched to the IEF bullet, short IEF, "
               "when the barbell's 126d return beats the bullet's, else flat; NOT FROM BOOK: timing, "
               "IEF duration 7.5."),
    failure_condition="Default Sharpe below 0 in-sample.",
    params={"lookback": 126}, grid={},
    author="book-151", tags=["book"])
def barbell_vs_bullet(prices: pd.DataFrame, lookback: int = 126) -> pd.DataFrame:
    w = _zeros(prices)
    if not {"SHY", "TLT", "IEF"} <= set(prices.columns):
        return w
    b = (DUR_IEF - DUR_SHY) / (DUR_TLT - DUR_SHY)         # TLT share; SHY share 1-b (eq. 390)
    a = 1.0 - b
    r = prices[["SHY", "TLT", "IEF"]] / prices[["SHY", "TLT", "IEF"]].shift(lookback) - 1
    barbell = a * r["SHY"] + b * r["TLT"]
    on = (barbell > r["IEF"]).astype(float).where(barbell.notna() & r["IEF"].notna(), 0.0)
    w["SHY"] = a * on
    w["TLT"] = b * on
    w["IEF"] = -1.0 * on
    return w
