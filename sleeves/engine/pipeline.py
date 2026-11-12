"""Orchestrator: validation -> paper trading -> incubation -> live (all simulated), allocation, monitoring.

Run daily from the sleeves/ directory:
    python -m engine.pipeline            # uses cached data if < 12h old
    python -m engine.pipeline --refresh  # force fresh market data

NOTHING here places real orders. "Incubation" and "live" are simulated paper
stages until a broker connection and human approval step are added.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from .config import SLEEVES, RESULTS_DIR, PAPER_PATH, GATES
from .core import load_strategies, holdout_cutoff, periods_per_year, stats, vol_scale
from .data import load_sleeve, refresh_all
from .validation import validate

STATE_PATH = RESULTS_DIR / "state.json"
OUT_PATH = RESULTS_DIR / "dashboard.json"

PAPER_MIN_DAYS = 20          # stage 6 -> 7
INCUBATION_MIN_DAYS = 63     # stage 7 -> 8
REQUIRE_HUMAN_APPROVAL = False  # set True before any real-money broker is connected
APPROVALS_PATH = RESULTS_DIR / "approvals.json"
LAMBDA_CORR = 0.5
SHRINK_K_MONTHS = 12
LIVE_STAGES = ("paper", "incubation", "live", "derisked")


def _load(path, default):
    return json.loads(path.read_text()) if path.exists() else default


def _save(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=1, default=float))


def target_snapshot(strat, prices: pd.DataFrame) -> tuple[str, dict, float]:
    """Today's target weights x vol-target leverage, from data up to the latest close."""
    cfg = SLEEVES[strat.sleeve]
    w = strat.weights(prices)
    rets = prices.pct_change(fill_method=None).fillna(0.0).clip(-0.5, 1.0)
    lev = float(vol_scale(w.iloc[-70:], rets.iloc[-70:], cfg["vol_target"], periods_per_year(strat.sleeve)).iloc[-1])
    last = w.iloc[-1]
    return str(prices.index[-1].date()), {k: round(float(v), 6) for k, v in last.items() if abs(v) > 1e-9}, lev


def paper_returns(snaps: dict, prices: pd.DataFrame, sleeve: str) -> pd.Series:
    """Forward P&L from weights recorded at the time (no hindsight)."""
    if not snaps:
        return pd.Series(dtype=float)
    cost = SLEEVES[sleeve]["cost_bps"] / 1e4
    rets = prices.pct_change(fill_method=None).fillna(0.0)
    dates = sorted(snaps)
    first = pd.Timestamp(dates[0])
    out, prev_pos = {}, {}
    idx = rets.index[rets.index > first]
    si = 0
    for t in idx:
        while si + 1 < len(dates) and pd.Timestamp(dates[si + 1]) < t:
            si += 1
        s = snaps[dates[si]]
        pos = {k: v * s["lev"] for k, v in s["w"].items()}
        r = sum(pos[k] * rets.at[t, k] for k in pos if k in rets.columns)
        keys = set(pos) | set(prev_pos)
        turn = sum(abs(pos.get(k, 0) - prev_pos.get(k, 0)) for k in keys)
        out[t] = r - turn * cost
        prev_pos = pos
    return pd.Series(out, dtype=float)


def weekly(r: pd.Series) -> list:
    if r.empty:
        return []
    eq = (1 + r.fillna(0)).cumprod()
    w = eq.resample("W-FRI").last().dropna()
    return [[str(d.date()), round(float(v), 5)] for d, v in w.items()]


def daily_curve(r: pd.Series) -> list:
    eq = (1 + r.fillna(0)).cumprod()
    return [[str(d.date()), round(float(v), 5)] for d, v in eq.items()]


def allocate(cands: dict, ho_returns: dict) -> dict:
    """Shrunk-Sharpe score with correlation penalty -> capped weights (section 5 of the design)."""
    if not cands:
        return {}
    keys = list(cands)
    R = pd.DataFrame({k: ho_returns[k] for k in keys}).fillna(0.0)
    C = R.corr().fillna(0.0) if len(keys) > 1 else pd.DataFrame([[1.0]], index=keys, columns=keys)
    scores = {}
    for k, c in cands.items():
        m_h, m_p = 24 * 0.5, c["paper_days"] / 21          # holdout counts at half weight
        sr = (c["holdout_sr"] * m_h + c["paper_sr"] * m_p) / (m_h + m_p + SHRINK_K_MONTHS)
        avg_corr = float(C.loc[k].drop(k).mean()) if len(keys) > 1 else 0.0
        mult = 0.5 if c["stage"] == "derisked" else 1.0
        scores[k] = {"shrunk_sr": sr, "avg_corr": avg_corr,
                     "score": max(sr, 0.0) * (1 - LAMBDA_CORR * max(avg_corr, 0)) * mult}
    raw = pd.Series({k: v["score"] for k, v in scores.items()})
    if raw.sum() <= 0:
        w = raw * 0
    else:
        cap = max(0.35, 1.0 / len(raw))
        w = raw / raw.sum()
        for _ in range(10):
            over = w > cap
            if not over.any():
                break
            excess = (w[over] - cap).sum()
            w[over] = cap
            under = ~over & (w > 0)
            if under.any():
                w[under] += excess * w[under] / w[under].sum()
        w[w < 0.02] = 0.0
        w = w / w.sum() if w.sum() > 0 else w
    for k in scores:
        scores[k]["weight"] = float(w.get(k, 0.0))
    return scores


