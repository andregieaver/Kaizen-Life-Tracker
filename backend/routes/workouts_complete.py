"""
Workouts routes - Extracted from server.py
Handles workout logging, sleep data, readiness scores, and personal records
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import logging

# Import shared dependencies
from database import db
from utils import prepare_for_mongo, parse_from_mongo

router = APIRouter(tags=["workouts"])

# ============= MODELS =============

class Workout(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    date: str
    workout_type: str
    distance_miles: float
    duration_minutes: int
    avg_hr: Optional[int] = None
    max_hr: Optional[int] = None
    perceived_effort: int
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SleepData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    date: str
    total_sleep_hours: float
    sleep_efficiency: float
    hrv_score: Optional[int] = None
    resting_hr: Optional[int] = None
    sleep_quality: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReadinessScore(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    date: str
    readiness_score: int
    factors: Dict[str, Any]
    recommendations: List[str]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= ROUTES =============

@router.post("/workout", response_model=Workout)
async def log_workout(workout: Workout):
    """Log a new workout"""
    workout_dict = prepare_for_mongo(workout.model_dump())
    await db.workouts.insert_one(workout_dict)
    return workout


@router.get("/workouts/{athlete_id}", response_model=List[Workout])
async def get_workouts(athlete_id: str, limit: int = 20, date: Optional[str] = None):
    """Get workouts for an athlete, optionally filtered by date"""
    query = {"athlete_id": athlete_id}
    
    # Add date filter if provided
    if date:
        query["start_date"] = {"$regex": f"^{date}"}
    
    workouts = await db.workouts.find(
        query, 
        {"_id": 0}
    ).sort("date", -1).limit(min(limit, 100)).to_list(length=100)
    return [parse_from_mongo(w) for w in workouts]


@router.post("/sleep", response_model=SleepData)
async def log_sleep_data(sleep_data: SleepData):
    """Log sleep data"""
    sleep_dict = prepare_for_mongo(sleep_data.model_dump())
    await db.sleep_data.insert_one(sleep_dict)
    return sleep_data


@router.get("/sleep/{athlete_id}", response_model=List[SleepData])
async def get_sleep_data(athlete_id: str, limit: int = 14):
    """Get sleep data for an athlete"""
    sleep_data = await db.sleep_data.find(
        {"athlete_id": athlete_id}, 
        {"_id": 0}
    ).sort("date", -1).limit(min(limit, 100)).to_list(length=100)
    return [parse_from_mongo(s) for s in sleep_data]


@router.get("/readiness/{athlete_id}", response_model=ReadinessScore)
async def get_daily_readiness(athlete_id: str):
    """Get daily readiness score for an athlete"""
    # Check if we have today's readiness score
    today = datetime.now(timezone.utc).date().isoformat()
    existing = await db.readiness_scores.find_one(
        {"athlete_id": athlete_id, "date": today}, 
        {"_id": 0}
    )
    
    if existing:
        return parse_from_mongo(existing)
    
    # Return a basic readiness score if ai_coach is not available
    # In production, this would call ai_coach.calculate_readiness_score()
    readiness = ReadinessScore(
        athlete_id=athlete_id,
        date=today,
        readiness_score=75,
        factors={
            "sleep": 80,
            "hrv": 70,
            "resting_hr": 75,
            "recent_training_load": 70
        },
        recommendations=[
            "Get 7-8 hours of quality sleep",
            "Stay hydrated throughout the day",
            "Consider a moderate intensity workout"
        ]
    )
    
    readiness_dict = prepare_for_mongo(readiness.model_dump())
    await db.readiness_scores.insert_one(readiness_dict)
    
    return readiness


@router.get("/merits/{athlete_id}")
async def get_personal_records(athlete_id: str):
    """Get personal records for different distances"""
    
    # Define distance mappings (in meters)
    distance_map = {
        '1km': 1000,
        '1mile': 1609,
        '5km': 5000,
        '10km': 10000,
        'half_marathon': 21097,
        'marathon': 42195
    }
    
    # Get current date
    twelve_months_ago = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
    
    merits = []
    
    for distance_key, distance_meters in distance_map.items():
        # Calculate tolerance (5% of distance for matching)
        tolerance = distance_meters * 0.05
        
        # Find best time in last 12 months
        recent_query = {
            "athlete_id": athlete_id,
            "distance": {"$gte": distance_meters - tolerance, "$lte": distance_meters + tolerance},
            "date": {"$gte": twelve_months_ago}
        }
        
        recent_best_workout = await db.workouts.find_one(
            recent_query,
            {"_id": 0},
            sort=[("pace", 1)]
        )
        
        # Find all-time best
        all_time_query = {
            "athlete_id": athlete_id,
            "distance": {"$gte": distance_meters - tolerance, "$lte": distance_meters + tolerance}
        }
        
        all_time_best_workout = await db.workouts.find_one(
            all_time_query,
            {"_id": 0},
            sort=[("pace", 1)]
        )
        
        # Calculate times (pace * distance in km = time in minutes, convert to seconds)
        recent_best_time = None
        all_time_best_time = None
        
        if recent_best_workout:
            # pace is min/km, distance is in meters
            recent_best_time = recent_best_workout['pace'] * (distance_meters / 1000) * 60  # in seconds
        
        if all_time_best_workout:
            all_time_best_time = all_time_best_workout['pace'] * (distance_meters / 1000) * 60  # in seconds
        
        merits.append({
            "distance": distance_key,
            "recent_best": recent_best_time,
            "all_time_best": all_time_best_time
        })
    
    return merits


# NOTE: The readiness calculation uses ai_coach service in production
# For the refactored version, we return a basic score
# The full ai_coach integration can be added when ai_coach is refactored into a service module
