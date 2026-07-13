#!/usr/bin/env python3
"""
Hybrid AE-Stacked Ensemble Classifier - v3 (5 diverse base learners).

Builds on v2 (autoencoder anomaly features + SMOTE + tuned RF/XGBoost) and
adds TWO more base learners that think about the data differently, which
usually helps a stacking ensemble more than tuning a single model harder:

  - ExtraTreesClassifier: like Random Forest but splits are chosen more
    randomly - tends to make different mistakes than RF, which is exactly
    what a stacking ensemble benefits from.
  - LightGBM: a leaf-wise gradient boosting library - different growth
    strategy than XGBoost's level-wise trees, often catches different
    patterns.

Final stack: Random Forest + XGBoost + LightGBM + ExtraTrees + MLP, combined
by a Logistic Regression meta-learner.

Designed to be run on the FULL cleaned dataset (no --max-rows) for the best
chance at a higher score - more training data helps every one of these
models, especially the minority attack classes.

As always: numbers reported are whatever the script actually measures. No
target accuracy is assumed or hardcoded.

Usage (full dataset - recommended, but slower):
    python uav_fl_hybrid_model_v3.py --data Dataset_T-ITS.csv --output uav_fl_results

Usage (quick test on a subset first):
    python uav_fl_hybrid_model_v3.py --data Dataset_T-ITS.csv --output uav_fl_results --max-rows 12000 --tune-iter 8
"""
from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier, StackingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import RandomizedSearchCV, StratifiedKFold
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import LabelEncoder

from imblearn.over_sampling import SMOTE
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier

import torch
from torch import nn

from uav_fl_project import (
    Config,
    set_seed,
    load_and_clean,
    split_data,
    fit_preprocessor,
    classification_metrics,
    plot_confusion,
    Autoencoder,
)


def train_ae_feature_extractor(Xtr, ytr, benign_id, cfg, outdir, epochs=50, patience=8):
    device = torch.device(cfg.device)
    model = Autoencoder(Xtr.shape[1]).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=cfg.weight_decay)
    loss_fn = nn.MSELoss()
    benign_train = torch.tensor(Xtr[ytr == benign_id], dtype=torch.float32, device=device)

    best, best_state, wait = np.inf, None, 0
    history = []
    n = benign_train.shape[0]
    for epoch in range(epochs):
        model.train()
        perm = torch.randperm(n)
        losses = []
        for i in range(0, n, cfg.batch_size):
            idx = perm[i:i + cfg.batch_size]
            xb = benign_train[idx]
            opt.zero_grad()
            rec = model(xb)
            loss = loss_fn(rec, xb)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 2.0)
            opt.step()
            losses.append(loss.item())
        model.eval()
        with torch.no_grad():
            vloss = loss_fn(model(benign_train), benign_train).item()
        history.append({"epoch": epoch + 1, "train_loss": float(np.mean(losses))})
        if vloss < best - 1e-6:
            best, best_state, wait = vloss, copy.deepcopy(model.state_dict()), 0
        else:
            wait += 1
            if wait >= patience:
                break
    model.load_state_dict(best_state)
    model.eval()

    def extract(X):
        xt = torch.tensor(X, dtype=torch.float32, device=device)
        with torch.no_grad():
            latent = model.encoder(xt)
            rec = model.decoder(latent)
            err = ((rec - xt) ** 2).mean(dim=1, keepdim=True)
        return np.concatenate([err.cpu().numpy(), latent.cpu().numpy()], axis=1)

    pd.DataFrame(history).to_csv(outdir / "hybrid_v3_autoencoder_training_history.csv", index=False)
    fig, ax = plt.subplots(figsize=(7, 4))
    h = pd.DataFrame(history)
    ax.plot(h.epoch, h.train_loss)
    ax.set(xlabel="Epoch", ylabel="MSE", title="Hybrid v3 - autoencoder feature-extractor training")
    fig.tight_layout()
    fig.savefig(outdir / "hybrid_v3_autoencoder_training_curve.png", dpi=220)
    plt.close(fig)

    return extract


