from fastapi import FastAPI, APIRouter, HTTPException, Request, Query, UploadFile, File
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, date, time
import json
import secrets
import base64
import io
from PIL import Image
import requests
from urllib.parse import urlencode
from stravalib import Client
import asyncio
from oura import OuraClient
from datetime import timedelta
from passlib.context import CryptContext
# from emergentintegrations.llm.chat import LlmChat, UserMessage
from tavily import TavilyClient
from emergentintegrations.llm.openai import OpenAIChatRealtime

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Helper functions for datetime serialization
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
    if isinstance(item.get('date'), str):
        item['date'] = datetime.fromisoformat(item['date']).date()
    if isinstance(item.get('time'), str):
        item['time'] = datetime.strptime(item['time'], '%H:%M:%S').time()
    # Handle date_of_birth conversion - keep as string for API serialization
    if isinstance(item.get('date_of_birth'), str):
        # Validate the date format but keep as string
        try:
            datetime.fromisoformat(item['date_of_birth']).date()
        except ValueError:
            # If invalid date format, remove it
            item.pop('date_of_birth', None)
    return item

def calculate_age(date_of_birth):
    """Calculate age from date of birth (accepts string or date object)"""
    if not date_of_birth:
        return None
    
    # Convert string to date object if needed
    if isinstance(date_of_birth, str):
        try:
            date_of_birth = datetime.fromisoformat(date_of_birth).date()
        except ValueError:
            return None
    
    today = date.today()
    age = today.year - date_of_birth.year
    
    # Check if birthday has occurred this year
    # Handle leap year edge case (Feb 29 birthday in non-leap year)
    try:
        birthday_this_year = date(today.year, date_of_birth.month, date_of_birth.day)
        if today < birthday_this_year:
            age -= 1
    except ValueError:
        # This handles Feb 29 birthday in non-leap years
        # For Feb 29 birthdays, consider the birthday as Feb 28 in non-leap years
        if date_of_birth.month == 2 and date_of_birth.day == 29:
            birthday_this_year = date(today.year, 2, 28)
            if today < birthday_this_year:
                age -= 1
        else:
            # For other invalid dates, just return the calculated age
            pass
        
    return age

# Define Models for Running Coach

