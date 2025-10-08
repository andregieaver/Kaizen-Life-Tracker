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
# from emergentintegrations.llm.chat import LlmChat, UserMessage

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
    age: int
    weekly_mileage: float
    recent_race_time: Optional[str] = None
    running_goals: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AthleteUpdate(BaseModel):
    name: Optional[str] = None
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

# Initialize AI Coach
ai_coach = AICoachService()

# API Routes
@api_router.get("/")
async def root():
    return {"message": "RunWisely AI Coach API"}

# Athlete Profile routes
@api_router.post("/athlete", response_model=AthleteProfile)
async def create_athlete_profile(profile: AthleteProfile):
    profile_dict = prepare_for_mongo(profile.model_dump())
    await db.athlete_profiles.insert_one(profile_dict)
    return profile

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