def build_hybrid_features(Xtr, Xv, Xte, ytr, benign_id, cfg, outdir):
    extract = train_ae_feature_extractor(Xtr, ytr, benign_id, cfg, outdir)
    Htr, Hv, Hte = extract(Xtr), extract(Xv), extract(Xte)
    return (np.concatenate([Xtr, Htr], axis=1),
            np.concatenate([Xv, Hv], axis=1),
            np.concatenate([Xte, Hte], axis=1))


def tune_random_forest(Xtr, ytr, seed, n_iter):
    param_dist = {
        "n_estimators": [200, 300, 400, 600],
        "max_depth": [12, 16, 20, 26, None],
        "min_samples_leaf": [1, 2, 3, 5],
        "max_features": ["sqrt", "log2", 0.5],
    }
    base = RandomForestClassifier(class_weight="balanced_subsample", random_state=seed, n_jobs=-1)
    search = RandomizedSearchCV(base, param_dist, n_iter=n_iter, scoring="f1_macro",
                                 cv=StratifiedKFold(3, shuffle=True, random_state=seed),
                                 random_state=seed, n_jobs=-1)
    search.fit(Xtr, ytr)
    return search.best_estimator_, search.best_params_


def tune_xgboost(Xtr, ytr, seed, n_iter):
    param_dist = {
        "n_estimators": [200, 300, 500],
        "max_depth": [3, 4, 6, 8],
        "learning_rate": [0.02, 0.05, 0.08, 0.12],
        "subsample": [0.7, 0.85, 1.0],
        "colsample_bytree": [0.7, 0.85, 1.0],
        "min_child_weight": [1, 3, 5],
    }
    n_classes = len(np.unique(ytr))
    base = XGBClassifier(objective="multi:softprob", num_class=n_classes, eval_metric="mlogloss",
                          random_state=seed, n_jobs=-1, tree_method="hist")
    search = RandomizedSearchCV(base, param_dist, n_iter=n_iter, scoring="f1_macro",
                                 cv=StratifiedKFold(3, shuffle=True, random_state=seed),
                                 random_state=seed, n_jobs=-1)
    search.fit(Xtr, ytr)
    return search.best_estimator_, search.best_params_


def tune_lightgbm(Xtr, ytr, seed, n_iter):
    param_dist = {
        "n_estimators": [200, 300, 500],
        "num_leaves": [15, 31, 63, 90],
        "learning_rate": [0.02, 0.05, 0.08, 0.12],
        "subsample": [0.7, 0.85, 1.0],
        "colsample_bytree": [0.7, 0.85, 1.0],
        "min_child_samples": [10, 20, 40],
    }
    base = LGBMClassifier(objective="multiclass", random_state=seed, n_jobs=-1, verbose=-1)
    search = RandomizedSearchCV(base, param_dist, n_iter=n_iter, scoring="f1_macro",
                                 cv=StratifiedKFold(3, shuffle=True, random_state=seed),
                                 random_state=seed, n_jobs=-1)
    search.fit(Xtr, ytr)
    return search.best_estimator_, search.best_params_


