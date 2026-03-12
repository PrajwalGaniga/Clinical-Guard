import requests
import json
import csv
import sys
import time

BASE_URL = "http://127.0.0.1:8000"
CSV_PATH = r"C:\Users\ASUS\Desktop\Projects\Sailesh SIr\ClinicalGuard\clinicalguard_test_upload.csv"
EMAIL = "praj@gmail.com"
PASSWORD = "prajwal"

def print_result(name, res):
    print(f"\n--- {name} ---")
    print(f"Status: {res.status_code}")
    try:
        print(f"Response: {json.dumps(res.json(), indent=2)[:500]}...")
    except:
        print(f"Response: {res.text[:500]}...")

def main():
    try:
        # 1. Health check
        res = requests.get(f"{BASE_URL}/health")
        print_result("Health Check", res)
        if res.status_code != 200:
            print("Backend is not running. Exiting.")
            sys.exit(1)
            
        token = None

        # 2. Login
        login_data = {"username": EMAIL, "password": PASSWORD}
        res = requests.post(f"{BASE_URL}/auth/login", data=login_data)
        print_result("Login", res)
        
        if res.status_code == 401:
            print("Login failed, attempting to register the user...")
            register_data = {
                "email": EMAIL,
                "password": PASSWORD,
                "role": "investigator",
                "hospital": "Test Hospital",
                "site_id": "SITE_TEST"
            }
            res_reg = requests.post(f"{BASE_URL}/auth/register", json=register_data)
            print_result("Register", res_reg)
            
            # Retry login
            res = requests.post(f"{BASE_URL}/auth/login", data=login_data)
            print_result("Login Retry", res)

        if res.status_code == 200:
            token = res.json().get("access_token")
            print(f"Obtained Token: {token[:20]}...")
        else:
            print("Could not obtain token. Tests will fail.")
            sys.exit(1)

        headers = {"Authorization": f"Bearer {token}"}

        # 3. /auth/me
        res = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        print_result("Auth Me", res)

        # 4. /predict/single
        single_payload = {
            "age": 45,
            "bp_systolic": 120,
            "bp_diastolic": 80,
            "glucose": 90,
            "hr": 70,
            "spo2": 98,
            "diagnosis_encoded": 1,
            "previous_trials": 0,
            "product_experience": 1,
            "last_trial_outcome": 1,
            "health_risk_score": 0.35,
            "age_grp_adult": 1,
            "age_grp_elderly": 0,
            "trial_id": "TEST_TRIAL",
            "site_id": "TEST_SITE",
            "hospital": "TEST_HOSPITAL"
        }
        res = requests.post(f"{BASE_URL}/predict/single", json=single_payload, headers=headers)
        print_result("Predict Single", res)

        # 5. Read CSV and prepare /predict/batch
        batch_payload = []
        with open(CSV_PATH, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                if i >= 10: # Only take first 10 for quick testing
                    break
                # Convert string values to correct types based on TrialRecord model
                try:
                    record = {
                        "age": float(row["age"]),
                        "bp_systolic": float(row["bp_systolic"]),
                        "bp_diastolic": float(row["bp_diastolic"]),
                        "glucose": float(row["glucose"]),
                        "hr": float(row["hr"]),
                        "spo2": float(row["spo2"]),
                        "diagnosis_encoded": int(row["diagnosis_encoded"]),
                        "previous_trials": int(row["previous_trials"]),
                        "product_experience": float(row["product_experience"]),
                        "last_trial_outcome": float(row["last_trial_outcome"]),
                        "health_risk_score": float(row["health_risk_score"]),
                        "age_grp_adult": int(row["age_grp_adult"]),
                        "age_grp_elderly": int(row["age_grp_elderly"]),
                        "trial_id": row["trial_id"],
                        "site_id": row["site_id"],
                        "hospital": "Test Hospital from CSV"
                    }
                    batch_payload.append(record)
                except Exception as e:
                    print(f"Error parsing row {i}: {e}")

        print(f"Prepared {len(batch_payload)} records for batch prediction.")
        res = requests.post(f"{BASE_URL}/predict/batch", json=batch_payload, headers=headers)
        print_result("Predict Batch", res)

        # 6. /dashboard/stats
        res = requests.get(f"{BASE_URL}/dashboard/stats", headers=headers)
        print_result("Dashboard Stats", res)

        # 7. /records
        res = requests.get(f"{BASE_URL}/records?limit=5", headers=headers)
        print_result("Records List", res)
        
        # 8. /audit (if investigator has permission, wait audit route requires admin/regulator/monitor)
        # Let's see if we get a 403
        res = requests.get(f"{BASE_URL}/audit?limit=2", headers=headers)
        print_result("Audit List (Expected 403 if investigator)", res)
        
        # 9. /mentor/chat
        mentor_payload = {"message": "Is a health_risk_score of 0 normal for an active patient?"}
        res = requests.post(f"{BASE_URL}/mentor/chat", json=mentor_payload, headers=headers)
        print_result("Mentor Chat", res)

        print("\nAll tests executed successfully.")

    except requests.exceptions.ConnectionError:
        print("Failed to connect to backend on 127.0.0.1:8000. Please start the server.")

if __name__ == "__main__":
    main()
