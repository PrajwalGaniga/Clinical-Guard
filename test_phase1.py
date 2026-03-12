"""
Phase 1 Validation Test — ClinicalGuard Backend
Run from ClinicalGuard/ directory:
  python test_phase1.py

NOTE: The demo record uses a verified MANIPULATED record from the dataset.
The manipulation was injected via Value Substitution (VSM): vitals inflated 1.6-2.8x.
e.g. bp_diastolic = 219.98 (a critically abnormal level — clearly manipulated).
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.services.ml_service import predict
from backend.services.hash_service import hash_record
from backend.services.blockchain_service import submit_to_blockchain

# ── This is a REAL MANIPULATED record from engineered_dataset.csv ─
# Row 0: age=65, bp_diastolic=219.98 (inflated 2.8x via VSM injection)
# integrity_label = 0 (MANIPULATED)
DEMO_RECORD = {
    "age": 65,
    "bp_systolic": 349.24,
    "bp_diastolic": 219.98,
    "glucose": 289.50,
    "hr": 125.60,
    "spo2": 96.0,
    "diagnosis_encoded": 0,
    "previous_trials": 3,
    "product_experience": 2.0,
    "last_trial_outcome": 1.0,
    "health_risk_score": 0.516503,
    "age_grp_adult": 0,
    "age_grp_elderly": 1,
}

print("=" * 60)
print("  CLINICALGUARD — PHASE 1 VALIDATION TEST")
print("=" * 60)

# Test 1: ML Prediction
print("\n[TEST 1] ML Prediction ...")
result = predict(DEMO_RECORD)
print(f"  Decision            : {result['decision']}")
print(f"  Integrity Label     : {result['integrity_label']}")
print(f"  Conf Authentic      : {result['confidence_authentic']}%")
print(f"  Conf Manipulated    : {result['confidence_manipulated']}%")
print(f"  Risk Level          : {result['risk_level']}")
print(f"  Blockchain Action   : {result['blockchain_action']}")

assert result["decision"] == "MANIPULATED", f"FAIL: Expected MANIPULATED, got {result['decision']}"
assert result["risk_level"] == "HIGH", f"FAIL: Expected HIGH risk, got {result['risk_level']}"
assert result["confidence_manipulated"] > 50, "FAIL: Manipulated confidence should be > 50%"
print("  ✅ ML TEST PASSED")

# Test 2: SHA-256 Hash
print("\n[TEST 2] SHA-256 Hashing ...")
h = hash_record(DEMO_RECORD)
print(f"  Hash (first 32 chars): {h[:32]}...")
assert len(h) == 64, "FAIL: Hash should be 64 hex characters"
h2 = hash_record(DEMO_RECORD)
assert h == h2, "FAIL: Hash should be deterministic"
print("  ✅ HASH TEST PASSED")

# Test 3: Blockchain Stub
print("\n[TEST 3] Blockchain Stub ...")
bc = submit_to_blockchain(h, result["integrity_label"], result["confidence_manipulated"]/100, result["risk_level"])
print(f"  TX Hash    : {bc['tx_hash']}")
print(f"  Network    : {bc['network']}")
print(f"  Status     : {bc['status']}")
assert bc["status"] == "STUB_SUCCESS", "FAIL: Blockchain stub did not return STUB_SUCCESS"
print("  ✅ BLOCKCHAIN STUB TEST PASSED")

print("\n" + "=" * 60)
print("  ✅ ALL PHASE 1 TESTS PASSED — ENGINE IS WORKING CORRECTLY")
print("=" * 60)
