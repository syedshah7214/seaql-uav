"""
SEAQL - train and SAVE the original FYP model: Hybrid AE-Stacked Ensemble (binary).

This script does NOT re-implement the model. It imports and calls the functions
of the original research script  seaql-repo/src/uav_fl_hybrid_model_binary.py :

    load_and_clean           -> same cleaning (no de-duplication, 33,102 rows)
    fit_preprocessor         -> SimpleImputer(median, add_indicator) + RobustScaler(10, 90)
    train_ae_feature_extractor -> autoencoder trained on benign training rows only
    build_stack              -> RF + XGBoost + LightGBM + ExtraTrees + MLP -> LogisticRegression
    binary_metrics           -> accuracy, balanced acc, macro F1, precision/recall, ROC AUC

and repeats main()'s exact steps (seed 42, stratified 80/20 then 75/25 split,
SMOTE on the training split only). The only addition is that every fitted
artifact is saved so the dashboard backend can serve real predictions:

    backend/models/hybrid/preprocessor.joblib   fitted imputer + scaler
    backend/models/hybrid/autoencoder.pt        PyTorch state_dict (+ input dim)
    backend/models/hybrid/autoencoder_numpy.npz same weights for torch-free inference
    backend/models/hybrid/stack.joblib          fitted StackingClassifier
    backend/models/hybrid/model_card.json       features, versions, measured metrics
    backend/models/hybrid/heldout_predictions.csv  per-row held-out predictions
    app/samples/hybrid_heldout_test_sample.csv  labelled rows from the held-out test split

The reported metrics are whatever this run measures on the held-out test split.
Nothing is adjusted to match the thesis figure (94.3%).

Run from the project root (takes ~5-15 min on a laptop CPU):
    python backend/train_hybrid.py
"""
from __future__ import annotations

import io
import json
import platform
import sys
import time
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "seaql-repo" / "src"
DATA = ROOT / "seaql-repo" / "data" / "Dataset_T-ITS.csv"
OUT = Path(__file__).resolve().parent / "models" / "hybrid"
SAMPLES = ROOT / "app" / "samples"
sys.path.insert(0, str(SRC))


