"""
SEAQL local server - serves the website AND the real-model prediction API.

    python backend/server.py            -> http://localhost:8000/dashboard.html
    python backend/server.py --port 8080

Only the Python standard library is used for the web server. The prediction
API additionally needs pandas + scikit-learn + joblib (see backend/requirements.txt).
If the trained model file is missing (or was made with a different scikit-learn
version), it is (re)trained automatically from the dataset on startup (~10-60 s).

Two models are served:
    hybrid  - the FYP model: Hybrid AE-Stacked Ensemble (binary benign / attack),
              artifacts in backend/models/hybrid/ (made by backend/train_hybrid.py,
              which calls the original seaql-repo/src/uav_fl_hybrid_model_binary.py)
    rf      - Random Forest 3-class baseline (backend/train_model.py)

Endpoints
    GET  /api/health                 -> backend + status of both models
    GET  /api/models                 -> model cards of both models
    GET  /api/model?name=hybrid|rf   -> one model card (default rf, for backwards compatibility)
    POST /api/predict?model=hybrid|rf   body = raw CSV text (Content-Type: text/csv); default hybrid
"""
from __future__ import annotations

import argparse
import io
import json
import mimetypes
import os
import sys
import threading
import traceback
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
ROOT = BACKEND.parent
MODEL_PATH = BACKEND / "models" / "seaql_rf_3class.joblib"
METRICS_PATH = BACKEND / "models" / "model_metrics.json"
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_ROWS = 100_000

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("image/webp", ".webp")

STATE = {"model": None, "metrics": None, "error": None, "ml_available": False,
         "hybrid": None, "hybrid_card": None, "hybrid_error": None, "hybrid_status": "loading"}
HYBRID_TRAIN_DEPS = ("torch", "xgboost", "lightgbm", "imblearn")


def load_hybrid() -> None:
    """Load the saved Hybrid AE-Stacked Ensemble. Retrain from the original script only if needed and possible."""
    sys.path.insert(0, str(BACKEND))
    import hybrid_model as HM
    for attempt in (1, 2):
        missing = HM.missing_artifacts()
        try:
            if missing:
                raise FileNotFoundError("missing artifact(s): " + ", ".join(missing))
            STATE["hybrid_status"] = "loading"
            m = HM.HybridModel()
            STATE["hybrid"], STATE["hybrid_card"] = m, m.card
            STATE["hybrid_status"], STATE["hybrid_error"] = "ready", None
            print(f"[SEAQL] Hybrid AE-Stacked Ensemble loaded ({len(m.features)} features, "
                  f"held-out acc {m.card['heldout_metrics']['accuracy']:.4f})")
            return
        except Exception as exc:
            reason = f"{type(exc).__name__}: {exc}"
            if attempt == 2:
                STATE["hybrid_status"], STATE["hybrid_error"] = "error", f"Hybrid model could not be loaded or trained ({reason})."
                print("[SEAQL] " + STATE["hybrid_error"]); return
            lacking = []
            for mod in HYBRID_TRAIN_DEPS:
                try:
                    __import__(mod)
                except Exception:
                    lacking.append(mod)
            if lacking:
                STATE["hybrid_status"] = "error"
                STATE["hybrid_error"] = (f"Hybrid model not available ({reason}). Install the packages with "
                                         "'pip install -r backend\\requirements-train.txt' and restart, or run "
                                         "'python backend\\train_hybrid.py'. Missing: " + ", ".join(lacking))
                print("[SEAQL] " + STATE["hybrid_error"]); return
            print(f"[SEAQL] Hybrid model not usable ({reason}). Re-training it with the original research "
                  "script - this takes several minutes ...")
            STATE["hybrid_status"] = "training"
            import train_hybrid
            if train_hybrid.main() != 0:
                STATE["hybrid_status"], STATE["hybrid_error"] = "error", "Hybrid training failed."
                return


