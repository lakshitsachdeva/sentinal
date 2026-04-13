"""ML model wrapper for DNS IDS."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from features.feature_pipeline import get_feature_columns


class MLDetector:
    def __init__(self, model_path: str, threshold: float = 0.75):
        self.model_path = Path(model_path)
        self.threshold = float(threshold)
        self.feature_columns = get_feature_columns()
        self.model = None
        self.warning = None

        if self.model_path.exists():
            try:
                import joblib

                self.model = joblib.load(self.model_path)
            except Exception as e:
                self.warning = f"Failed to load model: {e}"
        else:
            self.warning = f"Model file not found: {self.model_path}"

    def _prepare_row(self, features: dict) -> pd.DataFrame:
        row = {c: float(features.get(c, 0.0)) for c in self.feature_columns}
        return pd.DataFrame([row], columns=self.feature_columns).fillna(0)

    def _score(self, x: pd.DataFrame) -> float:
        if self.model is None:
            return 0.0
        if hasattr(self.model, "predict_proba"):
            try:
                return float(self.model.predict_proba(x)[0][1])
            except Exception:
                pass
        if hasattr(self.model, "decision_function"):
            try:
                raw = float(self.model.decision_function(x)[0])
                return float(1.0 / (1.0 + pow(2.718281828, -raw)))
            except Exception:
                pass
        try:
            pred = float(self.model.predict(x)[0])
            return min(1.0, max(0.0, pred))
        except Exception:
            return 0.0

    def predict(self, features: dict) -> dict:
        x = self._prepare_row(features)
        score = self._score(x)

        if score > 0.9 or score < 0.1:
            confidence = "HIGH"
        elif (0.7 <= score <= 0.9) or (0.1 <= score <= 0.3):
            confidence = "MEDIUM"
        else:
            confidence = "LOW"

        out = {
            "ml_score": float(score),
            "ml_malicious": bool(score >= self.threshold),
            "ml_threshold": float(self.threshold),
            "confidence": confidence,
        }
        if self.warning:
            out["warning"] = self.warning
        return out

    def predict_batch(self, df: pd.DataFrame) -> pd.DataFrame:
        out = df.copy()
        x = out.reindex(columns=self.feature_columns).fillna(0)
        if self.model is None:
            out["ml_score"] = 0.0
            out["ml_malicious"] = False
            return out

        if hasattr(self.model, "predict_proba"):
            scores = self.model.predict_proba(x)[:, 1]
        elif hasattr(self.model, "decision_function"):
            raw = self.model.decision_function(x)
            scores = 1.0 / (1.0 + pd.Series(raw).rpow(2.718281828))
            scores = pd.Series(scores).to_numpy()
        else:
            scores = self.model.predict(x)

        out["ml_score"] = scores.astype(float)
        out["ml_malicious"] = out["ml_score"] >= self.threshold
        return out

    def explain(self, features: dict) -> list[str]:
        if self.model is None or not hasattr(self.model, "feature_importances_"):
            return ["Model explainability unavailable (missing model or feature_importances_)."]

        x = self._prepare_row(features)
        importances = getattr(self.model, "feature_importances_", None)
        if importances is None:
            return ["Model explainability unavailable."]

        ranked = sorted(
            zip(self.feature_columns, importances), key=lambda t: float(t[1]), reverse=True
        )[:5]

        expected = {
            "subdomain_entropy": "<=2.5",
            "query_length": "<=50",
            "nxdomain_rate": "<=0.2",
            "txt_query_ratio": "<=0.1",
            "beacon_score": "<=0.4",
        }
        out = []
        for name, _ in ranked:
            val = float(x.iloc[0][name])
            out.append(f"{name}={val:.3f} (high-impact; expected {expected.get(name, 'near baseline')})")
        return out
