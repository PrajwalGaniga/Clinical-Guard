"""
config.py — ClinicalGuard Backend Configuration

SECURITY RULES:
  1. JWT_SECRET must be set explicitly in .env.
     The default value is an INSECURE PLACEHOLDER.
     If the server starts with the default, it refuses to boot.

  2. All secrets must come from .env or environment variables.
     No secret is hardcoded here.

  3. GEMINI_API_KEY must be set in .env, not in source code.
"""
import sys
from pydantic_settings import BaseSettings
from functools import lru_cache

# The forbidden default — if JWT_SECRET equals this value the server
# will refuse to start. Change it to any strong random string in .env.
_INSECURE_JWT_DEFAULT = "your_super_secret_key_change_in_production"


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "clinicalguard"

    # JWT
    # Generate a strong secret with:   python -c "import secrets; print(secrets.token_hex(32))"
    # Then set it in backend/.env:     JWT_SECRET=<generated_value>
    JWT_SECRET: str = _INSECURE_JWT_DEFAULT
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

    # Google Gemini AI
    # Set in backend/.env — do NOT put the real key in source code.
    GEMINI_API_KEY: str = ""

    # Polygon Blockchain (leave BOTH empty for stub mode)
    POLYGON_RPC_URL: str = ""
    CONTRACT_ADDRESS: str = ""

    # CORS — React frontend origins (comma-separated)
    CORS_ORIGINS: str = (
        "http://localhost:5173,http://localhost:5174,"
        "http://localhost:5175,http://localhost:3000"
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    s = Settings()

    # ── Security gate: block startup with insecure JWT secret ──────
    if s.JWT_SECRET == _INSECURE_JWT_DEFAULT:
        print(
            "\n[FATAL] JWT_SECRET is still the insecure default placeholder.\n"
            "  ClinicalGuard will NOT start with an insecure signing key.\n\n"
            "  Fix:\n"
            "    1. Generate a secret:\n"
            "         python -c \"import secrets; print(secrets.token_hex(32))\"\n"
            "    2. Set it in backend/.env:\n"
            "         JWT_SECRET=<your_generated_secret>\n"
            "    3. Restart the server.\n",
            file=sys.stderr,
        )
        sys.exit(1)

    # ── Warn if Gemini key is missing (non-fatal — Gemini is optional) ─
    if not s.GEMINI_API_KEY:
        print(
            "[WARN] GEMINI_API_KEY is not set. Gemini AI reasoning will be "
            "unavailable. Set it in backend/.env.",
            file=sys.stderr,
        )

    return s