# Provider Models for Integration Hub
class Provider(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    key: str  # 'strava', 'oura', 'polar', 'garmin', 'coros'
    name: str
    auth_type: str = "oauth2"  # 'oauth2' or 'oauth1'
    has_webhook: bool = False
    enabled: bool = True

class UserConnection(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    provider_key: str  # 'strava', 'oura', etc.
    access_token: str
    refresh_token: Optional[str] = None
    expires_at: Optional[datetime] = None
    scope: Optional[str] = None
    external_user_id: Optional[str] = None  # Provider's user ID
    last_sync_at: Optional[datetime] = None
    status: str = "active"  # 'active', 'expired', 'error'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class RawEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    provider_key: str
    external_id: str  # Provider's activity/session ID
    kind: str  # 'activity', 'sleep', 'daily', 'hr_series'
    payload: Dict[str, Any]  # Raw JSON from provider
    received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed: bool = False

class NormalizedActivity(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    provider_key: str
    external_id: str
    activity_type: str  # 'run', 'ride', 'swim', etc.
    start_time: datetime
    end_time: Optional[datetime] = None
    distance_m: Optional[float] = None
    duration_s: Optional[float] = None
    avg_hr: Optional[float] = None
    max_hr: Optional[float] = None
    calories_kcal: Optional[float] = None
    raw_event_id: str  # Reference to raw event
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NormalizedDaily(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    provider_key: str
    date: str  # ISO date string YYYY-MM-DD
    readiness: Optional[float] = None
    recovery: Optional[float] = None
    steps: Optional[int] = None
    resting_hr: Optional[float] = None
    spo2: Optional[float] = None
    stress: Optional[float] = None
    sleep_total_min: Optional[int] = None
    raw_event_id: str  # Reference to raw event
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AthleteProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    password: str  # This will be hashed before storing
    profile_picture: Optional[str] = None  # Base64 encoded image or URL
    age: Optional[int] = None  # Computed from date_of_birth, kept for backward compatibility
    date_of_birth: Optional[str] = None  # Birth date for accurate age calculation (YYYY-MM-DD format)
    weekly_mileage: float
    recent_race_time: Optional[str] = None
    running_goals: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Personal Information Fields
    height: Optional[float] = None  # Height in cm or inches based on unit preference
    weight: Optional[float] = None  # Weight in kg or lbs based on unit preference  
    vo2_max: Optional[float] = None  # VO2 Max value
    max_heart_rate: Optional[int] = None  # Maximum heart rate in BPM
    gender: Optional[str] = None  # Gender: 'male', 'female', 'other', 'prefer_not_to_say'
    bio: Optional[str] = None  # Personal bio/description
    interests: Optional[list] = Field(default_factory=list)  # List of interests/activities
    
    # Preferences
    distance_unit: str = Field(default="miles")  # 'miles' or 'km'
    measurement_system: str = Field(default="imperial")  # 'imperial' or 'metric'
    week_starts_on: str = Field(default="monday")  # 'sunday' or 'monday'
    timezone: str = Field(default="UTC")  # Timezone string (e.g., "America/New_York")
    time_format: str = Field(default="12h")  # '12h' or '24h'
    date_format: str = Field(default="MM/DD/YYYY")  # Date format preference
    weight_unit: str = Field(default="lbs")  # 'lbs' or 'kg'
    fluid_unit: str = Field(default="fl oz")  # 'fl oz' or 'ml'
    language: str = Field(default="en")  # Language code (e.g., "en", "no", "sv")
    voice_preference: str = Field(default="alloy")  # OpenAI voice: 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
    
    # Subscription fields
    subscription_tier: str = Field(default="free")  # 'free', 'pro', 'premium'
    subscription_status: str = Field(default="active")  # 'active', 'canceled', 'past_due', etc.
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    subscription_current_period_end: Optional[datetime] = None

class JournalEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    content: str
    entry_type: str = "text"  # 'text' or 'voice'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class NutritionEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    meal_type: str  # 'breakfast', 'lunch', 'dinner', 'snack'
    description: str
    image_data: Optional[str] = None  # Base64 encoded image
    entry_date: Optional[str] = None  # Date of the meal (YYYY-MM-DD format)
    entry_time: Optional[str] = None  # Time of the meal (HH:MM format)
    calories: Optional[int] = None  # Estimated calories
    # Macronutrients
    protein: Optional[float] = None  # Grams of protein
    carbs: Optional[float] = None  # Grams of carbohydrates
    fat: Optional[float] = None  # Grams of fat
    # Micronutrients
    fiber: Optional[float] = None  # Grams of fiber
    sodium: Optional[float] = None  # Milligrams of sodium
    sugar: Optional[float] = None  # Grams of sugar
    vitamin_a: Optional[float] = None  # Micrograms
    vitamin_c: Optional[float] = None  # Milligrams
    vitamin_d: Optional[float] = None  # Micrograms
    calcium: Optional[float] = None  # Milligrams
    iron: Optional[float] = None  # Milligrams
    potassium: Optional[float] = None  # Milligrams
    ai_analysis: Optional[str] = None  # AI-generated description/notes
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class Supplement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    name: str  # Name of the supplement
    dosage: float  # Amount/quantity
    unit: str  # 'mg', 'g', 'mcg', 'IU', 'ml', 'fl oz', 'capsules', 'tablets', 'drops', 'other'
    frequency: str  # 'daily', 'twice_daily', 'weekly', 'as_needed'
    time_of_day: Optional[str] = None  # 'morning', 'afternoon', 'evening', 'night', 'with_meals', 'any'
    notes: Optional[str] = None  # Additional notes
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class Document(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    title: str
    category: str  # 'medical', 'test_results', 'training_plan', 'research', 'other'
    description: Optional[str] = None
    file_data: str  # Base64 encoded document
    file_name: str
    file_type: str  # MIME type
    file_size: int  # Size in bytes
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class TestResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    test_name: str  # e.g., "Pull-ups", "5km Run", "Plank Hold"
    unit: str  # 'repetitions', 'time', 'distance', 'weight', 'other'
    result_value: float  # The actual test result (e.g., 20 for pull-ups, 1500 for 5km in seconds)
    time_to_completion: Optional[float] = None  # Optional time taken (in seconds)
    notes: Optional[str] = None
    test_date: str  # ISO date string when test was performed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class TrainingBlock(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    title: str
    description: Optional[str] = None
    block_type: str  # 'training' or 'recovery'
    start_date: str  # ISO date string
    end_date: str  # ISO date string
    start_time: Optional[str] = None  # HH:MM format (e.g., "06:00")
    end_time: Optional[str] = None  # HH:MM format (e.g., "07:30")
    
    # Workout details
    workout_type: Optional[str] = None  # 'run', 'intervals', 'tempo', 'recovery', 'cross_training'
    distance: Optional[float] = None  # Distance in miles or km
    duration_minutes: Optional[int] = None  # Duration in minutes
    pace_per_unit: Optional[str] = None  # e.g., "7:30" (minutes:seconds per mile/km)
    intervals: Optional[int] = None  # Number of intervals
    interval_distance: Optional[float] = None  # Distance per interval
    interval_pace: Optional[str] = None  # Pace per interval
    rest_duration: Optional[int] = None  # Rest between intervals in seconds
    unit_system: str = "miles"  # 'miles' or 'km'
    
    created_by: str = "user"  # 'user' or 'coach'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class AthleteUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    profile_picture: Optional[str] = None
    age: Optional[int] = None  # Kept for backward compatibility
    date_of_birth: Optional[str] = None
    weekly_mileage: Optional[float] = None
    recent_race_time: Optional[str] = None
    running_goals: Optional[str] = None
    
    # Personal Information Fields
    height: Optional[float] = None
    weight: Optional[float] = None
    vo2_max: Optional[float] = None
    max_heart_rate: Optional[int] = None
    gender: Optional[str] = None
    bio: Optional[str] = None
    interests: Optional[list] = None
    
    # Preferences
    distance_unit: Optional[str] = None
    measurement_system: Optional[str] = None
    week_starts_on: Optional[str] = None
    timezone: Optional[str] = None
    time_format: Optional[str] = None
    date_format: Optional[str] = None
    weight_unit: Optional[str] = None
    fluid_unit: Optional[str] = None
    language: Optional[str] = None
    voice_preference: Optional[str] = None

class Integration(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    integration_type: str  # 'openai', 'strava', 'oura'
    credentials: Dict[str, Any]  # Encrypted storage for tokens/keys
    settings: Optional[Dict[str, Any]] = None
    last_sync: Optional[datetime] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class APIKeyRequest(BaseModel):
    api_key: str

class LoginRequest(BaseModel):
    email: str
    password: str

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    email: str
    reset_token: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    athlete_id: str
    current_password: str
    new_password: str

class Workout(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    date: str  # ISO date string
    workout_type: str  # easy, tempo, intervals, long_run, recovery
    distance_miles: float
    duration_minutes: int
    avg_hr: Optional[int] = None
    max_hr: Optional[int] = None
    perceived_effort: int  # 1-10 scale
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SleepData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    date: str  # ISO date string
    total_sleep_hours: float
    sleep_efficiency: float  # 0-100%
    hrv_score: Optional[int] = None  # ms
    resting_hr: Optional[int] = None
    sleep_quality: int  # 1-10 scale
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReadinessScore(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    date: str
    readiness_score: int  # 0-100
    factors: Dict[str, Any]  # breakdown of factors contributing to score
    recommendations: List[str]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    session_id: str
    message: str
    response: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CoachChat(BaseModel):
    athlete_id: str
    message: str
    session_id: str

class VoiceConversation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    athlete_id: str
    session_id: str
    transcript: list  # List of {role: 'user'/'assistant', content: 'text', timestamp: datetime}
    duration_seconds: Optional[int] = None

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

class StravaActivity(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: int
    athlete_id: str
    strava_activity_id: int
    name: str
    activity_type: str
    distance_meters: Optional[float] = None
    moving_time_seconds: Optional[int] = None
    elapsed_time_seconds: Optional[int] = None
    total_elevation_gain: Optional[float] = None
    start_date: datetime
    average_speed: Optional[float] = None
    max_speed: Optional[float] = None
    average_heartrate: Optional[int] = None
    max_heartrate: Optional[int] = None
    calories: Optional[int] = None
    description: Optional[str] = None
    trainer: Optional[bool] = False
    commute: Optional[bool] = False
    imported_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StravaWebhookEvent(BaseModel):
    aspect_type: str
    event_time: int
    object_id: int
    object_type: str
    owner_id: int
    subscription_id: int
    updates: dict = {}

class StravaCredentials(BaseModel):
    client_id: str
    client_secret: str
    access_token: str
    refresh_token: str

class OuraCredentials(BaseModel):
    client_id: str
    client_secret: str

class Schedule(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    name: str
    prompt: str
    frequency: str  # daily, weekly, after_workout, custom
    time: str  # HH:MM format
    days: Optional[List[str]] = []  # For custom frequency
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_executed: Optional[datetime] = None

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

class OuraSleepData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    oura_date: str
    bedtime_start: Optional[str] = None
    bedtime_end: Optional[str] = None
    total_sleep_duration: Optional[int] = None  # seconds
    sleep_efficiency: Optional[float] = None  # percentage
    sleep_score: Optional[int] = None
    deep_sleep_duration: Optional[int] = None
    rem_sleep_duration: Optional[int] = None
    light_sleep_duration: Optional[int] = None
    awake_time: Optional[int] = None
    hr_lowest: Optional[int] = None
    hr_average: Optional[int] = None
    hrv_average: Optional[int] = None  # RMSSD in ms
    temperature_delta: Optional[float] = None
    imported_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OuraReadinessData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    oura_date: str
    readiness_score: Optional[int] = None
    temperature_trend_deviation: Optional[float] = None
    activity_balance: Optional[int] = None
    body_temperature: Optional[float] = None
    hrv_balance: Optional[int] = None
    previous_day_activity: Optional[int] = None
    previous_night_score: Optional[int] = None
    recovery_index: Optional[float] = None
    resting_hr: Optional[int] = None
    sleep_balance: Optional[int] = None
    imported_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Subscription Models
class CheckoutRequest(BaseModel):
    plan_id: str  # 'pro_monthly', 'pro_annual', 'premium_monthly', 'premium_annual'
    origin_url: str
    athlete_id: str  # Added to link subscription to user

class SubscriptionWebhookData(BaseModel):
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    subscription_tier: Optional[str] = None  # 'free', 'pro', 'premium'
    subscription_status: Optional[str] = None  # 'active', 'canceled', 'past_due', etc.
    subscription_current_period_end: Optional[str] = None

# AI Coach Service
class AICoachService:
    def __init__(self):
        self.api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not self.api_key:
            raise ValueError("EMERGENT_LLM_KEY not found in environment variables")
        
        # Initialize Tavily client for web search
        self.tavily_api_key = os.environ.get('TAVILY_API_KEY')
        if self.tavily_api_key:
            self.tavily_client = TavilyClient(api_key=self.tavily_api_key)
            logging.info("Tavily client initialized for web search")
        else:
            self.tavily_client = None
            logging.warning("TAVILY_API_KEY not found - web search disabled")
    
    async def get_memories(self, athlete_id: str) -> Dict[str, List[Dict]]:
        """Get athlete memories organized by category"""
        memories = await db.athlete_memories.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).sort("importance", -1).to_list(length=None)
        
        # Organize by category
        organized = {
            "goals": [],
            "prs": [],
            "injuries": [],
            "preferences": [],
            "progress": [],
            "equipment": []
        }
        
        for memory in memories:
            category = memory.get("category", "preferences")
            if category in organized:
                organized[category].append(memory)
        
        return organized
    
    async def extract_memories(self, athlete_id: str, conversation: str, response: str, session_id: str):
        """Extract key facts from conversation to store as memories"""
        extraction_prompt = f"""
Analyze this conversation between an athlete and their running coach. Extract any key facts that should be remembered for future coaching sessions.

CONVERSATION:
Athlete: {conversation}
Coach: {response}

Extract facts in these categories:
- goals: Training goals, race targets, time objectives
- prs: Personal records, best times
- injuries: Current or past injuries, pain points, concerns
- preferences: Training preferences, schedules, surfaces, equipment likes/dislikes  
- progress: Training milestones, improvements noted
- equipment: Shoes, gear, devices

For each fact, provide:
1. category (one of the above)
2. content (the actual fact, concise)
3. importance (1-10, how important is this to remember?)

Return as JSON array. If no important facts to remember, return empty array.
Example: [{{"category": "goals", "content": "Training for Boston Marathon in April 2026", "importance": 9}}]

Return only the JSON array, nothing else.
"""
        
        try:
            # Use user's OpenAI key if available, otherwise Emergent
            user_openai_key = await self.get_user_openai_key(athlete_id)
            
            if user_openai_key:
                import openai
                client = openai.AsyncOpenAI(api_key=user_openai_key)
                response_obj = await client.chat.completions.create(
                    model="gpt-4o-mini",  # Faster model for extraction
                    messages=[{"role": "user", "content": extraction_prompt}],
                    max_tokens=500,
                    temperature=0.3
                )
                result = response_obj.choices[0].message.content
            else:
                from emergentintegrations.llm.chat import LlmChat, UserMessage
                chat = LlmChat(
                    api_key=self.api_key,
                    session_id=f"extract_{athlete_id}"
                ).with_model("anthropic", "claude-3-7-sonnet-20250219")
                user_message = UserMessage(text=extraction_prompt)
                result = await chat.send_message(user_message)
            
            # Parse JSON response
            import re
            json_match = re.search(r'\[.*\]', result, re.DOTALL)
            if json_match:
                memories_data = json.loads(json_match.group())
                
                # Store each memory
                for mem_data in memories_data:
                    if mem_data.get("content") and mem_data.get("category"):
                        memory = AthleteMemory(
                            athlete_id=athlete_id,
                            category=mem_data["category"],
                            content=mem_data["content"],
                            importance=mem_data.get("importance", 5),
                            source_session=session_id
                        )
                        memory_dict = prepare_for_mongo(memory.model_dump())
                        await db.athlete_memories.insert_one(memory_dict)
                        
        except Exception as e:
            logging.error(f"Memory extraction error: {e}")
            # Silent fail - don't break the chat if memory extraction fails
    
    async def get_athlete_context(self, athlete_id: str) -> Dict[str, Any]:
        """Get comprehensive athlete data for AI context"""
        # Get athlete profile
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            return {}
        
        # Get recent workouts (last 14 days)
        workouts = await db.workouts.find(
            {"athlete_id": athlete_id}, 
            {"_id": 0}
        ).sort("date", -1).limit(14).to_list(length=None)
        
        # Get recent sleep data (last 7 days)
        sleep_data = await db.sleep_data.find(
            {"athlete_id": athlete_id}, 
            {"_id": 0}
        ).sort("date", -1).limit(7).to_list(length=None)
        
        # Get latest readiness score
        readiness = await db.readiness_scores.find_one(
            {"athlete_id": athlete_id}, 
            {"_id": 0},
            sort=[("date", -1)]
        )
        
        # Get recent journal entries (last 30 days)
        journal_entries = await db.journal_entries.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).sort("date", -1).limit(30).to_list(length=None)
        
        # Get recent nutrition entries (last 7 days)
        nutrition_entries = await db.nutrition_entries.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).sort("date", -1).limit(50).to_list(length=None)
        
        # Get all documents (relevant for medical history, test results, etc.)
        documents = await db.documents.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).sort("upload_date", -1).to_list(length=None)
        
        # Get recent test results (all tests, latest 10 per test type)
        test_results = await db.test_results.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).sort("test_date", -1).limit(50).to_list(length=None)
        
        # Get memories
        memories = await self.get_memories(athlete_id)
        
        return {
            "athlete": athlete,
            "recent_workouts": workouts,
            "recent_sleep": sleep_data,
            "current_readiness": readiness,
            "journal_entries": journal_entries,
            "nutrition_entries": nutrition_entries,
            "documents": documents,
            "test_results": test_results,
            "memories": memories
        }
    
    async def calculate_readiness_score(self, athlete_id: str) -> ReadinessScore:
        """Calculate daily readiness score based on multiple factors"""
        context = await self.get_athlete_context(athlete_id)
        
        if not context.get('recent_sleep') or not context.get('recent_workouts'):
            # Default score if no data
            return ReadinessScore(
                athlete_id=athlete_id,
                date=datetime.now(timezone.utc).date().isoformat(),
                readiness_score=75,
                factors={'note': 'Insufficient data for accurate calculation'},
                recommendations=['Log more workout and sleep data for better insights']
            )
        
        # Simple readiness calculation (can be enhanced with more sophisticated algorithms)
        latest_sleep = context['recent_sleep'][0] if context['recent_sleep'] else None
        recent_workouts = context['recent_workouts'][:7]  # Last week
        
        score = 50  # Base score
        factors = {}
        recommendations = []
        
        # Sleep factor (40% of score)
        if latest_sleep:
            sleep_score = min(latest_sleep['total_sleep_hours'] / 8 * 40, 40)
            if latest_sleep['sleep_quality'] < 6:
                sleep_score *= 0.8
            score += sleep_score
            factors['sleep'] = f"{latest_sleep['total_sleep_hours']}h sleep, quality {latest_sleep['sleep_quality']}/10"
            
            if latest_sleep['total_sleep_hours'] < 7:
                recommendations.append('Aim for 7-9 hours of sleep for optimal recovery')
        
        # Training load factor (30% of score)
        if recent_workouts:
            weekly_miles = sum(w['distance_miles'] for w in recent_workouts)
            avg_effort = sum(w['perceived_effort'] for w in recent_workouts) / len(recent_workouts)
            
            # Penalize high volume + high intensity
            if weekly_miles > context['athlete']['weekly_mileage'] * 1.2 and avg_effort > 7:
                score -= 20
                recommendations.append('Consider reducing training intensity - high volume detected')
            elif avg_effort > 8:
                score -= 10
                recommendations.append('Your recent efforts have been high - consider an easy day')
            
            factors['training_load'] = f"{weekly_miles:.1f} miles this week, avg effort {avg_effort:.1f}/10"
        
        # HRV factor (30% if available)
        if latest_sleep and latest_sleep.get('hrv_score'):
            # Simplified HRV interpretation (normally would need baseline)
            hrv = latest_sleep['hrv_score']
            if hrv > 50:  # Good HRV
                score += 20
                factors['hrv'] = f"Good recovery (HRV: {hrv}ms)"
            elif hrv < 30:  # Low HRV
                score -= 15
                factors['hrv'] = f"Poor recovery (HRV: {hrv}ms)"
                recommendations.append('Low HRV detected - prioritize rest and recovery today')
            else:
                score += 10
                factors['hrv'] = f"Moderate recovery (HRV: {hrv}ms)"
        
        # Cap the score
        final_score = max(0, min(100, int(score)))
        
        # Generate recommendations based on score
        if final_score >= 85:
            recommendations.append('Great readiness! Perfect day for a quality workout')
        elif final_score >= 70:
            recommendations.append('Good readiness. Moderate intensity training recommended')
        elif final_score >= 50:
            recommendations.append('Moderate readiness. Consider easy aerobic training')
        else:
            recommendations.append('Low readiness. Rest or very light movement recommended')
        
        return ReadinessScore(
            athlete_id=athlete_id,
            date=datetime.now(timezone.utc).date().isoformat(),
            readiness_score=final_score,
            factors=factors,
            recommendations=recommendations
        )
    
    async def get_user_openai_key(self, athlete_id: str) -> Optional[str]:
        """Get user's personal OpenAI API key if available"""
        try:
            integration = await db.integrations.find_one({
                "athlete_id": athlete_id, 
                "integration_type": "openai",
                "is_active": True
            })
            
            if not integration:
                logging.info(f"No OpenAI integration found for athlete {athlete_id}")
                return None
                
            credentials = integration.get("credentials", {})
            api_key = credentials.get("api_key")
            
            # Ensure we have a valid, non-empty API key
            if not api_key or not api_key.strip():
                logging.info(f"OpenAI integration exists for athlete {athlete_id} but API key is empty")
                return None
                
            # Basic validation - OpenAI keys should start with sk-
            if not api_key.startswith("sk-"):
                logging.warning(f"Invalid OpenAI API key format for athlete {athlete_id}")
                return None
                
            return api_key.strip()
        except Exception as e:
            logging.error(f"Error retrieving user OpenAI key for athlete {athlete_id}: {e}")
            return None
    
    async def search_health_information(self, query: str, category: str = "general") -> Dict:
        """Search for health, nutrition, or training information using Tavily"""
        if not self.tavily_client:
            logging.warning("Tavily search requested but client not initialized")
            return {"error": "Search functionality not available"}
        
        try:
            logging.info(f"Searching Tavily for: {query} (category: {category})")
            
            # Use trusted health domains for more reliable information
            trusted_domains = []
            if category == "health":
                trusted_domains = ["nih.gov", "cdc.gov", "who.int", "mayoclinic.org", "webmd.com", "healthline.com"]
            elif category == "nutrition":
                trusted_domains = ["nutrition.gov", "eatright.org", "hsph.harvard.edu", "nutritiondata.self.com"]
            elif category == "training":
                trusted_domains = ["runnersworld.com", "trainingpeaks.com", "active.com"]
            
            search_params = {
                "query": query,
                "search_depth": "advanced",
                "max_results": 5,
                "include_answer": True,
                "include_raw_content": False
            }
            
            if trusted_domains:
                search_params["include_domains"] = trusted_domains
            
            response = self.tavily_client.search(**search_params)
            
            logging.info(f"Search completed successfully")
            return response
            
        except Exception as e:
            logging.error(f"Tavily search error: {str(e)}")
            return {"error": str(e)}
    
    async def get_training_blocks_for_period(self, athlete_id: str, start_date: str, end_date: str) -> Dict:
        """Get existing training blocks for a date range"""
        try:
            logging.info(f"Checking training blocks for athlete {athlete_id} from {start_date} to {end_date}")
            
            blocks = await db.training_blocks.find({
                "athlete_id": athlete_id,
                "$or": [
                    {"start_date": {"$gte": start_date, "$lte": end_date}},
                    {"end_date": {"$gte": start_date, "$lte": end_date}},
                    {"$and": [
                        {"start_date": {"$lte": start_date}},
                        {"end_date": {"$gte": end_date}}
                    ]}
                ]
            }, {"_id": 0}).to_list(length=None)
            
            return {
                "success": True,
                "blocks": [parse_from_mongo(b) for b in blocks],
                "count": len(blocks)
            }
        except Exception as e:
            logging.error(f"Error getting training blocks: {str(e)}")
            return {"success": False, "error": str(e), "blocks": [], "count": 0}
    
    async def update_training_blocks(self, athlete_id: str, updates: list) -> Dict:
        """Update existing training blocks in the athlete's calendar"""
        try:
            logging.info(f"Updating {len(updates)} training blocks for athlete: {athlete_id}")
            
            # Get athlete's unit preference for updates involving distance
            athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
            unit_system = athlete.get("distance_unit", "miles") if athlete else "miles"
            
            updated_blocks = []
            for update in updates:
                block_id = update.get("id")
                if not block_id:
                    continue
                
                # Remove id from update data
                update_data = {k: v for k, v in update.items() if k != "id"}
                update_data["updated_at"] = datetime.now(timezone.utc)
                
                # Set unit system if distance-related fields are being updated
                if any(key in update_data for key in ["distance", "interval_distance", "pace_per_unit", "interval_pace"]):
                    update_data["unit_system"] = unit_system
                
                # Update the block
                result = await db.training_blocks.update_one(
                    {"id": block_id, "athlete_id": athlete_id},
                    {"$set": prepare_for_mongo(update_data)}
                )
                
                if result.modified_count > 0:
                    updated_blocks.append({"id": block_id, "updated": True})
                else:
                    updated_blocks.append({"id": block_id, "updated": False, "reason": "Not found"})
            
            logging.info(f"Successfully updated {len(updated_blocks)} training blocks")
            return {
                "success": True,
                "message": f"Updated {len(updated_blocks)} training blocks",
                "blocks": updated_blocks
            }
            
        except Exception as e:
            logging.error(f"Error updating training blocks: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def delete_training_blocks(self, athlete_id: str, block_ids: list) -> Dict:
        """Delete training blocks from the athlete's calendar"""
        try:
            logging.info(f"Deleting {len(block_ids)} training blocks for athlete: {athlete_id}")
            
            # Delete multiple blocks
            result = await db.training_blocks.delete_many({
                "id": {"$in": block_ids},
                "athlete_id": athlete_id
            })
            
            logging.info(f"Successfully deleted {result.deleted_count} training blocks")
            return {
                "success": True,
                "message": f"Deleted {result.deleted_count} training blocks",
                "deleted_count": result.deleted_count
            }
            
        except Exception as e:
            logging.error(f"Error deleting training blocks: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def create_training_blocks(self, athlete_id: str, blocks_data: list) -> Dict:
        """Create multiple training blocks in the athlete's calendar"""
        try:
            logging.info(f"Creating {len(blocks_data)} training blocks for athlete: {athlete_id}")
            
            # Get athlete's unit preference
            athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
            unit_system = athlete.get("distance_unit", "miles") if athlete else "miles"
            
            created_blocks = []
            for block_data in blocks_data:
                # Create training block
                training_block = TrainingBlock(
                    athlete_id=athlete_id,
                    title=block_data.get("title", "Training"),
                    description=block_data.get("description"),
                    block_type=block_data.get("block_type", "training"),
                    start_date=block_data.get("start_date"),
                    end_date=block_data.get("end_date"),
                    start_time=block_data.get("start_time"),
                    end_time=block_data.get("end_time"),
                    workout_type=block_data.get("workout_type"),
                    distance=block_data.get("distance"),
                    duration_minutes=block_data.get("duration_minutes"),
                    pace_per_unit=block_data.get("pace_per_unit"),
                    intervals=block_data.get("intervals"),
                    interval_distance=block_data.get("interval_distance"),
                    interval_pace=block_data.get("interval_pace"),
                    rest_duration=block_data.get("rest_duration"),
                    unit_system=unit_system,
                    created_by="coach"
                )
                
                # Save to database
                block_dict = prepare_for_mongo(training_block.model_dump())
                await db.training_blocks.insert_one(block_dict)
                created_blocks.append({
                    "id": training_block.id,
                    "title": training_block.title,
                    "start_date": training_block.start_date,
                    "end_date": training_block.end_date
                })
                
            logging.info(f"Successfully created {len(created_blocks)} training blocks")
            return {
                "success": True,
                "message": f"Created {len(created_blocks)} training blocks",
                "blocks": created_blocks
            }
            
        except Exception as e:
            logging.error(f"Error creating training blocks: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def chat_with_coach(self, athlete_id: str, message: str, session_id: str = None) -> str:
        """Chat with AI coach using athlete's personal data with web search capabilities"""
        context = await self.get_athlete_context(athlete_id)
        
        # Load conversation history for this session
        conversation_history = []
        if session_id:
            history_messages = await db.chat_messages.find(
                {"athlete_id": athlete_id, "session_id": session_id},
                {"_id": 0}
            ).sort("timestamp", 1).to_list(length=None)
            
            logging.info(f"Loaded {len(history_messages)} messages from session {session_id}")
            
            # Convert to OpenAI message format (limit to last 10 exchanges to avoid token limits)
            for msg in history_messages[-10:]:
                conversation_history.append({"role": "user", "content": msg.get("message", "")})
                conversation_history.append({"role": "assistant", "content": msg.get("response", "")})
            
            logging.info(f"Added {len(conversation_history)} messages to conversation history")
        
        # Create system message with athlete context
        memories = context.get('memories', {})
        memory_summary = ""
        
        if any(memories.values()):
            memory_summary = "\nKEY MEMORIES (what you know about this athlete):\n"
            for category, items in memories.items():
                if items:
                    memory_summary += f"\n{category.upper()}:\n"
                    for mem in items[:5]:  # Top 5 per category
                        memory_summary += f"- {mem['content']}\n"
        
        # Create concise summaries instead of full JSON dumps to reduce token usage
        athlete_info = context.get('athlete', {})
        
        # Get user preferences for proper unit display
        distance_unit = athlete_info.get('distance_unit', 'miles')
        measurement_system = athlete_info.get('measurement_system', 'imperial')
        time_format = athlete_info.get('time_format', '12h')
        timezone_pref = athlete_info.get('timezone', 'UTC')
        week_starts_on = athlete_info.get('week_starts_on', 'sunday')
        
        # Format athlete summary with proper units
        weekly_distance = athlete_info.get('weekly_mileage', 0)
        distance_label = 'km' if distance_unit == 'km' else 'miles'
        athlete_summary = f"Name: {athlete_info.get('name')}, Age: {athlete_info.get('age')}, Weekly Distance: {weekly_distance} {distance_label}, Goals: {athlete_info.get('running_goals', 'Not specified')}"
        
        # Summarize workouts
        workouts = context.get('recent_workouts', [])
        workout_summary = f"{len(workouts)} workouts in last 14 days. " if workouts else "No recent workouts. "
        if workouts:
            total_miles = sum(w.get('distance_miles', 0) for w in workouts)
            workout_summary += f"Total: {total_miles:.1f} {distance_label}. Latest: {workouts[0].get('workout_type', 'run')} - {workouts[0].get('distance_miles', 0)} {distance_label} on {workouts[0].get('date')}"
        
        # Summarize sleep
        sleep_data = context.get('recent_sleep', [])
        sleep_summary = f"{len(sleep_data)} nights tracked. " if sleep_data else "No recent sleep data. "
        if sleep_data:
            avg_sleep = sum(s.get('total_sleep_hours', 0) for s in sleep_data) / len(sleep_data)
            sleep_summary += f"Average: {avg_sleep:.1f}h/night"
        
        # Summarize journal
        journal_entries = context.get('journal_entries', [])
        journal_summary = f"{len(journal_entries)} journal entries in last 30 days. " if journal_entries else "No journal entries. "
        if journal_entries and len(journal_entries) > 0:
            journal_summary += f"Latest: {journal_entries[0].get('entry', '')[:100]}..."
        
        # Summarize nutrition
        nutrition_entries = context.get('nutrition_entries', [])
        nutrition_summary = f"{len(nutrition_entries)} nutrition logs in last 7 days" if nutrition_entries else "No nutrition logs"
        
        # Summarize documents
        documents = context.get('documents', [])
        doc_summary = f"{len(documents)} documents uploaded" if documents else "No documents"
        if documents:
            doc_types = set(d.get('category', 'other') for d in documents)
            doc_summary += f" ({', '.join(doc_types)})"
        
        # Summarize test results
        test_results = context.get('test_results', [])
        test_summary = f"{len(test_results)} test results" if test_results else "No test results"
        if test_results:
            test_names = set(t.get('test_name') for t in test_results[:10])
            test_summary += f": {', '.join(test_names)}"
        
        readiness = context.get('current_readiness', {})
        readiness_summary = f"Score: {readiness.get('readiness_score', 'N/A')}" if readiness else "No readiness data"
        
        # Get current date for context
        from datetime import datetime, timezone
        current_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        current_day = datetime.now(timezone.utc).strftime("%A, %B %d, %Y")
        
        system_prompt = f"""
You are an expert endurance running coach with deep knowledge of training physiology, periodization, and athlete development. You have access to this athlete's complete training and recovery data.

TODAY'S DATE: {current_day} ({current_date})
IMPORTANT: When creating training plans, use current and future dates (2025 and beyond), NOT past dates from 2023 or 2024.

ATHLETE PROFILE:
{athlete_summary}

USER PREFERENCES (CRITICAL - ALWAYS RESPECT THESE):
- Distance Unit: {distance_unit} (ALWAYS use {distance_unit} in training plans, never miles if set to km)
- Measurement System: {measurement_system}
- Time Format: {time_format}
- Timezone: {timezone_pref}
- Week Starts On: {week_starts_on}
{memory_summary}

RECENT ACTIVITY SUMMARY:
- Workouts: {workout_summary}
- Sleep: {sleep_summary}
- Readiness: {readiness_summary}
- Journal: {journal_summary}
- Nutrition: {nutrition_summary}
- Documents: {doc_summary}
- Tests: {test_summary}

Note: Full detailed data is available in the database if you need specific information. These are just summaries.

COACHING PRINCIPLES:
- Prioritize safety and injury prevention
- Base recommendations on actual data, not assumptions
- ALWAYS respect user preferences - use {distance_unit} for ALL distances, NEVER mix units
- Consider the athlete's goals and current fitness level
- Reference specific data from their journal, nutrition logs, documents, and test results when relevant
- Provide specific, actionable advice
- Explain the 'why' behind your recommendations
- Be encouraging but realistic
- When you need current information about health, nutrition, or training topics, use the search_health_information function to get up-to-date, accurate information from trusted sources

TRAINING CALENDAR MANAGEMENT:
You have full calendar management capabilities: VIEW, CREATE, UPDATE, and DELETE training blocks.

DECIDING WHICH FUNCTION TO USE:

1. USE update_training_blocks WHEN:
   - User wants to MODIFY existing workouts: "move my run to 7 AM", "change tomorrow's distance to 8 miles"
   - User wants to ADJUST details: "make Wednesday easier", "reduce the pace"
   - User wants to RESCHEDULE: "move Monday's workout to Tuesday"
   - WORKFLOW: get_training_blocks_for_period → find the block(s) → update_training_blocks with block ID(s)

2. USE delete_training_blocks WHEN:
   - User wants to REMOVE workouts: "delete tomorrow's run", "cancel my Monday workout"
   - User wants to CLEAR calendar: "remove all workouts this week"
   - Replacing workouts: delete old ones first, then create new ones
   - WORKFLOW: get_training_blocks_for_period → find the block(s) → delete_training_blocks with block ID(s)

3. USE create_training_blocks WHEN:
   - User wants to ADD completely NEW workouts: "add a run on Friday"
   - Creating a NEW training plan from scratch
   - Adding workouts to EMPTY calendar dates
   - WORKFLOW: get_training_blocks_for_period (check for conflicts) → create_training_blocks

GENERAL WORKFLOW:
STEP 1: ALWAYS start with get_training_blocks_for_period to see what exists
STEP 2: Analyze user's request:
   - Modifying existing? → update_training_blocks
   - Removing workouts? → delete_training_blocks  
   - Adding new workouts? → create_training_blocks
STEP 3: If conflicts exist with create operations, ASK user:
   a) Update existing workouts
   b) Delete and replace
   c) Add alongside existing

IMPORTANT RULES:
- ALWAYS check calendar FIRST with get_training_blocks_for_period
- PREFER updating over deleting+creating when modifying workouts
- Extract block IDs from get_training_blocks_for_period results for update/delete operations
- REMEMBER conversation context - know what you discussed in previous messages
- When user says "add it to my calendar", they're referring to what you just discussed
- Provide clear confirmation of what was updated/deleted/created

CALCULATING WORKOUT END TIMES:
When creating workouts with a start_time but NO end_time specified, you MUST calculate and set the end_time based on estimated workout duration.

Use these guidelines for duration estimation:

1. EASY/RECOVERY RUNS:
   - Warmup: 5 minutes
   - Main run: Calculate from distance and pace (e.g., 5 miles @ 9:00 pace = 45 min)
   - Cool down: 5 minutes
   - Total example: 5 min + 45 min + 5 min = 55 minutes
   - If start_time is "06:00", end_time should be "06:55"

2. TEMPO RUNS:
   - Warmup: 10-15 minutes
   - Main tempo: Calculate from distance and pace
   - Cool down: 10 minutes
   - Total example: 15 min + 30 min + 10 min = 55 minutes

3. INTERVAL WORKOUTS:
   - Warmup: 15-20 minutes
   - Intervals: (interval_distance ÷ pace × intervals) + (rest_duration × (intervals-1))
   - Cool down: 10-15 minutes
   - Example: 6 × 800m @ 3:00 pace with 90s rest = 20 min warmup + (3 min × 6) + (90s × 5) + 10 min cooldown = 20 + 18 + 7.5 + 10 = 55.5 minutes

4. LONG RUNS:
   - Warmup: 5-10 minutes (minimal)
   - Main run: Calculate from distance and pace
   - Cool down: 5-10 minutes
   - Add 5-10 minutes for water/nutrition breaks on runs over 90 minutes

5. CROSS TRAINING:
   - Use duration_minutes if specified
   - Otherwise default to 45-60 minutes

ALWAYS round end times to nearest 5 or 15-minute increment for cleaner scheduling (e.g., "06:55" or "07:00" not "06:52")

CRITICAL UNIT CONSISTENCY:
- ALWAYS use the athlete's preferred distance unit ({distance_unit}) in ALL training plans and workouts
- If distance_unit is "km", NEVER use miles - convert distances to km
- If distance_unit is "miles", NEVER use km - convert distances to miles
- The backend automatically sets unit_system="{distance_unit}" on all training blocks you create
- Distance examples for {distance_unit}: Easy run = {'8 km' if distance_unit == 'km' else '5 miles'}, Long run = {'16 km' if distance_unit == 'km' else '10 miles'}

Example training block types (using {distance_unit}):
- Easy runs: {{"block_type": "training", "workout_type": "run", "distance": {'8' if distance_unit == 'km' else '5'}, "pace_per_unit": "{'5:30' if distance_unit == 'km' else '9:00'}"}}
- Intervals: {{"workout_type": "intervals", "intervals": 6, "interval_distance": {'0.8' if distance_unit == 'km' else '0.5'}, "interval_pace": "{'4:40' if distance_unit == 'km' else '7:30'}", "rest_duration": 90}}
- Tempo runs: {{"workout_type": "tempo", "distance": {'6' if distance_unit == 'km' else '4'}, "pace_per_unit": "{'4:50' if distance_unit == 'km' else '7:45'}"}}
- Recovery days: {{"block_type": "recovery", "title": "Rest Day"}}

CHART GENERATION:
When showing trends or data visualizations, you can create interactive charts using this format:
```chart
{{
  "type": "line|bar|area",
  "title": "Chart Title",
  "data": [
    {{"name": "Week 1", "{distance_unit.lower()}": {'40' if distance_unit == 'km' else '25'}, "pace": {'5.3' if distance_unit == 'km' else '8.5'}}},
    {{"name": "Week 2", "{distance_unit.lower()}": {'48' if distance_unit == 'km' else '30'}, "pace": {'5.1' if distance_unit == 'km' else '8.2'}}}
  ],
  "xKey": "name",
  "yKey": "{distance_unit.lower()}",
  "xLabel": "Week",
  "yLabel": "{distance_unit.title()}",
  "color": "#3b82f6"
}}
```

Chart types:
- "line": For trends over time (pace progression, distance trends)
- "bar": For comparing values (weekly volume, workout types)
- "area": For cumulative data (elevation gain, training load)

For multiple series, use yKey as an array: "yKey": ["miles", "pace"]

Use charts when:
- Showing weekly/monthly trends
- Comparing workout volumes
- Displaying pace progression
- Visualizing training load

Respond as a knowledgeable coach who truly knows this athlete's training history, sleep patterns, and current state. Reference specific data points when relevant. Always cite sources when using information from web searches.
"""
        
        try:
            # Check if user has their own OpenAI API key
            user_openai_key = await self.get_user_openai_key(athlete_id)
            
            if not user_openai_key:
                print(f"❌ ERROR: No OpenAI API key found for athlete {athlete_id}")
                logging.error(f"No OpenAI API key found for athlete {athlete_id}")
                return "I need an OpenAI API key to function properly. Please add your OpenAI API key in Account Settings → Apps → OpenAI API Key to enable all features including calendar management, web search, and training plan creation."
            
            # Use user's personal OpenAI API key with function calling
            import openai
            
            print(f"✅ Using OpenAI API key for athlete {athlete_id}")
            logging.info(f"Using user's OpenAI API key for athlete {athlete_id}")
            client = openai.AsyncOpenAI(api_key=user_openai_key)
            
            # Define tools for function calling
            tools = []
            print(f"🔧 Setting up function calling tools for athlete {athlete_id}")
            logging.info(f"Setting up function calling tools for athlete {athlete_id}")
            if self.tavily_client:  # Only add search tool if Tavily is available
                logging.info("Adding search_health_information tool")
                tools.append({
                        "type": "function",
                        "function": {
                            "name": "search_health_information",
                            "description": "Search for current health, nutrition, fitness, or training information. Use this when users ask about health conditions, nutrition facts, workout routines, training guidance, latest research, or any health-related topics that require up-to-date information. Focus on health, nutrition, and training topics.",
                            "parameters": {
                                "type": "object",
                                "properties": {
                                    "query": {
                                        "type": "string",
                                        "description": "The search query for health/nutrition/training information"
                                    },
                                    "category": {
                                        "type": "string",
                                        "enum": ["health", "nutrition", "training", "general"],
                                        "description": "The category of information being searched"
                                    }
                                },
                                "required": ["query"]
                            }
                        }
                    })
                
                # Always add training block management tools
                logging.info("Adding get_training_blocks_for_period tool")
                tools.append({
                    "type": "function",
                    "function": {
                        "name": "get_training_blocks_for_period",
                        "description": "Check what training blocks exist in the calendar for a specific date range. Use this BEFORE creating new blocks to check for conflicts and inform the user about existing workouts.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "start_date": {"type": "string", "description": "Start date in YYYY-MM-DD format"},
                                "end_date": {"type": "string", "description": "End date in YYYY-MM-DD format"}
                            },
                            "required": ["start_date", "end_date"]
                        }
                    }
                })
                
                logging.info("Adding update_training_blocks tool")
                tools.append({
                    "type": "function",
                    "function": {
                        "name": "update_training_blocks",
                        "description": "Update existing training blocks in the calendar. Use this when user wants to modify, change, or adjust existing workouts (e.g., 'move my run to 7 AM', 'change tomorrow's distance to 8 miles', 'make Wednesday an easy run'). First get blocks with get_training_blocks_for_period, then update specific ones.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "updates": {
                                    "type": "array",
                                    "description": "Array of block updates. Each must include the block ID and fields to update.",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "id": {"type": "string", "description": "The ID of the block to update (from get_training_blocks_for_period)"},
                                            "title": {"type": "string", "description": "New title"},
                                            "start_time": {"type": "string", "description": "New start time in HH:MM format"},
                                            "end_time": {"type": "string", "description": "New end time in HH:MM format"},
                                            "distance": {"type": "number", "description": "New distance"},
                                            "pace_per_unit": {"type": "string", "description": "New pace"},
                                            "description": {"type": "string", "description": "New description"}
                                        },
                                        "required": ["id"]
                                    }
                                }
                            },
                            "required": ["updates"]
                        }
                    }
                })
                
                logging.info("Adding delete_training_blocks tool")
                tools.append({
                    "type": "function",
                    "function": {
                        "name": "delete_training_blocks",
                        "description": "Delete training blocks from the calendar. Use this when user wants to remove, cancel, or delete workouts (e.g., 'delete tomorrow's workout', 'remove all workouts this week', 'cancel my Monday run'). First get blocks with get_training_blocks_for_period to find IDs.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "block_ids": {
                                    "type": "array",
                                    "description": "Array of block IDs to delete (from get_training_blocks_for_period)",
                                    "items": {
                                        "type": "string"
                                    }
                                }
                            },
                            "required": ["block_ids"]
                        }
                    }
                })
                
                logging.info("Adding create_training_blocks tool")
                tools.append({
                    "type": "function",
                    "function": {
                        "name": "create_training_blocks",
                        "description": "Create NEW training blocks in the athlete's calendar. Use this ONLY for adding completely new workouts, NOT for modifying existing ones. For modifications, use update_training_blocks instead. ALWAYS check existing blocks first using get_training_blocks_for_period.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "blocks_data": {
                                    "type": "array",
                                    "description": "Array of training blocks to create",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "title": {"type": "string", "description": "Title of the workout (e.g., 'Easy Run', '5K Tempo')"},
                                            "description": {"type": "string", "description": "Detailed description of the workout"},
                                            "block_type": {"type": "string", "enum": ["training", "recovery"], "description": "Type of block"},
                                            "start_date": {"type": "string", "description": "Start date in YYYY-MM-DD format"},
                                            "end_date": {"type": "string", "description": "End date in YYYY-MM-DD format (same as start_date for single-day workouts)"},
                                            "start_time": {"type": "string", "description": "Start time in HH:MM format (e.g., '06:00' for 6:00 AM). Optional - if not specified, workout is all-day"},
                                            "end_time": {"type": "string", "description": "End time in HH:MM format (e.g., '07:30' for 7:30 AM). REQUIRED if start_time is provided. Calculate from workout duration including warmup, main workout, cool down, and rest periods. Round to nearest 5-15 minute increment."},
                                            "workout_type": {"type": "string", "enum": ["run", "intervals", "tempo", "recovery", "cross_training"], "description": "Type of workout"},
                                            "distance": {"type": "number", "description": f"Distance in {distance_unit} (user's preferred unit)"},
                                            "duration_minutes": {"type": "integer", "description": "Duration in minutes"},
                                            "pace_per_unit": {"type": "string", "description": "Target pace in MM:SS format (e.g., '8:30')"},
                                            "intervals": {"type": "integer", "description": "Number of intervals"},
                                            "interval_distance": {"type": "number", "description": f"Distance per interval in {distance_unit}"},
                                            "interval_pace": {"type": "string", "description": "Pace per interval in MM:SS format"},
                                            "rest_duration": {"type": "integer", "description": "Rest between intervals in seconds"}
                                        },
                                        "required": ["title", "start_date", "end_date"]
                                    }
                                }
                            },
                            "required": ["blocks_data"]
                        }
                    }
                })
                
                # Build messages with conversation history
                messages = [{"role": "system", "content": system_prompt}]
                messages.extend(conversation_history)  # Add conversation history
                messages.append({"role": "user", "content": message})
                
                # First API call
                completion_params = {
                    "model": "gpt-4o",
                    "messages": messages,
                    "max_tokens": 2000,
                    "temperature": 0.7
                }
                
                if tools:
                    completion_params["tools"] = tools
                    tool_names = [t["function"]["name"] for t in tools]
                    print(f"🛠️  Tools available: {len(tools)} tools - {', '.join(tool_names)}")
                    logging.info(f"Tools available for function calling: {len(tools)} tools - {', '.join(tool_names)}")
                else:
                    print("⚠️  No tools available")
                    logging.info("No tools available - Tavily not configured")
                
                logging.info(f"Sending request to OpenAI with {len(messages)} messages and {len(tools) if tools else 0} tools")
                response = await client.chat.completions.create(**completion_params)
                
                assistant_message = response.choices[0].message
                
                # Log whether function was called
                has_tool_calls = hasattr(assistant_message, "tool_calls") and assistant_message.tool_calls
                print(f"📨 Response received - Has tool calls: {has_tool_calls}")
                logging.info(f"Response received - Has tool calls: {has_tool_calls}")
                
                if assistant_message.content:
                    logging.info(f"Response content preview: {assistant_message.content[:100]}...")
                
                # Check if function call was requested - support multiple sequential calls
                max_function_calls = 5  # Prevent infinite loops
                function_call_count = 0
                
                while has_tool_calls and function_call_count < max_function_calls:
                    function_call_count += 1
                    print(f"🔄 Function call iteration {function_call_count}")
                    
                    tool_call = assistant_message.tool_calls[0]
                    function_name = tool_call.function.name
                    
                    print(f"🎯 Function called: {function_name}")
                    print(f"📝 Function arguments: {tool_call.function.arguments}")
                    logging.info(f"Function called: {function_name}")
                    logging.info(f"Function arguments: {tool_call.function.arguments}")
                    
                    function_result = None
                    
                    if function_name == "search_health_information":
                        function_args = json.loads(tool_call.function.arguments)
                        query = function_args.get("query")
                        category = function_args.get("category", "general")
                        function_result = await self.search_health_information(query, category)
                    
                    elif function_name == "get_training_blocks_for_period":
                        function_args = json.loads(tool_call.function.arguments)
                        start_date = function_args.get("start_date")
                        end_date = function_args.get("end_date")
                        function_result = await self.get_training_blocks_for_period(athlete_id, start_date, end_date)
                    
                    elif function_name == "update_training_blocks":
                        function_args = json.loads(tool_call.function.arguments)
                        updates = function_args.get("updates", [])
                        function_result = await self.update_training_blocks(athlete_id, updates)
                    
                    elif function_name == "delete_training_blocks":
                        function_args = json.loads(tool_call.function.arguments)
                        block_ids = function_args.get("block_ids", [])
                        function_result = await self.delete_training_blocks(athlete_id, block_ids)
                    
                    elif function_name == "create_training_blocks":
                        function_args = json.loads(tool_call.function.arguments)
                        blocks_data = function_args.get("blocks_data", [])
                        function_result = await self.create_training_blocks(athlete_id, blocks_data)
                    
                    if function_result:
                        # Add function call and result to messages
                        messages.append({
                            "role": "assistant",
                            "content": None,
                            "tool_calls": [{
                                "id": tool_call.id,
                                "type": "function",
                                "function": {
                                    "name": function_name,
                                    "arguments": tool_call.function.arguments
                                }
                            }]
                        })
                        
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "name": function_name,
                            "content": json.dumps(function_result)
                        })
                        
                        # Call OpenAI again to see if it wants to call another function
                        print(f"🔁 Calling OpenAI again with function result...")
                        next_response = await client.chat.completions.create(
                            model="gpt-4o",
                            messages=messages,
                            max_tokens=2000,
                            temperature=0.7,
                            tools=tools if tools else None
                        )
                        
                        assistant_message = next_response.choices[0].message
                        has_tool_calls = hasattr(assistant_message, "tool_calls") and assistant_message.tool_calls
                        print(f"📨 Next response - Has tool calls: {has_tool_calls}")
                        
                        # If no more tool calls, return the final message
                        if not has_tool_calls:
                            print(f"✅ Function calling complete after {function_call_count} calls")
                            return assistant_message.content or "I've completed the requested actions."
                
                return assistant_message.content or "I've received your message, but couldn't generate a proper response. Please try rephrasing."
                
        except Exception as e:
            logging.error(f"AI Coach error: {e}")
            return "I'm having trouble accessing my coaching insights right now. Please try again in a moment."

