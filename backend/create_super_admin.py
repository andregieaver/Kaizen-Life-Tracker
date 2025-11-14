import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import uuid
from datetime import datetime, timezone
import bcrypt

load_dotenv()

async def create_super_admin():
    # Get MongoDB URL from environment
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(mongo_url)
    db_name = os.environ.get('DB_NAME', 'trainsmart')
    db = client[db_name]
    
    # Check if user already exists
    existing_user = await db.athletes.find_one({"email": "andre@humanweb.no"})
    
    if existing_user:
        # Update existing user to be super admin and set the correct ID
        await db.athletes.update_one(
            {"email": "andre@humanweb.no"},
            {"$set": {
                "is_super_admin": True,
                "id": "77e6ef02-0c9e-4ede-a428-213b83eed1fe"
            }}
        )
        print("✅ Updated existing user andre@humanweb.no to super admin with correct ID")
    else:
        # Create new super admin user
        hashed_password = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        athlete_data = {
            "id": "77e6ef02-0c9e-4ede-a428-213b83eed1fe",  # Use the specific ID from the test
            "name": "André Giæver",
            "email": "andre@humanweb.no",
            "password": hashed_password,
            "profile_picture": None,
            "age": None,
            "date_of_birth": None,
            "weekly_mileage": 0.0,
            "recent_race_time": None,
            "running_goals": "General fitness",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "height": None,
            "weight": None,
            "vo2_max": None,
            "max_heart_rate": None,
            "gender": None,
            "bio": None,
            "interests": [],
            "estimated_calorie_need": None,
            "weight_goal": None,
            "health_goals": [],
            "allergies": [],
            "dietary_preferences": [],
            "distance_unit": "km",
            "measurement_system": "metric",
            "week_starts_on": "monday",
            "is_super_admin": True
        }
        
        await db.athletes.insert_one(athlete_data)
        print("✅ Created new super admin user: andre@humanweb.no")
        print("📧 Email: andre@humanweb.no")
        print("🔑 Password: admin123")
        print(f"🆔 User ID: {athlete_data['id']}")
    
    # Verify
    user = await db.athletes.find_one(
        {"email": "andre@humanweb.no"}, 
        {"_id": 0, "email": 1, "name": 1, "is_super_admin": 1, "id": 1}
    )
    print(f"\nVerified user: {user}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_super_admin())
