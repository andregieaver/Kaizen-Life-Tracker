import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def add_unique_email_index():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db_name = os.environ.get('DB_NAME', 'health_coach')
    db = client[db_name]
    
    try:
        # Create unique index on email field in athlete_profiles collection
        await db.athlete_profiles.create_index("email", unique=True)
        print("✅ Created unique index on email field in athlete_profiles collection")
        
        # Also create on athletes collection for consistency
        await db.athletes.create_index("email", unique=True)
        print("✅ Created unique index on email field in athletes collection")
        
        # List all indexes
        indexes = await db.athlete_profiles.list_indexes().to_list(length=None)
        print("\nCurrent indexes on athlete_profiles:")
        for idx in indexes:
            print(f"  - {idx}")
            
    except Exception as e:
        print(f"❌ Error creating index: {e}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(add_unique_email_index())
