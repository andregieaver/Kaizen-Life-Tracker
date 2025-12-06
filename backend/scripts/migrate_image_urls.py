"""
Migration script to convert absolute image URLs to relative URLs in posts
"""
import asyncio
import os
import re
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

async def migrate_urls():
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Patterns to match absolute URLs
    patterns = [
        r'https?://[^/]+(/api/uploads/images/[^"\s]+)',  # Match absolute URLs with /api/uploads
        r'https?://[^/]+(uploaded_images/[^"\s]+)',      # Match old uploaded_images paths
    ]
    
    # Collections to update
    collections = ['community_posts', 'community_comments', 'groups', 'events']
    
    total_updated = 0
    
    for collection_name in collections:
        collection = db[collection_name]
        
        # Find documents with URLs
        cursor = collection.find({})
        
        async for doc in cursor:
            updated = False
            update_ops = {}
            
            # Check media array
            if 'media' in doc and isinstance(doc['media'], list):
                new_media = []
                for item in doc['media']:
                    if isinstance(item, dict) and 'url' in item:
                        url = item['url']
                        # Convert absolute to relative
                        for pattern in patterns:
                            match = re.search(pattern, url)
                            if match:
                                new_url = f"/{match.group(1)}"
                                if new_url != url:
                                    item['url'] = new_url
                                    updated = True
                                break
                    new_media.append(item)
                if updated:
                    update_ops['media'] = new_media
            
            # Check image_urls array (deprecated but still used)
            if 'image_urls' in doc and isinstance(doc['image_urls'], list):
                new_image_urls = []
                for url in doc['image_urls']:
                    new_url = url
                    for pattern in patterns:
                        match = re.search(pattern, url)
                        if match:
                            new_url = f"/{match.group(1)}"
                            if new_url != url:
                                updated = True
                            break
                    new_image_urls.append(new_url)
                if updated:
                    update_ops['image_urls'] = new_image_urls
            
            # Check single image_url fields
            if 'image_url' in doc:
                url = doc['image_url']
                for pattern in patterns:
                    match = re.search(pattern, url)
                    if match:
                        new_url = f"/{match.group(1)}"
                        if new_url != url:
                            update_ops['image_url'] = new_url
                            updated = True
                        break
            
            # Check profile_image, cover_photo for groups
            for field in ['profile_image', 'cover_photo', 'banner_image']:
                if field in doc and doc[field]:
                    url = doc[field]
                    for pattern in patterns:
                        match = re.search(pattern, url)
                        if match:
                            new_url = f"/{match.group(1)}"
                            if new_url != url:
                                update_ops[field] = new_url
                                updated = True
                            break
            
            # Update document if changes were made
            if updated and update_ops:
                await collection.update_one(
                    {'_id': doc['_id']},
                    {'$set': update_ops}
                )
                total_updated += 1
                print(f"✓ Updated {collection_name}: {doc.get('id', doc.get('_id'))}")
    
    print(f"\n✅ Migration complete! Updated {total_updated} documents")
    client.close()

if __name__ == "__main__":
    print("🔄 Starting URL migration...")
    print("Converting absolute URLs to relative URLs...")
    asyncio.run(migrate_urls())
