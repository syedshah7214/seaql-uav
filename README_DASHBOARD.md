# SEAQL — UAV Cybersecurity Operations Center (v9: command-center homepage + themed rooms)

Premium SOC-style dashboard for the SEAQL Final Year Project
(Bahria University, Lahore Campus · BSIT · project code BSIT-S26-013 · Supervisor: Ms. Munaza Sher).

- **`dashboard.html`** — the security platform in the original **V3 design**; opens on the **Security Command Center**
- **AI Detection Lab** — serves your FYP model, the **Hybrid AE-Stacked Ensemble** (binary benign / attack), with Random Forest as a baseline · see `docs/HYBRID_MODEL_EVALUATION.md`
- **`index.html`** — your original research website (unchanged)
- **`legacy/dashboard_v2.html`** — the previous dashboard, kept as a backup

---

## 1. Run it on Windows (PowerShell)

Requirements: **Python 3.12 or 3.13** (64-bit) on PATH (`python --version`). No Node.js and no PyTorch are needed to run it.
The saved models are pickles, so `backend\requirements.txt` pins the exact scikit-learn / XGBoost / LightGBM versions they were saved with (Windows wheels exist for Python 3.12 and 3.13).

```powershell
cd "C:\Users\Admin\Downloads\FYP PANGAY\seaql-uav-main"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r .\backend\requirements.txt
python .\backend\server.py
```

The browser opens **http://localhost:8000/dashboard.html** automatically. Stop with `Ctrl+C`.

Both trained models ship in `backend\models\` and load in a few seconds:
`hybrid\` (Hybrid AE-Stacked Ensemble — the FYP model) and `seaql_rf_3class.joblib` (Random Forest baseline).
If a model file is missing or was saved with different library versions, the server re-trains it automatically
(Random Forest ~30 s; the Hybrid model needs `requirements-train.txt` and takes a few minutes).

**One-click alternative:** double-click `run_seaql.bat`, or:

```powershell
cd "C:\Users\Admin\Downloads\FYP PANGAY\seaql-uav-main"
powershell -ExecutionPolicy Bypass -File .\run_seaql.ps1
```

If PowerShell blocks `Activate.ps1`, run once:
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` — or skip activation and use
`.\.venv\Scripts\python.exe .\backend\server.py`.

Other options:

| Command | Purpose |
|---|---|
| `python .\backend\server.py --port 8080` | use another port |
| `python .\backend\server.py --no-browser` | don't auto-open the browser |
| `python -m pip install -r .\backend\requirements-train.txt` | extra packages (PyTorch, imbalanced-learn, matplotlib) to **re-train** the Hybrid model |
| `python .\backend\train_hybrid.py` | re-train and save the Hybrid AE-Stacked Ensemble with the original research script (~2–15 min) |
| `python .\backend\verify_hybrid.py` | reload the saved Hybrid model and re-score the held-out split |
| `python .\backend\train_model.py` | re-train the Random Forest baseline |
| `python .\backend\build_dashboard_data.py` | rebuild `app\data\seaql-data.js` after re-running the research pipeline |

Without Python packages you can still run everything except real predictions:
`python -m http.server 8000` then open http://localhost:8000/dashboard.html (the Detection Lab will say
"Backend offline" — it never fakes predictions).

---

## 2. Modules

