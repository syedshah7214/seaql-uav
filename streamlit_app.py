"""SEAQL - AI Detection Lab (Streamlit edition).

Free hosted version of the Detection Lab for Streamlit Community Cloud.
It runs the SAME saved models and the SAME prediction code as backend/server.py
(predict_csv is imported, not re-implemented), so results match the local dashboard.

Run locally:   streamlit run streamlit_app.py
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import altair as alt
import pandas as pd
import streamlit as st

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
SAMPLES = ROOT / "app" / "samples"
WEBSITE = "https://seaql-uav.vercel.app"
sys.path.insert(0, str(BACKEND))

import server as SV  # noqa: E402  (stdlib-only at import time; nothing is started)

st.set_page_config(page_title="SEAQL · AI Detection Lab", page_icon="🛡️", layout="wide",
                   initial_sidebar_state="expanded")

CYAN, EMERALD, RED, AMBER, PURPLE = "#22D3EE", "#34D399", "#FF5A76", "#FBBF24", "#8B5CF6"
CLASS_COLORS = {"benign": EMERALD, "attack": RED, "DoS attack": RED, "Replay": AMBER}

st.markdown(f"""
<style>
  .stApp {{ background: radial-gradient(1200px 600px at 10% -10%, rgba(34,211,238,.10), transparent 60%),
                       radial-gradient(900px 500px at 100% 0%, rgba(52,211,153,.08), transparent 60%), #071018; }}
  .block-container {{ padding-top: 2rem; max-width: 1400px; }}
  h1, h2, h3 {{ letter-spacing: -.01em; }}
  .seaql-hero h1 {{ font-size: 2.3rem; margin: 0; background: linear-gradient(90deg,{CYAN},{EMERALD});
                   -webkit-background-clip: text; background-clip: text; color: transparent; }}
  .seaql-hero p {{ color: #B4C1DA; margin: .35rem 0 0; }}
  .tag {{ display:inline-block; padding:2px 10px; border-radius:999px; font-size:.72rem; font-weight:700;
          letter-spacing:.06em; text-transform:uppercase; margin-right:6px; border:1px solid; }}
  .tag.real {{ color:{EMERALD}; border-color:rgba(52,211,153,.45); background:rgba(52,211,153,.08); }}
  .tag.ver  {{ color:{CYAN}; border-color:rgba(34,211,238,.45); background:rgba(34,211,238,.08); }}
  .tag.sim  {{ color:{AMBER}; border-color:rgba(251,191,36,.45); background:rgba(251,191,36,.08); }}
  div[data-testid="stMetric"] {{ background: rgba(19,35,65,.55); border:1px solid rgba(34,211,238,.18);
          border-radius:14px; padding:14px 16px; }}
  div[data-testid="stMetricValue"] {{ color:#F5F9FF; }}
  .pipe {{ display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:.4rem 0 1rem; }}
  .pipe span {{ padding:6px 12px; border-radius:10px; background:rgba(19,35,65,.7); border:1px solid rgba(34,211,238,.25);
               color:#DDE7F7; font-size:.85rem; }}
  .pipe b {{ color:{CYAN}; }}
</style>
""", unsafe_allow_html=True)


# ---------------------------------------------------------------- model loading
@st.cache_resource(show_spinner="Loading the saved SEAQL models (first start takes about a minute)...")
def load_models():
    import hybrid_model as HM
    SV.STATE["hybrid"] = HM.HybridModel()
    SV.STATE["hybrid_card"] = SV.STATE["hybrid"].card
    SV.STATE["hybrid_status"] = "ready"
    SV.load_model()                      # Random Forest baseline (same loader as the local server)
    return {"hybrid": SV.STATE["hybrid"], "rf_ok": SV.STATE["model"] is not None, "rf_error": SV.STATE["error"]}


def ensure_state(models):
    # Streamlit re-runs the script; make sure the server module sees the cached models.
    SV.STATE["hybrid"] = models["hybrid"]
    SV.STATE["hybrid_status"] = "ready"
    if SV.STATE["model"] is None and models["rf_ok"]:
        SV.load_model()


@st.cache_data(show_spinner=False, max_entries=8)
def run_prediction(text: str, which: str) -> dict:
    return SV.sanitize(SV.predict_csv(text, which))


MODEL_LABEL = {"hybrid": "Hybrid AE-Stacked Ensemble (binary)", "rf": "Random Forest baseline (3-class)"}
SAMPLE_FILES = {
    "Hybrid held-out test sample (labelled)": "hybrid_heldout_test_sample.csv",
    "Full Hybrid held-out test set · 6,621 rows (labelled)": "hybrid_heldout_full_6621.csv",
    "UAV traffic sample (labelled, 3-class)": "uav_traffic_test_sample.csv",
    "UAV traffic sample (no labels)": "uav_traffic_unlabeled_sample.csv",
}


def pct(v):
    return "—" if v is None else f"{v * 100:.2f}%"


def confusion_chart(ev: dict, classes: list[str]):
    cm = ev["confusion_matrix"]
    rows = [{"True": t, "Predicted": p, "Count": cm[i][j]} for i, t in enumerate(classes) for j, p in enumerate(classes)]
    df = pd.DataFrame(rows)
    base = alt.Chart(df).encode(x=alt.X("Predicted:N", sort=classes), y=alt.Y("True:N", sort=classes))
    heat = base.mark_rect(cornerRadius=6).encode(
        color=alt.Color("Count:Q", scale=alt.Scale(range=["#0d2236", CYAN]), legend=None),
        tooltip=["True", "Predicted", "Count"])
    text = base.mark_text(fontSize=18, fontWeight="bold", color="white").encode(text="Count:Q")
    return (heat + text).properties(height=90 * len(classes) + 40)


def counts_chart(counts: dict):
    df = pd.DataFrame({"Class": list(counts), "Rows": list(counts.values())})
    return alt.Chart(df).mark_bar(cornerRadiusEnd=6).encode(
        x=alt.X("Rows:Q"), y=alt.Y("Class:N", sort="-x", title=None),
        color=alt.Color("Class:N", scale=alt.Scale(domain=list(CLASS_COLORS), range=list(CLASS_COLORS.values())), legend=None),
        tooltip=["Class", "Rows"]).properties(height=60 * len(df) + 30)


def confidence_chart(rows: list[dict]):
    df = pd.DataFrame({"confidence": [r["confidence"] for r in rows], "prediction": [r["prediction"] for r in rows]})
    return alt.Chart(df).mark_bar(opacity=.85).encode(
        x=alt.X("confidence:Q", bin=alt.Bin(maxbins=20), title="Model confidence"),
        y=alt.Y("count():Q", title="Rows"),
        color=alt.Color("prediction:N", scale=alt.Scale(domain=list(CLASS_COLORS), range=list(CLASS_COLORS.values())),
                        legend=alt.Legend(orient="top", title=None))).properties(height=230)


def show_result(res: dict, key: str):
    classes = res["classes"]
    st.markdown(f'<span class="tag real">Real model output</span> <b>{res["model"]}</b>', unsafe_allow_html=True)
    c = st.columns(4)
    c[0].metric("Rows predicted", f'{res["total"]:,}')
    attack_rows = sum(v for k, v in res["counts"].items() if k != "benign")
    c[1].metric("Benign", f'{res["counts"].get("benign", 0):,}')
    c[2].metric("Attack" if key == "hybrid" else "Attack (DoS + Replay)", f"{attack_rows:,}")
    mean_conf = sum(r["confidence"] for r in res["rows"]) / max(1, len(res["rows"]))
    c[3].metric("Mean confidence", pct(mean_conf))

    for w in res.get("warnings") or []:
        st.info(w)

    ev = res.get("evaluation")
    left, right = st.columns([1, 1])
    with left:
        st.markdown("##### Predicted classes")
        st.altair_chart(counts_chart(res["counts"]), width="stretch")
        st.markdown("##### Confidence distribution")
        st.altair_chart(confidence_chart(res["rows"]), width="stretch")
    with right:
        if ev:
            st.markdown(f'##### Evaluation on {ev["rows_evaluated"]:,} labelled rows')
            m = st.columns(3)
            m[0].metric("Accuracy", pct(ev["accuracy"]))
            m[1].metric("Macro F1", pct(ev["macro_f1"]))
            auc = ev.get("binary_auc") if key == "hybrid" else (ev.get("macro_ovr_auc") or ev.get("binary_auc"))
            m[2].metric("ROC AUC" if key == "hybrid" else "AUC", pct(auc))
            st.markdown("##### Confusion matrix (rows = true, columns = predicted)")
            st.altair_chart(confusion_chart(ev, classes), width="stretch")
            if ev.get("auc_note"):
                st.caption(ev["auc_note"])
            if ev.get("by_true_3class"):
                st.markdown("##### Which attack types were caught")
                bt = pd.DataFrame(ev["by_true_3class"]).T.rename(columns={"predicted_benign": "→ benign", "predicted_attack": "→ attack"})
                st.dataframe(bt, width="stretch")
        else:
            st.markdown("##### Evaluation")
            st.caption("This file has no `class` column, so only predictions are shown (no accuracy / F1 / AUC).")

    table = pd.DataFrame([{"CSV line": r["row"], "Prediction": r["prediction"], "Confidence": r["confidence"],
                           **{f"P({k})": v for k, v in r["probabilities"].items()},
                           **({"True label": r.get("true_label")} if "true_label" in r else {})} for r in res["rows"]])
    st.markdown("##### Row-level predictions")
    st.dataframe(table.head(1000), width="stretch", height=320, hide_index=True)
    if len(table) > 1000:
        st.caption(f"Showing the first 1,000 of {len(table):,} rows. The download has all rows.")
    st.download_button("Download all predictions (CSV)", table.to_csv(index=False).encode("utf-8"),
                       file_name=f"seaql_{key}_predictions.csv", mime="text/csv", key=f"dl_{key}")


# ---------------------------------------------------------------- page
st.markdown(f"""
<div class="seaql-hero">
  <span class="tag real">Live · real model</span><span class="tag ver">SEAQL FYP</span>
  <h1>AI Detection Lab</h1>
  <p>Upload UAV packet data (CSV) and the trained SEAQL models classify every row as <b>Benign</b> or <b>Attack</b>.
     Same saved models and the same prediction code as the SEAQL dashboard backend.</p>
</div>
<div class="pipe"><span><b>1</b> CSV upload</span>→<span><b>2</b> column &amp; value checks</span>→
<span><b>3</b> preprocessing</span>→<span><b>4</b> autoencoder features</span>→<span><b>5</b> stacked ensemble</span>→
<span><b>6</b> Benign / Attack</span></div>
""", unsafe_allow_html=True)

models = load_models()
ensure_state(models)

with st.sidebar:
    st.markdown("### 🛡️ SEAQL")
    st.caption("Scalable, Explainable and Adaptive Quantum-Resilient Federated Learning for UAV Swarm Cybersecurity")
    mode = st.radio("Model", ["Hybrid AE-Stacked Ensemble", "Random Forest baseline", "Compare both"], index=0)
    st.divider()
    src = st.radio("Data", ["Use a sample file", "Upload my CSV"], index=0)
    text, fname = None, None
    if src == "Use a sample file":
        pick = st.selectbox("Sample", list(SAMPLE_FILES))
        fname = SAMPLE_FILES[pick]
        text = (SAMPLES / fname).read_text(encoding="utf-8")
    else:
        up = st.file_uploader("UAV packet CSV (header row, up to 100,000 rows)", type=["csv"])
        if up is not None:
            fname = up.name
            text = up.getvalue().decode("utf-8", errors="replace")
    st.divider()
    st.link_button("Open the full SEAQL dashboard", WEBSITE, width="stretch")
    st.caption("Team: Syed Measum Shah · Arooba Mansoor (03-135231-009)\n\nSupervisor: Ms. Munaza Sher\n\nBahria University, Lahore Campus · BSIT")

tab_run, tab_card = st.tabs(["Run detection", "Recorded research results"])

with tab_run:
    if text is None:
        st.info("Choose a sample file or upload a CSV in the left panel.")
    else:
        st.caption(f"File: **{fname}** · {len(text.splitlines()) - 1:,} data lines")
        keys = {"Hybrid AE-Stacked Ensemble": ["hybrid"], "Random Forest baseline": ["rf"], "Compare both": ["hybrid", "rf"]}[mode]
        if "rf" in keys and not models["rf_ok"]:
            st.error(f"Random Forest baseline is not available: {models['rf_error']}")
            keys = [k for k in keys if k != "rf"]
        results = {}
        for k in keys:
            try:
                with st.spinner(f"Running {MODEL_LABEL[k]} ..."):
                    results[k] = run_prediction(text, k)
            except ValueError as exc:
                st.error(str(exc))
            except Exception as exc:  # pragma: no cover
                st.error(f"Prediction failed ({type(exc).__name__}): {exc}")
        if len(results) == 2:
            st.markdown("#### Hybrid vs Random Forest on this file")
            comp = []
            for k, r in results.items():
                ev = r.get("evaluation") or {}
                comp.append({"Model": MODEL_LABEL[k], "Rows": r["total"],
                             "Predicted attack": sum(v for c, v in r["counts"].items() if c != "benign"),
                             "Accuracy": pct(ev.get("accuracy")), "Macro F1": pct(ev.get("macro_f1")),
                             "Benign-vs-attack AUC": pct(ev.get("binary_auc"))})
            st.dataframe(pd.DataFrame(comp), width="stretch", hide_index=True)
            st.caption("The Hybrid model is binary (benign / attack). The Random Forest predicts 3 classes "
                       "(benign / DoS attack / Replay), so its accuracy is on a harder task; the benign-vs-attack AUC "
                       "compares both on the same question. Note: the Random Forest was trained on a different data split, so some "
                       "rows of the Hybrid held-out files may be in its training data; for a fair comparison use the "
                       "recorded held-out results tab.")
            t1, t2 = st.tabs([MODEL_LABEL["hybrid"], MODEL_LABEL["rf"]])
            with t1: show_result(results["hybrid"], "hybrid")
            with t2: show_result(results["rf"], "rf")
        elif results:
            k = next(iter(results))
            show_result(results[k], k)

with tab_card:
    card = models["hybrid"].card
    hm = card["heldout_metrics"]
    st.markdown('<span class="tag ver">Verified · held-out test set</span> Recorded when the model was trained '
                f'({card["split"]["test"]:,} held-out rows, seed {card["split"]["seed"]}).', unsafe_allow_html=True)
    c = st.columns(4)
    c[0].metric("Accuracy", pct(hm["accuracy"]))
    c[1].metric("Macro F1", pct(hm["macro_f1"]))
    c[2].metric("ROC AUC", pct(hm["auc"]))
    c[3].metric("Balanced accuracy", pct(hm["balanced_accuracy"]))
    cm = card["heldout_confusion_matrix"]
    st.altair_chart(confusion_chart({"confusion_matrix": cm["matrix"]}, cm["labels"]), width="stretch")
    try:
        rf = json.loads((BACKEND / "models" / "model_metrics.json").read_text())
        st.markdown("##### Random Forest baseline (3-class, held-out)")
        r = st.columns(3)
        r[0].metric("Accuracy", pct(rf["accuracy"]))
        r[1].metric("Macro F1", pct(rf["macro_f1"]))
        r[2].metric("Macro OvR AUC", pct(rf["macro_ovr_auc"]))
    except Exception:
        pass
    st.markdown("##### Architecture")
    a = card["architecture"]
    st.write(f'- **Autoencoder:** {a["autoencoder"]}\n- **Base learners:** {", ".join(a["base_learners"])}\n'
             f'- **Meta learner:** {a["meta_learner"]} ({a["stacking_cv"]}-fold stacking)\n'
             f'- **SMOTE:** {card["smote"]["applied_to"]}')
    st.caption("Not implemented in this demo (future work): SHAP explanations, post-quantum cryptography in the FL loop.")
