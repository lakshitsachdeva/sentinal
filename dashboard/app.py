from __future__ import annotations

import sqlite3
import time
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import streamlit as st

from dashboard.components.beacon_chart import render_beacon_chart

DB_PATH = Path("alerts/alerts.db")
RAW_CSV = Path("data/parsed/parsed_dns.csv")


def load_alerts() -> pd.DataFrame:
    if not DB_PATH.exists():
        return pd.DataFrame(
            columns=[
                "alert_id",
                "timestamp",
                "src_host",
                "domain",
                "severity",
                "total_score",
                "reasons",
                "ml_score",
                "is_beaconing",
                "resolved",
            ]
        )
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query("SELECT * FROM alerts ORDER BY total_score DESC, timestamp DESC", conn)
    conn.close()
    return df


def load_queries() -> pd.DataFrame:
    if RAW_CSV.exists():
        df = pd.read_csv(RAW_CSV)
    else:
        # fallback mock when no pipeline has run yet
        now = pd.Timestamp.utcnow().floor("s")
        rows = []
        for i in range(120):
            rows.append(
                {
                    "timestamp": (now - pd.Timedelta(minutes=120 - i)).isoformat(),
                    "src_ip": f"10.0.0.{(i % 6) + 2}",
                    "query_name": np.random.choice(["www.google.com", "api.github.com", "x.labdomain.internal"]),
                    "query_type": np.random.choice([1, 1, 16]),
                    "label": np.random.choice([0, 0, 0, 1]),
                }
            )
        df = pd.DataFrame(rows)

    if "timestamp" in df.columns:
        ts = pd.to_datetime(df["timestamp"], errors="coerce")
        if ts.isna().all():
            ts = pd.to_datetime(df["timestamp"], unit="s", errors="coerce")
        df["timestamp"] = ts
    if "label" not in df.columns:
        df["label"] = 0
    return df


