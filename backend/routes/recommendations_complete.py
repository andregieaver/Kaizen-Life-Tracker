"""
Recommendations Routes
Handles AI-generated recommendations for athletes (viewing, marking as read, deletion).
Note: Generation endpoint remains in server.py due to ai_coach dependency.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
import logging
import uuid
from datetime import datetime, timezone, date, time
from database import db

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


# Models
class Recommendation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    schedule_id: Optional[str] = None
    title: str
    type: str  # recovery_analysis, training_analysis, sleep_analysis, etc.
    priority: str  # high, medium, low
    summary: str
    content: str
    tags: Optional[List[str]] = []
    scheduled_prompt: Optional[str] = None
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    read: bool = False


# Helper functions
def parse_from_mongo(item):
    """Parse data from MongoDB, keeping dates as strings for JSON serialization"""
    if isinstance(item.get('time'), str):
        try:
            item['time'] = datetime.strptime(item['time'], '%H:%M:%S').time()
        except:
            pass
    return item


# Routes
@router.get("/{athlete_id}", response_model=List[Recommendation])
async def get_athlete_recommendations(athlete_id: str, limit: int = 20):
    """Get AI-generated recommendations for an athlete"""
    recommendations = await db.recommendations.find(
        {"athlete_id": athlete_id}, 
        {"_id": 0}
    ).sort("generated_at", -1).limit(limit).limit(100).to_list(length=100)
    return [parse_from_mongo(r) for r in recommendations]


@router.post("/{recommendation_id}/read")
async def mark_recommendation_read(recommendation_id: str):
    """Mark a recommendation as read"""
    await db.recommendations.update_one(
        {"id": recommendation_id},
        {"$set": {"read": True}}
    )
    return {"message": "Recommendation marked as read"}


@router.put("/{recommendation_id}/read")
async def mark_recommendation_read_put(recommendation_id: str):
    """Mark a recommendation as read (PUT method)"""
    await db.recommendations.update_one(
        {"id": recommendation_id},
        {"$set": {"read": True}}
    )
    return {"message": "Recommendation marked as read"}


@router.delete("/{recommendation_id}")
async def delete_recommendation(recommendation_id: str):
    """Delete a recommendation"""
    result = await db.recommendations.delete_one({"id": recommendation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return {"message": "Recommendation deleted successfully"}
