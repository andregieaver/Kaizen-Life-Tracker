"""
Health Metrics Routes
Handles sleep data and readiness score tracking
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List
from datetime import datetime, timezone
import logging

from database import db
from auth_middleware import require_auth

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
    # Check if we have today's readiness score
    today = datetime.now(timezone.utc).date().isoformat()
    existing = await db.readiness_scores.find_one(
        {"athlete_id": athlete_id, "date": today}, 
        {"_id": 0}
    )
    
    if existing:
        return parse_from_mongo(existing)
    
    # Return a default readiness score (AI calculation disabled until service is refactored)
    # Note: AICoachService is defined in server.py but not accessible as a standalone module
    default_readiness = ReadinessScore(
        id=f"{athlete_id}_{today}",
        athlete_id=athlete_id,
        date=today,
        score=75,
        factors={"default": "Using default readiness calculation"},
        recommendation="Continue with normal training. Connect Oura/Whoop for personalized insights."
    )
    readiness_dict = prepare_for_mongo(default_readiness.model_dump())
    await db.readiness_scores.insert_one(readiness_dict)
    return default_readiness


# ==================== BODY SCORE STREAK & LEADERBOARD ====================

class BodyScoreHistory(BaseModel):
    """Track daily body score for streak calculation"""
    id: str = Field(default_factory=lambda: str(__import__('uuid').uuid4()))
    athlete_id: str
    score: float  # 0-100
    date: str  # YYYY-MM-DD format
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


@router.post("/body-score/save/{athlete_id}")
async def save_body_score(athlete_id: str, score: float, user: dict = Depends(require_auth)):
    """Save today's body score for an athlete - Requires authentication"""
    # Verify user can only save their own score
    if user["athlete_id"] != athlete_id and not user.get("is_super_admin", False):
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Check if score already exists for today
        existing = await db.body_score_history.find_one({
            "athlete_id": athlete_id,
            "date": today
        })
        
        if existing:
            # Update existing score
            await db.body_score_history.update_one(
                {"athlete_id": athlete_id, "date": today},
                {"$set": {"score": score, "created_at": datetime.now(timezone.utc)}}
            )
        else:
            # Create new entry
            score_entry = {
                "id": str(__import__('uuid').uuid4()),
                "athlete_id": athlete_id,
                "score": score,
                "date": today,
                "created_at": datetime.now(timezone.utc)
            }
            await db.body_score_history.insert_one(score_entry)
        
        return {"success": True, "date": today, "score": score}
    except Exception as e:
        logger.error(f"Error saving body score: {e}")
        raise __import__('fastapi').HTTPException(status_code=500, detail=str(e))


@router.get("/body-score/streak/{athlete_id}")
async def get_body_score_streak(athlete_id: str, user: dict = Depends(require_auth)):
    """Calculate current streak of days with body score >= 85 - Requires authentication"""
    # Verify user can only view their own streak
    if user["athlete_id"] != athlete_id and not user.get("is_super_admin", False):
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        # Get all scores for this athlete, sorted by date descending
        scores = await db.body_score_history.find(
            {"athlete_id": athlete_id}
        ).sort("date", -1).to_list(length=365)  # Last year max
        
        if not scores:
            return {"streak": 0, "last_score": None, "last_date": None}
        
        # Calculate current streak
        streak = 0
        today = datetime.now(timezone.utc).date()
        
        from datetime import timedelta
        for score_entry in scores:
            score_date = datetime.strptime(score_entry["date"], "%Y-%m-%d").date()
            expected_date = today - timedelta(days=streak)
            
            # Check if this score is for the expected date
            if score_date == expected_date:
                # Check if score is >= 85
                if score_entry["score"] >= 85:
                    streak += 1
                else:
                    # Streak broken
                    break
            elif score_date < expected_date:
                # Gap in dates - streak broken
                break
        
        latest = scores[0] if scores else None
        return {
            "streak": streak,
            "last_score": latest["score"] if latest else None,
            "last_date": latest["date"] if latest else None
        }
    except Exception as e:
        logger.error(f"Error calculating streak: {e}")
        raise __import__('fastapi').HTTPException(status_code=500, detail=str(e))


@router.get("/body-score/leaderboard")
async def get_body_score_leaderboard(limit: int = 50):
    """Get leaderboard of all users with their body score streaks"""
    try:
        from datetime import timedelta
        
        # Get all athletes
        athletes = await db.athlete_profiles.find({}, {
            "id": 1,
            "name": 1,
            "profile_picture": 1,
            "_id": 0
        }).to_list(length=None)
        
        leaderboard = []
        
        for athlete in athletes:
            athlete_id = athlete["id"]
            
            # Get scores for this athlete
            scores = await db.body_score_history.find(
                {"athlete_id": athlete_id}
            ).sort("date", -1).to_list(length=365)
            
            if not scores:
                continue
            
            # Calculate streak
            streak = 0
            today = datetime.now(timezone.utc).date()
            
            for score_entry in scores:
                score_date = datetime.strptime(score_entry["date"], "%Y-%m-%d").date()
                expected_date = today - timedelta(days=streak)
                
                if score_date == expected_date:
                    if score_entry["score"] >= 85:
                        streak += 1
                    else:
                        break
                elif score_date < expected_date:
                    break
            
            # Only include users with streak > 0
            if streak > 0:
                leaderboard.append({
                    "athlete_id": athlete_id,
                    "name": athlete.get("name", "Unknown"),
                    "profile_picture": athlete.get("profile_picture"),
                    "streak": streak,
                    "current_score": scores[0]["score"] if scores else 0
                })
        
        # Sort by streak (descending)
        leaderboard.sort(key=lambda x: x["streak"], reverse=True)
        
        # Apply limit
        if limit:
            leaderboard = leaderboard[:limit]
        
        return {
            "leaderboard": leaderboard,
            "total_count": len(leaderboard)
        }
    except Exception as e:
        logger.error(f"Error getting leaderboard: {e}")
        raise __import__('fastapi').HTTPException(status_code=500, detail=str(e))
