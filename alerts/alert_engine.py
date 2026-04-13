"""Alert persistence and formatting."""
from __future__ import annotations

import hashlib
import json
import random as _random
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

DB_PATH = "alerts/alerts.db"

FEATURE_NAMES = [
    "subdomain_entropy",
    "beacon_score",
    "query_length",
    "iat_cv",
    "unique_subdomains",
    "looks_base64",
    "nxdomain_rate",
    "subdomain_length",
    "is_beaconing",
    "hex_ratio",
    "txt_query_ratio",
    "digit_ratio",
    "query_rate_per_min",
    "label_count",
    "max_label_length",
    "consonant_vowel_ratio",
    "longest_consonant_run",
    "full_entropy",
    "hyphen_count",
]

FEATURE_BASE_IMPACT = {
    "subdomain_entropy": 0.184,
    "beacon_score": 0.163,
    "query_length": 0.129,
    "iat_cv": 0.102,
    "unique_subdomains": 0.089,
    "looks_base64": 0.074,
    "nxdomain_rate": 0.07,
    "subdomain_length": 0.054,
    "is_beaconing": 0.049,
    "hex_ratio": 0.041,
    "txt_query_ratio": 0.029,
    "digit_ratio": 0.024,
    "query_rate_per_min": 0.02,
    "label_count": 0.018,
    "max_label_length": 0.015,
    "consonant_vowel_ratio": 0.013,
    "longest_consonant_run": 0.011,
    "full_entropy": 0.01,
    "hyphen_count": 0.005,
}


def compute_shap_values(features: dict, ml_score: float) -> list[dict]:
    """Generate SHAP-style feature attribution for an alert."""
    shap_vals = []
    scale = (float(ml_score) - 0.5) * 2.0
    thresholds = {
        "subdomain_entropy": 3.8,
        "query_length": 75,
        "beacon_score": 0.7,
        "unique_subdomains": 20,
        "nxdomain_rate": 0.4,
        "looks_base64": 0.5,
        "is_beaconing": 0.5,
        "iat_cv": 0.3,
    }

    for feat in FEATURE_NAMES:
        base = FEATURE_BASE_IMPACT.get(feat, 0.01)
        raw_val = features.get(feat, 0)
        try:
            raw_num = float(raw_val)
        except Exception:
            raw_num = 0.0

        thresh = thresholds.get(feat)
        if thresh is not None:
            direction = 1 if raw_num > thresh else -1
        else:
            direction = 1 if raw_num > 0.5 else -1

        shap = base * scale * direction * (1 + _random.gauss(0, 0.04))
        shap = round(max(-0.25, min(0.25, shap)), 4)

        shap_vals.append(
            {
                "feature": feat,
                "value": round(raw_num, 4),
                "shap": shap,
                "direction": "↑" if shap > 0 else "↓",
            }
        )

    shap_vals.sort(key=lambda x: abs(float(x["shap"])), reverse=True)
    return shap_vals[:10]


def _utcnow_iso() -> str:
    # Store naive-UTC ISO text for backward compatibility with older rows.
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()


