"""
Events Router - Complete
Handles all event-related endpoints for the community
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
from uuid import uuid4
import logging
import re

from database import db

# Initialize router
router = APIRouter(prefix="/community/events", tags=["events"])

# =====================================================
# PYDANTIC MODELS
# =====================================================

class Event(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    description: str
    visibility: str  # 'open', 'private'
    event_date: str  # ISO format date
    event_time: str  # HH:MM format
    location: Optional[str] = None
    profile_image: Optional[str] = None
    cover_photo: Optional[str] = None
    group_id: Optional[str] = None
    creator_id: str
    interested_count: int = 0
    going_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class EventAttendance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid4()))
    event_id: str
    athlete_id: str
    status: str  # 'interested', 'going', 'not_going'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
async def create_event(event_data: dict, athlete_id: str = Query(...)):
    """Create a new event"""
    try:
        # Create event
        event = {
            "id": str(uuid4()),
            "name": event_data.get("name", ""),
            "description": event_data.get("description", ""),
            "visibility": event_data.get("visibility", "open"),
            "event_date": event_data.get("event_date", ""),
            "event_time": event_data.get("event_time", ""),
            "location": event_data.get("location"),
            "profile_image": event_data.get("profile_image"),
            "cover_photo": event_data.get("cover_photo"),
            "group_id": event_data.get("group_id"),
            "creator_id": athlete_id,
            "interested_count": 0,
            "going_count": 0,
            "comments_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": None
        }
        
        await db.community_events.insert_one(prepare_for_mongo(event.copy()))
        
        # If connected to a group, notify all group members
        if event.get("group_id"):
            group_memberships = await db.community_group_memberships.find({
                "group_id": event["group_id"],
                "status": "approved"
            }, {"_id": 0}).limit(100).to_list(length=100)
            
            creator = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
            
            for membership in group_memberships:
                if membership["athlete_id"] != athlete_id:  # Don't notify creator
                    notification = {
                        "id": str(uuid4()),
                        "athlete_id": membership["athlete_id"],
                        "type": "event_invite",
                        "content": f"{creator.get('name', 'Someone')} created an event: {event['name']}",
                        "from_athlete_id": athlete_id,
                        "from_athlete_name": creator.get("name", "Unknown"),
                        "read": False,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "event_id": event["id"]
                    }
                    await db.community_notifications.insert_one(prepare_for_mongo(notification.copy()))
        
        return {"success": True, "event": event}
    except Exception as e:
        logging.error(f"Error creating event: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
async def get_all_events(
    athlete_id: str = Query(...),
    group_id: str = Query(None),
    limit: int = Query(50),
    skip: int = Query(0),
    exclude_images: bool = Query(False)
):
    """Get all events (open events + group events where user is member) - Optimized with pagination and image exclusion"""
    try:
        # Build projection to exclude images if requested
        projection_stage = {
            "$project": {
                "_id": 0,
                "user_attendance": 0
            }
        }
        
        if exclude_images:
            projection_stage["$project"]["profile_image"] = 0
            projection_stage["$project"]["cover_photo"] = 0
        
        # Build query
        query = {}
        
        if group_id:
            # Filter by group
            query["group_id"] = group_id
        else:
            # Get user's group memberships
            memberships = await db.community_group_memberships.find(
                {"athlete_id": athlete_id, "status": "approved"},
                {"_id": 0, "group_id": 1}
            ).to_list(length=None)
            
            member_group_ids = [m["group_id"] for m in memberships]
            
            # Show: open events OR events in user's groups
            query["$or"] = [
                {"visibility": "open"},
                {"group_id": {"$in": member_group_ids}}
            ]
        
        # Get events
        events = await db.community_events.find(
            query,
            {"_id": 0} if not exclude_images else {"_id": 0, "profile_image": 0, "cover_photo": 0}
        ).sort("event_date", 1).skip(skip).limit(limit).to_list(length=limit)
        
        # For each event, get user's attendance status
        for event in events:
            attendance = await db.community_event_attendance.find_one({
                "event_id": event["id"],
                "athlete_id": athlete_id
            }, {"_id": 0, "status": 1})
            
            event["user_attendance"] = attendance.get("status") if attendance else None
        
        return {"events": events, "total": len(events)}
    except Exception as e:
        logging.error(f"Error fetching events: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{event_id}")
async def get_event(event_id: str, athlete_id: str = Query(...)):
    """Get detailed information about a specific event"""
    try:
        event = await db.community_events.find_one({"id": event_id}, {"_id": 0})
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Check if user can access private event
        if event["visibility"] == "private" and event.get("group_id"):
            membership = await db.community_group_memberships.find_one({
                "group_id": event["group_id"],
                "athlete_id": athlete_id,
                "status": "approved"
            })
            if not membership:
                raise HTTPException(status_code=403, detail="Private event - group members only")
        
        # Get attendees
        attendees = await db.community_event_attendance.find(
            {"event_id": event_id},
            {"_id": 0}
        ).limit(100).to_list(length=100)
        
        # Get athlete details for attendees
        athlete_ids = [a["athlete_id"] for a in attendees]
        athletes = await db.athlete_profiles.find(
            {"id": {"$in": athlete_ids}},
            {"_id": 0, "id": 1, "name": 1, "profile_picture": 1}
        ).to_list(length=None)
        
        # Create athlete lookup
        athlete_lookup = {a["id"]: a for a in athletes}
        
        # Enrich attendees with athlete data
        for attendee in attendees:
            athlete_data = athlete_lookup.get(attendee["athlete_id"], {})
            attendee["athlete_name"] = athlete_data.get("name", "Unknown")
            attendee["athlete_profile_picture"] = athlete_data.get("profile_picture")
        
        event["attendees"] = attendees
        
        # Check current user's attendance
        user_attendance = await db.community_event_attendance.find_one({
            "event_id": event_id,
            "athlete_id": athlete_id
        }, {"_id": 0, "status": 1})
        
        event["user_attendance"] = user_attendance.get("status") if user_attendance else None
        
        return event
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching event: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{event_id}")
async def update_event(event_id: str, event_data: dict, athlete_id: str = Query(...)):
    """Update event details (creator only)"""
    try:
        # Verify creator
        event = await db.community_events.find_one(
            {"id": event_id},
            {"_id": 0, "creator_id": 1}
        )
        
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        if event["creator_id"] != athlete_id:
            raise HTTPException(status_code=403, detail="Only creator can update event")
        
        # Update event
        update_data = {k: v for k, v in event_data.items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.community_events.update_one(
            {"id": event_id},
            {"$set": update_data}
        )
        
        # Return updated event
        updated = await db.community_events.find_one({"id": event_id}, {"_id": 0})
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating event: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{event_id}")
async def delete_event(event_id: str, athlete_id: str = Query(...)):
    """Delete an event (creator only)"""
    try:
        # Verify creator
        event = await db.community_events.find_one(
            {"id": event_id},
            {"_id": 0, "creator_id": 1}
        )
        
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        if event["creator_id"] != athlete_id:
            raise HTTPException(status_code=403, detail="Only creator can delete event")
        
        # Delete event and related data
        await db.community_events.delete_one({"id": event_id})
        await db.community_event_attendance.delete_many({"event_id": event_id})
        await db.community_event_comments.delete_many({"event_id": event_id})
        
        return {"message": "Event deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting event: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{event_id}/rsvp")
async def rsvp_event(event_id: str, rsvp_data: dict, athlete_id: str = Query(...)):
    """RSVP to an event (interested/going)"""
    try:
        # Check if event exists
        event = await db.community_events.find_one({"id": event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        status = rsvp_data.get("status")  # 'interested', 'going', 'not_going'
        
        if status not in ["interested", "going", "not_going"]:
            raise HTTPException(status_code=400, detail="Invalid RSVP status")
        
        # Check existing RSVP
        existing_rsvp = await db.community_event_attendance.find_one({
            "event_id": event_id,
            "athlete_id": athlete_id
        })
        
        if status == "not_going":
            # Remove RSVP
            if existing_rsvp:
                old_status = existing_rsvp.get("status")
                await db.community_event_attendance.delete_one({"id": existing_rsvp["id"]})
                
                # Update counts
                if old_status == "interested":
                    await db.community_events.update_one({"id": event_id}, {"$inc": {"interested_count": -1}})
                elif old_status == "going":
                    await db.community_events.update_one({"id": event_id}, {"$inc": {"going_count": -1}})
        else:
            if existing_rsvp:
                # Update existing RSVP
                old_status = existing_rsvp.get("status")
                await db.community_event_attendance.update_one(
                    {"id": existing_rsvp["id"]},
                    {"$set": {"status": status}}
                )
                
                # Update counts
                if old_status == "interested":
                    await db.community_events.update_one({"id": event_id}, {"$inc": {"interested_count": -1}})
                elif old_status == "going":
                    await db.community_events.update_one({"id": event_id}, {"$inc": {"going_count": -1}})
                
                if status == "interested":
                    await db.community_events.update_one({"id": event_id}, {"$inc": {"interested_count": 1}})
                elif status == "going":
                    await db.community_events.update_one({"id": event_id}, {"$inc": {"going_count": 1}})
            else:
                # Create new RSVP
                rsvp = {
                    "id": str(uuid4()),
                    "event_id": event_id,
                    "athlete_id": athlete_id,
                    "status": status,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.community_event_attendance.insert_one(prepare_for_mongo(rsvp.copy()))
                
                # Update counts
                if status == "interested":
                    await db.community_events.update_one({"id": event_id}, {"$inc": {"interested_count": 1}})
                elif status == "going":
                    await db.community_events.update_one({"id": event_id}, {"$inc": {"going_count": 1}})
        
        # Get updated event
        updated_event = await db.community_events.find_one({"id": event_id}, {"_id": 0})
        return {
            "success": True,
            "status": status,
            "interested_count": updated_event["interested_count"],
            "going_count": updated_event["going_count"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error RSVP event: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{event_id}/comment")
async def add_event_comment(event_id: str, comment: dict, athlete_id: str = Query(...)):
    """Add a comment to an event"""
    try:
        # Get athlete info
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        # Create comment
        new_comment = {
            "id": str(uuid4()),
            "event_id": event_id,
            "athlete_id": athlete_id,
            "athlete_name": athlete.get("name", "Unknown"),
            "athlete_profile_picture": athlete.get("profile_picture"),
            "content": comment.get("content", ""),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.community_event_comments.insert_one(prepare_for_mongo(new_comment.copy()))
        
        # Increment comment count
        await db.community_events.update_one(
            {"id": event_id},
            {"$inc": {"comments_count": 1}}
        )
        
        # Get updated count
        event = await db.community_events.find_one({"id": event_id}, {"_id": 0, "comments_count": 1, "creator_id": 1})
        
        # Send notification to event creator (if not commenting on own event)
        if event and event.get("creator_id") and event["creator_id"] != athlete_id:
            notification = {
                "id": str(uuid4()),
                "athlete_id": event["creator_id"],
                "type": "event_comment",
                "content": f"{athlete.get('name', 'Someone')} commented on your event",
                "event_id": event_id,
                "from_athlete_id": athlete_id,
                "from_athlete_name": athlete.get("name", "Unknown"),
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.community_notifications.insert_one(prepare_for_mongo(notification.copy()))
        
        # Handle @mentions in comment
        content = comment.get("content", "")
        mention_pattern = r'@\[\[([^\]]+)::([^\]]+)\]\]'
        mentions = re.findall(mention_pattern, content)
        
        for mentioned_id, mentioned_name in mentions:
            if mentioned_id != athlete_id:  # Don't notify yourself
                notification = {
                    "id": str(uuid4()),
                    "athlete_id": mentioned_id,
                    "type": "mention",
                    "content": f"{athlete.get('name', 'Someone')} mentioned you in an event comment",
                    "event_id": event_id,
                    "comment_id": new_comment["id"],
                    "from_athlete_id": athlete_id,
                    "from_athlete_name": athlete.get("name", "Unknown"),
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.community_notifications.insert_one(prepare_for_mongo(notification.copy()))
        
        return {
            "comment": new_comment,
            "comments_count": event.get("comments_count", 1)
        }
    except Exception as e:
        logging.error(f"Error adding event comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{event_id}/comments")
async def get_event_comments(event_id: str):
    """Get all comments for an event with subscription tier"""
    try:
        # Use aggregation to include subscription tier from athlete_profiles
        pipeline = [
            {"$match": {"event_id": event_id}},
            {"$sort": {"created_at": 1}},
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
                    "subscription_tier": {"$arrayElemAt": ["$athlete_info.subscription_tier", 0]}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "athlete_info": 0
                }
            }
        ]
        
        comments = await db.community_event_comments.aggregate(pipeline).to_list(length=500)
        
        return {"comments": comments}
    except Exception as e:
        logging.error(f"Error fetching event comments: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{event_id}/comment/{comment_id}")
async def delete_event_comment(event_id: str, comment_id: str, athlete_id: str = Query(...)):
    """Delete an event comment (comment author or event creator only)"""
    try:
        # Get comment
        comment = await db.community_event_comments.find_one({"id": comment_id}, {"_id": 0})
        if not comment:
            raise HTTPException(status_code=404, detail="Comment not found")
        
        # Get event
        event = await db.community_events.find_one({"id": event_id}, {"_id": 0, "creator_id": 1})
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Check if user is comment author or event creator
        if comment["athlete_id"] != athlete_id and event["creator_id"] != athlete_id:
            raise HTTPException(status_code=403, detail="Only comment author or event creator can delete")
        
        # Delete comment
        await db.community_event_comments.delete_one({"id": comment_id})
        
        # Decrement comment count
        await db.community_events.update_one(
            {"id": event_id},
            {"$inc": {"comments_count": -1}}
        )
        
        return {"message": "Comment deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting event comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))