def run(refresh: bool = False) -> dict:
    now = datetime.now(timezone.utc)
    if refresh:
        refresh_all()
    strategies = load_strategies()
    state = _load(STATE_PATH, {})
    ledger = _load(PAPER_PATH, {})
    approvals = _load(APPROVALS_PATH, {})
    postmortems = []

    out = {"generated_at": now.isoformat(timespec="seconds"), "sleeves": {}, "funnel": {},
           "gates": GATES, "human_approval_required": REQUIRE_HUMAN_APPROVAL}
    sleeve_returns_ho, sleeve_returns_paper = {}, {}
    data_asof = None

    for sleeve, cfg in SLEEVES.items():
        prices = load_sleeve(sleeve)
        cut = holdout_cutoff(prices.index)
        data_asof = max(data_asof or "", str(prices.index[-1].date()))
        rows, ho_rets, full_rets, cands, paper_rets = [], {}, {}, {}, {}
        for key, strat in sorted(strategies.items()):
            if strat.sleeve != sleeve:
                continue
            print(f"[{sleeve}] validating {strat.name}")
            try:
                v = validate(strat, prices, cut)
            except Exception as e:  # noqa: BLE001
                rows.append({"key": key, "name": strat.name, "stage": "error", "error": str(e)[:200],
                             "rationale": strat.rationale})
                continue
            st = state.get(key, {})
            if st.get("hash") != v["hash"]:                 # change control: new version restarts
                st = {"hash": v["hash"], "stage": None, "history": st.get("history", [])}
                ledger.pop(key, None)
            stage = st.get("stage")
            ho_rets[key] = v["_full_returns"][v["_full_returns"].index >= cut]
            full_rets[key] = v["_full_returns"]

            if not v["passed"]:
                stage = "rejected"
            elif stage in (None, "rejected"):
                stage = "paper"
                st["paper_start"] = str(prices.index[-1].date())

            pr = pd.Series(dtype=float)
            if stage in LIVE_STAGES or stage == "retired":
                if stage != "retired":
                    d, w, lev = target_snapshot(strat, prices)
                    ledger.setdefault(key, {"snapshots": {}})["snapshots"].setdefault(d, {"w": w, "lev": lev})
                pr = paper_returns(ledger.get(key, {}).get("snapshots", {}), prices, sleeve)
                paper_rets[key] = pr
                days = len(pr)
                pst = stats(pr, sleeve) if days >= 30 else {"sharpe": 0.0, "max_dd": float(((1 + pr).cumprod() / (1 + pr).cumprod().cummax() - 1).min()) if days else 0.0}
                dd = pst["max_dd"]
                # Monitoring / de-risk ladder.
                if stage != "retired":
                    if dd <= -1.5 * cfg["max_dd"]:
                        stage = "retired"
                        postmortems.append({"key": key, "date": str(now.date()),
                                            "reason": f"paper drawdown {dd:.1%} beyond 1.5x sleeve budget"})
                    elif dd <= -cfg["max_dd"]:
                        stage = "derisked"
                    elif stage == "paper" and days >= PAPER_MIN_DAYS:
                        if not REQUIRE_HUMAN_APPROVAL or approvals.get(key):
                            stage = "incubation"
                            st["incubation_start"] = str(prices.index[-1].date())
                    elif stage == "incubation" and days >= PAPER_MIN_DAYS + INCUBATION_MIN_DAYS:
                        se = np.sqrt((1 + 0.5 * v["in_sample"]["sharpe"] ** 2) / max(days / periods_per_year(sleeve), 1e-3))
                        if pst["sharpe"] >= v["in_sample"]["sharpe"] - 2 * se:
                            stage = "live"
                if stage in LIVE_STAGES:
                    cands[key] = {"stage": stage, "holdout_sr": v["holdout"]["sharpe"],
                                  "paper_sr": pst["sharpe"] if days >= 30 else 0.0, "paper_days": days}

            if stage != st.get("stage"):
                st.setdefault("history", []).append({"date": str(now.date()), "stage": stage})
            st["stage"] = stage
            state[key] = st
            failed = [k for k, ok in v["checks"].items() if not ok]
            rows.append({
                "key": key, "name": strat.name, "stage": stage, "rationale": strat.rationale,
                "failure_condition": strat.failure_condition, "author": strat.author,
                "params": {k: str(x) for k, x in strat.params.items()},
                "in_sample": v["in_sample"], "walk_forward": v["walk_forward"], "holdout": v["holdout"],
                "dsr": v["dsr"], "pbo": v["pbo"], "p_oos_loss": v["p_oos_loss"], "n_variants": v["n_variants"], "stability": v["stability"], "trials": v["trials"],
                "turnover_yr": v["turnover_yr"], "regimes": v["regimes"], "checks": v["checks"],
                "failed_checks": failed, "paper_start": st.get("paper_start"),
                "paper_days": int(len(pr)), "paper_return": float((1 + pr).prod() - 1) if len(pr) else 0.0,
                "paper_curve": daily_curve(pr) if len(pr) else [],
                "holdout_curve": weekly(ho_rets[key]),
                "current_weights": (ledger.get(key, {}).get("snapshots", {}) or {}).get(
                    max(ledger.get(key, {}).get("snapshots", {"": 0}) or [""]), {}) if key in ledger else {},
            })

        alloc = allocate(cands, ho_rets)
        for r in rows:
            a = alloc.get(r["key"])
            r["allocation"] = a["weight"] if a else 0.0
            r["score"] = a or None
        # Pro-forma sleeve: today's allocation applied to holdout returns (shown as such).
        if alloc and sum(a["weight"] for a in alloc.values()) > 0:
            sl = sum(ho_rets[k].fillna(0) * a["weight"] for k, a in alloc.items())
            sp = sum(paper_rets[k].fillna(0) * a["weight"] for k, a in alloc.items() if k in paper_rets and len(paper_rets[k]))
        else:
            sl = pd.Series(0.0, index=prices.index[prices.index >= cut])
            sp = pd.Series(dtype=float)
        sleeve_returns_ho[sleeve] = sl
        sleeve_returns_paper[sleeve] = sp if isinstance(sp, pd.Series) else pd.Series(dtype=float)
        out["sleeves"][sleeve] = {
            "name": cfg["name"], "risk_share": cfg["risk_share"], "vol_target": cfg["vol_target"],
            "max_dd": cfg["max_dd"], "cost_bps": cfg["cost_bps"], "universe": cfg["universe"],
            "holdout_start": str(cut.date()), "strategies": rows,
            "proforma_holdout": stats(sl, sleeve), "proforma_curve": weekly(sl),
        }

    # Portfolio: sleeves combined by risk share on a business-day calendar.
    def combine(d):
        frames = {s: r for s, r in d.items() if len(r)}
        if not frames:
            return pd.Series(dtype=float)
        df = pd.DataFrame(frames)
        df = df[df.index.dayofweek < 5].fillna(0.0)
        return sum(df[s] * SLEEVES[s]["risk_share"] for s in df)
    port_ho = combine(sleeve_returns_ho)
    port_paper = combine(sleeve_returns_paper)
    out["portfolio"] = {"proforma_holdout": stats(port_ho, "equity"), "proforma_curve": weekly(port_ho),
                        "paper": stats(port_paper, "equity") if len(port_paper) >= 30 else None,
                        "paper_return": float((1 + port_paper).prod() - 1) if len(port_paper) else 0.0,
                        "paper_curve": daily_curve(port_paper) if len(port_paper) else []}
    stages = [r["stage"] for s in out["sleeves"].values() for r in s["strategies"]]
    out["funnel"] = {k: stages.count(k) for k in
                     ["rejected", "paper", "incubation", "live", "derisked", "retired", "error"]}
    out["funnel"]["total"] = len(stages)
    out["data_asof"] = data_asof
    reg_tot = 0
    for sleeve in SLEEVES:
        p = RESULTS_DIR / f"registry_{sleeve}.json"
        if p.exists():
            reg = json.loads(p.read_text())
            reg["postmortems"] = reg.get("postmortems", []) + [pm for pm in postmortems if pm["key"].startswith(sleeve + ".")]
            p.write_text(json.dumps(reg, indent=1))
            reg_tot += len(reg["trials"])
    out["total_trials"] = reg_tot
    out["postmortems"] = postmortems

    _save(STATE_PATH, state)
    _save(PAPER_PATH, ledger)
    _save(OUT_PATH, out)
    print(f"wrote {OUT_PATH}  funnel={out['funnel']}")
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    run(ap.parse_args().refresh)
