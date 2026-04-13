"""Session-level DNS behavior features."""
from __future__ import annotations

import pandas as pd

from features.lexical import extract_lexical_features


KNOWN_ATTACK_TOKENS = ["labdomain", "malware", "dga", "c2", "evil"]


def get_base_domain(query_name: str) -> str:
    q = (query_name or "").strip().rstrip(".").lower()
    parts = [p for p in q.split(".") if p]
    if len(parts) >= 2:
        return ".".join(parts[-2:])
    return q


def session_features_per_domain(df: pd.DataFrame, domain: str) -> dict:
    domain = domain.lower()
    subset = df[df["base_domain"] == domain].copy()
    if subset.empty:
        return {
            "domain": domain,
            "unique_src_hosts": 0,
            "total_queries": 0,
            "unique_subdomains": 0,
            "nxdomain_rate": 0.0,
            "txt_query_ratio": 0.0,
            "queries_per_host_mean": 0.0,
            "queries_per_host_max": 0.0,
            "avg_query_length": 0.0,
            "avg_subdomain_entropy": 0.0,
            "label": 0,
        }

    per_host = subset.groupby("src_ip").size()
    entropy_vals = subset["query_name"].map(
        lambda q: extract_lexical_features(str(q)).get("subdomain_entropy", 0.0)
    )

    return {
        "domain": domain,
        "unique_src_hosts": int(subset["src_ip"].nunique()),
        "total_queries": int(len(subset)),
        "unique_subdomains": int(subset["query_name"].nunique()),
        "nxdomain_rate": float((subset["rcode"] == 3).mean()) if "rcode" in subset else 0.0,
        "txt_query_ratio": float((subset["query_type"] == 16).mean()) if "query_type" in subset else 0.0,
        "queries_per_host_mean": float(per_host.mean()) if len(per_host) else 0.0,
        "queries_per_host_max": float(per_host.max()) if len(per_host) else 0.0,
        "avg_query_length": float(subset["query_name"].astype(str).str.len().mean()),
        "avg_subdomain_entropy": float(entropy_vals.mean()) if len(entropy_vals) else 0.0,
        "label": int(any(tok in domain for tok in KNOWN_ATTACK_TOKENS)),
    }


def host_domain_concentration(df: pd.DataFrame) -> pd.DataFrame:
    work = df.copy()
    if "base_domain" not in work.columns:
        work["base_domain"] = work["query_name"].map(get_base_domain)

    pair_counts = (
        work.groupby(["src_ip", "base_domain"]).size().reset_index(name="query_count")
    )
    host_totals = work.groupby("src_ip").size().reset_index(name="host_total")
    out = pair_counts.merge(host_totals, on="src_ip", how="left")
    out["concentration_ratio"] = out["query_count"] / out["host_total"].clip(lower=1)
    out = out.rename(columns={"base_domain": "domain"})
    return out[["src_ip", "domain", "query_count", "concentration_ratio"]]


def build_session_feature_matrix(df: pd.DataFrame) -> pd.DataFrame:
    work = df.copy()
    if "base_domain" not in work.columns:
        work["base_domain"] = work["query_name"].map(get_base_domain)

    rows = [session_features_per_domain(work, d) for d in sorted(work["base_domain"].dropna().unique())]
    return pd.DataFrame(rows)


if __name__ == "__main__":
    sample = pd.DataFrame(
        {
            "src_ip": ["1.1.1.1", "1.1.1.1", "2.2.2.2"],
            "query_name": ["www.google.com", "api.google.com", "x.labdomain.internal"],
            "query_type": [1, 1, 16],
            "rcode": [0, 0, 3],
        }
    )
    sample["base_domain"] = sample["query_name"].map(get_base_domain)
    print(build_session_feature_matrix(sample))
