"""
ml_service.py — ClinicalGuard ML Inference

Models loaded (in priority order):
  1. XGBoost  (xgb_model.pkl)  — primary, 99.83% acc, 100% MANIP recall, 0 FP
  2. Random Forest (rf_model.pkl) — secondary, 99.20% acc, 100% MANIP recall
  3. Decision Tree (dt_model.pkl) — tertiary, 98.07% acc, 100% MANIP recall

All three were trained on clinicalguard_realistic_dataset.csv (10,000 rows).
Dataset fraud patterns:
  - SFO (Selective Field Omission): high vitals + HRS near-zero
  - VSM (Vital Sign Manipulation): vitals deflated below thresholds, HRS left high
  - TSF (Trial Score Fabrication): outcome/experience fields contradict clinical profile

Primary metric used during training: MANIPULATED class recall.
Scaler: MinMaxScaler fitted on training split only (bp_systolic max ~167 mmHg).
"""
import os
import json
import pickle
import numpy as np
import pandas as pd
from fastapi import HTTPException

# ── Paths ─────────────────────────────────────────────────────────────
_BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
_MODELS_DIR = os.path.join(_BASE_DIR, "..", "models")

_XGB_PATH   = os.path.join(_MODELS_DIR, "xgb_model.pkl")
_RF_PATH    = os.path.join(_MODELS_DIR, "rf_model.pkl")
_DT_PATH    = os.path.join(_MODELS_DIR, "dt_model.pkl")
_SCALER_PATH = os.path.join(_MODELS_DIR, "scaler.pkl")
_FEAT_PATH  = os.path.join(_MODELS_DIR, "feature_cols.json")


def _load_model(path: str, label: str):
    """Load a pkl model. Returns (model, label) or (None, label) if missing."""
    if not os.path.exists(path):
        print(f"[ML] WARNING: {label} not found at {path}")
        return None, label
    with open(path, "rb") as f:
        m = pickle.load(f)
    print(f"[ML] Loaded {label}")
    return m, label


# ── Load all three models at import time ─────────────────────────────
_xgb, _ = _load_model(_XGB_PATH, "XGBoost")
_rf,  _ = _load_model(_RF_PATH,  "Random Forest")
_dt,  _ = _load_model(_DT_PATH,  "Decision Tree")

# Choose active model (first available in priority order)
_model = _xgb or _rf or _dt
if _model is None:
    raise RuntimeError(
        "[ML FATAL] No model file found in backend/models/. "
        "Run the Colab training notebook and copy pkl files to backend/models/."
    )

# Identify which model is active
if _model is _xgb:
    ACTIVE_MODEL_NAME = "XGBoost"
elif _model is _rf:
    ACTIVE_MODEL_NAME = "Random Forest"
else:
    ACTIVE_MODEL_NAME = "Decision Tree"

# ── Scaler ────────────────────────────────────────────────────────────
with open(_SCALER_PATH, "rb") as f:
    _scaler = pickle.load(f)

# ── Feature column order ──────────────────────────────────────────────
with open(_FEAT_PATH) as f:
    FEATURE_COLS: list[str] = json.load(f)

print(f"[ML] Active model : {ACTIVE_MODEL_NAME}")
print(f"[ML] Features ({len(FEATURE_COLS)}): {FEATURE_COLS}")
print(f"[ML] Scaler bp_systolic max: {_scaler.data_max_[FEATURE_COLS.index('bp_systolic')]:.1f} mmHg")


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

    Returns a full prediction dict including confidence scores, risk level,
    and the recommended blockchain action.

    Raises HTTPException 422 if any required feature is missing.
    The active model is XGBoost (primary) → RF → DT (fallback).
    """
    # Validate all features present
    missing = [col for col in FEATURE_COLS if col not in record]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Missing required features: {missing}"
        )

    # Build DataFrame in exact feature order
    df = pd.DataFrame([record])[FEATURE_COLS]
    df = df.fillna(0)

    # Scale using the training-fitted scaler
    scaled = _scaler.transform(df)

    # Predict
    label = int(_model.predict(scaled)[0])
    proba = _model.predict_proba(scaled)[0]

    # proba[0] = P(MANIPULATED=0), proba[1] = P(AUTHENTIC=1)
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
        "model_used":             ACTIVE_MODEL_NAME,
    }


def verify_model_working():
    """
    Run five known records through the active model at startup.
    Prints PASS/FAIL for each. If any FAIL, logs a loud warning.
    Called by main.py lifespan startup event.
    """
    sanity_cases = [
        ("Healthy patient",              {"age":35,"bp_systolic":115,"bp_diastolic":75,"glucose":90,"hr":68,"spo2":99,"diagnosis_encoded":4,"previous_trials":1,"product_experience":2,"last_trial_outcome":1,"health_risk_score":0.12,"age_grp_adult":1,"age_grp_elderly":0}, "AUTHENTIC"),
        ("SFO: high vitals, HRS=0.05",  {"age":52,"bp_systolic":148,"bp_diastolic":95,"glucose":165,"hr":105,"spo2":92,"diagnosis_encoded":2,"previous_trials":2,"product_experience":1,"last_trial_outcome":0,"health_risk_score":0.05,"age_grp_adult":1,"age_grp_elderly":0}, "MANIPULATED"),
        ("VSM: normal vitals, HRS=0.72",{"age":45,"bp_systolic":132,"bp_diastolic":85,"glucose":118,"hr":94,"spo2":96,"diagnosis_encoded":1,"previous_trials":1,"product_experience":1,"last_trial_outcome":1,"health_risk_score":0.72,"age_grp_adult":1,"age_grp_elderly":0}, "MANIPULATED"),
        ("TSF: high risk, outcome=1",   {"age":58,"bp_systolic":155,"bp_diastolic":98,"glucose":175,"hr":108,"spo2":90,"diagnosis_encoded":2,"previous_trials":2,"product_experience":2,"last_trial_outcome":1,"health_risk_score":0.78,"age_grp_adult":1,"age_grp_elderly":0}, "MANIPULATED"),
        ("Elderly authentic",           {"age":68,"bp_systolic":135,"bp_diastolic":85,"glucose":130,"hr":78,"spo2":96,"diagnosis_encoded":1,"previous_trials":3,"product_experience":1,"last_trial_outcome":1,"health_risk_score":0.42,"age_grp_adult":0,"age_grp_elderly":1}, "AUTHENTIC"),
    ]

    print(f"\n[ML VERIFY] Running startup sanity checks — model: {ACTIVE_MODEL_NAME}")
    all_pass = True
    for desc, rec, expected in sanity_cases:
        result = predict(rec)
        got    = result["decision"]
        status = "PASS" if got == expected else "FAIL"
        if status == "FAIL":
            all_pass = False
        conf = result["confidence_manipulated"] if expected == "MANIPULATED" else result["confidence_authentic"]
        print(f"[ML VERIFY] {status}  {desc}")
        print(f"            Expected={expected}  Got={got}  Conf={conf:.1f}%")

    if all_pass:
        print(f"[ML VERIFY] All {len(sanity_cases)} sanity checks passed. Model is operational.\n")
    else:
        print(
            "[ML VERIFY] WARNING: Some sanity checks FAILED.\n"
            "  The model may not reliably detect all fraud patterns.\n"
            "  Investigate feature order and scaler compatibility.\n"
        )
