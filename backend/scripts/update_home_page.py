import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def update_home_page():
    """Update the existing home page to set is_home = True"""
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db_name = os.environ.get('DB_NAME', 'test_database')
    db = client[db_name]
    
    # Find the page with url_slug = "/"
    home_page = await db.pages.find_one({"url_slug": "/"})
    
    if home_page:
        # Update it to set is_home = True
        await db.pages.update_one(
            {"url_slug": "/"},
            {"$set": {"is_home": True}}
        )
        print(f"✅ Updated home page '{home_page.get('title')}' with is_home = True")
    else:
        print("⚠️  No page with URL slug '/' found")
    
    # Show all pages with their is_home status
    all_pages = await db.pages.find({}, {"_id": 0, "title": 1, "url_slug": 1, "is_home": 1}).to_list(length=None)
    print(f"\n📄 All pages:")
    for page in all_pages:
        home_indicator = "🏠" if page.get("is_home") else "  "
        print(f"  {home_indicator} {page.get('title')} ({page.get('url_slug')}) - is_home: {page.get('is_home', False)}")

if __name__ == "__main__":
    asyncio.run(update_home_page())
