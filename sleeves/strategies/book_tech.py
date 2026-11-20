"""b_tech: technical rules from Kakushadze & Serur, 151 Trading Strategies (2018), ch. 3.

Implemented exactly as pre-registered in catalogue/book_protocol.md (section b_tech).
Single-instrument rules (3.11-3.15) run on SPY QQQ IWM DIA EFA EEM, 1/6 weight each,
sign +1/-1/0 from the book's signal. Cross-sectional rules (3.1, 3.4, 3.7) rebalance on
the first trading day of each month and hold weights in between.

Time convention (book eq. 319-331): P = price at t=0 (today's close); MA/channel are
computed over P(1..T), i.e. the T closes BEFORE today. Monthly convention (eq. 266-267):
at a rebalance on the first trading day of month M, P(0) = close at end of month M-1,
P(t) = close at end of month M-1-t. All signals use data up to the current close only.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from engine.core import register

SINGLE = ["SPY", "QQQ", "IWM", "DIA", "EFA", "EEM"]
SECTORS = ["XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLU", "XLV", "XLY"]
XS15 = SECTORS + SINGLE

FAIL_TS = "Default Sharpe < 0 in-sample, or below buy-and-hold of the same six ETFs over a full cycle."
FAIL_XS = "Long-short spread Sharpe <= 0 in-sample (the anomaly is absent in ETFs)."


# --------------------------------------------------------------------------- helpers

def _cols(prices: pd.DataFrame, names: list[str]) -> list[str]:
    return [c for c in names if c in prices.columns]


def _hold_signal(raw: pd.DataFrame) -> pd.DataFrame:
    """raw: +1 / -1 = establish (reversing any opposite position), NaN = keep previous.
    Flat before the first signal."""
    return raw.ffill().fillna(0.0)


def _single_weights(prices: pd.DataFrame, sig: pd.DataFrame) -> pd.DataFrame:
    """Equal weight 1/6 per instrument; no position where today's price is missing."""
    w = pd.DataFrame(0.0, index=prices.index, columns=prices.columns)
    cols = _cols(prices, SINGLE)
    s = sig[cols].where(prices[cols].notna(), 0.0).fillna(0.0)
    w[cols] = s / len(SINGLE)
    return w


def _month_ends(prices: pd.DataFrame) -> pd.DataFrame:
    """Close on the last trading day of each calendar month (NaN if missing that day),
    indexed by monthly Period."""
    per = prices.index.to_period("M")
    last = pd.Series(prices.index, index=prices.index).groupby(per).max()
    me = prices.loc[last.values]
    me.index = last.index
    return me


def _rebalance_dates(index: pd.DatetimeIndex) -> pd.DatetimeIndex:
    s = pd.Series(index, index=index)
    return pd.DatetimeIndex(s.groupby(index.to_period("M")).min().values)


def _thirds(score: pd.Series) -> pd.Series:
    """Dollar-neutral: long top third, short bottom third, w = +-1/(2N) (book eq. 272-273)."""
    score = score.dropna()
    n = len(score) // 3
    out = pd.Series(0.0, index=score.index)
    if n < 1:
        return out
    r = score.sort_values(ascending=False)
    out[r.index[:n]] = 1.0 / (2 * n)
    out[r.index[-n:]] = -1.0 / (2 * n)
    return out


def _monthly_xs(prices: pd.DataFrame, score_fn) -> pd.DataFrame:
    """score_fn(date, month_period) -> weight Series; held until next rebalance."""
    w = pd.DataFrame(np.nan, index=prices.index, columns=prices.columns)
    for d in _rebalance_dates(prices.index):
        row = pd.Series(0.0, index=prices.columns)
        ws = score_fn(d, d.to_period("M"))
        if ws is not None and len(ws):
            row[ws.index] = ws.values
        w.loc[d] = row
    return w.ffill().fillna(0.0)


# --------------------------------------------------------------------------- 3.11 - 3.15

@register(sleeve="b_tech", name="single_moving_average",
          rationale="151 §3.11 (eq. 319, 321): long if P > SMA(T), short if P < SMA(T), SMA over the T "
                    "prior closes, on SPY QQQ IWM DIA EFA EEM at 1/6 each. Book gives no typical T or range "
                    "(only 'T usually measured in trading days'); NOT FROM BOOK: T=200d per protocol fallback, "
                    "no grid because the book states no range; SMA rather than EMA (book allows either).",
          failure_condition=FAIL_TS,
          params={"T": 200}, grid={}, author="book-151", tags=["book"])
def single_moving_average(prices: pd.DataFrame, T: int = 200) -> pd.DataFrame:
    cols = _cols(prices, SINGLE)
    p = prices[cols]
    ma = p.rolling(T, min_periods=T).mean().shift(1)
    raw = pd.DataFrame(np.where(p > ma, 1.0, np.where(p < ma, -1.0, np.nan)), index=p.index, columns=cols)
    return _single_weights(prices, _hold_signal(raw))


