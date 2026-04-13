from __future__ import annotations

from typing import List

import numpy as np
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from features.lexical import shannon_entropy
from features.temporal import detect_beaconing


def render_beacon_chart(host_df: pd.DataFrame, host_ip: str):
    data = host_df.copy().reset_index(drop=True)
    if data.empty:
        fig = go.Figure()
        fig.update_layout(title=f"Inter-arrival times for {host_ip} (no data)")
        return fig

    ts = pd.to_datetime(data["timestamp"], errors="coerce")
    if ts.isna().all():
        ts = pd.to_datetime(data["timestamp"], unit="s", errors="coerce")
    data["ts"] = ts
    data = data.sort_values("ts").reset_index(drop=True)

    data["iat"] = data["ts"].diff().dt.total_seconds().fillna(0)
    data["entropy"] = data["query_name"].astype(str).map(
        lambda q: shannon_entropy((q.split(".")[0] if "." in q else q).replace(".", ""))
    )

    bea = detect_beaconing(data["ts"].astype("int64").div(1e9).fillna(0).tolist())
    interval = float(bea.get("beacon_interval", 0.0))

    close = (data["iat"] - interval).abs() <= 3 if interval > 0 else pd.Series([False] * len(data))
    colors = np.where(close, "red", "green")

    fig = make_subplots(rows=2, cols=1, shared_xaxes=False, vertical_spacing=0.15)
    fig.add_trace(
        go.Scatter(
            x=list(range(len(data))),
            y=data["iat"],
            mode="markers+lines",
            marker=dict(color=colors),
            name="Inter-arrival (s)",
        ),
        row=1,
        col=1,
    )

    if bea.get("is_beaconing") and interval > 0:
        fig.add_hline(
            y=interval,
            line_dash="dash",
            line_color="orange",
            annotation_text=f"Beacon interval: {interval:.1f}s",
            row=1,
            col=1,
        )

    fig.add_trace(
        go.Scatter(
            x=list(range(len(data))),
            y=data["entropy"],
            mode="lines+markers",
            marker=dict(color="#00ccff"),
            name="Query entropy",
        ),
        row=2,
        col=1,
    )

    fig.update_layout(
        title=f"Inter-arrival times for {host_ip}",
        height=600,
        template="plotly_dark",
    )
    fig.update_xaxes(title_text="Query sequence", row=1, col=1)
    fig.update_yaxes(title_text="IAT (seconds)", row=1, col=1)
    fig.update_xaxes(title_text="Query sequence", row=2, col=1)
    fig.update_yaxes(title_text="Subdomain entropy", row=2, col=1)
    return fig


def render_iat_histogram(timestamps: List[float]):
    ts = pd.Series(sorted(float(t) for t in timestamps))
    iat = ts.diff().dropna()
    fig = go.Figure()
    fig.add_trace(go.Histogram(x=iat, nbinsx=30, marker_color="#66ff99"))
    fig.update_layout(
        title="Inter-arrival time distribution",
        xaxis_title="Seconds",
        yaxis_title="Count",
        template="plotly_dark",
    )
    return fig
