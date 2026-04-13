"""Temporal DNS feature extraction.

Temporal regularity is a strong C2 indicator because malware beacons often
communicate on fixed intervals unlike human traffic.
"""
from __future__ import annotations

from typing import List

import numpy as np
import pandas as pd


def compute_inter_arrival_times(timestamps: List[float]) -> np.ndarray:
    ts = np.array(sorted(float(t) for t in timestamps), dtype=float)
    if len(ts) < 2:
        return np.array([], dtype=float)
    return np.diff(ts)


def detect_beaconing(timestamps: List[float], min_queries: int = 5, min_interval: float = 5.0) -> dict:
    iat = compute_inter_arrival_times(timestamps)
    if len(timestamps) < min_queries or len(iat) == 0:
        return {
            "is_beaconing": False,
            "beacon_interval": 0.0,
            "beacon_score": 0.0,
            "iat_mean": 0.0,
            "iat_std": 0.0,
            "iat_cv": 1.0,
        }

    mean = float(iat.mean())
    std = float(iat.std())
    cv = float(std / mean) if mean > 0 else 1.0

    # Low CV means very regular timing, characteristic of automated callbacks.
    raw_score = max(0.0, 1.0 - cv)
    interval_gate = 1.0 if mean >= min_interval else mean / max(min_interval, 1e-9)
    score = min(1.0, raw_score * interval_gate)
    is_beaconing = bool(score > 0.7 and cv < 0.35)

    return {
        "is_beaconing": is_beaconing,
        "beacon_interval": mean,
        "beacon_score": score,
        "iat_mean": mean,
        "iat_std": std,
        "iat_cv": cv,
    }


def temporal_features_for_host(host_df: pd.DataFrame) -> dict:
    """Compute host-level timing features for C2 detection.

    Metrics explainability:
    - query_rate_per_min: high sustained DNS volume can indicate automation.
    - iat_mean/std/cv: regular spacing suggests beaconing.
    - beacon_score: normalized 0-1 periodicity strength.
    """
    if host_df.empty:
        return {
            "total_queries": 0,
            "query_rate_per_min": 0.0,
            "iat_mean": 0.0,
            "iat_std": 0.0,
            "iat_cv": 1.0,
            "is_beaconing": 0,
            "beacon_score": 0.0,
            "beacon_interval_est": 0.0,
        }

    ts = host_df["timestamp"].astype(float).sort_values().to_numpy()
    duration_sec = float(ts[-1] - ts[0]) if len(ts) > 1 else 0.0
    rate = (len(ts) / max(duration_sec / 60.0, 1e-9)) if duration_sec > 0 else float(len(ts))

    beacon = detect_beaconing(ts.tolist())

    return {
        "total_queries": int(len(ts)),
        "query_rate_per_min": float(rate),
        "iat_mean": float(beacon["iat_mean"]),
        "iat_std": float(beacon["iat_std"]),
        "iat_cv": float(beacon["iat_cv"]),
        "is_beaconing": int(beacon["is_beaconing"]),
        "beacon_score": float(beacon["beacon_score"]),
        "beacon_interval_est": float(beacon["beacon_interval"]),
    }


def _example_usage() -> None:
    beacon_ts = [0, 15, 30, 45, 60, 75, 90]
    human_ts = [0, 3, 11, 19, 42, 70, 71, 111]
    b = detect_beaconing(beacon_ts)
    h = detect_beaconing(human_ts)
    print("Beaconing sample:", b)
    print("Human sample:", h)


if __name__ == "__main__":
    _example_usage()
