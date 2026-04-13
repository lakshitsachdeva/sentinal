"""Behavioral DNS detection patterns."""
from __future__ import annotations


def analyze_behavior(features: dict, temporal: dict) -> dict:
    flags = {}

    if bool(temporal.get("is_beaconing", False)):
        flags["beaconing"] = {
            "detected": True,
            "interval": float(temporal.get("beacon_interval", temporal.get("beacon_interval_est", 0.0))),
            "score": float(temporal.get("beacon_score", 0.0)),
            "message": f"Regular C2 check-in every {float(temporal.get('beacon_interval', temporal.get('beacon_interval_est', 0.0))):.1f}s",
        }

    if float(features.get("queries_per_host_max", 0)) > 20 and int(features.get("unique_src_hosts", 0)) == 1:
        flags["single_host_concentration"] = {
            "detected": True,
            "message": "Single host repeatedly targeting rare domain — C2 behavior",
        }

    uniq_sub = float(features.get("unique_subdomains", 0))
    avg_len = float(features.get("avg_query_length", 0))
    if uniq_sub > 10 and avg_len > 50:
        estimated_bytes = uniq_sub * (avg_len - 20) * 0.75
        flags["tunnel_exfil_estimate"] = {
            "detected": True,
            "estimated_bytes": float(estimated_bytes),
            "message": f"Estimated {estimated_bytes/1024:.2f}kb may have been exfiltrated",
        }

    if float(features.get("nxdomain_rate", 0)) > 0.6 and uniq_sub > 20:
        flags["dga_sweep"] = {
            "detected": True,
            "message": "DGA scanning pattern — malware looking for C2 server",
        }

    off_hours_count = int(features.get("off_hours_count", temporal.get("off_hours_count", 0)))
    if off_hours_count > 0:
        flags["after_hours"] = {
            "detected": True,
            "off_hours_count": off_hours_count,
            "message": "Activity during off-hours — automated behavior",
        }

    return flags
