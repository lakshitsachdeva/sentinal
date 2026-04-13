#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from loguru import logger
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.preprocessing import StandardScaler

FEATURE_COLS = [
    "query_length",
    "subdomain_length",
    "label_count",
    "max_label_length",
    "full_entropy",
    "subdomain_entropy",
    "digit_ratio",
    "hyphen_count",
    "consonant_vowel_ratio",
    "longest_consonant_run",
    "hex_ratio",
    "looks_base64",
    "is_beaconing",
    "beacon_score",
    "iat_cv",
    "query_rate_per_min",
    "unique_subdomains",
    "nxdomain_rate",
    "txt_query_ratio",
]


def maybe_smote(X, y):
    try:
        from imblearn.over_sampling import SMOTE

        return SMOTE(random_state=42).fit_resample(X, y)
    except Exception:
        logger.warning("imblearn/SMOTE unavailable; training without synthetic balancing")
        return X, y


def get_xgb_model():
    try:
        from xgboost import XGBClassifier

        return XGBClassifier(
            n_estimators=300,
            learning_rate=0.05,
            max_depth=6,
            subsample=0.9,
            colsample_bytree=0.9,
            eval_metric="logloss",
            random_state=42,
        )
    except Exception:
        from sklearn.ensemble import GradientBoostingClassifier

        logger.warning("xgboost unavailable; falling back to GradientBoostingClassifier")
        return GradientBoostingClassifier(random_state=42)


def ensure_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for c in FEATURE_COLS:
        if c not in out.columns:
            out[c] = 0.0
    if "label" not in out.columns:
        raise ValueError("Input dataset must include 'label' column")
    return out


def train(data_path: Path, output_model: Path, verbose: bool = False) -> None:
    logger.remove()
    logger.add(lambda msg: print(msg, end=""), colorize=True)

    df = ensure_columns(pd.read_csv(data_path)).fillna(0)
    logger.info(f"Loaded {len(df)} rows from {data_path}")
    logger.info("Class distribution:\n" + df["label"].value_counts().to_string())

    X = df[FEATURE_COLS].astype(float)
    y = df["label"].astype(int)

    X_bal, y_bal = maybe_smote(X, y)
    X_train, X_test, y_train, y_test = train_test_split(
        X_bal, y_bal, test_size=0.2, random_state=42, stratify=y_bal
    )

    scaler = StandardScaler()
    scaler.fit(X_train)

    rf = RandomForestClassifier(n_estimators=200, class_weight="balanced", random_state=42)
    xgb = get_xgb_model()
    iso = IsolationForest(random_state=42, contamination=0.2)

    models = {"RandomForest": rf, "XGB": xgb}
    best_name = None
    best_model = None
    best_f1 = -1.0

    for name, model in models.items():
        model.fit(X_train, y_train)
        pred = model.predict(X_test)
        f1 = f1_score(y_test, pred)
        logger.info(f"\n{name} classification report:\n{classification_report(y_test, pred)}")
        logger.info(f"{name} confusion matrix:\n{confusion_matrix(y_test, pred)}")

        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        cv_scores = cross_val_score(model, X_bal, y_bal, cv=cv, scoring="f1")
        logger.info(f"{name} CV F1: {cv_scores.mean():.4f} +/- {cv_scores.std():.4f}")

        if f1 > best_f1:
            best_f1 = f1
            best_name = name
            best_model = model

    iso.fit(X_train)

    # Feature importance from best supervised model if available.
    if hasattr(best_model, "feature_importances_"):
        imp = pd.Series(best_model.feature_importances_, index=FEATURE_COLS).sort_values(ascending=False)
        plt.figure(figsize=(10, 5))
        imp.head(15).iloc[::-1].plot(kind="barh", color="#3366cc")
        plt.title(f"Feature Importance ({best_name})")
        plt.tight_layout()
        out_img = Path("models/evaluation_report/feature_importance.png")
        out_img.parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(out_img)
        plt.close()
        logger.info(f"Saved feature importance chart: {out_img}")

    output_model.parent.mkdir(parents=True, exist_ok=True)
    try:
        import joblib

        joblib.dump(best_model, output_model)
        joblib.dump(scaler, output_model.with_name("standard_scaler.pkl"))
    except Exception as e:
        raise RuntimeError("joblib is required to save models") from e

    logger.success(f"Best model: {best_name} (F1={best_f1:.4f})")
    logger.success(f"Saved model to {output_model}")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train DNS malicious traffic classifier")
    p.add_argument("--data", default="data/features/labeled_features.csv")
    p.add_argument("--output-model", default="models/saved/dns_classifier.pkl")
    p.add_argument("--verbose", action="store_true")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    train(Path(args.data), Path(args.output_model), args.verbose)


if __name__ == "__main__":
    main()