@register(sleeve="b_tech", name="two_moving_averages",
          rationale="151 §3.12 (eq. 322): long if SMA(T') > SMA(T), short if SMA(T') < SMA(T); book: "
                    "'e.g., T'=10 and T=30' (only pair given, so no grid). Stop-loss variant eq. 323 "
                    "(Delta=2%) not used: protocol names the plain rule.",
          failure_condition=FAIL_TS,
          params={"T_short": 10, "T_long": 30}, grid={}, author="book-151", tags=["book"])
def two_moving_averages(prices: pd.DataFrame, T_short: int = 10, T_long: int = 30) -> pd.DataFrame:
    cols = _cols(prices, SINGLE)
    p = prices[cols]
    a = p.rolling(T_short, min_periods=T_short).mean().shift(1)
    b = p.rolling(T_long, min_periods=T_long).mean().shift(1)
    raw = pd.DataFrame(np.where(a > b, 1.0, np.where(a < b, -1.0, np.nan)), index=p.index, columns=cols)
    return _single_weights(prices, _hold_signal(raw))


@register(sleeve="b_tech", name="three_moving_averages",
          rationale="151 §3.13 (eq. 324): long if MA1>MA2>MA3, liquidate long if MA1<=MA2, short if "
                    "MA1<MA2<MA3, liquidate short if MA1>=MA2; book: 'e.g., T1=3, T2=10, T3=21' "
                    "(only triple given, so no grid).",
          failure_condition=FAIL_TS,
          params={"T1": 3, "T2": 10, "T3": 21}, grid={}, author="book-151", tags=["book"])
def three_moving_averages(prices: pd.DataFrame, T1: int = 3, T2: int = 10, T3: int = 21) -> pd.DataFrame:
    cols = _cols(prices, SINGLE)
    p = prices[cols]
    m1 = p.rolling(T1, min_periods=T1).mean().shift(1).values
    m2 = p.rolling(T2, min_periods=T2).mean().shift(1).values
    m3 = p.rolling(T3, min_periods=T3).mean().shift(1).values
    n, k = p.shape
    out = np.zeros((n, k))
    pos = np.zeros(k)
    for t in range(n):
        for j in range(k):
            a, b, c = m1[t, j], m2[t, j], m3[t, j]
            if np.isnan(a) or np.isnan(b) or np.isnan(c):
                continue                                   # no new info: keep position
            if pos[j] > 0 and a <= b:
                pos[j] = 0.0
            elif pos[j] < 0 and a >= b:
                pos[j] = 0.0
            if a > b > c:
                pos[j] = 1.0
            elif a < b < c:
                pos[j] = -1.0
        out[t] = pos
    sig = pd.DataFrame(out, index=p.index, columns=cols)
    return _single_weights(prices, sig)


@register(sleeve="b_tech", name="support_resistance",
          rationale="151 §3.14 (eq. 325-328): pivot C=(H+L+C)/3 of the previous day, R=2C-L, S=2C-H; long if "
                    "P>C, liquidate long if P>=R, short if P<C, liquidate short if P<=S. NOT FROM BOOK: P = "
                    "today's (unadjusted) close, since the engine trades at the close; same-day R/S hits "
                    "mean flat.",
          failure_condition=FAIL_TS,
          params={}, grid={}, author="book-151", tags=["book"])
def support_resistance(prices: pd.DataFrame) -> pd.DataFrame:
    from engine.data import get_hilo
    cols = _cols(prices, SINGLE)
    sig = pd.DataFrame(0.0, index=prices.index, columns=cols)
    for c in cols:
        try:
            h = get_hilo(c)
        except Exception:  # noqa: BLE001  (no H/L data: stay flat in this instrument)
            continue
        h = h[~h.index.duplicated(keep="last")].reindex(prices.index)   # never see rows past the cut
        prev = h.shift(1)
        C = (prev["high"] + prev["low"] + prev["close"]) / 3.0
        R = 2 * C - prev["low"]
        S = 2 * C - prev["high"]
        P = h["close"]
        pos = np.full(len(P), np.nan)
        # Applying eq. 328 in order: establish on side of C, then liquidate if beyond R / S.
        pos[(P > C).values] = 1.0
        pos[(P < C).values] = -1.0
        pos[((P >= R) & (P > C)).values] = 0.0
        pos[((P <= S) & (P < C)).values] = 0.0
        s = pd.Series(pos, index=prices.index)
        valid = (P.notna() & C.notna()).values
        s[~valid] = np.nan
        sig[c] = s.ffill().fillna(0.0)
    return _single_weights(prices, sig)


@register(sleeve="b_tech", name="channel",
          rationale="151 §3.15 (eq. 329-331): Donchian channel over the T prior closes; long when P reaches "
                    "the floor (P<=B_down), short when P reaches the ceiling (P>=B_up), hold otherwise. Book "
                    "gives no typical T; NOT FROM BOOK: T=20d (Donchian's 20-day rule), no grid.",
          failure_condition=FAIL_TS,
          params={"T": 20}, grid={}, author="book-151", tags=["book"])
