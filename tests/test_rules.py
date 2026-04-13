import pytest

from detection.rule_engine import run_rules


@pytest.mark.parametrize(
    "feature_key,feature_value,rule_id",
    [
        ("query_length", 90, "R001"),
        ("subdomain_entropy", 4.2, "R002"),
        ("looks_base64", 1, "R003"),
        ("unique_subdomains", 30, "R004"),
        ("nxdomain_rate", 0.8, "R005"),
        ("txt_query_ratio", 0.7, "R006"),
        ("query_rate_per_min", 45, "R007"),
    ],
)
def test_individual_rule_triggers(feature_key, feature_value, rule_id):
    features = {
        "query_length": 20,
        "subdomain_entropy": 1.5,
        "looks_base64": 0,
        "unique_subdomains": 2,
        "nxdomain_rate": 0.0,
        "txt_query_ratio": 0.0,
        "query_rate_per_min": 1,
        "hex_ratio": 0.1,
        "subdomain_length": 5,
    }
    features[feature_key] = feature_value
    ids = {v.rule_id for v in run_rules(features)}
    assert rule_id in ids


def test_hex_rule_r008_trigger():
    features = {
        "query_length": 30,
        "subdomain_entropy": 2.0,
        "looks_base64": 0,
        "unique_subdomains": 3,
        "nxdomain_rate": 0.0,
        "txt_query_ratio": 0.0,
        "query_rate_per_min": 2,
        "hex_ratio": 0.8,
        "subdomain_length": 25,
    }
    ids = {v.rule_id for v in run_rules(features)}
    assert "R008" in ids


def test_normal_google_query_triggers_zero_rules():
    features = {
        "query_length": 12,
        "subdomain_entropy": 1.7,
        "looks_base64": 0,
        "unique_subdomains": 2,
        "nxdomain_rate": 0.0,
        "txt_query_ratio": 0.0,
        "query_rate_per_min": 4,
        "hex_ratio": 0.1,
        "subdomain_length": 3,
    }
    assert run_rules(features) == []


def test_long_base64_query_triggers_r001_r002():
    features = {
        "query_length": 95,
        "subdomain_entropy": 4.0,
        "looks_base64": 1,
        "unique_subdomains": 2,
        "nxdomain_rate": 0.0,
        "txt_query_ratio": 0.0,
        "query_rate_per_min": 2,
        "hex_ratio": 0.2,
        "subdomain_length": 60,
    }
    ids = {v.rule_id for v in run_rules(features)}
    assert "R001" in ids
    assert "R002" in ids
