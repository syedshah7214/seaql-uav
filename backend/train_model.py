"""
SEAQL - train the model used by the AI Intrusion Detection Laboratory.

WHY THIS FILE EXISTS
--------------------
The original research scripts (seaql-repo/src/*.py) evaluate models and save
metrics/figures, but they do NOT save any trained model file (.pkl/.joblib/.pt).
So there was no artifact the website could load for real predictions.

This script re-trains the 3-class Random Forest baseline with EXACTLY the same
cleaning, split (seed 42, 60/20/20 stratified), preprocessing (median imputer +
RobustScaler 10-90) and hyper-parameters as seaql-repo/src/uav_fl_project.py,
then saves it to backend/models/seaql_rf_3class.joblib together with its own
held-out test metrics.

It is NOT the final Hybrid AE-Stacked Ensemble (94.3% binary accuracy). That
model needs torch + xgboost + lightgbm and its script also does not save an
artifact. The website labels this clearly.

Run (from the project root):
    python backend/train_model.py
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (accuracy_score, balanced_accuracy_score, confusion_matrix,
                             f1_score, precision_recall_fscore_support, roc_auc_score)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, RobustScaler

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "seaql-repo" / "data" / "Dataset_T-ITS.csv"
MODEL_DIR = Path(__file__).resolve().parent / "models"
SAMPLE_DIR = ROOT / "app" / "samples"
SEED = 42
VALID_LABELS = {"benign", "Replay", "DoS attack"}


def load_and_clean(path: Path):
    """Identical rules to seaql-repo/src/uav_fl_project.py::load_and_clean."""
    raw = pd.read_csv(path, dtype=str, low_memory=False)
    raw.columns = [str(c).strip() for c in raw.columns]
    y = raw["class"].astype(str).str.strip()
    df = raw.loc[y.isin(VALID_LABELS)].copy()
    y = df.pop("class").astype(str).str.strip()
    X = df.apply(pd.to_numeric, errors="coerce")
    X = X.drop(columns=[c for c in ["timestamp_c", "frame.number"] if c in X.columns])
    X = X.drop(columns=X.columns[X.isna().all()].tolist())
    nunique = X.nunique(dropna=True)
    X = X.drop(columns=nunique[nunique <= 1].index.tolist())
    combined = X.copy()
    combined["__target__"] = y.values
    combined = combined.drop_duplicates().reset_index(drop=True)
    y = combined.pop("__target__")
    return combined, y


def main() -> int:
    if not DATA.exists():
        print(f"Dataset not found: {DATA}")
        return 1
    t0 = time.time()
    print(f"Loading {DATA.name} ...")
    X, y = load_and_clean(DATA)
    feature_names = X.columns.tolist()
    print(f"  rows={len(X)}  features={len(feature_names)}")

    le = LabelEncoder().fit(y)
    y_enc = le.transform(y)

    X_tv, X_te, y_tv, y_te = train_test_split(X, y_enc, test_size=0.20, stratify=y_enc, random_state=SEED)
    X_tr, X_va, y_tr, y_va = train_test_split(X_tv, y_tv, test_size=0.25, stratify=y_tv, random_state=SEED)

    model = Pipeline([
        ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
        ("scaler", RobustScaler(quantile_range=(10, 90))),
        ("rf", RandomForestClassifier(n_estimators=180, max_depth=18, min_samples_leaf=3,
                                      max_features="sqrt", class_weight="balanced_subsample",
                                      random_state=SEED, n_jobs=-1)),
    ])
    print("Training Random Forest (repo hyper-parameters) ...")
    model.fit(X_tr, y_tr)

    classes = le.classes_.tolist()
    benign_idx = classes.index("benign")
    prob = model.predict_proba(X_te)
    pred = prob.argmax(1)
    p, r, f, s = precision_recall_fscore_support(y_te, pred, labels=range(len(classes)), zero_division=0)

    # Binary view derived from the same 3-class model (attack = DoS or Replay)
    yb_true = (y_te != benign_idx).astype(int)
    yb_pred = (pred != benign_idx).astype(int)
    yb_score = 1.0 - prob[:, benign_idx]

    metrics = {
        "model": "Random Forest (3-class) - retrained locally with repo preprocessing",
        "split": "held-out test (20%, stratified, seed 42)",
        "test_rows": int(len(y_te)),
        "classes": classes,
        "accuracy": float(accuracy_score(y_te, pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_te, pred)),
        "macro_f1": float(f1_score(y_te, pred, average="macro")),
        "macro_ovr_auc": float(roc_auc_score(y_te, prob, multi_class="ovr", average="macro")),
        "per_class": {c: {"precision": float(p[i]), "recall": float(r[i]), "f1": float(f[i]), "support": int(s[i])}
                      for i, c in enumerate(classes)},
        "confusion_matrix": confusion_matrix(y_te, pred, labels=range(len(classes))).tolist(),
        "binary_view": {
            "accuracy": float(accuracy_score(yb_true, yb_pred)),
            "macro_f1": float(f1_score(yb_true, yb_pred, average="macro")),
            "auc": float(roc_auc_score(yb_true, yb_score)),
        },
        "train_seconds": round(time.time() - t0, 1),
        "sklearn_note": "Pipeline = SimpleImputer(median, add_indicator) -> RobustScaler(10,90) -> RandomForest",
    }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"pipeline": model, "classes": classes, "features": feature_names}, MODEL_DIR / "seaql_rf_3class.joblib",
                compress=3)
    (MODEL_DIR / "model_metrics.json").write_text(json.dumps(metrics, indent=2))

    # Sample upload file = rows from the HELD-OUT test split only (never seen in training), labels kept
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)
    sample = X_te.copy()
    sample["class"] = le.inverse_transform(y_te)
    sample = sample.sample(n=min(2000, len(sample)), random_state=SEED)
    sample.to_csv(SAMPLE_DIR / "uav_traffic_test_sample.csv", index=False)
    sample.drop(columns=["class"]).head(300).to_csv(SAMPLE_DIR / "uav_traffic_unlabeled_sample.csv", index=False)

    print(json.dumps({k: metrics[k] for k in ["accuracy", "macro_f1", "macro_ovr_auc"]}, indent=2))
    print(f"Saved model -> {MODEL_DIR / 'seaql_rf_3class.joblib'}")
    print(f"Saved samples -> {SAMPLE_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
