"""SEAQL - AI Detection Lab (Streamlit edition).

Free hosted version of the Detection Lab for Streamlit Community Cloud.
It runs the SAME saved models and the SAME prediction code as backend/server.py
(predict_csv is imported, not re-implemented), so results match the local dashboard.
The look follows the SEAQL dashboard's "Room 03 · AI Diagnostic Laboratory" (cyan + emerald).

Run locally:   streamlit run streamlit_app.py
"""
from __future__ import annotations

import html
import json
import sys
import time
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
import streamlit.components.v1 as components  # noqa: E402
from live_stream import live_stream_html  # noqa: E402

st.set_page_config(page_title="SEAQL · AI Detection Lab", page_icon="🛡️", layout="wide",
                   initial_sidebar_state="collapsed")

# ------------------------------------------------------------------ palette (same tokens as app/css/app.css)
BG, PANEL_LINE, TEXT, TEXT2, TEXT3 = "#080E20", "rgba(120,150,220,.16)", "#F5F9FF", "#AEBBD3", "#7186A8"
CYAN, EMERALD, RED, AMBER, VIOLET = "#22D3EE", "#34D399", "#FF5A76", "#FBBF24", "#8B5CF6"
CLASS_COLORS = {"benign": EMERALD, "attack": RED, "DoS attack": RED, "Replay": AMBER}
NICE = {"benign": "Benign", "attack": "Attack", "DoS attack": "DoS attack", "Replay": "Replay"}

ICON = {  # small inline lucide-style icons
    "scan": '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/>',
    "rows": '<path d="M3 5h18M3 12h18M3 19h18"/>',
    "shield": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    "alert": '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z"/><path d="M12 9v4M12 17h.01"/>',
    "gauge": '<path d="m12 14 4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
    "target": '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    "f1": '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    "auc": '<path d="M3 3v18h18"/><path d="M4 20C8 6 14 4 21 4"/>',
    "brain": '<path d="M12 5a3 3 0 1 0-5.9.8A4 4 0 0 0 4 13a4 4 0 0 0 4 6h1V5zM12 5a3 3 0 1 1 5.9.8A4 4 0 0 1 20 13a4 4 0 0 1-4 6h-1V5z"/>',
    "trees": '<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0z"/><path d="M7 16v6M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>',
    "check": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    "ext": '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
}


def icon(name: str, size: int = 18) -> str:
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{ICON[name]}</svg>')


def esc(v) -> str:
    return html.escape(str(v))


st.markdown(f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
:root {{ --cyan:{CYAN}; --em:{EMERALD}; --red:{RED}; --amber:{AMBER}; --line:{PANEL_LINE}; --line2:rgba(125,160,235,.28);
        --text:{TEXT}; --text2:{TEXT2}; --text3:{TEXT3}; }}
html, body, [class*="css"], .stApp, button, input, textarea, select {{ font-family: Inter, system-ui, sans-serif !important; }}
.stApp {{
  background:
    radial-gradient(1100px 520px at 8% -8%, rgba(34,211,238,.14), transparent 60%),
    radial-gradient(900px 520px at 100% 0%, rgba(16,185,129,.13), transparent 60%),
    radial-gradient(800px 600px at 50% 120%, rgba(34,211,238,.06), transparent 60%),
    radial-gradient(rgba(140,170,230,.07) 1px, transparent 1px) 0 0/22px 22px,
    {BG};
  color: var(--text);
}}
header[data-testid="stHeader"], div[data-testid="stToolbar"], div[data-testid="stDecoration"], footer {{ display:none !important; }}
section[data-testid="stSidebar"], div[data-testid="stSidebarCollapsedControl"] {{ display:none !important; }}
.block-container {{ padding: 1.4rem 2rem 2.5rem !important; max-width: 1480px; }}
h1,h2,h3,h4,h5 {{ color: var(--text); letter-spacing:-.01em; }}
p, li, label, .stMarkdown {{ color: var(--text2); }}
code {{ font-family: 'JetBrains Mono', monospace !important; }}

/* ---------- glass panels (st.container(key=...)) ---------- */
[class*="st-key-deck"], [class*="st-key-charts"], [class*="st-key-table"], [class*="st-key-cmp"], [class*="st-key-research"] {{
  position:relative; background:linear-gradient(180deg,rgba(22,36,70,.70),rgba(13,21,44,.74));
  border:1px solid var(--line); border-radius:18px; padding:18px 20px 16px;
  box-shadow:0 18px 40px -18px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.03);
}}
[class*="st-key-deck"]::before, [class*="st-key-charts"]::before, [class*="st-key-table"]::before, [class*="st-key-cmp"]::before, [class*="st-key-research"]::before {{
  content:""; position:absolute; left:22px; right:22px; top:0; height:1px;
  background:linear-gradient(90deg,transparent,var(--cyan),var(--em),transparent); opacity:.85;
}}
.ph {{ display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:10px; }}
.ph h3 {{ font-size:1.02rem; font-weight:700; margin:0; color:var(--text); }}
.ph p {{ margin:3px 0 0; font-size:.78rem; color:var(--text3); }}
.tag {{ display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-size:.66rem; font-weight:700;
        letter-spacing:.09em; text-transform:uppercase; border:1px solid; white-space:nowrap; font-family:'JetBrains Mono',monospace; }}
