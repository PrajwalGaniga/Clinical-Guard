from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "clinicalguard"

    # JWT
    JWT_SECRET: str = "your_super_secret_key_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

    # Gemini
    GEMINI_API_KEY: str = ""

    # Blockchain (leave empty for stub mode)
    POLYGON_RPC_URL: str = ""
    CONTRACT_ADDRESS: str = ""

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
