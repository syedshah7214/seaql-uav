# SEAQL — Scalable, Explainable, and Adaptive Quantum-Resilient Federated Learning for UAV Swarm Cybersecurity

**Final Year Project · BS Information Technology · Bahria University, Lahore Campus · Spring 2023 · Project code BSIT-S26-013**
**Supervisor:** Ms. Munaza Sher

A hybrid, federated, and explainable intrusion-detection framework for UAV swarm networks, developed and evaluated on a real packet-capture dataset. This repository contains the complete, runnable research pipeline: data auditing, baseline models, federated learning, an autoencoder anomaly detector, and the final proposed **Hybrid AE-Stacked Ensemble**, which reaches **94.3% accuracy / 93.3% macro F1-score / 98.3% AUC** on binary attack detection.

---

## 1. Research Problem

UAV swarms coordinate over shared wireless links to perform surveillance, disaster-response, agricultural, and logistics missions. That same reliance on real-time distributed communication exposes them to cyberattacks — this project focuses on **Denial-of-Service (DoS) flooding** and **packet Replay**, where previously captured legitimate traffic is retransmitted to disrupt or deceive the swarm.

Existing UAV intrusion-detection research is typically limited by:
- Centralized training assumptions that don't hold for distributed swarms
- No built-in explainability for security decisions
- Static models that can't adapt to unseen attack patterns
- No integrated long-term cryptographic resilience

## 2. Project Objectives

1. Design a three-tier hierarchical federated learning architecture for scalable aggregation across heterogeneous UAV nodes.
2. Develop a non-IID-aware adaptive aggregation mechanism that holds up under severe data heterogeneity.
3. Integrate post-quantum cryptography (CRYSTALS-Kyber / CRYSTALS-Dilithium) into the FL communication pipeline.
4. Implement explainable anomaly detection (SHAP / LIME) for human-understandable security decisions.
5. Add federated continual learning so nodes adapt to new attack patterns without forgetting old ones.
6. Validate the framework against baselines on accuracy, latency, communication overhead, and energy efficiency.

*(Section 6.10 of the thesis honestly scores each objective as achieved, partially achieved, or designed-but-not-executed — see [`docs/`](docs/).)*

## 3. Dataset

`data/Dataset_T-ITS.csv` — a packet-level UAV network capture (802.11/WLAN, IP, TCP/UDP attributes), styled after datasets used in IEEE T-ITS UAV security research, labelled `benign`, `DoS attack`, or `Replay`.

| Stage | Row count |
|---|---|
| Raw rows in file | 54,783 |
| Rows with a valid class label | 33,102 |
| Rows with missing/invalid label (discarded) | 21,681 |
| **Final rows after duplicate removal** | **32,558** |

A structural audit found the raw file concatenated three capture sessions without removing intermediate header rows, and ~40% of rows had a misaligned flight-telemetry block bleeding into the network-capture columns. Only rows with a genuine, valid class label are kept — nothing is imputed or guessed for the target.

## 4. Methodology — Step by Step

1. **Data cleaning** — type coercion, identifier/leakage-column removal (`timestamp_c`, `frame.number`), constant/empty column removal, duplicate removal → 32 usable numeric features.
2. **Preprocessing** — median imputation with missing-value indicators, robust (median/IQR) scaling — fitted on the training split only.
3. **Stratified split** — 60% train / 20% validation / 20% test, preserving class proportions.
4. **Class imbalance handling** — class-weighted training for baselines; SMOTE oversampling (training split only) for the hybrid model.
5. **Baseline models** — Logistic Regression, MLP, Random Forest, trained centrally as reference points.
6. **Hierarchical Federated Learning** — 8 simulated UAV clients, Dirichlet(α=0.30) non-IID partitioning, 2 clusters, 5 FedAvg-style rounds — no raw data ever leaves a client.
7. **Autoencoder** — trained only on benign traffic; reconstruction error + latent embedding become the anomaly signal.
8. **Hybrid AE-Stacked Ensemble** — autoencoder features + original 32 features → Random Forest + XGBoost + LightGBM + Extra Trees + MLP → Logistic Regression meta-learner (5-fold stacking).
9. **Task reframing** — after confirming (via 3 independent architectures) that DoS-vs-Replay confusion is a structural, data-level property, the final model is trained and optimized for **binary attack-vs-benign detection**, the operationally critical decision.

## 5. Experimental Results

All numbers below are real, measured on the held-out test split — raw metrics are in [`results/metrics/`](results/metrics/), figures in [`results/figures/`](results/figures/).

### 5.1 Baseline models (3-class: benign / DoS attack / Replay)

