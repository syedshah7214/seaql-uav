---
title: SEAQL UAV Cybersecurity
emoji: 🛡️
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
short_description: SEAQL FYP - Hybrid AE-Stacked Ensemble UAV intrusion detection
---

# SEAQL — UAV Cybersecurity Mission Control

Final Year Project, Bahria University Lahore Campus (BSIT-S26-013).
This Space runs the full dashboard and the AI Detection Lab API
(Hybrid AE-Stacked Ensemble, binary benign/attack, + Random Forest baseline).

* Dashboard: `/dashboard.html`
* API: `/api/health`, `/api/models`, `POST /api/predict?model=hybrid|rf` (CSV body)
