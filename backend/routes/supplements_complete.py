"""
Supplements Routes
Handles supplement tracking and supplement logs for athletes.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
import logging
import uuid
from datetime import datetime, timezone, date, time
from database import db

router = APIRouter(tags=["supplements"])


# Models
class Supplement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    name: str
    dosage: float
    unit: str  # 'mg', 'g', 'mcg', 'IU', 'ml', 'fl oz', 'capsules', 'tablets', 'drops', 'other'
    frequency: str  # 'daily', 'twice_daily', 'weekly', 'as_needed'
    time_of_day: Optional[str] = None  # 'morning', 'afternoon', 'evening', 'night', 'with_meals', 'any'
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None


class SupplementLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    supplement_ids: List[str]
    log_date: date
    log_time: time
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None


# Supplement routes
@router.get("/supplements/{athlete_id}")
async def get_supplements(athlete_id: str):
    """Get all supplements for an athlete"""
    supplements = await db.supplements.find(
        {"athlete_id": athlete_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(length=100)
    
    return {"supplements": supplements}


@router.post("/supplements")
async def create_supplement(supplement: Supplement):
    """Create a new supplement entry"""
    supplement_dict = supplement.model_dump()
    # Convert datetime to ISO string for MongoDB
    if isinstance(supplement_dict.get('created_at'), datetime):
        supplement_dict['created_at'] = supplement_dict['created_at'].isoformat()
    await db.supplements.insert_one(supplement_dict)
    return {"success": True, "id": supplement.id}


@router.put("/supplements/{supplement_id}")
async def update_supplement(supplement_id: str, data: dict):
    """Update a supplement entry"""
    update_data = {k: v for k, v in data.items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.supplements.update_one(
        {"id": supplement_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supplement not found")
    
    return {"success": True}


@router.delete("/supplements/{supplement_id}")
async def delete_supplement(supplement_id: str):
    """Delete a supplement entry"""
    result = await db.supplements.delete_one({"id": supplement_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplement not found")
    
    return {"success": True}


# Supplement Log routes
@router.get("/supplement-logs/{athlete_id}")
async def get_supplement_logs(athlete_id: str):
    """Get all supplement logs for an athlete"""
    logs = await db.supplement_logs.find(
        {"athlete_id": athlete_id},
        {"_id": 0}
    ).sort("log_date", -1).limit(100).to_list(length=100)
    
    # Parse date and time from strings
    for log in logs:
        if isinstance(log.get('log_date'), str):
            log['log_date'] = log['log_date']
        if isinstance(log.get('log_time'), str):
            log['log_time'] = log['log_time']
    
    return {"logs": logs}


@router.post("/supplement-logs")
async def create_supplement_log(log: SupplementLog):
    """Create a new supplement log entry"""
    log_dict = log.model_dump()
    # Convert date and time to ISO strings for MongoDB
    if isinstance(log_dict.get('log_date'), date):
        log_dict['log_date'] = log_dict['log_date'].isoformat()
    if isinstance(log_dict.get('log_time'), time):
        log_dict['log_time'] = log_dict['log_time'].strftime('%H:%M:%S')
    if isinstance(log_dict.get('created_at'), datetime):
        log_dict['created_at'] = log_dict['created_at'].isoformat()
    
    await db.supplement_logs.insert_one(log_dict)
    return {"success": True, "id": log.id}


@router.put("/supplement-logs/{log_id}")
async def update_supplement_log(log_id: str, data: dict):
    """Update a supplement log entry"""
    update_data = {k: v for k, v in data.items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Convert date and time if present
    if 'log_date' in update_data and isinstance(update_data['log_date'], date):
        update_data['log_date'] = update_data['log_date'].isoformat()
    if 'log_time' in update_data and isinstance(update_data['log_time'], time):
        update_data['log_time'] = update_data['log_time'].strftime('%H:%M:%S')
    
    result = await db.supplement_logs.update_one(
        {"id": log_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supplement log not found")
    
    return {"success": True}


@router.delete("/supplement-logs/{log_id}")
async def delete_supplement_log(log_id: str):
    """Delete a supplement log entry"""
    result = await db.supplement_logs.delete_one({"id": log_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplement log not found")
    
    return {"success": True}
