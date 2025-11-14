import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def migrate_page_image_paths():
    """Update existing page image paths to use /api/uploaded_images prefix"""
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db_name = os.environ.get('DB_NAME', 'trainsmart')
    db = client[db_name]
    
    print("Migrating page image paths...")
    
    # Find all pages with old image paths
    pages_with_old_paths = await db.pages.find({
        "$or": [
            {"thumbnail": {"$regex": "^/uploaded_images/"}},
            {"og_image": {"$regex": "^/uploaded_images/"}}
        ]
    }).to_list(length=None)
    
    print(f"Found {len(pages_with_old_paths)} pages with old image paths")
    
    updated_count = 0
    for page in pages_with_old_paths:
        update_fields = {}
        
        # Update thumbnail path
        if page.get('thumbnail') and page['thumbnail'].startswith('/uploaded_images/'):
            new_thumbnail = page['thumbnail'].replace('/uploaded_images/', '/api/uploaded_images/', 1)
            update_fields['thumbnail'] = new_thumbnail
            print(f"  Updating thumbnail: {page['thumbnail']} -> {new_thumbnail}")
        
        # Update OG image path
        if page.get('og_image') and page['og_image'].startswith('/uploaded_images/'):
            new_og_image = page['og_image'].replace('/uploaded_images/', '/api/uploaded_images/', 1)
            update_fields['og_image'] = new_og_image
            print(f"  Updating OG image: {page['og_image']} -> {new_og_image}")
        
        # Update the page if there are fields to update
        if update_fields:
            await db.pages.update_one(
                {"id": page['id']},
                {"$set": update_fields}
            )
            updated_count += 1
            print(f"  ✅ Updated page: {page.get('title')}")
    
    print(f"\n✅ Migration complete! Updated {updated_count} pages")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_page_image_paths())
