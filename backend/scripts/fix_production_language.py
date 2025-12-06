#!/usr/bin/env python3
"""
Fix language setting for andre@humanweb.no in production database
"""
import os
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

async def fix_language():
    # Get MongoDB connection from environment
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'test_database')
    
    print(f"Connecting to MongoDB: {mongo_url}")
    print(f"Using database: {db_name}")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    email = "andre@humanweb.no"
    
    # Find the athlete profile
    athlete = await db.athlete_profiles.find_one({"email": email})
    
    if not athlete:
        print(f"❌ No athlete profile found for {email}")
        print("This means you need to login/register first in production!")
        return False
    
    print(f"✅ Found athlete profile for {email}")
    print(f"   Name: {athlete.get('name', 'N/A')}")
    print(f"   Current language: {athlete.get('language', 'NOT SET')}")
    
    # Update language to Norwegian
    result = await db.athlete_profiles.update_one(
        {"email": email},
        {"$set": {"language": "no"}}
    )
    
    if result.modified_count > 0:
        print("✅ Successfully updated language to 'no' (Norwegian)")
    elif athlete.get('language') == 'no':
        print("✅ Language was already set to 'no' (Norwegian)")
    else:
        print("⚠️  Update attempted but no documents modified")
    
    # Verify the update
    updated_athlete = await db.athlete_profiles.find_one({"email": email})
    print(f"   New language setting: {updated_athlete.get('language', 'NOT SET')}")
    
    # Check if menus exist
    settings = await db.system_settings.find_one({"menus": {"$exists": True}})
    if settings and 'menus' in settings:
        slideout_count = len(settings['menus'].get('slideout_menu', []))
        print(f"\n✅ Menus exist in database ({slideout_count} slideout items)")
        
        # Check if translations exist
        sample_item = None
        for item in settings['menus'].get('slideout_menu', []):
            if not item.get('is_separator') and item.get('label'):
                sample_item = item
                break
        
        if sample_item:
            has_translations = 'translations' in sample_item
            print(f"✅ Sample menu item '{sample_item['label']}' has translations: {has_translations}")
            if has_translations and 'no' in sample_item['translations']:
                print(f"   Norwegian translation: '{sample_item['translations']['no']}'")
    else:
        print("\n❌ No menus found in database!")
        print("   You need to save menus in Menu Editor first!")
    
    await client.close()
    return True

if __name__ == "__main__":
    success = asyncio.run(fix_language())
    if success:
        print("\n🎉 Done! Now refresh your production page and menus should be in Norwegian!")
    else:
        print("\n⚠️  Please login to production first, then run this script again.")