def add_theme() -> None:
    st.markdown(
        """
        <style>
        :root {
            --bg: #0d0d14;
            --accent: #00ff99;
            --heading: #88ccff;
            --text: #cde3ff;
        }
        .stApp { background: radial-gradient(circle at 10% 10%, #121726 0%, #0d0d14 40%, #0b1018 100%); color: var(--text); }
        h1, h2, h3 { color: var(--heading) !important; font-family: "Courier New", monospace; }
        .metric-card {
            border: 1px solid rgba(0,255,153,.22);
            border-radius: 10px;
            padding: 10px;
            background: rgba(0,255,153,.05);
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def main() -> None:
    st.set_page_config(page_title="DNS IDS", layout="wide")
    add_theme()

    st.title("🛡️ DNS Intrusion Detection System")
    st.caption("MONITORING ACTIVE")

    alerts = load_alerts()
    queries = load_queries()

    st.sidebar.header("Simulation Controls")
    rule_threshold = st.sidebar.slider("Rule trigger aggressiveness", 0.0, 1.0, 0.6, 0.05)
    ml_threshold = st.sidebar.slider("ML threshold", 0.5, 0.95, 0.75, 0.01)
    auto_refresh = st.sidebar.checkbox("Auto-refresh every 10 seconds", value=True)
    st.sidebar.caption(f"Rule threshold={rule_threshold:.2f}, ML threshold={ml_threshold:.2f}")

    suspicious_queries = int((queries.get("label", pd.Series(dtype=int)) == 1).sum())
    high_alerts = int((alerts.get("severity", pd.Series(dtype=str)) == "HIGH").sum()) if not alerts.empty else 0

    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Total DNS Queries", int(len(queries)))
    c2.metric("Suspicious Queries", suspicious_queries)
    c3.metric("Alerts Raised", int(len(alerts)))
    c4.metric("HIGH Severity Alerts", high_alerts)
    c5.metric("Unique Compromised Hosts", int(alerts.get("src_host", pd.Series(dtype=str)).nunique()) if not alerts.empty else 0)

    left, right = st.columns([0.6, 0.4])

    q = queries.copy()
    if "timestamp" in q.columns:
        q["minute"] = pd.to_datetime(q["timestamp"], errors="coerce").dt.floor("min")
    else:
        q["minute"] = pd.Timestamp.utcnow().floor("min")
    q["status"] = np.where(q.get("label", 0).astype(int) == 1, "suspicious", "normal")

    with left:
        st.subheader("DNS Traffic Over Time")
        traffic = q.groupby(["minute", "status"]).size().reset_index(name="count")
        st.plotly_chart(px.line(traffic, x="minute", y="count", color="status", color_discrete_map={"normal": "#00ff99", "suspicious": "#ff4d4f"}), use_container_width=True)

        st.subheader("Subdomain Entropy Distribution")
        q["entropy"] = q["query_name"].astype(str).map(lambda s: len(set(s)) / max(len(s), 1) * 5)
        st.plotly_chart(px.histogram(q, x="entropy", color="status", nbins=30), use_container_width=True)

        st.subheader("Query Length Distribution")
        q["query_len"] = q["query_name"].astype(str).str.len()
        st.plotly_chart(px.histogram(q, x="query_len", color="status", nbins=30), use_container_width=True)

    with right:
        st.subheader("Severity Breakdown")
        if not alerts.empty:
            sev = alerts["severity"].value_counts()
            st.plotly_chart(px.pie(values=sev.values, names=sev.index), use_container_width=True)
        else:
            st.info("No alerts yet")

        st.subheader("Attack Type Breakdown")
        if not alerts.empty:
            def infer_attack(row):
                r = str(row).lower()
                if "beacon" in r:
                    return "Beaconing"
                if "nxdomain" in r or "dga" in r:
                    return "DGA Sweep"
                if "txt" in r or "exfil" in r:
                    return "Exfiltration"
                return "Other"

            at = alerts["reasons"].astype(str).map(infer_attack).value_counts()
            st.plotly_chart(px.bar(x=at.index, y=at.values), use_container_width=True)

        st.subheader("Top Suspicious Hosts")
        if not alerts.empty:
            top_hosts = alerts.groupby("src_host")["total_score"].max().sort_values(ascending=False).head(10)
            st.plotly_chart(px.bar(x=top_hosts.index, y=top_hosts.values), use_container_width=True)

    st.subheader("Alerts Panel")
    if alerts.empty:
        st.info("No alerts in database yet.")
    else:
        for _, row in alerts.sort_values(["severity", "total_score"], ascending=[True, False]).iterrows():
            icon = "🚨" if row["severity"] == "HIGH" else "⚠️"
            with st.expander(f"{icon} {row['severity']} | {row['src_host']} | {row['domain']} | {row['total_score']:.1f}"):
                m1, m2, m3 = st.columns(3)
                m1.metric("Score", f"{row['total_score']:.1f}")
                m2.metric("ML Score", f"{row['ml_score']:.2f}")
                m3.metric("Beaconing", "YES" if int(row.get("is_beaconing", 0)) else "NO")
                st.write("Evidence")
                for reason in str(row.get("reasons", "[]")).strip("[]").split(",")[:6]:
                    st.write(f"- {reason.strip()}")

    st.subheader("Beacon Visualization")
    host_choice = st.selectbox("Host", sorted(q["src_ip"].astype(str).unique()) if "src_ip" in q else ["10.0.0.2"])
    host_df = q[q.get("src_ip", "") == host_choice]
    st.plotly_chart(render_beacon_chart(host_df, host_choice), use_container_width=True)

    st.subheader("DNS Query Log")
    log_df = q.tail(50).copy()
    log_df["status"] = np.where(log_df["label"] == 1, "suspicious", "normal")
    st.dataframe(log_df, use_container_width=True)

    if auto_refresh:
        time.sleep(10)
        st.rerun()


if __name__ == "__main__":
    main()
