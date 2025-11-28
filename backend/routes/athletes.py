from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone, date
import uuid
import base64
import io
from PIL import Image

router = APIRouter(prefix="/athlete", tags=["athletes"])

# Models
class AthleteProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    password: str
    profile_picture: Optional[str] = None
    age: Optional[int] = None
    date_of_birth: Optional[str] = None
    weekly_mileage: float = Field(default=0.0)
    recent_race_time: Optional[str] = None
    running_goals: str = Field(default="General fitness")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    nationality: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    body_fat_percentage: Optional[float] = None
    vo2_max: Optional[float] = None
    max_heart_rate: Optional[int] = None
    gender: Optional[str] = None
    bio: Optional[str] = None
    interests: Optional[list] = Field(default_factory=list)
    share_bio: bool = Field(default=True)
    share_goals: bool = Field(default=True)
    share_interests: bool = Field(default=True)
    privacy_level: str = Field(default="public")
    estimated_calorie_need: Optional[int] = None
    weight_goal: Optional[str] = None
    health_goals: Optional[list] = Field(default_factory=list)
    allergies: Optional[list] = Field(default_factory=list)
    dietary_preferences: Optional[list] = Field(default_factory=list)
    distance_unit: str = Field(default="miles")
    measurement_system: str = Field(default="imperial")
    week_starts_on: str = Field(default="monday")
    is_super_admin: bool = Field(default=False)
    timezone: str = Field(default="UTC")
    time_format: str = Field(default="12h")
    date_format: str = Field(default="MM/DD/YYYY")
    weight_unit: str = Field(default="lbs")
    fluid_unit: str = Field(default="fl oz")
    language: str = Field(default="en")
    coach_language: str = Field(default="en")
    coach_personality: Optional[str] = Field(default=None)
    voice_preference: str = Field(default="alloy")
    coach_name: str = Field(default="Coach")
    coach_avatar: Optional[str] = None
    subscription_tier: str = Field(default="free")
    subscription_status: str = Field(default="active")
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    subscription_current_period_end: Optional[datetime] = None

class AthleteUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    profile_picture: Optional[str] = None
    age: Optional[int] = None
    date_of_birth: Optional[str] = None
    weekly_mileage: Optional[float] = None
    recent_race_time: Optional[str] = None
    running_goals: Optional[str] = None
    nationality: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    body_fat_percentage: Optional[float] = None
    vo2_max: Optional[float] = None
    max_heart_rate: Optional[int] = None
    gender: Optional[str] = None
    bio: Optional[str] = None
    interests: Optional[list] = None
    share_bio: Optional[bool] = None
    share_goals: Optional[bool] = None
    share_interests: Optional[bool] = None
    privacy_level: Optional[str] = None
    estimated_calorie_need: Optional[int] = None
    weight_goal: Optional[str] = None
    health_goals: Optional[list] = None
    allergies: Optional[list] = None
    dietary_preferences: Optional[list] = None
    distance_unit: Optional[str] = None
    measurement_system: Optional[str] = None
    week_starts_on: Optional[str] = None
    timezone: Optional[str] = None
    time_format: Optional[str] = None
    date_format: Optional[str] = None
    weight_unit: Optional[str] = None
    fluid_unit: Optional[str] = None
    language: Optional[str] = None
    coach_language: Optional[str] = None
    coach_personality: Optional[str] = None
    voice_preference: Optional[str] = None

# Athlete routes will be added here
# This is a placeholder - routes will be migrated from server.py
