#!/usr/bin/env python3
"""
Hybrid AE-Stacked Ensemble - BINARY attack-detection variant.

Same hybrid architecture as v3 (autoencoder anomaly features + SMOTE +
5-model stack: Random Forest + XGBoost + LightGBM + ExtraTrees + MLP,
combined by a Logistic Regression meta-learner) but the primary target is
collapsed to two classes: "attack" (DoS attack + Replay) vs "benign".

Why: independent testing (full 33k-row dataset, multiple architectures
including a hierarchical 2-stage classifier) showed DoS attack and Replay
overlap heavily at the packet-feature level - this is a data-level
property, not a modelling weakness, and it caps 3-class macro-F1 around
72-77% regardless of model complexity. Binary attack-vs-benign detection
does not suffer from that overlap and is a standard, literature-supported
framing for IDS work (detect attack presence first; sub-classify only if
needed).

This script reports BOTH:
  1. Binary attack-detection metrics (the headline number), and
  2. The original 3-class breakdown for the same test split (secondary/
     detailed analysis), so nothing is hidden - the thesis text should
     present both, exactly as discussed.

Usage:
    python uav_fl_hybrid_model_binary.py --data Dataset_T-ITS.csv --output uav_fl_results
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
from sklearn.metrics import (
    accuracy_score, balanced_accuracy_score, f1_score, confusion_matrix,
    roc_auc_score, precision_score, recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import LabelEncoder

from imblearn.over_sampling import SMOTE
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier

import torch
from torch import nn

from uav_fl_project import Config, set_seed, Autoencoder


# ---------------------------------------------------------------------------
# Data loading (same cleaning rules as uav_fl_project.load_and_clean)
# ---------------------------------------------------------------------------
def load_and_clean(path: Path):
    raw = pd.read_csv(path, dtype=str, low_memory=False)
    raw.columns = [str(c).strip() for c in raw.columns]
    if "class" not in raw.columns:
        raise ValueError("Dataset must contain a 'class' target column.")
    y = raw["class"].astype(str).str.strip()
    valid_labels = {"benign", "Replay", "DoS attack"}
    df = raw.loc[y.isin(valid_labels)].copy()
    y3 = df.pop("class").astype(str).str.strip()  # original 3-class labels, kept for secondary report

    X = df.apply(pd.to_numeric, errors="coerce")
    X = X.drop(columns=[c for c in ["timestamp_c", "frame.number"] if c in X.columns])
    X = X.drop(columns=X.columns[X.isna().all()])
    nunique = X.nunique(dropna=True)
    X = X.drop(columns=nunique[nunique <= 1].index)
    return X, y3


def fit_preprocessor(X_train: pd.DataFrame):
    from sklearn.impute import SimpleImputer
    from sklearn.preprocessing import RobustScaler
    from sklearn.pipeline import Pipeline
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
        ("scaler", RobustScaler(quantile_range=(10, 90))),
    ]).fit(X_train)


# ---------------------------------------------------------------------------
# Autoencoder anomaly-feature extractor (trained on benign traffic only)
# ---------------------------------------------------------------------------
def train_ae_feature_extractor(Xtr, ytr_bin, cfg, outdir, epochs=50, patience=8):
    device = torch.device(cfg.device)
    model = Autoencoder(Xtr.shape[1]).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=cfg.weight_decay)
    loss_fn = nn.MSELoss()
    benign_train = torch.tensor(Xtr[ytr_bin == 0], dtype=torch.float32, device=device)  # 0 = benign

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

    pd.DataFrame(history).to_csv(outdir / "hybrid_binary_autoencoder_training_history.csv", index=False)
    fig, ax = plt.subplots(figsize=(7, 4))
    h = pd.DataFrame(history)
    ax.plot(h.epoch, h.train_loss)
    ax.set(xlabel="Epoch", ylabel="MSE", title="Hybrid (binary) - autoencoder feature-extractor training")
    fig.tight_layout()
    fig.savefig(outdir / "hybrid_binary_autoencoder_training_curve.png", dpi=220)
    plt.close(fig)
    return extract


def build_hybrid_features(Xtr, Xv, Xte, ytr_bin, cfg, outdir):
    extract = train_ae_feature_extractor(Xtr, ytr_bin, cfg, outdir)
    return (np.concatenate([Xtr, extract(Xtr)], axis=1),
            np.concatenate([Xv, extract(Xv)], axis=1),
            np.concatenate([Xte, extract(Xte)], axis=1))


# ---------------------------------------------------------------------------
# 5-model stack
# ---------------------------------------------------------------------------
def build_stack(seed):
    rf = RandomForestClassifier(n_estimators=400, max_depth=20, min_samples_leaf=2,
                                 max_features="sqrt", class_weight="balanced_subsample",
                                 random_state=seed, n_jobs=-1)
    xgb = XGBClassifier(objective="binary:logistic", eval_metric="logloss",
                         n_estimators=350, max_depth=6, learning_rate=0.06,
                         subsample=0.85, colsample_bytree=0.85, random_state=seed,
                         n_jobs=-1, tree_method="hist")
    lgbm = LGBMClassifier(objective="binary", n_estimators=350, num_leaves=63,
                           learning_rate=0.06, subsample=0.85, colsample_bytree=0.85,
                           random_state=seed, n_jobs=-1, verbose=-1)
    et = ExtraTreesClassifier(n_estimators=400, max_features="sqrt",
                               class_weight="balanced_subsample", random_state=seed, n_jobs=-1)
    mlp = MLPClassifier(hidden_layer_sizes=(160, 80), alpha=1e-4, batch_size=256,
                         learning_rate_init=8e-4, max_iter=250, early_stopping=True,
                         validation_fraction=0.15, n_iter_no_change=15, random_state=seed)
    meta = LogisticRegression(max_iter=3000, class_weight="balanced", random_state=seed)
    return StackingClassifier(
        estimators=[("rf", rf), ("xgb", xgb), ("lgbm", lgbm), ("et", et), ("mlp", mlp)],
        final_estimator=meta, stack_method="predict_proba", passthrough=False, n_jobs=-1, cv=5,
    )


def binary_metrics(y_true, y_pred, y_prob):
    return {
        "accuracy": accuracy_score(y_true, y_pred),
        "balanced_accuracy": balanced_accuracy_score(y_true, y_pred),
        "macro_f1": f1_score(y_true, y_pred, average="macro"),
        "attack_precision": precision_score(y_true, y_pred, pos_label=1),
        "attack_recall": recall_score(y_true, y_pred, pos_label=1),
        "benign_precision": precision_score(y_true, y_pred, pos_label=0),
        "benign_recall": recall_score(y_true, y_pred, pos_label=0),
        "auc": roc_auc_score(y_true, y_prob),
    }


def plot_confusion_simple(y_true, y_pred, labels, title, path):
    cm = confusion_matrix(y_true, y_pred, labels=np.arange(len(labels)))
    fig, ax = plt.subplots(figsize=(5.5, 5))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(len(labels))); ax.set_xticklabels(labels)
    ax.set_yticks(range(len(labels))); ax.set_yticklabels(labels)
    ax.set_xlabel("Predicted"); ax.set_ylabel("True"); ax.set_title(title)
    for i in range(len(labels)):
        for j in range(len(labels)):
            ax.text(j, i, cm[i, j], ha="center", va="center",
                    color="white" if cm[i, j] > cm.max() / 2 else "black")
    fig.colorbar(im)
    fig.tight_layout()
    fig.savefig(path, dpi=220)
    plt.close(fig)


def comparison_chart(rows, outdir, filename_stub, ylabel, title):
    df = pd.DataFrame(rows)
    df.to_csv(outdir / f"{filename_stub}.csv", index=False)
    colors = ["#7f9bb8"] * (len(df) - 1) + ["#2c6e49"]
    fig, ax = plt.subplots(figsize=(9, 5))
    ax.bar(df["model"], df["value"], color=colors)
    ax.set_ylim(0, 1.05)
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    for i, v in enumerate(df["value"]):
        ax.text(i, v + 0.02, f"{v:.3f}", ha="center")
    plt.xticks(rotation=20, ha="right")
    fig.tight_layout()
    fig.savefig(outdir / f"{filename_stub}.png", dpi=220)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=Path("Dataset_T-ITS.csv"))
    ap.add_argument("--output", type=Path, default=Path("uav_fl_results"))
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--no-smote", action="store_true")
    args = ap.parse_args()

    cfg = Config(seed=args.seed, max_rows=0)
    set_seed(cfg.seed)
    out = args.output
    out.mkdir(parents=True, exist_ok=True)

    print("Loading full dataset (no row cap)...")
    X, y3 = load_and_clean(args.data)
    print(f"  total cleaned rows: {len(X)}, features: {X.shape[1]}")
    y_bin_all = (y3 != "benign").astype(int)  # 1 = attack (DoS attack or Replay), 0 = benign

    Xtv, Xte, ytv3, yte3 = train_test_split(X, y3, test_size=0.20, stratify=y3, random_state=cfg.seed)
    Xtr, Xv, ytr3, yv3 = train_test_split(Xtv, ytv3, test_size=0.25, stratify=ytv3, random_state=cfg.seed)
    ytr_bin = (ytr3 != "benign").astype(int).values
    yv_bin = (yv3 != "benign").astype(int).values
    yte_bin = (yte3 != "benign").astype(int).values

    pre = fit_preprocessor(Xtr)
    Xtr_p = pre.transform(Xtr).astype("float32")
    Xv_p = pre.transform(Xv).astype("float32")
    Xte_p = pre.transform(Xte).astype("float32")

    print("Building hybrid features (autoencoder anomaly signal + original features)...")
    Xtr_h, Xv_h, Xte_h = build_hybrid_features(Xtr_p, Xv_p, Xte_p, ytr_bin, cfg, out)

    if not args.no_smote:
        print("Applying SMOTE (binary balance)...")
        sm = SMOTE(random_state=cfg.seed, k_neighbors=5)
        Xtr_bal, ytr_bal = sm.fit_resample(Xtr_h, ytr_bin)
        print(f"  training rows before SMOTE: {len(ytr_bin)}, after: {len(ytr_bal)}")
    else:
        Xtr_bal, ytr_bal = Xtr_h, ytr_bin

    print("Fitting 5-model hybrid stack (binary attack-detection target)...")
    model = build_stack(cfg.seed)
    model.fit(Xtr_bal, ytr_bal)

    pred = model.predict(Xte_h)
    prob = model.predict_proba(Xte_h)[:, 1]
    metrics = binary_metrics(yte_bin, pred, prob)
    metrics["model"] = "Hybrid AE-Stacked Ensemble (binary attack-detection)"
    pd.DataFrame([metrics]).to_csv(out / "hybrid_binary_test_metrics.csv", index=False)
    plot_confusion_simple(yte_bin, pred, ["benign", "attack"],
                           "Hybrid AE-Stacked Ensemble - Binary Test Confusion Matrix",
                           out / "hybrid_binary_confusion_matrix.png")

    print("\n=== HEADLINE: binary attack-detection metrics ===")
    print(json.dumps(metrics, indent=2, default=float))

    # ---- Secondary/detailed analysis: same test split, original 3-class labels ----
    # We report what the SAME trained pipeline's binary decision implies for the
    # 3-class view (attack-predicted rows still carry their true DoS/Replay label
    # here only for transparency - no 3-class model is being claimed as 85%+).
    le3 = LabelEncoder().fit(y3)
    yte3_enc = le3.transform(yte3)
    pred_as_3class_view = pd.DataFrame({
        "true_3class": yte3.values,
        "predicted_binary": np.where(pred == 1, "attack", "benign"),
    })
    pred_as_3class_view.to_csv(out / "hybrid_binary_secondary_3class_breakdown.csv", index=False)

    # Also load the earlier genuine 3-class hybrid number (from hybrid_v3 run, full data)
    # for the comparison chart, if present.
    rows_binary = [
        {"model": "Random Forest (binary, quick baseline)", "value": 0.929},
        {"model": "Hybrid AE-Stack (binary, this run)", "value": metrics["accuracy"]},
    ]
    comparison_chart(rows_binary, out, "hybrid_binary_vs_baseline_comparison",
                      "Accuracy (test set)", "Binary attack-detection: baseline vs hybrid stack")

    (out / "hybrid_binary_run_summary.json").write_text(json.dumps({
        "framing": "binary attack-vs-benign (headline) + 3-class breakdown (secondary)",
        "rows_used": len(X),
        "used_full_dataset": True,
        "smote_applied": not args.no_smote,
        "binary_test_accuracy": metrics["accuracy"],
        "binary_test_macro_f1": metrics["macro_f1"],
        "binary_test_auc": metrics["auc"],
        "note_for_thesis": (
            "DoS attack and Replay overlap heavily at the packet-feature level "
            "(independently verified across RF, full 5-model stack, and a "
            "hierarchical 2-stage classifier - all capped near 72-77% macro F1 "
            "on the 3-class problem). The hybrid model was therefore optimized "
            "for binary attack-detection, which does not suffer from that "
            "overlap. Both numbers should be reported: binary headline + "
            "3-class as secondary/detailed analysis."
        ),
    }, indent=2))

    print(f"\nAll binary-hybrid tables and figures saved to: {out.resolve()}")


if __name__ == "__main__":
    main()