def train_hybrid_stack_v3(Xtr, ytr, seed, outdir, tune_iter=15):
    print("  Tuning Random Forest...")
    rf, rf_params = tune_random_forest(Xtr, ytr, seed, tune_iter)
    print(f"    best RF params: {rf_params}")

    print("  Tuning XGBoost...")
    xgb, xgb_params = tune_xgboost(Xtr, ytr, seed, tune_iter)
    print(f"    best XGB params: {xgb_params}")

    print("  Tuning LightGBM...")
    lgbm, lgbm_params = tune_lightgbm(Xtr, ytr, seed, tune_iter)
    print(f"    best LightGBM params: {lgbm_params}")

    print("  Building ExtraTrees (extremely randomized trees)...")
    et = ExtraTreesClassifier(
        n_estimators=500, max_depth=None, min_samples_leaf=2,
        max_features="sqrt", class_weight="balanced_subsample",
        random_state=seed, n_jobs=-1,
    )

    mlp = MLPClassifier(
        hidden_layer_sizes=(160, 80), activation="relu", alpha=1e-4,
        batch_size=256, learning_rate_init=8e-4, max_iter=250,
        early_stopping=True, validation_fraction=0.15,
        n_iter_no_change=15, random_state=seed,
    )

    def clean(d):
        return {k: (float(v) if isinstance(v, np.floating) else v) for k, v in d.items()}

    (outdir / "hybrid_v3_tuned_hyperparameters.json").write_text(json.dumps({
        "random_forest": clean(rf_params), "xgboost": clean(xgb_params), "lightgbm": clean(lgbm_params),
    }, indent=2, default=str))

    meta = LogisticRegression(max_iter=3000, class_weight="balanced", random_state=seed)
    stack = StackingClassifier(
        estimators=[("rf", rf), ("xgb", xgb), ("lgbm", lgbm), ("et", et), ("mlp", mlp)],
        final_estimator=meta, stack_method="predict_proba",
        passthrough=False, n_jobs=-1, cv=5,
    )
    print("  Fitting final 5-model stacking ensemble -> Logistic Regression meta-learner...")
    stack.fit(Xtr, ytr)
    return stack


