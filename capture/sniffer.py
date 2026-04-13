#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from loguru import logger

try:
    from scapy.all import DNS, DNSQR, DNSRR, IP, rdpcap, sniff
except Exception:  # pragma: no cover
    DNS = DNSQR = DNSRR = IP = None
    rdpcap = sniff = None


@dataclass
class CaptureState:
    records: list[dict]
    lock: threading.Lock
    total_queries: int = 0
    suspicious: int = 0


def qtype_to_int(qtype: Any) -> int:
    try:
        return int(qtype)
    except Exception:
        return -1


def decode_qname(raw: Any) -> str:
    if raw is None:
        return ""
    try:
        s = raw.decode(errors="ignore") if isinstance(raw, bytes) else str(raw)
        return s.rstrip(".").lower()
    except Exception:
        return ""


def packet_to_record(pkt: Any) -> dict | None:
    if DNS is None or IP is None:
        return None
    if not pkt.haslayer(DNS):
        return None
    dns_layer = pkt[DNS]
    ip_layer = pkt[IP] if pkt.haslayer(IP) else None
    ts = float(getattr(pkt, "time", time.time()))

    if dns_layer.qr == 0 and dns_layer.qd is not None:
        qname = decode_qname(dns_layer.qd.qname)
        return {
            "timestamp": ts,
            "src_ip": getattr(ip_layer, "src", "0.0.0.0"),
            "dst_ip": getattr(ip_layer, "dst", "0.0.0.0"),
            "query_name": qname,
            "query_type": qtype_to_int(getattr(dns_layer.qd, "qtype", -1)),
            "transaction_id": int(getattr(dns_layer, "id", -1)),
            "qr": 0,
            "rcode": "",
            "answer_count": int(getattr(dns_layer, "ancount", 0)),
            "response_ips": "",
        }

    if dns_layer.qr == 1:
        qname = ""
        qtype = -1
        if dns_layer.qd is not None:
            qname = decode_qname(dns_layer.qd.qname)
            qtype = qtype_to_int(getattr(dns_layer.qd, "qtype", -1))

        response_ips = []
        ancount = int(getattr(dns_layer, "ancount", 0))
        answer = getattr(dns_layer, "an", None)
        if ancount > 0 and answer is not None:
            rr = answer
            for _ in range(ancount):
                try:
                    if getattr(rr, "type", None) == 1:
                        response_ips.append(str(getattr(rr, "rdata", "")))
                    rr = rr.payload
                except Exception:
                    break

        return {
            "timestamp": ts,
            "src_ip": getattr(ip_layer, "src", "0.0.0.0"),
            "dst_ip": getattr(ip_layer, "dst", "0.0.0.0"),
            "query_name": qname,
            "query_type": qtype,
            "transaction_id": int(getattr(dns_layer, "id", -1)),
            "qr": 1,
            "rcode": int(getattr(dns_layer, "rcode", -1)),
            "answer_count": ancount,
            "response_ips": "|".join(response_ips),
        }

    return None


def suspicious_looking(record: dict) -> bool:
    qname = record.get("query_name", "")
    return len(qname) > 70 or record.get("query_type") == 16 or qname.count(".") > 4


def flush_records(state: CaptureState, output: Path, force: bool = False) -> None:
    with state.lock:
        if not state.records:
            return
        if not force and len(state.records) < 100:
            return
        batch = state.records[:]
        state.records.clear()

    output.parent.mkdir(parents=True, exist_ok=True)
    file_exists = output.exists()
    with output.open("a", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "timestamp",
                "src_ip",
                "dst_ip",
                "query_name",
                "query_type",
                "transaction_id",
                "qr",
                "rcode",
                "answer_count",
                "response_ips",
            ],
        )
        if not file_exists:
            writer.writeheader()
        writer.writerows(batch)


def run_capture(interface: str, output: Path, duration: int | None) -> None:
    if sniff is None:
        raise RuntimeError("Scapy is not installed. Install with: pip install scapy")

    state = CaptureState(records=[], lock=threading.Lock())
    start = time.time()
    last_flush = time.time()

    def _handle(pkt: Any) -> None:
        nonlocal last_flush
        try:
            rec = packet_to_record(pkt)
            if rec is None:
                return
            if rec.get("qr") == 0:
                state.total_queries += 1
                if suspicious_looking(rec):
                    state.suspicious += 1
            with state.lock:
                state.records.append(rec)
            if len(state.records) >= 100 or (time.time() - last_flush) > 30:
                flush_records(state, output, force=True)
                last_flush = time.time()
            print(
                f"\rCaptured: {state.total_queries} queries | Suspicious-looking: {state.suspicious}",
                end="",
                flush=True,
            )
        except Exception as e:
            logger.exception(f"Packet decode error: {e}")

    logger.info(f"Starting DNS capture on {interface} -> {output}")
    timeout = duration if duration and duration > 0 else None
    sniff(filter="udp port 53", iface=interface, prn=_handle, store=False, timeout=timeout)
    flush_records(state, output, force=True)
    print()
    logger.success("Capture finished")


def run_pcap(pcap_file: Path, output: Path, duration: int | None = None) -> None:
    if rdpcap is None:
        raise RuntimeError("Scapy is not installed. Install with: pip install scapy")
    state = CaptureState(records=[], lock=threading.Lock())
    packets = rdpcap(str(pcap_file))
    start = time.time()

    for pkt in packets:
        if duration and (time.time() - start) > duration:
            break
        try:
            rec = packet_to_record(pkt)
            if rec is None:
                continue
            if rec.get("qr") == 0:
                state.total_queries += 1
                if suspicious_looking(rec):
                    state.suspicious += 1
            with state.lock:
                state.records.append(rec)
            if len(state.records) >= 100:
                flush_records(state, output, force=True)
            print(
                f"\rCaptured: {state.total_queries} queries | Suspicious-looking: {state.suspicious}",
                end="",
                flush=True,
            )
        except Exception as e:
            logger.exception(f"Packet decode error: {e}")

    flush_records(state, output, force=True)
    print()
    logger.success("PCAP parse capture finished")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Capture DNS packets from interface or PCAP")
    p.add_argument("--interface", default="eth0")
    p.add_argument("--output", default="data/raw/live.csv")
    p.add_argument("--duration", type=int, default=0)
    p.add_argument("--pcap-file", default=None)
    return p.parse_args()


def main() -> None:
    args = parse_args()
    logger.remove()
    logger.add(lambda msg: print(msg, end=""), colorize=True)

    if args.pcap_file:
        run_pcap(Path(args.pcap_file), Path(args.output), args.duration or None)
    else:
        run_capture(args.interface, Path(args.output), args.duration or None)


if __name__ == "__main__":
    main()
