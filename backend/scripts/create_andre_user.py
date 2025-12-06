import asyncio
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from passlib.context import CryptContext
import uuid

load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_andre_user():
    """Create user andre@humanweb.no with password Pernilla66!"""
    
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("🔧 Creating user andre@humanweb.no...")
    
    # Check if user already exists
    existing = await db.athlete_profiles.find_one({"email": "andre@humanweb.no"})
    if existing:
        print("⚠️  User already exists. Updating password...")
        # Update password
        hashed_password = pwd_context.hash("Pernilla66!")
        await db.athlete_profiles.update_one(
            {"email": "andre@humanweb.no"},
            {"$set": {"password": hashed_password}}
        )
        print("✅ Password updated for andre@humanweb.no")
    else:
        # Create new user
        athlete_id = str(uuid.uuid4())
        hashed_password = pwd_context.hash("Pernilla66!")
        
        athlete_data = {
            "id": athlete_id,
            "name": "Andre",
            "email": "andre@humanweb.no",
            "password": hashed_password,
            "age": 35,
            "weekly_mileage": 40.0,
            "recent_race_time": "10K: 45:00",
            "running_goals": "Improve endurance and consistency in training",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.athlete_profiles.insert_one(athlete_data)
        print(f"✅ Created user andre@humanweb.no (ID: {athlete_id})")
    
    print("\n📋 User Details:")
    print("   Email: andre@humanweb.no")
    print("   Password: Pernilla66!")
    print("\n✅ User ready to login!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_andre_user())
