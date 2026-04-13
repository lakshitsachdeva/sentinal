"""Risk scoring for multi-layer DNS detection."""
from __future__ import annotations


def compute_risk_score(rule_violations, behavior_flags, ml_result) -> dict:
    rule_pts = {"HIGH": 15, "MEDIUM": 8, "LOW": 3}
    behavior_pts = {
        "beaconing": 20,
        "single_host_concentration": 8,
        "tunnel_exfil_estimate": 10,
        "dga_sweep": 12,
        "after_hours": 5,
    }

    rule_score = 0
    for v in rule_violations:
        sev = getattr(v, "severity", "LOW")
        rule_score += rule_pts.get(sev, 0)
    rule_score = min(40, rule_score)

    behavior_score = 0
    for key, pts in behavior_pts.items():
        val = behavior_flags.get(key, {})
        if isinstance(val, dict) and val.get("detected"):
            behavior_score += pts
    behavior_score = min(35, behavior_score)

    ml_score = float(ml_result.get("ml_score", 0.0))
    ml_contrib = min(25.0, max(0.0, ml_score * 25.0))

    total = float(min(100.0, rule_score + behavior_score + ml_contrib))
    if total >= 70:
        severity = "HIGH"
        action = "Isolate host, block domain, and initiate incident response triage immediately."
    elif total >= 40:
        severity = "MEDIUM"
        action = "Escalate to analyst queue for validation and containment planning."
    else:
        severity = "LOW"
        action = "Monitor; keep telemetry and re-evaluate on additional evidence."

    return {
        "total_score": total,
        "rule_score": float(rule_score),
        "behavior_score": float(behavior_score),
        "ml_score_contribution": float(ml_contrib),
        "severity": severity,
        "recommended_action": action,
    }


def score_to_color(score) -> str:
    s = float(score)
    if s >= 70:
        return "#ff4d4f"
    if s >= 40:
        return "#faad14"
    return "#52c41a"


def format_score_breakdown(score_dict) -> str:
    return (
        f"Score={score_dict.get('total_score', 0):.1f}/100 "
        f"(rules={score_dict.get('rule_score', 0):.1f}, "
        f"behavior={score_dict.get('behavior_score', 0):.1f}, "
        f"ml={score_dict.get('ml_score_contribution', 0):.1f}) "
        f"severity={score_dict.get('severity', 'LOW')}"
    )
