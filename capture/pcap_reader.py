#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


def validate_record(row: dict) -> bool:
    required = ["timestamp", "src_ip", "dst_ip", "query_name", "query_type", "transaction_id"]
    for key in required:
        if key not in row or row[key] in (None, ""):
            return False
    return True


def _safe_float(v, default=0.0):
    try:
        return float(v)
    except Exception:
        return default


def _safe_int(v, default=-1):
    try:
        return int(v)
    except Exception:
        return default


def parse_pcap(input_path: Path, verbose: bool = False) -> pd.DataFrame:
    try:
        import pyshark
    except Exception as e:  # pragma: no cover
        raise RuntimeError("pyshark is required: pip install pyshark") from e

    cap = pyshark.FileCapture(str(input_path), display_filter="dns", keep_packets=False)
    rows: list[dict] = []

    for pkt in cap:
        try:
            if not hasattr(pkt, "dns"):
                continue
            dns = pkt.dns
            ip = getattr(pkt, "ip", None)
            if ip is None:
                continue

            qname = str(getattr(dns, "qry_name", "")).rstrip(".").lower()
            qtype = _safe_int(getattr(dns, "qry_type", -1))
            rcode = _safe_int(getattr(dns, "flags_rcode", -1))
            txn_id = _safe_int(getattr(dns, "id", -1))

            answer = ""
            if hasattr(dns, "a"):
                answer = str(getattr(dns, "a", ""))

            row = {
                "timestamp": _safe_float(getattr(pkt, "sniff_timestamp", 0.0)),
                "src_ip": str(getattr(ip, "src", "")),
                "dst_ip": str(getattr(ip, "dst", "")),
                "query_name": qname,
                "query_type": qtype,
                "rcode": rcode,
                "transaction_id": txn_id,
                "answer": answer,
            }
            if validate_record(row):
                rows.append(row)
            elif verbose:
                print(f"Dropped malformed row: {row}")
        except Exception:
            continue

    df = pd.DataFrame(rows)
    if df.empty:
        return df

    df["timestamp_dt"] = pd.to_datetime(df["timestamp"], unit="s", errors="coerce")
    df["query_name"] = df["query_name"].astype(str).str.rstrip(".").str.lower()
    return df


def summarize(df: pd.DataFrame) -> str:
    if df.empty:
        return "No DNS records found"
    nxdomain_rate = float((df["rcode"] == 3).mean()) if "rcode" in df else 0.0
    return (
        f"total records={len(df)} | unique hosts={df['src_ip'].nunique()} | "
        f"unique domains={df['query_name'].nunique()} | NXDOMAIN rate={nxdomain_rate:.2%}"
    )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Parse DNS packets from pcap into CSV")
    p.add_argument("--input", required=True, help="Path to pcap file")
    p.add_argument("--output", required=True, help="Output CSV path")
    p.add_argument("--verbose", action="store_true")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    df = parse_pcap(input_path, verbose=args.verbose)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    print(summarize(df))


if __name__ == "__main__":
    main()