def channel(prices: pd.DataFrame, T: int = 20) -> pd.DataFrame:
    cols = _cols(prices, SINGLE)
    p = prices[cols]
    up = p.rolling(T, min_periods=T).max().shift(1)
    dn = p.rolling(T, min_periods=T).min().shift(1)
    raw = pd.DataFrame(np.where(p <= dn, 1.0, np.where(p >= up, -1.0, np.nan)), index=p.index, columns=cols)
    return _single_weights(prices, _hold_signal(raw))


# --------------------------------------------------------------------------- 3.1, 3.4, 3.7

@register(sleeve="b_tech", name="price_momentum_etf",
          rationale="151 §3.1 (eq. 267, 272-273): rank 9 sector SPDRs + 6 index ETFs by R_cum over T months "
                    "skipping S=1 month (book: 'usually T=12', 'usually S=1'); long top third, short bottom "
                    "third, w=+-1/(2N), monthly 1-month hold. NOT FROM BOOK: thirds = floor(n/3) of ETFs "
                    "with data.",
          failure_condition=FAIL_XS,
          params={"T": 12, "S": 1}, grid={"T": [6, 12]}, author="book-151", tags=["book"])
def price_momentum_etf(prices: pd.DataFrame, T: int = 12, S: int = 1) -> pd.DataFrame:
    cols = _cols(prices, XS15)
    me = _month_ends(prices[cols])

    def score(d, M):
        p0 = M - 1                       # P(0) = end of month M-1
        a, b = p0 - S, p0 - S - T        # P(S), P(S+T)
        if b not in me.index or a not in me.index:
            return None
        return _thirds(me.loc[a] / me.loc[b] - 1.0)

    return _monthly_xs(prices, score)


@register(sleeve="b_tech", name="low_vol_anomaly_etf",
          rationale="151 §3.4: long lowest-volatility third, short highest-volatility third of the same 15 ETFs, "
                    "sigma = std of daily returns over 252d (book: '126 trading days to a year (252 trading "
                    "days)'; protocol fixes 252), monthly, no skip. NOT FROM BOOK: monthly hold (book: hold "
                    "similar to the 6-12m sample) per protocol.",
          failure_condition=FAIL_XS,
          params={"window": 252}, grid={}, author="book-151", tags=["book"])
def low_vol_anomaly_etf(prices: pd.DataFrame, window: int = 252) -> pd.DataFrame:
    cols = _cols(prices, XS15)
    vol = prices[cols].pct_change(fill_method=None).rolling(window, min_periods=window).std()

    def score(d, M):
        return _thirds(-vol.loc[d])

    return _monthly_xs(prices, score)


@register(sleeve="b_tech", name="residual_momentum_etf",
          rationale="151 §3.7 (eq. 278-279): per sector SPDR regress monthly returns on SPY with intercept over "
                    "36 months skipping 1 (book: '36-month period ... with the 1-month skip period'), residuals "
                    "(alpha excluded) over the 12-1m formation period (book: S=1, T=12); long top 3 / short "
                    "bottom 3 by summed residual, +-1/6, monthly. NOT FROM BOOK: SPY single factor in place of "
                    "FF3 and raw rather than excess returns (protocol / no T-bill data); rank on residual "
                    "return per protocol, not eq. 281 risk-adjusted.",
          failure_condition=FAIL_XS,
          params={"reg_months": 36, "T": 12, "S": 1, "n_side": 3}, grid={}, author="book-151", tags=["book"])
def residual_momentum_etf(prices: pd.DataFrame, reg_months: int = 36, T: int = 12, S: int = 1,
                          n_side: int = 3) -> pd.DataFrame:
    cols = _cols(prices, SECTORS)
    if "SPY" not in prices.columns or not cols:
        return pd.DataFrame(0.0, index=prices.index, columns=prices.columns)
    me = _month_ends(prices[cols + ["SPY"]])
    mr = me / me.shift(1) - 1.0                      # R(month m) = P(end m)/P(end m-1) - 1
    # guard: shift(1) must be the previous calendar month
    gap = pd.Series(me.index, index=me.index).diff().apply(lambda x: x.n if pd.notna(x) else np.nan)
    mr[gap.values != 1] = np.nan

    def score(d, M):
        p0 = M - 1                                    # R(0) = return of month M-1
        reg = [p0 - t for t in range(S, S + reg_months)]
        form = [p0 - t for t in range(S, S + T)]
        if any(m not in mr.index for m in reg):
            return None
        mkt = mr.loc[reg, "SPY"].values
        if np.isnan(mkt).any():
            return None
        X = np.column_stack([np.ones(len(mkt)), mkt])
        mkt_f = mr.loc[form, "SPY"].values
        sc = {}
        for c in cols:
            y = mr.loc[reg, c].values
            if np.isnan(y).any():
                continue
            beta = np.linalg.lstsq(X, y, rcond=None)[0][1]
            eps = mr.loc[form, c].values - beta * mkt_f
            sc[c] = eps.sum()
        if len(sc) < 2 * n_side:
            return None
        s = pd.Series(sc).sort_values(ascending=False)
        out = pd.Series(0.0, index=s.index)
        out[s.index[:n_side]] = 1.0 / (2 * n_side)
        out[s.index[-n_side:]] = -1.0 / (2 * n_side)
        return out

    return _monthly_xs(prices, score)