def load_model() -> None:
    try:
        import joblib  # noqa: F401
        import pandas  # noqa: F401
        import sklearn  # noqa: F401
        STATE["ml_available"] = True
    except Exception as exc:  # pragma: no cover
        STATE["error"] = (f"Python ML packages missing ({exc}). Run: pip install -r backend/requirements.txt")
        print("[SEAQL] " + STATE["error"])
        return
    import joblib
    for attempt in (1, 2):
        try:
            if not MODEL_PATH.exists():
                raise FileNotFoundError("model file not found")
            bundle = joblib.load(MODEL_PATH)
            STATE["model"] = bundle
            STATE["metrics"] = json.loads(METRICS_PATH.read_text())
            STATE["error"] = None
            print(f"[SEAQL] Model loaded: {MODEL_PATH.name} ({len(bundle['features'])} features)")
            return
        except Exception as exc:
            if attempt == 2:
                STATE["error"] = f"Could not load or train model: {exc}"
                print("[SEAQL] " + STATE["error"])
                return
            print(f"[SEAQL] Model not usable ({exc}). Training it now from the dataset - please wait...")
            sys.path.insert(0, str(BACKEND))
            import train_model
            if train_model.main() != 0:
                STATE["error"] = "Training failed - is seaql-repo/data/Dataset_T-ITS.csv present?"
                return


# ---------------------------------------------------------------------------
# JSON safety: the browser's JSON.parse rejects NaN / Infinity, which Python's
# json module would otherwise emit. Every response goes through to_json().
# ---------------------------------------------------------------------------
def sanitize(obj):
    """Recursively convert numpy/pandas scalars to Python and non-finite numbers / NA to None."""
    import math
    try:
        import numpy as np
    except Exception:  # pragma: no cover
        np = None
    if obj is None or isinstance(obj, (bool, str)):
        return obj
    if isinstance(obj, dict):
        return {str(k): sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize(v) for v in obj]
    if np is not None:
        if isinstance(obj, np.ndarray):
            return [sanitize(v) for v in obj.tolist()]
        if isinstance(obj, np.bool_):
            return bool(obj)
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            obj = float(obj)
    if isinstance(obj, int):
        return obj
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    try:  # pandas.NA / NaT and other missing markers
        import pandas as pd
        if pd.isna(obj):
            return None
    except Exception:
        pass
    return str(obj)


def to_json(payload) -> bytes:
    return json.dumps(sanitize(payload), allow_nan=False).encode("utf-8")


# Ground-truth label normalisation (labels are handled separately from predictions)
LABEL_ALIASES = {
    "benign": "benign", "normal": "benign", "0": "benign",
    "dos attack": "DoS attack", "dos": "DoS attack", "dos_attack": "DoS attack", "dos-attack": "DoS attack",
    "replay": "Replay", "replay attack": "Replay", "replay_attack": "Replay",
    "attack": "attack", "malicious": "attack",   # binary ground truth (usable by the hybrid model only)
}


def clean_labels(raw):
    """Return (list of canonical label or None, status summary). Missing/unknown labels -> None."""
    import pandas as pd
    out, missing, invalid, invalid_values = [], 0, 0, {}
    for v in raw.tolist():
        if v is None or (not isinstance(v, str) and pd.isna(v)):
            out.append(None); missing += 1; continue
        t = str(v).strip()
        if t == "" or t.lower() in ("nan", "none", "null", "na", "n/a"):
            out.append(None); missing += 1; continue
        canon = LABEL_ALIASES.get(t.lower())
        if canon is None:
            out.append(None); invalid += 1
            invalid_values[t] = invalid_values.get(t, 0) + 1
            continue
        out.append(canon)
    return out, {"valid": len(out) - missing - invalid, "missing": missing, "invalid": invalid,
                 "invalid_examples": dict(sorted(invalid_values.items(), key=lambda kv: -kv[1])[:5])}


