#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from features.lexical import extract_lexical_features

ALERT_DB = ROOT / "alerts" / "alerts.db"
PARSED_CSV = ROOT / "data" / "parsed" / "parsed_dns.csv"
RAW_LIVE_CSV = ROOT / "data" / "raw" / "live.csv"
RAW_DEMO_CSV = ROOT / "data" / "raw" / "demo_raw.csv"
MODEL_PATH = ROOT / "models" / "saved" / "dns_classifier.pkl"
SCALER_PATH = ROOT / "models" / "saved" / "standard_scaler.pkl"
TRAINING_HISTORY_PATH = ROOT / "models" / "training_history.json"


def _safe_read_csv(paths: list[Path]) -> pd.DataFrame:
    for p in paths:
        if p.exists() and p.stat().st_size > 0:
            try:
                return pd.read_csv(p)
            except Exception:
                continue
    return pd.DataFrame()


def _safe_read_csv_with_source(paths: list[Path]) -> tuple[pd.DataFrame, str | None, float]:
    for p in paths:
        if p.exists() and p.stat().st_size > 0:
            try:
                return pd.read_csv(p), str(p), p.stat().st_mtime
            except Exception:
                continue
    return pd.DataFrame(), None, 0.0


def _normalize_queries(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=["timestamp", "src_ip", "query_name", "query_type", "rcode", "label", "status"])

    work = df.copy()
    for col in ["timestamp", "src_ip", "query_name", "query_type"]:
        if col not in work.columns:
            work[col] = None
    if "rcode" not in work.columns:
        work["rcode"] = 0

    raw_ts = work["timestamp"]
    ts_num = pd.to_datetime(pd.to_numeric(raw_ts, errors="coerce"), unit="s", errors="coerce", utc=True)
    ts_str = pd.to_datetime(raw_ts, errors="coerce", utc=True)
    work["timestamp"] = ts_num.where(ts_num.notna(), ts_str)

    if "label" not in work.columns:
        qn = work["query_name"].astype(str).str.lower()
        work["label"] = ((qn.str.contains("labdomain")) | (work["query_type"].astype(str) == "16")).astype(int)
    work["status"] = work["label"].map({1: "suspicious", 0: "normal"}).fillna("normal")
    work["query_name"] = work["query_name"].astype(str)
    work["src_ip"] = work["src_ip"].astype(str)
    return work


QTYPE_MAP = {
    "A": 1,
    "NS": 2,
    "CNAME": 5,
    "SOA": 6,
    "PTR": 12,
    "MX": 15,
    "TXT": 16,
    "AAAA": 28,
    "SRV": 33,
}


def _qtype_to_int(value: Any) -> int:
    s = str(value).strip().upper()
    if not s:
        return 0
    try:
        return int(float(s))
    except Exception:
        return QTYPE_MAP.get(s, 0)


def load_queries() -> pd.DataFrame:
    df, _, _ = _safe_read_csv_with_source([PARSED_CSV, RAW_LIVE_CSV, RAW_DEMO_CSV])
    return _normalize_queries(df)


