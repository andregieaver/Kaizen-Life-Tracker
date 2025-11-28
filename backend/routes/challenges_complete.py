"""
Challenges Router - Complete
Handles all challenge-related endpoints for the community
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
from uuid import uuid4
import logging

from database import db

# Initialize router
router = APIRouter(prefix="/community/challenges", tags=["challenges"])

# =====================================================
# PYDANTIC MODELS
# =====================================================

class Challenge(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid4()))
    title: str
    description: str
    challenge_type: str  # 'distance', 'activity_count', 'duration'
    goal_value: float  # Target value (km for distance, count for activities, minutes for duration)
    goal_unit: str  # 'km', 'activities', 'minutes'
    time_period: str = 'total'  # 'total', 'daily', 'weekly', 'monthly'
    start_date: str  # ISO format date
    end_date: str  # ISO format date
    visibility: str  # 'public', 'private'
    competition_type: str  # 'individual', 'team'
    cover_photo: Optional[str] = None
    trophy_image: Optional[str] = None
    creator_id: str
    creator_name: str
    creator_profile_picture: Optional[str] = None
    participants_count: int = 0
    is_recurring: bool = False
    recurrence_frequency: Optional[str] = None
    recurrence_count: Optional[int] = None
    group_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class ChallengeParticipation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid4()))
    challenge_id: str
    athlete_id: str
    athlete_name: str
    athlete_profile_picture: Optional[str] = None
    current_progress: float = 0.0
    percentage_complete: float = 0.0
    rank: Optional[int] = None
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChallengeComment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid4()))
    challenge_id: str
    athlete_id: str
    athlete_name: str
    athlete_profile_picture: Optional[str] = None
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChallengeAchievement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid4()))
    challenge_id: str
    challenge_title: str
    challenge_type: str
    trophy_image: Optional[str] = None
    athlete_id: str
    athlete_name: str
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    final_value: float

# =====================================================
# ENDPOINTS
# =====================================================

@router.post("")
async def create_challenge(challenge: dict, athlete_id: str = Query(...)):
    """Create a new challenge"""
    try:
        logging.info(f"Creating challenge for athlete: {athlete_id}")
        
        # Get creator info
        athlete = await db.athletes.find_one(
            {"$or": [{"id": athlete_id}, {"athlete_id": athlete_id}, {"_id": athlete_id}]},
            {"_id": 0, "name": 1, "profile_picture": 1}
        )
        
        if not athlete:
            # Fallback to user collection
            user = await db.users.find_one(
                {"$or": [{"id": athlete_id}, {"user_id": athlete_id}, {"_id": athlete_id}]},
                {"_id": 0, "name": 1, "email": 1}
            )
            if user:
                athlete = {"name": user.get("name", "Unknown User"), "profile_picture": None}
            else:
                athlete = {"name": "User", "profile_picture": None}
        
        # Create challenge object
        challenge_obj = Challenge(
            id=str(uuid4()),
            title=challenge.get("title"),
            description=challenge.get("description"),
            challenge_type=challenge.get("challenge_type"),
            goal_value=float(challenge.get("goal_value")),
            goal_unit=challenge.get("goal_unit"),
            start_date=challenge.get("start_date"),
            end_date=challenge.get("end_date"),
            visibility=challenge.get("visibility", "public"),
            competition_type=challenge.get("competition_type", "individual"),
            cover_photo=challenge.get("cover_photo"),
            trophy_image=challenge.get("trophy_image"),
            creator_id=athlete_id,
            creator_name=athlete.get("name", "Unknown User"),
            creator_profile_picture=athlete.get("profile_picture"),
            participants_count=0,
            is_recurring=challenge.get("is_recurring", False),
            recurrence_frequency=challenge.get("recurrence_frequency"),
            recurrence_count=challenge.get("recurrence_count"),
            group_id=challenge.get("group_id"),
            created_at=datetime.now(timezone.utc)
        )
        
        # Insert into database
        challenge_dict = challenge_obj.model_dump()
        challenge_dict["created_at"] = challenge_dict["created_at"].isoformat()
        if challenge_dict.get("updated_at"):
            challenge_dict["updated_at"] = challenge_dict["updated_at"].isoformat()
        
        await db.community_challenges.insert_one(challenge_dict)
        
        logging.info(f"Challenge created: {challenge_dict['id']}")
        return challenge_dict
        
    except Exception as e:
        logging.error(f"Error creating challenge: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
async def get_challenges(
    athlete_id: str = Query(None),
    status: str = Query("active"),
    limit: int = Query(50)
):
    """Get all challenges with optional filters"""
    try:
        query = {}
        
        # Filter by status
        if status == "active":
            now = datetime.now(timezone.utc).isoformat()
            query["start_date"] = {"$lte": now}
            query["end_date"] = {"$gte": now}
        elif status == "upcoming":
            now = datetime.now(timezone.utc).isoformat()
            query["start_date"] = {"$gt": now}
        elif status == "completed":
            now = datetime.now(timezone.utc).isoformat()
            query["end_date"] = {"$lt": now}
        
        # Filter by visibility
        if athlete_id:
            query["$or"] = [
                {"visibility": "public"},
                {"creator_id": athlete_id}
            ]
        else:
            query["visibility"] = "public"
        
        challenges = await db.community_challenges.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(length=limit)
        
        return {"challenges": challenges}
        
    except Exception as e:
        logging.error(f"Error fetching challenges: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{challenge_id}")
async def get_challenge(challenge_id: str):
    """Get a single challenge by ID with leaderboard"""
    try:
        # Get challenge
        challenge = await db.community_challenges.find_one(
            {"id": challenge_id},
            {"_id": 0}
        )
        
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        
        # Get leaderboard (participants sorted by progress)
        participants = await db.community_challenge_participants.find(
            {"challenge_id": challenge_id},
            {"_id": 0}
        ).sort("current_progress", -1).limit(100).to_list(length=100)
        
        # Update ranks
        for i, participant in enumerate(participants):
            participant["rank"] = i + 1
        
        challenge["participants"] = participants
        challenge["participants_count"] = len(participants)
        
        return challenge
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching challenge: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{challenge_id}")
async def update_challenge(challenge_id: str, challenge_data: dict, athlete_id: str = Query(...)):
    """Update a challenge (creator only)"""
    try:
        # Verify creator
        existing_challenge = await db.community_challenges.find_one(
            {"id": challenge_id},
            {"_id": 0, "creator_id": 1}
        )
        
        if not existing_challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        
        if existing_challenge["creator_id"] != athlete_id:
            raise HTTPException(status_code=403, detail="Only creator can update challenge")
        
        # Update challenge
        update_data = {k: v for k, v in challenge_data.items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.community_challenges.update_one(
            {"id": challenge_id},
            {"$set": update_data}
        )
        
        # Return updated challenge
        updated = await db.community_challenges.find_one({"id": challenge_id}, {"_id": 0})
        return updated
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating challenge: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{challenge_id}")
async def delete_challenge(challenge_id: str, athlete_id: str = Query(...)):
    """Delete a challenge (creator only)"""
    try:
        # Verify creator
        challenge = await db.community_challenges.find_one(
            {"id": challenge_id},
            {"_id": 0, "creator_id": 1}
        )
        
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        
        if challenge["creator_id"] != athlete_id:
            raise HTTPException(status_code=403, detail="Only creator can delete challenge")
        
        # Delete challenge and related data
        await db.community_challenges.delete_one({"id": challenge_id})
        await db.community_challenge_participants.delete_many({"challenge_id": challenge_id})
        await db.community_challenge_comments.delete_many({"challenge_id": challenge_id})
        
        return {"message": "Challenge deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting challenge: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{challenge_id}/join")
async def join_challenge(challenge_id: str, athlete_id: str = Query(...)):
    """Join a challenge"""
    try:
        # Check if challenge exists
        challenge = await db.community_challenges.find_one(
            {"id": challenge_id},
            {"_id": 0}
        )
        
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        
        # Check if already joined
        existing = await db.community_challenge_participants.find_one({
            "challenge_id": challenge_id,
            "athlete_id": athlete_id
        })
        
        if existing:
            raise HTTPException(status_code=400, detail="Already joined this challenge")
        
        # Get athlete info
        athlete = await db.athletes.find_one(
            {"$or": [{"id": athlete_id}, {"athlete_id": athlete_id}]},
            {"_id": 0, "name": 1, "profile_picture": 1}
        )
        
        if not athlete:
            athlete = {"name": "User", "profile_picture": None}
        
        # Create participation record
        participation = ChallengeParticipation(
            id=str(uuid4()),
            challenge_id=challenge_id,
            athlete_id=athlete_id,
            athlete_name=athlete.get("name", "User"),
            athlete_profile_picture=athlete.get("profile_picture"),
            current_progress=0.0,
            percentage_complete=0.0,
            joined_at=datetime.now(timezone.utc),
            last_updated=datetime.now(timezone.utc)
        )
        
        participation_dict = participation.model_dump()
        participation_dict["joined_at"] = participation_dict["joined_at"].isoformat()
        participation_dict["last_updated"] = participation_dict["last_updated"].isoformat()
        
        await db.community_challenge_participants.insert_one(participation_dict)
        
        # Update participant count
        await db.community_challenges.update_one(
            {"id": challenge_id},
            {"$inc": {"participants_count": 1}}
        )
        
        return {"message": "Joined challenge successfully", "participation": participation_dict}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error joining challenge: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{challenge_id}/leave")
async def leave_challenge(challenge_id: str, athlete_id: str = Query(...)):
    """Leave a challenge"""
    try:
        # Delete participation
        result = await db.community_challenge_participants.delete_one({
            "challenge_id": challenge_id,
            "athlete_id": athlete_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Not participating in this challenge")
        
        # Update participant count
        await db.community_challenges.update_one(
            {"id": challenge_id},
            {"$inc": {"participants_count": -1}}
        )
        
        return {"message": "Left challenge successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error leaving challenge: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{challenge_id}/update-progress")
async def update_challenge_progress(
    challenge_id: str,
    progress_data: dict,
    athlete_id: str = Query(...)
):
    """Update progress for a challenge"""
    try:
        # Get participation record
        participation = await db.community_challenge_participants.find_one({
            "challenge_id": challenge_id,
            "athlete_id": athlete_id
        })
        
        if not participation:
            raise HTTPException(status_code=404, detail="Not participating in this challenge")
        
        # Get challenge to calculate percentage
        challenge = await db.community_challenges.find_one(
            {"id": challenge_id},
            {"_id": 0, "goal_value": 1, "trophy_image": 1, "title": 1, "challenge_type": 1}
        )
        
        new_progress = float(progress_data.get("progress", 0))
        percentage = (new_progress / challenge["goal_value"]) * 100 if challenge["goal_value"] > 0 else 0
        
        # Update progress
        await db.community_challenge_participants.update_one(
            {
                "challenge_id": challenge_id,
                "athlete_id": athlete_id
            },
            {
                "$set": {
                    "current_progress": new_progress,
                    "percentage_complete": percentage,
                    "last_updated": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Check if challenge is completed
        if percentage >= 100:
            # Check if achievement already exists
            existing_achievement = await db.community_challenge_achievements.find_one({
                "challenge_id": challenge_id,
                "athlete_id": athlete_id
            })
            
            if not existing_achievement:
                # Get athlete info
                athlete = await db.athletes.find_one(
                    {"$or": [{"id": athlete_id}, {"athlete_id": athlete_id}]},
                    {"_id": 0, "name": 1}
                )
                
                # Create achievement
                achievement = ChallengeAchievement(
                    id=str(uuid4()),
                    challenge_id=challenge_id,
                    challenge_title=challenge["title"],
                    challenge_type=challenge["challenge_type"],
                    trophy_image=challenge.get("trophy_image"),
                    athlete_id=athlete_id,
                    athlete_name=athlete.get("name", "User") if athlete else "User",
                    completed_at=datetime.now(timezone.utc),
                    final_value=new_progress
                )
                
                achievement_dict = achievement.model_dump()
                achievement_dict["completed_at"] = achievement_dict["completed_at"].isoformat()
                
                await db.community_challenge_achievements.insert_one(achievement_dict)
                
                return {
                    "message": "Progress updated and challenge completed!",
                    "achievement": achievement_dict,
                    "progress": new_progress,
                    "percentage": percentage
                }
        
        return {
            "message": "Progress updated",
            "progress": new_progress,
            "percentage": percentage
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating challenge progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{challenge_id}/comments")
async def add_challenge_comment(
    challenge_id: str,
    comment_data: dict,
    athlete_id: str = Query(...)
):
    """Add a comment to a challenge"""
    try:
        # Get athlete info
        athlete = await db.athletes.find_one(
            {"$or": [{"id": athlete_id}, {"athlete_id": athlete_id}]},
            {"_id": 0, "name": 1, "profile_picture": 1}
        )
        
        if not athlete:
            athlete = {"name": "User", "profile_picture": None}
        
        # Create comment
        comment = ChallengeComment(
            id=str(uuid4()),
            challenge_id=challenge_id,
            athlete_id=athlete_id,
            athlete_name=athlete.get("name", "User"),
            athlete_profile_picture=athlete.get("profile_picture"),
            content=comment_data.get("content", ""),
            created_at=datetime.now(timezone.utc)
        )
        
        comment_dict = comment.model_dump()
        comment_dict["created_at"] = comment_dict["created_at"].isoformat()
        
        await db.community_challenge_comments.insert_one(comment_dict)
        
        return comment_dict
        
    except Exception as e:
        logging.error(f"Error adding challenge comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{challenge_id}/comments")
async def get_challenge_comments(challenge_id: str, limit: int = Query(50)):
    """Get comments for a challenge"""
    try:
        comments = await db.community_challenge_comments.find(
            {"challenge_id": challenge_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(length=limit)
        
        return {"comments": comments}
        
    except Exception as e:
        logging.error(f"Error fetching challenge comments: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/achievements/{athlete_id}")
async def get_athlete_achievements(athlete_id: str):
    """Get all earned trophies/achievements for an athlete"""
    try:
        achievements = await db.community_challenge_achievements.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).sort("completed_at", -1).limit(100).to_list(length=100)
        
        return {"achievements": achievements}
    except Exception as e:
        logging.error(f"Error fetching achievements: {e}")
        raise HTTPException(status_code=500, detail=str(e))
