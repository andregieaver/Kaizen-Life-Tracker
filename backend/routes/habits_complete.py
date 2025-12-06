"""
Habits routes - Extracted from server.py
Handles habit tracking, completions, and management
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging

# Import shared dependencies
from database import db
from utils import apply_query_limit

router = APIRouter(prefix="/habits", tags=["habits"])

# ============= MODELS =============

class Habit(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    title: str
    days_of_week: List[str]  # ['monday', 'tuesday', etc.]
    times_per_day: int
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class HabitCompletion(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    habit_id: str
    athlete_id: str
    date: str  # ISO date string YYYY-MM-DD
    completions: int  # Number of times completed that day
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class HabitUpdate(BaseModel):
    title: Optional[str] = None
    days_of_week: Optional[List[str]] = None
    times_per_day: Optional[int] = None

# ============= ROUTES =============

@router.post("")
async def create_habit(habit: Habit):
    """Create a new habit"""
    try:
        habit_dict = habit.model_dump()
        await db.habits.insert_one(habit_dict)
        return {"success": True, "habit_id": habit.id}
    except Exception as e:
        logging.error(f"Error creating habit: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{athlete_id}")
async def get_habits(athlete_id: str, limit: Optional[int] = Query(None, description="Max habits to return")):
    """Get all habits for an athlete"""
    try:
        query_limit = apply_query_limit(limit, max_limit=200)  # Max 200 habits per athlete
        habits = await db.habits.find({"athlete_id": athlete_id}, {"_id": 0}).limit(query_limit).to_list(length=query_limit)
        return {"habits": habits}
    except Exception as e:
        logging.error(f"Error fetching habits: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{habit_id}")
async def update_habit(habit_id: str, update: HabitUpdate):
    """Update a habit"""
    try:
        update_data = {k: v for k, v in update.model_dump().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        result = await db.habits.update_one(
            {"id": habit_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Habit not found")
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating habit: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{habit_id}")
async def delete_habit(habit_id: str):
    """Delete a habit and all its completions"""
    try:
        # Delete habit
        result = await db.habits.delete_one({"id": habit_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Habit not found")
        
        # Delete all completions for this habit
        await db.habit_completions.delete_many({"habit_id": habit_id})
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting habit: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{habit_id}/complete")
async def log_habit_completion(habit_id: str, athlete_id: str, date: str):
    """Log a completion for a habit on a specific date"""
    try:
        # Check if completion already exists for this date
        existing = await db.habit_completions.find_one({
            "habit_id": habit_id,
            "athlete_id": athlete_id,
            "date": date
        })
        
        if existing:
            # Increment completion count
            await db.habit_completions.update_one(
                {"id": existing["id"]},
                {"$inc": {"completions": 1}}
            )
            return {"success": True, "completions": existing["completions"] + 1}
        else:
            # Create new completion record
            completion = HabitCompletion(
                habit_id=habit_id,
                athlete_id=athlete_id,
                date=date,
                completions=1
            )
            await db.habit_completions.insert_one(completion.model_dump())
            return {"success": True, "completions": 1}
    except Exception as e:
        logging.error(f"Error logging habit completion: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{habit_id}/uncomplete")
async def undo_habit_completion(habit_id: str, athlete_id: str, date: str):
    """Undo one completion for a habit on a specific date"""
    try:
        existing = await db.habit_completions.find_one({
            "habit_id": habit_id,
            "athlete_id": athlete_id,
            "date": date
        })
        
        if not existing:
            return {"success": True, "completions": 0}
        
        if existing["completions"] <= 1:
            # Delete the completion record
            await db.habit_completions.delete_one({"id": existing["id"]})
            return {"success": True, "completions": 0}
        else:
            # Decrement completion count
            await db.habit_completions.update_one(
                {"id": existing["id"]},
                {"$inc": {"completions": -1}}
            )
            return {"success": True, "completions": existing["completions"] - 1}
    except Exception as e:
        logging.error(f"Error undoing habit completion: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{athlete_id}/completions")
async def get_habit_completions(athlete_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None, limit: Optional[int] = Query(None, description="Max completions to return")):
    """Get all habit completions for an athlete within a date range"""
    try:
        query = {"athlete_id": athlete_id}
        
        if start_date and end_date:
            query["date"] = {"$gte": start_date, "$lte": end_date}
        elif start_date:
            query["date"] = {"$gte": start_date}
        elif end_date:
            query["date"] = {"$lte": end_date}
        
        query_limit = apply_query_limit(limit, max_limit=1000)  # Max 1000 completions (reasonable for date ranges)
        completions = await db.habit_completions.find(query, {"_id": 0}).sort("date", -1).limit(query_limit).to_list(length=query_limit)
        return {"completions": completions}
    except Exception as e:
        logging.error(f"Error fetching habit completions: {e}")
        raise HTTPException(status_code=500, detail=str(e))
