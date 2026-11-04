"""
SEAQL - make the saved Hybrid stack portable across Windows / Linux / Mac.

XGBoost's pickled binary booster can fail to load on another platform
("XGBoostError: input stream corrupted"). This script stores every fitted XGBoost
booster in XGBoost's official portable JSON format (models/hybrid/xgb_boosters.json)
and saves the rest of the stack without the binary booster (models/hybrid/stack_portable.joblib).
The model itself is NOT changed - predictions are checked to be identical.

    python backend/make_portable_xgb.py
"""
import json, sys, base64
from pathlib import Path
import joblib, numpy as np

D = Path(__file__).resolve().parent / "models" / "hybrid"

def xgb_estimators(stack):
    return [(i, e) for i, e in enumerate(stack.estimators_) if type(e).__module__.startswith("xgboost")]

def main():
    import xgboost as xgb
    stack = joblib.load(D / "stack.joblib")
    found = xgb_estimators(stack)
    if not found:
        print("no XGBoost estimators found"); return 1
    rng = np.random.default_rng(0)
    nfeat = stack.estimators_[0].n_features_in_
    Xs = rng.normal(size=(500, nfeat)).astype("float32")
    before = stack.predict_proba(Xs)
    out = {}
    for i, e in found:
        out[str(i)] = e.get_booster().save_raw(raw_format="json").decode("utf-8")
        e._Booster = None
    (D / "xgb_boosters.json").write_text(json.dumps({"xgboost_version": xgb.__version__, "boosters": out}))
    joblib.dump(stack, D / "stack_portable.joblib", compress=3)
    # reload exactly like the server does and compare
    s2 = joblib.load(D / "stack_portable.joblib")
    restore(s2)
    after = s2.predict_proba(Xs)
    diff = float(np.abs(before - after).max())
    print(f"XGBoost boosters saved as JSON: {list(out)}; max prediction difference = {diff:.2e}")
    return 0 if diff < 1e-6 else 2

def restore(stack):
    import xgboost as xgb
    data = json.loads((D / "xgb_boosters.json").read_text())["boosters"]
    for i, js in data.items():
        b = xgb.Booster(); b.load_model(bytearray(js.encode("utf-8")))
        stack.estimators_[int(i)]._Booster = b
    return stack

if __name__ == "__main__":
    sys.exit(main())
