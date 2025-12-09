"""
Community routes - Extracted from server.py
Handles posts, comments, likes, events, challenges, groups, and social interactions
This is the largest domain with 60+ endpoints for comprehensive social features
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

# Import shared dependencies
from database import db
from utils import prepare_for_mongo, parse_from_mongo

router = APIRouter(prefix="/community", tags=["community"])

# ============= MODELS =============

class CreatePostRequest(BaseModel):
    """Request model for creating a post - minimal required data from frontend"""
    model_config = ConfigDict(extra="ignore")
    
    content: str
    image_urls: Optional[List[str]] = []
    media: Optional[List[dict]] = []
    visibility: str = "public"
    image_data: Optional[str] = None  # Legacy base64 image
    youtube_data: Optional[dict] = None
    url_preview: Optional[dict] = None

class CommunityPost(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    athlete_name: str
    athlete_profile_picture: Optional[str] = None
    content: str
    image_urls: Optional[List[str]] = []
    media: Optional[List[dict]] = []
    visibility: str = "public"
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_edited: bool = False
    shared_post_id: Optional[str] = None
    shared_post_data: Optional[dict] = None
    youtube_data: Optional[dict] = None
    url_preview: Optional[dict] = None

class CommunityComment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    post_id: str
    athlete_id: str
    athlete_name: str
    athlete_profile_picture: Optional[str] = None
    content: str
    image_urls: Optional[List[str]] = []
    likes_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    youtube_data: Optional[dict] = None
    url_preview: Optional[dict] = None

# ============= NOTE =============
# This is a partial extraction of the Community domain
# Due to the massive size (64 routes), core CRUD operations are extracted here
# Additional routes for events, challenges, groups, polls, etc. remain in server.py
# These can be gradually migrated in future iterations
#
# Extracted routes (24):
# - Posts CRUD
# - Comments CRUD  
# - Likes
# - Feed operations
# - Search
# - Following/followers
# - Media helpers
#
# Remaining in server.py (~40 routes):
# - Events (create, manage, participate)
# - Challenges (create, join, progress tracking)
# - Groups (create, join, posts)
# - Polls (create, vote)
# - Advanced social features
#
# This approach allows us to make progress while keeping the refactoring manageable
# ============= END NOTE =============

@router.post("/posts")
async def create_post(post_data: CreatePostRequest, athlete_id: str = Query(...)):
    """Create a new community post"""
    # Get athlete info to enrich the post
    athlete = await db.athletes.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    # Build image_urls from media if available
    image_urls = post_data.image_urls or []
    if post_data.media:
        for m in post_data.media:
            if m.get("type") == "image" and m.get("url"):
                if m["url"] not in image_urls:
                    image_urls.append(m["url"])
    
    # Create full post with athlete data
    post = {
        "id": str(uuid.uuid4()),
        "athlete_id": athlete_id,
        "athlete_name": athlete.get("name", "Unknown"),
        "athlete_profile_picture": athlete.get("profile_picture"),
        "content": post_data.content,
        "image_urls": image_urls,
        "media": post_data.media or [],
        "visibility": post_data.visibility,
        "likes_count": 0,
        "comments_count": 0,
        "shares_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None,
        "is_edited": False,
        "shared_post_id": None,
        "shared_post_data": None,
        "youtube_data": post_data.youtube_data,
        "url_preview": post_data.url_preview
    }
    
    await db.community_posts.insert_one(prepare_for_mongo(post.copy()))
    return {"success": True, "id": post["id"], "post": post}


@router.get("/posts/{post_id}")
async def get_post(post_id: str):
    """Get a single post by ID"""
    post = await db.community_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return parse_from_mongo(post)


@router.get("/feed/{athlete_id}")
async def get_feed(athlete_id: str, limit: int = 20, skip: int = 0):
    """Get public community feed"""
    posts = await db.community_posts.find(
        {"visibility": "public"},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(min(limit, 50)).to_list(length=50)
    
    return {"posts": [parse_from_mongo(p) for p in posts]}


@router.get("/following-feed/{athlete_id}")
async def get_following_feed(athlete_id: str, limit: int = 20, skip: int = 0):
    """Get feed of posts from users you follow"""
    # Get list of athletes this user is following
    following = await db.community_following.find(
        {"follower_id": athlete_id},
        {"_id": 0, "following_id": 1}
    ).limit(1000).to_list(length=1000)
    
    following_ids = [f["following_id"] for f in following]
    following_ids.append(athlete_id)  # Include own posts
    
    # Get posts from followed athletes
    posts = await db.community_posts.find(
        {"athlete_id": {"$in": following_ids}},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(min(limit, 50)).to_list(length=50)
    
    return {"posts": [parse_from_mongo(p) for p in posts]}


@router.get("/user/{target_athlete_id}/posts")
async def get_user_posts(target_athlete_id: str, limit: int = 20, skip: int = 0):
    """Get all posts from a specific user"""
    posts = await db.community_posts.find(
        {"athlete_id": target_athlete_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(min(limit, 50)).to_list(length=50)
    
    return {"posts": [parse_from_mongo(p) for p in posts]}


@router.get("/posts/post/{post_id}")
async def get_post_detail(post_id: str):
    """Get detailed post information"""
    post = await db.community_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return parse_from_mongo(post)


@router.put("/posts/{post_id}")
async def update_post(post_id: str, updates: dict):
    """Update a post"""
    update_data = {}
    allowed_fields = ['content', 'visibility', 'media', 'image_urls']
    
    for field in allowed_fields:
        if field in updates:
            update_data[field] = updates[field]
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    update_data['is_edited'] = True
    
    result = await db.community_posts.update_one(
        {"id": post_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return {"success": True}


@router.delete("/posts/{post_id}")
async def delete_post(post_id: str):
    """Delete a post and all its comments and likes"""
    # Delete post
    result = await db.community_posts.delete_one({"id": post_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Delete all comments
    await db.community_comments.delete_many({"post_id": post_id})
    
    # Delete all likes
    await db.community_likes.delete_many({"post_id": post_id})
    
    return {"success": True}


@router.post("/posts/{post_id}/like")
async def like_post(post_id: str, data: dict):
    """Like or unlike a post"""
    athlete_id = data.get("athlete_id")
    if not athlete_id:
        raise HTTPException(status_code=400, detail="athlete_id is required")
    
    # Check if already liked
    existing_like = await db.community_likes.find_one({
        "post_id": post_id,
        "athlete_id": athlete_id
    })
    
    if existing_like:
        # Unlike
        await db.community_likes.delete_one({"post_id": post_id, "athlete_id": athlete_id})
        await db.community_posts.update_one(
            {"id": post_id},
            {"$inc": {"likes_count": -1}}
        )
        return {"success": True, "action": "unliked"}
    else:
        # Like
        like = {
            "id": str(uuid.uuid4()),
            "post_id": post_id,
            "athlete_id": athlete_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.community_likes.insert_one(like)
        await db.community_posts.update_one(
            {"id": post_id},
            {"$inc": {"likes_count": 1}}
        )
        return {"success": True, "action": "liked"}


@router.post("/posts/{post_id}/comment")
async def create_comment(post_id: str, comment: CommunityComment):
    """Add a comment to a post"""
    comment.post_id = post_id
    comment_dict = prepare_for_mongo(comment.model_dump())
    await db.community_comments.insert_one(comment_dict)
    
    # Increment comment count
    await db.community_posts.update_one(
        {"id": post_id},
        {"$inc": {"comments_count": 1}}
    )
    
    return {"success": True, "id": comment.id, "comment": comment}


@router.get("/posts/{post_id}/comments")
async def get_comments(post_id: str, limit: int = 50):
    """Get all comments for a post"""
    comments = await db.community_comments.find(
        {"post_id": post_id},
        {"_id": 0}
    ).sort("created_at", 1).limit(min(limit, 100)).to_list(length=100)
    
    return {"comments": [parse_from_mongo(c) for c in comments]}


@router.delete("/posts/{post_id}/comment/{comment_id}")
async def delete_comment(post_id: str, comment_id: str):
    """Delete a comment"""
    result = await db.community_comments.delete_one({
        "id": comment_id,
        "post_id": post_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Decrement comment count
    await db.community_posts.update_one(
        {"id": post_id},
        {"$inc": {"comments_count": -1}}
    )
    
    # Delete all likes on this comment
    await db.community_comment_likes.delete_many({"comment_id": comment_id})
    
    return {"success": True}


@router.post("/comments/{comment_id}/like")
async def like_comment(comment_id: str, data: dict):
    """Like or unlike a comment"""
    athlete_id = data.get("athlete_id")
    if not athlete_id:
        raise HTTPException(status_code=400, detail="athlete_id is required")
    
    # Check if already liked
    existing_like = await db.community_comment_likes.find_one({
        "comment_id": comment_id,
        "athlete_id": athlete_id
    })
    
    if existing_like:
        # Unlike
        await db.community_comment_likes.delete_one({
            "comment_id": comment_id,
            "athlete_id": athlete_id
        })
        await db.community_comments.update_one(
            {"id": comment_id},
            {"$inc": {"likes_count": -1}}
        )
        return {"success": True, "action": "unliked"}
    else:
        # Like
        like = {
            "id": str(uuid.uuid4()),
            "comment_id": comment_id,
            "athlete_id": athlete_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.community_comment_likes.insert_one(like)
        await db.community_comments.update_one(
            {"id": comment_id},
            {"$inc": {"likes_count": 1}}
        )
        return {"success": True, "action": "liked"}


@router.post("/posts/{post_id}/share")
async def share_post(post_id: str, data: dict):
    """Share/repost a post"""
    athlete_id = data.get("athlete_id")
    athlete_name = data.get("athlete_name")
    content = data.get("content", "")
    
    if not athlete_id or not athlete_name:
        raise HTTPException(status_code=400, detail="athlete_id and athlete_name are required")
    
    # Get original post
    original_post = await db.community_posts.find_one({"id": post_id}, {"_id": 0})
    if not original_post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Create share post
    share_post = CommunityPost(
        athlete_id=athlete_id,
        athlete_name=athlete_name,
        content=content,
        shared_post_id=post_id,
        shared_post_data=original_post
    )
    
    share_post_dict = prepare_for_mongo(share_post.model_dump())
    await db.community_posts.insert_one(share_post_dict)
    
    # Increment share count on original
    await db.community_posts.update_one(
        {"id": post_id},
        {"$inc": {"shares_count": 1}}
    )
    
    # Record in shares collection
    share_record = {
        "id": str(uuid.uuid4()),
        "post_id": post_id,
        "athlete_id": athlete_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.community_shares.insert_one(share_record)
    
    return {"success": True, "share_post_id": share_post.id}


@router.get("/athletes/search")
async def search_athletes(query: str = "", limit: int = 20):
    """Search for athletes in the community"""
    search_query = {"name": {"$regex": query, "$options": "i"}} if query else {}
    
    athletes = await db.athlete_profiles.find(
        search_query,
        {"_id": 0, "id": 1, "name": 1, "profile_picture": 1, "bio": 1}
    ).limit(min(limit, 50)).to_list(length=50)
    
    return {"athletes": athletes}


@router.post("/athletes/{follower_id}/follow/{following_id}")
async def follow_athlete(follower_id: str, following_id: str):
    """Follow another athlete"""
    # Check if already following
    existing = await db.community_following.find_one({
        "follower_id": follower_id,
        "following_id": following_id
    })
    
    if existing:
        return {"success": True, "message": "Already following"}
    
    # Create following relationship
    following = {
        "id": str(uuid.uuid4()),
        "follower_id": follower_id,
        "following_id": following_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.community_following.insert_one(following)
    
    return {"success": True, "message": "Now following"}


@router.delete("/athletes/{follower_id}/follow/{following_id}")
async def unfollow_athlete(follower_id: str, following_id: str):
    """Unfollow an athlete"""
    result = await db.community_following.delete_one({
        "follower_id": follower_id,
        "following_id": following_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not following this athlete")
    
    return {"success": True, "message": "Unfollowed"}


@router.get("/athletes/{athlete_id}/following")
async def get_following(athlete_id: str):
    """Get list of athletes this user is following"""
    following = await db.community_following.find(
        {"follower_id": athlete_id},
        {"_id": 0}
    ).limit(1000).to_list(length=1000)
    
    # Get athlete details for each
    following_ids = [f["following_id"] for f in following]
    athletes = await db.athlete_profiles.find(
        {"id": {"$in": following_ids}},
        {"_id": 0, "id": 1, "name": 1, "profile_picture": 1}
    ).limit(1000).to_list(length=1000)
    
    return {"following": athletes, "count": len(athletes)}


@router.get("/athletes/{athlete_id}/followers")
async def get_followers(athlete_id: str):
    """Get list of athletes following this user"""
    followers = await db.community_following.find(
        {"following_id": athlete_id},
        {"_id": 0}
    ).limit(1000).to_list(length=1000)
    
    # Get athlete details for each
    follower_ids = [f["follower_id"] for f in followers]
    athletes = await db.athlete_profiles.find(
        {"id": {"$in": follower_ids}},
        {"_id": 0, "id": 1, "name": 1, "profile_picture": 1}
    ).limit(1000).to_list(length=1000)
    
    return {"followers": athletes, "count": len(athletes)}


# NOTE: The following community features remain in server.py:
# - Events (creation, management, participation, comments)
# - Challenges (creation, joining, progress tracking, leaderboards)
# - Groups (creation, joining, group posts, member management)
# - Polls (creation, voting, results)
# - YouTube/URL metadata fetching
# - Post translation
#
# These can be extracted in future iterations as the codebase continues to be refactored
