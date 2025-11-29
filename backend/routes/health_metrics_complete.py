"""
Health Metrics Routes
Handles sleep data and readiness score tracking
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List
from datetime import datetime, timezone
import logging

from database import db

# Create router
router = APIRouter(prefix="/api", tags=["health_metrics"])

# Logger
logger = logging.getLogger(__name__)


# ==================== Pydantic Models ====================

class SleepData(BaseModel):
    id: str
    athlete_id: str
    date: str
    duration: int  # in minutes
    quality: int  # 1-5 scale
    notes: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReadinessScore(BaseModel):
    id: str
    athlete_id: str
    date: str
    score: int  # 0-100
    factors: dict  # breakdown of contributing factors
    recommendation: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== Helper Functions ====================

def prepare_for_mongo(data):
    """Prepare data for MongoDB storage by converting datetime objects to ISO strings"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data


def parse_from_mongo(item):
    """Parse MongoDB document for API response"""
    return item


# ==================== Sleep Data Endpoints ====================

@router.post("/sleep", response_model=SleepData)
async def log_sleep_data(sleep_data: SleepData):
    """Log sleep data for an athlete"""
    sleep_dict = prepare_for_mongo(sleep_data.model_dump())
    await db.sleep_data.insert_one(sleep_dict)
    return sleep_data


@router.get("/sleep/{athlete_id}", response_model=List[SleepData])
async def get_sleep_data(athlete_id: str, limit: int = 14):
    """Get recent sleep data for an athlete"""
    sleep_data = await db.sleep_data.find(
        {"athlete_id": athlete_id}, 
        {"_id": 0}
    ).sort("date", -1).limit(limit).limit(100).to_list(length=100)
    return [parse_from_mongo(s) for s in sleep_data]


# ==================== Readiness Score Endpoints ====================

@router.get("/readiness/{athlete_id}", response_model=ReadinessScore)
async def get_daily_readiness(athlete_id: str):
    """Get daily readiness score for an athlete"""
    # Import here to avoid circular dependencies
    from ai_coach_service import AICoachService
    
    # Check if we have today's readiness score
    today = datetime.now(timezone.utc).date().isoformat()
    existing = await db.readiness_scores.find_one(
        {"athlete_id": athlete_id, "date": today}, 
        {"_id": 0}
    )
    
    if existing:
        return parse_from_mongo(existing)
    
    # Get OpenAI API key from system settings
    system_settings = await db.system_settings.find_one({}, {"_id": 0})
    openai_api_key = system_settings.get('advanced', {}).get('openaiApiKey') if system_settings else None
    
    if not openai_api_key:
        # Return a default readiness score if no AI coach available
        default_readiness = ReadinessScore(
            id=f"{athlete_id}_{today}",
            athlete_id=athlete_id,
            date=today,
            score=75,
            factors={"default": "AI coach not configured"},
            recommendation="Continue with normal training"
        )
        readiness_dict = prepare_for_mongo(default_readiness.model_dump())
        await db.readiness_scores.insert_one(readiness_dict)
        return default_readiness
    
    # Calculate new readiness score using AI coach
    ai_coach = AICoachService(openai_api_key)
    readiness = await ai_coach.calculate_readiness_score(athlete_id)
    readiness_dict = prepare_for_mongo(readiness.model_dump())
    await db.readiness_scores.insert_one(readiness_dict)
    
    return readiness
