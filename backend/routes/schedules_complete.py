"""
Schedules routes - Extracted from server.py
Handles automated analysis schedules and AI-generated recommendations
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging

# Import shared dependencies
from database import db
from utils import prepare_for_mongo, parse_from_mongo

router = APIRouter(prefix="/schedules", tags=["schedules"])

# ============= MODELS =============

class Schedule(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    name: str
    prompt: str
    frequency: str  # daily, weekly, after_workout, custom
    time: str  # HH:MM format
    days: Optional[List[str]] = []  # For custom frequency
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_executed: Optional[datetime] = None

class Recommendation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    schedule_id: Optional[str] = None
    title: str
    content: str
    category: Optional[str] = None
    priority: Optional[str] = "medium"
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    read: bool = False

# ============= ROUTES =============

@router.post("", response_model=Schedule)
async def create_schedule(schedule: Schedule):
    """Create a new automated analysis schedule"""
    # Check subscription tier and enforce limits
    athlete_id = schedule.athlete_id
    
    # Get current subscription status
    try:
        subscription = await db.athlete_profiles.find_one(
            {"id": athlete_id},
            {"_id": 0, "subscription_tier": 1}
        )
        tier = subscription.get('subscription_tier', 'free') if subscription else 'free'
    except Exception as e:
        logger.warning(f"Failed to fetch subscription tier for athlete {athlete_id}: {e}")
        tier = 'free'
    
    # Define schedule limits per tier
    schedule_limits = {
        'free': 1,
        'pro': 5,
        'premium': float('inf')
    }
    limit = schedule_limits.get(tier, 1)
    
    # Count existing schedules for this athlete
    existing_count = await db.schedules.count_documents({
        "athlete_id": athlete_id,
        "active": True
    })
    
    # Check if limit would be exceeded
    if existing_count >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"Schedule limit reached for {tier} plan. Current: {existing_count}, Limit: {int(limit) if limit != float('inf') else 'unlimited'}. Please upgrade to add more schedules."
        )
    
    schedule_dict = prepare_for_mongo(schedule.model_dump())
    await db.schedules.insert_one(schedule_dict)
    return schedule


@router.get("/{athlete_id}", response_model=List[Schedule])
async def get_athlete_schedules(athlete_id: str):
    """Get all schedules for an athlete"""
    schedules = await db.schedules.find(
        {"athlete_id": athlete_id, "active": True}, 
        {"_id": 0}
    ).limit(100).to_list(length=100)
    return [parse_from_mongo(s) for s in schedules]


@router.put("/{schedule_id}", response_model=Schedule)
async def update_schedule(schedule_id: str, updates: dict):
    """Update an existing schedule"""
    # Get the existing schedule to compare changes
    existing_schedule = await db.schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not existing_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Check if time or frequency is being changed
    time_changed = 'time' in updates and updates['time'] != existing_schedule.get('time')
    frequency_changed = 'frequency' in updates and updates['frequency'] != existing_schedule.get('frequency')
    
    # If time or frequency changed, reset last_executed to allow immediate re-execution
    if time_changed or frequency_changed:
        updates['last_executed'] = None
        logging.info(f"[SCHEDULE UPDATE] Resetting last_executed for schedule {schedule_id} due to time/frequency change")
    
    # Prepare updates for MongoDB
    update_data = prepare_for_mongo(updates)
    
    await db.schedules.update_one(
        {"id": schedule_id},
        {"$set": update_data}
    )
    
    updated_schedule = await db.schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not updated_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    return parse_from_mongo(updated_schedule)


@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: str):
    """Delete a schedule (soft delete by setting active=False)"""
    result = await db.schedules.update_one(
        {"id": schedule_id},
        {"$set": {"active": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    return {"message": "Schedule deleted successfully"}


# NOTE: The following endpoints remain in server.py due to dependencies on ai_coach service:
# - POST /schedules/execute-now/{schedule_id} - Manual trigger for testing
# - POST /schedules/execute - Background execution
# - GET /recommendations/{athlete_id} - Get recommendations
# - POST /recommendations/{athlete_id}/generate - Generate new recommendation
# - PUT /recommendations/{recommendation_id}/read - Mark as read
# - DELETE /recommendations/{recommendation_id} - Delete recommendation
#
# These endpoints require the ai_coach service and execute_scheduled_prompt function
# They can be migrated when ai_coach is refactored into a proper service module
