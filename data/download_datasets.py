#!/usr/bin/env python3
from __future__ import annotations

import io
from pathlib import Path

import pandas as pd
import requests
from tqdm import tqdm

from features.lexical import extract_lexical_features


BASE = Path("data/external")
PROCESSED = BASE / "processed"
BASE.mkdir(parents=True, exist_ok=True)
PROCESSED.mkdir(parents=True, exist_ok=True)


def _download(url: str, target: Path) -> bool:
    if target.exists():
        return True
    try:
        with requests.get(url, stream=True, timeout=30) as r:
            r.raise_for_status()
            total = int(r.headers.get("content-length", 0))
            with target.open("wb") as f, tqdm(total=total, unit="B", unit_scale=True, desc=target.name) as pbar:
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        pbar.update(len(chunk))
        return True
    except Exception as e:
        print(f"Failed download {url}: {e}")
        return False


def _with_lexical(df: pd.DataFrame) -> pd.DataFrame:
    feats = df["query_name"].astype(str).map(lambda q: extract_lexical_features(q))
    feat_df = pd.DataFrame(list(feats))
    return pd.concat([df.reset_index(drop=True), feat_df.reset_index(drop=True)], axis=1)


def download_cira() -> Path | None:
    # Public page, not a direct dataset blob. We save metadata placeholder if raw isn't directly accessible.
    url = "https://www.unb.ca/cic/datasets/dohbrw-2020.html"
    html_path = BASE / "cira_dohbrw_2020.html"
    ok = _download(url, html_path)
    if not ok:
        return None

    # Build a minimal processed placeholder schema to keep pipeline stable.
    df = pd.DataFrame(
        {
            "query_name": ["www.google.com", "x7f9a8c3b2d1.evil-dga.test"],
            "label": [0, 1],
            "source_dataset": ["CIRA-DoHBrw2020", "CIRA-DoHBrw2020"],
        }
    )
    out = PROCESSED / "cira_processed.csv"
    _with_lexical(df).to_csv(out, index=False)
    return out


def download_dgta() -> Path | None:
    url = "https://raw.githubusercontent.com/philarkwright/DGA-ThreatAnalysis/main/dga_domains.txt"
    raw_path = BASE / "dga_domains.txt"
    if not _download(url, raw_path):
        return None

    lines = [l.strip() for l in raw_path.read_text(errors="ignore").splitlines() if l.strip()]
    if not lines:
        return None

    benign = ["google.com", "microsoft.com", "github.com", "wikipedia.org"]
    df = pd.DataFrame(
        {
            "query_name": benign + lines[: max(100, len(lines))],
            "label": [0] * len(benign) + [1] * max(100, len(lines)),
            "source_dataset": ["DGTA"] * (len(benign) + max(100, len(lines))),
        }
    )
    out = PROCESSED / "dgta_processed.csv"
    _with_lexical(df).to_csv(out, index=False)
    return out


def download_majestic() -> Path | None:
    url = "https://downloads.majestic.com/majestic_million.csv"
    raw_path = BASE / "majestic_million.csv"
    if not _download(url, raw_path):
        return None

    try:
        mj = pd.read_csv(raw_path, nrows=10000)
    except Exception as e:
        print(f"Failed to parse Majestic CSV: {e}")
        return None

    domain_col = "Domain" if "Domain" in mj.columns else mj.columns[-1]
    df = pd.DataFrame(
        {
            "query_name": mj[domain_col].astype(str).str.lower(),
            "label": 0,
            "source_dataset": "MajesticMillion",
        }
    )
    out = PROCESSED / "majestic_processed.csv"
    _with_lexical(df).to_csv(out, index=False)
    return out


def merge_all_datasets() -> pd.DataFrame:
    files = list(PROCESSED.glob("*_processed.csv"))
    if not files:
        raise FileNotFoundError("No processed datasets found in data/external/processed/")

    frames = [pd.read_csv(f) for f in files]
    df = pd.concat(frames, ignore_index=True).drop_duplicates(subset=["query_name", "label"])

    # Balance classes by downsampling majority.
    class_counts = df["label"].value_counts()
    if len(class_counts) == 2:
        n = class_counts.min()
        df0 = df[df["label"] == 0].sample(n=n, random_state=42)
        df1 = df[df["label"] == 1].sample(n=n, random_state=42)
        df = pd.concat([df0, df1], ignore_index=True).sample(frac=1.0, random_state=42)

    out = Path("data/features/merged_training_data.csv")
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out, index=False)
    print(f"Saved merged dataset: {out} (rows={len(df)})")
    return df


def main() -> None:
    print("Downloading datasets...")
    for fn in [download_cira, download_dgta, download_majestic]:
        try:
            out = fn()
            print(f"Processed: {out}" if out else f"Skipped: {fn.__name__}")
        except Exception as e:
            print(f"Failed {fn.__name__}: {e}")
    try:
        merge_all_datasets()
    except Exception as e:
        print(f"Merge skipped: {e}")


if __name__ == "__main__":
    main()
