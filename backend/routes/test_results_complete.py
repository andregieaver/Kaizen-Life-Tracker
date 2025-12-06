"""
Test Results Routes
Handles fitness test results tracking (e.g., pull-ups, 5km run, plank hold).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
import logging
import uuid
from datetime import datetime, timezone, date, time
from database import db

router = APIRouter(prefix="/test-results", tags=["test-results"])


# Models
class TestResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    test_name: str  # e.g., "Pull-ups", "5km Run", "Plank Hold"
    unit: str  # 'repetitions', 'time', 'distance', 'weight', 'other'
    result_value: float  # The actual test result
    time_to_completion: Optional[float] = None  # Optional time taken (in seconds)
    time_display_unit: Optional[str] = None  # For time-based tests: 'hours', 'minutes', 'seconds'
    goal_direction: Optional[str] = None  # 'higher' or 'lower' - whether higher/lower values are better
    notes: Optional[str] = None
    test_date: str  # ISO date string when test was performed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None


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
async def get_test_results(athlete_id: str, test_name: Optional[str] = None):
    """Get all test results for an athlete, optionally filtered by test name"""
    query = {"athlete_id": athlete_id}
    if test_name:
        query["test_name"] = test_name
    
    results = await db.test_results.find(
        query,
        {"_id": 0}
    ).sort("test_date", 1).limit(500).to_list(length=500)
    
    return {"results": [parse_from_mongo(result) for result in results]}


@router.get("/{athlete_id}/test-names")
async def get_test_names(athlete_id: str):
    """Get unique test names for an athlete"""
    results = await db.test_results.find(
        {"athlete_id": athlete_id},
        {"test_name": 1, "_id": 0}
    ).limit(100).to_list(length=100)
    
    unique_names = list(set([r["test_name"] for r in results]))
    return {"test_names": sorted(unique_names)}


@router.post("")
async def create_test_result(result: TestResult):
    """Create a new test result"""
    result_dict = prepare_for_mongo(result.model_dump())
    await db.test_results.insert_one(result_dict)
    return {"success": True, "id": result.id}


@router.put("/{result_id}")
async def update_test_result(result_id: str, data: dict):
    """Update a test result"""
    update_data = {
        "test_name": data.get("test_name"),
        "unit": data.get("unit"),
        "result_value": data.get("result_value"),
        "time_to_completion": data.get("time_to_completion"),
        "notes": data.get("notes"),
        "test_date": data.get("test_date"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Remove None values
    update_data = {k: v for k, v in update_data.items() if v is not None}
    
    result = await db.test_results.update_one(
        {"id": result_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Test result not found")
    
    return {"success": True}


@router.delete("/{result_id}")
async def delete_test_result(result_id: str):
    """Delete a test result"""
    result = await db.test_results.delete_one({"id": result_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Test result not found")
    
    return {"success": True}
