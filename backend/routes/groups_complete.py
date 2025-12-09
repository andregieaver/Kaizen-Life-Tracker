"""
Groups Router - Complete
Handles all group-related endpoints for the community
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
from uuid import uuid4
import logging

from database import db

# Initialize router
router = APIRouter(prefix="/community/groups", tags=["groups"])

# =====================================================
# PYDANTIC MODELS
# =====================================================

class Group(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    description: str
    privacy: str  # 'public' or 'private'
    profile_image: Optional[str] = None
    cover_photo: Optional[str] = None
    rules: Optional[str] = None
    admin_id: str
    members_count: int = 1
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class GroupMembership(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid4()))
    group_id: str
    athlete_id: str
    role: str  # 'admin', 'manager', 'moderator', 'member'
    status: str  # 'pending', 'approved'
    rules_accepted: bool = False
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GroupPost(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid4()))
    group_id: str
    athlete_id: str
    athlete_name: str
    athlete_profile_picture: Optional[str] = None
    content: str
    image_data: Optional[str] = None
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_edited: bool = False

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
# ENDPOINTS
# =====================================================

@router.post("")
async def create_group(group_data: dict, athlete_id: str = Query(...)):
    """Create a new group"""
    try:
        # Create group
        group = {
            "id": str(uuid4()),
            "name": group_data.get("name", ""),
            "description": group_data.get("description", ""),
            "privacy": group_data.get("privacy", "public"),
            "profile_image": group_data.get("profile_image"),
            "cover_photo": group_data.get("cover_photo"),
            "rules": group_data.get("rules"),
            "admin_id": athlete_id,
            "members_count": 1,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": None
        }
        
        await db.community_groups.insert_one(prepare_for_mongo(group.copy()))
        
        # Add admin as member
        membership = {
            "id": str(uuid4()),
            "group_id": group["id"],
            "athlete_id": athlete_id,
            "role": "admin",
            "status": "approved",
            "rules_accepted": True,
            "joined_at": datetime.now(timezone.utc).isoformat()
        }
        await db.community_group_memberships.insert_one(prepare_for_mongo(membership.copy()))
        
        return {"success": True, "group": group}
    except Exception as e:
        logging.error(f"Error creating group: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
async def get_all_groups(
    athlete_id: str = Query(...),
    limit: int = Query(50),
    skip: int = Query(0),
    exclude_images: bool = Query(False)
):
    """Get all groups - Optimized with pagination and optional image exclusion"""
    try:
        # Build projection
        projection = {"_id": 0}
        if exclude_images:
            projection["profile_image"] = 0
            projection["cover_photo"] = 0
        
        # Build query - show all public groups + private groups user is a member of
        # Get user's group memberships (capped at 1000)
        memberships = await db.community_group_memberships.find(
            {"athlete_id": athlete_id, "status": "approved"},
            {"_id": 0, "group_id": 1}
        ).to_list(length=1000)
        
        member_group_ids = [m["group_id"] for m in memberships]
        
        # Query: public groups OR groups user is a member of
        query = {
            "$or": [
                {"privacy": "public"},
                {"id": {"$in": member_group_ids}}
            ]
        }
        
        groups = await db.community_groups.find(
            query,
            projection
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
        
        # For each group, check if user is a member and add their role
        for group in groups:
            membership = await db.community_group_memberships.find_one({
                "group_id": group["id"],
                "athlete_id": athlete_id
            }, {"_id": 0, "role": 1, "status": 1})
            
            if membership:
                group["user_role"] = membership.get("role")
                group["user_membership_status"] = membership.get("status")
                group["is_member"] = membership.get("status") == "approved"
            else:
                group["user_role"] = None
                group["user_membership_status"] = None
                group["is_member"] = False
        
        return {"groups": groups, "total": len(groups)}
    except Exception as e:
        logging.error(f"Error fetching groups: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/my/{athlete_id}")
async def get_my_groups(athlete_id: str, limit: int = Query(50)):
    """Get groups that the athlete is a member of"""
    try:
        # Get user's approved memberships (capped at 1000)
        memberships = await db.community_group_memberships.find(
            {"athlete_id": athlete_id, "status": "approved"},
            {"_id": 0, "group_id": 1, "role": 1}
        ).to_list(length=1000)
        
        if not memberships:
            return {"groups": []}
        
        # Get group details
        group_ids = [m["group_id"] for m in memberships]
        groups = await db.community_groups.find(
            {"id": {"$in": group_ids}},
            {"_id": 0}
        ).limit(limit).to_list(length=limit)
        
        # Add user role to each group
        membership_map = {m["group_id"]: m["role"] for m in memberships}
        for group in groups:
            group["user_role"] = membership_map.get(group["id"])
            group["is_member"] = True
        
        return {"groups": groups}
    except Exception as e:
        logging.error(f"Error fetching user groups: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{group_id}")
async def get_group(group_id: str, athlete_id: str = Query(...)):
    """Get detailed information about a specific group"""
    try:
        group = await db.community_groups.find_one({"id": group_id}, {"_id": 0})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        # Check if user can access private group
        if group["privacy"] == "private":
            membership = await db.community_group_memberships.find_one({
                "group_id": group_id,
                "athlete_id": athlete_id,
                "status": "approved"
            })
            if not membership:
                raise HTTPException(status_code=403, detail="Private group - members only")
        
        # Get members
        memberships = await db.community_group_memberships.find(
            {"group_id": group_id, "status": "approved"},
            {"_id": 0}
        ).limit(100).to_list(length=100)
        
        # Get athlete details for members (capped at 1000)
        athlete_ids = [m["athlete_id"] for m in memberships]
        athletes = await db.athletes.find(
            {"$or": [{"id": {"$in": athlete_ids}}, {"athlete_id": {"$in": athlete_ids}}]},
            {"_id": 0, "id": 1, "athlete_id": 1, "name": 1, "profile_picture": 1}
        ).to_list(length=1000)
        
        # Create athlete lookup
        athlete_lookup = {}
        for athlete in athletes:
            key = athlete.get("id") or athlete.get("athlete_id")
            athlete_lookup[key] = athlete
        
        # Enrich memberships with athlete data
        for membership in memberships:
            athlete_data = athlete_lookup.get(membership["athlete_id"], {})
            membership["athlete_name"] = athlete_data.get("name", "Unknown")
            membership["athlete_profile_picture"] = athlete_data.get("profile_picture")
        
        group["members"] = memberships
        
        # Check current user's membership
        user_membership = await db.community_group_memberships.find_one({
            "group_id": group_id,
            "athlete_id": athlete_id
        }, {"_id": 0, "role": 1, "status": 1})
        
        if user_membership:
            group["user_role"] = user_membership.get("role")
            group["user_membership_status"] = user_membership.get("status")
            group["is_member"] = user_membership.get("status") == "approved"
        else:
            group["user_role"] = None
            group["user_membership_status"] = None
            group["is_member"] = False
        
        return group
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching group: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{group_id}")
async def update_group(group_id: str, group_data: dict, athlete_id: str = Query(...)):
    """Update group details (admin only)"""
    try:
        # Verify admin
        membership = await db.community_group_memberships.find_one({
            "group_id": group_id,
            "athlete_id": athlete_id,
            "role": "admin"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Only admin can update group")
        
        # Update group
        update_data = {k: v for k, v in group_data.items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.community_groups.update_one(
            {"id": group_id},
            {"$set": update_data}
        )
        
        # Return updated group
        updated = await db.community_groups.find_one({"id": group_id}, {"_id": 0})
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating group: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{group_id}")
async def delete_group(group_id: str, athlete_id: str = Query(...)):
    """Delete a group (admin only)"""
    try:
        # Check if group exists
        group = await db.community_groups.find_one({"id": group_id}, {"_id": 0})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        # Check if user is admin via membership OR is the original creator
        is_creator = group.get("admin_id") == athlete_id
        
        membership = await db.community_group_memberships.find_one({
            "group_id": group_id,
            "athlete_id": athlete_id,
            "role": "admin"
        })
        
        if not membership and not is_creator:
            raise HTTPException(status_code=403, detail="Only admin can delete group")
        
        # Delete group and related data
        await db.community_groups.delete_one({"id": group_id})
        await db.community_group_memberships.delete_many({"group_id": group_id})
        await db.community_group_posts.delete_many({"group_id": group_id})
        
        return {"message": "Group deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting group: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{group_id}/join")
async def join_group(group_id: str, athlete_id: str = Query(...)):
    """Join a group"""
    try:
        # Check if group exists
        group = await db.community_groups.find_one({"id": group_id}, {"_id": 0})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        # Check if already a member
        existing = await db.community_group_memberships.find_one({
            "group_id": group_id,
            "athlete_id": athlete_id
        })
        
        if existing:
            raise HTTPException(status_code=400, detail="Already a member or pending approval")
        
        # Create membership (auto-approved for public, pending for private)
        status = "approved" if group["privacy"] == "public" else "pending"
        rules_accepted = group.get("rules") is None  # Auto-accept if no rules
        
        membership = {
            "id": str(uuid4()),
            "group_id": group_id,
            "athlete_id": athlete_id,
            "role": "member",
            "status": status,
            "rules_accepted": rules_accepted,
            "joined_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.community_group_memberships.insert_one(prepare_for_mongo(membership.copy()))
        
        # Update member count if auto-approved
        if status == "approved":
            await db.community_groups.update_one(
                {"id": group_id},
                {"$inc": {"members_count": 1}}
            )
        
        return {
            "message": "Joined group successfully" if status == "approved" else "Join request pending approval",
            "status": status,
            "membership": membership
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error joining group: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{group_id}/leave")
async def leave_group(group_id: str, athlete_id: str = Query(...)):
    """Leave a group"""
    try:
        # Check if user is admin
        membership = await db.community_group_memberships.find_one({
            "group_id": group_id,
            "athlete_id": athlete_id
        })
        
        if not membership:
            raise HTTPException(status_code=404, detail="Not a member of this group")
        
        if membership["role"] == "admin":
            raise HTTPException(status_code=400, detail="Admin cannot leave. Transfer admin role or delete group")
        
        # Delete membership
        await db.community_group_memberships.delete_one({
            "group_id": group_id,
            "athlete_id": athlete_id
        })
        
        # Update member count if was approved
        if membership["status"] == "approved":
            await db.community_groups.update_one(
                {"id": group_id},
                {"$inc": {"members_count": -1}}
            )
        
        return {"message": "Left group successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error leaving group: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{group_id}/members/{target_athlete_id}")
async def update_member_role(
    group_id: str,
    target_athlete_id: str,
    update_data: dict,
    athlete_id: str = Query(...)
):
    """Update member role or approve membership (admin/manager only)"""
    try:
        # Verify requester is admin or manager
        requester = await db.community_group_memberships.find_one({
            "group_id": group_id,
            "athlete_id": athlete_id
        })
        
        if not requester or requester["role"] not in ["admin", "manager"]:
            raise HTTPException(status_code=403, detail="Only admin/manager can update members")
        
        # Get target membership
        target = await db.community_group_memberships.find_one({
            "group_id": group_id,
            "athlete_id": target_athlete_id
        })
        
        if not target:
            raise HTTPException(status_code=404, detail="Member not found")
        
        # Build update
        updates = {}
        if "role" in update_data:
            # Only admin can change roles
            if requester["role"] != "admin":
                raise HTTPException(status_code=403, detail="Only admin can change roles")
            updates["role"] = update_data["role"]
        
        if "status" in update_data:
            old_status = target["status"]
            new_status = update_data["status"]
            updates["status"] = new_status
            
            # Update member count if status changed
            if old_status != new_status:
                if new_status == "approved":
                    await db.community_groups.update_one(
                        {"id": group_id},
                        {"$inc": {"members_count": 1}}
                    )
                elif old_status == "approved":
                    await db.community_groups.update_one(
                        {"id": group_id},
                        {"$inc": {"members_count": -1}}
                    )
        
        # Update membership
        if updates:
            await db.community_group_memberships.update_one(
                {"group_id": group_id, "athlete_id": target_athlete_id},
                {"$set": updates}
            )
        
        return {"message": "Member updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating member: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{group_id}/posts")
async def create_group_post(group_id: str, post_data: dict, athlete_id: str = Query(...)):
    """Create a post in a group"""
    try:
        # Verify membership
        membership = await db.community_group_memberships.find_one({
            "group_id": group_id,
            "athlete_id": athlete_id,
            "status": "approved"
        })
        
        if not membership:
            raise HTTPException(status_code=403, detail="Must be a member to post")
        
        # Get athlete info
        athlete = await db.athletes.find_one(
            {"$or": [{"id": athlete_id}, {"athlete_id": athlete_id}]},
            {"_id": 0, "name": 1, "profile_picture": 1}
        )
        
        if not athlete:
            athlete = {"name": "User", "profile_picture": None}
        
        # Create post
        post = {
            "id": str(uuid4()),
            "group_id": group_id,
            "athlete_id": athlete_id,
            "athlete_name": athlete.get("name", "User"),
            "athlete_profile_picture": athlete.get("profile_picture"),
            "content": post_data.get("content", ""),
            "image_data": post_data.get("image_data"),
            "likes_count": 0,
            "comments_count": 0,
            "shares_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": None,
            "is_edited": False
        }
        
        await db.community_group_posts.insert_one(prepare_for_mongo(post.copy()))
        
        return post
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating group post: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{group_id}/posts")
async def get_group_posts(group_id: str, athlete_id: str = Query(...), limit: int = Query(50)):
    """Get posts from a group with subscription tier"""
    try:
        # Verify membership for private groups
        group = await db.community_groups.find_one({"id": group_id}, {"_id": 0})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        if group["privacy"] == "private":
            membership = await db.community_group_memberships.find_one({
                "group_id": group_id,
                "athlete_id": athlete_id,
                "status": "approved"
            })
            if not membership:
                raise HTTPException(status_code=403, detail="Must be a member to view posts")
        
        # Get posts with subscription tier using aggregation
        pipeline = [
            {"$match": {"group_id": group_id}},
            {"$sort": {"created_at": -1}},
            {"$limit": limit},
            {
                "$lookup": {
                    "from": "athlete_profiles",
                    "localField": "athlete_id",
                    "foreignField": "id",
                    "as": "athlete_info"
                }
            },
            {
                "$addFields": {
                    "subscription_tier": {"$arrayElemAt": ["$athlete_info.subscription_tier", 0]},
                    "nationality": {"$arrayElemAt": ["$athlete_info.nationality", 0]}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "athlete_info": 0
                }
            }
        ]
        
        posts = await db.community_group_posts.aggregate(pipeline).to_list(length=100)
        
        # For each post, check if current user has liked it
        for post in posts:
            like = await db.community_likes.find_one({
                "post_id": post["id"],
                "athlete_id": athlete_id
            })
            post["liked_by_user"] = like is not None
        
        return {"posts": posts}
    except Exception as e:
        logging.error(f"Error fetching group posts: {e}")
        raise HTTPException(status_code=500, detail=str(e))