# Strava Service Classes
class StravaTokenManager:
    def __init__(self):
        self.client_id = os.environ.get('STRAVA_CLIENT_ID')
        self.client_secret = os.environ.get('STRAVA_CLIENT_SECRET')
        
    async def exchange_code_for_tokens(self, auth_code: str, client_id: str = None, client_secret: str = None) -> Dict[str, Any]:
        """Exchange authorization code for access and refresh tokens"""
        # Use provided credentials or fall back to instance defaults
        use_client_id = client_id or self.client_id
        use_client_secret = client_secret or self.client_secret
        
        token_data = {
            "client_id": use_client_id,
            "client_secret": use_client_secret,
            "code": auth_code,
            "grant_type": "authorization_code"
        }
        
        response = requests.post(
            "https://www.strava.com/api/v3/oauth/token",
            data=token_data
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Token exchange failed")
        
        return response.json()
    
    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh expired access token"""
        refresh_data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
        }
        
        response = requests.post(
            "https://www.strava.com/api/v3/oauth/token",
            data=refresh_data
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Token refresh failed")
        
        return response.json()
    
    async def get_valid_token(self, athlete_id: str) -> str:
        """Get valid access token, refreshing if necessary"""
        integration = await db.integrations.find_one({
            "athlete_id": athlete_id, 
            "integration_type": "strava",
            "is_active": True
        })
        
        if not integration:
            raise HTTPException(status_code=404, detail="Strava integration not found")
        
        # Check if token is expired (with 5-minute buffer)
        expires_at = integration["credentials"].get("expires_at")
        if expires_at and expires_at < datetime.now(timezone.utc).timestamp() + 300:
            # Token is expired or will expire soon, refresh it
            refresh_token = integration["credentials"]["refresh_token"]
            new_tokens = await self.refresh_access_token(refresh_token)
            
            # Update stored tokens
            await db.integrations.update_one(
                {"_id": integration["_id"]},
                {"$set": {
                    "credentials.access_token": new_tokens["access_token"],
                    "credentials.refresh_token": new_tokens["refresh_token"],
                    "credentials.expires_at": new_tokens["expires_at"],
                    "last_sync": datetime.now(timezone.utc)
                }}
            )
            
            return new_tokens["access_token"]
        
        return integration["credentials"]["access_token"]

class StravaActivityManager:
    def __init__(self, token_manager: StravaTokenManager):
        self.token_manager = token_manager
    
    async def fetch_recent_activities(self, athlete_id: str, limit: int = 30) -> List[Dict[str, Any]]:
        """Fetch recent activities from Strava"""
        access_token = await self.token_manager.get_valid_token(athlete_id)
        client = Client(access_token=access_token)
        
        activities = []
        try:
            activity_iter = client.get_activities(limit=limit)
            
            for activity in activity_iter:
                activities.append({
                    "strava_id": activity.id,
                    "name": activity.name,
                    "type": str(activity.type) if activity.type else "Unknown",
                    "distance": float(activity.distance) if activity.distance else None,
                    "moving_time": activity.moving_time.total_seconds() if activity.moving_time else None,
                    "elapsed_time": activity.elapsed_time.total_seconds() if activity.elapsed_time else None,
                    "total_elevation_gain": float(activity.total_elevation_gain) if activity.total_elevation_gain else None,
                    "start_date": activity.start_date_local,
                    "average_speed": float(activity.average_speed) if activity.average_speed else None,
                    "max_speed": float(activity.max_speed) if activity.max_speed else None,
                    "average_heartrate": activity.average_heartrate,
                    "max_heartrate": activity.max_heartrate,
                    "calories": activity.calories,
                    "description": activity.description,
                    "trainer": activity.trainer,
                    "commute": activity.commute
                })
            
            return activities
        except Exception as e:
            logging.error(f"Failed to fetch Strava activities: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to fetch Strava activities")
    
    async def import_activities_to_workouts(self, athlete_id: str) -> int:
        """Import Strava activities as workouts"""
        strava_activities = await self.fetch_recent_activities(athlete_id)
        imported_count = 0
        
        for activity in strava_activities:
            # Check if activity already exists
            existing = await db.workouts.find_one({
                "athlete_id": athlete_id,
                "strava_activity_id": activity["strava_id"]
            })
            
            if existing:
                continue  # Skip already imported activities
            
            # Convert Strava activity to workout format
            workout_data = {
                "id": str(uuid.uuid4()),
                "athlete_id": athlete_id,
                "strava_activity_id": activity["strava_id"],
                "date": activity["start_date"].date().isoformat() if activity["start_date"] else datetime.now().date().isoformat(),
                "workout_type": self._map_strava_type_to_workout_type(activity["type"]),
                "distance_miles": round(activity["distance"] / 1609.34, 2) if activity["distance"] else 0,
                "duration_minutes": round(activity["moving_time"] / 60) if activity["moving_time"] else 0,
                "avg_hr": activity["average_heartrate"],
                "max_hr": activity["max_heartrate"],
                "perceived_effort": 5,  # Default value, could be enhanced
                "notes": f"Imported from Strava: {activity['name']}",
                "created_at": datetime.now(timezone.utc)
            }
            
            await db.workouts.insert_one(prepare_for_mongo(workout_data))
            imported_count += 1
        
        return imported_count
    
    def _map_strava_type_to_workout_type(self, strava_type: str) -> str:
        """Map Strava activity type to workout type"""
        type_mapping = {
            "Run": "easy",
            "Ride": "easy", 
            "Workout": "intervals",
            "Race": "intervals",
            "Long Run": "long_run",
            "TrailRun": "easy"
        }
        return type_mapping.get(strava_type, "easy")

# Oura Service Classes
class OuraTokenManager:
    def __init__(self):
        self.client_id = os.environ.get('OURA_CLIENT_ID')
        self.client_secret = os.environ.get('OURA_CLIENT_SECRET')
        
    async def exchange_code_for_tokens(self, auth_code: str) -> Dict[str, Any]:
        """Exchange authorization code for access and refresh tokens"""
        token_data = {
            "grant_type": "authorization_code",
            "code": auth_code,
            "redirect_uri": os.environ.get('OURA_REDIRECT_URI'),
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        
        response = requests.post(
            "https://api.ouraring.com/oauth/token",
            data=token_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Oura token exchange failed")
        
        return response.json()
    
    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh expired access token"""
        refresh_data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        
        response = requests.post(
            "https://api.ouraring.com/oauth/token",
            data=refresh_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Oura token refresh failed")
        
        return response.json()
    
    async def get_valid_token(self, athlete_id: str) -> str:
        """Get valid access token, refreshing if necessary"""
        integration = await db.integrations.find_one({
            "athlete_id": athlete_id, 
            "integration_type": "oura",
            "is_active": True
        })
        
        if not integration:
            raise HTTPException(status_code=404, detail="Oura integration not found")
        
        # Check if token is expired (with 5-minute buffer)
        expires_at = integration["credentials"].get("expires_at")
        if expires_at and expires_at < datetime.now(timezone.utc).timestamp() + 300:
            # Token is expired or will expire soon, refresh it
            refresh_token = integration["credentials"]["refresh_token"]
            new_tokens = await self.refresh_access_token(refresh_token)
            
            # Update stored tokens
            await db.integrations.update_one(
                {"_id": integration["_id"]},
                {"$set": {
                    "credentials.access_token": new_tokens["access_token"],
                    "credentials.refresh_token": new_tokens["refresh_token"],
                    "credentials.expires_at": new_tokens["expires_at"],
                    "last_sync": datetime.now(timezone.utc)
                }}
            )
            
            return new_tokens["access_token"]
        
        return integration["credentials"]["access_token"]

class OuraDataManager:
    def __init__(self, token_manager: OuraTokenManager):
        self.token_manager = token_manager
    
    async def fetch_sleep_data(self, athlete_id: str, start_date: str, end_date: str = None) -> List[Dict[str, Any]]:
        """Fetch sleep data from Oura API"""
        access_token = await self.token_manager.get_valid_token(athlete_id)
        
        try:
            # Initialize Oura client with access token
            client = OuraClient(personal_access_token=access_token)
            
            # Fetch sleep data
            sleep_data = client.sleep_summary(start=start_date, end=end_date)
            
            return sleep_data.get('sleep', [])
            
        except Exception as e:
            logging.error(f"Failed to fetch Oura sleep data: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to fetch Oura sleep data")
    
    async def fetch_readiness_data(self, athlete_id: str, start_date: str, end_date: str = None) -> List[Dict[str, Any]]:
        """Fetch readiness data from Oura API"""
        access_token = await self.token_manager.get_valid_token(athlete_id)
        
        try:
            # Initialize Oura client with access token
            client = OuraClient(personal_access_token=access_token)
            
            # Fetch readiness data
            readiness_data = client.readiness_summary(start=start_date, end=end_date)
            
            return readiness_data.get('readiness', [])
            
        except Exception as e:
            logging.error(f"Failed to fetch Oura readiness data: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to fetch Oura readiness data")
    
    async def import_sleep_data_to_db(self, athlete_id: str, days_back: int = 30) -> int:
        """Import Oura sleep data and convert to RunWisely sleep format"""
        end_date = datetime.now(timezone.utc).date()
        start_date = end_date - timedelta(days=days_back)
        
        oura_sleep_data = await self.fetch_sleep_data(
            athlete_id, 
            start_date.isoformat(), 
            end_date.isoformat()
        )
        
        imported_count = 0
        
        for sleep_record in oura_sleep_data:
            oura_date = sleep_record.get('summary_date')
            
            # Check if already imported
            existing = await db.sleep_data.find_one({
                "athlete_id": athlete_id,
                "date": oura_date
            })
            
            if existing:
                continue  # Skip already imported data
            
            # Convert Oura sleep data to RunWisely format
            sleep_data = {
                "id": str(uuid.uuid4()),
                "athlete_id": athlete_id,
                "date": oura_date,
                "total_sleep_hours": (sleep_record.get('total_sleep_duration', 0) / 3600) if sleep_record.get('total_sleep_duration') else None,
                "sleep_efficiency": sleep_record.get('efficiency'),
                "hrv_score": sleep_record.get('rmssd'),  # RMSSD is the HRV metric Oura uses
                "resting_hr": sleep_record.get('hr_lowest'),
                "sleep_quality": self._convert_oura_score_to_quality(sleep_record.get('score', 0)),
                "created_at": datetime.now(timezone.utc)
            }
            
            # Store original Oura data as well for reference
            oura_sleep_data_record = OuraSleepData(
                athlete_id=athlete_id,
                oura_date=oura_date,
                bedtime_start=sleep_record.get('bedtime_start'),
                bedtime_end=sleep_record.get('bedtime_end'),
                total_sleep_duration=sleep_record.get('total_sleep_duration'),
                sleep_efficiency=sleep_record.get('efficiency'),
                sleep_score=sleep_record.get('score'),
                deep_sleep_duration=sleep_record.get('deep_sleep_duration'),
                rem_sleep_duration=sleep_record.get('rem_sleep_duration'),
                light_sleep_duration=sleep_record.get('light_sleep_duration'),
                awake_time=sleep_record.get('awake_time'),
                hr_lowest=sleep_record.get('hr_lowest'),
                hr_average=sleep_record.get('hr_average'),
                hrv_average=sleep_record.get('rmssd'),
                temperature_delta=sleep_record.get('temperature_delta')
            )
            
            # Insert both records
            await db.sleep_data.insert_one(prepare_for_mongo(sleep_data))
            await db.oura_sleep_data.insert_one(prepare_for_mongo(oura_sleep_data_record.model_dump()))
            
            imported_count += 1
        
        return imported_count
    
    def _convert_oura_score_to_quality(self, oura_score: int) -> int:
        """Convert Oura's 0-100 score to RunWisely's 1-10 quality scale"""
        if oura_score >= 85:
            return 9
        elif oura_score >= 70:
            return 7
        elif oura_score >= 55:
            return 5
        elif oura_score >= 40:
            return 3
        else:
            return 1

# Initialize services
ai_coach = AICoachService()
strava_token_manager = StravaTokenManager()
strava_activity_manager = StravaActivityManager(strava_token_manager)
oura_token_manager = OuraTokenManager()
oura_data_manager = OuraDataManager(oura_token_manager)

# Initialize OpenAI Realtime Voice Service
openai_realtime_chat = None

async def get_realtime_chat_for_athlete(athlete_id: str):
    """Get or create OpenAI Realtime Chat instance for athlete"""
    # Get user's OpenAI API key
    user_openai_key = await ai_coach.get_user_openai_key(athlete_id)
    if not user_openai_key:
        raise HTTPException(status_code=400, detail="OpenAI API key required for voice chat")
    
    # Create realtime chat instance
    realtime_chat = OpenAIChatRealtime(api_key=user_openai_key)
    return realtime_chat

# API Routes
@api_router.get("/")
async def root():
    return {"message": "RunWisely AI Coach API"}

# Athlete Profile routes
@api_router.post("/athlete", response_model=AthleteProfile)
async def create_athlete_profile(profile: AthleteProfile):
    # Check if email already exists
    existing = await db.athlete_profiles.find_one({"email": profile.email.lower().strip()})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    
    # Hash the password before storing
    hashed_password = pwd_context.hash(profile.password)
    profile_dict = prepare_for_mongo(profile.model_dump())
    profile_dict["password"] = hashed_password
    
    await db.athlete_profiles.insert_one(profile_dict)
    return profile

@api_router.post("/auth/login")
async def login_athlete(login_data: LoginRequest):
    """Login athlete by email and password"""
    athlete = await db.athlete_profiles.find_one(
        {"email": login_data.email.lower().strip()}, 
        {"_id": 0}
    )
    if not athlete:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not pwd_context.verify(login_data.password, athlete["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    return {
        "athlete_id": athlete["id"],
        "name": athlete["name"],
        "email": athlete["email"]
    }

@api_router.post("/auth/forgot-password")
async def forgot_password(request: PasswordResetRequest):
    """Initiate password reset process"""
    athlete = await db.athlete_profiles.find_one(
        {"email": request.email.lower().strip()}, 
        {"_id": 0}
    )
    if not athlete:
        # Don't reveal if email exists or not for security
        return {"message": "If the email exists, a reset link will be sent"}
    
    # Generate a reset token (valid for 1 hour)
    reset_token = secrets.token_urlsafe(32)
    reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Store reset token in database
    await db.athlete_profiles.update_one(
        {"id": athlete["id"]},
        {"$set": {
            "reset_token": reset_token,
            "reset_token_expires": reset_expires.isoformat()
        }}
    )
    
    # In a real app, you would send an email here
    # For now, we'll return the token (remove this in production)
    return {
        "message": "Password reset initiated",
        "reset_token": reset_token,  # Remove this in production!
        "email": request.email
    }

@api_router.post("/auth/reset-password")
async def reset_password(request: PasswordResetConfirm):
    """Complete password reset with token"""
    athlete = await db.athlete_profiles.find_one(
        {"email": request.email.lower().strip()}, 
        {"_id": 0}
    )
    if not athlete:
        raise HTTPException(status_code=400, detail="Invalid reset request")
    
    # Check if reset token exists and is valid
    if not athlete.get("reset_token") or athlete.get("reset_token") != request.reset_token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Check if token is expired
    if athlete.get("reset_token_expires"):
        expires = datetime.fromisoformat(athlete["reset_token_expires"])
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(status_code=400, detail="Reset token has expired")
    
    # Hash new password and update
    hashed_password = pwd_context.hash(request.new_password)
    
    await db.athlete_profiles.update_one(
        {"id": athlete["id"]},
        {"$set": {
            "password": hashed_password
        }, "$unset": {
            "reset_token": "",
            "reset_token_expires": ""
        }}
    )
    
    return {"message": "Password reset successfully"}

@api_router.post("/auth/change-password")
async def change_password(request: ChangePasswordRequest):
    """Change password for logged-in user"""
    athlete = await db.athlete_profiles.find_one(
        {"id": request.athlete_id}, 
        {"_id": 0}
    )
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    # Verify current password
    if not pwd_context.verify(request.current_password, athlete["password"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Hash new password and update
    hashed_password = pwd_context.hash(request.new_password)
    
    await db.athlete_profiles.update_one(
        {"id": request.athlete_id},
        {"$set": {"password": hashed_password}}
    )
    
    return {"message": "Password changed successfully"}

@api_router.get("/athlete/{athlete_id}", response_model=AthleteProfile)
async def get_athlete_profile(athlete_id: str):
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    return parse_from_mongo(athlete)

@api_router.put("/athlete/{athlete_id}", response_model=AthleteProfile)
async def update_athlete_profile(athlete_id: str, updates: AthleteUpdate):
    """Update athlete profile with partial data"""
    # Get current athlete
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    # Update only provided fields
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    # If date_of_birth is being updated, calculate and set age
    if 'date_of_birth' in update_data and update_data['date_of_birth']:
        calculated_age = calculate_age(update_data['date_of_birth'])
        if calculated_age is not None:
            update_data['age'] = calculated_age
    
    # Convert date objects to ISO strings for MongoDB storage
    if update_data:
        prepared_data = prepare_for_mongo(update_data)
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": prepared_data}
        )
    
    # Return updated athlete
    updated_athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    return parse_from_mongo(updated_athlete)

@api_router.post("/athlete/{athlete_id}/profile-picture")
async def upload_profile_picture(athlete_id: str, file: UploadFile = File(...)):
    """Upload and update athlete profile picture"""
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Check file size (limit to 5MB)
        file_content = await file.read()
        if len(file_content) > 5 * 1024 * 1024:  # 5MB
            raise HTTPException(status_code=400, detail="File size must be less than 5MB")
        
        # Verify athlete exists
        athlete = await db.athlete_profiles.find_one({"id": athlete_id})
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        # Process image - resize and convert to base64
        try:
            image = Image.open(io.BytesIO(file_content))
            
            # Convert to RGB if needed (for RGBA or other modes)
            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = background
            
            # Resize image to 200x200 maintaining aspect ratio
            image.thumbnail((200, 200), Image.Resampling.LANCZOS)
            
            # Create a square canvas
            canvas = Image.new('RGB', (200, 200), (255, 255, 255))
            # Center the image on the canvas
            x = (200 - image.width) // 2
            y = (200 - image.height) // 2
            canvas.paste(image, (x, y))
            
            # Convert to base64
            buffer = io.BytesIO()
            canvas.save(buffer, format='JPEG', quality=85)
            image_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
            profile_picture = f"data:image/jpeg;base64,{image_data}"
            
        except Exception as e:
            logging.error(f"Error processing image: {e}")
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Update athlete profile with new picture
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": {"profile_picture": profile_picture}}
        )
        
        return {"success": True, "message": "Profile picture updated successfully", "profile_picture": profile_picture}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading profile picture: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload profile picture")

# Subscription routes
SUBSCRIPTION_PLANS = {
    "pro_monthly": {"price": 9.99, "interval": "month", "interval_count": 1, "tier": "pro", "name": "Pro Monthly"},
    "pro_annual": {"price": 99.0, "interval": "year", "interval_count": 1, "tier": "pro", "name": "Pro Annual"},
    "premium_monthly": {"price": 19.99, "interval": "month", "interval_count": 1, "tier": "premium", "name": "Premium Monthly"},
    "premium_annual": {"price": 199.0, "interval": "year", "interval_count": 1, "tier": "premium", "name": "Premium Annual"},
}

async def get_or_create_stripe_price(plan_id: str, plan_config: dict, stripe_api_key: str) -> str:
    """Get or create a Stripe Price ID for recurring subscriptions"""
    import stripe
    stripe.api_key = stripe_api_key
    
    # Check if price already exists in our database
    price_record = await db.stripe_prices.find_one({"plan_id": plan_id})
    if price_record:
        return price_record["stripe_price_id"]
    
    try:
        # Create product if it doesn't exist
        products = stripe.Product.list(limit=1)
        product = None
        for p in products.auto_paging_iter():
            if p.name == "My Health Tracker Subscription":
                product = p
                break
        
        if not product:
            product = stripe.Product.create(
                name="My Health Tracker Subscription",
                description="Subscription plans for My Health Tracker"
            )
        
        # Create recurring price
        price = stripe.Price.create(
            product=product.id,
            unit_amount=int(plan_config["price"] * 100),  # Convert to cents
            currency="eur",
            recurring={
                "interval": plan_config["interval"],
                "interval_count": plan_config["interval_count"]
            },
            metadata={
                "plan_id": plan_id,
                "tier": plan_config["tier"]
            }
        )
        
        # Store price ID in database
        await db.stripe_prices.insert_one({
            "plan_id": plan_id,
            "stripe_price_id": price.id,
            "tier": plan_config["tier"],
            "interval": plan_config["interval"],
            "amount": plan_config["price"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logging.info(f"Created Stripe Price: {price.id} for plan {plan_id}")
        return price.id
    except Exception as e:
        logging.error(f"Error creating Stripe price: {str(e)}")
        raise

@api_router.post("/subscriptions/create-checkout-session")
async def create_checkout_session(request: CheckoutRequest, http_request: Request):
    """Create a Stripe Checkout session for subscription"""
    import stripe
    
    # Validate plan
    if request.plan_id not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan ID")
    
    plan = SUBSCRIPTION_PLANS[request.plan_id]
    
    # Get Stripe API key
    stripe_secret_key = os.environ.get('STRIPE_SECRET_KEY')
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = stripe_secret_key
    
    # Get or create Stripe Price ID
    try:
        stripe_price_id = await get_or_create_stripe_price(request.plan_id, plan, stripe_secret_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get price: {str(e)}")
    
    # Build success and cancel URLs
    origin_url = request.origin_url.rstrip('/')
    success_url = f"{origin_url}/dashboard/account?session_id={{CHECKOUT_SESSION_ID}}&success=true"
    cancel_url = f"{origin_url}/pricing?canceled=true"
    
    try:
        # Create Stripe Checkout Session for subscription
        checkout_session = stripe.checkout.Session.create(
            mode='subscription',  # IMPORTANT: subscription mode for recurring payments
            line_items=[{
                'price': stripe_price_id,
                'quantity': 1,
            }],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "plan_id": request.plan_id,
                "tier": plan["tier"],
                "interval": plan["interval"],
                "athlete_id": request.athlete_id
            }
        )
        
        # Create payment transaction record
        transaction = {
            "id": str(uuid.uuid4()),
            "session_id": checkout_session.id,
            "athlete_id": request.athlete_id,
            "plan_id": request.plan_id,
            "tier": plan["tier"],
            "interval": plan["interval"],
            "amount": plan["price"],
            "currency": "eur",
            "payment_status": "pending",
            "status": "initiated",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction)
        
        return {"url": checkout_session.url, "session_id": checkout_session.id}
    except Exception as e:
        logging.error(f"Error creating checkout session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")

@api_router.get("/subscriptions/checkout-status/{session_id}")
async def get_checkout_status(session_id: str):
    """Get the status of a checkout session"""
    import stripe
    
    # Get Stripe API key
    stripe_secret_key = os.environ.get('STRIPE_SECRET_KEY')
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = stripe_secret_key
    
    try:
        # Retrieve checkout session from Stripe
        checkout_session = stripe.checkout.Session.retrieve(session_id)
        
        # Update transaction in database
        transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        
        if transaction:
            # Only process if not already completed
            if transaction.get("payment_status") != "paid":
                update_data = {
                    "status": checkout_session.status,
                    "payment_status": checkout_session.payment_status,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                
                # If payment succeeded, update athlete subscription
                if checkout_session.payment_status == "paid":
                    # Get athlete_id from transaction (we stored it there)
                    athlete_id = transaction.get("athlete_id")
                    if athlete_id:
                        # Get subscription from Stripe
                        subscription_id = checkout_session.subscription
                        
                        # Calculate subscription end date
                        period_days = 30 if transaction["interval"] == "month" else 365
                        period_end = datetime.now(timezone.utc) + timedelta(days=period_days)
                        
                        await db.athlete_profiles.update_one(
                            {"id": athlete_id},
                            {"$set": {
                                "subscription_tier": transaction["tier"],
                                "subscription_status": "active",
                                "subscription_interval": transaction["interval"],
                                "stripe_customer_id": checkout_session.customer,
                                "stripe_subscription_id": subscription_id,
                                "subscription_current_period_end": period_end.isoformat()
                            }}
                        )
                        logging.info(f"Updated subscription for athlete {athlete_id} to {transaction['tier']}")
                
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": update_data}
                )
        
        return {
            "status": checkout_session.status,
            "payment_status": checkout_session.payment_status,
            "amount_total": checkout_session.amount_total,
            "currency": checkout_session.currency,
            "metadata": checkout_session.metadata
        }
    except Exception as e:
        logging.error(f"Error checking checkout status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to check status: {str(e)}")

@api_router.get("/subscriptions/status/{athlete_id}")
async def get_subscription_status(athlete_id: str):
    """Get athlete's subscription status"""
    import stripe
    
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    # Get subscription interval from database first, fallback to Stripe if not available
    subscription_interval = athlete.get("subscription_interval")
    stripe_subscription_id = athlete.get("stripe_subscription_id")
    
    # If interval not in DB and there's an active subscription, try to get it from Stripe
    if not subscription_interval and stripe_subscription_id and athlete.get("subscription_tier") != "free":
        try:
            stripe_secret_key = os.environ.get('STRIPE_SECRET_KEY')
            if stripe_secret_key:
                stripe.api_key = stripe_secret_key
                subscription = stripe.Subscription.retrieve(stripe_subscription_id)
                # Get the interval from the subscription price
                if subscription.get('items') and hasattr(subscription.get('items'), 'data'):
                    items_data = subscription['items'].data
                    if items_data and len(items_data) > 0:
                        price = items_data[0].get('price')
                        if price and price.get('recurring'):
                            subscription_interval = price['recurring'].get('interval')
                            # Store it in database for next time
                            await db.athlete_profiles.update_one(
                                {"id": athlete_id},
                                {"$set": {"subscription_interval": subscription_interval}}
                            )
        except Exception as e:
            logging.warning(f"Could not fetch subscription interval: {str(e)}")
    
    return {
        "subscription_tier": athlete.get("subscription_tier", "free"),
        "subscription_status": athlete.get("subscription_status", "active"),
        "stripe_customer_id": athlete.get("stripe_customer_id"),
        "stripe_subscription_id": stripe_subscription_id,
        "subscription_current_period_end": athlete.get("subscription_current_period_end"),
        "subscription_interval": subscription_interval
    }

@api_router.post("/subscriptions/create-portal-session")
async def create_portal_session(request: dict):
    """Create a Stripe Customer Portal session for managing subscriptions"""
    import stripe
    
    athlete_id = request.get("athlete_id")
    return_url = request.get("return_url")
    
    if not athlete_id or not return_url:
        raise HTTPException(status_code=400, detail="athlete_id and return_url are required")
    
    # Get athlete
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    stripe_customer_id = athlete.get("stripe_customer_id")
    if not stripe_customer_id:
        raise HTTPException(status_code=400, detail="No active subscription found")
    
    # Get Stripe API key
    stripe_secret_key = os.environ.get('STRIPE_SECRET_KEY')
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = stripe_secret_key
    
    try:
        # Create Customer Portal session
        portal_session = stripe.billing_portal.Session.create(
            customer=stripe_customer_id,
            return_url=return_url,
        )
        
        return {"url": portal_session.url}
    except Exception as e:
        logging.error(f"Error creating portal session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create portal session: {str(e)}")

@api_router.get("/subscriptions/invoices/{athlete_id}")
async def get_invoices(athlete_id: str):
    """Get list of invoices for an athlete"""
    import stripe
    
    # Get athlete
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    stripe_customer_id = athlete.get("stripe_customer_id")
    if not stripe_customer_id:
        return {"invoices": []}
    
    # Get Stripe API key
    stripe_secret_key = os.environ.get('STRIPE_SECRET_KEY')
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = stripe_secret_key
    
    try:
        # Fetch invoices from Stripe
        invoices = stripe.Invoice.list(
            customer=stripe_customer_id,
            limit=10
        )
        
        # Format invoice data
        invoice_list = []
        for invoice in invoices.data:
            invoice_list.append({
                "id": invoice.id,
                "amount": invoice.amount_paid / 100,  # Convert from cents
                "currency": invoice.currency.upper(),
                "status": invoice.status,
                "created": invoice.created,
                "invoice_pdf": invoice.invoice_pdf,
                "hosted_invoice_url": invoice.hosted_invoice_url,
                "period_start": invoice.period_start,
                "period_end": invoice.period_end
            })
        
        return {"invoices": invoice_list}
    except Exception as e:
        logging.error(f"Error fetching invoices: {str(e)}")
        # Return empty list on error instead of failing
        return {"invoices": []}

@api_router.post("/subscriptions/cancel")
async def cancel_subscription(request: dict):
    """Cancel a user's subscription"""
    import stripe
    
    athlete_id = request.get("athlete_id")
    if not athlete_id:
        raise HTTPException(status_code=400, detail="athlete_id is required")
    
    # Get athlete
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    stripe_subscription_id = athlete.get("stripe_subscription_id")
    if not stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription found")
    
    # Get Stripe API key
    stripe_secret_key = os.environ.get('STRIPE_SECRET_KEY')
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = stripe_secret_key
    
    try:
        # Cancel the subscription at period end (not immediately)
        subscription = stripe.Subscription.modify(
            stripe_subscription_id,
            cancel_at_period_end=True
        )
        
        # Update athlete profile
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": {
                "subscription_status": "canceling",
                "subscription_cancel_at": subscription.cancel_at
            }}
        )
        
        return {
            "success": True,
            "message": "Subscription will be canceled at the end of the current billing period",
            "cancel_at": subscription.cancel_at
        }
    except Exception as e:
        logging.error(f"Error canceling subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel subscription: {str(e)}")

@api_router.post("/subscriptions/update-plan")
async def update_subscription_plan(request: dict):
    """Update (downgrade or upgrade) a subscription plan"""
    import stripe
    
    athlete_id = request.get("athlete_id")
    new_plan_id = request.get("new_plan_id")  # e.g., 'pro_monthly', 'premium_annual'
    
    if not athlete_id or not new_plan_id:
        raise HTTPException(status_code=400, detail="athlete_id and new_plan_id are required")
    
    if new_plan_id not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan ID")
    
    # Get athlete
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    stripe_subscription_id = athlete.get("stripe_subscription_id")
    if not stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription found")
    
    # Get Stripe API key
    stripe_secret_key = os.environ.get('STRIPE_SECRET_KEY')
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = stripe_secret_key
    
    try:
        # Get current subscription
        subscription = stripe.Subscription.retrieve(stripe_subscription_id)
        
        # Get or create new price ID
        new_plan = SUBSCRIPTION_PLANS[new_plan_id]
        new_price_id = await get_or_create_stripe_price(new_plan_id, new_plan, stripe_secret_key)
        
        # Update subscription with new price
        updated_subscription = stripe.Subscription.modify(
            stripe_subscription_id,
            items=[{
                'id': subscription['items']['data'][0].id,
                'price': new_price_id,
            }],
            proration_behavior='create_prorations'  # Prorate charges
        )
        
        # Update athlete profile with new interval info
        # Get actual period end from Stripe subscription
        actual_period_end = datetime.fromtimestamp(updated_subscription.current_period_end, timezone.utc)
        
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": {
                "subscription_tier": new_plan["tier"],
                "subscription_status": "active",
                "subscription_interval": new_plan["interval"],
                "subscription_current_period_end": actual_period_end.isoformat()
            }}
        )
        
        return {
            "success": True,
            "message": f"Subscription updated to {new_plan['tier']} plan",
            "new_tier": new_plan["tier"]
        }
    except Exception as e:
        logging.error(f"Error updating subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update subscription: {str(e)}")

