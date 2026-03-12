import sys, traceback
sys.path.insert(0, '.')

# Isolate each import 
modules = [
    "backend.config",
    "backend.database",
    "backend.auth_utils",
    "backend.services.ml_service",
    "backend.services.hash_service",
    "backend.services.blockchain_service",
    "backend.services.gemini_service",
    "backend.routes.auth",
    "backend.routes.predict",
    "backend.routes.dashboard",
    "backend.routes.records",
    "backend.routes.audit",
    "backend.main",
]

for mod in modules:
    try:
        __import__(mod)
        print(f"OK: {mod}")
    except Exception as e:
        print(f"FAIL: {mod} -> {type(e).__name__}: {e}")
        # Print first few lines of traceback to log file
        with open("import_errors.txt", "a") as f:
            f.write(f"\n{'='*60}\nFAIL: {mod}\n")
            traceback.print_exc(file=f)
        break  # Stop at first failure
