"""Feature pipeline orchestrator."""
from __future__ import annotations

from typing import List

import pandas as pd
from tqdm import tqdm

from features.lexical import extract_lexical_features
from features.session import build_session_feature_matrix, get_base_domain
from features.temporal import temporal_features_for_host


def get_feature_columns() -> List[str]:
    return [
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
        "looks_base64",
        "is_beaconing",
        "beacon_score",
        "iat_cv",
        "query_rate_per_min",
        "unique_subdomains",
        "nxdomain_rate",
        "txt_query_ratio",
    ]


def run_full_pipeline(raw_csv_path: str, output_path: str) -> pd.DataFrame:
    df = pd.read_csv(raw_csv_path)
    required = ["timestamp", "src_ip", "query_name", "query_type"]
    for col in required:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}")

    if "rcode" not in df.columns:
        df["rcode"] = 0
    if "label" not in df.columns:
        df["label"] = 0

    # Row-level lexical features.
    tqdm.pandas(desc="lexical")
    lex_df = df["query_name"].progress_apply(lambda q: pd.Series(extract_lexical_features(str(q))))
    df = pd.concat([df, lex_df], axis=1)

    # Host-level temporal features.
    temporal_rows = []
    for src_ip, g in tqdm(df.groupby("src_ip"), desc="temporal"):
        feat = temporal_features_for_host(g)
        feat["src_ip"] = src_ip
        temporal_rows.append(feat)
    temporal_df = pd.DataFrame(temporal_rows)
    df = df.merge(temporal_df, on="src_ip", how="left")

    # Domain/session features.
    df["base_domain"] = df["query_name"].astype(str).map(get_base_domain)
    sess_df = build_session_feature_matrix(df)
    df = df.merge(sess_df, left_on="base_domain", right_on="domain", how="left", suffixes=("", "_session"))

    # Keep one final label column.
    if "label_session" in df.columns:
        df["label"] = df[["label", "label_session"]].max(axis=1)
        df = df.drop(columns=["label_session"])

    df = df.fillna(0)
    df.to_csv(output_path, index=False)

    print(f"Feature matrix saved: {output_path}")
    print(f"Shape: {df.shape}")
    if "label" in df.columns:
        print("Label distribution:")
        print(df["label"].value_counts(dropna=False).to_string())

    candidate = [c for c in get_feature_columns() if c in df.columns]
    if candidate and "label" in df.columns:
        corr = df[candidate + ["label"]].corr(numeric_only=True)["label"].drop("label", errors="ignore")
        top5 = corr.abs().sort_values(ascending=False).head(5)
        print("Top 5 predictive features (|corr| with label):")
        for name, val in top5.items():
            print(f"  - {name}: {val:.4f}")

    return df


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser(description="Run full DNS feature pipeline")
    p.add_argument("--input", required=True)
    p.add_argument("--output", required=True)
    args = p.parse_args()

    run_full_pipeline(args.input, args.output)
