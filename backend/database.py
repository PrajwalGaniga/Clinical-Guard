from motor.motor_asyncio import AsyncIOMotorClient
from .config import get_settings

settings = get_settings()

_client: AsyncIOMotorClient = None


async def connect_to_mongo():
    global _client
    _client = AsyncIOMotorClient(settings.MONGODB_URL)
    print(f"[DB] Connected to MongoDB at {settings.MONGODB_URL}")


async def close_mongo_connection():
    global _client
    if _client:
        _client.close()
        print("[DB] MongoDB connection closed.")


def get_database():
    return _client[settings.DATABASE_NAME]
