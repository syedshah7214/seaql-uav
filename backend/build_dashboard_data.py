"""
Builds app/data/seaql-data.js from the REAL experiment outputs in
seaql-repo/results/metrics (+ dataset statistics for the XAI page).

Every number shown as "Verified Experiment" in the dashboard comes from here.
Re-run after re-running the research pipeline:
    python backend/build_dashboard_data.py
"""
import csv
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
M = ROOT / "seaql-repo" / "results" / "metrics"
OUT = ROOT / "app" / "data" / "seaql-data.js"


def rows(name):
    with open(M / name, newline="") as fh:
        return list(csv.DictReader(fh))


def f(x):
    try:
        return None if x in ("", None) else float(x)
    except ValueError:
        return None


def main():
    d = {"source": "seaql-repo/results/metrics (recorded experiment outputs)"}
    d["config"] = json.loads((M / "config.json").read_text())
    d["runSummary"] = json.loads((M / "run_summary.json").read_text())
    d["hybridSummary"] = json.loads((M / "hybrid_binary_run_summary.json").read_text())
    d["dataAudit"] = {r["item"]: int(r["value"]) for r in rows("data_audit.csv")}
    d["classDistribution"] = {r["class"]: int(r["count"]) for r in rows("class_distribution.csv")}

    hb = rows("hybrid_binary_test_metrics.csv")[0]
    d["hybridBinary"] = {k: f(v) for k, v in hb.items() if k != "model"} | {"model": hb["model"]}

    br = rows("hybrid_binary_secondary_3class_breakdown.csv")
    cm = {"benign": {"benign": 0, "attack": 0}, "attack": {"benign": 0, "attack": 0}}
    by3 = {}
    for r in br:
        t = "benign" if r["true_3class"] == "benign" else "attack"
        cm[t][r["predicted_binary"]] += 1
        by3.setdefault(r["true_3class"], {"benign": 0, "attack": 0})[r["predicted_binary"]] += 1
    d["hybridBinaryConfusion"] = {"labels": ["benign", "attack"],
                                  "matrix": [[cm["benign"]["benign"], cm["benign"]["attack"]],
                                             [cm["attack"]["benign"], cm["attack"]["attack"]]],
                                  "by3class": by3, "testRows": len(br)}

    d["centralTest"] = [{"model": r["model"], "accuracy": f(r["accuracy"]), "balancedAccuracy": f(r["balanced_accuracy"]),
                         "macroF1": f(r["macro_f1"]), "weightedF1": f(r["weighted_f1"]), "auc": f(r["macro_ovr_auc"]),
                         "trainSeconds": f(r["training_seconds"])} for r in rows("central_model_comparison_test.csv")]
    d["centralAllSplits"] = [{"model": r["model"], "split": r["split"], "macroF1": f(r["macro_f1"])}
                             for r in rows("central_model_comparison_all_splits.csv")]
    reports = {}
    for name, fn in [("Random Forest", "classification_report_random_forest.csv"),
                     ("MLP (early stopping)", "classification_report_mlp_early_stopping.csv"),
                     ("Logistic Regression", "classification_report_logistic_regression.csv")]:
        reports[name] = {r[""]: {"precision": f(r["precision"]), "recall": f(r["recall"]), "f1": f(r["f1-score"]),
                                 "support": f(r["support"])} for r in rows(fn)}
    d["classReports"] = reports

    fed = rows("federated_test_metrics.csv")[0]
    d["federatedTest"] = {"accuracy": f(fed["accuracy"]), "balancedAccuracy": f(fed["balanced_accuracy"]),
                          "macroF1": f(fed["macro_f1"]), "weightedF1": f(fed["weighted_f1"]), "auc": f(fed["macro_ovr_auc"]),
                          "rounds": int(fed["rounds_run"]), "parameters": int(fed["parameters"])}
    d["federatedRounds"] = [{"round": int(r["round"]), "trainMacroF1": f(r["train_macro_f1"]),
                             "valMacroF1": f(r["val_macro_f1"]), "valAccuracy": f(r["val_accuracy"]),
                             "fullBytes": int(r["full_upload_bytes_per_round"]),
                             "topkBytes": int(r["topk_upload_bytes_per_round"])} for r in rows("federated_round_history.csv")]
    # class_k index follows sklearn LabelEncoder (alphabetical): 0=DoS attack, 1=Replay, 2=benign
    d["nonIid"] = [{"client": int(r["client"]), "samples": int(r["samples"]), "dos": int(r["class_0"]),
                    "replay": int(r["class_1"]), "benign": int(r["class_2"])} for r in rows("non_iid_client_distribution.csv")]
    # cluster_map = [list(range(i, n_clients, n_clusters)) for i in range(n_clusters)] in uav_fl_project.py
    d["clusterMap"] = [[0, 2, 4, 6], [1, 3, 5, 7]]

    ae = rows("autoencoder_test_metrics.csv")[0]
    d["autoencoder"] = {"accuracy": f(ae["accuracy"]), "balancedAccuracy": f(ae["balanced_accuracy"]), "f1": f(ae["f1"]),
                        "auc": f(ae["roc_auc"]), "epochs": int(ae["epochs"])}
    d["aeHistory"] = [{"epoch": int(r["epoch"]), "train": f(r["train_loss"]), "val": f(r["val_benign_loss"])}
                      for r in rows("autoencoder_training_history.csv")]
    d["continual"] = [{"chunk": int(r["chunk"]), "samples": int(r["samples"]), "before": f(r["macro_f1_before_update"]),
                       "after": f(r["macro_f1_after_update"])} for r in rows("continual_learning_results.csv")]
    d["securityOverhead"] = [{"mechanism": r["mechanism"], "available": r["available"] == "True",
                              "signMs": f(r["sign_ms"]), "signatureBytes": f(r["signature_bytes"]), "note": r["note"]}
                             for r in rows("security_overhead.csv")]
    d["xai"] = [{"feature": r["feature"], "importance": f(r["importance"]), "method": r["method"]}
                for r in rows("xai_feature_importance.csv")]
    d["binaryBaseline"] = [{"model": r["model"], "accuracy": f(r["value"])} for r in rows("hybrid_binary_vs_baseline_comparison.csv")]

    # progression list from the existing website data (already curated from the thesis)
    site = json.loads((ROOT / "assets" / "data.json").read_text())
    d["progression"] = site.get("progression", [])

    # ---- Dataset statistics for the XAI page (computed from the real CSV) ----
    raw = pd.read_csv(ROOT / "seaql-repo" / "data" / "Dataset_T-ITS.csv", dtype=str, low_memory=False)
    raw.columns = [c.strip() for c in raw.columns]
    y = raw["class"].astype(str).str.strip()
    raw = raw[y.isin({"benign", "Replay", "DoS attack"})].copy()
    raw["class"] = raw["class"].str.strip()
    stats = {}
    for feat in ["wlan.seq", "wlan.duration", "time_since_last_packet", "wlan.fc.type", "frame.len"]:
        col = pd.to_numeric(raw[feat], errors="coerce")
        per = {}
        lo, hi = np.nanpercentile(col, 1), np.nanpercentile(col, 99)
        edges = np.linspace(lo, hi, 21)
        for c in ["benign", "DoS attack", "Replay"]:
            v = col[raw["class"] == c].dropna()
            hist, _ = np.histogram(v.clip(lo, hi), bins=edges)
            per[c] = {"mean": float(v.mean()), "median": float(v.median()), "p25": float(v.quantile(.25)),
                      "p75": float(v.quantile(.75)), "n": int(len(v)),
                      "hist": (hist / max(1, hist.sum())).round(4).tolist()}
        stats[feat] = {"edges": [float(e) for e in edges], "byClass": per}
    d["featureStats"] = stats

    mm = ROOT / "backend" / "models" / "model_metrics.json"
    d["localModel"] = json.loads(mm.read_text()) if mm.exists() else None
    hc = ROOT / "backend" / "models" / "hybrid" / "model_card.json"
    if hc.exists():   # the FYP model as re-trained and served by the backend (v6)
        c = json.loads(hc.read_text())
        d["liveHybrid"] = {k: c[k] for k in ("model", "heldout_metrics", "heldout_confusion_matrix", "heldout_by_true_3class", "split", "smote", "rows_used")}
    else:
        d["liveHybrid"] = None

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("/* AUTO-GENERATED by backend/build_dashboard_data.py from recorded experiment outputs. */\n"
                   "window.SEAQL_DATA = " + json.dumps(d, indent=1) + ";\n")
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
