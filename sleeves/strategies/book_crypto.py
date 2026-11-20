"""b_crypto · 151 · Crypto — Kakushadze & Serur, *151 Trading Strategies* (2018).

Implemented as pre-registered in catalogue/book_protocol.md (section "b_crypto").
Long/flat only. Signals use only prices up to each date's close; the engine lags
weights one day before trading.
"""
from __future__ import annotations

import warnings

import numpy as np
import pandas as pd

from engine.core import register

BTC = "BTC-USD"


# --------------------------------------------------------------------------
# §3.11 Single moving average
# --------------------------------------------------------------------------

@register(sleeve="b_crypto", name="btc_single_ma",
          rationale="151 §3.11 (p.49-50, eq. 319/321): long BTC when P > SMA(T), else flat (long-only "
                    "variant). Book gives no typical T, so protocol default 200d is used; "
                    "NOT FROM BOOK: T=200, SMA rather than EMA, no grid (book lists no lengths).",
          failure_condition="Sharpe below BTC buy-and-hold over the in-sample period, or Sharpe < 0.3.",
          params={"T": 200}, grid=None, author="book-151", tags=["book"])
def btc_single_ma(prices: pd.DataFrame, T: int = 200) -> pd.DataFrame:
    w = pd.DataFrame(0.0, index=prices.index, columns=prices.columns)
    p = prices[BTC]
    w[BTC] = (p > p.rolling(T).mean()).astype(float)
    return w


# --------------------------------------------------------------------------
# §3.12 Two moving averages
# --------------------------------------------------------------------------

@register(sleeve="b_crypto", name="crypto_two_ma",
          rationale="151 §3.12 (p.50, eq. 322): each coin long when SMA(T') > SMA(T), book example "
                    "T'=10, T=30; equal weight among longs, flat otherwise. NOT FROM BOOK: SMA (not EMA), "
                    "weight 1/n_long, no grid (book gives a single pair).",
          failure_condition="Sharpe below equal-weight buy-and-hold of the coins, or Sharpe < 0.3.",
          params={"T_short": 10, "T_long": 30}, grid=None, author="book-151", tags=["book"])
def crypto_two_ma(prices: pd.DataFrame, T_short: int = 10, T_long: int = 30) -> pd.DataFrame:
    fast = prices.rolling(T_short).mean()
    slow = prices.rolling(T_long).mean()
    long_ = (fast > slow) & fast.notna() & slow.notna()
    n = long_.sum(axis=1)
    w = long_.astype(float).div(n.replace(0, np.nan), axis=0).fillna(0.0)
    return w


# --------------------------------------------------------------------------
# §18.2 Artificial neural network
# --------------------------------------------------------------------------

def _lagged_window_sum(x: pd.Series, weights: np.ndarray) -> pd.Series:
    """sum_{k=0}^{tau-1} weights[k] * x(t-1-k)   (book: t' = t+1 .. t+tau, t=1 most recent)."""
    tau = len(weights)
    # rolling().apply gets the window oldest->newest; newest (t-1) gets weights[0]
    w_rev = weights[::-1].copy()
    return x.shift(1).rolling(tau).apply(lambda a: float(np.dot(a, w_rev)), raw=True)


def ann_features(p: pd.Series, T1: int, taus: tuple, taus_rsi: tuple) -> pd.DataFrame:
    """Inputs of 151 §18.2, eqs. 521-529, on daily bars; every value uses data up to t only."""
    p = p.dropna()
    R = p.pct_change(fill_method=None)                              # eq. 521
    prev = R.shift(1).rolling(T1)                                   # t' = t+1 .. t+T1 (excludes t)
    Rbar = prev.mean()                                              # eq. 523
    sig = prev.std(ddof=1)                                          # eq. 525 (std of past T1 returns)
    Rhat = (R - Rbar) / sig                                         # eqs. 522, 524
    feats = {"Rhat": Rhat}
    for tau in taus:
        lam = (tau - 1) / (tau + 1)                                 # fn. 224
        k = np.arange(tau)
        lk = lam ** k
        ema = _lagged_window_sum(Rhat, (1 - lam) / (1 - lam ** tau) * lk)          # eq. 526
        # eq. 527: deviations of past Rhat(t') from EMA(t)
        dev_terms = []
        for j in range(tau):
            dev_terms.append(lk[j] * (Rhat.shift(1 + j) - ema) ** 2)
        emsd2 = (1 - lam) / (lam - lam ** tau) * sum(dev_terms)
        feats[f"ema_{tau}"] = ema
        feats[f"emsd_{tau}"] = np.sqrt(emsd2)
    for tau in taus_rsi:
        lag = Rhat.shift(1)
        up = lag.clip(lower=0).rolling(tau).sum()                   # eq. 529
        dn = (-lag).clip(lower=0).rolling(tau).sum()
        feats[f"rsi_{tau}"] = up / (up + dn)                        # eq. 528
    return pd.DataFrame(feats)


