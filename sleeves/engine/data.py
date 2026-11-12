"""Data layer (stage 2): daily adjusted closes from Yahoo Finance, cached on disk."""
from __future__ import annotations

import time
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import requests

from .config import DATA_DIR, START_DATE, SLEEVES

_UA = {"User-Agent": "Mozilla/5.0 (research client)"}


def _fetch_yahoo(ticker: str, start: str = START_DATE) -> pd.Series:
    p1 = int(pd.Timestamp(start, tz="UTC").timestamp())
    p2 = int(datetime.now(timezone.utc).timestamp())
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
    params = {"period1": p1, "period2": p2, "interval": "1d", "events": "div,splits"}
    for attempt in range(4):
        try:
            r = requests.get(url, params=params, headers=_UA, timeout=30)
            r.raise_for_status()
            res = r.json()["chart"]["result"][0]
            ts = pd.to_datetime(res["timestamp"], unit="s").normalize()
            ind = res["indicators"]
            adj = ind.get("adjclose", [{}])[0].get("adjclose") or ind["quote"][0]["close"]
            s = pd.Series(adj, index=ts, name=ticker, dtype=float)
            s = s[~s.index.duplicated(keep="last")].dropna()
            return s
        except Exception:  # noqa: BLE001
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError("unreachable")


def _cache_path(ticker: str):
    safe = ticker.replace("^", "IDX_").replace("=", "_").replace("/", "_")
    return DATA_DIR / f"{safe}.csv"


def get_series(ticker: str, refresh: bool = False, max_age_hours: float = 12) -> pd.Series:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = _cache_path(ticker)
    if path.exists() and not refresh:
        age = (time.time() - path.stat().st_mtime) / 3600
        if age < max_age_hours:
            s = pd.read_csv(path, index_col=0, parse_dates=True).iloc[:, 0]
            s.name = ticker
            return s
    s = _fetch_yahoo(ticker)
    s.to_frame().to_csv(path)
    return s


def quality_check(s: pd.Series) -> list[str]:
    """Basic QA: gaps, non-positive prices, absurd jumps."""
    issues = []
    if (s <= 0).any():
        issues.append("non-positive prices")
    r = s.pct_change().abs()
    if (r > 0.6).any() and not s.name.endswith("-USD"):
        issues.append(f"{int((r > 0.6).sum())} daily moves > 60%")
    gaps = s.index.to_series().diff().dt.days
    if (gaps > 10).any():
        issues.append(f"{int((gaps > 10).sum())} gaps > 10 days")
    return issues


def load_prices(tickers: list[str], refresh: bool = False) -> pd.DataFrame:
    frames = {}
    for t in tickers:
        try:
            frames[t] = get_series(t, refresh=refresh)
        except Exception as e:  # noqa: BLE001
            print(f"[data] failed {t}: {e}")
    df = pd.DataFrame(frames).sort_index()
    # Crypto trades 7 days; keep every date but forward-fill at most 3 days so
    # equities/FX do not get stale prices across long gaps.
    df = df.ffill(limit=3)
    return df


def load_sleeve(sleeve: str, refresh: bool = False) -> pd.DataFrame:
    df = load_prices(SLEEVES[sleeve]["universe"], refresh=refresh)
    if sleeve != "crypto":
        # Use the US equity calendar for traditional-asset sleeves.
        anchor = "SPY" if "SPY" in df else df.columns[0]
        df = df[df[anchor].notna()] if anchor in df else df
    return df.replace([np.inf, -np.inf], np.nan)


def refresh_all() -> dict:
    report = {}
    for sleeve, cfg in SLEEVES.items():
        for t in cfg["universe"]:
            try:
                s = get_series(t, refresh=True)
                report[t] = {"rows": len(s), "first": str(s.index[0].date()),
                             "last": str(s.index[-1].date()), "issues": quality_check(s)}
            except Exception as e:  # noqa: BLE001
                report[t] = {"error": str(e)}
    return report
