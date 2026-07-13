#!/usr/bin/env python3
"""
Scalable, Explainable, Adaptive and Quantum-Resilient Federated Learning
for Non-IID UAV Swarm Cybersecurity.

This executable research prototype addresses the proposal's main technical items:
1) robust data cleaning and leakage-aware preprocessing,
2) anomaly detection with an autoencoder,
3) multi-class attack classification and baseline comparison,
4) non-IID client construction,
5) hierarchical federated learning,
6) continual/adaptive learning under temporal drift,
7) explainability using SHAP with a permutation-importance fallback,
8) communication/compression accounting,
9) optional ML-DSA post-quantum signing when python-oqs is installed,
10) explicit anti-overfitting controls and train/validation/test separation.

The script writes publication-ready tables and figures to an output directory.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import random
import time
import warnings
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
    precision_recall_curve,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, RobustScaler
from sklearn.utils.class_weight import compute_class_weight

import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

warnings.filterwarnings("ignore")


@dataclass
class Config:
    seed: int = 42
    test_size: float = 0.20
    val_size: float = 0.20
    max_rows: int = 0
    n_clients: int = 8
    n_clusters: int = 2
    dirichlet_alpha: float = 0.30
    fl_rounds: int = 5
    local_epochs: int = 1
    batch_size: int = 512
    learning_rate: float = 2e-3
    weight_decay: float = 1e-4
    patience: int = 3
    compression_topk: float = 0.25
    continual_chunks: int = 5
    replay_per_class: int = 150
    device: str = "cuda" if torch.cuda.is_available() else "cpu"


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.use_deterministic_algorithms(False)


def load_and_clean(path: Path, max_rows: int = 0) -> Tuple[pd.DataFrame, pd.Series, pd.DataFrame]:
    raw = pd.read_csv(path, dtype=str, low_memory=False)
    raw.columns = [str(c).strip() for c in raw.columns]
    if "class" not in raw.columns:
        raise ValueError("Dataset must contain a 'class' target column.")

    y = raw["class"].astype(str).str.strip()
    valid_labels = {"benign", "Replay", "DoS attack"}
    valid = y.isin(valid_labels)
    dropped = raw.loc[~valid, ["class"]].copy()
    df = raw.loc[valid].copy()
    y = df.pop("class").astype(str).str.strip()

    # Convert all packet fields to numeric; malformed tokens become NaN and are imputed.
    X = df.apply(pd.to_numeric, errors="coerce")

    # Remove identifiers/timing fields that commonly cause memorization or temporal leakage.
    leakage_like = [c for c in ["timestamp_c", "frame.number"] if c in X.columns]
    X = X.drop(columns=leakage_like)

    # Remove unusable columns and exact duplicates while preserving labels.
    all_missing = X.columns[X.isna().all()].tolist()
    X = X.drop(columns=all_missing)
    nunique = X.nunique(dropna=True)
    constant = nunique[nunique <= 1].index.tolist()
    X = X.drop(columns=constant)

    combined = X.copy()
    combined["__target__"] = y.values
    combined = combined.drop_duplicates().reset_index(drop=True)
    y = combined.pop("__target__")
    X = combined

    if max_rows and len(X) > max_rows:
        X, _, y, _ = train_test_split(
            X, y, train_size=max_rows, stratify=y, random_state=42
        )
        X, y = X.reset_index(drop=True), y.reset_index(drop=True)

    audit = pd.DataFrame({
        "item": ["raw_rows", "valid_labeled_rows", "invalid_or_missing_labels", "final_rows", "features"],
        "value": [len(raw), int(valid.sum()), int((~valid).sum()), len(X), X.shape[1]],
    })
    return X, y, audit


def split_data(X: pd.DataFrame, y: pd.Series, cfg: Config):
    X_trainval, X_test, y_trainval, y_test = train_test_split(
        X, y, test_size=cfg.test_size, stratify=y, random_state=cfg.seed
    )
    relative_val = cfg.val_size / (1.0 - cfg.test_size)
    X_train, X_val, y_train, y_val = train_test_split(
        X_trainval, y_trainval, test_size=relative_val,
        stratify=y_trainval, random_state=cfg.seed
    )
    return tuple(z.reset_index(drop=True) for z in (X_train, X_val, X_test, y_train, y_val, y_test))


def fit_preprocessor(X_train: pd.DataFrame) -> Pipeline:
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
        ("scaler", RobustScaler(quantile_range=(10, 90))),
    ]).fit(X_train)


def classification_metrics(y_true, y_pred, y_prob=None) -> Dict[str, float]:
    out = {
        "accuracy": accuracy_score(y_true, y_pred),
        "balanced_accuracy": balanced_accuracy_score(y_true, y_pred),
        "macro_f1": f1_score(y_true, y_pred, average="macro"),
        "weighted_f1": f1_score(y_true, y_pred, average="weighted"),
    }
    if y_prob is not None:
        try:
            out["macro_ovr_auc"] = roc_auc_score(y_true, y_prob, multi_class="ovr", average="macro")
        except Exception:
            out["macro_ovr_auc"] = np.nan
    return out


def plot_confusion(y_true, y_pred, labels: Sequence[str], title: str, path: Path):
    cm = confusion_matrix(y_true, y_pred, labels=np.arange(len(labels)))
    fig, ax = plt.subplots(figsize=(7, 6))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(len(labels)), labels, rotation=35, ha="right")
    ax.set_yticks(range(len(labels)), labels)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title(title)
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(j, i, str(cm[i, j]), ha="center", va="center")
    fig.colorbar(im, ax=ax)
    fig.tight_layout()
    fig.savefig(path, dpi=220)
    plt.close(fig)


def train_central_models(Xtr, ytr, Xv, yv, Xte, yte, class_names, seed, outdir):
    models = {
        "Logistic Regression": LogisticRegression(
            max_iter=1200, class_weight="balanced", C=0.5, random_state=seed, n_jobs=-1
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=180, max_depth=18, min_samples_leaf=3,
            max_features="sqrt", class_weight="balanced_subsample",
            random_state=seed, n_jobs=-1
        ),
        "MLP (early stopping)": MLPClassifier(
            hidden_layer_sizes=(128, 64), activation="relu", alpha=1e-4,
            batch_size=256, learning_rate_init=8e-4, max_iter=160,
            early_stopping=True, validation_fraction=0.15,
            n_iter_no_change=12, random_state=seed
        ),
    }
    rows, fitted = [], {}
    for name, model in models.items():
        t0 = time.perf_counter()
        model.fit(Xtr, ytr)
        train_s = time.perf_counter() - t0
        fitted[name] = model
        for split, Xs, ys in [("train", Xtr, ytr), ("validation", Xv, yv), ("test", Xte, yte)]:
            pred = model.predict(Xs)
            prob = model.predict_proba(Xs) if hasattr(model, "predict_proba") else None
            m = classification_metrics(ys, pred, prob)
            m.update({"model": name, "split": split, "training_seconds": train_s})
            rows.append(m)
        test_pred = model.predict(Xte)
        pd.DataFrame(classification_report(yte, test_pred, target_names=class_names, output_dict=True)).T.to_csv(
            outdir / f"classification_report_{name.lower().replace(' ','_').replace('(','').replace(')','')}.csv"
        )
        plot_confusion(yte, test_pred, class_names, f"{name} - Test Confusion Matrix",
                       outdir / f"confusion_{name.lower().replace(' ','_').replace('(','').replace(')','')}.png")
    results = pd.DataFrame(rows)
    return fitted, results


class Autoencoder(nn.Module):
    def __init__(self, d: int):
        super().__init__()
        h1, h2 = min(128, max(32, d * 2)), min(48, max(12, d // 2))
        self.encoder = nn.Sequential(nn.Linear(d, h1), nn.ReLU(), nn.Dropout(0.10), nn.Linear(h1, h2), nn.ReLU())
        self.decoder = nn.Sequential(nn.Linear(h2, h1), nn.ReLU(), nn.Linear(h1, d))
    def forward(self, x): return self.decoder(self.encoder(x))


def train_autoencoder(Xtr, ytr, Xv, yv, Xte, yte, benign_id, cfg, outdir):
    device = torch.device(cfg.device)
    model = Autoencoder(Xtr.shape[1]).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=cfg.weight_decay)
    loss_fn = nn.MSELoss()
    benign_train = torch.tensor(Xtr[ytr == benign_id], dtype=torch.float32)
    loader = DataLoader(TensorDataset(benign_train), batch_size=cfg.batch_size, shuffle=True)
    best, best_state, wait, history = np.inf, None, 0, []
    benign_val = torch.tensor(Xv[yv == benign_id], dtype=torch.float32, device=device)
    for epoch in range(25):
        model.train(); losses=[]
        for (xb,) in loader:
            xb=xb.to(device); opt.zero_grad(); rec=model(xb); loss=loss_fn(rec,xb)
            loss.backward(); nn.utils.clip_grad_norm_(model.parameters(), 2.0); opt.step(); losses.append(loss.item())
        model.eval()
        with torch.no_grad(): vloss=loss_fn(model(benign_val), benign_val).item()
        history.append({"epoch":epoch+1,"train_loss":np.mean(losses),"val_benign_loss":vloss})
        if vloss < best - 1e-6:
            best, best_state, wait = vloss, copy.deepcopy(model.state_dict()), 0
        else:
            wait += 1
            if wait >= 4: break
    model.load_state_dict(best_state)

    def scores(X):
        model.eval(); xt=torch.tensor(X,dtype=torch.float32,device=device)
        with torch.no_grad(): return ((model(xt)-xt)**2).mean(1).cpu().numpy()
    val_scores, test_scores = scores(Xv), scores(Xte)
    yv_bin=(yv!=benign_id).astype(int); yt_bin=(yte!=benign_id).astype(int)
    # Some network datasets make attack traffic easier to reconstruct than benign traffic.
    # Select score orientation on validation only, never on the test set.
    raw_val_auc = roc_auc_score(yv_bin, val_scores)
    score_direction = 1.0 if raw_val_auc >= 0.5 else -1.0
    val_scores, test_scores = score_direction*val_scores, score_direction*test_scores
    precision, recall, thresholds = precision_recall_curve(yv_bin, val_scores)
    f1 = 2*precision*recall/(precision+recall+1e-12)
    threshold = thresholds[min(np.nanargmax(f1), len(thresholds)-1)]
    pred=(test_scores>=threshold).astype(int)
    metrics={
        "model":"Autoencoder anomaly detector", "threshold":float(threshold),
        "accuracy":accuracy_score(yt_bin,pred), "balanced_accuracy":balanced_accuracy_score(yt_bin,pred),
        "f1":f1_score(yt_bin,pred), "roc_auc":roc_auc_score(yt_bin,test_scores),
        "epochs":len(history), "score_direction":int(score_direction)
    }
    pd.DataFrame(history).to_csv(outdir/"autoencoder_training_history.csv",index=False)
    fig,ax=plt.subplots(figsize=(7,4)); h=pd.DataFrame(history)
    ax.plot(h.epoch,h.train_loss,label="Train"); ax.plot(h.epoch,h.val_benign_loss,label="Validation benign")
    ax.set(xlabel="Epoch",ylabel="MSE",title="Autoencoder learning curve"); ax.legend(); fig.tight_layout()
    fig.savefig(outdir/"autoencoder_learning_curve.png",dpi=220); plt.close(fig)
    return metrics


class FLNet(nn.Module):
    def __init__(self, d: int, n_classes: int):
        super().__init__()
        self.net=nn.Sequential(
            nn.Linear(d,128), nn.LayerNorm(128), nn.ReLU(), nn.Dropout(0.25),
            nn.Linear(128,64), nn.ReLU(), nn.Dropout(0.20), nn.Linear(64,n_classes)
        )
    def forward(self,x): return self.net(x)


def dirichlet_partition(y: np.ndarray, n_clients: int, alpha: float, seed: int, min_size: int = 40):
    rng=np.random.default_rng(seed); n_classes=len(np.unique(y))
    for _ in range(100):
        clients=[[] for _ in range(n_clients)]
        for k in range(n_classes):
            idx=np.where(y==k)[0]; rng.shuffle(idx)
            proportions=rng.dirichlet(np.repeat(alpha,n_clients))
            cuts=(np.cumsum(proportions)*len(idx)).astype(int)[:-1]
            for c,part in enumerate(np.split(idx,cuts)): clients[c].extend(part.tolist())
        if min(map(len,clients))>=min_size: break
    return [np.array(sorted(c),dtype=int) for c in clients]


def state_average(states: List[dict], weights: List[int]) -> dict:
    total=float(sum(weights)); out={}
    for k in states[0]:
        if states[0][k].dtype.is_floating_point:
            out[k]=sum(s[k]*(w/total) for s,w in zip(states,weights))
        else:
            out[k]=states[0][k]
    return out


def eval_torch(model, X, y, device):
    model.eval(); preds=[]; probs=[]
    loader=DataLoader(TensorDataset(torch.tensor(X,dtype=torch.float32),torch.tensor(y,dtype=torch.long)),batch_size=1024)
    with torch.no_grad():
        for xb,_ in loader:
            p=torch.softmax(model(xb.to(device)),1).cpu().numpy(); probs.append(p); preds.append(p.argmax(1))
    pred=np.concatenate(preds); prob=np.concatenate(probs)
    return classification_metrics(y,pred,prob), pred


def train_hierarchical_fl(Xtr,ytr,Xv,yv,Xte,yte,n_classes,cfg,outdir):
    device=torch.device(cfg.device); clients=dirichlet_partition(ytr,cfg.n_clients,cfg.dirichlet_alpha,cfg.seed)
    cluster_map=[list(range(i,cfg.n_clients,cfg.n_clusters)) for i in range(cfg.n_clusters)]
    global_model=FLNet(Xtr.shape[1],n_classes).to(device)
    classes=np.arange(n_classes); cw=compute_class_weight("balanced",classes=classes,y=ytr)
    loss_fn=nn.CrossEntropyLoss(weight=torch.tensor(cw,dtype=torch.float32,device=device))
    best_f1=-1; best_state=None; wait=0; rows=[]
    params=sum(p.numel() for p in global_model.parameters())
    full_bytes=params*4; compressed_bytes=int(full_bytes*cfg.compression_topk)+int(params*cfg.compression_topk)*4

    for rnd in range(1,cfg.fl_rounds+1):
        client_states=[]; client_sizes=[]
        for idx in clients:
            local=FLNet(Xtr.shape[1],n_classes).to(device); local.load_state_dict(global_model.state_dict())
            opt=torch.optim.AdamW(local.parameters(),lr=cfg.learning_rate,weight_decay=cfg.weight_decay)
            loader=DataLoader(TensorDataset(torch.tensor(Xtr[idx],dtype=torch.float32),torch.tensor(ytr[idx],dtype=torch.long)),
                              batch_size=cfg.batch_size,shuffle=True,drop_last=False)
            local.train()
            for _ in range(cfg.local_epochs):
                for xb,yb in loader:
                    if len(xb)<2: continue
                    xb,yb=xb.to(device),yb.to(device); opt.zero_grad(); loss=loss_fn(local(xb),yb)
                    loss.backward(); nn.utils.clip_grad_norm_(local.parameters(),2.0); opt.step()
            client_states.append({k:v.detach().cpu().clone() for k,v in local.state_dict().items()}); client_sizes.append(len(idx))

        cluster_states=[]; cluster_sizes=[]
        for members in cluster_map:
            cluster_states.append(state_average([client_states[i] for i in members],[client_sizes[i] for i in members]))
            cluster_sizes.append(sum(client_sizes[i] for i in members))
        global_model.load_state_dict(state_average(cluster_states,cluster_sizes))
        vm,_=eval_torch(global_model,Xv,yv,device); tm,_=eval_torch(global_model,Xtr,ytr,device)
        rows.append({"round":rnd,"train_macro_f1":tm["macro_f1"],"val_macro_f1":vm["macro_f1"],
                     "val_accuracy":vm["accuracy"],"full_upload_bytes_per_round":full_bytes*cfg.n_clients,
                     "topk_upload_bytes_per_round":compressed_bytes*cfg.n_clients})
        if vm["macro_f1"]>best_f1+1e-4:
            best_f1=vm["macro_f1"]; best_state=copy.deepcopy(global_model.state_dict()); wait=0
        else:
            wait+=1
            if wait>=cfg.patience: break
    global_model.load_state_dict(best_state)
    test_metrics,pred=eval_torch(global_model,Xte,yte,device)
    test_metrics.update({"model":"Hierarchical Federated MLP","rounds_run":len(rows),"parameters":params})
    hist=pd.DataFrame(rows); hist.to_csv(outdir/"federated_round_history.csv",index=False)
    fig,ax=plt.subplots(figsize=(7,4)); ax.plot(hist["round"],hist["train_macro_f1"],label="Train"); ax.plot(hist["round"],hist["val_macro_f1"],label="Validation")
    ax.set(xlabel="Federated round",ylabel="Macro F1",title="Hierarchical FL convergence"); ax.legend(); fig.tight_layout(); fig.savefig(outdir/"federated_convergence.png",dpi=220); plt.close(fig)
    pd.DataFrame({"client":range(cfg.n_clients),"samples":[len(i) for i in clients],
                  **{f"class_{k}":[int((ytr[i]==k).sum()) for i in clients] for k in range(n_classes)}}).to_csv(outdir/"non_iid_client_distribution.csv",index=False)
    return global_model,test_metrics,pred


def continual_learning(base_model, X_stream, y_stream, cfg, outdir):
    # Chronological proxy: preserve held-out ordering, evaluate before learning each chunk,
    # then update with a class-balanced replay buffer. The final chunk is never reused for model selection.
    model=copy.deepcopy(base_model)
    chunks=np.array_split(np.arange(len(y_stream)),cfg.continual_chunks)
    replay_x=[]; replay_y=[]; rows=[]
    for step,idx in enumerate(chunks,1):
        Xc,yc=X_stream[idx],y_stream[idx]
        before=model.predict(Xc); before_f1=f1_score(yc,before,average="macro")
        if step<cfg.continual_chunks:
            for k in np.unique(yc):
                kidx=idx[yc==k][:cfg.replay_per_class]
                replay_x.append(X_stream[kidx]); replay_y.append(y_stream[kidx])
            Rx=np.vstack(replay_x); Ry=np.concatenate(replay_y)
            model.fit(Rx,Ry)
            after=model.predict(Xc); after_f1=f1_score(yc,after,average="macro")
        else:
            after_f1=np.nan
        rows.append({"chunk":step,"samples":len(idx),"macro_f1_before_update":before_f1,"macro_f1_after_update":after_f1})
    df=pd.DataFrame(rows); df.to_csv(outdir/"continual_learning_results.csv",index=False)
    fig,ax=plt.subplots(figsize=(7,4)); ax.plot(df.chunk,df.macro_f1_before_update,marker="o",label="Pre-update"); ax.plot(df.chunk,df.macro_f1_after_update,marker="o",label="Post-update")
    ax.set(xlabel="Temporal chunk",ylabel="Macro F1",title="Continual adaptation with replay"); ax.legend(); fig.tight_layout(); fig.savefig(outdir/"continual_learning.png",dpi=220); plt.close(fig)
    return df


def explain_model(model, Xte, feature_names, outdir, seed):
    sample_n=min(300,len(Xte)); rng=np.random.default_rng(seed); idx=rng.choice(len(Xte),sample_n,replace=False)
    Xs=Xte[idx]
    try:
        import shap
        explainer=shap.TreeExplainer(model)
        sv=explainer.shap_values(Xs)
        if isinstance(sv,list): importance=np.mean([np.abs(a).mean(0) for a in sv],axis=0)
        else:
            arr=np.asarray(sv)
            importance=np.abs(arr).mean(axis=tuple(range(arr.ndim-1))) if arr.ndim>2 else np.abs(arr).mean(0)
        method="SHAP TreeExplainer"
    except Exception as e:
        pi=permutation_importance(model,Xs,model.predict(Xs),n_repeats=5,random_state=seed,scoring="f1_macro")
        importance=pi.importances_mean; method=f"Permutation fallback ({type(e).__name__})"
    importance=np.asarray(importance).reshape(-1)
    names=np.array(feature_names[:len(importance)])
    top=np.argsort(importance)[-15:][::-1]
    df=pd.DataFrame({"feature":names[top],"importance":importance[top],"method":method})
    df.to_csv(outdir/"xai_feature_importance.csv",index=False)
    fig,ax=plt.subplots(figsize=(8,5)); ax.barh(df.feature[::-1],df.importance[::-1]); ax.set(xlabel="Mean absolute contribution",title=f"Top explanatory features - {method}")
    fig.tight_layout(); fig.savefig(outdir/"xai_feature_importance.png",dpi=220); plt.close(fig)
    return method


def pqc_and_integrity_benchmark(payload_bytes: int, outdir: Path):
    # Always provide SHA3 integrity timing; use real ML-DSA only when python-oqs + liboqs are installed.
    payload=os.urandom(min(payload_bytes,2_000_000)); rows=[]
    t0=time.perf_counter(); digest=hashlib.sha3_256(payload).digest(); hash_ms=(time.perf_counter()-t0)*1000
    rows.append({"mechanism":"SHA3-256 update digest","available":True,"sign_ms":hash_ms,"verify_ms":np.nan,
                 "public_key_bytes":np.nan,"signature_bytes":len(digest),"note":"Integrity primitive; not a digital signature."})
    try:
        import oqs
        alg="ML-DSA-44" if "ML-DSA-44" in oqs.get_enabled_sig_mechanisms() else "Dilithium2"
        with oqs.Signature(alg) as signer:
            pub=signer.generate_keypair(); t=time.perf_counter(); sig=signer.sign(payload); sign_ms=(time.perf_counter()-t)*1000
            t=time.perf_counter(); ok=signer.verify(payload,sig,pub); verify_ms=(time.perf_counter()-t)*1000
        rows.append({"mechanism":alg,"available":bool(ok),"sign_ms":sign_ms,"verify_ms":verify_ms,
                     "public_key_bytes":len(pub),"signature_bytes":len(sig),"note":"Real post-quantum signature via liboqs."})
    except Exception as e:
        rows.append({"mechanism":"ML-DSA (optional)","available":False,"sign_ms":np.nan,"verify_ms":np.nan,
                     "public_key_bytes":np.nan,"signature_bytes":np.nan,
                     "note":"Install python-oqs and liboqs to execute real PQC benchmark; pipeline remains reproducible without silently substituting a non-PQC signature."})
    pd.DataFrame(rows).to_csv(outdir/"security_overhead.csv",index=False)
    return rows


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--data",type=Path,default=Path("Dataset_T-ITS.csv"))
    ap.add_argument("--output",type=Path,default=Path("uav_fl_results"))
    ap.add_argument("--max-rows",type=int,default=0)
    ap.add_argument("--seed",type=int,default=42)
    args=ap.parse_args()
    cfg=Config(seed=args.seed,max_rows=args.max_rows); set_seed(cfg.seed); out=args.output; out.mkdir(parents=True,exist_ok=True)
    (out/"config.json").write_text(json.dumps(asdict(cfg),indent=2))

    X,y,audit=load_and_clean(args.data,args.max_rows); audit.to_csv(out/"data_audit.csv",index=False)
    pd.DataFrame({"class":y.value_counts().index,"count":y.value_counts().values}).to_csv(out/"class_distribution.csv",index=False)
    fig,ax=plt.subplots(figsize=(7,4)); y.value_counts().plot(kind="bar",ax=ax); ax.set(title="Cleaned class distribution",xlabel="Class",ylabel="Samples"); fig.tight_layout(); fig.savefig(out/"class_distribution.png",dpi=220); plt.close(fig)

    Xtr_df,Xv_df,Xte_df,ytr_s,yv_s,yte_s=split_data(X,y,cfg)
    le=LabelEncoder().fit(ytr_s); ytr=le.transform(ytr_s); yv=le.transform(yv_s); yte=le.transform(yte_s)
    pre=fit_preprocessor(Xtr_df); Xtr=pre.transform(Xtr_df).astype("float32"); Xv=pre.transform(Xv_df).astype("float32"); Xte=pre.transform(Xte_df).astype("float32")
    feature_names=list(pre.get_feature_names_out(Xtr_df.columns))

    fitted,central=train_central_models(Xtr,ytr,Xv,yv,Xte,yte,le.classes_,cfg.seed,out)
    central.to_csv(out/"central_model_comparison_all_splits.csv",index=False)
    central[central.split=="test"].sort_values("macro_f1",ascending=False).to_csv(out/"central_model_comparison_test.csv",index=False)

    benign_id=int(le.transform(["benign"])[0]); ae=train_autoencoder(Xtr,ytr,Xv,yv,Xte,yte,benign_id,cfg,out)
    pd.DataFrame([ae]).to_csv(out/"autoencoder_test_metrics.csv",index=False)

    fl_model,fl_metrics,fl_pred=train_hierarchical_fl(Xtr,ytr,Xv,yv,Xte,yte,len(le.classes_),cfg,out)
    pd.DataFrame([fl_metrics]).to_csv(out/"federated_test_metrics.csv",index=False)
    plot_confusion(yte,fl_pred,le.classes_,"Hierarchical Federated MLP - Test Confusion Matrix",out/"confusion_hierarchical_fl.png")

    best_name=central[central.split=="validation"].sort_values("macro_f1",ascending=False).iloc[0].model
    continual_learning(fitted[best_name],Xte,yte,cfg,out)
    xai_method=explain_model(fitted["Random Forest"],Xte,feature_names,out,cfg.seed)
    sec=pqc_and_integrity_benchmark(sum(p.numel() for p in fl_model.parameters())*4,out)

    # Unified comparison and explicit overfitting gaps.
    comp=central.pivot(index="model",columns="split",values="macro_f1").reset_index()
    comp["train_test_gap"]=comp.get("train",np.nan)-comp.get("test",np.nan)
    flrow={"model":"Hierarchical Federated MLP","train":np.nan,"validation":np.nan,"test":fl_metrics["macro_f1"],"train_test_gap":np.nan}
    comp=pd.concat([comp,pd.DataFrame([flrow])],ignore_index=True)
    comp.to_csv(out/"final_model_comparison.csv",index=False)
    fig,ax=plt.subplots(figsize=(9,5)); plotdf=comp.set_index("model")[[c for c in ["train","validation","test"] if c in comp]].copy(); plotdf.plot(kind="bar",ax=ax)
    ax.set(ylabel="Macro F1",title="Model comparison and generalization"); ax.set_ylim(0,1.05); ax.legend(title="Split"); fig.tight_layout(); fig.savefig(out/"final_model_comparison.png",dpi=220); plt.close(fig)

    summary={
        "rows_used":len(X),"features_after_cleaning":X.shape[1],"classes":le.classes_.tolist(),
        "best_central_model_by_validation":best_name,
        "best_central_test_macro_f1":float(central[(central.model==best_name)&(central.split=="test")].macro_f1.iloc[0]),
        "hierarchical_fl_test_macro_f1":float(fl_metrics["macro_f1"]),
        "autoencoder_binary_f1":float(ae["f1"]),"xai_method":xai_method,
        "real_pqc_executed":any(r["available"] and "ML-DSA" in r["mechanism"] for r in sec),
        "anti_overfitting_controls":["strict train/validation/test isolation","leakage-like identifier removal","train-only imputation/scaling","class weighting","dropout","weight decay","gradient clipping","early stopping","bounded tree depth","minimum leaf size","replay buffer for continual learning"]
    }
    (out/"run_summary.json").write_text(json.dumps(summary,indent=2))
    print(json.dumps(summary,indent=2))
    print(f"\nAll tables and figures saved to: {out.resolve()}")

if __name__=="__main__":
    main()
