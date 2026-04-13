#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import random
import socket
import time
from datetime import datetime, timezone
from pathlib import Path

from loguru import logger

try:
    import dns.exception
    import dns.resolver
except Exception:  # pragma: no cover
    dns = None


SUBDOMAIN_PREFIXES = ["www", "api", "cdn", "mail", "static", "img", "auth", "m"]


def load_domains(path: Path, count: int = 200) -> list[str]:
    if not path.exists():
        raise FileNotFoundError(f"Domain list not found: {path}")
    domains = [line.strip().lower() for line in path.read_text().splitlines() if line.strip()]
    return domains[:count]


def get_local_ip() -> str:
    try:
        return socket.gethostbyname(socket.gethostname())
    except Exception:
        return "127.0.0.1"


def random_query_name(base_domain: str) -> str:
    depth = random.choice([1, 1, 1, 2])
    labels = [random.choice(SUBDOMAIN_PREFIXES)]
    if depth == 2:
        labels.insert(0, random.choice(["eu", "us", "prod", "dev", "cache"]))
    return ".".join(labels + [base_domain])


def build_resolver() -> "dns.resolver.Resolver | None":
    if dns is None:
        return None
    r = dns.resolver.Resolver(configure=True)
    r.lifetime = 1.0
    r.timeout = 1.0
    return r


def run(duration: int, interface: str, log_file: Path, domains_path: Path) -> None:
    logger.remove()
    logger.add(lambda msg: print(msg, end=""), colorize=True)
    logger.add(log_file.with_suffix(".log"), rotation="5 MB")

    domains = load_domains(domains_path)
    src_ip = get_local_ip()
    resolver = build_resolver()

    log_file.parent.mkdir(parents=True, exist_ok=True)
    with log_file.open("w", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["timestamp", "src_ip", "query_name", "query_type"],
        )
        writer.writeheader()

        deadline = time.time() + duration
        sent = 0
        logger.info(f"Starting benign DNS generator on interface={interface} for {duration}s")
        while time.time() < deadline:
            domain = random.choice(domains)
            query_name = random_query_name(domain)
            query_type = random.choice(["A", "A", "AAAA", "MX", "CNAME"])
            ts = datetime.now(timezone.utc).isoformat()

            writer.writerow(
                {
                    "timestamp": ts,
                    "src_ip": src_ip,
                    "query_name": query_name,
                    "query_type": query_type,
                }
            )
            f.flush()
            logger.info(f"[NORMAL] {src_ip} -> {query_name} ({query_type})")
            sent += 1

            if resolver is not None:
                try:
                    resolver.resolve(query_name, query_type)
                except (dns.resolver.NXDOMAIN, dns.resolver.Timeout, dns.resolver.NoAnswer):
                    pass
                except dns.exception.DNSException:
                    pass
                except Exception:
                    pass

            time.sleep(random.uniform(0.5, 5.0))

    logger.success(f"Finished. Generated {sent} benign DNS queries.")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Simulate benign DNS traffic")
    p.add_argument("--duration", type=int, default=300)
    p.add_argument("--interface", default="eth0")
    p.add_argument("--log-file", default="data/raw/normal_traffic.csv")
    p.add_argument("--domains-file", default="data/top1000_domains.txt")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    run(
        duration=args.duration,
        interface=args.interface,
        log_file=Path(args.log_file),
        domains_path=Path(args.domains_file),
    )


if __name__ == "__main__":
    main()
