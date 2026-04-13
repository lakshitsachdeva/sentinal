from types import SimpleNamespace

from scoring.threat_scorer import compute_risk_score


def mk_violation(sev):
    return SimpleNamespace(severity=sev)


def test_high_severity_requires_score_ge_70():
    rv = [mk_violation("HIGH"), mk_violation("HIGH"), mk_violation("HIGH")]
    flags = {"beaconing": {"detected": True}}
    ml = {"ml_score": 0.95}
    out = compute_risk_score(rv, flags, ml)
    assert out["total_score"] >= 70
    assert out["severity"] == "HIGH"


def test_all_high_plus_beacon_plus_high_ml_gives_high():
    rv = [mk_violation("HIGH")] * 6
    flags = {
        "beaconing": {"detected": True},
        "single_host_concentration": {"detected": True},
        "dga_sweep": {"detected": True},
    }
    ml = {"ml_score": 0.95}
    out = compute_risk_score(rv, flags, ml)
    assert out["total_score"] >= 70


def test_low_case_stays_low():
    rv = []
    flags = {}
    ml = {"ml_score": 0.1}
    out = compute_risk_score(rv, flags, ml)
    assert out["severity"] == "LOW"
