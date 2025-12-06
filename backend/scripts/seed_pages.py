import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid
import os

async def seed_pages():
    """Seed initial pages (Home, Pricing, Privacy, Terms) into the database"""
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db_name = os.environ.get('DB_NAME', 'test_database')
    db = client[db_name]
    
    # Define initial pages
    pages = [
        {
            "id": str(uuid.uuid4()),
            "title": "Home",
            "url_slug": "/",
            "thumbnail": None,
            "status": "published",
            "index_status": "indexed",
            "scheduled_at": None,
            "meta_title": "TrainSmart - AI-Powered Running Coach",
            "meta_description": "Your personal AI running coach for optimal training and performance",
            "focus_keyword": "running coach",
            "og_image": None,
            "content": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "created_by": None,
            "last_modified_by": None
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Pricing",
            "url_slug": "/pricing",
            "thumbnail": None,
            "status": "published",
            "index_status": "indexed",
            "scheduled_at": None,
            "meta_title": "Pricing - TrainSmart",
            "meta_description": "Choose the perfect plan for your running goals. From free to premium coaching.",
            "focus_keyword": "running coach pricing",
            "og_image": None,
            "content": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "created_by": None,
            "last_modified_by": None
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Privacy Policy",
            "url_slug": "/privacy",
            "thumbnail": None,
            "status": "published",
            "index_status": "indexed",
            "scheduled_at": None,
            "meta_title": "Privacy Policy - TrainSmart",
            "meta_description": "Learn how TrainSmart protects your data and respects your privacy.",
            "focus_keyword": "privacy policy",
            "og_image": None,
            "content": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "created_by": None,
            "last_modified_by": None
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Terms & Conditions",
            "url_slug": "/terms",
            "thumbnail": None,
            "status": "published",
            "index_status": "indexed",
            "scheduled_at": None,
            "meta_title": "Terms & Conditions - TrainSmart",
            "meta_description": "Read our terms of service and user agreement.",
            "focus_keyword": "terms and conditions",
            "og_image": None,
            "content": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "created_by": None,
            "last_modified_by": None
        }
    ]
    
    # Check if pages already exist
    for page in pages:
        existing = await db.pages.find_one({"url_slug": page["url_slug"]})
        if existing:
            print(f"Page '{page['title']}' already exists, skipping...")
            continue
        
        # Insert page
        await db.pages.insert_one(page)
        print(f"✅ Created page: {page['title']} ({page['url_slug']})")
    
    print("\n🎉 Page seeding complete!")
    
    # Show all pages
    all_pages = await db.pages.find({}, {"_id": 0, "title": 1, "url_slug": 1, "status": 1}).to_list(length=None)
    print(f"\nTotal pages in database: {len(all_pages)}")
    for page in all_pages:
        print(f"  - {page['title']} ({page['url_slug']}) - {page['status']}")

if __name__ == "__main__":
    asyncio.run(seed_pages())