@api_router.post("/subscriptions/downgrade-to-free")
async def downgrade_to_free(request: dict):
    """Downgrade subscription to free plan (cancel subscription)"""
    import stripe
    
    athlete_id = request.get("athlete_id")
    if not athlete_id:
        raise HTTPException(status_code=400, detail="athlete_id is required")
    
    # Get athlete
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    stripe_subscription_id = athlete.get("stripe_subscription_id")
    if not stripe_subscription_id:
        # Already on free plan
        return {"success": True, "message": "Already on free plan"}
    
    # Get Stripe API key
    stripe_secret_key = os.environ.get('STRIPE_SECRET_KEY')
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = stripe_secret_key
    
    try:
        # Cancel the subscription at period end
        subscription = stripe.Subscription.modify(
            stripe_subscription_id,
            cancel_at_period_end=True
        )
        
        # Update athlete profile - keep tier until period ends
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": {
                "subscription_status": "canceling"
            }}
        )
        
        return {
            "success": True,
            "message": "You will be downgraded to free plan at the end of your current billing period",
            "downgrade_at": subscription.cancel_at
        }
    except Exception as e:
        logging.error(f"Error downgrading to free: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to downgrade: {str(e)}")

@api_router.post("/subscriptions/reactivate")
async def reactivate_subscription(request: dict):
    """Reactivate a canceled subscription (undo cancellation)"""
    import stripe
    
    athlete_id = request.get("athlete_id")
    if not athlete_id:
        raise HTTPException(status_code=400, detail="athlete_id is required")
    
    # Get athlete
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    stripe_subscription_id = athlete.get("stripe_subscription_id")
    if not stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No subscription found")
    
    # Get Stripe API key
    stripe_secret_key = os.environ.get('STRIPE_SECRET_KEY')
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = stripe_secret_key
    
    try:
        # Remove cancel_at_period_end to reactivate
        subscription = stripe.Subscription.modify(
            stripe_subscription_id,
            cancel_at_period_end=False
        )
        
        # Update athlete profile back to active
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": {
                "subscription_status": "active"
            }}
        )
        
        return {
            "success": True,
            "message": "Subscription reactivated successfully! Your subscription will continue as normal."
        }
    except Exception as e:
        logging.error(f"Error reactivating subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reactivate subscription: {str(e)}")

