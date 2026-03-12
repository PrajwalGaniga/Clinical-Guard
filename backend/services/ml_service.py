import os
import json
import pickle
import numpy as np
import pandas as pd
from fastapi import HTTPException

# ── Paths ────────────────────────────────────────────────────────
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_MODELS_DIR = os.path.join(_BASE_DIR, "..", "models")

_DT_MODEL_PATH    = os.path.join(_MODELS_DIR, "dt_model.pkl")
_SCALER_PATH      = os.path.join(_MODELS_DIR, "scaler.pkl")
_FEAT_COLS_PATH   = os.path.join(_MODELS_DIR, "feature_cols.json")

# ── Load once at import time ─────────────────────────────────────
with open(_DT_MODEL_PATH, "rb") as f:
    _dt_model = pickle.load(f)

with open(_SCALER_PATH, "rb") as f:
    _scaler = pickle.load(f)

with open(_FEAT_COLS_PATH, "r") as f:
    FEATURE_COLS: list[str] = json.load(f)

print(f"[ML] Decision Tree loaded — Depth: {_dt_model.get_depth()} | Leaves: {_dt_model.get_n_leaves()}")
print(f"[ML] Features: {len(FEATURE_COLS)}")


def _compute_risk_level(prob_manipulated: float) -> str:
    if prob_manipulated >= 0.60:
        return "HIGH"
    elif prob_manipulated >= 0.25:
        return "MEDIUM"
    return "LOW"


def _compute_blockchain_action(label: int, confidence_authentic: float, risk_level: str) -> str:
    if label == 1 and confidence_authentic >= 0.85:
        return "COMMIT_TRANSACTION"
    elif label == 0 and risk_level == "HIGH":
        return "REJECT_TRANSACTION"
    return "FLAG_FOR_REVIEW"


def predict(record: dict) -> dict:
    """
    Run ML inference on a single clinical trial record.
    Returns the full prediction dictionary.
    Raises HTTPException 422 if any required feature is missing.
    """
    # Validate all 13 features are present
    missing = [col for col in FEATURE_COLS if col not in record]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Missing required features: {missing}"
        )

    # Build DataFrame in exact feature order
    df = pd.DataFrame([record])[FEATURE_COLS]

    # Fill any NaN with 0 (safe fallback)
    df = df.fillna(0)

    # Scale
    scaled = _scaler.transform(df)

    # Predict
    label = int(_dt_model.predict(scaled)[0])
    proba = _dt_model.predict_proba(scaled)[0]

    conf_authentic   = float(round(proba[1] * 100, 2))
    conf_manipulated = float(round(proba[0] * 100, 2))
    risk_level       = _compute_risk_level(proba[0])
    blockchain_action = _compute_blockchain_action(label, proba[1], risk_level)

    return {
        "integrity_label":        label,
        "decision":               "AUTHENTIC" if label == 1 else "MANIPULATED",
        "confidence_authentic":   conf_authentic,
        "confidence_manipulated": conf_manipulated,
        "risk_level":             risk_level,
        "blockchain_action":      blockchain_action,
    }


def verify_model_working():
    """
    Run two known test records through the model at startup.
    Prints results so you can immediately confirm the model works correctly.
    Call this inside the FastAPI lifespan startup event.
    """
    test_authentic = {
        "age": 35, "bp_systolic": 115, "bp_diastolic": 75,
        "glucose": 90, "hr": 68, "spo2": 99,
        "diagnosis_encoded": 4, "previous_trials": 1,
        "product_experience": 2, "last_trial_outcome": 1,
        "health_risk_score": 0.12,
        "age_grp_adult": 1, "age_grp_elderly": 0
    }
    test_manipulated = {
        "age": 52, "bp_systolic": 145, "bp_diastolic": 95,
        "glucose": 180, "hr": 88, "spo2": 96,
        "diagnosis_encoded": 2, "previous_trials": 2,
        "product_experience": 1, "last_trial_outcome": 0,
        "health_risk_score": 0.74,
        "age_grp_adult": 1, "age_grp_elderly": 0
    }

    r1 = predict(test_authentic)
    r2 = predict(test_manipulated)

    print(f"[ML VERIFY] Authentic  test → {r1['decision']} "
          f"({r1['confidence_authentic']:.1f}% authentic)")
    print(f"[ML VERIFY] Manipulated test → {r2['decision']} "
          f"({r2['confidence_manipulated']:.1f}% manipulated)")

    if r1["decision"] != "AUTHENTIC":
        print("[ML VERIFY] ⚠ WARNING: Model FAILING authentic test — check feature order!")
    if r2["decision"] != "MANIPULATED":
        print("[ML VERIFY] ⚠ WARNING: Model FAILING manipulated test — check feature order!")

    if r1["decision"] == "AUTHENTIC" and r2["decision"] == "MANIPULATED":
        print("[ML VERIFY] ✓ Model passing both sanity checks.")