def predict_csv(text: str, which: str = "hybrid") -> dict:
    import numpy as np
    import pandas as pd

    if which == "hybrid":
        hm = STATE["hybrid"]
        features, classes, predict_proba = hm.features, hm.classes, hm.predict_proba
        model_name = hm.card["model"]
    else:
        bundle = STATE["model"]
        features, classes = bundle["features"], bundle["classes"]
        predict_proba = bundle["pipeline"].predict_proba
        model_name = STATE["metrics"]["model"]

    # ---------- 1. parse ----------
    if not text.strip():
        raise ValueError("The file is empty.")
    try:
        df = pd.read_csv(io.StringIO(text), dtype=str, low_memory=False, skip_blank_lines=True)
    except Exception as exc:
        raise ValueError(f"The file could not be read as CSV ({type(exc).__name__}). "
                         "Check that it is comma-separated with a header row.")
    df.columns = [str(c).strip() for c in df.columns]
    if df.columns.duplicated().any():
        dups = sorted(set(df.columns[df.columns.duplicated()]))
        raise ValueError("Duplicate column names in the header: " + ", ".join(dups[:8]))
    if df.empty:
        raise ValueError("The CSV has a header but no data rows.")
    if len(df) > MAX_ROWS:
        raise ValueError(f"Too many rows ({len(df):,}). The limit is {MAX_ROWS:,} rows per upload.")

    # ---------- 2. column validation ----------
    present = [f for f in features if f in df.columns]
    missing = [f for f in features if f not in df.columns]
    if len(present) < max(1, len(features) // 2):
        raise ValueError(
            f"This does not look like a UAV packet CSV: only {len(present)} of the {len(features)} required "
            f"packet columns were found. Missing: " + ", ".join(missing[:10]) + (" ..." if len(missing) > 10 else ""))

    # ---------- 3. separate ground-truth labels from features ----------
    label_col = next((c for c in df.columns if c.lower() == "class"), None)
    labels, label_summary = (None, None)

    # ---------- 4. numeric conversion + preprocessing checks ----------
    X = pd.DataFrame(index=df.index)
    non_numeric = {}
    for f in features:
        if f in df.columns:
            raw = df[f]
            col = pd.to_numeric(raw, errors="coerce")
            col = col.where(np.isfinite(col), np.nan)          # +/-inf -> missing -> imputed
            bad = int(col.isna().sum() - raw.isna().sum())
            if bad > 0:
                non_numeric[f] = bad
            X[f] = col.astype("float64")
        else:
            X[f] = np.nan  # imputed with the training median by the saved pipeline
    empty_rows = X.isna().all(axis=1)
    if empty_rows.all():
        raise ValueError("None of the rows contain usable numeric packet values for the required columns.")
    keep = ~empty_rows.values
    X = X.loc[keep]
    row_numbers = (np.flatnonzero(keep) + 2).tolist()      # +2 = 1-based + header line, matches the CSV line
    labels3 = None
    if label_col is not None:  # labels are cleaned only for rows that are actually predicted
        labels, label_summary = clean_labels(df[label_col][keep])
        if which == "hybrid":   # binary ground truth: DoS attack / Replay -> attack
            labels3 = labels
            labels = [None if l is None else ("benign" if l == "benign" else "attack") for l in labels]
        else:                   # a plain 'attack' label cannot be scored against a 3-class model
            n_bin = sum(1 for l in labels if l == "attack")
            if n_bin:
                labels = [None if l == "attack" else l for l in labels]
                label_summary["valid"] -= n_bin; label_summary["invalid"] += n_bin
                label_summary["invalid_examples"]["attack (binary label - use the Hybrid model)"] = n_bin
    extra = [c for c in df.columns if c not in features and c != label_col]

    # ---------- 5. real model prediction ----------
    prob = predict_proba(X)
    if not np.all(np.isfinite(prob)):
        raise ValueError("The model produced invalid probabilities for this file; check the input values.")
    idx = prob.argmax(1)
    pred = np.array([classes[i] for i in idx], dtype=object)
    conf = prob.max(1)
    counts = {c: int((pred == c).sum()) for c in classes}

    rows = []
    for i in range(len(X)):
        row = {"row": row_numbers[i], "prediction": pred[i], "confidence": round(float(conf[i]), 4),
               "probabilities": {c: round(float(prob[i, j]), 4) for j, c in enumerate(classes)}}
        if labels is not None:
            row["true_label"] = labels[i]          # None (-> JSON null) when missing/invalid
        rows.append(row)

    # ---------- 6. evaluation only on rows with a valid ground-truth label ----------
    evaluation = None
    if labels is not None:
        valid = np.array([l is not None for l in labels])
        n_valid = int(valid.sum())
        if n_valid > 0:
            from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                                         precision_recall_fscore_support, roc_auc_score)
            yt = np.array(labels, dtype=object)[valid]
            yp = pred[valid]
            pv = prob[valid]
            present_cls = [c for c in classes if (yt == c).any()]
            p_, r_, f_, s_ = precision_recall_fscore_support(yt, yp, labels=classes, zero_division=0)
            evaluation = {
                "rows_evaluated": n_valid,
                "classes_present": present_cls,
                "accuracy": accuracy_score(yt, yp),
                "macro_f1": f1_score(yt, yp, average="macro", labels=present_cls, zero_division=0),
                "per_class": {c: {"precision": p_[i], "recall": r_[i], "f1": f_[i], "support": int(s_[i])}
                              for i, c in enumerate(classes)},
                "confusion_matrix": confusion_matrix(yt, yp, labels=classes).tolist(),
                "macro_ovr_auc": None, "binary_auc": None, "auc_note": None,
            }
            # AUC is only defined when more than one class is present
            if which != "hybrid" and len(present_cls) == len(classes):   # multi-class AUC: RF only
                evaluation["macro_ovr_auc"] = roc_auc_score(yt, pv, labels=classes, multi_class="ovr", average="macro")
            b = classes.index("benign")
            yb = (yt != "benign").astype(int)
            if 0 < yb.sum() < len(yb):
                evaluation["binary_auc"] = roc_auc_score(yb, 1.0 - pv[:, b])
            if which == "hybrid":
                evaluation["macro_ovr_auc"] = None
                if evaluation["binary_auc"] is None:
                    evaluation["auc_note"] = "ROC AUC needs both benign and attack rows among the labelled rows."
                if labels3 is not None:   # which original attack types were caught / missed
                    l3 = np.array(labels3, dtype=object)[valid]
                    evaluation["by_true_3class"] = {c: {"predicted_benign": int(((l3 == c) & (yp == "benign")).sum()),
                                                        "predicted_attack": int(((l3 == c) & (yp == "attack")).sum())}
                                                    for c in ["benign", "DoS attack", "Replay"] if (l3 == c).any()}
            elif evaluation["macro_ovr_auc"] is None:
                evaluation["auc_note"] = ("Multi-class AUC needs all three classes in the labelled rows; "
                                          f"found only: {', '.join(present_cls)}.")

    # ---------- 7. user-facing notes ----------
    warnings = []
    if label_summary and (label_summary["missing"] or label_summary["invalid"]):
        msg = (f"{label_summary['missing']:,} row(s) have an empty class label"
               + (f" and {label_summary['invalid']:,} have an unrecognised label" if label_summary["invalid"] else "")
               + ". They still receive predictions but are excluded from accuracy / F1 / AUC.")
        if label_summary["invalid_examples"]:
            msg += " Unrecognised values: " + ", ".join(f"'{k}' ({v})" for k, v in label_summary["invalid_examples"].items())
        warnings.append(msg)
    if label_col is None:
        warnings.append("No 'class' column found - predictions only, no evaluation metrics.")
    if int(empty_rows.sum()):
        warnings.append(f"{int(empty_rows.sum()):,} row(s) had no usable packet values and were skipped.")
    if missing:
        warnings.append(f"{len(missing)} expected column(s) missing and imputed with training medians: "
                        + ", ".join(missing))
    if non_numeric:
        warnings.append("Non-numeric values treated as missing (imputed) in: "
                        + ", ".join(f"{k} ({v:,})" for k, v in list(non_numeric.items())[:8]))
    if extra:
        warnings.append(f"{len(extra)} unused column(s) ignored: " + ", ".join(extra[:8]))

    return {"ok": True, "model": model_name, "model_key": which, "classes": classes, "total": len(X),
            "uploaded_rows": int(len(df)), "skipped_rows": int(empty_rows.sum()),
            "counts": counts, "rows": rows, "labels": label_summary, "evaluation": evaluation,
            "warnings": warnings}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, fmt, *args):  # quieter console
        if "/api/" in (self.path or ""):
            super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        if (self.path or "").startswith("/api/"):   # allow the Vercel-hosted frontend to call this API
            self.send_header("Access-Control-Allow-Origin", os.environ.get("SEAQL_ALLOW_ORIGIN", "*"))
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def _json(self, code: int, payload: dict):
        try:
            body = to_json(payload)
        except Exception as exc:  # never send invalid JSON to the browser
            traceback.print_exc()
            code, body = 500, json.dumps({"ok": False, "error": f"Response encoding failed: {exc}"}).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/api/health"):
            return self._json(200, {"ok": True, "model_loaded": STATE["model"] is not None, "error": STATE["error"],
                                    "models": {"hybrid": {"status": STATE["hybrid_status"], "error": STATE["hybrid_error"]},
                                               "rf": {"status": "ready" if STATE["model"] is not None else ("error" if STATE["error"] else "loading"),
                                                      "error": STATE["error"]}}})
        if self.path.startswith("/api/models"):
            return self._json(200, {"ok": True,
                                    "hybrid": STATE["hybrid_card"] and {k: v for k, v in STATE["hybrid_card"].items() if k != "features"},
                                    "rf": STATE["metrics"]})
        if self.path.startswith("/api/model"):
            if "name=hybrid" in self.path:
                if STATE["hybrid"] is None:
                    return self._json(503, {"ok": False, "error": STATE["hybrid_error"] or "Hybrid model is still loading"})
                return self._json(200, {"ok": True, "metrics": STATE["hybrid_card"], "features": STATE["hybrid"].features})
            if STATE["model"] is None:
                return self._json(503, {"ok": False, "error": STATE["error"] or "Model is still loading"})
            return self._json(200, {"ok": True, "metrics": STATE["metrics"],
                                    "features": STATE["model"]["features"]})
        if self.path in ("/", ""):
            self.send_response(302)
            self.send_header("Location", "/dashboard.html")
            self.end_headers()
            return
        return super().do_GET()

    def do_OPTIONS(self):   # CORS pre-flight
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        if not self.path.startswith("/api/predict"):
            return self._json(404, {"ok": False, "error": "Unknown endpoint"})
        which = "rf" if "model=rf" in self.path else "hybrid"
        if which == "hybrid" and STATE["hybrid"] is None:
            msg = {"training": "The Hybrid model is being trained from the original research script - retry in a few minutes.",
                   "loading": "The Hybrid model is still loading, retry shortly."}.get(STATE["hybrid_status"])
            return self._json(503, {"ok": False, "error": msg or STATE["hybrid_error"] or "Hybrid model unavailable."})
        if which == "rf" and STATE["model"] is None:
            return self._json(503, {"ok": False, "error": STATE["error"] or "Model is still loading, retry shortly."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0:
            return self._json(400, {"ok": False, "error": "Empty upload."})
        if length > MAX_UPLOAD_BYTES:
            return self._json(413, {"ok": False, "error": "File too large (limit 25 MB)."})
        raw = self.rfile.read(length)
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            return self._json(400, {"ok": False, "error": "File is not UTF-8 text. Please upload a .csv file."})
        try:
            return self._json(200, predict_csv(text, which))
        except ValueError as exc:
            return self._json(422, {"ok": False, "error": str(exc)})
        except Exception as exc:
            traceback.print_exc()
            return self._json(500, {"ok": False, "error": f"Prediction failed: {exc}"})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)))
    ap.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"),
                    help="use 0.0.0.0 when hosting (Hugging Face / Render / Docker)")
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()
    threading.Thread(target=load_model, daemon=True).start()
    threading.Thread(target=load_hybrid, daemon=True).start()
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    url = f"http://localhost:{args.port}/dashboard.html"
    print(f"[SEAQL] Serving {ROOT}\n[SEAQL] Open {url}   (Ctrl+C to stop)")
    if not args.no_browser:
        threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n[SEAQL] Stopped.")


if __name__ == "__main__":
    main()