.tag.real {{ color:var(--em); border-color:rgba(52,211,153,.45); background:rgba(52,211,153,.08); }}
.tag.ver  {{ color:var(--cyan); border-color:rgba(34,211,238,.45); background:rgba(34,211,238,.08); }}
.tag.sim  {{ color:var(--amber); border-color:rgba(251,191,36,.45); background:rgba(251,191,36,.08); }}

/* ---------- room banner ---------- */
.room {{ position:relative; overflow:hidden; border-radius:20px; padding:22px 26px; margin-bottom:16px;
  border:1px solid rgba(34,211,238,.28);
  background: radial-gradient(600px 240px at 0% 0%, rgba(34,211,238,.16), transparent 70%),
              radial-gradient(600px 260px at 100% 100%, rgba(16,185,129,.14), transparent 70%),
              linear-gradient(180deg, rgba(10,34,52,.85), rgba(8,20,40,.9));
  box-shadow:0 0 0 1px rgba(52,211,153,.08), 0 24px 60px -30px rgba(34,211,238,.5); }}
.room::after {{ content:""; position:absolute; inset:0; pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(94,234,212,.08),transparent); transform:translateX(-100%); animation:sweep 7s ease-in-out infinite; }}
@keyframes sweep {{ 0%,15% {{transform:translateX(-100%)}} 60%,100% {{transform:translateX(100%)}} }}
.room-grid {{ display:grid; grid-template-columns:minmax(0,1.05fr) minmax(0,1fr); gap:24px; align-items:center; position:relative; z-index:1; }}
.kicker {{ display:flex; align-items:center; gap:8px; color:#5EEAD4; font-family:'JetBrains Mono',monospace; font-size:.72rem; font-weight:600; letter-spacing:.2em; text-transform:uppercase; }}
.room h1 {{ margin:.45rem 0 .25rem; font-size:2.15rem; font-weight:800; line-height:1.1;
  background:linear-gradient(92deg,#F5F9FF 10%,#A5F3FC 45%,#6EE7B7 90%); -webkit-background-clip:text; background-clip:text; color:transparent; }}
.room .lead {{ margin:0 0 .8rem; color:var(--text2); font-size:.92rem; line-height:1.55; max-width:640px; }}
.pills {{ display:flex; flex-wrap:wrap; gap:8px; }}
.pill {{ display:inline-flex; align-items:center; gap:7px; padding:6px 12px; border-radius:999px; font-size:.76rem; font-weight:600;
  color:var(--text); border:1px solid var(--line2); background:rgba(13,22,46,.7); }}
.pill .d {{ width:7px; height:7px; border-radius:50%; background:var(--em); box-shadow:0 0 0 3px rgba(52,211,153,.18), 0 0 10px var(--em); animation:pulse 2.2s infinite; }}
@keyframes pulse {{ 50% {{ box-shadow:0 0 0 6px rgba(52,211,153,0), 0 0 14px var(--em); }} }}

/* pipeline */
.pipe {{ position:relative; display:grid; grid-template-columns:repeat(6,1fr); gap:6px; padding:14px 6px 4px; }}
.pipe::before {{ content:""; position:absolute; left:8%; right:8%; top:31px; height:2px; border-radius:2px;
  background:linear-gradient(90deg,rgba(34,211,238,.25),rgba(52,211,153,.35)); }}
.pipe .run {{ position:absolute; top:27px; left:8%; width:10px; height:10px; border-radius:50%; background:#fff;
  box-shadow:0 0 12px 3px rgba(94,234,212,.9); animation:travel 4.8s cubic-bezier(.6,0,.4,1) infinite; }}
@keyframes travel {{ 0% {{left:8%; opacity:0}} 8% {{opacity:1}} 92% {{opacity:1}} 100% {{left:91%; opacity:0}} }}
.node {{ display:flex; flex-direction:column; align-items:center; gap:8px; position:relative; z-index:1; }}
.node i {{ width:34px; height:34px; border-radius:50%; display:grid; place-items:center; color:#A5F3FC;
  background:radial-gradient(circle at 50% 40%, rgba(34,211,238,.35), rgba(8,30,44,.95) 70%);
  border:1.5px solid rgba(34,211,238,.7); box-shadow:0 0 16px -2px rgba(34,211,238,.7); font-style:normal; }}
.node i::after {{ content:""; width:8px; height:8px; border-radius:50%; background:currentColor; }}
.node:last-child i {{ color:#6EE7B7; border-color:rgba(52,211,153,.8); box-shadow:0 0 18px -2px rgba(52,211,153,.8); }}
.node span {{ font-family:'JetBrains Mono',monospace; font-size:.64rem; color:var(--text2); text-align:center; line-height:1.3; }}

/* ---------- KPI cards ---------- */
.kpis {{ display:grid; grid-template-columns:repeat(var(--n,4),minmax(0,1fr)); gap:12px; margin:4px 0 6px; }}
.kpi {{ position:relative; overflow:hidden; border-radius:16px; padding:14px 16px 13px; border:1px solid var(--line);
  background:linear-gradient(180deg,rgba(20,36,68,.85),rgba(12,22,44,.85)); }}
.kpi::before {{ content:""; position:absolute; left:0; right:0; top:0; height:2px; background:var(--c,var(--cyan)); box-shadow:0 0 14px var(--c,var(--cyan)); }}
.kpi::after {{ content:""; position:absolute; right:-30px; top:-30px; width:110px; height:110px; border-radius:50%;
  background:radial-gradient(circle, color-mix(in srgb, var(--c,var(--cyan)) 28%, transparent), transparent 70%); }}
.kpi .k-top {{ display:flex; align-items:center; justify-content:space-between; color:var(--text3); font-size:.7rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase; }}
.kpi .k-ic {{ color:var(--c,var(--cyan)); opacity:.95; }}
.kpi .k-v {{ margin-top:8px; font-size:1.85rem; font-weight:800; color:var(--text); letter-spacing:-.02em; text-shadow:0 0 22px color-mix(in srgb, var(--c,var(--cyan)) 45%, transparent); }}
.kpi .k-s {{ margin-top:2px; font-size:.74rem; color:var(--text3); }}

/* ---------- verdict ---------- */
.verdict {{ display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:18px; align-items:center; border-radius:18px; padding:18px 22px; margin:2px 0 14px;
  border:1px solid color-mix(in srgb, var(--vc) 50%, transparent);
  background:radial-gradient(500px 160px at 0% 50%, color-mix(in srgb, var(--vc) 20%, transparent), transparent 70%), linear-gradient(180deg,rgba(18,28,54,.9),rgba(10,18,38,.92));
  box-shadow:0 0 34px -14px var(--vc); }}
.verdict .v-ic {{ width:56px; height:56px; border-radius:16px; display:grid; place-items:center; color:var(--vc);
  background:color-mix(in srgb, var(--vc) 14%, transparent); border:1px solid color-mix(in srgb, var(--vc) 45%, transparent); }}
.verdict .v-k {{ font-family:'JetBrains Mono',monospace; font-size:.7rem; letter-spacing:.18em; color:var(--vc); font-weight:700; text-transform:uppercase; }}
.verdict .v-t {{ font-size:1.35rem; font-weight:800; color:var(--text); margin:3px 0 2px; }}
.verdict .v-s {{ font-size:.82rem; color:var(--text2); }}
.split {{ height:10px; border-radius:99px; overflow:hidden; display:flex; background:rgba(255,255,255,.06); margin-top:10px; }}
.split b {{ display:block; height:100%; }}
.verdict .v-n {{ text-align:right; }}
.verdict .v-n div {{ font-size:2.1rem; font-weight:800; color:var(--vc); line-height:1; }}
.verdict .v-n small {{ color:var(--text3); font-size:.72rem; }}

/* ---------- compare cards ---------- */
.mcards {{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }}
.mcard {{ border-radius:16px; padding:16px; border:1px solid var(--line); background:linear-gradient(180deg,rgba(20,36,68,.8),rgba(12,22,44,.8)); }}
.mcard.win {{ border-color:rgba(52,211,153,.6); box-shadow:0 0 0 1px rgba(52,211,153,.25), 0 0 30px -10px rgba(52,211,153,.6); }}
.mcard .mh {{ display:flex; align-items:center; gap:10px; margin-bottom:12px; }}
.mcard .mi {{ width:38px; height:38px; border-radius:11px; display:grid; place-items:center; color:#5EEAD4; background:linear-gradient(145deg,rgba(34,211,238,.2),rgba(52,211,153,.12)); }}
.mcard b {{ color:var(--text); }}
.mrow {{ display:grid; grid-template-columns:130px 1fr 64px; gap:10px; align-items:center; margin:8px 0; font-size:.8rem; color:var(--text2); }}
.mbar {{ height:8px; border-radius:99px; background:rgba(255,255,255,.06); overflow:hidden; }}
.mbar i {{ display:block; height:100%; border-radius:99px; background:linear-gradient(90deg,var(--cyan),var(--em)); }}
.mrow span:last-child {{ font-family:'JetBrains Mono',monospace; color:var(--text); text-align:right; }}

/* ---------- native widgets ---------- */
div[data-testid="stFileUploaderDropzone"] {{ border:1.5px dashed rgba(52,211,153,.55) !important; border-radius:14px !important;
  background:radial-gradient(400px 120px at 50% 0%,rgba(34,211,238,.12),transparent 70%),linear-gradient(180deg,rgba(6,40,44,.35),rgba(6,24,30,.25)) !important; }}
div[data-testid="stFileUploaderDropzone"] svg {{ color:var(--em) !important; }}
div[data-testid="stFileUploaderDropzone"] button {{ border-radius:10px !important; }}
div[data-baseweb="select"] > div {{ background:rgba(13,22,46,.85) !important; border-color:var(--line2) !important; border-radius:11px !important; }}
div[data-testid="stSegmentedControl"] button, button[kind="segmented_control"], button[kind="segmented_controlActive"] {{ border-radius:10px !important; }}
button[kind="segmented_controlActive"] {{ background:linear-gradient(135deg,rgba(34,211,238,.25),rgba(52,211,153,.2)) !important; border-color:rgba(52,211,153,.7) !important; color:#fff !important; box-shadow:0 0 18px -6px rgba(52,211,153,.8); }}
div[data-testid="stWidgetLabel"] p {{ color:var(--text3) !important; font-size:.7rem !important; font-weight:700 !important; letter-spacing:.12em; text-transform:uppercase; }}
.stDownloadButton button, .stLinkButton a {{ border-radius:11px !important; border:1px solid rgba(52,211,153,.55) !important;
  background:linear-gradient(135deg,rgba(34,211,238,.18),rgba(52,211,153,.16)) !important; color:#fff !important; font-weight:600 !important; }}
div[data-testid="stDataFrame"] {{ border:1px solid var(--line); border-radius:14px; overflow:hidden; }}
div[data-testid="stAlert"] {{ background:rgba(34,211,238,.07) !important; border:1px solid rgba(34,211,238,.25) !important; border-radius:12px !important; }}
.note {{ font-size:.78rem; color:var(--text3); line-height:1.5; }}
.foot {{ display:flex; flex-wrap:wrap; justify-content:space-between; gap:10px; margin-top:22px; padding-top:14px; border-top:1px solid var(--line); font-size:.76rem; color:var(--text3); }}
.foot a {{ color:#5EEAD4; text-decoration:none; }}
.status {{ display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin:2px 0 12px; font-size:.8rem; color:var(--text2); }}
.status code {{ color:#A5F3FC; background:rgba(34,211,238,.08); padding:2px 8px; border-radius:7px; }}

@media (max-width: 900px) {{
  .room-grid, .mcards {{ grid-template-columns:1fr; }}
  .kpis {{ grid-template-columns:repeat(2,minmax(0,1fr)); }}
  .verdict {{ grid-template-columns:auto 1fr; }} .verdict .v-n {{ grid-column:1/-1; text-align:left; }}
  .room h1 {{ font-size:1.6rem; }} .block-container {{ padding:1rem .9rem 2rem !important; }}
}}
@media (prefers-reduced-motion: reduce) {{ *, *::before, *::after {{ animation:none !important; transition:none !important; }} }}
</style>
""", unsafe_allow_html=True)


# ------------------------------------------------------------------ charts theme
def _theme():
    return {"config": {
        "background": "transparent", "view": {"stroke": "transparent"},
        "font": "Inter",
        "axis": {"labelColor": TEXT2, "titleColor": TEXT3, "gridColor": "rgba(120,150,220,.12)", "domainColor": "rgba(120,150,220,.25)",
                 "tickColor": "rgba(120,150,220,.25)", "labelFontSize": 11, "titleFontSize": 11, "titleFontWeight": 600},
        "legend": {"labelColor": TEXT2, "titleColor": TEXT3, "labelFontSize": 11, "symbolType": "circle"},
        "title": {"color": TEXT, "fontSize": 13}}}


try:
    alt.theme.register("seaql", enable=True)(_theme)
except Exception:  # older Altair
    alt.themes.register("seaql", _theme)
    alt.themes.enable("seaql")

# ------------------------------------------------------------------ model loading (unchanged logic)
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
    t0 = time.perf_counter()
    res = SV.sanitize(SV.predict_csv(text, which))
    res["_seconds"] = round(time.perf_counter() - t0, 2)
    return res


MODEL_LABEL = {"hybrid": "Hybrid AE-Stacked Ensemble", "rf": "Random Forest baseline"}
MODEL_SUB = {"hybrid": "FYP model · binary benign / attack", "rf": "baseline · 3-class benign / DoS / Replay"}
SAMPLE_FILES = {
    "Hybrid held-out test sample · 2,000 labelled rows": "hybrid_heldout_test_sample.csv",
    "Full Hybrid held-out test set · 6,621 labelled rows": "hybrid_heldout_full_6621.csv",
    "UAV traffic sample · labelled, 3-class": "uav_traffic_test_sample.csv",
    "UAV traffic sample · no labels": "uav_traffic_unlabeled_sample.csv",
}


def pct(v, d=2):
    return "—" if v is None else f"{v * 100:.{d}f}%"


def num(v):
    return f"{v:,}"


def kpis(cards: list[tuple]) -> str:
    out = "".join(f'<div class="kpi" style="--c:{c}"><div class="k-top"><span>{esc(l)}</span><span class="k-ic">{icon(ic)}</span></div>'
                  f'<div class="k-v">{esc(v)}</div><div class="k-s">{esc(s)}</div></div>' for l, v, s, c, ic in cards)
    return f'<div class="kpis" style="--n:{len(cards)}">{out}</div>'


def panel_head(title: str, sub: str = "", tag: str = "") -> None:
    st.markdown(f'<div class="ph"><div><h3>{esc(title)}</h3>{f"<p>{sub}</p>" if sub else ""}</div>{tag}</div>',
                unsafe_allow_html=True)


# ------------------------------------------------------------------ charts
def donut(counts: dict):
    df = pd.DataFrame({"Class": [NICE.get(k, k) for k in counts], "key": list(counts), "Rows": list(counts.values())})
    df = df[df.Rows > 0]
    present = [k for k in CLASS_COLORS if k in set(df.key)]
    dom = [NICE.get(k, k) for k in present]
    base = alt.Chart(df).encode(theta=alt.Theta("Rows:Q", stack=True),
                                color=alt.Color("Class:N", scale=alt.Scale(domain=dom, range=[CLASS_COLORS[k] for k in present]),
                                                legend=alt.Legend(orient="bottom", title=None, direction="horizontal")),
                                tooltip=["Class", alt.Tooltip("Rows:Q", format=",")])
    ring = base.mark_arc(innerRadius=68, outerRadius=104, cornerRadius=6, padAngle=0.02, stroke="#0B1530", strokeWidth=2)
    tot = int(df.Rows.sum()) or 1
    att = int(df[df.key != "benign"].Rows.sum())
    centre = pd.DataFrame({"t": [f"{att / tot * 100:.1f}%", "attack"], "y": [0, 1]})
    big = alt.Chart(centre.iloc[[0]]).mark_text(fontSize=26, fontWeight=800, color=TEXT, dy=-6).encode(text="t:N")
    small = alt.Chart(centre.iloc[[1]]).mark_text(fontSize=11, color=TEXT3, dy=18).encode(text="t:N")
    return alt.layer(ring, big, small).properties(height=250)


def confusion_chart(cm, classes):
    rows = [{"True": NICE.get(t, t), "Predicted": NICE.get(p, p), "Count": cm[i][j], "diag": i == j}
            for i, t in enumerate(classes) for j, p in enumerate(classes)]
    df = pd.DataFrame(rows)
    order = [NICE.get(c, c) for c in classes]
    base = alt.Chart(df).encode(x=alt.X("Predicted:N", sort=order, axis=alt.Axis(labelAngle=0, orient="top", title="Predicted")),
                                y=alt.Y("True:N", sort=order, title="True"))
    heat = base.mark_rect(cornerRadius=10, stroke="#0B1530", strokeWidth=4).encode(
        color=alt.Color("Count:Q", scale=alt.Scale(range=["#0E2238", "#0E7490", CYAN]), legend=None),
        tooltip=["True", "Predicted", alt.Tooltip("Count:Q", format=",")])
    text = base.mark_text(fontSize=20, fontWeight=800, color="white").encode(text=alt.Text("Count:Q", format=","))
    return (heat + text).properties(height=86 * len(classes) + 30)


def confidence_chart(rows):
    df = pd.DataFrame({"confidence": [r["confidence"] for r in rows], "Prediction": [NICE.get(r["prediction"], r["prediction"]) for r in rows]})
    present = [k for k in CLASS_COLORS if NICE.get(k, k) in set(df.Prediction)]
    dom = [NICE.get(k, k) for k in present]
    return alt.Chart(df).mark_bar(opacity=.9, cornerRadiusTopLeft=3, cornerRadiusTopRight=3).encode(
        x=alt.X("confidence:Q", bin=alt.Bin(maxbins=20, extent=[0.5, 1.0]), title="Model confidence"),
        y=alt.Y("count():Q", title="Rows", stack=True),
        color=alt.Color("Prediction:N", scale=alt.Scale(domain=dom, range=[CLASS_COLORS[k] for k in present]),
                        legend=alt.Legend(orient="top", title=None))).properties(height=250)


def caught_chart(by3: dict):
    rows = []
    for c, v in by3.items():
        tot = v["predicted_benign"] + v["predicted_attack"]
        good = v["predicted_benign"] if c == "benign" else v["predicted_attack"]
        rows.append({"Traffic type": NICE.get(c, c), "Correct": good / tot if tot else 0, "label": f"{good:,} / {tot:,}",
                     "key": "benign" if c == "benign" else c})
    df = pd.DataFrame(rows)
    bars = alt.Chart(df).mark_bar(cornerRadiusEnd=7, height=22).encode(
        x=alt.X("Correct:Q", scale=alt.Scale(domain=[0, 1]), axis=alt.Axis(format="%", title="Correctly handled")),
        y=alt.Y("Traffic type:N", title=None, sort=None),
        color=alt.Color("key:N", scale=alt.Scale(domain=list(CLASS_COLORS), range=list(CLASS_COLORS.values())), legend=None),
        tooltip=["Traffic type", alt.Tooltip("Correct:Q", format=".1%"), "label"])
    text = bars.mark_text(align="left", dx=6, color=TEXT, fontWeight=600).encode(text=alt.Text("Correct:Q", format=".1%"))
    return (bars + text).properties(height=60 * len(df) + 20)


# ------------------------------------------------------------------ result rendering
def verdict(res: dict):
    tot = max(1, res["total"])
    att = sum(v for k, v in res["counts"].items() if k != "benign")
    ben = res["counts"].get("benign", 0)
    share = att / tot
    if share >= 0.5:
        vc, ic, k, t = RED, "alert", "Simulated threat traffic detected", "Majority of rows classified as ATTACK"
    elif share > 0:
        vc, ic, k, t = AMBER, "alert", "Mixed traffic", "Some rows classified as ATTACK"
    else:
        vc, ic, k, t = EMERALD, "shield", "Traffic looks normal", "All rows classified as BENIGN"
    segs = "".join(f'<b style="width:{v / tot * 100:.2f}%;background:{CLASS_COLORS.get(c, CYAN)}"></b>'
                   for c, v in sorted(res["counts"].items(), key=lambda kv: kv[0] != "benign") if v)
    st.markdown(f"""<div class="verdict" style="--vc:{vc}"><div class="v-ic">{icon(ic, 28)}</div>
      <div><div class="v-k">{esc(k)}</div><div class="v-t">{esc(t)}</div>
      <div class="v-s">{num(ben)} benign · {num(att)} attack out of {num(res['total'])} rows · {esc(res['model'])} · {res.get('_seconds', 0)} s</div>
      <div class="split">{segs}</div></div>
      <div class="v-n"><div>{share * 100:.1f}%</div><small>rows flagged as attack</small></div></div>""", unsafe_allow_html=True)


def show_result(res: dict, key: str):
    verdict(res)
    components.html(live_stream_html(res), height=580, scrolling=False)
    ev = res.get("evaluation")
    att = sum(v for k, v in res["counts"].items() if k != "benign")
    mean_conf = sum(r["confidence"] for r in res["rows"]) / max(1, len(res["rows"]))
    cards = [("Rows predicted", num(res["total"]), f'{num(res["skipped_rows"])} skipped', CYAN, "rows"),
             ("Benign", num(res["counts"].get("benign", 0)), "normal traffic", EMERALD, "shield"),
             ("Attack" if key == "hybrid" else "DoS + Replay", num(att), "flagged rows", RED, "alert"),
             ("Mean confidence", pct(mean_conf, 1), "top-class probability", VIOLET, "gauge")]
    if ev:
        auc = ev.get("binary_auc") if key == "hybrid" else (ev.get("macro_ovr_auc") or ev.get("binary_auc"))
        cards += [("Accuracy", pct(ev["accuracy"]), f'{num(ev["rows_evaluated"])} labelled rows', CYAN, "target"),
                  ("Macro F1", pct(ev["macro_f1"]), "balanced over classes", EMERALD, "f1"),
                  ("ROC AUC" if key == "hybrid" else "AUC", pct(auc), "benign vs attack" if key == "hybrid" else "one-vs-rest", VIOLET, "auc")]
    st.markdown(kpis(cards[:4]), unsafe_allow_html=True)
    if ev:
        st.markdown(kpis(cards[4:]), unsafe_allow_html=True)
    ws = res.get("warnings") or []
    if ws:
        st.markdown('<div class="status">' + " · ".join(f"<span>ⓘ {esc(w)}</span>" for w in ws) + "</div>", unsafe_allow_html=True)

    c1, c2 = st.columns([1, 1.15], gap="medium")
    with c1:
        with st.container(key=f"charts1_{key}"):
            panel_head("Prediction distribution", "Share of rows per predicted class")
            st.altair_chart(donut(res["counts"]), width="stretch")
    with c2:
        with st.container(key=f"charts2_{key}"):
            if ev:
                panel_head("Confusion matrix", f'{num(ev["rows_evaluated"])} labelled rows · rows = true class, columns = predicted',
                           '<span class="tag real">real model output</span>')
                st.altair_chart(confusion_chart(ev["confusion_matrix"], res["classes"]), width="stretch")
                if ev.get("auc_note"):
                    st.markdown(f'<div class="note">{esc(ev["auc_note"])}</div>', unsafe_allow_html=True)
            else:
                panel_head("Confusion matrix", "Needs a <code>class</code> column in the CSV")
                st.markdown('<div class="note">This file has no labels, so only predictions are shown (no accuracy / F1 / AUC). '
                            'Try one of the labelled sample files to see the evaluation.</div>', unsafe_allow_html=True)

    c3, c4 = st.columns([1.15, 1], gap="medium")
    with c3:
        with st.container(key=f"charts3_{key}"):
            panel_head("Confidence distribution", "How sure the model is about each row")
            st.altair_chart(confidence_chart(res["rows"]), width="stretch")
    with c4:
        with st.container(key=f"charts4_{key}"):
            if ev and ev.get("by_true_3class"):
                panel_head("Which traffic types were caught", "Original 3-class labels vs the binary prediction")
                st.altair_chart(caught_chart(ev["by_true_3class"]), width="stretch")
            elif ev:
                pc = ev.get("per_class") or {}
                panel_head("Per-class quality", "Precision · recall · F1 per class")
                tbl = pd.DataFrame({NICE.get(c, c): {"Precision": pct(m["precision"], 1), "Recall": pct(m["recall"], 1),
                                                     "F1": pct(m["f1"], 1), "Rows": num(m["support"])} for c, m in pc.items()}).T
                st.dataframe(tbl, width="stretch")
            else:
                panel_head("Labels", "No ground truth in this file")
                st.markdown('<div class="note">Predictions only. Add a <code>class</code> column (benign / DoS attack / Replay) to evaluate.</div>',
                            unsafe_allow_html=True)

    with st.container(key=f"table_{key}"):
        panel_head("Row-level predictions", "Every row of your file with the model's decision and probabilities")
        table = pd.DataFrame([{"CSV line": r["row"], "Prediction": NICE.get(r["prediction"], r["prediction"]), "Confidence": r["confidence"],
                               **{f"P({NICE.get(k, k)})": v for k, v in r["probabilities"].items()},
                               **({"True label": NICE.get(r.get("true_label"), r.get("true_label"))} if "true_label" in r else {})}
                              for r in res["rows"]])
        st.dataframe(table.head(1000), width="stretch", height=330, hide_index=True,
                     column_config={"Confidence": st.column_config.ProgressColumn("Confidence", min_value=0.0, max_value=1.0, format="percent")})
        cc1, cc2 = st.columns([3, 1])
        with cc1:
            if len(table) > 1000:
                st.markdown(f'<div class="note">Showing the first 1,000 of {num(len(table))} rows. The download has all rows.</div>', unsafe_allow_html=True)
        with cc2:
            st.download_button("Download all predictions (CSV)", table.to_csv(index=False).encode("utf-8"),
                               file_name=f"seaql_{key}_predictions.csv", mime="text/csv", key=f"dl_{key}", width="stretch")


def compare_cards(results: dict):
    def m(k):
        ev = results[k].get("evaluation") or {}
        return {"acc": ev.get("accuracy"), "f1": ev.get("macro_f1"), "auc": ev.get("binary_auc")}
    mh, mr = m("hybrid"), m("rf")
    win = "hybrid"  # highlight = the FYP model (not a claimed winner; see the note below)

    def card(k, mm):
        rows = "".join(f'<div class="mrow"><span>{l}</span><div class="mbar"><i style="width:{(v or 0) * 100:.1f}%"></i></div><span>{pct(v, 1)}</span></div>'
                       for l, v in [("Accuracy", mm["acc"]), ("Macro F1", mm["f1"]), ("Benign-vs-attack AUC", mm["auc"])])
        att = sum(v for c, v in results[k]["counts"].items() if c != "benign")
        return (f'<div class="mcard {"win" if k == win else ""}"><div class="mh"><div class="mi">{icon("brain" if k == "hybrid" else "trees", 20)}</div>'
                f'<div><b>{MODEL_LABEL[k]}</b>{" <span class=\"tag real\" style=\"margin-left:6px\">FYP model</span>" if k == "hybrid" else ""}<div class="note">{MODEL_SUB[k]} · {num(att)} rows flagged</div></div></div>{rows}</div>')
    st.markdown(f'<div class="mcards">{card("hybrid", mh)}{card("rf", mr)}</div>', unsafe_allow_html=True)
    st.markdown('<div class="note" style="margin-top:10px">The Hybrid model is binary (benign / attack); the Random Forest predicts 3 classes, so its '
                'accuracy is on a harder task — the benign-vs-attack AUC compares both on the same question. The Random Forest was trained on a '
                'different data split, so some rows of the Hybrid held-out files may be in its training data; for a fair comparison use the '
                'recorded held-out results below.</div>', unsafe_allow_html=True)


# ------------------------------------------------------------------ page
models = load_models()
ensure_state(models)
card = models["hybrid"].card
hm = card["heldout_metrics"]

nodes = ["CSV", "Checks", "Impute + scale", "Autoencoder", "5-model stack", "Benign / Attack"]
EMBEDDED = str(st.query_params.get("seaql_embed", "")) == "1"   # inside the SEAQL website, which shows its own room banner
if not EMBEDDED:
  st.markdown(f"""
<div class="room"><div class="room-grid">
  <div>
    <div class="kicker">{icon("scan", 16)} Room 03 · AI Diagnostic Laboratory</div>
    <h1>AI Intrusion Detection Laboratory</h1>
    <p class="lead">Upload UAV packet data (CSV) and the trained SEAQL models classify every row as <b style="color:#6EE7B7">Benign</b> or
       <b style="color:#FF8BA0">Attack</b> — the same saved models and prediction code as the SEAQL dashboard backend.</p>
    <div class="pills"><span class="pill"><span class="d"></span>Online · real model</span>
      <span class="pill">Hybrid AE-Stack · acc {pct(hm['accuracy'])}</span><span class="pill">ROC AUC {pct(hm['auc'])}</span>
      <span class="pill">Random Forest baseline</span></div>
  </div>
  <div><div class="pipe"><span class="run"></span>{''.join(f'<div class="node"><i></i><span>{n}</span></div>' for n in nodes)}</div></div>
</div></div>""", unsafe_allow_html=True)

with st.container(key="deck"):
    panel_head("Run detection", "Choose a model and a file — predictions run live on the trained models",
               '<span class="tag real">real model output</span>')
    d1, d2, d3 = st.columns([1.45, .85, 1.3], gap="medium")
    with d1:
        mode = st.segmented_control("Model", ["Hybrid", "Random Forest", "Compare"], default="Hybrid",
                                    key="mode") or "Hybrid"
    with d2:
        src = st.segmented_control("Data", ["Sample", "Upload CSV"], default="Sample", key="src") or "Sample"
    text, fname = None, None
    with d3:
        if src == "Sample":
            pick = st.selectbox("Sample file", list(SAMPLE_FILES))
            fname = SAMPLE_FILES[pick]
            text = (SAMPLES / fname).read_text(encoding="utf-8")
        else:
            up = st.file_uploader("UAV packet CSV · header row · up to 100,000 rows", type=["csv"])
            if up is not None:
                fname = up.name
                text = up.getvalue().decode("utf-8", errors="replace")

if text is None:
    st.info("Upload a CSV file (same columns as Dataset_T-ITS.csv; an optional `class` column enables evaluation), or switch to a sample.")
else:
    keys = {"Hybrid": ["hybrid"], "Random Forest": ["rf"], "Compare": ["hybrid", "rf"]}[mode]
    if "rf" in keys and not models["rf_ok"]:
        st.error(f"Random Forest baseline is not available: {models['rf_error']}")
        keys = [k for k in keys if k != "rf"]
    st.markdown(f'<div class="status">File <code>{esc(fname)}</code> · {num(len(text.splitlines()) - 1)} data lines · '
                f'model{"s" if len(keys) > 1 else ""}: <b style="color:#fff">{" + ".join(MODEL_LABEL[k] for k in keys)}</b></div>',
                unsafe_allow_html=True)
    results = {}
    for k in keys:
        try:
            with st.spinner(f"Running {MODEL_LABEL[k]} …"):
                results[k] = run_prediction(text, k)
        except ValueError as exc:
            st.error(str(exc))
        except Exception as exc:  # pragma: no cover
            st.error(f"Prediction failed ({type(exc).__name__}): {exc}")
    if len(results) == 2:
        with st.container(key="cmp"):
            panel_head("Hybrid vs Random Forest on this file", "Same rows, both trained models",
                       '<span class="tag real">real model output</span>')
            compare_cards(results)
        t1, t2 = st.tabs([MODEL_LABEL["hybrid"], MODEL_LABEL["rf"]])
        with t1:
            show_result(results["hybrid"], "hybrid")
        with t2:
            show_result(results["rf"], "rf")
    elif results:
        k = next(iter(results))
        show_result(results[k], k)

# ------------------------------------------------------------------ recorded research results
with st.container(key="research"):
    panel_head("Recorded research results", f'Held-out test set · {num(card["split"]["test"])} rows · seed {card["split"]["seed"]} · '
               'measured when the model was trained', '<span class="tag ver">verified experiment</span>')
    rc = [("Hybrid accuracy", pct(hm["accuracy"]), "held-out", CYAN, "target"),
          ("Hybrid macro F1", pct(hm["macro_f1"]), "held-out", EMERALD, "f1"),
          ("Hybrid ROC AUC", pct(hm["auc"]), "held-out", VIOLET, "auc"),
          ("Balanced accuracy", pct(hm["balanced_accuracy"]), "held-out", CYAN, "gauge")]
    st.markdown(kpis(rc), unsafe_allow_html=True)
    r1, r2 = st.columns([1, 1.1], gap="medium")
    with r1:
        cm = card["heldout_confusion_matrix"]
        st.altair_chart(confusion_chart(cm["matrix"], cm["labels"]), width="stretch")
    with r2:
        rows = [("Hybrid AE-Stacked Ensemble", "binary", hm["accuracy"], hm["macro_f1"], hm["auc"])]
        t = card.get("thesis_recorded_metrics") or {}
        if t:
            rows.append(("Hybrid · thesis run (recorded CSV)", "binary", t.get("accuracy"), t.get("macro_f1"), t.get("auc")))
        try:
            rf = json.loads((BACKEND / "models" / "model_metrics.json").read_text())
            rows.append(("Random Forest baseline", "3-class", rf["accuracy"], rf["macro_f1"], rf["macro_ovr_auc"]))
        except Exception:
            pass
        st.dataframe(pd.DataFrame([{"Model": a, "Task": b, "Accuracy": pct(c, 1), "Macro F1": pct(d, 1), "ROC AUC": pct(e, 1)} for a, b, c, d, e in rows]),
                     width="stretch", hide_index=True)
        a = card["architecture"]
        st.markdown(f'<div class="note"><b style="color:#fff">Architecture.</b> Autoencoder {esc(a["autoencoder"])}. Base learners: {esc(", ".join(a["base_learners"]))}. '
                    f'Meta-learner: {esc(a["meta_learner"])} ({a["stacking_cv"]}-fold stacking). SMOTE on the {esc(card["smote"]["applied_to"])}.<br>'
                    '<span class="tag sim" style="margin-top:8px">future work</span> SHAP explanations and post-quantum cryptography in the FL loop '
                    'are not part of this demo.</div>', unsafe_allow_html=True)

st.markdown(f"""<div class="foot"><span>SEAQL · Scalable, Explainable &amp; Adaptive Quantum-Resilient Federated Learning for UAV Swarm Cybersecurity</span>
<span>Syed Measum Shah · Arooba Mansoor (03-135231-009) · Supervisor: Ms. Munaza Sher · Bahria University Lahore · BSIT FYP ·
<a href="{WEBSITE}" target="_blank">Open the SEAQL dashboard ↗</a></span></div>""", unsafe_allow_html=True)