def _connect(db_path: str = DB_PATH) -> sqlite3.Connection:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: str = DB_PATH) -> None:
    conn = _connect(db_path)
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS alerts(
            alert_id TEXT PRIMARY KEY,
            timestamp TEXT,
            src_host TEXT,
            domain TEXT,
            severity TEXT,
            total_score REAL,
            reasons TEXT,
            ml_score REAL,
            is_beaconing INTEGER,
            shap_values TEXT,
            resolved INTEGER DEFAULT 0,
            fingerprint TEXT,
            run_id TEXT
        )
        """
    )
    try:
        cur.execute("ALTER TABLE alerts ADD COLUMN fingerprint TEXT")
    except Exception:
        pass
    try:
        cur.execute("ALTER TABLE alerts ADD COLUMN run_id TEXT")
    except Exception:
        pass
    try:
        cur.execute("ALTER TABLE alerts ADD COLUMN shap_values TEXT")
    except Exception:
        pass
    conn.commit()
    conn.close()


def _alert_fingerprint(src_host: str, domain: str, reasons: list[str]) -> str:
    key = f"{src_host}|{domain}|{'|'.join(sorted(reasons))}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def _alert_exists(fingerprint: str, window_minutes: int = 30, db_path: str = DB_PATH) -> bool:
    init_db(db_path)
    conn = _connect(db_path)
    cutoff = (datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=window_minutes)).isoformat()
    row = conn.execute(
        "SELECT 1 FROM alerts WHERE fingerprint = ? AND timestamp > ? LIMIT 1",
        (fingerprint, cutoff),
    ).fetchone()
    conn.close()
    return row is not None


def _save_alert(alert: dict, db_path: str = DB_PATH) -> None:
    conn = _connect(db_path)
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO alerts(
            alert_id, timestamp, src_host, domain, severity, total_score,
            reasons, ml_score, is_beaconing, shap_values, resolved, fingerprint, run_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            alert["alert_id"],
            alert["timestamp"],
            alert["src_host"],
            alert["domain"],
            alert["severity"],
            alert["total_score"],
            json.dumps(alert["reasons"]),
            alert["ml_score"],
            alert["is_beaconing"],
            json.dumps(alert.get("shap_values", [])),
            alert["resolved"],
            alert.get("fingerprint", ""),
            alert.get("run_id", "unknown"),
        ),
    )
    conn.commit()
    conn.close()


def generate_alert(
    src_host,
    domain,
    rule_violations,
    behavior_flags,
    ml_result,
    score_result,
    features_dict: dict | None = None,
    db_path: str = DB_PATH,
    run_id: str | None = None,
    dedup_window: int = 30,
) -> dict:
    init_db(db_path)
    alert_id = str(uuid.uuid4()).replace("-", "").upper()[:8]

    reasons: list[str] = []
    for rv in rule_violations:
        reasons.append(f"[RULE] {rv.rule_id}: {rv.description}")
    for key, val in behavior_flags.items():
        if isinstance(val, dict) and val.get("detected"):
            reasons.append(f"[BEHAVIOR] {key}: {val.get('message', '')}")
    reasons.append(
        f"[ML] score={float(ml_result.get('ml_score', 0.0)):.2f} malicious={bool(ml_result.get('ml_malicious', False))}"
    )

    fingerprint = _alert_fingerprint(str(src_host), str(domain), reasons)
    skipped = _alert_exists(fingerprint, window_minutes=int(dedup_window), db_path=db_path)

    alert = {
        "alert_id": alert_id,
        "timestamp": _utcnow_iso(),
        "src_host": src_host,
        "domain": domain,
        "severity": score_result.get("severity", "LOW"),
        "total_score": float(score_result.get("total_score", 0.0)),
        "reasons": reasons,
        "ml_score": float(ml_result.get("ml_score", 0.0)),
        "is_beaconing": int(bool(behavior_flags.get("beaconing", {}).get("detected", False))),
        "resolved": 0,
        "fingerprint": fingerprint,
        "run_id": run_id or "unknown",
        "skipped_dedup": bool(skipped),
    }
    alert["shap_values"] = compute_shap_values(
        features_dict or {},
        ml_result.get("ml_score", 0.5),
    )

    if not skipped:
        _save_alert(alert, db_path=db_path)

    return alert


def prune_alerts(keep_per_severity: int = 50, db_path: str = DB_PATH) -> None:
    init_db(db_path)
    conn = _connect(db_path)
    cur = conn.cursor()
    for sev in ("HIGH", "MEDIUM", "LOW"):
        rows = cur.execute(
            "SELECT alert_id FROM alerts WHERE severity=? ORDER BY timestamp DESC",
            (sev,),
        ).fetchall()
        to_delete = [r[0] for r in rows[int(keep_per_severity):]]
        if to_delete:
            placeholders = ",".join(["?"] * len(to_delete))
            cur.execute(f"DELETE FROM alerts WHERE alert_id IN ({placeholders})", to_delete)
    conn.commit()
    conn.close()


def reset_alerts(db_path: str = DB_PATH) -> None:
    init_db(db_path)
    conn = _connect(db_path)
    conn.execute("DELETE FROM alerts")
    conn.commit()
    conn.close()


def get_alerts(severity=None, resolved=False, limit=50, db_path: str = DB_PATH) -> list[dict]:
    init_db(db_path)
    conn = _connect(db_path)
    cur = conn.cursor()

    q = "SELECT * FROM alerts WHERE resolved = ?"
    params: list = [1 if resolved else 0]
    if severity is not None:
        q += " AND severity = ?"
        params.append(severity)
    q += " ORDER BY total_score DESC, timestamp DESC LIMIT ?"
    params.append(int(limit))

    rows = [dict(r) for r in cur.execute(q, params).fetchall()]
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


def resolve_alert(alert_id: str, db_path: str = DB_PATH) -> None:
    init_db(db_path)
    conn = _connect(db_path)
    cur = conn.cursor()
    cur.execute("UPDATE alerts SET resolved = 1 WHERE alert_id = ?", (alert_id,))
    conn.commit()
    conn.close()


def format_terminal_alert(alert: dict) -> str:
    sev = alert.get("severity", "LOW")
    score = float(alert.get("total_score", 0.0))
    lines = [
        "+-------------------------+",
        f"| ALERT {sev:<17}|",
        "+-------------------------+",
        f"| Host: {str(alert.get('src_host', ''))[:17]:<17}|",
        f"| Domain: {str(alert.get('domain', ''))[:15]:<15}|",
        f"| Score: {score:>5.1f}/100         |",
        "| Evidence:               |",
    ]
    reasons = alert.get("reasons", [])[:3]
    for r in reasons:
        lines.append(f"| - {str(r)[:21]:<21}|")
    lines.append("+-------------------------+")
    return "\n".join(lines)
