#!/usr/bin/env python3
"""DNS IDS quick demo.

Run with:
  streamlit run demo.py
or:
  python demo.py
"""
from __future__ import annotations

import math
import os
import random
import string
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd

BENIGN_DOMAINS = [
    "google.com",
    "github.com",
    "wikipedia.org",
    "cloudflare.com",
    "openai.com",
    "reddit.com",
]
ATTACK_DOMAIN = "labdomain.internal"


@dataclass
class Alert:
    ts: datetime
    src_ip: str
    query_name: str
    score: float
    reasons: List[str]


def shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    counts = pd.Series(list(s)).value_counts(normalize=True)
    return float(-(counts * np.log2(counts)).sum())


def random_ip() -> str:
    return f"10.0.0.{random.randint(2, 25)}"


def gen_benign_query() -> Dict:
    domain = random.choice(BENIGN_DOMAINS)
    prefix = random.choice(["www", "api", "cdn", "mail", "static", "app"])
    q = f"{prefix}.{domain}"
    return {
        "timestamp": datetime.now(timezone.utc),
        "src_ip": random_ip(),
        "query_name": q,
        "query_type": random.choice([1, 1, 1, 28, 15]),
        "label": 0,
    }


def gen_attack_query() -> Dict:
    mode = random.choice(["beacon", "tunnel", "dga"])
    src = "10.0.0.99"
    if mode == "beacon":
        q = f"alive-host7.{ATTACK_DOMAIN}"
        qtype = 1
    elif mode == "tunnel":
        payload = "".join(random.choices(string.ascii_letters + string.digits + "+/=", k=42))
        q = f"chunk{random.randint(1,999)}.{payload}.{ATTACK_DOMAIN}"
        qtype = 16
    else:
        payload = "".join(random.choices("abcdef0123456789", k=24))
        q = f"{payload}.{ATTACK_DOMAIN}"
        qtype = 1

    return {
        "timestamp": datetime.now(timezone.utc),
        "src_ip": src,
        "query_name": q,
        "query_type": qtype,
        "label": 1,
    }


def detect_row(row: pd.Series) -> Alert | None:
    qn = row["query_name"]
    labels = str(qn).split(".")
    if len(labels) > 2:
        subdomain = ".".join(labels[:-2])
    else:
        subdomain = labels[0] if labels else ""
    sub_nodot = subdomain.replace(".", "")
    ent = shannon_entropy(sub_nodot)
    score = 0.0
    reasons: List[str] = []

    if len(qn) > 60:
        score += 30
        reasons.append("Long query")
    if ent > 3.8:
        score += 30
        reasons.append(f"High entropy ({ent:.2f})")
    if row["query_type"] == 16:
        score += 25
        reasons.append("TXT query")
    base64_charset = set(string.ascii_letters + string.digits + "+/=_-")
    long_labels = [l for l in labels if len(l) > 15]
    if any((sum(c in base64_charset for c in l) / len(l)) > 0.88 for l in long_labels):
        score += 20
        reasons.append("Base64-like label pattern")
    if "labdomain.internal" in qn:
        score += 25
        reasons.append("Known attack domain")
    if any(part.startswith("chunk") for part in labels):
        score += 10
        reasons.append("Chunked subdomain pattern")

    if score >= 40:
        return Alert(
            ts=row["timestamp"],
            src_ip=row["src_ip"],
            query_name=qn,
            score=min(score, 100.0),
            reasons=reasons,
        )
    return None


def simulate_stream(batch_size: int = 20, attack_ratio: float = 0.25) -> pd.DataFrame:
    rows = []
    for _ in range(batch_size):
        if random.random() < attack_ratio:
            rows.append(gen_attack_query())
        else:
            rows.append(gen_benign_query())
    return pd.DataFrame(rows)


def run_cli_demo(iterations: int = 10) -> None:
    print("DNS IDS prototype running in CLI mode")
    alerts = 0
    for i in range(iterations):
        df = simulate_stream()
        flagged = 0
        for _, row in df.iterrows():
            hit = detect_row(row)
            if hit:
                flagged += 1
                alerts += 1
                print(
                    f"[{hit.ts.isoformat()}] ALERT score={hit.score:.0f} "
                    f"host={hit.src_ip} q={hit.query_name} reasons={', '.join(hit.reasons)}"
                )
        print(f"Batch {i+1}: total={len(df)} suspicious={flagged}")
        time.sleep(0.7)
    print(f"Done. Alerts raised: {alerts}")


