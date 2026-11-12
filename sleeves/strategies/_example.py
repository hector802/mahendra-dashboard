"""Reference strategy so agents can see the interface. Kept as a benchmark."""
import pandas as pd
from engine.core import register


@register(sleeve="equity", name="spy_trend_benchmark",
          rationale="Benchmark: hold SPY when above its 200-day average (time-series momentum).",
          failure_condition="Sharpe below buy-and-hold SPY over a full cycle.",
          params={"window": 200}, grid={"window": [150, 200, 250]}, author="framework")
def spy_trend(prices: pd.DataFrame, window: int = 200) -> pd.DataFrame:
    w = pd.DataFrame(0.0, index=prices.index, columns=prices.columns)
    spy = prices["SPY"]
    w["SPY"] = (spy > spy.rolling(window).mean()).astype(float)
    return w
