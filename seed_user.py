import asyncio
from datetime import datetime
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorClient

# Hashing setup matches auth_utils.py
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

async def seed():
    # Connection details
    MONGODB_URL = "mongodb://localhost:27017"
    DATABASE_NAME = "clinicalguard"
    
    print(f"Connecting to {MONGODB_URL}...")
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    email = "praj@gmail.com"
    password = "prajwal"
    role = "admin"
    hospital = "Sahyadri Hospital"
    
    # Check if exists
    existing = await db.users.find_one({"email": email})
    if existing:
        print(f"User {email} already exists. Updating password...")
        await db.users.update_one(
            {"email": email},
            {"$set": {"hashed_password": hash_password(password), "role": role}}
        )
    else:
        print(f"Creating new user {email}...")
        user_doc = {
            "email": email,
            "hashed_password": hash_password(password),
            "role": role,
            "hospital": hospital,
            "site_id": "SITE_001",
            "created_at": datetime.utcnow(),
        }
        await db.users.insert_one(user_doc)
    
    print("Seed complete! You can now login with:")
    print(f"Email: {email}")
    print(f"Password: {password}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed())
