#!/usr/bin/env python3
from __future__ import annotations

import random
from pathlib import Path

import numpy as np
import pandas as pd

FEATURE_COLS = [
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


def add_noise(v: float, scale: float = 0.05) -> float:
    return float(max(0.0, v + np.random.normal(0, scale)))


def benign_row() -> dict:
    return {
        "query_length": add_noise(random.uniform(10, 40), 1.5),
        "subdomain_length": add_noise(random.uniform(3, 12), 0.8),
        "label_count": random.randint(2, 4),
        "max_label_length": add_noise(random.uniform(5, 14), 0.7),
        "full_entropy": add_noise(random.uniform(1.5, 3.0), 0.1),
        "subdomain_entropy": add_noise(random.uniform(1.3, 2.8), 0.1),
        "digit_ratio": add_noise(random.uniform(0.0, 0.15), 0.02),
        "hyphen_count": random.randint(0, 2),
        "consonant_vowel_ratio": add_noise(random.uniform(0.45, 0.75), 0.03),
        "longest_consonant_run": random.randint(1, 4),
        "hex_ratio": add_noise(random.uniform(0.0, 0.3), 0.03),
        "looks_base64": 0,
        "is_beaconing": 0,
        "beacon_score": add_noise(random.uniform(0.0, 0.2), 0.03),
        "iat_cv": add_noise(random.uniform(0.5, 1.8), 0.08),
        "query_rate_per_min": add_noise(random.uniform(2, 18), 1.2),
        "unique_subdomains": add_noise(random.uniform(1, 8), 0.8),
        "nxdomain_rate": add_noise(random.uniform(0.0, 0.1), 0.01),
        "txt_query_ratio": add_noise(random.uniform(0.0, 0.08), 0.01),
        "label": 0,
    }


def attack_tunneling_row() -> dict:
    return {
        "query_length": add_noise(random.uniform(60, 100), 2.0),
        "subdomain_length": add_noise(random.uniform(45, 85), 2.0),
        "label_count": random.randint(3, 6),
        "max_label_length": add_noise(random.uniform(40, 85), 2.0),
        "full_entropy": add_noise(random.uniform(3.6, 4.6), 0.08),
        "subdomain_entropy": add_noise(random.uniform(3.8, 4.5), 0.08),
        "digit_ratio": add_noise(random.uniform(0.2, 0.55), 0.03),
        "hyphen_count": random.randint(0, 3),
        "consonant_vowel_ratio": add_noise(random.uniform(0.75, 0.95), 0.03),
        "longest_consonant_run": random.randint(4, 10),
        "hex_ratio": add_noise(random.uniform(0.2, 0.7), 0.04),
        "looks_base64": 1,
        "is_beaconing": 0,
        "beacon_score": add_noise(random.uniform(0.1, 0.4), 0.04),
        "iat_cv": add_noise(random.uniform(0.35, 0.9), 0.05),
        "query_rate_per_min": add_noise(random.uniform(15, 40), 1.5),
        "unique_subdomains": add_noise(random.uniform(15, 50), 2.0),
        "nxdomain_rate": add_noise(random.uniform(0.1, 0.45), 0.03),
        "txt_query_ratio": add_noise(random.uniform(0.3, 0.8), 0.03),
        "label": 1,
    }


def attack_beacon_row() -> dict:
    return {
        "query_length": add_noise(random.uniform(25, 45), 1.5),
        "subdomain_length": add_noise(random.uniform(12, 25), 1.2),
        "label_count": random.randint(2, 4),
        "max_label_length": add_noise(random.uniform(15, 30), 1.0),
        "full_entropy": add_noise(random.uniform(2.0, 3.0), 0.08),
        "subdomain_entropy": add_noise(random.uniform(2.0, 3.0), 0.08),
        "digit_ratio": add_noise(random.uniform(0.05, 0.3), 0.02),
        "hyphen_count": random.randint(0, 2),
        "consonant_vowel_ratio": add_noise(random.uniform(0.55, 0.85), 0.03),
        "longest_consonant_run": random.randint(2, 6),
        "hex_ratio": add_noise(random.uniform(0.05, 0.5), 0.04),
        "looks_base64": 0,
        "is_beaconing": 1,
        "beacon_score": add_noise(random.uniform(0.8, 1.0), 0.03),
        "iat_cv": add_noise(random.uniform(0.01, 0.2), 0.02),
        "query_rate_per_min": add_noise(random.uniform(3, 10), 0.8),
        "unique_subdomains": add_noise(random.uniform(1, 10), 0.8),
        "nxdomain_rate": add_noise(random.uniform(0.0, 0.2), 0.02),
        "txt_query_ratio": add_noise(random.uniform(0.0, 0.2), 0.02),
        "label": 1,
    }


def attack_dga_row() -> dict:
    return {
        "query_length": add_noise(random.uniform(35, 70), 1.8),
        "subdomain_length": add_noise(random.uniform(18, 45), 1.6),
        "label_count": random.randint(3, 5),
        "max_label_length": add_noise(random.uniform(15, 35), 1.2),
        "full_entropy": add_noise(random.uniform(3.5, 4.3), 0.08),
        "subdomain_entropy": add_noise(random.uniform(3.5, 4.2), 0.08),
        "digit_ratio": add_noise(random.uniform(0.2, 0.6), 0.03),
        "hyphen_count": random.randint(0, 2),
        "consonant_vowel_ratio": add_noise(random.uniform(0.8, 0.98), 0.02),
        "longest_consonant_run": random.randint(5, 12),
        "hex_ratio": add_noise(random.uniform(0.6, 0.98), 0.03),
        "looks_base64": 0,
        "is_beaconing": 0,
        "beacon_score": add_noise(random.uniform(0.0, 0.2), 0.03),
        "iat_cv": add_noise(random.uniform(0.4, 1.1), 0.06),
        "query_rate_per_min": add_noise(random.uniform(20, 55), 1.8),
        "unique_subdomains": add_noise(random.uniform(20, 60), 2.5),
        "nxdomain_rate": add_noise(random.uniform(0.6, 0.95), 0.03),
        "txt_query_ratio": add_noise(random.uniform(0.0, 0.15), 0.02),
        "label": 1,
    }


def main() -> None:
    np.random.seed(42)
    random.seed(42)

    total = 10_000
    benign_n = int(total * 0.70)
    mal_n = total - benign_n
    each_attack = mal_n // 3

    rows = []
    rows.extend(benign_row() for _ in range(benign_n))
    rows.extend(attack_tunneling_row() for _ in range(each_attack))
    rows.extend(attack_beacon_row() for _ in range(each_attack))
    rows.extend(attack_dga_row() for _ in range(mal_n - 2 * each_attack))

    df = pd.DataFrame(rows)
    out = Path("data/features/synthetic_training_data.csv")
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out, index=False)

    print("Saved:", out)
    print("Class distribution:")
    print(df["label"].value_counts().to_string())
    print("Feature statistics:")
    print(df[FEATURE_COLS].describe().to_string())


if __name__ == "__main__":
    main()
