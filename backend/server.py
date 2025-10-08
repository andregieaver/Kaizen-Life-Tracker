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
    age: int
    weekly_mileage: float
    recent_race_time: Optional[str] = None
    running_goals: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    message: str
    response: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CoachChat(BaseModel):
    athlete_id: str
    message: str

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

# AI Coach Service
class AICoachService:
    def __init__(self):
        self.api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not self.api_key:
            raise ValueError("EMERGENT_LLM_KEY not found in environment variables")
    
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
        
        return {
            "athlete": athlete,
            "recent_workouts": workouts,
            "recent_sleep": sleep_data,
            "current_readiness": readiness
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
        system_prompt = f"""
You are an expert endurance running coach with deep knowledge of training physiology, periodization, and athlete development. You have access to this athlete's complete training and recovery data.

ATHLETE PROFILE:
{json.dumps(context.get('athlete', {}), indent=2)}

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
        
    async def exchange_code_for_tokens(self, auth_code: str) -> Dict[str, Any]:
        """Exchange authorization code for access and refresh tokens"""
        token_data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
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
    profile_dict = prepare_for_mongo(profile.model_dump())
    
    # Check if email already exists
    existing = await db.athlete_profiles.find_one({"email": profile.email.lower().strip()})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    
    await db.athlete_profiles.insert_one(profile_dict)
    return profile

@api_router.post("/auth/login")
async def login_athlete(login_data: LoginRequest):
    """Login athlete by email"""
    athlete = await db.athlete_profiles.find_one(
        {"email": login_data.email.lower().strip()}, 
        {"_id": 0}
    )
    if not athlete:
        raise HTTPException(status_code=404, detail="No account found with this email")
    
    return {
        "athlete_id": athlete["id"],
        "name": athlete["name"],
        "email": athlete["email"]
    }

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

# AI Coach chat routes
@api_router.post("/coach/chat")
async def chat_with_ai_coach(chat_request: CoachChat):
    try:
        response = await ai_coach.chat_with_coach(chat_request.athlete_id, chat_request.message)
        
        # Save chat history
        chat_message = ChatMessage(
            athlete_id=chat_request.athlete_id,
            message=chat_request.message,
            response=response
        )
        chat_dict = prepare_for_mongo(chat_message.model_dump())
        await db.chat_messages.insert_one(chat_dict)
        
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

# Strava OAuth routes
@api_router.get("/auth/strava/{athlete_id}")
async def strava_auth_initiate(athlete_id: str):
    """Initiate Strava OAuth authorization flow"""
    state = f"{athlete_id}_{secrets.token_urlsafe(16)}"
    
    auth_params = {
        "client_id": os.environ.get('STRAVA_CLIENT_ID'),
        "response_type": "code",
        "redirect_uri": os.environ.get('STRAVA_REDIRECT_URI'),
        "approval_prompt": "force",
        "scope": "read,activity:read_all,profile:read_all",
        "state": state
    }
    
    auth_url = f"https://www.strava.com/oauth/authorize?{urlencode(auth_params)}"
    return {"authorization_url": auth_url, "state": state}

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
        
        # Exchange code for tokens
        tokens = await strava_token_manager.exchange_code_for_tokens(code)
        
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
        "integration_type": "strava",
        "is_active": True
    })
    
    if not integration:
        return {"connected": False, "last_sync": None}
    
    return {
        "connected": True,
        "last_sync": integration.get("last_sync"),
        "strava_athlete_id": integration["credentials"].get("athlete_id"),
        "settings": integration.get("settings", {})
    }

# Oura OAuth routes
@api_router.get("/auth/oura/{athlete_id}")
async def oura_auth_initiate(athlete_id: str):
    """Initiate Oura OAuth authorization flow"""
    state = f"{athlete_id}_{secrets.token_urlsafe(16)}"
    
    auth_params = {
        "response_type": "code",
        "client_id": os.environ.get('OURA_CLIENT_ID'),
        "redirect_uri": os.environ.get('OURA_REDIRECT_URI'),
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
