"""
Memories Routes
Handles athlete memories - storing and retrieving important information like goals, PRs, injuries, preferences.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
import logging
import uuid
from datetime import datetime, timezone, date, time
from database import db

router = APIRouter(prefix="/memories", tags=["memories"])


# Models
class AthleteMemory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    category: str  # goals, prs, injuries, preferences, progress, equipment
    content: str
    importance: int = 5  # 1-10, higher = more important
    source_session: Optional[str] = None
    embedding: Optional[List[float]] = None  # For future vector search
    metadata: Optional[Dict[str, Any]] = None  # Flexible metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Helper functions
def prepare_for_mongo(data):
    """Prepare data for MongoDB storage by converting datetime objects to ISO strings"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
            elif isinstance(value, date):
                data[key] = value.isoformat()
            elif isinstance(value, time):
                data[key] = value.strftime('%H:%M:%S')
    return data


def parse_from_mongo(item):
    """Parse data from MongoDB, keeping dates as strings for JSON serialization"""
    if isinstance(item.get('time'), str):
        try:
            item['time'] = datetime.strptime(item['time'], '%H:%M:%S').time()
        except (ValueError, TypeError):
            pass
    return item


# Routes
@router.get("/{athlete_id}")
async def get_athlete_memories(athlete_id: str, category: str = None, search: str = None):
    """Get athlete memories with optional filtering by category or search term"""
    query = {"athlete_id": athlete_id}
    
    # Filter by category if provided
    if category:
        query["category"] = category
    
    # Search in content if search term provided
    if search:
        query["content"] = {"$regex": search, "$options": "i"}
    
    memories = await db.athlete_memories.find(
        query,
        {"_id": 0}
    ).sort("importance", -1).sort("created_at", -1).limit(100).to_list(length=100)
    
    return {"memories": [parse_from_mongo(m) for m in memories]}


@router.post("/{athlete_id}")
async def create_memory(athlete_id: str, memory: AthleteMemory):
    """Create a new memory manually"""
    memory.athlete_id = athlete_id
    memory_dict = prepare_for_mongo(memory.model_dump())
    await db.athlete_memories.insert_one(memory_dict)
    return {"message": "Memory created successfully", "id": memory.id}


@router.put("/{memory_id}")
async def update_memory(memory_id: str, updates: dict):
    """Update an existing memory"""
    # Add updated_at timestamp
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.athlete_memories.update_one(
        {"id": memory_id},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    return {"message": "Memory updated successfully"}


@router.delete("/{memory_id}")
async def delete_memory(memory_id: str):
    """Delete a memory"""
    result = await db.athlete_memories.delete_one({"id": memory_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    return {"message": "Memory deleted successfully"}


@router.get("/{athlete_id}/categories")
async def get_memory_categories(athlete_id: str):
    """Get list of categories with memory counts"""
    pipeline = [
        {"$match": {"athlete_id": athlete_id}},
        {"$group": {
            "_id": "$category",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    
    results = await db.athlete_memories.aggregate(pipeline).to_list(length=100)
    
    categories = [{"category": r["_id"], "count": r["count"]} for r in results]
    
    return {"categories": categories}
