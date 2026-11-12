"""Sleeve charters (stage 1). Agents read these; only humans edit them."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
RESULTS_DIR = ROOT / "results"
REGISTRY_PATH = RESULTS_DIR / "registry.json"
PAPER_PATH = RESULTS_DIR / "paper_ledger.json"

START_DATE = "2005-01-01"
# Final holdout window is locked away from research agents (stage 4) and is
# looked at exactly once per strategy version by validation (stage 5).
HOLDOUT_YEARS = 2

# Gate thresholds (see process flow).
GATES = {
    "backtest_min_sharpe": 0.5,     # net of costs, in-sample
    "dsr_min_prob": 0.90,           # deflated Sharpe probability
    "pbo_max": 0.50,                # probability of backtest overfitting (grids >= 8 variants)
    "oos_loss_max": 0.20,           # CSCV: share of splits where the IS winner loses OOS
    "holdout_min_sharpe": 0.0,      # holdout must not be negative
    "max_corr_to_sleeve": 0.85,     # duplicate filter
}

SLEEVES = {
    "equity": {
        "name": "Equity L/S",
        "risk_share": 0.40, "vol_target": 0.10, "max_dd": 0.12,
        "cost_bps": 5,
        "universe": ["SPY", "QQQ", "IWM", "EFA", "EEM",
                     "XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLU", "XLV", "XLY",
                     "MTUM", "QUAL", "USMV", "VLUE"],
    },
    "macro": {
        "name": "Macro / Rates",
        "risk_share": 0.30, "vol_target": 0.10, "max_dd": 0.10,
        "cost_bps": 4,
        "universe": ["TLT", "IEF", "SHY", "TIP", "LQD", "HYG", "GLD", "SLV", "DBC", "USO", "UUP",
                     "EURUSD=X", "JPY=X", "GBPUSD=X", "AUDUSD=X", "CAD=X", "CHF=X"],
    },
    "vol": {
        "name": "Volatility",
        "risk_share": 0.15, "vol_target": 0.10, "max_dd": 0.08,
        "cost_bps": 8,
        "universe": ["SPY", "^VIX", "^VIX3M", "SVXY", "VIXY", "TLT", "SHY"],
    },
    "crypto": {
        "name": "Digital assets",
        "risk_share": 0.15, "vol_target": 0.20, "max_dd": 0.20,
        "cost_bps": 15,
        "universe": ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD", "ADA-USD",
                     "DOGE-USD", "LTC-USD", "LINK-USD", "AVAX-USD"],
    },
}

# Index-only tickers: usable as signals, never as positions.
NON_TRADABLE = {"^VIX", "^VIX3M"}
