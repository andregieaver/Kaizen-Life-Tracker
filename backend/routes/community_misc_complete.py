"""
Community Miscellaneous Router - Complete
Handles notifications, polls, blocking, and utility endpoints
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
from uuid import uuid4
import logging
import re
import requests
from bs4 import BeautifulSoup

from database import db

# Initialize router
router = APIRouter(prefix="/community", tags=["community-misc"])

# =====================================================
# HELPER FUNCTIONS
# =====================================================

def prepare_for_mongo(data):
    """Helper to prepare data for MongoDB insertion"""
    if isinstance(data, dict):
        result = {}
        for k, v in data.items():
            if isinstance(v, datetime):
                result[k] = v.isoformat()
            elif isinstance(v, dict):
                result[k] = prepare_for_mongo(v)
            elif isinstance(v, list):
                result[k] = [prepare_for_mongo(item) if isinstance(item, (dict, datetime)) else item for item in v]
            else:
                result[k] = v
        return result
    return data

# =====================================================
# NOTIFICATIONS ENDPOINTS
# =====================================================

@router.get("/notifications/{athlete_id}")
async def get_notifications(athlete_id: str, unread_only: bool = Query(False)):
    """Get notifications for an athlete"""
    try:
        query = {"athlete_id": athlete_id}
        if unread_only:
            query["read"] = False
        
        notifications = await db.community_notifications.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).limit(100).to_list(length=100)
        
        return {"notifications": notifications}
    except Exception as e:
        logging.error(f"Error fetching notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark a notification as read"""
    try:
        result = await db.community_notifications.update_one(
            {"id": notification_id},
            {"$set": {"read": True}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"message": "Notification marked as read"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error marking notification as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/notifications/{athlete_id}/unread-count")
async def get_unread_notifications_count(athlete_id: str):
    """Get count of unread notifications"""
    try:
        count = await db.community_notifications.count_documents({
            "athlete_id": athlete_id,
            "read": False
        })
        
        return {"unread_count": count}
    except Exception as e:
        logging.error(f"Error getting unread count: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# POLLS ENDPOINT
# =====================================================

@router.post("/polls/{post_id}/vote")
async def vote_on_poll(post_id: str, vote_data: dict, athlete_id: str = Query(...)):
    """Vote on a poll"""
    try:
        option_index = vote_data.get("option_index")
        
        if option_index is None:
            raise HTTPException(status_code=400, detail="option_index is required")
        
        # Get post to verify it's a poll
        post = await db.community_posts.find_one({"id": post_id}, {"_id": 0})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        if not post.get("is_poll"):
            raise HTTPException(status_code=400, detail="Post is not a poll")
        
        poll_options = post.get("poll_options", [])
        if option_index < 0 or option_index >= len(poll_options):
            raise HTTPException(status_code=400, detail="Invalid option index")
        
        # Check if user already voted
        existing_vote = await db.community_poll_votes.find_one({
            "post_id": post_id,
            "athlete_id": athlete_id
        })
        
        if existing_vote:
            # Update vote
            old_option = existing_vote.get("option_index")
            
            await db.community_poll_votes.update_one(
                {"post_id": post_id, "athlete_id": athlete_id},
                {"$set": {"option_index": option_index}}
            )
            
            # Update vote counts
            if old_option != option_index:
                poll_options[old_option]["votes"] = max(0, poll_options[old_option].get("votes", 0) - 1)
                poll_options[option_index]["votes"] = poll_options[option_index].get("votes", 0) + 1
                
                await db.community_posts.update_one(
                    {"id": post_id},
                    {"$set": {"poll_options": poll_options}}
                )
        else:
            # New vote
            vote = {
                "id": str(uuid4()),
                "post_id": post_id,
                "athlete_id": athlete_id,
                "option_index": option_index,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.community_poll_votes.insert_one(prepare_for_mongo(vote.copy()))
            
            # Update vote count
            poll_options[option_index]["votes"] = poll_options[option_index].get("votes", 0) + 1
            
            await db.community_posts.update_one(
                {"id": post_id},
                {"$set": {"poll_options": poll_options}}
            )
        
        # Get updated post
        updated_post = await db.community_posts.find_one({"id": post_id}, {"_id": 0})
        return {"poll_options": updated_post.get("poll_options", [])}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error voting on poll: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# BLOCKING ENDPOINT
# =====================================================

@router.post("/block")
async def block_user(block_data: dict, athlete_id: str = Query(...)):
    """Block or unblock a user"""
    try:
        target_athlete_id = block_data.get("target_athlete_id")
        action = block_data.get("action", "block")  # 'block' or 'unblock'
        
        if not target_athlete_id:
            raise HTTPException(status_code=400, detail="target_athlete_id is required")
        
        if action == "block":
            # Check if already blocked
            existing = await db.community_blocks.find_one({
                "blocker_id": athlete_id,
                "blocked_id": target_athlete_id
            })
            
            if existing:
                return {"message": "User already blocked"}
            
            # Create block
            block = {
                "id": str(uuid4()),
                "blocker_id": athlete_id,
                "blocked_id": target_athlete_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.community_blocks.insert_one(prepare_for_mongo(block.copy()))
            
            # Remove any follow relationships
            await db.community_follows.delete_many({
                "$or": [
                    {"follower_id": athlete_id, "following_id": target_athlete_id},
                    {"follower_id": target_athlete_id, "following_id": athlete_id}
                ]
            })
            
            return {"message": "User blocked successfully"}
        
        elif action == "unblock":
            # Remove block
            result = await db.community_blocks.delete_one({
                "blocker_id": athlete_id,
                "blocked_id": target_athlete_id
            })
            
            if result.deleted_count == 0:
                raise HTTPException(status_code=404, detail="Block not found")
            
            return {"message": "User unblocked successfully"}
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error blocking/unblocking user: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# UTILITY ENDPOINTS
# =====================================================

@router.post("/fetch-youtube-metadata")
async def fetch_youtube_metadata(data: dict):
    """Fetch YouTube video metadata"""
    try:
        url = data.get("url", "")
        
        # Extract video ID from YouTube URL
        video_id = None
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)',
            r'youtube\.com\/embed\/([^&\n?#]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                video_id = match.group(1)
                break
        
        if not video_id:
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")
        
        # Return basic metadata (thumbnail)
        thumbnail_url = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
        
        return {
            "type": "youtube",
            "video_id": video_id,
            "thumbnail": thumbnail_url,
            "url": url
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching YouTube metadata: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/fetch-url-preview")
async def fetch_url_preview(data: dict):
    """Fetch preview metadata for any URL"""
    try:
        url = data.get("url", "")
        
        if not url:
            raise HTTPException(status_code=400, detail="URL is required")
        
        # Fetch the page
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        
        # Parse HTML
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Extract metadata
        title = None
        description = None
        image = None
        
        # Try Open Graph tags first
        og_title = soup.find('meta', property='og:title')
        if og_title:
            title = og_title.get('content')
        
        og_description = soup.find('meta', property='og:description')
        if og_description:
            description = og_description.get('content')
        
        og_image = soup.find('meta', property='og:image')
        if og_image:
            image = og_image.get('content')
        
        # Fallback to regular meta tags
        if not title:
            title_tag = soup.find('title')
            if title_tag:
                title = title_tag.string
        
        if not description:
            desc_tag = soup.find('meta', attrs={'name': 'description'})
            if desc_tag:
                description = desc_tag.get('content')
        
        return {
            "url": url,
            "title": title or "No title",
            "description": description or "No description",
            "image": image,
            "type": "link"
        }
        
    except requests.RequestException as e:
        logging.error(f"Error fetching URL preview: {e}")
        return {
            "url": url,
            "title": url,
            "description": "Unable to fetch preview",
            "image": None,
            "type": "link"
        }
    except Exception as e:
        logging.error(f"Error parsing URL preview: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/profile/{target_athlete_id}")
async def get_community_profile(target_athlete_id: str, athlete_id: str = Query(...)):
    """Get community profile for an athlete"""
    try:
        # Get athlete basic info
        athlete = await db.athlete_profiles.find_one(
            {"id": target_athlete_id},
            {"_id": 0}
        )
        
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        # Get stats
        posts_count = await db.community_posts.count_documents({"athlete_id": target_athlete_id})
        
        followers_count = await db.community_follows.count_documents({"following_id": target_athlete_id})
        following_count = await db.community_follows.count_documents({"follower_id": target_athlete_id})
        
        # Check if current user follows target
        is_following = await db.community_follows.find_one({
            "follower_id": athlete_id,
            "following_id": target_athlete_id
        }) is not None
        
        # Check if blocked
        is_blocked = await db.community_blocks.find_one({
            "blocker_id": athlete_id,
            "blocked_id": target_athlete_id
        }) is not None
        
        return {
            "athlete": athlete,
            "stats": {
                "posts_count": posts_count,
                "followers_count": followers_count,
                "following_count": following_count
            },
            "is_following": is_following,
            "is_blocked": is_blocked
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching community profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/athletes")
async def get_all_athletes(limit: int = Query(50), skip: int = Query(0)):
    """Get all athletes for community discovery"""
    try:
        athletes = await db.athlete_profiles.find(
            {},
            {"_id": 0, "id": 1, "name": 1, "profile_picture": 1, "bio": 1}
        ).skip(skip).limit(limit).to_list(length=limit)
        
        return {"athletes": athletes, "total": len(athletes)}
        
    except Exception as e:
        logging.error(f"Error fetching athletes: {e}")
        raise HTTPException(status_code=500, detail=str(e))
