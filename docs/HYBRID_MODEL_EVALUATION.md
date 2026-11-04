# SEAQL v6 — Hybrid AE-Stacked Ensemble: training, saved artifacts and held-out evaluation

## What was done
`backend/train_hybrid.py` **imports and calls the original research functions** from
`seaql-repo/src/uav_fl_hybrid_model_binary.py` (`load_and_clean`, `fit_preprocessor`,
`train_ae_feature_extractor`, `build_stack`, `binary_metrics`) and repeats the steps of that script's `main()`:

| Step | Setting (unchanged from the original script) |
|---|---|
| Data | `Dataset_T-ITS.csv`, original cleaning (valid labels only, **no de-duplication**) → 33,102 rows, 32 features |
| Split | stratified 80/20 test split, then 75/25 train/validation, seed 42 → train 19,860 · test 6,621 |
| Preprocessing | `SimpleImputer(median, add_indicator)` + `RobustScaler(10, 90)`, fitted on the training split only |
| Autoencoder | trained on **benign training rows only**; features = reconstruction MSE + latent vector |
| Balancing | SMOTE (k=5) on the training split only: 19,860 → 28,410 rows |
| Stack | RandomForest(400) · XGBoost(350) · LightGBM(350) · ExtraTrees(400) · MLP(160,80) → LogisticRegression meta-learner, 5-fold stacking |
| Target | binary: benign vs attack (DoS attack + Replay) |

The only addition is saving every fitted object. Nothing in the model or evaluation was tuned to hit a target number.

## Held-out test results (measured in this run)

| Metric | v6 re-run (saved & served) | Thesis-recorded run |
|---|---|---|
| Accuracy | **94.41%** | 94.34% |
| Macro F1 | **93.36%** | 93.27% |
| ROC AUC | **98.39%** | 98.33% |
| Balanced accuracy | 94.86% | 94.76% |
| Attack precision / recall | 98.30% / 93.81% | 98.23% / 93.77% |
| Benign precision / recall | 86.05% / 95.92% | 85.95% / 95.76% |

Confusion matrix (6,621 held-out rows; rows = true, columns = predicted):

| | Pred. benign | Pred. attack |
|---|---|---|
| True benign | 1,808 | 77 |
| True attack | 293 | 4,443 |

(Thesis run: [[1,805, 80], [295, 4,441]].) The small differences come from library versions and
non-deterministic parallel training; the result reproduces the thesis within about ±0.1 percentage points.

Detection by original attack type: benign kept benign 1,808/1,885 ·
DoS detected 2,225/2,334 ·
Replay detected 2,218/2,402.

## Verification of the saved model
* `backend/verify_hybrid.py` reloads only the saved files and re-scores the held-out split through the serving code:
  accuracy 94.41%, macro F1 93.36%, ROC AUC 98.39% — predictions identical to training time
  (AUC differs by 1.1e-06 because serving runs the autoencoder in NumPy float32;
  max relative feature difference vs PyTorch = 2.2e-07).
* Uploading all 6,621 held-out rows as a raw CSV to `POST /api/predict?model=hybrid` returns the same
  accuracy, macro F1, ROC AUC and confusion matrix (see `TEST_RESULTS_v6.txt`).
* A clean virtual environment with only `backend/requirements.txt` (no PyTorch) serves the model and reproduces the same numbers.
* Reproducibility: deleting the saved files and letting the server re-train from scratch gave the same held-out
  accuracy 94.41%, macro F1 93.36% and ROC AUC 98.39% in a second, independent training run.

## Saved artifacts (`backend/models/hybrid/`)
| File | Content |
|---|---|
| `preprocessor.joblib` | fitted imputer + RobustScaler |
| `autoencoder.pt` | PyTorch state_dict + input dimension |
| `autoencoder_numpy.npz` | same weights for torch-free inference |
| `stack.joblib` | fitted StackingClassifier (5 base learners + meta-learner) |
| `model_card.json` | features, settings, library versions, measured metrics |
| `heldout_predictions.csv` | every held-out row: true label, prediction, P(attack) |
| `verification.json` | independent reload check |
| `hybrid_binary_autoencoder_training_*` | autoencoder training history/curve from this run |

Environment used: Python 3.13.18, scikit-learn 1.9.1, XGBoost 3.4.1,
LightGBM 4.7.0, imbalanced-learn 0.14.2, PyTorch 2.15.0+cu132 (CPU).

## Notes for the viva
* The hybrid model is **binary** (attack vs benign). DoS and Replay are merged because they overlap at packet level;
  the 3-class Random Forest baseline (~73% macro F1) is kept in the Detection Lab for comparison.
* Scoring the **full** `Dataset_T-ITS.csv` gives higher numbers (~96%) because ~60% of those rows were training data.
  Quote the held-out results above.
* Rows in `app/samples/uav_traffic_test_sample.csv` come from the Random Forest's split (which de-duplicates);
  for the hybrid model use `app/samples/hybrid_heldout_test_sample.csv` or `hybrid_heldout_full_6621.csv`.