def load_training_history() -> dict[str, Any]:
    if TRAINING_HISTORY_PATH.exists():
        try:
            with open(TRAINING_HISTORY_PATH, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _load_queries_with_source() -> tuple[pd.DataFrame, str | None, float]:
    df, src, mtime = _safe_read_csv_with_source([PARSED_CSV, RAW_LIVE_CSV, RAW_DEMO_CSV])
    return _normalize_queries(df), src, mtime


def load_alerts(limit: int | None = None) -> list[dict[str, Any]]:
    if not ALERT_DB.exists():
        return []
    conn = sqlite3.connect(ALERT_DB)
    conn.row_factory = sqlite3.Row
    q = "SELECT * FROM alerts ORDER BY timestamp DESC"
    if limit is not None:
        q += f" LIMIT {int(limit)}"
    rows = [dict(r) for r in conn.execute(q).fetchall()]
    conn.close()
    for row in rows:
        try:
            row["reasons"] = json.loads(row.get("reasons", "[]"))
        except Exception:
            row["reasons"] = []
        try:
            row["shap_values"] = json.loads(row.get("shap_values", "[]"))
        except Exception:
            row["shap_values"] = []
    return rows


_test_cache: dict[str, Any] = {"result": None, "ts": 0.0}
_queries_state: dict[str, Any] = {
    "initialized": False,
    "total": 0,
    "last_len": 0,
    "last_source": None,
    "last_mtime": 0.0,
}


def _run_tests_cached(root: Path, ttl: int = 120) -> dict[str, Any]:
    now = time.time()
    if _test_cache["result"] and (now - float(_test_cache["ts"])) < ttl:
        return _test_cache["result"]

    try:
        venv_python = root / ".venv" / "bin" / "python"
        pybin = str(venv_python) if venv_python.exists() else "python3"
        proc = subprocess.run(
            [pybin, "-m", "pytest", "--tb=no", "-q", "--no-header"],
            capture_output=True,
            text=True,
            timeout=45,
            cwd=root,
            check=False,
        )
        output = (proc.stdout + "\n" + proc.stderr).strip()
        lines = [ln.strip() for ln in output.splitlines() if ln.strip()]
        summary_line = ""
        summary_pat = re.compile(r"\b\d+\s+(passed|failed|skipped|error|errors|xfailed|xpassed)\b")
        for ln in reversed(lines):
            if summary_pat.search(ln):
                summary_line = ln
                break

        parse_text = summary_line or output

        def _count(label: str) -> int:
            m = re.search(rf"(\d+)\s+{label}\b", parse_text)
            if m:
                return int(m.group(1))
            m = re.search(rf"(\d+)\s+{label}\b", output)
            return int(m.group(1)) if m else 0

        passed = _count("passed")
        failed = _count("failed")
        skipped = _count("skipped")
        errors = _count("errors?")  # supports "1 error" and "2 errors"
        xfailed = _count("xfailed")
        xpassed = _count("xpassed")
        total = passed + failed + skipped + errors + xfailed + xpassed

        result = {
            "tests_total": total,
            "tests_passed": passed,
            "tests_failed": failed + errors,
            "tests_ok": (failed + errors) == 0 and passed > 0 and proc.returncode == 0,
            "tests_source": "pytest",
        }
    except Exception as e:
        result = {
            "tests_total": 0,
            "tests_passed": 0,
            "tests_failed": 0,
            "tests_ok": False,
            "tests_source": f"error: {e}",
        }

    _test_cache["result"] = result
    _test_cache["ts"] = now
    return result


def _update_cumulative_queries(current_len: int, source: str | None, mtime: float) -> int:
    state = _queries_state
    cur = max(0, int(current_len))

    if not state["initialized"]:
        state["initialized"] = True
        state["total"] = cur
        state["last_len"] = cur
        state["last_source"] = source
        state["last_mtime"] = float(mtime or 0.0)
        return int(state["total"])

    last_len = int(state["last_len"])
    last_src = state["last_source"]
    last_mtime = float(state["last_mtime"])

    same_source = source is not None and source == last_src
    source_changed = source != last_src
    mtime_changed = float(mtime or 0.0) > last_mtime + 1e-9

    if source_changed:
        delta = cur
    elif same_source:
        if cur > last_len:
            delta = cur - last_len
        elif mtime_changed:
            # Handles demo mode where CSV is rewritten with roughly the same size each cycle.
            delta = cur
        else:
            delta = 0
    elif mtime_changed:
        delta = cur
    else:
        delta = 0

    state["total"] = int(state["total"]) + max(0, int(delta))
    state["last_len"] = cur
    state["last_source"] = source
    state["last_mtime"] = float(mtime or last_mtime)
    return int(state["total"])


def get_summary() -> dict[str, Any]:
    alerts = load_alerts()
    queries, q_source, q_mtime = _load_queries_with_source()

    by_sev = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    unresolved = 0
    for a in alerts:
        sev = str(a.get("severity", "LOW")).upper()
        by_sev[sev] = by_sev.get(sev, 0) + 1
        unresolved += int(a.get("resolved", 0) == 0)

    test_status = _run_tests_cached(ROOT)
    cumulative_queries = _update_cumulative_queries(len(queries), q_source, q_mtime)
    mode = os.environ.get("SENTINEL_MODE", "demo").strip().upper()
    data_source = "LIVE_CAPTURE" if mode == "LIVE" else "DEMO_FEED"
    return {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "alerts_total": len(alerts),
        "alerts_unresolved": unresolved,
        "alerts_high": by_sev.get("HIGH", 0),
        "alerts_medium": by_sev.get("MEDIUM", 0),
        "alerts_low": by_sev.get("LOW", 0),
        # Keep backward compatibility for clients reading queries_total as the primary headline metric.
        # In demo mode the window often sits at ~330 because each cycle rewrites a fixed-size CSV;
        # cumulative shows true live ingestion progression across cycles.
        "queries_total": cumulative_queries,
        "queries_lifetime": cumulative_queries,
        "queries_window": int(len(queries)),
        "queries_suspicious": int((queries["label"] == 1).sum()) if not queries.empty else 0,
        "unique_hosts": int(queries["src_ip"].nunique()) if not queries.empty else 0,
        "tests_total": test_status["tests_total"],
        "tests_passed": test_status["tests_passed"],
        "tests_failed": test_status["tests_failed"],
        "tests_ok": test_status["tests_ok"],
        "tests_source": test_status["tests_source"],
        "mode": data_source,
        "data_source": data_source,
    }


def _infer_attack_type(reasons: list[str]) -> str:
    s = " ".join(reasons).lower()
    if "beacon" in s:
        return "Beaconing"
    if "dga" in s or "nxdomain" in s:
        return "DGA Sweep"
    if "txt" in s or "exfil" in s or "base64" in s or "tunnel" in s:
        return "Exfiltration/Tunneling"
    return "Other"


def _alert_sort_key(row: dict[str, Any]) -> tuple[int, float, str]:
    sev = str(row.get("severity", "LOW")).upper()
    sev_rank = 3 if sev == "HIGH" else 2 if sev == "MEDIUM" else 1
    try:
        score = float(row.get("total_score", 0.0))
    except Exception:
        score = 0.0
    ts = str(row.get("timestamp", ""))
    return (sev_rank, score, ts)


def get_charts() -> dict[str, Any]:
    queries = load_queries()
    alerts = load_alerts()

    traffic = []
    entropy_bins = []
    query_len_bins = []

    if not queries.empty:
        q = queries.copy()
        q["minute"] = q["timestamp"].dt.floor("min")
        grouped = q.groupby(["minute", "status"]).size().reset_index(name="count")
        pivot = grouped.pivot(index="minute", columns="status", values="count").fillna(0).reset_index()
        for _, r in pivot.iterrows():
            traffic.append(
                {
                    "time": r["minute"].strftime("%H:%M") if pd.notna(r["minute"]) else "",
                    "ts_utc": r["minute"].isoformat() if pd.notna(r["minute"]) else "",
                    "normal": int(r.get("normal", 0)),
                    "suspicious": int(r.get("suspicious", 0)),
                }
            )

        q["sub_entropy"] = q["query_name"].map(lambda x: extract_lexical_features(str(x)).get("subdomain_entropy", 0.0))
        q["query_len"] = q["query_name"].astype(str).str.len()

        e = q.copy()
        e["entropy_bin"] = pd.cut(e["sub_entropy"], bins=12)
        egrp = e.groupby(["entropy_bin", "status"], observed=False).size().reset_index(name="count")
        for b in sorted(egrp["entropy_bin"].dropna().unique()):
            row = {"bin": f"{b.left:.1f}-{b.right:.1f}", "normal": 0, "suspicious": 0}
            for _, r in egrp[egrp["entropy_bin"] == b].iterrows():
                row[str(r["status"])] = int(r["count"])
            entropy_bins.append(row)

        l = q.copy()
        l["len_bin"] = pd.cut(l["query_len"], bins=12)
        lgrp = l.groupby(["len_bin", "status"], observed=False).size().reset_index(name="count")
        for b in sorted(lgrp["len_bin"].dropna().unique()):
            row = {"bin": f"{int(b.left)}-{int(b.right)}", "normal": 0, "suspicious": 0}
            for _, r in lgrp[lgrp["len_bin"] == b].iterrows():
                row[str(r["status"])] = int(r["count"])
            query_len_bins.append(row)

    sev_counts = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    attack_counts: dict[str, int] = {}
    host_scores: dict[str, float] = {}

    for a in alerts:
        sev = str(a.get("severity", "LOW")).upper()
        sev_counts[sev] = sev_counts.get(sev, 0) + 1

        attack = _infer_attack_type(a.get("reasons", []))
        attack_counts[attack] = attack_counts.get(attack, 0) + 1

        host = str(a.get("src_host", "unknown"))
        host_scores[host] = max(host_scores.get(host, 0.0), float(a.get("total_score", 0.0)))

    severity = [{"name": k, "value": v} for k, v in sev_counts.items()]
    attack_types = [{"type": k, "count": v} for k, v in sorted(attack_counts.items(), key=lambda x: x[1], reverse=True)]
    top_hosts = [{"host": k, "score": v} for k, v in sorted(host_scores.items(), key=lambda x: x[1], reverse=True)[:10]]

    return {
        "traffic": traffic,
        "entropy_distribution": entropy_bins,
        "query_length_distribution": query_len_bins,
        "severity_breakdown": severity,
        "attack_type_breakdown": attack_types,
        "top_hosts": top_hosts,
    }


def get_modules() -> list[dict[str, Any]]:
    modules = [
        {
            "id": "sim",
            "title": "Traffic Simulator",
            "files": ["lab/normal_traffic.py", "lab/attack_simulator.py"],
            "details": "Generates benign and attack DNS traffic patterns.",
        },
        {
            "id": "cap",
            "title": "Capture",
            "files": ["capture/sniffer.py", "capture/pcap_reader.py"],
            "details": "Captures live DNS or parses PCAP files.",
        },
        {
            "id": "feat",
            "title": "Feature Extraction",
            "files": ["features/lexical.py", "features/temporal.py", "features/session.py", "features/feature_pipeline.py"],
            "details": "Builds lexical, temporal, and session-level features.",
        },
        {
            "id": "rule",
            "title": "Rule Engine",
            "files": ["detection/rule_engine.py"],
            "details": "Runs deterministic DNS threat rules (R001-R008).",
        },
        {
            "id": "beh",
            "title": "Behavior Engine",
            "files": ["detection/behavior_engine.py"],
            "details": "Detects beaconing, concentration, exfil estimation, and DGA sweeps.",
        },
        {
            "id": "ml",
            "title": "ML Detector",
            "files": ["detection/ml_model.py", "models/saved/dns_classifier.pkl"],
            "details": "Loads trained model and produces malicious probability scores.",
        },
        {
            "id": "score",
            "title": "Scoring",
            "files": ["scoring/threat_scorer.py"],
            "details": "Computes 0-100 threat score and severity.",
        },
        {
            "id": "alert",
            "title": "Alert Engine",
            "files": ["alerts/alert_engine.py"],
            "details": "Stores analyst-ready alerts in SQLite.",
        },
        {
            "id": "dash",
            "title": "Dashboards",
            "files": ["dashboard/app.py", "showcase/src/App.js"],
            "details": "Streamlit SOC dashboard + React showcase frontend.",
        },
    ]

    for m in modules:
        exists = []
        for rel in m["files"]:
            p = ROOT / rel
            exists.append({"path": rel, "exists": p.exists()})
        m["file_status"] = exists
    return modules


def get_system_status() -> dict[str, Any]:
    model_exists = MODEL_PATH.exists()
    scaler_exists = SCALER_PATH.exists()
    q = load_queries()
    alerts = load_alerts()
    mode = os.environ.get("SENTINEL_MODE", "demo").strip().upper()
    data_source = "LIVE_CAPTURE" if mode == "LIVE" else "DEMO_FEED"
    return {
        "model": {
            "path": str(MODEL_PATH.relative_to(ROOT)),
            "exists": model_exists,
            "size_bytes": MODEL_PATH.stat().st_size if model_exists else 0,
        },
        "scaler": {
            "path": str(SCALER_PATH.relative_to(ROOT)),
            "exists": scaler_exists,
            "size_bytes": SCALER_PATH.stat().st_size if scaler_exists else 0,
        },
        "data_sources": {
            "parsed_csv_exists": PARSED_CSV.exists(),
            "raw_live_exists": RAW_LIVE_CSV.exists(),
            "raw_demo_exists": RAW_DEMO_CSV.exists(),
            "alerts_db_exists": ALERT_DB.exists(),
        },
        "runtime": {
            "queries_loaded": int(len(q)),
            "alerts_loaded": int(len(alerts)),
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "mode": data_source,
        },
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "SentinelAPI/1.0"

    def _send(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self._send(HTTPStatus.OK, {"ok": True})

    def _write_sse(self, event: str, data: dict[str, Any]) -> None:
        payload = json.dumps(data, default=str)
        msg = f"event: {event}\ndata: {payload}\n\n".encode("utf-8")
        self.wfile.write(msg)
        self.wfile.flush()

    def _stream_realtime(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

        last_alert_id: str | None = None

        try:
            while True:
                summary = get_summary()
                latest_alerts = load_alerts(limit=20)

                new_alerts: list[dict[str, Any]] = []
                if last_alert_id is not None:
                    for row in latest_alerts:
                        if row.get("alert_id") == last_alert_id:
                            break
                        new_alerts.append(row)
                    new_alerts.reverse()

                if latest_alerts:
                    last_alert_id = str(latest_alerts[0].get("alert_id"))

                self._write_sse(
                    "tick",
                    {
                        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                        "summary": summary,
                        "new_alerts": new_alerts[:10],
                    },
                )

                time.sleep(2)
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as e:
            try:
                self._write_sse("error", {"message": str(e)})
            except Exception:
                pass
            return

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        try:
            if path in ["/", "/health", "/api/health"]:
                return self._send(HTTPStatus.OK, {"ok": True, "service": "sentinel-api"})

            if path == "/api/summary":
                return self._send(HTTPStatus.OK, {"ok": True, "data": get_summary()})

            if path == "/api/stream":
                return self._stream_realtime()

            if path == "/api/alerts":
                limit = int(query.get("limit", [50])[0])
                severity = query.get("severity", [None])[0]
                rows = load_alerts(limit=None)
                if severity:
                    rows = [r for r in rows if str(r.get("severity", "")).upper() == severity.upper()]
                else:
                    # Dashboard-first ordering: always surface HIGH/MEDIUM alerts first so
                    # analysts can immediately see critical cases, then rank by score/time.
                    rows = sorted(rows, key=_alert_sort_key, reverse=True)
                return self._send(HTTPStatus.OK, {"ok": True, "data": rows[:limit]})

            if path == "/api/queries":
                limit = int(query.get("limit", [50])[0])
                q = load_queries().sort_values("timestamp", ascending=False).head(limit)
                rows = []
                for _, r in q.iterrows():
                    rows.append(
                        {
                            "timestamp": r.get("timestamp").isoformat() if pd.notna(r.get("timestamp")) else "",
                            "timestamp_utc": r.get("timestamp").isoformat() if pd.notna(r.get("timestamp")) else "",
                            "src_ip": r.get("src_ip", ""),
                            "query_name": r.get("query_name", ""),
                            "query_type": _qtype_to_int(r.get("query_type", 0)),
                            "rcode": int(r.get("rcode", 0)) if str(r.get("rcode", "")).strip() else 0,
                            "label": int(r.get("label", 0)),
                            "status": r.get("status", "normal"),
                        }
                    )
                return self._send(HTTPStatus.OK, {"ok": True, "data": rows})

            if path == "/api/charts":
                return self._send(HTTPStatus.OK, {"ok": True, "data": get_charts()})

            if path == "/api/modules":
                return self._send(HTTPStatus.OK, {"ok": True, "data": get_modules()})

            if path == "/api/system":
                return self._send(HTTPStatus.OK, {"ok": True, "data": get_system_status()})

            if path == "/api/model":
                return self._send(HTTPStatus.OK, {"ok": True, "data": load_training_history()})

            if path.startswith("/api/iat/"):
                host = unquote(path.split("/api/iat/")[-1].strip())
                df = load_queries()
                host_df = df[df["src_ip"] == host].copy() if not df.empty else pd.DataFrame()
                iat_data: list[dict[str, Any]] = []
                if not host_df.empty and "timestamp" in host_df.columns:
                    host_df = host_df.sort_values("timestamp").reset_index(drop=True)
                    ts = pd.to_datetime(host_df["timestamp"], errors="coerce", utc=True)
                    ts = ts.dropna().reset_index(drop=True)
                    if len(ts) > 1:
                        iats = ts.diff().dropna().dt.total_seconds().tolist()
                        iat_data = [
                            {
                                "idx": i,
                                "iat": round(float(v), 3),
                                "suspicious": (float(v) < 20 and float(v) > 0),
                            }
                            for i, v in enumerate(iats[:120])
                        ]
                return self._send(HTTPStatus.OK, {"ok": True, "data": {"host": host, "iat_series": iat_data}})

            return self._send(HTTPStatus.NOT_FOUND, {"ok": False, "error": f"Unknown endpoint: {path}"})
        except Exception as e:
            return self._send(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": str(e)})


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Sentinel JSON API server")
    p.add_argument("--host", default="0.0.0.0")
    p.add_argument("--port", type=int, default=8000)
    return p.parse_args()


def main() -> None:
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Sentinel API listening on http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
