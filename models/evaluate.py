#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    auc,
    classification_report,
    confusion_matrix,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_curve,
    f1_score,
)
from sklearn.model_selection import train_test_split

try:
    from models.train import FEATURE_COLS
except Exception:  # pragma: no cover
    from train import FEATURE_COLS


def load_model(path: Path):
    import joblib

    return joblib.load(path)


def evaluate(model_path: Path, data_path: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    model = load_model(model_path)
    df = pd.read_csv(data_path).fillna(0)
    for c in FEATURE_COLS:
        if c not in df.columns:
            df[c] = 0.0

    X = df[FEATURE_COLS].astype(float)
    y = df["label"].astype(int)

    _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X_test)[:, 1]
    else:
        pred_raw = model.predict(X_test)
        probs = np.asarray(pred_raw, dtype=float)

    pred = (probs >= 0.75).astype(int)
    print("Classification report:\n", classification_report(y_test, pred))

    cm = confusion_matrix(y_test, pred)
    print("Confusion matrix:\n", cm)

    # ROC
    fpr, tpr, _ = roc_curve(y_test, probs)
    roc_auc = auc(fpr, tpr)
    plt.figure(figsize=(6, 5))
    plt.plot(fpr, tpr, label=f"AUC={roc_auc:.3f}")
    plt.plot([0, 1], [0, 1], "k--")
    plt.xlabel("FPR")
    plt.ylabel("TPR")
    plt.title("ROC Curve")
    plt.legend(loc="lower right")
    plt.tight_layout()
    plt.savefig(out_dir / "roc_curve.png")
    plt.close()

    # PR
    precision, recall, _ = precision_recall_curve(y_test, probs)
    plt.figure(figsize=(6, 5))
    plt.plot(recall, precision)
    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.title("Precision-Recall Curve")
    plt.tight_layout()
    plt.savefig(out_dir / "pr_curve.png")
    plt.close()

    # Feature importance
    if hasattr(model, "feature_importances_"):
        imp = pd.Series(model.feature_importances_, index=FEATURE_COLS).sort_values(ascending=False)
        plt.figure(figsize=(9, 5))
        imp.head(15).iloc[::-1].plot(kind="barh", color="#2ca02c")
        plt.title("Top 15 Feature Importance")
        plt.tight_layout()
        plt.savefig(out_dir / "feature_importance_top15.png")
        plt.close()

    # FP/FN analysis
    report_df = X_test.copy()
    report_df["y_true"] = y_test.to_numpy()
    report_df["y_pred"] = pred
    fp = report_df[(report_df.y_true == 0) & (report_df.y_pred == 1)]
    fn = report_df[(report_df.y_true == 1) & (report_df.y_pred == 0)]
    fp.describe().to_csv(out_dir / "false_positive_analysis.csv")
    fn.describe().to_csv(out_dir / "false_negative_analysis.csv")

    # Threshold sweep
    rows = []
    for th in [0.5, 0.6, 0.7, 0.75, 0.8, 0.9]:
        yhat = (probs >= th).astype(int)
        rows.append(
            {
                "threshold": th,
                "precision": precision_score(y_test, yhat, zero_division=0),
                "recall": recall_score(y_test, yhat, zero_division=0),
                "f1": f1_score(y_test, yhat, zero_division=0),
            }
        )
    sweep = pd.DataFrame(rows)
    print("\nThreshold sweep:\n", sweep.to_string(index=False))
    sweep.to_csv(out_dir / "threshold_sweep.csv", index=False)

    # Recommend threshold (security preference: precision first, then f1)
    ranked = sweep.sort_values(["precision", "f1"], ascending=False)
    best = ranked.iloc[0]
    print(
        f"\nAt threshold {best['threshold']:.2f}: catches {best['recall']*100:.1f}% of attacks, "
        f"with precision {best['precision']*100:.1f}%."
    )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Evaluate trained DNS model")
    p.add_argument("--model", default="models/saved/dns_classifier.pkl")
    p.add_argument("--data", default="data/features/labeled_features.csv")
    p.add_argument("--output", default="models/evaluation_report")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    evaluate(Path(args.model), Path(args.data), Path(args.output))


if __name__ == "__main__":
    main()