| # | Module | Data category |
|---|---|---|
| 1 | Security Command Center — KPIs, glowing swarm topology, traffic chart, threat donut, alerts, events, health, model summary, start/pause | Simulation + verified model summary |
| 2 | 3D UAV Swarm Digital Twin (Three.js) — 8 drones, 2 clusters, aggregator, animated links/packets, rotate/zoom/pan/reset, clickable drones, attack pulses, 2D fallback without WebGL | Simulation |
| 3 | Attack Simulation Lab — Normal / DoS / Replay / Mixed / Recovery, start/stop/pause/reset, speed, timeline, per-UAV traffic, severity, incidents | Simulation |
| 4 | AI Intrusion Detection Lab — **Hybrid AE-Stacked Ensemble (FYP model, binary)** or Random Forest baseline (3-class); CSV upload, validation, real predictions + P(attack), confusion matrix and per-attack-type detection when labelled, model comparison, CSV export | **Real model output** |
| 5 | Federated Learning Control Room — topology, 5 round stages replay, macro-F1 per round, non-IID distribution, communication cost, compression | Verified experiment (replayed) |
| 6 | Explainable AI Center — permutation importance, wlan.seq / wlan.duration / time_since_last_packet analysis, downloadable report | Verified experiment |
| 7 | Fleet Monitoring — 8 UAV cards + inspection drawer (real non-IID client data, simulated telemetry labelled) | Simulation + verified |
| 8 | Incident Investigation Center — search, severity/type filters, details, related features, timeline, CSV/HTML reports | Simulation |
| 9 | Research Analytics — binary vs 3-class results, model comparison, confusion matrices, class distribution, training curves, limitations | Verified experiment |
| 10 | Viva Presentation Mode — 10 slides (also reachable from the header **Viva Mode** button), Previous/Next/Restart/Fullscreen, ←/→ and F keys | — |
| 11 | Team & Documentation — project info, objectives status, architecture, stack, links | — |

Every page marks content as **Verified experiment**, **Interactive simulation**, **Real model output** or **Future work**.

---

## 3. Research-integrity notes

- All verified numbers are read from `seaql-repo/results/metrics/*` by `backend/build_dashboard_data.py`.
- The research scripts never saved a trained model. v6 adds `backend/train_hybrid.py`, which **calls the original
  functions of `uav_fl_hybrid_model_binary.py`** and saves every artifact. Measured held-out results of the saved
  model: **94.41% accuracy · 93.36% macro F1 · 98.39% ROC AUC** (thesis-recorded run: 94.34% · 93.27% · 98.33%).
  Nothing was tuned to match the thesis number. Details: `docs/HYBRID_MODEL_EVALUATION.md`.
- The Random Forest (3-class, `backend/train_model.py`, ~73.1% held-out) is kept as a separate baseline.
- Scoring the full `Dataset_T-ITS.csv` in the lab gives optimistic numbers (~96%) because it contains the training rows;
  the dashboard says so. Quote the held-out results.
- Federated learning numbers are a replay of `federated_round_history.csv`; no training runs in the browser.
- Explainability is **permutation importance** (SHAP was not installed in the recorded run).
- Post-quantum cryptography: `real_pqc_executed = false` — shown as Future work.
- Some numbers in the design reference images (e.g. 10,000 samples with 92.1% benign, feature importance
  0.38, −72.4% communication, 8× compression) are **not** in your results; the dashboard shows the real values
  instead (32,558 rows: 28.4% benign / 35.8% DoS / 35.8% Replay; wlan.seq 0.253; −50.0%; 2.0×).
- Cluster membership follows the real code: Cluster A = UAV-01/03/05/07, Cluster B = UAV-02/04/06/08
  (`cluster_map = range(i, n_clients, n_clusters)`).

---

## 4. Deploying

- **Frontend only (static):** upload the folder to Vercel / Netlify / GitHub Pages and open `/dashboard.html`.
  All modules work except the Detection Lab, which will show "Backend offline".
- **Frontend + backend:** run `backend/server.py` on any host with Python (Render, Railway, a VM). It serves
  the site and the API on one port; change the bind address in `server.py` (`127.0.0.1` → `0.0.0.0`) for
  public hosting. No `.env` configuration is required.

---

## 5. Project structure (new files)