def main() -> int:
    t0 = time.time()
    import joblib
    import numpy as np
    import pandas as pd
    import sklearn
    import torch
    import xgboost
    import lightgbm
    import imblearn
    from imblearn.over_sampling import SMOTE
    from sklearn.metrics import confusion_matrix
    from sklearn.model_selection import train_test_split

    import uav_fl_hybrid_model_binary as H          # the ORIGINAL research script
    from uav_fl_project import Config, set_seed

    OUT.mkdir(parents=True, exist_ok=True)
    cfg = Config(seed=42, max_rows=0)
    set_seed(cfg.seed)

    # ---------------- exactly the steps of H.main() ----------------
    print("[1/6] Loading full dataset with the original load_and_clean() ...")
    X, y3 = H.load_and_clean(DATA)
    features = X.columns.tolist()
    print(f"      rows={len(X)}  features={len(features)}")
    Xtv, Xte, ytv3, yte3 = train_test_split(X, y3, test_size=0.20, stratify=y3, random_state=cfg.seed)
    Xtr, Xv, ytr3, yv3 = train_test_split(Xtv, ytv3, test_size=0.25, stratify=ytv3, random_state=cfg.seed)
    ytr_bin = (ytr3 != "benign").astype(int).values
    yte_bin = (yte3 != "benign").astype(int).values

    print("[2/6] Fitting the original preprocessor on the training split only ...")
    pre = H.fit_preprocessor(Xtr)
    Xtr_p = pre.transform(Xtr).astype("float32")
    Xv_p = pre.transform(Xv).astype("float32")
    Xte_p = pre.transform(Xte).astype("float32")

    print("[3/6] Training the autoencoder feature extractor (benign training rows only) ...")
    extract = H.train_ae_feature_extractor(Xtr_p, ytr_bin, cfg, OUT)
    # recover the trained autoencoder from the original function's closure so it can be saved
    ae = next(c.cell_contents for c in extract.__closure__ if isinstance(c.cell_contents, torch.nn.Module))
    Xtr_h = np.concatenate([Xtr_p, extract(Xtr_p)], axis=1)
    Xte_h = np.concatenate([Xte_p, extract(Xte_p)], axis=1)

    print("[4/6] SMOTE on the training split only ...")
    Xtr_bal, ytr_bal = SMOTE(random_state=cfg.seed, k_neighbors=5).fit_resample(Xtr_h, ytr_bin)
    print(f"      training rows before SMOTE: {len(ytr_bin)}, after: {len(ytr_bal)}")

    print("[5/6] Fitting the original 5-model stack (this is the slow step) ...")
    t1 = time.time()
    model = H.build_stack(cfg.seed)
    model.fit(Xtr_bal, ytr_bal)
    fit_s = time.time() - t1
    print(f"      stack fitted in {fit_s:.0f} s")

    print("[6/6] Evaluating on the held-out test split ...")
    prob = model.predict_proba(Xte_h)[:, 1]
    pred = model.predict(Xte_h)
    metrics = {k: float(v) for k, v in H.binary_metrics(yte_bin, pred, prob).items()}
    cm = confusion_matrix(yte_bin, pred, labels=[0, 1]).tolist()
    by3 = {c: {"predicted_benign": int(((yte3.values == c) & (pred == 0)).sum()),
               "predicted_attack": int(((yte3.values == c) & (pred == 1)).sum())} for c in ["benign", "DoS attack", "Replay"]}

    # ---------------- save artifacts ----------------
    joblib.dump(pre, OUT / "preprocessor.joblib", compress=3)
    joblib.dump(model, OUT / "stack.joblib", compress=3)
    import make_portable_xgb  # portable copy (XGBoost in JSON) used by the server on every OS
    make_portable_xgb.main()
    ae_cpu = ae.to("cpu").eval()
    torch.save({"state_dict": ae_cpu.state_dict(), "input_dim": int(Xtr_p.shape[1])}, OUT / "autoencoder.pt")
    # numpy copy of the weights: encoder Linear-ReLU-(Dropout)-Linear-ReLU, decoder Linear-ReLU-Linear
    sd = {k: v.detach().cpu().numpy() for k, v in ae_cpu.state_dict().items()}
    np.savez(OUT / "autoencoder_numpy.npz", **{k.replace(".", "_"): v for k, v in sd.items()})

    # verify the torch-free forward pass reproduces the original extractor exactly
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from hybrid_model import ae_features_numpy
    npz = dict(np.load(OUT / "autoencoder_numpy.npz"))
    diff = float(np.abs(ae_features_numpy(npz, Xte_p) - extract(Xte_p)).max())
    X_np = np.concatenate([Xte_p, ae_features_numpy(npz, Xte_p)], axis=1)
    same_pred = bool((model.predict(X_np) == pred).all())
    print(f"      numpy-vs-torch AE feature max abs diff = {diff:.3e}; identical predictions: {same_pred}")

    pd.DataFrame({"csv_index": Xte.index, "true_3class": yte3.values, "true_binary": np.where(yte_bin == 1, "attack", "benign"),
                  "predicted": np.where(pred == 1, "attack", "benign"), "p_attack": prob.round(6)}).to_csv(OUT / "heldout_predictions.csv", index=False)

    # held-out labelled sample for the Detection Lab (original columns + class)
    raw = pd.read_csv(DATA, dtype=str, low_memory=False)
    raw.columns = [str(c).strip() for c in raw.columns]
    sample_idx = pd.Series(Xte.index).sample(n=min(2000, len(Xte)), random_state=cfg.seed).values
    SAMPLES.mkdir(parents=True, exist_ok=True)
    raw.loc[sample_idx].to_csv(SAMPLES / "hybrid_heldout_test_sample.csv", index=False)

    card = {
        "model": "Hybrid AE-Stacked Ensemble (binary attack detection)",
        "source_script": "seaql-repo/src/uav_fl_hybrid_model_binary.py (functions imported, not re-implemented)",
        "task": "binary: benign vs attack (DoS attack + Replay)",
        "classes": ["benign", "attack"],
        "features": features,
        "rows_used": int(len(X)),
        "split": {"seed": cfg.seed, "train": int(len(Xtr)), "validation_unused_by_script": int(len(Xv)), "test": int(len(Xte))},
        "smote": {"applied_to": "training split only", "rows_before": int(len(ytr_bin)), "rows_after": int(len(ytr_bal))},
        "architecture": {"autoencoder": "trained on benign training rows; features = reconstruction MSE + latent vector",
                         "base_learners": ["RandomForest(400)", "XGBoost(350)", "LightGBM(350)", "ExtraTrees(400)", "MLP(160,80)"],
                         "meta_learner": "LogisticRegression(class_weight=balanced)", "stacking_cv": 5,
                         "hybrid_feature_dim": int(Xtr_h.shape[1])},
        "heldout_metrics": metrics,
        "heldout_confusion_matrix": {"labels": ["benign", "attack"], "matrix": cm},
        "heldout_by_true_3class": by3,
        "thesis_recorded_metrics": {"accuracy": 0.9433620299048482, "macro_f1": 0.9326936148831858, "auc": 0.9832917010179941,
                                    "source": "seaql-repo/results/metrics/hybrid_binary_test_metrics.csv"},
        "numpy_inference_check": {"max_abs_feature_diff": diff, "identical_predictions": same_pred},
        "training_seconds": round(time.time() - t0, 1), "stack_fit_seconds": round(fit_s, 1),
        "environment": {"python": platform.python_version(), "numpy": np.__version__, "pandas": pd.__version__,
                        "scikit-learn": sklearn.__version__, "xgboost": xgboost.__version__, "lightgbm": lightgbm.__version__,
                        "imbalanced-learn": imblearn.__version__, "torch": torch.__version__, "device": cfg.device},
        "trained_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    (OUT / "model_card.json").write_text(json.dumps(card, indent=2))
    print("\n=== Held-out test metrics (this run) ===")
    for k in ["accuracy", "macro_f1", "auc", "attack_precision", "attack_recall", "benign_precision", "benign_recall", "balanced_accuracy"]:
        print(f"  {k:18s} {metrics[k]:.4f}")
    print(f"  confusion [[TN, FP], [FN, TP]] = {cm}")
    print(f"Saved artifacts to {OUT}  (total {time.time() - t0:.0f} s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
