"""Lexical DNS feature extraction.

These features help detect suspicious domain strings used in DNS tunneling,
exfiltration, and DGA-generated domains.
"""
from __future__ import annotations

import math
import re
from collections import Counter

BASE64_RE = re.compile(r"^[A-Za-z0-9+/=]+$")
HEX_CHARS = set("0123456789abcdefABCDEF")
VOWELS = set("aeiou")
CONSONANTS = set("bcdfghjklmnpqrstvwxyz")


def shannon_entropy(s: str) -> float:
    """Return Shannon entropy of a string.

    Security meaning:
    High entropy suggests randomness/encoding. Normal human-readable hostnames
    are lower entropy, while encrypted/encoded payload subdomains trend high.
    """
    if not s:
        return 0.0
    counts = Counter(s)
    n = len(s)
    entropy = 0.0
    for c in counts.values():
        p = c / n
        entropy -= p * math.log2(p)
    return entropy


def _longest_consonant_run(s: str) -> int:
    run = best = 0
    for ch in s.lower():
        if ch in CONSONANTS:
            run += 1
            best = max(best, run)
        else:
            run = 0
    return best


def extract_lexical_features(query_name: str) -> dict:
    """Extract lexical and structure features from a DNS query name.

    Security meaning:
    Attack traffic often packs data into subdomains, making names longer,
    more random, and structurally unusual versus benign DNS requests.
    """
    query_name = (query_name or "").strip().rstrip(".").lower()
    labels = [l for l in query_name.split(".") if l]

    subdomain = ""
    if len(labels) > 2:
        subdomain = ".".join(labels[:-2])
    elif len(labels) == 2:
        subdomain = labels[0]

    full_nodot = query_name.replace(".", "")
    sub_nodot = subdomain.replace(".", "")

    letters = [c for c in full_nodot if c.isalpha()]
    vowels = sum(1 for c in letters if c in VOWELS)
    consonants = sum(1 for c in letters if c in CONSONANTS)
    denom = consonants + vowels

    digit_ratio = (sum(c.isdigit() for c in full_nodot) / len(full_nodot)) if full_nodot else 0.0
    hex_ratio = (sum(c in HEX_CHARS for c in sub_nodot) / len(sub_nodot)) if sub_nodot else 0.0

    looks_base64 = int(
        len(sub_nodot) > 15
        and bool(BASE64_RE.match(sub_nodot))
        and (sum(c.isalnum() or c in "+/=" for c in sub_nodot) / max(len(sub_nodot), 1)) > 0.88
    )

    has_numeric_subdomain = int(any(label.isdigit() and len(label) >= 4 for label in labels))

    return {
        "query_length": len(query_name),
        "subdomain_length": len(subdomain),
        "label_count": len(labels),
        "max_label_length": max((len(l) for l in labels), default=0),
        "full_entropy": shannon_entropy(full_nodot),
        "subdomain_entropy": shannon_entropy(sub_nodot),
        "digit_ratio": digit_ratio,
        "hyphen_count": query_name.count("-"),
        "consonant_vowel_ratio": (consonants / denom) if denom else 0.0,
        "longest_consonant_run": _longest_consonant_run(sub_nodot),
        "hex_ratio": hex_ratio,
        "looks_base64": looks_base64,
        "has_numeric_subdomain": has_numeric_subdomain,
    }


def _run_self_tests() -> None:
    # Shannon entropy edge checks.
    assert shannon_entropy("") == 0.0
    assert shannon_entropy("aaaa") == 0.0
    assert abs(shannon_entropy("abcd") - 2.0) < 1e-9

    normal = extract_lexical_features("www.google.com")
    assert normal["query_length"] > 0
    assert normal["looks_base64"] == 0

    encoded = extract_lexical_features("chunk0.dGhpcyBpcyBhIHNlY3JldA==.labdomain.internal")
    assert encoded["subdomain_entropy"] > 2.5

    print("lexical.py self-tests passed")


if __name__ == "__main__":
    _run_self_tests()