def comparison_chart(rows, outdir, filename_stub):
    df = pd.DataFrame(rows)
    df.to_csv(outdir / f"{filename_stub}.csv", index=False)
    colors = ["#7f9bb8"] * (len(df) - 1) + ["#2c6e49"]
    fig, ax = plt.subplots(figsize=(9, 5))
    ax.bar(df["model"], df["macro_f1"], color=colors)
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("Macro F1 (test set)")
    ax.set_title("v3 hybrid (5-model stack) vs. existing baselines")
    for i, v in enumerate(df["macro_f1"]):
        ax.text(i, v + 0.02, f"{v:.3f}", ha="center")
    plt.xticks(rotation=20, ha="right")
    fig.tight_layout()
    fig.savefig(outdir / f"{filename_stub}.png", dpi=220)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=Path("Dataset_T-ITS.csv"))
    ap.add_argument("--output", type=Path, default=Path("uav_fl_results"))
    ap.add_argument("--max-rows", type=int, default=0, help="0 = use the FULL cleaned dataset (recommended).")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--baseline-summary", type=Path, default=None)
    ap.add_argument("--tune-iter", type=int, default=15)
    ap.add_argument("--no-smote", action="store_true")
    args = ap.parse_args()

    cfg = Config(seed=args.seed, max_rows=args.max_rows)
    set_seed(cfg.seed)
    out = args.output
    out.mkdir(parents=True, exist_ok=True)

    print(f"Loading data (max_rows={'ALL' if args.max_rows == 0 else args.max_rows})...")
    X, y, audit = load_and_clean(args.data, args.max_rows)
    print(f"  total cleaned rows: {len(X)}")
    Xtr_df, Xv_df, Xte_df, ytr_s, yv_s, yte_s = split_data(X, y, cfg)
    le = LabelEncoder().fit(ytr_s)
    ytr, yv, yte = le.transform(ytr_s), le.transform(yv_s), le.transform(yte_s)

    pre = fit_preprocessor(Xtr_df)
    Xtr = pre.transform(Xtr_df).astype("float32")
    Xv = pre.transform(Xv_df).astype("float32")
    Xte = pre.transform(Xte_df).astype("float32")

    benign_id = int(le.transform(["benign"])[0])
    print("Building hybrid features (autoencoder anomaly signal + original features)...")
    Xtr_h, Xv_h, Xte_h = build_hybrid_features(Xtr, Xv, Xte, ytr, benign_id, cfg, out)

    if not args.no_smote:
        print("Applying SMOTE to balance minority classes (training data only)...")
        class_counts = pd.Series(ytr).value_counts()
        k_neighbors = max(1, min(5, class_counts.min() - 1))
        sm = SMOTE(random_state=cfg.seed, k_neighbors=k_neighbors)
        Xtr_h, ytr_bal = sm.fit_resample(Xtr_h, ytr)
        print(f"  training rows before SMOTE: {len(ytr)}, after: {len(ytr_bal)}")
    else:
        ytr_bal = ytr

    print("Training v3 hybrid stacking ensemble (this can take a while on the full dataset)...")
    model = train_hybrid_stack_v3(Xtr_h, ytr_bal, cfg.seed, out, tune_iter=args.tune_iter)

    test_pred = model.predict(Xte_h)
    test_prob = model.predict_proba(Xte_h)
    metrics = classification_metrics(yte, test_pred, test_prob)
    metrics["model"] = "Hybrid AE-Stacked Ensemble (v3, 5-model)"
    pd.DataFrame([metrics]).to_csv(out / "hybrid_v3_test_metrics.csv", index=False)
    plot_confusion(yte, test_pred, le.classes_,
                   "Hybrid AE-Stacked Ensemble v3 - Test Confusion Matrix",
                   out / "hybrid_v3_confusion_matrix.png")

    print("\nHybrid v3 test metrics:")
    print(json.dumps(metrics, indent=2, default=float))

    baseline_path = args.baseline_summary or (out / "run_summary.json")
    rows = []
    if baseline_path.exists():
        base = json.loads(baseline_path.read_text())
        rows.append({"model": base.get("best_central_model_by_validation", "Random Forest"),
                     "macro_f1": base.get("best_central_test_macro_f1")})
        rows.append({"model": "Hierarchical Federated MLP",
                     "macro_f1": base.get("hierarchical_fl_test_macro_f1")})
        rows.append({"model": "Autoencoder (binary F1)",
                     "macro_f1": base.get("autoencoder_binary_f1")})
    for stub, label in [("hybrid_model_test_metrics.csv", "Hybrid v1"),
                         ("hybrid_v2_test_metrics.csv", "Hybrid v2 (tuned)")]:
        p = out / stub
        if p.exists():
            v = pd.read_csv(p).iloc[0]
            rows.append({"model": label, "macro_f1": float(v["macro_f1"])})
    rows.append({"model": "Hybrid v3 (5-model)", "macro_f1": metrics["macro_f1"]})
    comparison_chart(rows, out, "hybrid_v3_vs_baselines_comparison")

    (out / "hybrid_v3_run_summary.json").write_text(json.dumps({
        "rows_used": len(X),
        "used_full_dataset": args.max_rows == 0,
        "smote_applied": not args.no_smote,
        "tuning_iterations_per_model": args.tune_iter,
        "hybrid_v3_test_accuracy": metrics["accuracy"],
        "hybrid_v3_test_macro_f1": metrics["macro_f1"],
        "hybrid_v3_test_weighted_f1": metrics["weighted_f1"],
        "components": [
            "Autoencoder reconstruction error + latent embedding (anomaly signal)",
            "SMOTE-balanced training data" if not args.no_smote else "No class rebalancing",
            "Random Forest (tuned)", "XGBoost (tuned)", "LightGBM (tuned)",
            "Extra Trees (extremely randomized trees)", "MLP neural network",
            "Logistic Regression (meta-learner, 5-fold stacking)",
        ],
        "note": "These numbers are produced directly by this script on the supplied data. "
                "They are not adjusted or targeted to any specific figure.",
    }, indent=2))

    print(f"\nAll hybrid v3 tables and figures saved to: {out.resolve()}")


if __name__ == "__main__":
    main()
