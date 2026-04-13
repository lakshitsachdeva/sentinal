"""Main DNS detector orchestrator."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from alerts.alert_engine import format_terminal_alert, generate_alert
from detection.behavior_engine import analyze_behavior
from detection.ml_model import MLDetector
from detection.rule_engine import run_rules
from features.session import get_base_domain, session_features_per_domain
from features.temporal import temporal_features_for_host
from scoring.threat_scorer import compute_risk_score


class DNSDetector:
    def __init__(self, config_path="config.yaml"):
        self.config = self._load_config(config_path)
        self.ml_detector = MLDetector(
            model_path=self.config.get("model_path", "models/saved/dns_classifier.pkl"),
            threshold=float(self.config.get("ml_threshold", 0.75)),
        )
        self.alerts_db = self.config.get("alerts_db", "alerts/alerts.db")
        self.alert_cfg = self.config.get("alerts", {}) if isinstance(self.config.get("alerts", {}), dict) else {}
        self.dedup_window = int(self.alert_cfg.get("dedup_window_minutes", 30))
        self.run_id = "manual"

    def _load_config(self, path: str) -> dict:
        p = Path(path)
        if not p.exists():
            return {}
        try:
            import yaml

            return yaml.safe_load(p.read_text()) or {}
        except Exception:
            return {}

    def analyze_session(self, src_ip: str, domain: str, features: dict, temporal: dict) -> dict:
        rule_violations = run_rules(features)
        behavior_flags = analyze_behavior(features, temporal)
        ml_result = self.ml_detector.predict(features)
        score_result = compute_risk_score(rule_violations, behavior_flags, ml_result)
        should_alert = bool(
            rule_violations
            or behavior_flags
            or ml_result.get("ml_malicious", False)
            or float(score_result.get("total_score", 0.0)) >= 10.0
        )
        alert = None
        if should_alert:
            alert = generate_alert(
                src_host=src_ip,
                domain=domain,
                rule_violations=rule_violations,
                behavior_flags=behavior_flags,
                ml_result=ml_result,
                score_result=score_result,
                features_dict=features,
                db_path=self.alerts_db,
                run_id=self.run_id,
                dedup_window=self.dedup_window,
            )

        return {
            "src_ip": src_ip,
            "domain": domain,
            "rule_violations": rule_violations,
            "behavior_flags": behavior_flags,
            "ml_result": ml_result,
            "score": score_result,
            "alert": alert,
        }

    def run_on_dataframe(self, df: pd.DataFrame, run_id: str | None = None) -> list[dict]:
        if df.empty:
            return []
        self.run_id = run_id or "manual"
        work = df.copy()
        if "base_domain" not in work.columns:
            work["base_domain"] = work["query_name"].astype(str).map(get_base_domain)
        if "rcode" not in work.columns:
            work["rcode"] = 0

        alerts: list[dict] = []
        for (src_ip, domain), g in work.groupby(["src_ip", "base_domain"]):
            # Domain-session behavior features.
            domain_features = session_features_per_domain(work, domain)

            # Add lexical feature aggregates for this host-domain session.
            lexical_mean_cols = [
                "query_length",
                "subdomain_length",
                "label_count",
                "max_label_length",
                "full_entropy",
                "subdomain_entropy",
                "digit_ratio",
                "hyphen_count",
                "consonant_vowel_ratio",
                "longest_consonant_run",
                "hex_ratio",
            ]
            for col in lexical_mean_cols:
                if col in g.columns:
                    domain_features[col] = float(pd.to_numeric(g[col], errors="coerce").fillna(0).mean())
                else:
                    domain_features[col] = float(domain_features.get(col, 0.0))

            if "looks_base64" in g.columns:
                domain_features["looks_base64"] = int(
                    pd.to_numeric(g["looks_base64"], errors="coerce").fillna(0).max()
                )
            else:
                domain_features["looks_base64"] = int(domain_features.get("looks_base64", 0))

            # Off-hours feature for behavior layer.
            ts = pd.to_datetime(g["timestamp"], unit="s", errors="coerce")
            if ts.isna().all():
                ts = pd.to_datetime(g["timestamp"], errors="coerce")
            domain_features["off_hours_count"] = int(ts.dt.hour.between(0, 5, inclusive="both").sum())

            temporal = temporal_features_for_host(work[work["src_ip"] == src_ip])
            temporal["beacon_interval"] = temporal.get("beacon_interval_est", 0.0)
            domain_features["query_rate_per_min"] = float(temporal.get("query_rate_per_min", 0.0))
            domain_features["iat_cv"] = float(temporal.get("iat_cv", 1.0))
            domain_features["beacon_score"] = float(temporal.get("beacon_score", 0.0))
            domain_features["is_beaconing"] = int(temporal.get("is_beaconing", 0))

            result = self.analyze_session(src_ip, domain, domain_features, temporal)
            if result.get("alert") is not None:
                alerts.append(result)

        return sorted(alerts, key=lambda x: x["score"]["total_score"], reverse=True)

    def live_analyze(self, pcap_path=None, interface=None):
        if pcap_path:
            from capture.pcap_reader import parse_pcap

            df = parse_pcap(Path(pcap_path))
            results = self.run_on_dataframe(df)
            for res in results:
                print(format_terminal_alert(res["alert"]))
            return results

        print(
            "Live analyze expects captured packet data. Use run_pipeline.py --mode live for rolling analysis."
        )
        return []
