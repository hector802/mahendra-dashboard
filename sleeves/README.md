# Sleeve Lab: agentic trading sleeves (paper trading)

Implements the process flow: sleeve charters → data → agent-written hypotheses → in-sample backtest →
independent validation (deflated Sharpe, CSCV overfitting test, walk-forward, stability, stress periods,
one-time holdout) → paper trading → simulated incubation → simulated live, with a per-sleeve allocator
and drawdown monitoring.

**No broker is connected. Nothing here places real orders.**

```
cd sleeves
pip install pandas numpy scipy requests
python -m engine.research --sleeve equity   # agents' in-sample sandbox (holdout locked)
python -m engine.pipeline --refresh         # daily: fetch data, validate, paper-trade, allocate
python -m engine.build_dashboard            # writes dashboard/index.html
```

- `engine/config.py`: sleeve charters and gate thresholds (human-owned)
- `strategies/*.py`: one file per sleeve, written by the research agents
- `results/`: hypothesis registries (every trial), holdout log, paper ledger, stage state, dashboard data