def run_streamlit_demo() -> None:
    import plotly.express as px
    import streamlit as st

    st.set_page_config(page_title="DNS IDS Demo", layout="wide")
    st.title("DNS Intrusion Detection System")
    st.caption("Monitoring Active")

    if "events" not in st.session_state:
        st.session_state.events = pd.DataFrame(
            columns=["timestamp", "src_ip", "query_name", "query_type", "label"]
        )
    if "alerts" not in st.session_state:
        st.session_state.alerts = []

    new_events = simulate_stream(batch_size=35, attack_ratio=0.3)
    st.session_state.events = pd.concat([st.session_state.events, new_events], ignore_index=True)
    st.session_state.events = st.session_state.events.tail(800)

    for _, row in new_events.iterrows():
        maybe = detect_row(row)
        if maybe:
            st.session_state.alerts.append(maybe)

    events = st.session_state.events.copy()
    events["minute"] = pd.to_datetime(events["timestamp"]).dt.floor("min")
    events["status"] = np.where(events["label"] == 1, "suspicious", "normal")
    totals = events.groupby(["minute", "status"]).size().reset_index(name="count")

    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Total DNS Queries", len(events))
    c2.metric("Suspicious Queries", int((events["label"] == 1).sum()))
    c3.metric("Alerts Raised", len(st.session_state.alerts))
    c4.metric("HIGH Alerts", sum(a.score >= 70 for a in st.session_state.alerts))
    c5.metric("Compromised Hosts", events.loc[events.label == 1, "src_ip"].nunique())

    left, right = st.columns([0.6, 0.4])
    if px is not None:
        with left:
            st.subheader("Traffic")
            st.plotly_chart(
                px.line(totals, x="minute", y="count", color="status", title="DNS Traffic Over Time"),
                use_container_width=True,
            )
            events["entropy"] = events["query_name"].map(
                lambda x: shannon_entropy(x.split(".")[0] if isinstance(x, str) else "")
            )
            st.plotly_chart(
                px.histogram(events, x="entropy", color="status", nbins=30, title="Subdomain Entropy"),
                use_container_width=True,
            )
            events["qlen"] = events["query_name"].str.len()
            st.plotly_chart(
                px.histogram(events, x="qlen", color="status", nbins=30, title="Query Length"),
                use_container_width=True,
            )
        with right:
            st.subheader("Breakdown")
            if len(st.session_state.alerts):
                sev = pd.Series(["HIGH" if a.score >= 70 else "MEDIUM" for a in st.session_state.alerts]).value_counts()
                st.plotly_chart(px.pie(values=sev.values, names=sev.index, title="Severity"), use_container_width=True)
            by_host = events[events["label"] == 1]["src_ip"].value_counts().head(10)
            if len(by_host):
                st.plotly_chart(
                    px.bar(x=by_host.index, y=by_host.values, title="Top Suspicious Hosts"),
                    use_container_width=True,
                )

    st.subheader("Alerts")
    for alert in sorted(st.session_state.alerts, key=lambda a: a.score, reverse=True)[:20]:
        with st.expander(f"{alert.src_ip} | {alert.query_name} | {alert.score:.0f}/100"):
            st.write(f"Time: {alert.ts}")
            st.write("Evidence:")
            for r in alert.reasons:
                st.write(f"- {r}")

    st.subheader("DNS Query Log (Last 50)")
    st.dataframe(events.tail(50), use_container_width=True)

    # Auto refresh every 10s.
    time.sleep(0.2)
    st.caption("Auto-refreshing every ~10 seconds")
    if st.button("Refresh now"):
        st.rerun()


def main() -> None:
    argv0 = Path(sys.argv[0]).name.lower() if sys.argv else ""
    in_streamlit = "streamlit" in argv0

    if in_streamlit or os.getenv("STREAMLIT_SERVER_PORT"):
        run_streamlit_demo()
    else:
        run_cli_demo()


if __name__ == "__main__":
    main()
