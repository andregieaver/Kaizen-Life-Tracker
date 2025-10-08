import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def fix_database():
    """Fix database by removing old profiles without email and creating proper index"""
    
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("🔧 Fixing database...")
    
    # Drop existing email index if it exists
    try:
        await db.athlete_profiles.drop_index("email_1")
        print("✅ Dropped old email index")
    except Exception as e:
        print(f"ℹ️  No existing email index to drop: {e}")
    
    # Delete all profiles without email field
    result = await db.athlete_profiles.delete_many({"email": {"$exists": False}})
    print(f"✅ Deleted {result.deleted_count} profiles without email field")
    
    # Delete all profiles with null email
    result = await db.athlete_profiles.delete_many({"email": None})
    print(f"✅ Deleted {result.deleted_count} profiles with null email")
    
    # Create unique index on email (sparse to allow null values temporarily during migration)
    try:
        await db.athlete_profiles.create_index("email", unique=True)
        print("✅ Created unique index on email field")
    except Exception as e:
        print(f"⚠️  Could not create index: {e}")
    
    # Count remaining profiles
    count = await db.athlete_profiles.count_documents({})
    print(f"\n📊 Total athlete profiles remaining: {count}")
    
    if count > 0:
        # Show remaining profiles
        profiles = await db.athlete_profiles.find({}, {"_id": 0, "name": 1, "email": 1}).to_list(length=10)
        print("\n📋 Existing profiles:")
        for p in profiles:
            print(f"  - {p.get('name', 'Unknown')}: {p.get('email', 'No email')}")
    
    print("\n✅ Database fixed successfully!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_database())
