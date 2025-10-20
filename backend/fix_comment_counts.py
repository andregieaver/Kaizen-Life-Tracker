"""
Script to fix comment counts in community posts
Run this once to synchronize comments_count with actual comment counts
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def fix_comment_counts():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print(f"Starting comment count fix for database: {db_name}...")
    
    # Get all posts
    posts = await db.community_posts.find({}, {"_id": 0, "id": 1}).to_list(length=None)
    print(f"Found {len(posts)} posts")
    
    fixed_count = 0
    for post in posts:
        post_id = post["id"]
        
        # Count actual comments for this post
        actual_count = await db.community_comments.count_documents({"post_id": post_id})
        
        # Update the post's comments_count
        result = await db.community_posts.update_one(
            {"id": post_id},
            {"$set": {"comments_count": actual_count}}
        )
        
        if result.modified_count > 0:
            fixed_count += 1
            print(f"Fixed post {post_id}: set comments_count to {actual_count}")
    
    print(f"\nCompleted! Fixed {fixed_count} posts")
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_comment_counts())
