"""
Bookmarks Routes
Handles post bookmarking functionality for community posts
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
import logging
import uuid

from database import db

# Create router
router = APIRouter(prefix="/api", tags=["bookmarks"])

# Logger
logger = logging.getLogger(__name__)


# ==================== Helper Functions ====================

def prepare_for_mongo(data):
    """Prepare data for MongoDB storage by converting datetime objects to ISO strings"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data


# ==================== Bookmarks Endpoints ====================

@router.post("/bookmarks/{athlete_id}/{post_id}")
async def bookmark_post(athlete_id: str, post_id: str):
    """Bookmark a post for an athlete"""
    try:
        bookmark = {
            "id": str(uuid.uuid4()),
            "athlete_id": athlete_id,
            "post_id": post_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Check if already bookmarked
        existing = await db.bookmarks.find_one({
            "athlete_id": athlete_id,
            "post_id": post_id
        })
        
        if existing:
            return {"message": "Post already bookmarked", "bookmark_id": existing["id"]}
        
        await db.bookmarks.insert_one(bookmark)
        
        # Get post details to find the post author
        post = await db.community_posts.find_one({"id": post_id})
        
        if post and post.get("athlete_id") != athlete_id:
            # Only notify if someone else bookmarked the post (not the author)
            # Get bookmarker's details
            bookmarker = await db.accounts.find_one({"athlete_id": athlete_id})
            
            if bookmarker:
                # Create notification for post author
                notification = {
                    "id": str(uuid.uuid4()),
                    "athlete_id": post.get("athlete_id"),
                    "type": "bookmark",
                    "message": f"{bookmarker.get('name', 'Someone')} bookmarked your post",
                    "from_athlete_id": athlete_id,
                    "from_athlete_name": bookmarker.get('name', 'Unknown'),
                    "post_id": post_id,
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                notification_for_mongo = prepare_for_mongo(notification.copy())
                await db.community_notifications.insert_one(notification_for_mongo)
        
        return {"message": "Post bookmarked successfully", "bookmark_id": bookmark["id"]}
    except Exception as e:
        logging.error(f"Error bookmarking post: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/bookmarks/{athlete_id}/{post_id}")
async def remove_bookmark(athlete_id: str, post_id: str):
    """Remove a bookmark"""
    try:
        result = await db.bookmarks.delete_one({
            "athlete_id": athlete_id,
            "post_id": post_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Bookmark not found")
        
        return {"message": "Bookmark removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error removing bookmark: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bookmarks/{athlete_id}")
async def get_bookmarks(athlete_id: str, limit: int = 50, skip: int = 0):
    """Get all bookmarked posts for an athlete"""
    try:
        # Get bookmark records
        bookmarks = await db.bookmarks.find(
            {"athlete_id": athlete_id}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
        
        if not bookmarks:
            return {"posts": [], "total": 0}
        
        # Get the actual posts
        post_ids = [bookmark["post_id"] for bookmark in bookmarks]
        posts = await db.community_posts.find(
            {"id": {"$in": post_ids}}
        ).to_list(length=None)
        
        # Create a map for quick lookup
        posts_map = {post["id"]: post for post in posts}
        
        # Order posts by bookmark creation date
        ordered_posts = []
        for bookmark in bookmarks:
            post = posts_map.get(bookmark["post_id"])
            if post:
                # Remove MongoDB ObjectId before returning
                if "_id" in post:
                    del post["_id"]
                # Add bookmark info to post
                post["bookmarked_at"] = bookmark["created_at"]
                ordered_posts.append(post)
        
        # Get total count
        total = await db.bookmarks.count_documents({"athlete_id": athlete_id})
        
        return {
            "posts": ordered_posts,
            "total": total
        }
    except Exception as e:
        logging.error(f"Error fetching bookmarks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bookmarks/{athlete_id}/check/{post_id}")
async def check_bookmark(athlete_id: str, post_id: str):
    """Check if a post is bookmarked by an athlete"""
    try:
        bookmark = await db.bookmarks.find_one({
            "athlete_id": athlete_id,
            "post_id": post_id
        })
        
        return {"bookmarked": bookmark is not None}
    except Exception as e:
        logging.error(f"Error checking bookmark: {e}")
        raise HTTPException(status_code=500, detail=str(e))
