from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

async def check_users():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.clinicalguard
    users = await db.users.find().to_list(length=100)
    print(f"Total users: {len(users)}")
    for u in users:
        print(f"- {u.get('email')} (Role: {u.get('role')})")

if __name__ == "__main__":
    asyncio.run(check_users())
