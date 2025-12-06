"""
Fix missing profile pictures in posts, comments, and other collections
This script updates all posts/comments with the athlete's current profile picture
"""
import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment from backend directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(backend_dir, '.env')
load_dotenv(env_path)

# MongoDB connection - use localhost as we're running on the same machine
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "test_database")

print(f"Connecting to: {MONGO_URL}")
print(f"Database: {DB_NAME}")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

async def fix_missing_profile_pictures():
    """Update all posts and comments with missing profile pictures"""
    
    try:
        # Test connection
        await client.admin.command('ping')
        print("✅ Connected to MongoDB successfully")
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        return
    
    print("\n🔍 Finding posts with missing profile pictures...")
    
    # Get all athletes with their profile pictures
    athletes = await db.athletes.find({}, {"id": 1, "profile_picture": 1, "_id": 0}).to_list(length=None)
    athlete_pics = {a["id"]: a.get("profile_picture") for a in athletes if a.get("profile_picture")}
    
    print(f"📊 Found {len(athletes)} athletes ({len(athlete_pics)} with profile pictures)")
    
    if len(athletes) == 0:
        print("⚠️  No athletes found in database")
        return
    
    # Update posts
    posts_updated = 0
    posts = await db.posts.find({}, {"id": 1, "athlete_id": 1, "athlete_name": 1, "athlete_profile_picture": 1, "_id": 0}).to_list(length=None)
    
    print(f"📝 Checking {len(posts)} posts...")
    
    for post in posts:
        athlete_id = post.get("athlete_id")
        current_pic = post.get("athlete_profile_picture")
        correct_pic = athlete_pics.get(athlete_id)
        
        # Update if missing or different
        if athlete_id and correct_pic and (not current_pic or current_pic != correct_pic):
            await db.posts.update_one(
                {"id": post["id"]},
                {"$set": {"athlete_profile_picture": correct_pic}}
            )
            posts_updated += 1
            print(f"  ✓ Updated post {post['id'][:8]}... for {post.get('athlete_name', 'Unknown')}")
    
    print(f"✅ Updated {posts_updated} posts")
    
    # Update comments
    comments_updated = 0
    comments = await db.comments.find({}, {"id": 1, "athlete_id": 1, "athlete_profile_picture": 1, "_id": 0}).to_list(length=None)
    
    print(f"💬 Checking {len(comments)} comments...")
    
    for comment in comments:
        athlete_id = comment.get("athlete_id")
        current_pic = comment.get("athlete_profile_picture")
        correct_pic = athlete_pics.get(athlete_id)
        
        if athlete_id and correct_pic and (not current_pic or current_pic != correct_pic):
            await db.comments.update_one(
                {"id": comment["id"]},
                {"$set": {"athlete_profile_picture": correct_pic}}
            )
            comments_updated += 1
    
    print(f"✅ Updated {comments_updated} comments")
    
    # Update event comments
    event_comments_updated = 0
    event_comments = await db.event_comments.find({}, {"id": 1, "athlete_id": 1, "athlete_profile_picture": 1, "_id": 0}).to_list(length=None)
    
    print(f"📅 Checking {len(event_comments)} event comments...")
    
    for comment in event_comments:
        athlete_id = comment.get("athlete_id")
        current_pic = comment.get("athlete_profile_picture")
        correct_pic = athlete_pics.get(athlete_id)
        
        if athlete_id and correct_pic and (not current_pic or current_pic != correct_pic):
            await db.event_comments.update_one(
                {"id": comment["id"]},
                {"$set": {"athlete_profile_picture": correct_pic}}
            )
            event_comments_updated += 1
    
    print(f"✅ Updated {event_comments_updated} event comments")
    
    # Update challenge participations
    participations_updated = 0
    participations = await db.challenge_participations.find({}, {"id": 1, "athlete_id": 1, "athlete_profile_picture": 1, "_id": 0}).to_list(length=None)
    
    print(f"🏆 Checking {len(participations)} challenge participations...")
    
    for participation in participations:
        athlete_id = participation.get("athlete_id")
        current_pic = participation.get("athlete_profile_picture")
        correct_pic = athlete_pics.get(athlete_id)
        
        if athlete_id and correct_pic and (not current_pic or current_pic != correct_pic):
            await db.challenge_participations.update_one(
                {"id": participation["id"]},
                {"$set": {"athlete_profile_picture": correct_pic}}
            )
            participations_updated += 1
    
    print(f"✅ Updated {participations_updated} challenge participations")
    
    total = posts_updated + comments_updated + event_comments_updated + participations_updated
    print(f"\n🎉 Backfill complete! Total updates: {total}")
    
    if total == 0:
        print("ℹ️  All profile pictures are already up to date!")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_missing_profile_pictures())