```
dashboard.html              new SOC application shell
app/css/app.css             design system (navy #07111F + cyan #00D9FF)
app/js/core.js              shared simulation state, router, toasts, utilities
app/js/topology.js          2D glowing swarm network (also WebGL fallback)
app/js/twin3d.js            Three.js digital twin
app/js/views-ops.js         Command Center, Attack Lab, Fleet, Incidents
app/js/views-ai.js          Detection Lab, Federated Learning, XAI
app/js/views-research.js    Research Analytics, Viva Mode, Team & Docs
app/data/seaql-data.js      generated from recorded experiment outputs
app/samples/*.csv           held-out test rows for the Detection Lab
app/vendor/                 Chart.js 4, Three.js r160, Lucide (offline, no CDN)
app/fonts/                  Inter + JetBrains Mono (offline)
backend/server.py           std-lib web server + /api/health /api/models /api/predict?model=hybrid|rf
backend/hybrid_model.py     loads the saved Hybrid model; NumPy autoencoder forward pass (no PyTorch at serve time)
backend/train_hybrid.py     trains + saves the Hybrid model by calling seaql-repo/src/uav_fl_hybrid_model_binary.py
backend/verify_hybrid.py    independent reload + held-out re-evaluation of the saved Hybrid model
backend/models/hybrid/      preprocessor, autoencoder (.pt + .npz), stacking ensemble, model card, held-out predictions
backend/train_model.py      trains the Random Forest baseline
backend/requirements.txt    serving (pinned) · backend/requirements-train.txt  re-training
docs/HYBRID_MODEL_EVALUATION.md   training settings, measured metrics, verification
backend/build_dashboard_data.py
run_seaql.ps1 / run_seaql.bat
```

To add your group member, edit the `TEAM` list near the bottom of `app/js/views-research.js`.

## 6. Known limitations

- Simulated UAV telemetry (battery / altitude / signal) — the dataset has no such fields.
- Local (per-packet) explanations are not implemented (SHAP can now be added on top of the saved hybrid model).
- The Hybrid model is binary; DoS vs Replay sub-classification is only available from the Random Forest baseline.
- Saved models require the pinned library versions (Python 3.12/3.13); other versions trigger automatic re-training.
- The 3D view needs WebGL; older/remote-desktop browsers get the 2D fallback.

## Changelog

**v9 — command-center homepage + a unique "room" for every module**
- Homepage rebuilt from the reference design: header (module search, notifications, Start FYP Viva, team panel), 5 KPI cards, SVG drone/globe/platform hero with Detect · Learn · Explain · Collaborate shortcuts, threat donut + attack trend, Hybrid performance, confusion matrix, model comparison, FL progress, fleet status, recent events, live topology.
- Each module has its own palette, lighting, card style and animated banner (see `docs/DESIGN_SYSTEM_v9.md`).
- Backend, models and APIs unchanged. Screenshots: `docs/screenshots_v9/`; tests: `TEST_RESULTS_v9.txt`.

**v8 — premium visual design (Midnight Aurora)**
- Same V3 layout, routes, backend and models; visual refinement only. Details: `docs/DESIGN_SYSTEM_v8.md`.
- New palette (midnight navy, electric cyan + royal purple accents, emerald / coral / amber for status), glass cards, refined sidebar, KPI cards, buttons, tables, charts; animated home hero (SEAQL + drone).
- Team list: Syed Measum Shah, Arooba Mansoor. Hybrid model stored in a portable format (works on Windows).
- Screenshots: `docs/screenshots_v8/` (incl. `before_after_v7_v8.png`); tests: `TEST_RESULTS_v8.txt`.

**v7 — V3 design restored, V6 functionality kept**
- Frontend rebuilt from the original V3 source (`app/css/app.css`, `app/js/*`, `dashboard.html`): V3 layout, colours,
  sidebar, cards, typography, charts and Security Command Center as the homepage. V5/V6 Mission Control and the V5
  global restyle are removed.
- Ported from V6 into the V3 design: AI Detection Lab with the model selector (Hybrid AE-Stacked Ensemble = default,
  Random Forest = baseline), binary results, per-attack-type detection, model comparison, configurable API address
  (`app/js/config.js`), updated Viva / Research / Team text for the live Hybrid model, research table row for the
  re-trained Hybrid model.
- Backend, trained models, JSON-safety fix and evaluation are the unchanged V6 versions.
- Small functional fixes inside the V3 look: scrollable sidebar navigation, a header **Viva Mode** button, mobile
  menu above its overlay, no horizontal overflow at 1366 px.