@register(sleeve="b_crypto", name="crypto_ann",
          rationale="151 §18.2 (p.116-119, eqs. 521-537): MLP on BTC technical inputs Rhat, EMA/EMSD(tau_a), "
                    "RSI(tau'_a); book tau_a = 30m,1h,3h,6h and tau' = 3h,6h,12h on 15-min bars (=2,4,12,24 and "
                    "12,24,48 bars), lambda=(tau-1)/(tau+1), ReLU hidden, softmax/cross-entropy, SGD; long BTC if "
                    "P(up)>0.5 else flat; walk-forward yearly refit. NOT FROM BOOK: daily bars with the same bar "
                    "counts, T1=60d, K=2 classes = sign of next-day return, hidden layers (32,16), "
                    "standardised inputs, seed 0.",
          failure_condition="Sharpe below btc_single_ma or BTC buy-and-hold in-sample, or hit rate <= 50%.",
          params={}, grid=None, author="book-151", tags=["book"])
def crypto_ann(prices: pd.DataFrame) -> pd.DataFrame:
    from sklearn.exceptions import ConvergenceWarning
    from sklearn.neural_network import MLPClassifier
    from sklearn.preprocessing import StandardScaler

    T1 = 60                       # NOT FROM BOOK ("long enough to estimate volatility")
    taus = (2, 4, 12, 24)         # book: 30 min, 1 h, 3 h, 6 h in 15-min bars
    taus_rsi = (12, 24, 48)       # book: 3 h, 6 h, 12 h in 15-min bars

    w = pd.DataFrame(0.0, index=prices.index, columns=prices.columns)
    p = prices[BTC].dropna()
    if len(p) < 3 * 365:
        return w
    X = ann_features(p, T1, taus, taus_rsi)
    nxt = p.shift(-1) / p - 1                                       # next-day return (label only)
    y = (nxt > 0).astype(int)
    next_date = pd.Series(p.index, index=p.index).shift(-1)
    valid = X.notna().all(axis=1)

    first = p.index[0]
    years = sorted(set(p.index.year))
    sig = pd.Series(0.0, index=p.index)
    for yr in years:
        fit_date = pd.Timestamp(year=yr, month=1, day=1)
        if fit_date < first + pd.DateOffset(years=2):
            continue
        tr = valid & (p.index < fit_date) & next_date.notna() & (next_date < fit_date)
        te = valid & (p.index >= fit_date) & (p.index < pd.Timestamp(year=yr + 1, month=1, day=1))
        if tr.sum() < 200 or te.sum() == 0 or y[tr].nunique() < 2:
            continue
        sc = StandardScaler().fit(X[tr].values)
        clf = MLPClassifier(hidden_layer_sizes=(32, 16), activation="relu", solver="sgd",
                            learning_rate_init=0.01, momentum=0.9, max_iter=300,
                            random_state=0)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", ConvergenceWarning)
            clf.fit(sc.transform(X[tr].values), y[tr].values)
        up_col = list(clf.classes_).index(1)
        prob = clf.predict_proba(sc.transform(X[te].values))[:, up_col]
        sig[te[te].index] = (prob > 0.5).astype(float)
    w[BTC] = sig.reindex(prices.index).fillna(0.0)
    return w
