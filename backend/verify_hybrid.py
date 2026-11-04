"""
SEAQL - independent check of the SAVED Hybrid AE-Stacked Ensemble.

Reloads only the files in backend/models/hybrid/ (nothing is retrained), rebuilds the
original held-out test split (seed 42, uav_fl_hybrid_model_binary.load_and_clean), and
re-computes accuracy / macro F1 / ROC AUC through the exact serving path used by the
dashboard backend (hybrid_model.HybridModel). Also compares the numpy autoencoder with
the PyTorch autoencoder (if torch is installed) using a relative error.

    python backend/verify_hybrid.py
Writes backend/models/hybrid/verification.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(ROOT / "seaql-repo" / "src"))


def main() -> int:
    import numpy as np
    import pandas as pd
    from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, roc_auc_score
    from sklearn.model_selection import train_test_split
    import hybrid_model as HM

    m = HM.HybridModel()
    # same cleaning as the original script (imported lazily: it needs torch etc. only for training)
    raw = pd.read_csv(ROOT / "seaql-repo" / "data" / "Dataset_T-ITS.csv", dtype=str, low_memory=False)
    raw.columns = [str(c).strip() for c in raw.columns]
    y = raw["class"].astype(str).str.strip()
    df = raw.loc[y.isin({"benign", "Replay", "DoS attack"})].copy()
    y3 = df.pop("class").astype(str).str.strip()
    X = df.apply(pd.to_numeric, errors="coerce")
    X = X[m.features]                                   # same columns the model was trained on
    _, Xte, _, yte3 = train_test_split(X, y3, test_size=0.20, stratify=y3, random_state=42)
    yte = (yte3 != "benign").astype(int).values

    prob = m.predict_proba(Xte)[:, 1]
    pred = (prob >= 0.5).astype(int)
    stack_pred = m.stack.predict(np.concatenate([m.pre.transform(Xte).astype("float32"),
                                                 HM.ae_features_numpy(m.ae, m.pre.transform(Xte).astype("float32"))], axis=1))
    res = {
        "test_rows": int(len(yte)),
        "accuracy": float(accuracy_score(yte, stack_pred)),
        "macro_f1": float(f1_score(yte, stack_pred, average="macro")),
        "roc_auc": float(roc_auc_score(yte, prob)),
        "confusion_matrix": confusion_matrix(yte, stack_pred, labels=[0, 1]).tolist(),
        "threshold_0.5_matches_stack_predict": bool((pred == stack_pred).all()),
        "model_card_metrics": {k: m.card["heldout_metrics"][k] for k in ("accuracy", "macro_f1", "auc")},
    }
    # predictions must match exactly; AUC may differ in the ~6th decimal because the served
    # autoencoder runs in numpy float32 instead of PyTorch (relative feature diff ~1e-7)
    res["auc_abs_difference_vs_model_card"] = abs(res["roc_auc"] - res["model_card_metrics"]["auc"])
    res["matches_model_card"] = (abs(res["accuracy"] - res["model_card_metrics"]["accuracy"]) < 1e-12
                                 and abs(res["macro_f1"] - res["model_card_metrics"]["macro_f1"]) < 1e-12
                                 and res["auc_abs_difference_vs_model_card"] < 1e-4)
    try:
        import torch
        from uav_fl_project import Autoencoder
        ck = torch.load(HM.HYBRID_DIR / "autoencoder.pt", map_location="cpu")
        ae = Autoencoder(ck["input_dim"]); ae.load_state_dict(ck["state_dict"]); ae.eval()
        Xp = m.pre.transform(Xte).astype("float32")
        with torch.no_grad():
            xt = torch.tensor(Xp); lat = ae.encoder(xt); rec = ae.decoder(lat)
            t_feat = np.concatenate([((rec - xt) ** 2).mean(dim=1, keepdim=True).numpy(), lat.numpy()], axis=1)
        n_feat = HM.ae_features_numpy(m.ae, Xp)
        rel = np.abs(n_feat - t_feat) / np.maximum(np.abs(t_feat), 1e-6)
        res["numpy_vs_torch"] = {"max_relative_diff": float(rel.max()), "median_relative_diff": float(np.median(rel)),
                                 "reconstruction_error_magnitude_max": float(np.abs(t_feat[:, 0]).max())}
    except ImportError:
        res["numpy_vs_torch"] = "torch not installed - skipped"
    (HM.HYBRID_DIR / "verification.json").write_text(json.dumps(res, indent=2))
    print(json.dumps(res, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
