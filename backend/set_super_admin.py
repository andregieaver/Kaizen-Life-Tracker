import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def set_super_admin():
    # Get MongoDB URL from environment
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(mongo_url)
    db_name = os.environ.get('DB_NAME', 'health_coach')
    db = client[db_name]
    
    # Update andre@humanweb.no to be super admin
    result = await db.athletes.update_one(
        {"email": "andre@humanweb.no"},
        {"$set": {"is_super_admin": True}}
    )
    
    if result.modified_count > 0:
        print("✅ Successfully set andre@humanweb.no as super admin")
    elif result.matched_count > 0:
        print("✅ andre@humanweb.no is already a super admin")
    else:
        print("❌ User andre@humanweb.no not found")
    
    # Verify the update
    user = await db.athletes.find_one({"email": "andre@humanweb.no"}, {"_id": 0, "email": 1, "name": 1, "is_super_admin": 1})
    if user:
        print(f"User details: {user}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(set_super_admin())
