"""
Training routes - Extracted from server.py
Handles training calendar, workout blocks, and weekly summaries
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime, timezone, timedelta
import uuid
import logging

# Import shared dependencies
from database import db
from utils import prepare_for_mongo, parse_from_mongo

router = APIRouter(prefix="/training-calendar", tags=["training"])

# ============= MODELS =============

class TrainingBlock(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    title: str
    description: Optional[str] = None
    block_type: str  # 'training' or 'recovery'
    start_date: str  # ISO date string
    end_date: str  # ISO date string
    start_time: Optional[str] = None  # HH:MM format
    end_time: Optional[str] = None  # HH:MM format
    
    # Workout details
    workout_type: Optional[str] = None
    distance: Optional[float] = None
    target_pace: Optional[str] = None
    intensity: Optional[str] = None
    notes: Optional[str] = None
    
    # Status tracking
    completed: bool = False
    completed_at: Optional[datetime] = None
    actual_distance: Optional[float] = None
    actual_duration: Optional[int] = None
    actual_pace: Optional[str] = None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

# ============= ROUTES =============

@router.get("/{athlete_id}")
async def get_training_calendar(
    athlete_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get training blocks for an athlete, optionally filtered by date range"""
    query = {"athlete_id": athlete_id}
    
    if start_date and end_date:
        query["$or"] = [
            {"start_date": {"$gte": start_date, "$lte": end_date}},
            {"end_date": {"$gte": start_date, "$lte": end_date}},
            {"start_date": {"$lte": start_date}, "end_date": {"$gte": end_date}}
        ]
    elif start_date:
        query["end_date"] = {"$gte": start_date}
    elif end_date:
        query["start_date"] = {"$lte": end_date}
    
    blocks = await db.training_blocks.find(
        query,
        {"_id": 0}
    ).sort("start_date", 1).limit(200).to_list(length=200)
    
    return {"blocks": [parse_from_mongo(b) for b in blocks]}


@router.post("")
async def create_training_block(block: TrainingBlock):
    """Create a new training block"""
    block_dict = prepare_for_mongo(block.model_dump())
    await db.training_blocks.insert_one(block_dict)
    return {"success": True, "id": block.id, "block": block}


@router.put("/{block_id}")
async def update_training_block(block_id: str, updates: dict):
    """Update a training block"""
    # Extract allowed fields
    allowed_fields = [
        'title', 'description', 'block_type', 'start_date', 'end_date',
        'start_time', 'end_time', 'workout_type', 'distance', 'target_pace',
        'intensity', 'notes', 'completed', 'completed_at', 'actual_distance',
        'actual_duration', 'actual_pace'
    ]
    
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    # If marking as completed, set completed_at
    if update_data.get('completed') and not update_data.get('completed_at'):
        update_data['completed_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.training_blocks.update_one(
        {"id": block_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Training block not found")
    
    # Get updated block
    updated_block = await db.training_blocks.find_one({"id": block_id}, {"_id": 0})
    return {"success": True, "block": parse_from_mongo(updated_block)}


@router.delete("/{block_id}")
async def delete_training_block(block_id: str):
    """Delete a training block"""
    result = await db.training_blocks.delete_one({"id": block_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Training block not found")
    
    return {"success": True}


@router.get("/{athlete_id}/weekly-summary")
async def get_weekly_summary(athlete_id: str, start_date: str):
    """Get weekly training summary"""
    try:
        # Parse start date
        start = datetime.fromisoformat(start_date).date()
        end = start + timedelta(days=7)
        
        # Get training blocks for the week
        blocks = await db.training_blocks.find(
            {
                "athlete_id": athlete_id,
                "start_date": {"$gte": start.isoformat(), "$lt": end.isoformat()}
            },
            {"_id": 0}
        ).limit(100).to_list(length=100)
        
        # Calculate summary stats
        total_planned = len(blocks)
        total_completed = sum(1 for b in blocks if b.get('completed'))
        total_distance = sum(b.get('actual_distance', 0) or 0 for b in blocks if b.get('completed'))
        total_duration = sum(b.get('actual_duration', 0) or 0 for b in blocks if b.get('completed'))
        
        # Group by day
        days_summary = {}
        for block in blocks:
            day = block['start_date'][:10]  # Get YYYY-MM-DD
            if day not in days_summary:
                days_summary[day] = {
                    "date": day,
                    "blocks": [],
                    "total_distance": 0,
                    "completed_count": 0,
                    "planned_count": 0
                }
            
            days_summary[day]["blocks"].append(parse_from_mongo(block))
            days_summary[day]["planned_count"] += 1
            
            if block.get('completed'):
                days_summary[day]["completed_count"] += 1
                days_summary[day]["total_distance"] += block.get('actual_distance', 0) or 0
        
        return {
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "summary": {
                "total_planned": total_planned,
                "total_completed": total_completed,
                "completion_rate": round(total_completed / total_planned * 100, 1) if total_planned > 0 else 0,
                "total_distance": round(total_distance, 2),
                "total_duration_minutes": total_duration
            },
            "days": list(days_summary.values())
        }
        
    except Exception as e:
        logging.error(f"Error generating weekly summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")
