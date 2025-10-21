import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import os
import random

# MongoDB connection - use same DB_NAME as the server
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

async def populate_test_subscribers():
    """Add test subscribers to the database"""
    
    print(f"Using database: {DB_NAME}")
    print("Starting to populate test subscribers...")
    
    # Create test subscribers with different tiers and dates
    test_subscribers = []
    
    # Generate subscribers over the last 90 days
    base_date = datetime.now()
    
    # Free tier subscribers (60% of total)
    for i in range(12):
        days_ago = random.randint(1, 90)
        created_date = (base_date - timedelta(days=days_ago)).isoformat()
        test_subscribers.append({
            "email": f"free_user_{i}@test.com",
            "name": f"Free User {i}",
            "subscription_tier": "free",
            "created_at": created_date,
            "password_hash": "dummy_hash_for_testing",
            "is_active": True
        })
    
    # Pro tier subscribers (30% of total)
    for i in range(6):
        days_ago = random.randint(1, 60)
        created_date = (base_date - timedelta(days=days_ago)).isoformat()
        test_subscribers.append({
            "email": f"pro_user_{i}@test.com",
            "name": f"Pro User {i}",
            "subscription_tier": "pro",
            "created_at": created_date,
            "password_hash": "dummy_hash_for_testing",
            "is_active": True
        })
    
    # Premium tier subscribers (10% of total)
    for i in range(2):
        days_ago = random.randint(1, 45)
        created_date = (base_date - timedelta(days=days_ago)).isoformat()
        test_subscribers.append({
            "email": f"premium_user_{i}@test.com",
            "name": f"Premium User {i}",
            "subscription_tier": "premium",
            "created_at": created_date,
            "password_hash": "dummy_hash_for_testing",
            "is_active": True
        })
    
    # Insert test subscribers
    for subscriber in test_subscribers:
        # Check if subscriber already exists
        existing = await db.athletes.find_one({"email": subscriber["email"]})
        if not existing:
            result = await db.athletes.insert_one(subscriber)
            print(f"✅ Created {subscriber['subscription_tier']} subscriber: {subscriber['email']}")
        else:
            print(f"⏭️  Skipped (already exists): {subscriber['email']}")
    
    # Print summary
    total_count = await db.athletes.count_documents({})
    free_count = await db.athletes.count_documents({"subscription_tier": "free"})
    pro_count = await db.athletes.count_documents({"subscription_tier": "pro"})
    premium_count = await db.athletes.count_documents({"subscription_tier": "premium"})
    
    print("\n" + "="*50)
    print("📊 DATABASE SUMMARY:")
    print("="*50)
    print(f"Database: {DB_NAME}")
    print(f"Total Subscribers: {total_count}")
    print(f"Free Tier: {free_count}")
    print(f"Pro Tier: {pro_count}")
    print(f"Premium Tier: {premium_count}")
    print(f"Paid Subscribers: {pro_count + premium_count}")
    print("="*50)

if __name__ == "__main__":
    asyncio.run(populate_test_subscribers())
