from fastapi import FastAPI, APIRouter, HTTPException, Request, Query
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
import requests
from urllib.parse import urlencode
from stravalib import Client
import asyncio
from oura import OuraClient
from datetime import timedelta
from passlib.context import CryptContext
# from emergentintegrations.llm.chat import LlmChat, UserMessage

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
    """Parse data from MongoDB by converting ISO strings back to datetime objects"""
    if isinstance(item, dict):
        for key, value in item.items():
            if isinstance(value, str) and 'timestamp' in key.lower():
                try:
                    item[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                except:
                    pass
    return item

# Define Models for Running Coach
class AthleteProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    password: str  # This will be hashed before storing
    age: int
    weekly_mileage: float
    recent_race_time: Optional[str] = None
    running_goals: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Subscription fields
    subscription_tier: str = Field(default="free")  # 'free', 'pro', 'premium'
    subscription_status: str = Field(default="active")  # 'active', 'canceled', 'past_due', etc.
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    subscription_current_period_end: Optional[datetime] = None

class AthleteUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None
    weekly_mileage: Optional[float] = None
    recent_race_time: Optional[str] = None
    running_goals: Optional[str] = None

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
    session_id: str = Field(default_factory=lambda: f"session_{int(datetime.now(timezone.utc).timestamp() * 1000)}")

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
        
        # Get memories
        memories = await self.get_memories(athlete_id)
        
        return {
            "athlete": athlete,
            "recent_workouts": workouts,
            "recent_sleep": sleep_data,
            "current_readiness": readiness,
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
            return integration["credentials"]["api_key"] if integration else None
        except Exception as e:
            logging.error(f"Error retrieving user OpenAI key: {e}")
            return None
    
    async def chat_with_coach(self, athlete_id: str, message: str) -> str:
        """Chat with AI coach using athlete's personal data"""
        context = await self.get_athlete_context(athlete_id)
        
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
        
        system_prompt = f"""
You are an expert endurance running coach with deep knowledge of training physiology, periodization, and athlete development. You have access to this athlete's complete training and recovery data.

ATHLETE PROFILE:
{json.dumps(context.get('athlete', {}), indent=2)}
{memory_summary}

RECENT WORKOUTS (last 14 days):
{json.dumps(context.get('recent_workouts', []), indent=2)}

RECENT SLEEP & RECOVERY (last 7 days):
{json.dumps(context.get('recent_sleep', []), indent=2)}

CURRENT READINESS:
{json.dumps(context.get('current_readiness', {}), indent=2)}

COACHING PRINCIPLES:
- Prioritize safety and injury prevention
- Base recommendations on actual data, not assumptions
- Consider the athlete's goals and current fitness level
- Provide specific, actionable advice
- Explain the 'why' behind your recommendations
- Be encouraging but realistic

CHART GENERATION:
When showing trends or data visualizations, you can create interactive charts using this format:
```chart
{{
  "type": "line|bar|area",
  "title": "Chart Title",
  "data": [
    {{"name": "Week 1", "miles": 25, "pace": 8.5}},
    {{"name": "Week 2", "miles": 30, "pace": 8.2}}
  ],
  "xKey": "name",
  "yKey": "miles",
  "xLabel": "Week",
  "yLabel": "Miles",
  "color": "#3b82f6"
}}
```

Chart types:
- "line": For trends over time (pace progression, mileage trends)
- "bar": For comparing values (weekly volume, workout types)
- "area": For cumulative data (elevation gain, training load)

For multiple series, use yKey as an array: "yKey": ["miles", "pace"]

Use charts when:
- Showing weekly/monthly trends
- Comparing workout volumes
- Displaying pace progression
- Visualizing training load

Respond as a knowledgeable coach who truly knows this athlete's training history, sleep patterns, and current state. Reference specific data points when relevant.
"""
        
        try:
            # Check if user has their own OpenAI API key
            user_openai_key = await self.get_user_openai_key(athlete_id)
            
            if user_openai_key:
                # Use user's personal OpenAI API key
                import openai
                
                client = openai.AsyncOpenAI(api_key=user_openai_key)
                
                response = await client.chat.completions.create(
                    model="gpt-4o",  # Latest GPT-4 model
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": message}
                    ],
                    max_tokens=2000,
                    temperature=0.7
                )
                
                return response.choices[0].message.content
            
            else:
                # Fall back to Emergent integration
                from emergentintegrations.llm.chat import LlmChat, UserMessage
                
                chat = LlmChat(
                    api_key=self.api_key,
                    session_id=f"coach_{athlete_id}",
                    system_message=system_prompt
                ).with_model("anthropic", "claude-3-7-sonnet-20250219")
                
                user_message = UserMessage(text=message)
                response = await chat.send_message(user_message)
                
                return response
                
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
    
    if update_data:
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": update_data}
        )
    
    # Return updated athlete
    updated_athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    return parse_from_mongo(updated_athlete)

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
    except stripe.error.StripeError as e:
        logging.error(f"Stripe error creating checkout session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")
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
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    return {
        "subscription_tier": athlete.get("subscription_tier", "free"),
        "subscription_status": athlete.get("subscription_status", "active"),
        "stripe_customer_id": athlete.get("stripe_customer_id"),
        "stripe_subscription_id": athlete.get("stripe_subscription_id"),
        "subscription_current_period_end": athlete.get("subscription_current_period_end")
    }

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
    
    # Validate the API key format
    if not key_request.api_key.startswith('sk-'):
        raise HTTPException(status_code=400, detail="Invalid OpenAI API key format")
    
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
    
    return {"message": "OpenAI API key saved successfully"}

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
        response = await ai_coach.chat_with_coach(chat_request.athlete_id, chat_request.message)
        
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

@api_router.get("/coach/history/{athlete_id}")
async def get_chat_history(athlete_id: str, limit: int = 20):
    messages = await db.chat_messages.find(
        {"athlete_id": athlete_id}, 
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(length=None)
    return [parse_from_mongo(m) for m in messages]

@api_router.get("/coach/conversations/{athlete_id}")
async def get_conversations(athlete_id: str):
    """Get list of conversations grouped by session"""
    pipeline = [
        {"$match": {"athlete_id": athlete_id}},
        {"$sort": {"timestamp": -1}},
        {"$group": {
            "_id": "$session_id",
            "last_message": {"$first": "$timestamp"},
            "message_count": {"$sum": 1},
            "preview": {"$first": "$message"}
        }},
        {"$sort": {"last_message": -1}},
        {"$limit": 50}
    ]
    
    conversations = await db.chat_messages.aggregate(pipeline).to_list(length=None)
    
    return [{
        "session_id": conv["_id"],
        "last_message": conv["last_message"].isoformat() if isinstance(conv["last_message"], datetime) else conv["last_message"],
        "message_count": conv["message_count"],
        "preview": conv["preview"][:50] + "..." if len(conv["preview"]) > 50 else conv["preview"]
    } for conv in conversations]

@api_router.get("/coach/conversation/{athlete_id}/{session_id}")
async def get_conversation(athlete_id: str, session_id: str):
    """Get all messages from a specific conversation"""
    messages = await db.chat_messages.find(
        {"athlete_id": athlete_id, "session_id": session_id}, 
        {"_id": 0}
    ).sort("timestamp", 1).to_list(length=None)
    return [parse_from_mongo(m) for m in messages]

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

# Include the router in the main app
app.include_router(api_router)

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