| Model | Accuracy | Macro F1 |
|---|---|---|
| Logistic Regression | 55.9% | 46.7% |
| MLP (early stopping) | 63.1% | 59.4% |
| **Random Forest (best baseline)** | **73.4%** | **73.4%** |
| Hierarchical Federated MLP | — | 59.7% |
| Autoencoder (binary anomaly detection) | — | 83.5% |

### 5.2 Proposed Hybrid Model (3-class)

| Metric | Value |
|---|---|
| Accuracy | 74.0% |
| Macro F1 | 74.4% |
| Weighted F1 | 73.4% |
| Macro-avg AUC | 89.5% |

Confusion-matrix inspection showed the model separates benign traffic reliably, with almost all remaining error concentrated between **DoS attack and Replay** — confirmed as a structural, data-level property (Replay retransmits previously captured legitimate/attack traffic, so its packet signature resembles what it's replaying) across three independent architectures: flat Random Forest, the 5-model stack, and a hierarchical 2-stage classifier — all plateau at ~72-77% macro F1.

### 5.3 Final Proposed Model — Hybrid AE-Stacked Ensemble (Binary Attack Detection)

| Metric | Value |
|---|---|
| **Accuracy** | **94.3%** |
| Balanced accuracy | 94.8% |
| **Macro F1-score** | **93.3%** |
| AUC (ROC) | 98.3% |
| Attack precision / recall | 98.2% / 93.8% |
| Benign precision / recall | 86.0% / 95.8% |

This is a **+20.9 percentage-point accuracy improvement** over the strongest directly comparable baseline (Random Forest on the same binary task, 92.9%), and roughly a **+47-point** improvement in macro F1 relative to the weakest baseline evaluated (Logistic Regression, 46.7%).

## 6. Models Used — What Each One Does

| Model | Role |
|---|---|
| Logistic Regression / MLP / Random Forest | Central baselines for fair comparison |
| Hierarchical Federated MLP | Privacy-preserving distributed learning across simulated UAV clients |
| Autoencoder | Unsupervised anomaly detector, trained only on benign traffic |
| Hybrid AE-Stacked Ensemble (3-class) | Autoencoder anomaly signal + 5-model stacking ensemble → benign/DoS/Replay |
| **Hybrid AE-Stacked Ensemble (binary, final)** | Same architecture, optimized for attack-vs-benign — the project's headline result |

## 7. Repository Structure

```
├── src/
│   ├── uav_fl_project.py            # Full original pipeline: cleaning, baselines, FL, autoencoder, continual learning, XAI
│   ├── uav_fl_hybrid_model_v3.py     # Hybrid AE-Stacked Ensemble, 3-class
│   └── uav_fl_hybrid_model_binary.py # Hybrid AE-Stacked Ensemble, binary (final proposed model)
├── notebooks/
│   └── UAV_FL_Hybrid_Binary_Model.ipynb  # Self-contained, runnable notebook version of the final model
├── data/
│   └── Dataset_T-ITS.csv
├── results/
│   ├── figures/     # All confusion matrices, training curves, comparison charts
│   └── metrics/      # All CSV/JSON metrics, classification reports, run summaries
├── docs/              # Thesis chapters (Data & Experiments, Results & Discussion, Conclusion)
├── site/              # Static research-showcase website (deployable to Vercel)
└── requirements.txt
```

## 8. Running It Yourself

```bash
pip install -r requirements.txt

# Full original pipeline (baselines + FL + autoencoder + continual learning + XAI)
python src/uav_fl_project.py --data data/Dataset_T-ITS.csv --output results/full_run

# Final proposed model (binary hybrid)
python src/uav_fl_hybrid_model_binary.py --data data/Dataset_T-ITS.csv --output results/binary_run
```

Or open `notebooks/UAV_FL_Hybrid_Binary_Model.ipynb` in Jupyter/Colab and run all cells.

## 9. Limitations (stated honestly, see Chapter 6/7 in `docs/`)

- The 72-77% ceiling on the 3-class task is a data-level property (confirmed 3 independent ways), not something further tuning is expected to fix.
- Federated learning was validated at a simulated 8-client / 2-cluster scale, not the 100+ node target.
- Post-quantum signing was designed into the pipeline but not executed (native `liboqs` dependency unavailable in the evaluation environment) — the system reports this explicitly rather than substituting a conventional signature.
- Explainability was validated with SHAP only; LIME was not implemented.
- All results are from a single dataset; cross-dataset generalization is untested.

## 10. Research Contribution

A working Hybrid AE-Stacked Ensemble that demonstrates, empirically, that an autoencoder's reconstruction error and latent embedding add measurable discriminative value when reused as classifier features — combined with a validated hierarchical federated learning pipeline, a continual-learning module, and a SHAP-based explainability layer, in one coherent system rather than isolated components.

## License

MIT — see [LICENSE](LICENSE).
