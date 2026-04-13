import math

import numpy as np
import pandas as pd
import pytest

from features.lexical import extract_lexical_features, shannon_entropy
from features.temporal import detect_beaconing


def test_shannon_entropy_edges():
    assert shannon_entropy("") == 0
    assert shannon_entropy("aaaa") == 0
    assert pytest.approx(shannon_entropy("abcd"), rel=1e-6) == math.log2(4)


def test_extract_lexical_features_normal_domain():
    f = extract_lexical_features("google.com")
    assert f["full_entropy"] < 3.0


def test_extract_lexical_features_encoded_subdomain():
    f = extract_lexical_features("chunk0.dGhpcyBpcyBhIHNlY3JldA==.labdomain.internal")
    assert f["subdomain_entropy"] > 3.5 or f["looks_base64"] == 1


def test_detect_beaconing_regular():
    ts = [i * 15 for i in range(10)]
    out = detect_beaconing(ts)
    assert out["is_beaconing"] is True
    assert out["beacon_score"] > 0.9


def test_detect_beaconing_random():
    rng = np.random.default_rng(42)
    ts = np.cumsum(rng.uniform(1, 40, size=20)).tolist()
    out = detect_beaconing(ts)
    assert out["is_beaconing"] is False
