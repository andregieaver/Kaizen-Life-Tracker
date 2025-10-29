"""
Fix missing profile pictures in posts, comments, and other collections
This script updates all posts/comments with the athlete's current profile picture
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/trainsmart")
client = AsyncIOMotorClient(MONGO_URL)
# Extract database name from URL or use default
db_name = MONGO_URL.split('/')[-1].split('?')[0] if '/' in MONGO_URL else "trainsmart"
db = client[db_name]

async def fix_missing_profile_pictures():
    """Update all posts and comments with missing profile pictures"""
    
    print("🔍 Finding posts with missing profile pictures...")
    
    # Get all athletes with their profile pictures
    athletes = await db.athletes.find({}, {"id": 1, "profile_picture": 1}).to_list(length=None)
    athlete_pics = {a["id"]: a.get("profile_picture") for a in athletes}
    
    print(f"📊 Found {len(athletes)} athletes")
    
    # Update posts
    posts_updated = 0
    posts = await db.posts.find({}).to_list(length=None)
    
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
            print(f"✓ Updated post {post['id'][:8]}... for athlete {post.get('athlete_name', 'Unknown')}")
    
    print(f"✅ Updated {posts_updated} posts")
    
    # Update comments
    comments_updated = 0
    comments = await db.comments.find({}).to_list(length=None)
    
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
    event_comments = await db.event_comments.find({}).to_list(length=None)
    
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
    participations = await db.challenge_participations.find({}).to_list(length=None)
    
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
    
    print(f"\n🎉 Total updates: {posts_updated + comments_updated + event_comments_updated + participations_updated}")

if __name__ == "__main__":
    asyncio.run(fix_missing_profile_pictures())
