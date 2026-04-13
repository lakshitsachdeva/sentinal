#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys
import platform
import uuid
from pathlib import Path

import numpy as np
import pandas as pd

from alerts.alert_engine import format_terminal_alert
from capture.pcap_reader import parse_pcap
from detection.detector import DNSDetector
from features.feature_pipeline import run_full_pipeline


def startup_banner(mode: str) -> None:
    print("=" * 64)
    print("DNS IDS PIPELINE")
    print(f"MODE: {mode.upper()}")
    print("=" * 64)


def generate_demo_raw(out_csv: Path, minutes: int = 5) -> pd.DataFrame:
    now = pd.Timestamp.now("UTC")
    rows = []
    for i in range(minutes * 60):
        ts = now - pd.Timedelta(seconds=(minutes * 60 - i)) + pd.Timedelta(
            milliseconds=int(np.random.randint(0, 700))
        )
        benign = {
            "timestamp": ts.timestamp(),
            "src_ip": f"10.0.0.{int(np.random.randint(2, 10))}",
            "query_name": np.random.choice(["www.google.com", "api.github.com", "cdn.cloudflare.com"]),
            "query_type": 1,
            "rcode": 0,
            "label": 0,
        }
        rows.append(benign)
        if i % 10 == 0:
            attack = {
                "timestamp": ts.timestamp(),
                "src_ip": "10.0.0.99",
                "query_name": f"chunk{i}.dGhpcy1pcy1zZWNyZXQ=.labdomain.internal",
                "query_type": 16,
                "rcode": np.random.choice([0, 3]),
                "label": 1,
            }
            rows.append(attack)
    df = pd.DataFrame(rows)
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_csv, index=False)
    return df


def run_detection_on_df(df: pd.DataFrame, run_id: str | None = None) -> list[dict]:
    detector = DNSDetector(config_path="config.yaml")
    results = detector.run_on_dataframe(df, run_id=run_id)
    for res in results[:30]:
        print(format_terminal_alert(res["alert"]))
    return results


def mode_demo(launch_dashboard: bool = True, run_id: str | None = None) -> None:
    run_id = run_id or f"demo-{uuid.uuid4().hex[:8]}"
    raw_path = Path("data/raw/demo_raw.csv")
    feat_path = Path("data/features/demo_features.csv")
    parsed_for_dash = Path("data/parsed/parsed_dns.csv")

    df_raw = generate_demo_raw(raw_path, minutes=5)
    df_raw.to_csv(parsed_for_dash, index=False)

    df_feat = run_full_pipeline(str(raw_path), str(feat_path))
    run_detection_on_df(df_feat, run_id=run_id)

    if launch_dashboard:
        try:
            print("Launching dashboard on http://localhost:8501 ...")
            subprocess.Popen([sys.executable, "-m", "streamlit", "run", "dashboard/app.py"])
        except Exception as e:
            print(f"Could not launch dashboard automatically: {e}")
    else:
        print("Demo mode completed without launching Streamlit dashboard.")


def mode_live(interface: str, cycles: int = 3, run_id: str | None = None) -> None:
    from capture.sniffer import run_capture

    raw_path = Path("data/raw/live.csv")
    parsed_path = Path("data/parsed/parsed_dns.csv")
    feat_path = Path("data/features/live_features.csv")

    print(f"Starting live capture on interface={interface}")
    run_id = run_id or f"live-{uuid.uuid4().hex[:8]}"
    if raw_path.exists():
        try:
            raw_path.unlink()
        except Exception:
            pass
    last_count = 0
    for i in range(cycles):
        print(f"Cycle {i+1}/{cycles}: capturing 30s window")
        try:
            run_capture(interface=interface, output=raw_path, duration=30)
        except Exception as e:
            raise RuntimeError(
                f"Live capture failed on interface '{interface}'. "
                f"On macOS/Linux, raw sniffing may require elevated privileges. Error: {e}"
            ) from e

        raw_df = pd.read_csv(raw_path) if raw_path.exists() else pd.DataFrame()
        if raw_df.empty:
            print("No packets captured in this window; continuing.")
            continue

        new_df = raw_df.iloc[last_count:].copy()
        last_count = len(raw_df)
        if new_df.empty:
            print("No new packets captured since last cycle; continuing.")
            continue

        cycle_raw = Path("data/raw/live_cycle.csv")
        cycle_raw.parent.mkdir(parents=True, exist_ok=True)
        new_df.to_csv(cycle_raw, index=False)

        # Keep parsed log for dashboards.
        if parsed_path.exists():
            existing = pd.read_csv(parsed_path)
            combined = pd.concat([existing, new_df], ignore_index=True).tail(50000)
            combined.to_csv(parsed_path, index=False)
        else:
            parsed_path.parent.mkdir(parents=True, exist_ok=True)
            new_df.to_csv(parsed_path, index=False)

        df_feat = run_full_pipeline(str(cycle_raw), str(feat_path))
        run_detection_on_df(df_feat, run_id=f"{run_id}-c{i+1}")


def mode_offline(pcap_path: str, run_id: str | None = None) -> None:
    parsed_path = Path("data/parsed/parsed_dns.csv")
    feat_path = Path("data/features/offline_features.csv")

    df = parse_pcap(Path(pcap_path))
    if df.empty:
        print("No DNS records parsed from pcap")
        return
    if "label" not in df.columns:
        df["label"] = 0
    df.to_csv(parsed_path, index=False)

    df_feat = run_full_pipeline(str(parsed_path), str(feat_path))
    run_detection_on_df(df_feat, run_id=run_id or f"offline-{uuid.uuid4().hex[:8]}")
    print(f"Offline report saved. Parsed={parsed_path} Features={feat_path}")


def mode_train(data_path: str) -> None:
    from models.train import train

    train(Path(data_path), Path("models/saved/dns_classifier.pkl"))


def parse_args() -> argparse.Namespace:
    default_interface = "lo0" if platform.system().lower() == "darwin" else "eth0"
    p = argparse.ArgumentParser(description="Run DNS IDS pipeline")
    p.add_argument("--mode", choices=["demo", "live", "offline", "train"], required=True)
    p.add_argument("--interface", default=default_interface)
    p.add_argument("--pcap", default=None)
    p.add_argument("--data", default="data/features/labeled_features.csv")
    p.add_argument("--cycles", type=int, default=3)
    p.add_argument("--no-dashboard", action="store_true")
    p.add_argument("--run-id", default=None)
    return p.parse_args()


def main() -> None:
    args = parse_args()
    startup_banner(args.mode)

    if args.mode == "demo":
        mode_demo(launch_dashboard=not args.no_dashboard, run_id=args.run_id)
    elif args.mode == "live":
        mode_live(interface=args.interface, cycles=args.cycles, run_id=args.run_id)
    elif args.mode == "offline":
        if not args.pcap:
            raise ValueError("--pcap is required in offline mode")
        mode_offline(args.pcap, run_id=args.run_id)
    elif args.mode == "train":
        mode_train(args.data)


if __name__ == "__main__":
    main()
