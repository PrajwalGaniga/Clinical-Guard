import pickle, json
import pandas as pd
from fastapi import HTTPException
import sys, os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

print("================================================================")
print("PHASE 2: ML SERVICE — CRITICAL PIPELINE TESTS")
print("================================================================")

# --- TEST ML-01: Model Loading ---
try:
    model  = pickle.load(open('backend/models/dt_model.pkl', 'rb'))
    scaler = pickle.load(open('backend/models/scaler.pkl',   'rb'))
    feats  = json.load(open('backend/models/feature_cols.json'))

    print(f"[ML-01] Model type   : {type(model).__name__}")
    print(f"[ML-01] Scaler type  : {type(scaler).__name__}")
    print(f"[ML-01] Feature count: {len(feats)}")
    # print(f"[ML-01] Features     : {feats}")
    assert len(feats) == 13, "[FAIL] Feature count must be 13"
    print("[PASS] ML-01: Model loading successful")
except Exception as e:
    print(f"[FAIL] ML-01: {e}")
    sys.exit(1)

# --- TEST ML-02: Demo Record — MANIPULATED (Must return label=0) ---
DEMO_MANIPULATED = {
    "age": 52, "bp_systolic": 145, "bp_diastolic": 95,
    "glucose": 180, "hr": 88, "spo2": 96,
    "diagnosis_encoded": 2, "previous_trials": 2,
    "product_experience": 1, "last_trial_outcome": 0,
    "health_risk_score": 0.74,
    "age_grp_adult": 1, "age_grp_elderly": 0
}
try:
    df     = pd.DataFrame([DEMO_MANIPULATED])[feats]
    scaled = scaler.transform(df)
    label  = model.predict(scaled)[0]
    proba  = model.predict_proba(scaled)[0]

    print(f"[ML-02] Label           : {label}")
    print(f"[ML-02] Prob Authentic  : {proba[1]*100:.2f}%")
    print(f"[ML-02] Prob Manipulated: {proba[0]*100:.2f}%")
    assert label == 0,        "[FAIL] Expected MANIPULATED (0), got AUTHENTIC (1)"
    assert proba[0] >= 0.80,  "[FAIL] Manipulation confidence too low (expected >= 80%)"
    print("[PASS] ML-02: Demo MANIPULATED record correctly classified")
except Exception as e:
    print(f"[FAIL] ML-02: {e}")

# --- TEST ML-03: Authentic Record (Must return label=1) ---
DEMO_AUTHENTIC = {
    "age": 35, "bp_systolic": 118, "bp_diastolic": 76,
    "glucose": 92, "hr": 70, "spo2": 98,
    "diagnosis_encoded": 4, "previous_trials": 1,
    "product_experience": 1, "last_trial_outcome": 1,
    "health_risk_score": 0.28,
    "age_grp_adult": 1, "age_grp_elderly": 0
}
try:
    df     = pd.DataFrame([DEMO_AUTHENTIC])[feats]
    scaled = scaler.transform(df)
    label  = model.predict(scaled)[0]
    proba  = model.predict_proba(scaled)[0]

    print(f"[ML-03] Label           : {label}")
    print(f"[ML-03] Prob Authentic  : {proba[1]*100:.2f}%")
    assert label == 1,        "[FAIL] Expected AUTHENTIC (1), got MANIPULATED (0)"
    assert proba[1] >= 0.80,  "[FAIL] Authentic confidence too low (expected >= 80%)"
    print("[PASS] ML-03: Demo AUTHENTIC record correctly classified")
except Exception as e:
    print(f"[FAIL] ML-03: {e}")

# --- TEST ML-04 & ML-05: Tested implicitly by Pydantic in FastAPI routes

# --- PHASE 3: HASH SERVICE TESTS ---
print("\n================================================================")
print("PHASE 3: HASH SERVICE TESTS")
print("================================================================")
try:
    from backend.services.hash_service import hash_record
    hash_1 = hash_record(DEMO_MANIPULATED)
    hash_2 = hash_record(DEMO_MANIPULATED.copy())
    assert hash_1 == hash_2,  "[FAIL] Same record produces different hashes"
    assert len(hash_1) == 64, "[FAIL] SHA-256 hash must be 64 hex characters"
    print(f"[PASS] HASH-01: Hash = {hash_1[:16]}...{hash_1[-8:]}")
    
    tampered = DEMO_MANIPULATED.copy()
    tampered["age"] = 99
    hash_tampered = hash_record(tampered)
    assert hash_1 != hash_tampered, "[FAIL] Tampered record produced same hash — hashing is broken"
    print("[PASS] HASH-02: Tamper correctly detected via hash mismatch")
except Exception as e:
    print(f"[FAIL] HASH: {e}")
