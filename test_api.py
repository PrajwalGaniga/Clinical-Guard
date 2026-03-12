import requests

def test_login():
    url = "http://localhost:8000/auth/login"
    payload = {
        "username": "ishwarya9448@gmail.com",
        "password": "123" 
    }
    # Wait, what was the password?
    # In the earlier summary, it said prajwal@gmail.com / 12345678.
    # Let me try a few common ones if I don't know it, or just register a new one.
    
    # Actually, I'll register a new user first to be sure of the credentials.
    reg_url = "http://localhost:8000/auth/register"
    reg_payload = {
        "email": "testagent@gmail.com",
        "password": "password123",
        "role": "admin",
        "hospital": "Test Hospital",
        "site_id": "SITE_TEST"
    }
    
    print("--- Registering ---")
    r = requests.post(reg_url, json=reg_payload)
    print(f"Status: {r.status_code}")
    print(f"Resp: {r.text}")
    
    print("\n--- Logging In ---")
    login_payload = {
        "username": "testagent@gmail.com",
        "password": "password123"
    }
    r = requests.post(url, data=login_payload) # OAuth2 form data
    print(f"Status: {r.status_code}")
    print(f"Resp: {r.text}")

if __name__ == "__main__":
    test_login()
