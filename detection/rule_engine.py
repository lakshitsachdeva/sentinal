"""Deterministic DNS IDS rules."""
from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass
class RuleViolation:
    rule_id: str
    description: str
    severity: str
    evidence: dict


def _add(out: list[RuleViolation], rid: str, desc: str, severity: str, value, threshold) -> None:
    out.append(
        RuleViolation(
            rule_id=rid,
            description=desc,
            severity=severity,
            evidence={"value": value, "threshold": threshold},
        )
    )


def run_rules(features: dict) -> List[RuleViolation]:
    v: List[RuleViolation] = []

    qlen = float(features.get("query_length", 0))
    sub_ent = float(features.get("subdomain_entropy", 0))
    looks_b64 = int(features.get("looks_base64", 0))
    uniq_sub = float(features.get("unique_subdomains", 0))
    nxd = float(features.get("nxdomain_rate", 0))
    txt_ratio = float(features.get("txt_query_ratio", 0))
    qpm = float(features.get("query_rate_per_min", 0))
    hex_ratio = float(features.get("hex_ratio", 0))
    sub_len = float(features.get("subdomain_length", 0))

    if qlen > 80:
        _add(v, "R001", "Abnormally long query — possible payload encoding", "HIGH", qlen, 80)
    if sub_ent > 3.8:
        _add(v, "R002", "High entropy subdomain — likely encoded/encrypted data", "HIGH", sub_ent, 3.8)
    if looks_b64 == 1:
        _add(v, "R003", "Base64 encoding pattern detected in subdomain", "MEDIUM", looks_b64, 1)
    if uniq_sub > 25:
        _add(v, "R004", "Excessive unique subdomains — DNS tunneling signature", "HIGH", uniq_sub, 25)
    if nxd > 0.40:
        _add(v, "R005", "High NXDOMAIN rate — possible DGA domain scanning", "MEDIUM", nxd, 0.40)
    if txt_ratio > 0.30:
        _add(v, "R006", "Excessive TXT queries — possible data exfiltration", "MEDIUM", txt_ratio, 0.30)
    if qpm > 30:
        _add(v, "R007", "Abnormally high DNS query rate", "MEDIUM", qpm, 30)
    if hex_ratio > 0.75 and sub_len > 20:
        _add(v, "R008", "Hex-encoded subdomain — possible tunneling", "HIGH", {"hex_ratio": hex_ratio, "subdomain_length": sub_len}, {"hex_ratio": 0.75, "subdomain_length": 20})

    return v


def format_violations(violations: List[RuleViolation]) -> str:
    if not violations:
        return "No rule violations"
    lines = ["Rule Violations:"]
    for v in violations:
        lines.append(
            f"- [{v.severity}] {v.rule_id}: {v.description} (evidence={v.evidence})"
        )
    return "\n".join(lines)


def violation_summary(violations: List[RuleViolation]) -> dict:
    out = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for v in violations:
        out[v.severity] = out.get(v.severity, 0) + 1
    return out