# Journal routes
@api_router.get("/journal/{athlete_id}")
async def get_journal_entries(athlete_id: str):
    """Get all journal entries for an athlete"""
    entries = await db.journal_entries.find(
        {"athlete_id": athlete_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=None)
    
    return {"entries": [parse_from_mongo(entry) for entry in entries]}

@api_router.post("/journal")
async def create_journal_entry(entry: JournalEntry):
    """Create a new journal entry"""
    entry_dict = prepare_for_mongo(entry.model_dump())
    await db.journal_entries.insert_one(entry_dict)
    return {"success": True, "id": entry.id}

@api_router.put("/journal/{entry_id}")
async def update_journal_entry(entry_id: str, content: dict):
    """Update a journal entry"""
    update_data = {
        "content": content.get("content"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.journal_entries.update_one(
        {"id": entry_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    
    return {"success": True}

@api_router.delete("/journal/{entry_id}")
async def delete_journal_entry(entry_id: str):
    """Delete a journal entry"""
    result = await db.journal_entries.delete_one({"id": entry_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    
    return {"success": True}

@api_router.post("/journal/transcribe/{athlete_id}")
async def transcribe_audio(athlete_id: str, audio: UploadFile = File(...)):
    """Transcribe audio to text using OpenAI Whisper"""
    import openai
    
    try:
        # Get OpenAI API key for the athlete
        openai_key = await ai_coach.get_user_openai_key(athlete_id)
        if not openai_key:
            raise HTTPException(status_code=400, detail="OpenAI API key required for voice transcription. Please configure your API key in Account Settings.")
        
        # Read audio file
        audio_content = await audio.read()
        
        # Create OpenAI client
        client = openai.OpenAI(api_key=openai_key)
        
        # Transcribe using Whisper
        # Create a file-like object from the audio content
        audio_file = io.BytesIO(audio_content)
        audio_file.name = audio.filename or "audio.wav"
        
        transcription = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="text"
        )
        
        return {"transcription": transcription}
        
    except openai.OpenAIError as e:
        error_message = str(e)
        if "invalid_api_key" in error_message.lower() or "incorrect api key" in error_message.lower():
            raise HTTPException(status_code=400, detail="Invalid OpenAI API key. Please update your API key in Account Settings.")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {error_message}")
    except Exception as e:
        logging.error(f"Error transcribing audio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to transcribe audio: {str(e)}")

# Nutrition routes
@api_router.get("/nutrition/{athlete_id}")
async def get_nutrition_entries(athlete_id: str):
    """Get all nutrition entries for an athlete"""
    entries = await db.nutrition_entries.find(
        {"athlete_id": athlete_id},
        {"_id": 0}
    ).to_list(length=None)
    
    # Parse entries and sort by entry_date and entry_time (most recent first)
    parsed_entries = [parse_from_mongo(entry) for entry in entries]
    
    def sort_key(entry):
        # Create sortable datetime from entry_date and entry_time
        # If not provided, use created_at
        if entry.get('entry_date') and entry.get('entry_time'):
            try:
                date_str = entry['entry_date']
                time_str = entry['entry_time']
                datetime_str = f"{date_str} {time_str}"
                # Make timezone-aware by adding UTC timezone
                dt = datetime.strptime(datetime_str, "%Y-%m-%d %H:%M")
                return dt.replace(tzinfo=timezone.utc)
            except:
                pass
        # Fallback to created_at
        if isinstance(entry.get('created_at'), str):
            try:
                return datetime.fromisoformat(entry['created_at'].replace('Z', '+00:00'))
            except:
                pass
        elif isinstance(entry.get('created_at'), datetime):
            # If already a datetime object, ensure it's timezone-aware
            dt = entry['created_at']
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt
        # Default to epoch (oldest possible)
        return datetime.min.replace(tzinfo=timezone.utc)
    
    parsed_entries.sort(key=sort_key, reverse=True)
    
    return {"entries": parsed_entries}

@api_router.post("/nutrition")
async def create_nutrition_entry(entry: NutritionEntry):
    """Create a new nutrition entry"""
    entry_dict = prepare_for_mongo(entry.model_dump())
    await db.nutrition_entries.insert_one(entry_dict)
    return {"success": True, "id": entry.id}

@api_router.put("/nutrition/{entry_id}")
async def update_nutrition_entry(entry_id: str, data: dict):
    """Update a nutrition entry"""
    update_data = {
        "description": data.get("description"),
        "meal_type": data.get("meal_type"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if "image_data" in data:
        update_data["image_data"] = data["image_data"]
    
    if "entry_date" in data:
        update_data["entry_date"] = data["entry_date"]
    
    if "entry_time" in data:
        update_data["entry_time"] = data["entry_time"]
    
    # Include macronutrients if provided
    if "calories" in data:
        update_data["calories"] = data["calories"]
    if "protein" in data:
        update_data["protein"] = data["protein"]
    if "carbs" in data:
        update_data["carbs"] = data["carbs"]
    if "fat" in data:
        update_data["fat"] = data["fat"]
    if "ai_analysis" in data:
        update_data["ai_analysis"] = data["ai_analysis"]
    
    # Include micronutrients if provided
    if "fiber" in data:
        update_data["fiber"] = data["fiber"]
    if "sodium" in data:
        update_data["sodium"] = data["sodium"]
    if "sugar" in data:
        update_data["sugar"] = data["sugar"]
    if "vitamin_a" in data:
        update_data["vitamin_a"] = data["vitamin_a"]
    if "vitamin_c" in data:
        update_data["vitamin_c"] = data["vitamin_c"]
    if "vitamin_d" in data:
        update_data["vitamin_d"] = data["vitamin_d"]
    if "calcium" in data:
        update_data["calcium"] = data["calcium"]
    if "iron" in data:
        update_data["iron"] = data["iron"]
    if "potassium" in data:
        update_data["potassium"] = data["potassium"]
    
    result = await db.nutrition_entries.update_one(
        {"id": entry_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Nutrition entry not found")
    
    return {"success": True}

@api_router.delete("/nutrition/{entry_id}")
async def delete_nutrition_entry(entry_id: str):
    """Delete a nutrition entry"""
    result = await db.nutrition_entries.delete_one({"id": entry_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Nutrition entry not found")
    
    return {"success": True}

@api_router.post("/nutrition/analyze-image/{athlete_id}")
async def analyze_food_image(athlete_id: str, request: dict):
    """Analyze food image using OpenAI Vision API to estimate nutritional content"""
    import openai
    
    try:
        # Get OpenAI API key for the athlete
        openai_key = await ai_coach.get_user_openai_key(athlete_id)
        if not openai_key:
            raise HTTPException(status_code=400, detail="OpenAI API key required for food analysis. Please configure your API key in Account Settings.")
        
        # Create OpenAI client
        client = openai.OpenAI(api_key=openai_key)
        
        # Get the base64 image data and optional description
        base64_image = request.get("image_data", "")
        user_description = request.get("description", "")
        
        if not base64_image:
            raise HTTPException(status_code=400, detail="No image data provided")
        
        # Create the prompt for nutritional analysis
        description_context = f"\n\nUser's description: {user_description}" if user_description else ""
        
        prompt = f"""Analyze this food image and provide a detailed nutritional estimate.{description_context}
        
Please provide:
MACRONUTRIENTS:
1. Estimated total calories
2. Protein (in grams)
3. Carbohydrates (in grams)
4. Fat (in grams)

MICRONUTRIENTS (estimate if possible, use 0 if uncertain):
5. Fiber (in grams)
6. Sodium (in milligrams)
7. Sugar (in grams)
8. Vitamin A (in micrograms)
9. Vitamin C (in milligrams)
10. Vitamin D (in micrograms)
11. Calcium (in milligrams)
12. Iron (in milligrams)
13. Potassium (in milligrams)

14. A brief description of the food items you can see

{f"The user described it as: '{user_description}'. Use this to help with your analysis." if user_description else ""}

Format your response as JSON with these exact keys:
{{
  "calories": <number>,
  "protein": <number>,
  "carbs": <number>,
  "fat": <number>,
  "fiber": <number>,
  "sodium": <number>,
  "sugar": <number>,
  "vitamin_a": <number>,
  "vitamin_c": <number>,
  "vitamin_d": <number>,
  "calcium": <number>,
  "iron": <number>,
  "potassium": <number>,
  "description": "<brief description>"
}}

Be as accurate as possible based on visible portion sizes{" and the user's description" if user_description else ""}. Use 0 for micronutrients if you cannot accurately estimate them. If you cannot see the food clearly or if it's not a food image, return all values as 0 and mention this in the description."""

        # Call OpenAI Vision API
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": base64_image
                            }
                        }
                    ]
                }
            ],
            max_tokens=500
        )
        
        # Parse the response
        analysis_text = response.choices[0].message.content
        
        # Try to extract JSON from the response
        import json
        import re
        
        # Look for JSON in the response
        json_match = re.search(r'\{[^{}]*\}', analysis_text, re.DOTALL)
        if json_match:
            nutrition_data = json.loads(json_match.group())
        else:
            # If no JSON found, try to parse the whole response
            try:
                nutrition_data = json.loads(analysis_text)
            except:
                # Fallback: return a default response
                nutrition_data = {
                    "calories": 0,
                    "protein": 0,
                    "carbs": 0,
                    "fat": 0,
                    "fiber": 0,
                    "sodium": 0,
                    "sugar": 0,
                    "vitamin_a": 0,
                    "vitamin_c": 0,
                    "vitamin_d": 0,
                    "calcium": 0,
                    "iron": 0,
                    "potassium": 0,
                    "description": "Unable to analyze image"
                }
        
        return {
            "calories": int(nutrition_data.get("calories", 0)),
            "protein": float(nutrition_data.get("protein", 0)),
            "carbs": float(nutrition_data.get("carbs", 0)),
            "fat": float(nutrition_data.get("fat", 0)),
            "fiber": float(nutrition_data.get("fiber", 0)),
            "sodium": float(nutrition_data.get("sodium", 0)),
            "sugar": float(nutrition_data.get("sugar", 0)),
            "vitamin_a": float(nutrition_data.get("vitamin_a", 0)),
            "vitamin_c": float(nutrition_data.get("vitamin_c", 0)),
            "vitamin_d": float(nutrition_data.get("vitamin_d", 0)),
            "calcium": float(nutrition_data.get("calcium", 0)),
            "iron": float(nutrition_data.get("iron", 0)),
            "potassium": float(nutrition_data.get("potassium", 0)),
            "ai_analysis": nutrition_data.get("description", "")
        }
        
    except openai.OpenAIError as e:
        error_message = str(e)
        if "invalid_api_key" in error_message.lower() or "incorrect api key" in error_message.lower():
            raise HTTPException(status_code=400, detail="Invalid OpenAI API key. Please update your API key in Account Settings.")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {error_message}")
    except Exception as e:
        logging.error(f"Error analyzing food image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze food image: {str(e)}")

# Supplement routes
@api_router.get("/supplements/{athlete_id}")
async def get_supplements(athlete_id: str):
    """Get all supplements for an athlete"""
    supplements = await db.supplements.find(
        {"athlete_id": athlete_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=None)
    
    return {"supplements": [parse_from_mongo(supp) for supp in supplements]}

@api_router.post("/supplements")
async def create_supplement(supplement: Supplement):
    """Create a new supplement entry"""
    supplement_dict = prepare_for_mongo(supplement.model_dump())
    await db.supplements.insert_one(supplement_dict)
    return {"success": True, "id": supplement.id}

@api_router.put("/supplements/{supplement_id}")
async def update_supplement(supplement_id: str, data: dict):
    """Update a supplement entry"""
    update_data = {k: v for k, v in data.items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data = prepare_for_mongo(update_data)
    
    result = await db.supplements.update_one(
        {"id": supplement_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supplement not found")
    
    return {"success": True}

@api_router.delete("/supplements/{supplement_id}")
async def delete_supplement(supplement_id: str):
    """Delete a supplement entry"""
    result = await db.supplements.delete_one({"id": supplement_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplement not found")
    
    return {"success": True}

# Document routes
@api_router.get("/documents/{athlete_id}")
async def get_documents(athlete_id: str, category: Optional[str] = None):
    """Get all documents for an athlete, optionally filtered by category"""
    query = {"athlete_id": athlete_id}
    if category:
        query["category"] = category
    
    documents = await db.documents.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=None)
    
    return {"documents": [parse_from_mongo(doc) for doc in documents]}

@api_router.post("/documents")
async def create_document(document: Document):
    """Create a new document"""
    document_dict = prepare_for_mongo(document.model_dump())
    await db.documents.insert_one(document_dict)
    return {"success": True, "id": document.id}

@api_router.put("/documents/{document_id}")
async def update_document(document_id: str, data: dict):
    """Update a document"""
    update_data = {
        "title": data.get("title"),
        "category": data.get("category"),
        "description": data.get("description"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Remove None values
    update_data = {k: v for k, v in update_data.items() if v is not None}
    
    result = await db.documents.update_one(
        {"id": document_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"success": True}

@api_router.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    """Delete a document"""
    result = await db.documents.delete_one({"id": document_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"success": True}

# Test Results routes
@api_router.get("/test-results/{athlete_id}")
async def get_test_results(athlete_id: str, test_name: Optional[str] = None):
    """Get all test results for an athlete, optionally filtered by test name"""
    query = {"athlete_id": athlete_id}
    if test_name:
        query["test_name"] = test_name
    
    results = await db.test_results.find(
        query,
        {"_id": 0}
    ).sort("test_date", 1).to_list(length=None)
    
    return {"results": [parse_from_mongo(result) for result in results]}

@api_router.get("/test-results/{athlete_id}/test-names")
async def get_test_names(athlete_id: str):
    """Get unique test names for an athlete"""
    results = await db.test_results.find(
        {"athlete_id": athlete_id},
        {"test_name": 1, "_id": 0}
    ).to_list(length=None)
    
    unique_names = list(set([r["test_name"] for r in results]))
    return {"test_names": sorted(unique_names)}

@api_router.post("/test-results")
async def create_test_result(result: TestResult):
    """Create a new test result"""
    result_dict = prepare_for_mongo(result.model_dump())
    await db.test_results.insert_one(result_dict)
    return {"success": True, "id": result.id}

@api_router.put("/test-results/{result_id}")
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

@api_router.delete("/test-results/{result_id}")
async def delete_test_result(result_id: str):
    """Delete a test result"""
    result = await db.test_results.delete_one({"id": result_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Test result not found")
    
    return {"success": True}

# Training Calendar routes
@api_router.get("/training-calendar/{athlete_id}")
async def get_training_blocks(athlete_id: str):
    """Get all training blocks for an athlete"""
    blocks = await db.training_blocks.find(
        {"athlete_id": athlete_id},
        {"_id": 0}
    ).sort("start_date", 1).to_list(length=None)
    
    return {"blocks": [parse_from_mongo(block) for block in blocks]}

@api_router.post("/training-calendar")
async def create_training_block(block: TrainingBlock):
    """Create a new training block"""
    # Get athlete's unit preference and set unit_system accordingly
    athlete = await db.athlete_profiles.find_one({"id": block.athlete_id}, {"_id": 0})
    unit_system = athlete.get("distance_unit", "miles") if athlete else "miles"
    
    # Override the unit_system with athlete's preference
    block.unit_system = unit_system
    
    block_dict = prepare_for_mongo(block.model_dump())
    await db.training_blocks.insert_one(block_dict)
    return {"success": True, "id": block.id}

@api_router.put("/training-calendar/{block_id}")
async def update_training_block(block_id: str, data: dict):
    """Update a training block"""
    # Get the existing training block to find the athlete_id
    existing_block = await db.training_blocks.find_one({"id": block_id}, {"_id": 0})
    if not existing_block:
        raise HTTPException(status_code=404, detail="Training block not found")
    
    athlete_id = existing_block.get("athlete_id")
    
    # Get athlete's unit preference if distance-related fields are being updated
    unit_system = data.get("unit_system")
    if not unit_system and any(key in data for key in ["distance", "interval_distance", "pace_per_unit", "interval_pace"]):
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        unit_system = athlete.get("distance_unit", "miles") if athlete else "miles"
    
    update_data = {
        "title": data.get("title"),
        "description": data.get("description"),
        "block_type": data.get("block_type"),
        "start_date": data.get("start_date"),
        "end_date": data.get("end_date"),
        "workout_type": data.get("workout_type"),
        "distance": data.get("distance"),
        "duration_minutes": data.get("duration_minutes"),
        "pace_per_unit": data.get("pace_per_unit"),
        "intervals": data.get("intervals"),
        "interval_distance": data.get("interval_distance"),
        "interval_pace": data.get("interval_pace"),
        "rest_duration": data.get("rest_duration"),
        "unit_system": unit_system or existing_block.get("unit_system", "miles"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Remove None values to avoid overwriting existing data with None
    update_data = {k: v for k, v in update_data.items() if v is not None}
    
    result = await db.training_blocks.update_one(
        {"id": block_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Training block not found")
    
    return {"success": True}

@api_router.get("/training-calendar/{athlete_id}/weekly-summary")
async def get_weekly_summary(athlete_id: str, year: int = Query(2025), month: int = Query(1)):
    """Get weekly training summaries for a given month"""
    from datetime import datetime, timedelta
    import calendar
    
    # Get all days in the month
    _, num_days = calendar.monthrange(year, month)
    month_start = datetime(year, month, 1)
    month_end = datetime(year, month, num_days)
    
    # Query all training blocks for this month
    blocks = await db.training_blocks.find(
        {
            "athlete_id": athlete_id,
            "$or": [
                {
                    "start_date": {
                        "$gte": month_start.strftime("%Y-%m-%d"),
                        "$lte": month_end.strftime("%Y-%m-%d")
                    }
                },
                {
                    "end_date": {
                        "$gte": month_start.strftime("%Y-%m-%d"),
                        "$lte": month_end.strftime("%Y-%m-%d")
                    }
                }
            ]
        },
        {"_id": 0}
    ).to_list(length=None)
    
    # Group blocks by week
    weeks = {}
    for block in blocks:
        start_date_str = block.get("start_date")
        if not start_date_str or start_date_str == "None":
            continue
            
        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
            # Get the Monday of the week this date is in
            week_start = start_date - timedelta(days=start_date.weekday())
            week_key = week_start.strftime("%Y-%m-%d")
            
            if week_key not in weeks:
                weeks[week_key] = {
                    "week_start": week_start.strftime("%Y-%m-%d"),
                    "week_end": (week_start + timedelta(days=6)).strftime("%Y-%m-%d"),
                    "total_distance": 0,
                    "total_duration": 0,
                    "workout_count": 0,
                    "blocks": []
                }
            
            weeks[week_key]["blocks"].append(parse_from_mongo(block))
            weeks[week_key]["total_distance"] += block.get("distance", 0) or 0
            weeks[week_key]["total_duration"] += block.get("duration_minutes", 0) or 0
            if block.get("workout_type"):
                weeks[week_key]["workout_count"] += 1
        except ValueError:
            continue
    
    # Return sorted weeks
    return sorted(weeks.values(), key=lambda x: x["week_start"])

@api_router.delete("/training-calendar/{block_id}")
async def delete_training_block(block_id: str):
    """Delete a training block"""
    result = await db.training_blocks.delete_one({"id": block_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Training block not found")
    
    return {"success": True}

@api_router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    # Get Stripe API key
    stripe_secret_key = os.environ.get('STRIPE_SECRET_KEY')
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    # Get raw body and signature
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    if not signature:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")
    
    # Initialize Stripe Checkout
    stripe_checkout = StripeCheckout(api_key=stripe_secret_key, webhook_url="")
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Handle different event types
        if webhook_response.event_type == "checkout.session.completed":
            # Update payment transaction
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {
                    "payment_status": webhook_response.payment_status,
                    "event_id": webhook_response.event_id,
                    "webhook_received_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Update athlete subscription if athlete_id in metadata
            athlete_id = webhook_response.metadata.get("athlete_id")
            if athlete_id:
                transaction = await db.payment_transactions.find_one({"session_id": webhook_response.session_id}, {"_id": 0})
                if transaction:
                    await db.athlete_profiles.update_one(
                        {"id": athlete_id},
                        {"$set": {
                            "subscription_tier": transaction["tier"],
                            "subscription_status": "active",
                            "subscription_current_period_end": datetime.now(timezone.utc) + timedelta(days=30 if transaction["interval"] == "month" else 365)
                        }}
                    )
        
        return {"status": "success", "event_id": webhook_response.event_id}
    except Exception as e:
        logging.error(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

# Integration routes
@api_router.post("/integrations/openai/{athlete_id}")
async def save_openai_key(athlete_id: str, key_request: APIKeyRequest):
    """Save OpenAI API key for athlete"""
    try:
        logger.info(f"Saving OpenAI API key for athlete: {athlete_id}")
        logger.info(f"API key prefix: {key_request.api_key[:10]}...")
        
        # Validate the API key format (supports both legacy 'sk-' and project-based 'sk-proj-' keys)
        if not (key_request.api_key.startswith('sk-') or key_request.api_key.startswith('sk-proj-')):
            logger.error(f"Invalid API key format. Key starts with: {key_request.api_key[:5]}")
            raise HTTPException(status_code=400, detail="Invalid OpenAI API key format")
        
        logger.info("API key format validation passed")
        
        # Test the API key by making a simple API call to OpenAI
        logger.info("Testing API key with OpenAI...")
        try:
            from openai import OpenAI
            test_client = OpenAI(api_key=key_request.api_key)
            # Make a minimal API call to verify the key works
            test_client.models.list()
            logger.info("✅ API key validated successfully with OpenAI")
        except Exception as validation_error:
            logger.error(f"❌ API key validation failed: {str(validation_error)}")
            error_message = str(validation_error)
            if "Incorrect API key" in error_message or "invalid" in error_message.lower():
                raise HTTPException(status_code=400, detail="Invalid OpenAI API key. Please check your key and try again.")
            elif "quota" in error_message.lower():
                raise HTTPException(status_code=400, detail="OpenAI API key has exceeded quota. Please check your OpenAI account.")
            else:
                raise HTTPException(status_code=400, detail=f"Failed to validate OpenAI API key: {error_message}")
        
        logger.info("Saving validated API key to database")
        
        # TODO: Encrypt the API key before storing in production
        integration = Integration(
            athlete_id=athlete_id,
            integration_type="openai",
            credentials={"api_key": key_request.api_key},  # Should be encrypted in production
            settings={"model": "gpt-4", "max_tokens": 2000}
        )
        
        # Upsert integration
        await db.integrations.update_one(
            {"athlete_id": athlete_id, "integration_type": "openai"},
            {"$set": prepare_for_mongo(integration.model_dump())},
            upsert=True
        )
        
        logger.info(f"OpenAI API key saved successfully for athlete: {athlete_id}")
        return {"message": "OpenAI API key saved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving OpenAI API key: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save API key: {str(e)}")

@api_router.get("/integrations/{athlete_id}")
async def get_athlete_integrations(athlete_id: str):
    """Get all integrations for an athlete"""
    integrations = await db.integrations.find(
        {"athlete_id": athlete_id, "is_active": True},
        {"_id": 0, "credentials": 0}  # Don't return sensitive credentials
    ).to_list(length=None)
    
    return {"integrations": [parse_from_mongo(i) for i in integrations]}

@api_router.delete("/integrations/{athlete_id}/{integration_type}")
async def disconnect_integration(athlete_id: str, integration_type: str):
    """Disconnect/deactivate an integration"""
    result = await db.integrations.update_one(
        {"athlete_id": athlete_id, "integration_type": integration_type},
        {"$set": {"is_active": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    return {"message": f"{integration_type.capitalize()} integration disconnected"}

# Workout routes
@api_router.post("/workout", response_model=Workout)
async def log_workout(workout: Workout):
    workout_dict = prepare_for_mongo(workout.model_dump())
    await db.workouts.insert_one(workout_dict)
    return workout

@api_router.get("/workouts/{athlete_id}", response_model=List[Workout])
async def get_workouts(athlete_id: str, limit: int = 20):
    workouts = await db.workouts.find(
        {"athlete_id": athlete_id}, 
        {"_id": 0}
    ).sort("date", -1).limit(limit).to_list(length=None)
    return [parse_from_mongo(w) for w in workouts]

# Sleep data routes
@api_router.post("/sleep", response_model=SleepData)
async def log_sleep_data(sleep_data: SleepData):
    sleep_dict = prepare_for_mongo(sleep_data.model_dump())
    await db.sleep_data.insert_one(sleep_dict)
    return sleep_data

@api_router.get("/sleep/{athlete_id}", response_model=List[SleepData])
async def get_sleep_data(athlete_id: str, limit: int = 14):
    sleep_data = await db.sleep_data.find(
        {"athlete_id": athlete_id}, 
        {"_id": 0}
    ).sort("date", -1).limit(limit).to_list(length=None)
    return [parse_from_mongo(s) for s in sleep_data]

# Readiness score routes
@api_router.get("/readiness/{athlete_id}", response_model=ReadinessScore)
async def get_daily_readiness(athlete_id: str):
    # Check if we have today's readiness score
    today = datetime.now(timezone.utc).date().isoformat()
    existing = await db.readiness_scores.find_one(
        {"athlete_id": athlete_id, "date": today}, 
        {"_id": 0}
    )
    
    if existing:
        return parse_from_mongo(existing)
    
    # Calculate new readiness score
    readiness = await ai_coach.calculate_readiness_score(athlete_id)
    readiness_dict = prepare_for_mongo(readiness.model_dump())
    await db.readiness_scores.insert_one(readiness_dict)
    
    return readiness

# Merits / Personal Records routes
@api_router.get("/merits/{athlete_id}")
async def get_personal_records(athlete_id: str):
    """Get personal records for different distances"""
    
    # Define distance mappings (in meters)
    distance_map = {
        '1km': 1000,
        '1mile': 1609,  # 1 mile = 1609 meters
        '5km': 5000,
        '10km': 10000,
        'half_marathon': 21097,  # 21.0975 km
        'marathon': 42195  # 42.195 km
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
            sort=[("pace", 1)]  # Fastest pace = lowest value
        )
        
        # Find all-time best
        all_time_query = {
            "athlete_id": athlete_id,
            "distance": {"$gte": distance_meters - tolerance, "$lte": distance_meters + tolerance}
        }
        
        all_time_best_workout = await db.workouts.find_one(
            all_time_query,
            {"_id": 0},
            sort=[("pace", 1)]  # Fastest pace = lowest value
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

# AI Coach chat routes
@api_router.post("/coach/chat")
async def chat_with_ai_coach(chat_request: CoachChat):
    try:
        response = await ai_coach.chat_with_coach(
            chat_request.athlete_id, 
            chat_request.message,
            chat_request.session_id
        )
        
        # Save chat history with session ID
        chat_message = ChatMessage(
            athlete_id=chat_request.athlete_id,
            session_id=chat_request.session_id,
            message=chat_request.message,
            response=response
        )
        chat_dict = prepare_for_mongo(chat_message.model_dump())
        await db.chat_messages.insert_one(chat_dict)
        
        # Extract and store memories asynchronously (don't wait for it)
        asyncio.create_task(
            ai_coach.extract_memories(
                chat_request.athlete_id,
                chat_request.message,
                response,
                chat_request.session_id
            )
        )
        
        return {"response": response}
    except Exception as e:
        logging.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get coach response")

@api_router.get("/coach/test-search")
async def test_search(query: str = "benefits of Zone 2 training"):
    """Test endpoint to verify Tavily search is working"""
    try:
        result = await ai_coach.search_health_information(query, "training")
        return {
            "success": True,
            "query": query,
            "tavily_configured": ai_coach.tavily_client is not None,
            "result": result
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "tavily_configured": ai_coach.tavily_client is not None
        }

@api_router.get("/coach/history/{athlete_id}")
async def get_chat_history(athlete_id: str, limit: int = 20):
    messages = await db.chat_messages.find(
        {"athlete_id": athlete_id}, 
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(length=None)
    return [parse_from_mongo(m) for m in messages]

@api_router.get("/coach/conversations/{athlete_id}")
async def get_conversations(athlete_id: str, archived: Optional[bool] = None):
    """Get list of conversations grouped by session, optionally filtered by archived status"""
    match_filter = {"athlete_id": athlete_id}
    
    pipeline = [
        {"$match": match_filter},
        {"$sort": {"timestamp": -1}},
        {"$group": {
            "_id": "$session_id",
            "last_message": {"$first": "$timestamp"},
            "message_count": {"$sum": 1},
            "preview": {"$first": "$message"},
            "archived": {"$first": "$archived"}
        }},
        {"$sort": {"last_message": -1}},
        {"$limit": 50}
    ]
    
    conversations = await db.chat_messages.aggregate(pipeline).to_list(length=None)
    
    # Filter by archived status after aggregation (to handle missing archived field)
    result = []
    for conv in conversations:
        # Treat null/None/missing as False (not archived)
        is_archived = conv.get("archived") or False
        
        # Apply archived filter if specified
        if archived is not None:
            if archived == is_archived:
                result.append({
                    "session_id": conv["_id"],
                    "last_message": conv["last_message"].isoformat() if isinstance(conv["last_message"], datetime) else conv["last_message"],
                    "message_count": conv["message_count"],
                    "preview": conv["preview"][:50] + "..." if len(conv["preview"]) > 50 else conv["preview"],
                    "archived": is_archived
                })
        else:
            # No filter, return all
            result.append({
                "session_id": conv["_id"],
                "last_message": conv["last_message"].isoformat() if isinstance(conv["last_message"], datetime) else conv["last_message"],
                "message_count": conv["message_count"],
                "preview": conv["preview"][:50] + "..." if len(conv["preview"]) > 50 else conv["preview"],
                "archived": is_archived
            })
    
    return result

@api_router.get("/coach/conversation/{athlete_id}/{session_id}")
async def get_conversation(athlete_id: str, session_id: str):
    """Get all messages from a specific conversation"""
    messages = await db.chat_messages.find(
        {"athlete_id": athlete_id, "session_id": session_id}, 
        {"_id": 0}
    ).sort("timestamp", 1).to_list(length=None)
    return [parse_from_mongo(m) for m in messages]

@api_router.delete("/coach/{athlete_id}/{session_id}")
async def delete_conversation(athlete_id: str, session_id: str):
    """Delete all messages from a specific conversation"""
    result = await db.chat_messages.delete_many(
        {"athlete_id": athlete_id, "session_id": session_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {"success": True, "deleted_count": result.deleted_count}

@api_router.put("/coach/{athlete_id}/{session_id}/archive")
async def archive_conversation(athlete_id: str, session_id: str, data: dict):
    """Archive or unarchive a conversation"""
    archived = data.get("archived", True)
    
    result = await db.chat_messages.update_many(
        {"athlete_id": athlete_id, "session_id": session_id},
        {"$set": {"archived": archived}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {"success": True, "modified_count": result.modified_count, "archived": archived}

# Memory Management routes
@api_router.get("/memory/{athlete_id}")
async def get_athlete_memories(athlete_id: str):
    """Get all memories for an athlete, organized by category"""
    memories = await ai_coach.get_memories(athlete_id)
    return memories

@api_router.post("/memory/{athlete_id}")
async def create_memory(athlete_id: str, memory: AthleteMemory):
    """Manually create a memory"""
    memory.athlete_id = athlete_id
    memory_dict = prepare_for_mongo(memory.model_dump())
    await db.athlete_memories.insert_one(memory_dict)
    return {"message": "Memory created successfully", "memory_id": memory.id}

@api_router.delete("/memory/{memory_id}")
async def delete_memory(memory_id: str):
    """Delete a specific memory"""
    result = await db.athlete_memories.delete_one({"id": memory_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"message": "Memory deleted successfully"}

# OpenAI Realtime Voice API routes
@api_router.post("/coach/voice/session/{athlete_id}")
async def create_voice_session(athlete_id: str):
    """Create a new realtime voice session for the athlete"""
    try:
        # Get the realtime chat instance for this athlete (this can raise HTTPException)
        realtime_chat = await get_realtime_chat_for_athlete(athlete_id)
        
        # Get athlete context for the voice session
        context = await ai_coach.get_athlete_context(athlete_id)
        
        # Create the system message with athlete context (similar to text chat)
        athlete_info = context.get('athlete', {})
        distance_unit = athlete_info.get('distance_unit', 'miles')
        measurement_system = athlete_info.get('measurement_system', 'imperial')
        voice_preference = athlete_info.get('voice_preference', 'alloy')
        
        system_message = f"""
You are an expert endurance running coach speaking directly with your athlete via voice. You have access to their complete training and recovery data.

ATHLETE PROFILE:
- Name: {athlete_info.get('name')}
- Age: {athlete_info.get('age')}
- Goals: {athlete_info.get('running_goals', 'Not specified')}
- Preferred Units: {distance_unit} ({measurement_system})

VOICE CONVERSATION GUIDELINES:
- Keep responses conversational and natural for voice chat
- Be encouraging and personalized
- Use the athlete's name when appropriate
- Ask follow-up questions to engage them
- Keep responses concise but informative
- Always respect their unit preferences ({distance_unit})

COACHING PRINCIPLES:
- Prioritize safety and injury prevention
- Base recommendations on their actual data
- Be encouraging but realistic
- Reference specific data when relevant

You can access their training calendar, create workouts, and provide personalized coaching advice through voice conversation.
"""
        
        # Create ephemeral session for audio chat with voice preference
        # Pass voice preference to use the athlete's selected voice
        try:
            session_data = await realtime_chat.create_ephemeral_session_for_audio_chat(
                voice=voice_preference,
                system_message=system_message
            )
        except TypeError:
            # Fallback: Try with just voice parameter if system_message not supported
            try:
                session_data = await realtime_chat.create_ephemeral_session_for_audio_chat(voice=voice_preference)
            except TypeError:
                # Final fallback: Use default parameters
                session_data = await realtime_chat.create_ephemeral_session_for_audio_chat()
        
        # Debug logging removed for production
        
        # Check if the session creation returned an error (invalid API key, etc.)
        if isinstance(session_data, dict):
            # Check for direct error response (emergentintegrations format)
            if "error" in session_data:
                error_info = session_data["error"]
                error_message = error_info.get("message", "OpenAI API error")
                
                logging.warning(f"DETECTED ERROR in voice session for athlete {athlete_id}: {error_message}")
                
                # Convert OpenAI API errors to proper 400 HTTPException
                if "API key" in error_message or error_info.get("code") == "invalid_api_key":
                    logging.warning(f"Invalid OpenAI API key for athlete {athlete_id}: {error_message}")
                    raise HTTPException(status_code=400, detail="OpenAI API key required for voice chat")
                else:
                    logging.error(f"OpenAI API error for athlete {athlete_id}: {error_message}")
                    raise HTTPException(status_code=400, detail="OpenAI API error")
            
            # Check for client_secret structure
            elif "client_secret" in session_data:
                client_secret_data = session_data["client_secret"]
                # Debug logging removed for production
                
                # Check for error in the client_secret
                if isinstance(client_secret_data, dict) and "error" in client_secret_data:
                    error_info = client_secret_data["error"]
                    error_message = error_info.get("message", "OpenAI API error")
                    
                    logging.warning(f"DETECTED ERROR in client_secret for athlete {athlete_id}: {error_message}")
                    
                    # Convert OpenAI API errors to proper 400 HTTPException
                    if "API key" in error_message or error_info.get("code") == "invalid_api_key":
                        logging.warning(f"Invalid OpenAI API key for athlete {athlete_id}: {error_message}")
                        raise HTTPException(status_code=400, detail="OpenAI API key required for voice chat")
                    else:
                        logging.error(f"OpenAI API error for athlete {athlete_id}: {error_message}")
                        raise HTTPException(status_code=400, detail="OpenAI API error")
                
                # Check for valid token
                elif isinstance(client_secret_data, dict) and "value" in client_secret_data:
                    # Valid token found, return it
                    # Return in the format expected by frontend
                    return {"client_secret": {"value": client_secret_data["value"]}}
        
        logging.warning(f"Unexpected session_data structure for athlete {athlete_id}, returning raw data")
        # Fallback: return the raw session data if structure is unexpected
        return {"client_secret": session_data}
        
    except HTTPException:
        # Re-raise HTTPExceptions (like 400 for missing API key) without modification
        raise
    except Exception as e:
        logging.error(f"Voice session creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/coach/voice/negotiate/{athlete_id}")
async def negotiate_voice_connection(athlete_id: str, request: Request):
    """Negotiate WebRTC connection for voice chat"""
    try:
        # Get the realtime chat instance (this can raise HTTPException)
        realtime_chat = await get_realtime_chat_for_athlete(athlete_id)
        
        # Get the SDP offer from request body
        offer_sdp = await request.body()
        offer_sdp = offer_sdp.decode('utf-8')
        
        # Negotiate the connection
        answer_sdp = await realtime_chat.negotiate_connection(offer_sdp)
        
        # Check if negotiation returned an error
        if isinstance(answer_sdp, dict) and "error" in answer_sdp:
            error_info = answer_sdp["error"]
            error_message = error_info.get("message", "OpenAI API error")
            
            # Convert OpenAI API errors to proper 400 HTTPException
            if "API key" in error_message or error_info.get("code") == "invalid_api_key":
                logging.warning(f"Invalid OpenAI API key for athlete {athlete_id} during negotiation: {error_message}")
                raise HTTPException(status_code=400, detail="OpenAI API key required for voice chat")
            else:
                logging.error(f"OpenAI API error for athlete {athlete_id} during negotiation: {error_message}")
                raise HTTPException(status_code=400, detail="OpenAI API error")
        
        return {"sdp": answer_sdp}
        
    except HTTPException:
        # Re-raise HTTPExceptions (like 400 for missing API key) without modification
        raise
    except Exception as e:
        logging.error(f"Voice negotiation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/coach/voice/save-conversation")
async def save_voice_conversation(voice_conversation: VoiceConversation):
    """Save voice conversation transcript as chat messages"""
    try:
        logging.info(f"Saving voice conversation for athlete {voice_conversation.athlete_id}, session {voice_conversation.session_id}")
        
        # Convert voice transcript to individual chat messages
        for i, turn in enumerate(voice_conversation.transcript):
            if turn.get('role') == 'user':
                # Find the corresponding assistant response
                user_message = turn.get('content', '')
                assistant_response = ''
                
                # Look for the next assistant message
                if i + 1 < len(voice_conversation.transcript):
                    next_turn = voice_conversation.transcript[i + 1]
                    if next_turn.get('role') == 'assistant':
                        assistant_response = next_turn.get('content', '')
                
                # Save as a chat message pair (similar to text chat)
                if user_message.strip():  # Only save non-empty messages
                    chat_message = ChatMessage(
                        athlete_id=voice_conversation.athlete_id,
                        session_id=voice_conversation.session_id,
                        message=user_message,
                        response=assistant_response,
                        timestamp=turn.get('timestamp', datetime.now(timezone.utc))
                    )
                    chat_dict = prepare_for_mongo(chat_message.model_dump())
                    await db.chat_messages.insert_one(chat_dict)
                    
                    logging.info(f"Saved voice message pair: user='{user_message[:50]}...' assistant='{assistant_response[:50]}...'")
                    
                    # Extract memories from voice conversation asynchronously
                    if assistant_response:
                        asyncio.create_task(
                            ai_coach.extract_memories(
                                voice_conversation.athlete_id,
                                user_message,
                                assistant_response,
                                voice_conversation.session_id
                            )
                        )
        
        logging.info(f"Successfully saved voice conversation with {len(voice_conversation.transcript)} turns")
        return {"success": True, "message": "Voice conversation saved successfully"}
        
    except Exception as e:
        logging.error(f"Error saving voice conversation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save voice conversation: {str(e)}")

# Strava OAuth routes
@api_router.get("/auth/strava/callback")
async def strava_auth_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None)
):
    """Handle Strava OAuth callback"""
    if error:
        raise HTTPException(status_code=400, detail=f"Strava authorization failed: {error}")
    
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing authorization code or state")
    
    try:
        # Extract athlete_id from state
        athlete_id = state.split('_')[0]
        
        # Get user's Strava credentials for token exchange
        integration = await db.integrations.find_one(
            {"athlete_id": athlete_id, "integration_type": "strava"}, 
            {"_id": 0}
        )
        
        if not integration or not integration.get("credentials"):
            raise HTTPException(status_code=404, detail="Strava credentials not found")
        
        user_credentials = integration["credentials"]
        
        # Exchange code for tokens using user's credentials
        tokens = await strava_token_manager.exchange_code_for_tokens(
            code, 
            user_credentials["client_id"], 
            user_credentials["client_secret"]
        )
        
        # Store Strava integration
        integration = Integration(
            athlete_id=athlete_id,
            integration_type="strava",
            credentials={
                "access_token": tokens["access_token"],
                "refresh_token": tokens["refresh_token"],
                "expires_at": tokens["expires_at"],
                "athlete_id": tokens["athlete"]["id"]
            },
            settings={
                "auto_sync": True,
                "sync_private_activities": False
            }
        )
        
        await db.integrations.update_one(
            {"athlete_id": athlete_id, "integration_type": "strava"},
            {"$set": prepare_for_mongo(integration.model_dump())},
            upsert=True
        )
        
        # Import recent activities
        imported_count = await strava_activity_manager.import_activities_to_workouts(athlete_id)
        
        return {
            "message": "Strava connected successfully", 
            "athlete_id": athlete_id,
            "imported_activities": imported_count
        }
        
    except Exception as e:
        logging.error(f"Strava callback error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to complete Strava authorization")

@api_router.post("/integrations/strava/{athlete_id}/sync")
async def sync_strava_activities(athlete_id: str):
    """Manually sync activities from Strava"""
    try:
        imported_count = await strava_activity_manager.import_activities_to_workouts(athlete_id)
        return {"message": "Sync completed", "imported_activities": imported_count}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Strava sync error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to sync Strava activities")

@api_router.get("/integrations/strava/{athlete_id}/status")
async def get_strava_integration_status(athlete_id: str):
    """Get Strava integration status"""
    integration = await db.integrations.find_one({
        "athlete_id": athlete_id, 
        "integration_type": "strava"
    })
    
    if not integration:
        return {"connected": False, "last_sync": None}
    
    return {
        "connected": True,
        "last_sync": integration.get("last_sync"),
        "strava_athlete_id": integration["credentials"].get("athlete_id"),
        "settings": integration.get("settings", {})
    }

@api_router.post("/integrations/strava/{athlete_id}/credentials")
async def save_strava_credentials(athlete_id: str, credentials: StravaCredentials):
    """Save user-specific Strava API credentials"""
    try:
        # Encrypt sensitive data before storing
        encrypted_credentials = {
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,  # In production, encrypt this
            "access_token": credentials.access_token,    # In production, encrypt this
            "refresh_token": credentials.refresh_token   # In production, encrypt this
        }
        
        # Update or create Strava integration for this athlete
        await db.integrations.update_one(
            {"athlete_id": athlete_id, "integration_type": "strava"},
            {
                "$set": {
                    "athlete_id": athlete_id,
                    "integration_type": "strava",
                    "credentials": encrypted_credentials,
                    "is_active": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "last_sync": None
                }
            },
            upsert=True
        )
        
        return {"message": "Strava credentials saved successfully"}
        
    except Exception as e:
        print(f"Error saving Strava credentials: {e}")
        raise HTTPException(status_code=500, detail="Failed to save Strava credentials")

@api_router.get("/auth/strava/{athlete_id}")
async def strava_auth_initiate(athlete_id: str):
    """Initiate Strava OAuth authorization flow using user's credentials"""
    # Get user's Strava credentials
    integration = await db.integrations.find_one(
        {"athlete_id": athlete_id, "integration_type": "strava"}, 
        {"_id": 0}
    )
    
    if not integration or not integration.get("credentials"):
        raise HTTPException(
            status_code=404, 
            detail="Strava credentials not found. Please configure your Strava credentials first."
        )
    
    credentials = integration["credentials"]
    state = f"{athlete_id}_{secrets.token_urlsafe(16)}"
    
    # Use user's redirect URI (can be configured per user or use a default)
    redirect_uri = f"https://myhealthtracker.app/strava/callback"
    
    auth_params = {
        "client_id": credentials["client_id"],
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "approval_prompt": "force",
        "scope": "read,activity:read_all,profile:read_all",
        "state": state
    }
    
    auth_url = f"https://www.strava.com/oauth/authorize?{urlencode(auth_params)}"
    return {"authorization_url": auth_url, "state": state}

# Oura OAuth routes
@api_router.post("/integrations/oura/{athlete_id}/credentials")
async def save_oura_credentials(athlete_id: str, credentials: OuraCredentials):
    """Save user-specific Oura API credentials"""
    try:
        # Encrypt sensitive data before storing
        encrypted_credentials = {
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret  # In production, encrypt this
        }
        
        # Update or create Oura integration for this athlete
        await db.integrations.update_one(
            {"athlete_id": athlete_id, "integration_type": "oura"},
            {
                "$set": {
                    "athlete_id": athlete_id,
                    "integration_type": "oura",
                    "credentials": encrypted_credentials,
                    "is_active": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "last_sync": None
                }
            },
            upsert=True
        )
        
        return {"message": "Oura credentials saved successfully"}
        
    except Exception as e:
        print(f"Error saving Oura credentials: {e}")
        raise HTTPException(status_code=500, detail="Failed to save Oura credentials")

@api_router.get("/auth/oura/{athlete_id}")
async def oura_auth_initiate(athlete_id: str):
    """Initiate Oura OAuth authorization flow using user's credentials"""
    # Get user's Oura credentials
    integration = await db.integrations.find_one(
        {"athlete_id": athlete_id, "integration_type": "oura"}, 
        {"_id": 0}
    )
    
    if not integration or not integration.get("credentials"):
        raise HTTPException(
            status_code=404, 
            detail="Oura credentials not found. Please configure your Oura credentials first."
        )
    
    credentials = integration["credentials"]
    state = f"{athlete_id}_{secrets.token_urlsafe(16)}"
    
    # Use user's redirect URI (can be configured per user or use a default)
    redirect_uri = f"https://myhealthtracker.app/oura/callback"
    
    auth_params = {
        "response_type": "code",
        "client_id": credentials["client_id"],
        "redirect_uri": redirect_uri,
        "scope": "email personal daily heartrate workout session tag spo2",
        "state": state
    }
    
    auth_url = f"https://cloud.ouraring.com/oauth/authorize?{urlencode(auth_params)}"
    return {"authorization_url": auth_url, "state": state}

@api_router.get("/auth/oura/callback")
async def oura_auth_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None)
):
    """Handle Oura OAuth callback"""
    if error:
        raise HTTPException(status_code=400, detail=f"Oura authorization failed: {error}")
    
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing authorization code or state")
    
    try:
        # Extract athlete_id from state
        athlete_id = state.split('_')[0]
        
        # Exchange code for tokens
        tokens = await oura_token_manager.exchange_code_for_tokens(code)
        
        # Store Oura integration
        integration = Integration(
            athlete_id=athlete_id,
            integration_type="oura",
            credentials={
                "access_token": tokens["access_token"],
                "refresh_token": tokens["refresh_token"],
                "expires_at": tokens["expires_at"],
                "token_type": tokens.get("token_type", "Bearer")
            },
            settings={
                "auto_sync": True,
                "sync_sleep": True,
                "sync_readiness": True,
                "sync_heart_rate": True
            }
        )
        
        await db.integrations.update_one(
            {"athlete_id": athlete_id, "integration_type": "oura"},
            {"$set": prepare_for_mongo(integration.model_dump())},
            upsert=True
        )
        
        # Import recent sleep and readiness data
        imported_sleep = await oura_data_manager.import_sleep_data_to_db(athlete_id)
        
        return {
            "message": "Oura connected successfully", 
            "athlete_id": athlete_id,
            "imported_sleep_records": imported_sleep
        }
        
    except Exception as e:
        logging.error(f"Oura callback error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to complete Oura authorization")

@api_router.post("/integrations/oura/{athlete_id}/sync")
async def sync_oura_data(athlete_id: str):
    """Manually sync data from Oura Ring"""
    try:
        imported_sleep = await oura_data_manager.import_sleep_data_to_db(athlete_id)
        return {
            "message": "Oura sync completed", 
            "imported_sleep_records": imported_sleep
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Oura sync error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to sync Oura data")

@api_router.get("/integrations/oura/{athlete_id}/status")
async def get_oura_integration_status(athlete_id: str):
    """Get Oura integration status"""
    integration = await db.integrations.find_one({
        "athlete_id": athlete_id, 
        "integration_type": "oura",
        "is_active": True
    })
    
    if not integration:
        return {"connected": False, "last_sync": None}
    
    return {
        "connected": True,
        "last_sync": integration.get("last_sync"),
        "settings": integration.get("settings", {})
    }

# COROS (via Terra API) routes
@api_router.get("/auth/coros/{athlete_id}")
async def initiate_coros_auth(athlete_id: str):
    """Initiate COROS OAuth via Terra API"""
    terra_api_key = os.environ.get("TERRA_API_KEY", "")
    terra_dev_id = os.environ.get("TERRA_DEV_ID", "")
    redirect_uri = os.environ.get("COROS_REDIRECT_URI", "")
    
    if not terra_api_key or not terra_dev_id:
        raise HTTPException(
            status_code=503, 
            detail="COROS integration not configured. Please add Terra API credentials to enable COROS sync."
        )
    
    # Terra API auth URL for COROS
    auth_url = f"https://api.tryterra.co/v2/auth/authenticateUser?resource=COROS&auth_success_redirect_url={redirect_uri}&reference_id={athlete_id}"
    
    return {"auth_url": auth_url}

@api_router.post("/auth/coros/callback")
async def coros_oauth_callback(request: Request):
    """Handle COROS OAuth callback from Terra"""
    data = await request.json()
    code = data.get("code")
    state = data.get("state") or data.get("reference_id")
    
    if not code:
        raise HTTPException(status_code=400, detail="No authorization code provided")
    
    try:
        # In a real implementation, you would exchange code for tokens with Terra API
        # and store the integration
        
        integration_data = {
            "athlete_id": state,
            "integration_type": "coros",
            "is_active": True,
            "credentials": {
                "terra_user_id": code,  # Placeholder
                "access_granted": datetime.now(timezone.utc).isoformat()
            },
            "last_sync": None,
            "settings": {
                "auto_sync": True,
                "sync_activities": True
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Update or insert integration
        await db.integrations.update_one(
            {"athlete_id": state, "integration_type": "coros"},
            {"$set": integration_data},
            upsert=True
        )
        
        return {"message": "COROS connected successfully"}
        
    except Exception as e:
        logging.error(f"COROS OAuth error: {e}")
        raise HTTPException(status_code=500, detail="Failed to complete COROS authorization")

@api_router.post("/integrations/coros/{athlete_id}/sync")
async def sync_coros_activities(athlete_id: str):
    """Sync activities from COROS via Terra API"""
    integration = await db.integrations.find_one({
        "athlete_id": athlete_id,
        "integration_type": "coros",
        "is_active": True
    })
    
    if not integration:
        raise HTTPException(status_code=404, detail="COROS not connected")
    
    try:
        # In real implementation, fetch activities from Terra API
        # For now, return placeholder
        
        # Update last sync time
        await db.integrations.update_one(
            {"athlete_id": athlete_id, "integration_type": "coros"},
            {"$set": {"last_sync": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {
            "message": "COROS sync completed",
            "imported_activities": 0,
            "note": "COROS integration requires Terra API credentials. Please configure Terra API to enable activity syncing."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"COROS sync error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to sync COROS activities")

@api_router.get("/integrations/coros/{athlete_id}/status")
async def get_coros_integration_status(athlete_id: str):
    """Get COROS integration status"""
    integration = await db.integrations.find_one({
        "athlete_id": athlete_id,
        "integration_type": "coros",
        "is_active": True
    })
    
    if not integration:
        return {"connected": False, "last_sync": None}
    
    return {
        "connected": True,
        "last_sync": integration.get("last_sync"),
        "settings": integration.get("settings", {})
    }

# Schedule Management Routes
@api_router.post("/schedules", response_model=Schedule)
async def create_schedule(schedule: Schedule):
    """Create a new automated analysis schedule"""
    schedule_dict = prepare_for_mongo(schedule.model_dump())
    await db.schedules.insert_one(schedule_dict)
    return schedule

@api_router.get("/schedules/{athlete_id}", response_model=List[Schedule])
async def get_athlete_schedules(athlete_id: str):
    """Get all schedules for an athlete"""
    schedules = await db.schedules.find(
        {"athlete_id": athlete_id, "active": True}, 
        {"_id": 0}
    ).to_list(length=None)
    return [parse_from_mongo(s) for s in schedules]

@api_router.put("/schedules/{schedule_id}", response_model=Schedule)
async def update_schedule(schedule_id: str, updates: dict):
    """Update an existing schedule"""
    await db.schedules.update_one(
        {"id": schedule_id},
        {"$set": updates}
    )
    updated_schedule = await db.schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not updated_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return parse_from_mongo(updated_schedule)

@api_router.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str):
    """Delete a schedule"""
    result = await db.schedules.update_one(
        {"id": schedule_id},
        {"$set": {"active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"message": "Schedule deleted successfully"}

# Recommendations Routes  
@api_router.get("/recommendations/{athlete_id}", response_model=List[Recommendation])
async def get_athlete_recommendations(athlete_id: str, limit: int = 20):
    """Get AI-generated recommendations for an athlete"""
    recommendations = await db.recommendations.find(
        {"athlete_id": athlete_id}, 
        {"_id": 0}
    ).sort("generated_at", -1).limit(limit).to_list(length=None)
    return [parse_from_mongo(r) for r in recommendations]

@api_router.post("/recommendations/{athlete_id}/generate")
async def generate_recommendation(athlete_id: str, prompt: str, schedule_id: str = None):
    """Generate a new AI recommendation based on a prompt"""
    try:
        # Get AI coach response
        response = await ai_coach.chat_with_coach(athlete_id, prompt)
        
        # Parse response to create recommendation
        recommendation = Recommendation(
            athlete_id=athlete_id,
            schedule_id=schedule_id,
            title=f"AI Analysis - {datetime.now().strftime('%B %d, %Y')}",
            type="automated_analysis",
            priority="medium",
            summary=response[:200] + "..." if len(response) > 200 else response,
            content=response,
            tags=["automated", "ai_analysis"],
            scheduled_prompt=prompt[:50] + "..." if len(prompt) > 50 else prompt
        )
        
        # Store recommendation
        recommendation_dict = prepare_for_mongo(recommendation.model_dump())
        await db.recommendations.insert_one(recommendation_dict)
        
        return recommendation
        
    except Exception as e:
        logging.error(f"Error generating recommendation: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate recommendation")

@api_router.post("/recommendations/{recommendation_id}/read")
async def mark_recommendation_read(recommendation_id: str):
    """Mark a recommendation as read"""
    await db.recommendations.update_one(
        {"id": recommendation_id},
        {"$set": {"read": True}}
    )
    return {"message": "Recommendation marked as read"}

# Schedule Execution Service (would be called by cron job)
@api_router.post("/schedules/execute")
async def execute_scheduled_analyses():
    """Execute scheduled AI analyses - typically called by cron job"""
    executed_count = 0
    
    try:
        # Get all active schedules
        schedules = await db.schedules.find({"active": True}).to_list(length=None)
        
        for schedule in schedules:
            # Simple daily execution logic (would be enhanced with proper scheduling)
            now = datetime.now(timezone.utc)
            last_executed = schedule.get('last_executed')
            
            # If never executed or last executed more than 23 hours ago
            if not last_executed or (now - datetime.fromisoformat(last_executed.replace('Z', '+00:00'))) > timedelta(hours=23):
                
                # Generate recommendation
                try:
                    response = await ai_coach.chat_with_coach(schedule['athlete_id'], schedule['prompt'])
                    
                    # Create recommendation
                    recommendation = Recommendation(
                        athlete_id=schedule['athlete_id'],
                        schedule_id=schedule['id'],
                        title=f"{schedule['name']} - {now.strftime('%B %d, %Y')}",
                        type="scheduled_analysis",
                        priority="medium",
                        summary=response[:200] + "..." if len(response) > 200 else response,
                        content=response,
                        tags=["scheduled", "automated"],
                        scheduled_prompt=schedule['name']
                    )
                    
                    # Store recommendation and update schedule
                    recommendation_dict = prepare_for_mongo(recommendation.model_dump())
                    await db.recommendations.insert_one(recommendation_dict)
                    
                    await db.schedules.update_one(
                        {"id": schedule['id']},
                        {"$set": {"last_executed": now}}
                    )
                    
                    executed_count += 1
                    
                except Exception as e:
                    logging.error(f"Error executing schedule {schedule['id']}: {e}")
                    continue
        
        return {"message": f"Executed {executed_count} scheduled analyses"}
        
    except Exception as e:
        logging.error(f"Error in scheduled execution: {e}")
        raise HTTPException(status_code=500, detail="Failed to execute scheduled analyses")

# =============================================================================
# INTEGRATION HUB API ENDPOINTS
# =============================================================================

# Provider Connector Interface
class ProviderConnector:
    """Base class for all provider connectors"""
    
    def __init__(self, key: str, name: str, auth_type: str = "oauth2"):
        self.key = key
        self.name = name
        self.auth_type = auth_type
    
    async def begin_auth(self, user_id: str) -> dict:
        """Start OAuth flow, return auth URL"""
        raise NotImplementedError
    
    async def handle_callback(self, code: str, state: str) -> str:
        """Handle OAuth callback, return user_connection_id"""
        raise NotImplementedError
    
    async def verify_webhook(self, request: Request) -> dict:
        """Verify webhook signature, return user_id and kind"""
        raise NotImplementedError
    
    async def normalize_activity(self, raw_event: dict) -> Optional[dict]:
        """Normalize activity data"""
        return None
    
    async def normalize_daily(self, raw_event: dict) -> Optional[dict]:
        """Normalize daily metrics"""
        return None

# Strava Connector
class StravaConnector(ProviderConnector):
    def __init__(self):
        super().__init__("strava", "Strava", "oauth2")
    
    async def begin_auth(self, user_id: str) -> dict:
        state = f"{user_id}_{secrets.token_urlsafe(16)}"
        
        # Get client credentials from environment or user config
        client_id = os.environ.get('STRAVA_CLIENT_ID')
        if not client_id:
            # Try to get from user's saved credentials
            integration = await db.integrations.find_one({
                "athlete_id": user_id, 
                "integration_type": "strava"
            })
            if integration and integration.get("credentials"):
                client_id = integration["credentials"].get("client_id")
        
        if not client_id:
            raise HTTPException(status_code=400, detail="Strava credentials not configured")
        
        redirect_uri = f"{os.environ.get('BACKEND_URL', 'http://localhost:8001')}/api/auth/strava/callback"
        
        auth_params = {
            "client_id": client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "approval_prompt": "force",
            "scope": "read,activity:read_all,profile:read_all",
            "state": state
        }
        
        auth_url = f"https://www.strava.com/oauth/authorize?{urlencode(auth_params)}"
        return {"authorization_url": auth_url, "state": state}
    
    async def normalize_activity(self, raw_event: dict) -> Optional[dict]:
        """Normalize Strava activity to standard format"""
        payload = raw_event["payload"]
        
        # Map activity types
        activity_type_map = {
            "Run": "run",
            "Ride": "ride", 
            "Swim": "swim",
            "Walk": "walk",
            "Hike": "hike"
        }
        
        return {
            "activity_type": activity_type_map.get(payload.get("type", ""), "other"),
            "start_time": payload.get("start_date"),
            "end_time": payload.get("start_date"),  # Would calculate from start + elapsed time
            "distance_m": payload.get("distance"),
            "duration_s": payload.get("elapsed_time"),
            "avg_hr": payload.get("average_heartrate"),
            "max_hr": payload.get("max_heartrate"),
            "calories_kcal": payload.get("kilojoules", 0) * 0.239006 if payload.get("kilojoules") else None  # Convert kJ to kcal
        }

# Oura Connector
class OuraConnector(ProviderConnector):
    def __init__(self):
        super().__init__("oura", "Oura Ring", "oauth2")
    
    async def begin_auth(self, user_id: str) -> dict:
        state = f"{user_id}_{secrets.token_urlsafe(16)}"
        
        # Get client credentials
        client_id = os.environ.get('OURA_CLIENT_ID')
        if not client_id:
            integration = await db.integrations.find_one({
                "athlete_id": user_id, 
                "integration_type": "oura"
            })
            if integration and integration.get("credentials"):
                client_id = integration["credentials"].get("client_id")
        
        if not client_id:
            raise HTTPException(status_code=400, detail="Oura credentials not configured")
        
        redirect_uri = f"{os.environ.get('BACKEND_URL', 'http://localhost:8001')}/api/auth/oura/callback"
        
        auth_params = {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "scope": "email personal daily heartrate workout session tag spo2",
            "state": state
        }
        
        auth_url = f"https://cloud.ouraring.com/oauth/authorize?{urlencode(auth_params)}"
        return {"authorization_url": auth_url, "state": state}
    
    async def normalize_daily(self, raw_event: dict) -> Optional[dict]:
        """Normalize Oura daily data to standard format"""
        payload = raw_event["payload"]
        
        return {
            "date": payload.get("day"),
            "readiness": payload.get("score"),
            "recovery": payload.get("score"),  # Oura uses same score for both
            "steps": payload.get("steps"),
            "resting_hr": payload.get("resting_heart_rate"),
            "spo2": payload.get("spo2", {}).get("average") if payload.get("spo2") else None,
            "sleep_total_min": payload.get("total_sleep_duration", 0) // 60  # Convert seconds to minutes
        }

# Initialize connectors
strava_connector = StravaConnector()
oura_connector = OuraConnector()

connectors = {
    "strava": strava_connector,
    "oura": oura_connector
}

# Hub API Endpoints

@api_router.get("/providers")
async def list_providers():
    """List all available providers"""
    providers = [
        {
            "key": "strava",
            "name": "Strava",
            "auth_type": "oauth2",
            "has_webhook": True,
            "enabled": True,
            "description": "Activities and performance data"
        },
        {
            "key": "oura",
            "name": "Oura Ring",
            "auth_type": "oauth2", 
            "has_webhook": True,
            "enabled": True,
            "description": "Sleep, recovery, and readiness data"
        },
        {
            "key": "polar",
            "name": "Polar",
            "auth_type": "oauth2",
            "has_webhook": True,
            "enabled": False,  # Phase 3
            "description": "Heart rate and training data"
        },
        {
            "key": "garmin",
            "name": "Garmin Connect",
            "auth_type": "oauth1",
            "has_webhook": True,
            "enabled": False,  # Requires partner approval
            "description": "Comprehensive fitness tracking"
        },
        {
            "key": "coros",
            "name": "COROS",
            "auth_type": "oauth2",
            "has_webhook": True,
            "enabled": False,  # Requires partner approval
            "description": "GPS sports watches and training data"
        }
    ]
    return {"providers": providers}

@api_router.get("/me/connections")
async def get_user_connections(user_id: str = Query(...)):
    """Get all provider connections for a user"""
    connections = await db.user_connections.find(
        {"user_id": user_id},
        {"_id": 0, "access_token": 0, "refresh_token": 0}  # Don't return sensitive tokens
    ).to_list(length=None)
    
    return {"connections": [parse_from_mongo(conn) for conn in connections]}

@api_router.post("/me/connections/{provider_key}/disconnect")
async def disconnect_provider(provider_key: str, user_id: str = Query(...)):
    """Disconnect a provider"""
    result = await db.user_connections.update_one(
        {"user_id": user_id, "provider_key": provider_key},
        {"$set": {"status": "disconnected", "updated_at": datetime.now(timezone.utc)}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    return {"message": f"{provider_key.capitalize()} disconnected successfully"}

@api_router.get("/auth/{provider_key}")
async def begin_provider_auth(provider_key: str, user_id: str = Query(...)):
    """Begin OAuth flow for a provider"""
    if provider_key not in connectors:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    connector = connectors[provider_key]
    auth_data = await connector.begin_auth(user_id)
    
    return auth_data

@api_router.post("/auth/{provider_key}/callback")
async def handle_provider_callback(provider_key: str, request: Request):
    """Handle OAuth callback from provider"""
    if provider_key not in connectors:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    # For now, just handle query parameters
    # In production, this would handle the full OAuth token exchange
    data = dict(request.query_params)
    code = data.get("code")
    state = data.get("state")
    
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")
    
    user_id = state.split('_')[0]
    
    # Store basic connection (simplified for now)
    connection = UserConnection(
        user_id=user_id,
        provider_key=provider_key,
        access_token=f"temp_token_{secrets.token_urlsafe(32)}",  # Would be real token
        status="active"
    )
    
    connection_dict = prepare_for_mongo(connection.model_dump())
    await db.user_connections.update_one(
        {"user_id": user_id, "provider_key": provider_key},
        {"$set": connection_dict},
        upsert=True
    )
    
    return {"message": f"{provider_key.capitalize()} connected successfully", "user_id": user_id}

@api_router.post("/webhook/{provider_key}")
async def handle_provider_webhook(provider_key: str, request: Request):
    """Handle webhook from provider"""
    if provider_key not in connectors:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    # Get raw body for signature verification
    body = await request.body()
    
    # For now, just store as raw event
    # In production, this would verify webhook signature
    raw_event = RawEvent(
        user_id="temp_user",  # Would be extracted from webhook
        provider_key=provider_key,
        external_id=f"webhook_{secrets.token_urlsafe(8)}",
        kind="activity",  # Would be determined from webhook
        payload=await request.json()
    )
    
    raw_event_dict = prepare_for_mongo(raw_event.model_dump())
    await db.raw_events.insert_one(raw_event_dict)
    
    return {"status": "success", "event_id": raw_event.id}

@api_router.get("/me/activities")
async def get_user_activities(
    user_id: str = Query(...),
    since: Optional[str] = Query(None),
    limit: int = Query(50, le=100)
):
    """Get normalized activities for user"""
    query = {"user_id": user_id}
    
    if since:
        query["start_time"] = {"$gte": since}
    
    activities = await db.normalized_activities.find(
        query,
        {"_id": 0}
    ).sort("start_time", -1).limit(limit).to_list(length=None)
    
    return {"activities": [parse_from_mongo(activity) for activity in activities]}

@api_router.get("/me/daily")
async def get_user_daily_metrics(
    user_id: str = Query(...),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(30, le=90)
):
    """Get normalized daily metrics for user"""
    query = {"user_id": user_id}
    
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}
    elif end_date:
        query["date"] = {"$lte": end_date}
    
    daily_metrics = await db.normalized_daily.find(
        query,
        {"_id": 0}
    ).sort("date", -1).limit(limit).to_list(length=None)
    
    return {"daily_metrics": [parse_from_mongo(metric) for metric in daily_metrics]}

@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

# Register OpenAI Realtime router for voice chat
try:
    # Create a separate router for realtime endpoints
    realtime_router = APIRouter()
    # Register the realtime router with the OpenAI service
    # Note: This will be done dynamically when a user creates a voice session
    # since each user has their own OpenAI API key
    logging.info("OpenAI Realtime Voice API routes registered")
except Exception as e:
    logging.warning(f"Could not register OpenAI Realtime routes: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
