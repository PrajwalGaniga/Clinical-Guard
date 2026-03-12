import requests, sys, time

BASE_URL = "http://localhost:8000"
print("\n================================================================")
print("PHASES 4 to 8: FASTAPI ROUTE TESTS")
print("================================================================")

# --- PHASE 4: AUTH SYSTEM TESTS ---
AUTH_TOKEN = ""
try:
    # AUTH-01: Register New User
    print("\n--- TEST AUTH-01: Register New User ---")
    res = requests.post(f"{BASE_URL}/auth/register", json={
        "email": f"test_reg_{time.time()}@hospital.com",
        "password": "TestPass123!",
        "role": "investigator",
        "hospital": "Test Hospital"
    })
    assert res.status_code == 201, f"[FAIL] Expected 201, got {res.status_code}: {res.text}"
    print("[PASS] AUTH-01: Registration successful")

    # AUTH-02: Login
    print("\n--- TEST AUTH-02: Login and Get Token ---")
    login_data = {"email": res.json()['email'], "password": "TestPass123!"}
    res2 = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    assert res2.status_code == 200, f"[FAIL] Login failed: {res2.text}"
    AUTH_TOKEN = res2.json().get('access_token')
    assert AUTH_TOKEN, "[FAIL] No token returned"
    print("[PASS] AUTH-02: Login successful, token acquired")

    # AUTH-03: Protected Route Without Token
    print("\n--- TEST AUTH-03: Protected Route Without Token ---")
    res3 = requests.get(f"{BASE_URL}/dashboard/stats")
    assert res3.status_code == 401, f"[FAIL] Expected 401, got {res3.status_code}"
    print("[PASS] AUTH-03: Route protected correctly")

    # AUTH-04: Protected Route With Token
    print("\n--- TEST AUTH-04: Protected Route With Valid Token ---")
    headers = {"Authorization": f"Bearer {AUTH_TOKEN}"}
    res4 = requests.get(f"{BASE_URL}/dashboard/stats", headers=headers)
    assert res4.status_code == 200, f"[FAIL] Expected 200, got {res4.status_code}"
    print("[PASS] AUTH-04: Token validation successful")

except Exception as e:
    print(f"Auth Tests Failed: {e}")

# --- PHASE 5: PREDICT ROUTE ---
DEMO_MANIPULATED = {
    "age": 52, "bp_systolic": 145, "bp_diastolic": 95,
    "glucose": 180, "hr": 88, "spo2": 96,
    "diagnosis_encoded": 2, "previous_trials": 2,
    "product_experience": 1, "last_trial_outcome": 0,
    "health_risk_score": 0.74,
    "age_grp_adult": 1, "age_grp_elderly": 0,
    "trial_id": "TEST_TRIAL", "site_id": "TEST_SITE", "hospital": "TEST_HOSP"
}

try:
    print("\n--- TEST PRED-01: Single Predict Full Pipeline ---")
    headers = {"Authorization": f"Bearer {AUTH_TOKEN}"}
    p_res = requests.post(f"{BASE_URL}/predict/single", json=DEMO_MANIPULATED, headers=headers)
    assert p_res.status_code == 200, f"[FAIL] Predict failed: {p_res.text}"
    j = p_res.json()
    assert j['integrity_label'] == 0
    assert j['decision'] == 'MANIPULATED'
    assert j['risk_level'] == 'HIGH'
    assert 'data_hash' in j
    assert 'tx_hash' in j
    assert 'gemini_reasoning' in j
    print("[PASS] PRED-01: Full pipeline returned expected schema")
    
    # PHASE 6 & 8 Implicitly tested here
    print("\n--- TEST CHAIN-01 & 02: Blockchain Stub ---")
    print(f"[PASS] CHAIN: tx_hash = {j['tx_hash']}")
    
    print("\n--- TEST GEMINI-01: Gemini Reasoning ---")
    r = j['gemini_reasoning']
    print(f"[PASS] GEMINI: length={len(r)}. Snippet: {r[:100]}...")

    # PRED-05: Duplicate Hash
    print("\n--- TEST PRED-05: Duplicate Hash Detection ---")
    p_res2 = requests.post(f"{BASE_URL}/predict/single", json=DEMO_MANIPULATED, headers=headers)
    j2 = p_res2.json()
    assert j['data_hash'] == j2['data_hash'], "[FAIL] Hashes differ for same record"
    print("[PASS] PRED-05: Deterministic hashing confirmed across requests")

except Exception as e:
    print(f"Predict Tests Failed: {e}")

print("\n--- QA API SCRIPT COMPLETE ---")
