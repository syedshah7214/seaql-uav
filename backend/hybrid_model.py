"""
SEAQL - inference for the saved Hybrid AE-Stacked Ensemble (binary).

Pipeline per uploaded row (identical to uav_fl_hybrid_model_binary.py):
    numeric packet features (column order from model_card.json)
      -> saved preprocessor (median impute + RobustScaler, fitted on the training split)
      -> autoencoder features [reconstruction MSE, latent vector]   (numpy forward pass)
      -> concatenate [preprocessed features, AE features]
      -> saved StackingClassifier.predict_proba -> P(attack)

The autoencoder forward pass uses numpy so serving does not require PyTorch.
train_hybrid.py checks that it reproduces the PyTorch extractor and gives
identical held-out predictions.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

HYBRID_DIR = Path(__file__).resolve().parent / "models" / "hybrid"
REQUIRED = ["preprocessor.joblib", "stack.joblib", "autoencoder_numpy.npz", "model_card.json"]


def ae_features_numpy(w: dict, X: np.ndarray) -> np.ndarray:
    """Autoencoder (eval mode: dropout off) -> [MSE, latent]; mirrors Autoencoder in uav_fl_project.py."""
    x = np.asarray(X, dtype=np.float32)
    lin = lambda a, k: a @ w[k + "_weight"].T.astype(np.float32) + w[k + "_bias"].astype(np.float32)
    relu = lambda a: np.maximum(a, 0, dtype=np.float32)
    h = relu(lin(x, "encoder_0"))
    latent = relu(lin(h, "encoder_3"))
    d = relu(lin(latent, "decoder_0"))
    rec = lin(d, "decoder_2")
    err = ((rec - x) ** 2).mean(axis=1, keepdims=True, dtype=np.float32)
    return np.concatenate([err, latent], axis=1).astype(np.float32)


def missing_artifacts() -> list[str]:
    return [f for f in REQUIRED if not (HYBRID_DIR / f).exists()]


class HybridModel:
    def __init__(self):
        import joblib
        self.card = json.loads((HYBRID_DIR / "model_card.json").read_text())
        self.features = self.card["features"]
        self.classes = ["benign", "attack"]
        self.pre = joblib.load(HYBRID_DIR / "preprocessor.joblib")
        self.stack = joblib.load(HYBRID_DIR / "stack.joblib")
        self.ae = dict(np.load(HYBRID_DIR / "autoencoder_numpy.npz"))

    def predict_proba(self, X_df) -> np.ndarray:
        """X_df: DataFrame with self.features columns (float, NaN allowed). Returns (n, 2) [P(benign), P(attack)]."""
        Xp = self.pre.transform(X_df[self.features]).astype("float32")
        Xh = np.concatenate([Xp, ae_features_numpy(self.ae, Xp)], axis=1)
        p_attack = self.stack.predict_proba(Xh)[:, 1]
        return np.column_stack([1.0 - p_attack, p_attack])