- Proof screenshots: `docs/screenshots_v7/` (including `v3_vs_v7_dashboard.png`); tests: `TEST_RESULTS_v7.txt`.

**v6 — Original FYP model in the AI Detection Lab**
- Trained and saved the **Hybrid AE-Stacked Ensemble** with the original `uav_fl_hybrid_model_binary.py`
  functions (`backend/train_hybrid.py`); artifacts in `backend/models/hybrid/`.
- Held-out evaluation reproduced: 94.41% accuracy, 93.36% macro F1, 98.39% ROC AUC (6,621 test rows).
- Detection Lab: model switch (Hybrid = default, Random Forest = baseline), binary results with P(attack),
  2×2 confusion matrix, detection rate per original attack type, side-by-side model comparison.
- API: `POST /api/predict?model=hybrid|rf`, `GET /api/models`; v3.1 strict-JSON handling kept for both models.
- New samples: `app/samples/hybrid_heldout_test_sample.csv` (2,000 rows) and `hybrid_heldout_full_6621.csv`.
- Mission Control, Research Analytics and Viva now show the live model's measured results.
- Tests: `TEST_RESULTS_v6.txt`.

**v5 — Mission Control redesign** (built on v3.1; the detection-lab JSON fix is unchanged)
- New landing page **Mission Control** (`#/mission`): abstract sector map with procedural terrain (simulated
  coordinates, not GPS), 8 clickable drones, 2 cluster sectors, relays, global aggregator, animated links and
  packets, threat zones, simulated attack-source paths, zoom / pan / reset; Threat Detail panel (opens the AI
  Detection Lab), Threat Alerts, 5 KPI cards with trend lines, Security Events Over Time (stacked by severity,
  1m/3m/5m), UAV Communication Heatmap, Network Traffic, Cluster Status, Research Performance (recorded),
  Fleet Operations strip, Mission Event Timeline with export.
- **Start FYP Demo**: a scripted, reproducible ~45 s attack demonstration (baseline → DoS on UAV-03/07 →
  detection → Replay on UAV-06 → recovery). Reset re-seeds the simulation, so runs are identical.
- Header: simulation status, Pause/Start, notifications panel, fullscreen, **Start FYP Viva** button.
- Sidebar: logo fixed, navigation scrolls independently, simulation status pinned — Viva Mode and
  Team & Docs are always reachable (tested at 1366×768, 1920×1080 and 390×844). Mobile menu overlay bug fixed.
- Federated Learning page redesigned: client cards with each client's real class mix, cluster columns,
  global-model orb, animated update flow per stage, five-round timeline, compression visual,
  "Privacy, Security & Limitations" panel (implemented vs not implemented).
- Viva Mode: 12 slides with research diagrams drawn from the real numbers (architecture, dataset funnel,
  model stack, FL rounds, XAI, results), slide transitions, keyboard and fullscreen.
- The previous Command Center remains available as **SOC Overview** (`#/dashboard`).
- Screenshots: `docs/screenshots_v5/` · tests: `TEST_RESULTS_v5.txt`.

**v3.1 — AI Detection Lab fix**
- Fixed `Unexpected token 'N' ... is not valid JSON`: rows with an empty `class` value produced `NaN` in the
  JSON response (pandas 3.x keeps missing values as NaN after `astype(str)`). All API responses are now
  sanitised (NaN/Infinity → `null`) and encoded with `json.dumps(..., allow_nan=False)`.
- Ground-truth labels are cleaned separately from predictions: empty or unrecognised labels become `null`,
  rows still get real predictions, and accuracy / macro-F1 / AUC / confusion matrix use only valid labels.
- Unlabelled CSVs return predictions only; AUC is reported only when the needed classes are present.
- Stronger CSV validation (empty file, header-only, duplicate columns, wrong columns, rows with no
  numeric values, ±inf values) with clear error messages; stale results are cleared after an error.
- Results are shown in Benign → DoS → Replay order; table shows the CSV line number of each row.
- Test log: `TEST_RESULTS_detection_fix.txt`.
