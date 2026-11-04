# SEAQL v9 — "One brand, different rooms"

The homepage is a cybersecurity command center modelled on the reference image. Every other module is a separate "room" of the SEAQL research center with its own palette, lighting, card style and banner artwork.

The parts that stay the same on every page, so it still feels like one product:
- logo, sidebar and active-navigation style
- Inter / JetBrains Mono typography
- header (module search, notifications, Start FYP Viva, team panel)
- button behavior and Lucide icons
- the dark-mode base
- research-integrity labels: Verified / Simulated / Real model output / Future work

## Homepage — Command Center (cyan + violet)

| Element | Details | Data source |
|---|---|---|
| Header | Title "UAV Cybersecurity Operations Center". Module search (type or press `/`, arrow keys, Enter). Notification panel with unread badge. Purple Start FYP Viva button. Team / project panel with live backend status. | app |
| 5 KPI cards | UAV Nodes 8 · FL Clusters 2 · FL Rounds 5 · Hybrid Accuracy 94.41% · ROC AUC 98.39%. No made-up growth percentages. Sparklines show real series: live simulated traffic, real per-client sample counts, recorded validation F1 per round. The accuracy and AUC rings show the values themselves. | real + labelled sim |
| Hero | Original SVG artwork: 3D-style quadcopter with spinning rotors, holographic globe with drifting dots, light beam and glowing platform rings, particles and orbit rings. Four shortcuts: Detect, Learn, Explain, Collaborate. | — |
| Threat Events donut and Attack Trend chart | Session traffic windows split into DoS, Replay and Benign, plus packets per second by class (log scale). | labelled **Simulated** |
| Hybrid performance · confusion matrix · model comparison | Accuracy 94.41%, macro F1 93.36%, AUC 98.39%. Confusion matrix 1808 / 77 / 293 / 4443. Random Forest shown as a 3-class baseline, with a note that the tasks differ. | Verified |
| FL Progress | 59.7% federated macro F1, 8 clients, 5 rounds, non-IID α 0.3, 50.0% upload reduction (top-k 0.25). | Verified |
| Fleet status · recent events · live topology | Live state of the simulated swarm. | Simulated |

## Room palettes

| Room | Accent pair | Lighting and texture | Card style |
|---|---|---|---|
| 01 UAV Swarm — Aerospace Mission Control | Neon cyan `#22D3EE` + deep space blue `#3B82F6` | Starfield, deep-blue glow | HUD corner marks, radar sweep banner |
| 02 Attack Simulation — Cyber Defense Lab | Crimson `#F43F5E` + amber `#F59E0B` | Near-black, faint diagonal hazard lines | Red left stripe, ECG threat line, pulsing shield |
| 03 AI Detection Lab — AI Diagnostic Lab | Electric cyan `#22D3EE` + emerald `#34D399` | Cyan/emerald glow | Lab corner brackets, animated detection pipeline (CSV → impute → AE → 5-model stack → meta-LR → result), emerald upload area |
| 04 Federated Learning — Distributed AI Lab | Royal purple `#A78BFA` + electric blue `#3B82F6` | Hexagon pattern | Purple header glow, animated aggregator banner with 8 clients and 2 clusters |
| 05 Explainable AI — Interpretation Studio | Violet `#A78BFA` + teal `#2DD4BF` | Violet/teal glow | Gradient-border rounded cards, banner of real importance bars |
| 06 Fleet Monitoring — UAV Operations Center | Emerald `#34D399` + ice blue `#7DD3FC` | Green/ice glow | Glowing bottom line, banner with the live fleet |
| 07 Security Incidents — SOC | Coral `#FB7185` + burgundy `#9F1239` | Burgundy glow | Burgundy header strips, animated incident-queue banner |
| 08 Research Analytics — Scientific Platform | Indigo `#818CF8` + magenta `#E879F9` | Indigo glow | Faint graph-paper grid, rising-curve banner |
| 09 Viva Mode — Cinematic presentation | Gold `#E5B95C` + cyan `#22D3EE` on black | Black with gold vignette | Gold rails, gold hero title, gold-to-cyan progress bar, architecture flow with a connector line, slide transitions |
| 10 Team & Docs — About | Slate `#94A3B8` + soft violet `#C4B5FD` | Plain slate | Flat understated cards, team profile cards, project timeline (no dates claimed) |

Chart colors follow the room: brand cyan and purple are remapped to the room's accent pair. Status colors (red = attack, green = benign/healthy, amber = warning) never change, so their meaning stays the same everywhere.

## Performance and accessibility

- Measured in headless Chromium with software rendering, every 2D page runs at about 60 fps. All effects are SVG and CSS, with no images or extra WebGL.
- When the system "reduce motion" setting is on, every decorative animation stops.
- Text keeps light-on-dark contrast. Every page fits phones (390 px) without horizontal scrolling.
