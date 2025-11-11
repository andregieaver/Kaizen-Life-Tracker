from fastapi import FastAPI, APIRouter, HTTPException, Request, Query, UploadFile, File, Form
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DocumentTooLarge
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
import shutil
from datetime import datetime, timezone, date, time, timedelta
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
import httpx
from bs4 import BeautifulSoup
import re
from email_service import initialize_email_service, get_email_service
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import openai
from pywebpush import webpush, WebPushException
import re
import stripe

# Import image processor
from image_processor import process_and_save_image, process_multiple_images
from video_processor import process_and_save_video

# Import Strava service
from strava_service import StravaService

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize OpenAI
openai_api_key = os.environ.get('OPENAI_API_KEY')
if openai_api_key:
    openai.api_key = openai_api_key

# Initialize scheduler
scheduler = AsyncIOScheduler()

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
    # Keep date fields as strings for JSON serialization
    # Only convert date/time for specific models that need Python date objects
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

# Push Notification Helper Function
async def send_push_notification(athlete_id: str, title: str, body: str, url: str = "/dashboard/reports"):
    """Send push notification to all subscribed devices for an athlete"""
    try:
        # Get all push subscriptions for this athlete
        subscriptions = await db.push_subscriptions.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).to_list(length=None)
        
        if not subscriptions:
            logging.info(f"No push subscriptions found for athlete {athlete_id}")
            return
        
        # Get VAPID keys from environment
        vapid_private_key = os.environ.get('VAPID_PRIVATE_KEY')
        vapid_claim_email = os.environ.get('VAPID_CLAIM_EMAIL', 'mailto:admin@trainsmart.app')
        
        if not vapid_private_key:
            logging.error("VAPID_PRIVATE_KEY not found in environment")
            return
        
        # Prepare notification data
        notification_data = {
            "title": title,
            "body": body,
            "icon": "/logo192.png",
            "badge": "/logo192.png",
            "url": url
        }
        
        # Send notification to each subscription
        for subscription in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": subscription["endpoint"],
                        "keys": subscription["keys"]
                    },
                    data=json.dumps(notification_data),
                    vapid_private_key=vapid_private_key,
                    vapid_claims={"sub": vapid_claim_email}
                )
                logging.info(f"Push notification sent successfully to subscription {subscription['id']}")
            except WebPushException as e:
                logging.error(f"Failed to send push notification to subscription {subscription['id']}: {e}")
                # If subscription is expired/invalid, remove it
                if e.response and e.response.status_code in [404, 410]:
                    await db.push_subscriptions.delete_one({"id": subscription['id']})
                    logging.info(f"Removed expired subscription {subscription['id']}")
            except Exception as e:
                logging.error(f"Unexpected error sending push notification: {e}")
                
    except Exception as e:
        logging.error(f"Error in send_push_notification: {e}")

# Scheduler Functions
async def execute_scheduled_prompt(schedule_id: str, athlete_id: str, prompt: str, title: str):
    """Execute a scheduled prompt and save as a recommendation"""
    try:
        print(f"[SCHEDULER] Starting execution for schedule {schedule_id}")
        
        # Get comprehensive athlete context
        athlete_context = await ai_coach.get_athlete_context(athlete_id)
        if not athlete_context or not athlete_context.get('athlete'):
            print(f"[SCHEDULER] ERROR: Athlete {athlete_id} not found")
            logging.error(f"Athlete {athlete_id} not found for schedule {schedule_id}")
            return
        
        athlete = athlete_context['athlete']
        print(f"[SCHEDULER] Athlete found: {athlete.get('name')}")
        
        # Get OpenAI API key (checks user's personal key first, then global system settings)
        openai_key = await ai_coach.get_openai_key(athlete_id)
        if not openai_key:
            print(f"[SCHEDULER] ERROR: No OpenAI API key configured (checked personal and system settings)")
            logging.error(f"No OpenAI API key configured for athlete {athlete_id} (checked personal and system settings)")
            return
        
        print(f"[SCHEDULER] OpenAI key found, calling API...")
        
        # Get coach language preference
        coach_language = athlete.get('coach_language', 'en')
        language_names = {
            'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German', 
            'it': 'Italian', 'pt': 'Portuguese', 'nl': 'Dutch', 'no': 'Norwegian',
            'sv': 'Swedish', 'da': 'Danish', 'fi': 'Finnish', 'pl': 'Polish',
            'ru': 'Russian', 'ja': 'Japanese', 'zh': 'Chinese', 'ko': 'Korean'
        }
        language_name = language_names.get(coach_language, 'English')
        
        # Prepare comprehensive context for OpenAI
        context = f"IMPORTANT: Respond in {language_name.upper()}. This is the athlete's preferred language for all coaching responses.\n\n"
        context += f"Athlete Profile:\n"
        context += f"- Name: {athlete.get('name', 'Unknown')}\n"
        context += f"- Age: {calculate_age(athlete.get('date_of_birth'))}\n" if athlete.get('date_of_birth') else ""
        context += f"- Gender: {athlete.get('gender', 'Not specified')}\n"
        context += f"- Goals: {', '.join(athlete.get('training_goals', [])) if athlete.get('training_goals') else 'None specified'}\n"
        
        # Add recent nutrition data
        if athlete_context.get('nutrition_entries'):
            context += f"\n📊 Recent Nutrition (last 7 days - {len(athlete_context['nutrition_entries'])} entries):\n"
            for entry in athlete_context['nutrition_entries'][:10]:  # Show up to 10 recent entries
                context += f"  - {entry.get('entry_date', 'Date unknown')} {entry.get('entry_time', '')}: {entry.get('meal_name', 'Unnamed meal')}\n"
                if entry.get('calories'):
                    context += f"    Calories: {entry.get('calories')}kcal, "
                if entry.get('protein'):
                    context += f"Protein: {entry.get('protein')}g, "
                if entry.get('carbs'):
                    context += f"Carbs: {entry.get('carbs')}g, "
                if entry.get('fat'):
                    context += f"Fat: {entry.get('fat')}g"
                context += "\n"
        
        # Add supplements data
        if athlete_context.get('supplements'):
            context += f"\n💊 Current Supplements ({len(athlete_context['supplements'])} supplements):\n"
            for supp in athlete_context['supplements']:
                context += f"  - {supp.get('name')}: {supp.get('dosage')} {supp.get('unit')}, {supp.get('frequency')}"
                if supp.get('time_of_day'):
                    context += f" ({supp.get('time_of_day')})"
                context += "\n"
        
        # Add recent supplement logs
        if athlete_context.get('supplement_logs'):
            context += f"\n📋 Recent Supplement Logs (last 7 days - {len(athlete_context['supplement_logs'])} logs):\n"
            for log in athlete_context['supplement_logs'][:10]:
                context += f"  - {log.get('date', 'Date unknown')} {log.get('time', '')}: {log.get('supplement_name')} ({log.get('dosage_taken')} {log.get('unit')})\n"
        
        # Add recent workouts
        if athlete_context.get('recent_workouts'):
            context += f"\n🏃 Recent Workouts (last 14 days - {len(athlete_context['recent_workouts'])} workouts):\n"
            for workout in athlete_context['recent_workouts'][:5]:  # Show up to 5 recent workouts
                context += f"  - {workout.get('date', 'Date unknown')}: {workout.get('type', 'Unknown type')}, "
                context += f"{workout.get('distance', 0)}km, {workout.get('duration', 0)}min\n"
        
        # Add recent sleep data
        if athlete_context.get('recent_sleep'):
            context += f"\n😴 Recent Sleep (last 7 days - {len(athlete_context['recent_sleep'])} nights):\n"
            for sleep in athlete_context['recent_sleep'][:5]:
                context += f"  - {sleep.get('date', 'Date unknown')}: {sleep.get('total_sleep_hours', 0)}h, quality: {sleep.get('sleep_quality', 'N/A')}/10\n"
        
        # Add readiness score
        if athlete_context.get('current_readiness'):
            readiness = athlete_context['current_readiness']
            context += f"\n📈 Current Readiness Score: {readiness.get('readiness_score', 'N/A')}/100\n"
        
        # Add recent journal entries
        if athlete_context.get('journal_entries'):
            context += f"\n📝 Recent Journal Entries (last 30 days - {len(athlete_context['journal_entries'])} entries)\n"
            for journal in athlete_context['journal_entries'][:3]:  # Show up to 3 recent entries
                context += f"  - {journal.get('date', 'Date unknown')}: {journal.get('content', '')[:100]}...\n"
        
        # Add the user's prompt/task
        context += f"\n🎯 Task: {prompt}\n"
        
        # Call OpenAI API using standard openai library
        openai_client = openai.OpenAI(api_key=openai_key)
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an AI running coach providing personalized training analysis and recommendations. You have access to the athlete's comprehensive data including nutrition, supplements, workouts, sleep, and journal entries. Use this data to provide specific, personalized insights."},
                {"role": "user", "content": context}
            ],
            temperature=0.7,
            max_tokens=1500
        )
        
        ai_response = response.choices[0].message.content
        print(f"[SCHEDULER] Got AI response: {ai_response[:100]}...")

        
        # Save as a recommendation
        recommendation = {
            "id": str(uuid.uuid4()),
            "athlete_id": athlete_id,
            "schedule_id": schedule_id,
            "title": title,
            "type": "scheduled_analysis",
            "priority": "medium",
            "summary": ai_response[:200] + "..." if len(ai_response) > 200 else ai_response,
            "content": ai_response,
            "tags": ["scheduled", "automated"],
            "scheduled_prompt": prompt,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "read": False
        }
        
        await db.recommendations.insert_one(recommendation)
        print(f"[SCHEDULER] Recommendation saved to database")
        
        # Send push notification
        await send_push_notification(
            athlete_id=athlete_id,
            title=f"New Report: {title}",
            body=recommendation['summary'],
            url="/dashboard/reports"
        )
        print(f"[SCHEDULER] Push notification sent")
        
        # Update schedule last_executed time
        await db.schedules.update_one(
            {"id": schedule_id},
            {"$set": {"last_executed": datetime.now(timezone.utc).isoformat()}}
        )
        
        print(f"[SCHEDULER] Successfully executed schedule {schedule_id}")
        logging.info(f"Successfully executed schedule {schedule_id} for athlete {athlete_id}")
        
    except Exception as e:
        print(f"[SCHEDULER] ERROR executing schedule {schedule_id}: {str(e)}")
        logging.error(f"Error executing schedule {schedule_id}: {str(e)}")
        import traceback
        traceback.print_exc()


async def check_and_execute_schedules():
    """Check for due schedules and execute them"""
    try:
        now_utc = datetime.now(timezone.utc)
        
        print(f"[SCHEDULER] Checking schedules at {now_utc.strftime('%H:%M')} UTC")
        
        # Find active schedules that are due
        schedules = await db.schedules.find({"active": True}).to_list(length=None)
        
        print(f"[SCHEDULER] Found {len(schedules)} active schedules")
        
        for schedule in schedules:
            schedule_time = schedule.get('time', '')
            frequency = schedule.get('frequency', 'daily')
            last_executed = schedule.get('last_executed')
            athlete_id = schedule.get('athlete_id')
            
            # Get athlete's timezone preference
            athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0, "timezone": 1})
            athlete_timezone_str = athlete.get('timezone', 'UTC') if athlete else 'UTC'
            
            # Convert current UTC time to athlete's timezone
            try:
                from zoneinfo import ZoneInfo
                athlete_tz = ZoneInfo(athlete_timezone_str)
                now_local = now_utc.astimezone(athlete_tz)
                current_time = now_local.strftime("%H:%M")
                current_day = now_local.strftime("%A").lower()
            except Exception as tz_error:
                # Fallback to UTC if timezone conversion fails
                print(f"[SCHEDULER] Timezone conversion error for {athlete_timezone_str}: {tz_error}. Using UTC.")
                current_time = now_utc.strftime("%H:%M")
                current_day = now_utc.strftime("%A").lower()
                athlete_timezone_str = "UTC"
            
            print(f"[SCHEDULER] Checking schedule '{schedule.get('name')}' - scheduled for {schedule_time} {athlete_timezone_str}, current time {current_time} {athlete_timezone_str}")
            
            # Check if schedule is due
            is_due = False
            
            # Check if time matches (within 1 minute window)
            if schedule_time:
                schedule_hour, schedule_minute = map(int, schedule_time.split(':'))
                current_hour, current_minute = map(int, current_time.split(':'))
                
                if schedule_hour == current_hour and abs(schedule_minute - current_minute) <= 1:
                    # Check frequency
                    if frequency == 'daily':
                        # Execute if not already executed today (in athlete's timezone)
                        if not last_executed:
                            is_due = True
                            print(f"[SCHEDULER] Schedule '{schedule.get('name')}' is due for execution (never executed)")
                        else:
                            # Convert last_executed to athlete's timezone for comparison
                            try:
                                last_exec_utc = datetime.fromisoformat(last_executed)
                                if last_exec_utc.tzinfo is None:
                                    last_exec_utc = last_exec_utc.replace(tzinfo=timezone.utc)
                                last_exec_local = last_exec_utc.astimezone(athlete_tz)
                                
                                # Check if last execution was on a different day in athlete's timezone
                                if last_exec_local.date() < now_local.date():
                                    is_due = True
                                    print(f"[SCHEDULER] Schedule '{schedule.get('name')}' is due for execution (last executed on {last_exec_local.date()}, now {now_local.date()})")
                            except Exception as date_error:
                                print(f"[SCHEDULER] Date comparison error: {date_error}")
                                # Fallback: execute if last_executed is more than 20 hours ago
                                if (now_utc - datetime.fromisoformat(last_executed).replace(tzinfo=timezone.utc)).total_seconds() > 72000:
                                    is_due = True
                                    
                    elif frequency == 'weekly':
                        # Execute if it's the right day and not executed this week
                        if current_day == schedule.get('day_of_week', '').lower():
                            if not last_executed or datetime.fromisoformat(last_executed).date() < now_local.date():
                                is_due = True
                                print(f"[SCHEDULER] Weekly schedule '{schedule.get('name')}' is due for execution")
            
            if is_due:
                print(f"[SCHEDULER] Executing schedule '{schedule.get('name')}'")
                await execute_scheduled_prompt(
                    schedule['id'],
                    schedule['athlete_id'],
                    schedule['prompt'],
                    schedule.get('name', 'Scheduled Analysis')
                )
    
    except Exception as e:
        logging.error(f"Error checking schedules: {str(e)}")

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
    weekly_mileage: float = Field(default=0.0)
    recent_race_time: Optional[str] = None
    running_goals: str = Field(default="General fitness")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Personal Information Fields
    nationality: Optional[str] = None  # Nationality/Country
    height: Optional[float] = None  # Height in cm or inches based on unit preference
    weight: Optional[float] = None  # Weight in kg or lbs based on unit preference  
    vo2_max: Optional[float] = None  # VO2 Max value
    max_heart_rate: Optional[int] = None  # Maximum heart rate in BPM
    gender: Optional[str] = None  # Gender: 'male', 'female', 'other', 'prefer_not_to_say'
    bio: Optional[str] = None  # Personal bio/description
    interests: Optional[list] = Field(default_factory=list)  # List of interests/activities
    
    # Community Profile Privacy Settings
    share_bio: bool = Field(default=True)  # Show bio on community profile
    share_goals: bool = Field(default=True)  # Show health/training goals on community profile
    share_interests: bool = Field(default=True)  # Show interests on community profile
    
    # Health & Nutrition Goals
    estimated_calorie_need: Optional[int] = None  # Daily calorie need (calculated or manual)
    weight_goal: Optional[str] = None  # 'decrease', 'maintain', 'increase'
    health_goals: Optional[list] = Field(default_factory=list)  # List of health goals (e.g., ['muscle_mass', 'speed', 'endurance'])
    
    # Dietary Restrictions & Preferences
    allergies: Optional[list] = Field(default_factory=list)  # List of allergens (e.g., ['dairy', 'eggs', 'nuts'])
    dietary_preferences: Optional[list] = Field(default_factory=list)  # List of diets (e.g., ['vegan', 'keto', 'gluten_free'])
    
    # Preferences
    distance_unit: str = Field(default="miles")  # 'miles' or 'km'
    measurement_system: str = Field(default="imperial")  # 'imperial' or 'metric'
    week_starts_on: str = Field(default="monday")  # 'sunday' or 'monday'
    
    # Admin Fields
    is_super_admin: bool = Field(default=False)  # Super admin flag
    timezone: str = Field(default="UTC")  # Timezone string (e.g., "America/New_York")
    time_format: str = Field(default="12h")  # '12h' or '24h'
    date_format: str = Field(default="MM/DD/YYYY")  # Date format preference
    weight_unit: str = Field(default="lbs")  # 'lbs' or 'kg'
    fluid_unit: str = Field(default="fl oz")  # 'fl oz' or 'ml'
    language: str = Field(default="en")  # Language code (e.g., "en", "no", "sv")
    coach_language: str = Field(default="en")  # Preferred language for AI coach responses
    voice_preference: str = Field(default="alloy")  # OpenAI voice: 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
    coach_name: str = Field(default="Coach")  # Custom name for AI coach
    coach_avatar: Optional[str] = None  # Custom avatar URL for AI coach
    
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
    entry_type: str = "text"  # 'text', 'voice', or 'video'
    video_path: Optional[str] = None  # Path to video file (for video entries)
    subtitle_path: Optional[str] = None  # Path to subtitle file (for video entries)
    has_burned_subtitles: Optional[bool] = False  # Whether subtitles are burned into video
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
    ingredients: Optional[List[str]] = None  # AI-generated ingredients list
    instructions: Optional[List[str]] = None  # AI-generated preparation instructions
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

class SupplementLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    supplement_ids: List[str]  # List of supplement IDs taken
    log_date: date  # Date when supplements were taken
    log_time: time  # Time when supplements were taken
    notes: Optional[str] = None  # Additional notes for this log
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class DrinkLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    drink_type: str  # 'water', 'coffee', 'tea', 'juice', 'sports_drink', 'milk', 'smoothie', 'other'
    amount_ml: int  # Amount in milliliters
    log_date: date  # Date when drink was consumed
    log_time: time  # Time when drink was consumed
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

class FileEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    file_type: str  # document, image, file
    description: str
    file_data: str  # base64 encoded file
    file_name: str
    entry_date: str  # YYYY-MM-DD
    entry_time: str  # HH:MM
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TestResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    test_name: str  # e.g., "Pull-ups", "5km Run", "Plank Hold"
    unit: str  # 'repetitions', 'time', 'distance', 'weight', 'other'
    result_value: float  # The actual test result (e.g., 20 for pull-ups, 1500 for 5km in seconds)
    time_to_completion: Optional[float] = None  # Optional time taken (in seconds)
    time_display_unit: Optional[str] = None  # For time-based tests: 'hours', 'minutes', 'seconds'
    goal_direction: Optional[str] = None  # 'higher' or 'lower' - whether higher/lower values are better
    notes: Optional[str] = None
    test_date: str  # ISO date string when test was performed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class Recipe(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    week_start_date: str  # ISO date string - Monday of the week this menu belongs to
    day_of_week: str  # 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
    meal_type: str  # 'breakfast', 'lunch', 'dinner'
    recipe_name: str
    ingredients: list  # List of ingredients with quantities
    instructions: str  # Step-by-step cooking instructions
    nutrition_info: dict  # {'calories': 500, 'protein': 30, 'carbs': 40, 'fat': 15}
    prep_time: int  # Minutes
    cook_time: int  # Minutes
    servings: int
    image_base64: Optional[str] = None  # AI-generated food image
    user_rating: Optional[int] = None  # 1-5 stars
    measurement_system: str = Field(default="imperial")  # 'imperial' or 'metric' - for consistent unit display
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    # Note: Recipes are saved individually and will be used for weekly menu building later

class WeeklyMenuMeal(BaseModel):
    """Individual meal slot in a weekly menu"""
    recipe_id: Optional[str] = None  # ID of the recipe assigned to this slot
    recipe_name: Optional[str] = None  # Cached recipe name for quick display
    nutrition_entry_id: Optional[str] = None  # ID of nutrition entry assigned to this slot
    meal_type: str  # 'breakfast', 'lunch', 'dinner'
    day_of_week: str  # 'monday', 'tuesday', etc.

class WeeklyMenu(BaseModel):
    """Template for weekly meal planning"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    menu_name: str  # e.g., "High Protein Week", "Recovery Week"
    description: Optional[str] = None
    meals: list[WeeklyMenuMeal]  # 21 slots (7 days × 3 meals)
    is_active: bool = Field(default=False)  # Only one menu can be active at a time
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
    nationality: Optional[str] = None
    
    # Personal Information Fields
    height: Optional[float] = None
    weight: Optional[float] = None
    vo2_max: Optional[float] = None
    max_heart_rate: Optional[int] = None
    gender: Optional[str] = None
    bio: Optional[str] = None
    interests: Optional[list] = None
    
    # Community Profile Privacy Settings
    share_bio: Optional[bool] = None
    share_goals: Optional[bool] = None
    share_interests: Optional[bool] = None
    
    # Health & Nutrition Goals
    estimated_calorie_need: Optional[int] = None
    weight_goal: Optional[str] = None
    health_goals: Optional[list] = None
    allergies: Optional[list] = None
    dietary_preferences: Optional[list] = None
    
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
    coach_language: Optional[str] = None
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

class GoogleLoginRequest(BaseModel):
    google_id: str
    email: str
    name: str
    picture: Optional[str] = None
    session_token: str

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

class ChangeEmailRequest(BaseModel):
    athlete_id: str
    new_email: str
    password: str

class EmailTemplate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    template_id: str  # e.g., 'reset_password', 'welcome', 'email_changed'
    subject: str
    body: str  # Plain text body
    html_body: str  # HTML body
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class EmailTemplateUpdate(BaseModel):
    template_id: str
    subject: str
    body: str
    html_body: str

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

class PushSubscription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    endpoint: str
    keys: dict  # Contains 'p256dh' and 'auth' keys
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    referral_code: Optional[str] = None  # Referral code for discount
    coupon_code: Optional[str] = None  # Coupon code for discount

class SubscriptionWebhookData(BaseModel):
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    subscription_tier: Optional[str] = None  # 'free', 'pro', 'premium'
    subscription_status: Optional[str] = None  # 'active', 'canceled', 'past_due', etc.
    subscription_current_period_end: Optional[str] = None

# Coupon Models
class Coupon(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str  # Coupon code (uppercase, unique)
    name: str  # Display name for admin
    type: str  # 'percentage' or 'fixed'
    value: float  # Percentage (0-100) or fixed amount
    currency: str = "usd"  # Currency for fixed amount coupons
    max_uses: Optional[int] = None  # None = unlimited
    current_uses: int = 0
    enabled: bool = True
    expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str  # Admin athlete_id
    applies_to: str = "all"  # 'subscriptions', 'one_time', or 'all'
    specific_plans: Optional[list] = None  # List of plan IDs (e.g., ['pro_monthly', 'premium_annual']) - None means all plans
    min_purchase_amount: Optional[float] = None  # Minimum purchase amount to apply coupon

class CouponUsage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    coupon_id: str
    coupon_code: str  # Denormalized for easier tracking
    athlete_id: Optional[str] = None  # User who used it (if logged in)
    session_id: str  # Stripe session ID
    discount_amount: float
    original_amount: float
    final_amount: float
    used_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Subscription Plan Models
class SubscriptionPlanVariation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    plan_id: str  # e.g., 'pro_monthly', 'premium_annual'
    name: str  # e.g., 'Pro Monthly'
    price: float
    interval: str  # 'month' or 'year'
    interval_count: int = 1
    stripe_price_id: Optional[str] = None
    enabled: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SubscriptionPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tier: str  # 'free', 'pro', 'premium', etc.
    name: str  # Display name
    description: Optional[str] = None
    features: list = []
    stripe_product_id: Optional[str] = None
    enabled: bool = True
    sort_order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Waiting List Model
class WaitingListEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    nationality: str
    status: str = "pending"  # pending, contacted, converted
    source: str = "homepage"  # homepage, referral, etc.
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Community Models
class CommunityPost(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    athlete_name: str  # Cached for display
    athlete_profile_picture: Optional[str] = None  # Cached for display
    content: str  # Post text content
    image_urls: Optional[List[str]] = []  # Array of image URLs (max 5) - DEPRECATED, use media
    media: Optional[List[dict]] = []  # Array of media items: [{"type": "image/video", "url": "...", "thumbnail": "..."}]
    visibility: str = "public"  # "public" or "private" (private = following feed only)
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_edited: bool = False
    # Share/Repost fields (Twitter-style quoted repost)
    shared_post_id: Optional[str] = None  # ID of original post being shared
    shared_post_data: Optional[dict] = None  # Embedded original post data for display
    # YouTube embed data
    youtube_data: Optional[dict] = None  # {"video_id": "...", "title": "...", "thumbnail": "...", "embed_url": "..."}
    # URL preview data
    url_preview: Optional[dict] = None  # {"url": "...", "title": "...", "description": "...", "image": "...", "site_name": "..."}

class CommunityComment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    post_id: str
    athlete_id: str
    athlete_name: str  # Cached for display
    athlete_profile_picture: Optional[str] = None  # Cached for display
    content: str
    image_urls: Optional[List[str]] = []  # Array of image URLs (max 3 for comments)
    likes_count: int = 0  # Number of likes on this comment
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CommunityLike(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    post_id: str
    athlete_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CommunityCommentLike(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    comment_id: str
    athlete_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CommunityShare(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    post_id: str
    athlete_id: str  # User who shared
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CommunityNotification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str  # Recipient of notification
    type: str  # 'like', 'comment', 'share', 'mention', 'follow', 'group_join_request', 'event_invite'
    content: str  # Notification message
    post_id: Optional[str] = None
    group_id: Optional[str] = None
    event_id: Optional[str] = None
    from_athlete_id: Optional[str] = None
    from_athlete_name: Optional[str] = None
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Follow(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    follower_id: str  # User who is following
    following_id: str  # User being followed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Referral(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    referrer_id: str  # User who created the referral
    referral_code: str  # Unique referral code (e.g., TRAIN3E4EE10D)
    referred_user_id: Optional[str] = None  # User who signed up (null until conversion)
    referred_user_email: Optional[str] = None  # Email of referred user
    status: str = "pending"  # pending, converted, rewarded
    click_count: int = 0  # Number of times link was clicked
    ip_addresses: List[str] = []  # Track IPs for fraud detection
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    converted_at: Optional[datetime] = None  # When referred user signed up
    rewarded_at: Optional[datetime] = None  # When referrer received reward

class ReferralReward(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str  # User receiving the reward
    referral_id: str  # Which referral earned this reward
    discount_percentage: int = 20  # Percentage discount
    stripe_coupon_id: Optional[str] = None  # Stripe coupon ID
    stripe_promotion_code: Optional[str] = None  # User-facing code
    status: str = "pending"  # pending, applied, expired
    expires_at: Optional[datetime] = None  # When reward expires
    applied_at: Optional[datetime] = None  # When reward was used
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Group(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    privacy: str  # 'public' or 'private'
    profile_image: Optional[str] = None  # Base64 encoded image (group avatar)
    cover_photo: Optional[str] = None  # Base64 encoded image (banner)
    rules: Optional[str] = None  # Optional group rules that must be accepted
    admin_id: str  # Creator/admin of the group
    members_count: int = 1  # Starts with admin
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class GroupMembership(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group_id: str
    athlete_id: str
    role: str  # 'admin', 'manager', 'moderator', 'member'
    status: str  # 'pending', 'approved'
    rules_accepted: bool = False  # Whether user accepted group rules
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GroupPost(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group_id: str
    athlete_id: str
    athlete_name: str  # Cached for display
    athlete_profile_picture: Optional[str] = None  # Cached for display
    content: str  # Post text content
    image_data: Optional[str] = None  # Base64 encoded image (optional)
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_edited: bool = False


# Event Models
class Event(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    visibility: str  # 'open', 'private'
    event_date: str  # ISO format date
    event_time: str  # HH:MM format
    location: Optional[str] = None
    profile_image: Optional[str] = None
    cover_photo: Optional[str] = None
    group_id: Optional[str] = None  # Connected group (optional)
    creator_id: str
    interested_count: int = 0
    going_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class EventAttendance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_id: str
    athlete_id: str
    status: str  # 'interested', 'going', 'not_going'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Challenge(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    challenge_type: str  # 'distance', 'activity_count', 'duration'
    goal_value: float  # Target value (km for distance, count for activities, minutes for duration)
    goal_unit: str  # 'km', 'activities', 'minutes'
    time_period: str = 'total'  # 'total', 'daily', 'weekly', 'monthly' - how often to reach the goal
    start_date: str  # ISO format date
    end_date: str  # ISO format date
    visibility: str  # 'public', 'private'
    competition_type: str  # 'individual', 'team'
    cover_photo: Optional[str] = None
    trophy_image: Optional[str] = None  # Badge/trophy image for completed challenges
    creator_id: str
    creator_name: str
    creator_profile_picture: Optional[str] = None
    participants_count: int = 0
    is_recurring: bool = False
    recurrence_frequency: Optional[str] = None  # 'daily', 'weekly', 'monthly'
    recurrence_count: Optional[int] = None  # How many times to repeat
    group_id: Optional[str] = None  # Optional group association
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class ChallengeParticipation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    challenge_id: str
    athlete_id: str
    athlete_name: str
    athlete_profile_picture: Optional[str] = None
    current_progress: float = 0.0  # Current progress value
    percentage_complete: float = 0.0  # Calculated percentage
    rank: Optional[int] = None  # Position in leaderboard
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChallengeComment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    challenge_id: str
    athlete_id: str
    athlete_name: str
    athlete_profile_picture: Optional[str] = None
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChallengeAchievement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    challenge_id: str
    challenge_title: str
    challenge_type: str
    trophy_image: Optional[str] = None
    athlete_id: str
    athlete_name: str
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    final_value: float  # Final progress value achieved

class ContentBlock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content: str  # Rich text HTML content
    order: int = 0

class MenuItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    url: str
    order: int = 0
    is_separator: bool = False  # Only for slideout menu
    icon: Optional[str] = None  # Icon name (Lucide icon)
    highlighted: bool = False  # Highlight menu item with accent color
    highlight_color: Optional[str] = None  # Custom highlight color (hex)

class MenuSettings(BaseModel):
    header_logged_out: List[MenuItem] = []
    header_logged_in: List[MenuItem] = []
    slideout_menu: List[MenuItem] = []

class Page(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    url_slug: str  # URL path, e.g., "/pricing" or "/about"
    is_home: bool = False  # True if this is the home page (url_slug will be "/")
    thumbnail: Optional[str] = None  # Path to thumbnail image
    status: str = "draft"  # draft, pending, published, scheduled
    index_status: str = "indexed"  # indexed, no-index
    scheduled_at: Optional[datetime] = None  # For scheduled status
    
    # CMS flexible content
    use_cms_content: bool = False  # Toggle between hard-coded and CMS content
    content_blocks: List[ContentBlock] = []  # Repeater blocks with rich text
    
    # SEO fields
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    focus_keyword: Optional[str] = None
    og_image: Optional[str] = None  # Open Graph image
    
    # Page content (can be extended later for full content management)
    content: Optional[str] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None  # athlete_id
    last_modified_by: Optional[str] = None  # athlete_id

class PageCreate(BaseModel):
    title: str
    url_slug: Optional[str] = None
    is_home: bool = False
    thumbnail: Optional[str] = None
    status: str = "draft"
    index_status: str = "indexed"
    scheduled_at: Optional[datetime] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    focus_keyword: Optional[str] = None
    og_image: Optional[str] = None
    content: Optional[str] = None
    use_cms_content: bool = False
    content_blocks: List[ContentBlock] = []

class PageUpdate(BaseModel):
    title: Optional[str] = None
    url_slug: Optional[str] = None
    is_home: Optional[bool] = None
    thumbnail: Optional[str] = None
    status: Optional[str] = None
    index_status: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    focus_keyword: Optional[str] = None
    og_image: Optional[str] = None
    content: Optional[str] = None
    use_cms_content: Optional[bool] = None
    content_blocks: Optional[List[ContentBlock]] = None


# AI Coach Service
class AICoachService:
    def __init__(self):
        # API key will be provided per-athlete from their settings
        self.api_key = None
        
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
            # Use OpenAI key (personal or global) if available, otherwise Emergent
            openai_key = await self.get_openai_key(athlete_id)
            
            if openai_key:
                import openai
                client = openai.AsyncOpenAI(api_key=openai_key)
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
        
        # Get recent journal entries (last 30 days) - sort by created_at DESC to get newest first
        journal_entries = await db.journal_entries.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(30).to_list(length=None)
        
        # Get recent nutrition entries (last 7 days) - sort by created_at DESC to get newest first
        nutrition_entries = await db.nutrition_entries.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(50).to_list(length=None)
        
        # Get supplements (active supplements the athlete is taking)
        supplements = await db.supplements.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).to_list(length=None)
        
        # Get recent supplement logs (last 7 days)
        supplement_logs = await db.supplement_logs.find(
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
            "supplements": supplements,
            "supplement_logs": supplement_logs,
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
        """Get user's personal OpenAI API key if available (legacy method for backwards compatibility)"""
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
    
    async def get_global_openai_key(self) -> Optional[str]:
        """Get global OpenAI API key from system settings"""
        try:
            settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
            
            if not settings:
                logging.info("No system settings found")
                return None
            
            # Check for key in advanced settings (new location)
            api_key = settings.get("advanced", {}).get("openaiApiKey")
            
            # Fallback to old location for backwards compatibility
            if not api_key:
                api_key = settings.get("openaiApiKey")
            
            # Ensure we have a valid, non-empty API key
            if not api_key or not api_key.strip():
                logging.info("System settings exist but OpenAI API key is empty")
                return None
            
            # Basic validation - OpenAI keys should start with sk-
            if not api_key.startswith("sk-"):
                logging.warning("Invalid OpenAI API key format in system settings")
                return None
            
            return api_key.strip()
        except Exception as e:
            logging.error(f"Error retrieving global OpenAI key: {e}")
            return None
    
    async def get_openai_key(self, athlete_id: str) -> Optional[str]:
        """Get OpenAI API key - checks user's personal key first, then falls back to global key"""
        # First try to get user's personal key (for backwards compatibility)
        user_key = await self.get_user_openai_key(athlete_id)
        if user_key:
            logging.info(f"Using personal OpenAI key for athlete {athlete_id}")
            return user_key
        
        # If no personal key, try global key from system settings
        global_key = await self.get_global_openai_key()
        if global_key:
            logging.info(f"Using global OpenAI key for athlete {athlete_id}")
            return global_key
        
        logging.info(f"No OpenAI key found (personal or global) for athlete {athlete_id}")
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
        coach_language = athlete_info.get('coach_language', 'en')
        
        # Language name mapping for system prompt
        language_names = {
            'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German', 
            'it': 'Italian', 'pt': 'Portuguese', 'nl': 'Dutch', 'no': 'Norwegian',
            'sv': 'Swedish', 'da': 'Danish', 'fi': 'Finnish', 'pl': 'Polish',
            'ru': 'Russian', 'ja': 'Japanese', 'zh': 'Chinese', 'ko': 'Korean'
        }
        language_name = language_names.get(coach_language, 'English')
        
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
        
        # Provide detailed journal entries with full content
        journal_entries = context.get('journal_entries', [])
        print(f"🔍 DEBUG: Found {len(journal_entries)} journal entries for athlete")
        if journal_entries:
            print(f"📋 First entry sample: {journal_entries[0]}")
        journal_summary = ""
        if journal_entries:
            journal_summary = f"\n\nJOURNAL ENTRIES ({len(journal_entries)} in last 30 days):\n"
            # Include full content of recent entries (up to last 20 for consistency with nutrition)
            for idx, entry in enumerate(journal_entries[:20]):
                date = entry.get('date', 'Unknown date')
                time = entry.get('time', '')
                content = entry.get('entry', '')
                entry_type = entry.get('entry_type', 'text')
                transcription = entry.get('transcription', '')
                mood = entry.get('mood', '')
                tags = entry.get('tags', [])
                
                print(f"📄 Entry {idx}: date={date}, type={entry_type}, content_len={len(content)}, transcription_len={len(transcription)}")
                
                # Use transcription for voice/video entries if available
                entry_text = transcription if entry_type in ['voice', 'video'] and transcription else content
                
                if entry_text:
                    # Build metadata
                    metadata = []
                    if mood:
                        metadata.append(f"Mood: {mood}")
                    if tags:
                        metadata.append(f"Tags: {', '.join(tags)}")
                    
                    time_str = f" at {time}" if time else ""
                    metadata_str = f" [{', '.join(metadata)}]" if metadata else ""
                    
                    entry_line = f"\n[{date}{time_str}] {entry_type.upper()}{metadata_str}:\n{entry_text}\n"
                    journal_summary += entry_line
                    print(f"📝 Adding journal entry: {entry_line[:100]}...")
        else:
            journal_summary = "\n\nNo journal entries available."
        
        # Provide detailed nutrition entries (meals, drinks, supplements)
        nutrition_entries = context.get('nutrition_entries', [])
        nutrition_summary = ""
        if nutrition_entries:
            nutrition_summary = f"\n\nNUTRITION LOG ({len(nutrition_entries)} entries in last 7 days):\n"
            # Include full details of recent entries (up to last 20)
            for idx, entry in enumerate(nutrition_entries[:20]):
                entry_date = entry.get('entry_date', entry.get('date', 'Unknown date'))
                entry_time = entry.get('entry_time', '')
                entry_type = entry.get('entry_type', 'food')  # food, drink, supplement
                description = entry.get('description', '')
                
                # Build entry details
                details = []
                if entry.get('calories'):
                    details.append(f"{entry['calories']} cal")
                if entry.get('protein'):
                    details.append(f"{entry['protein']}g protein")
                if entry.get('carbs'):
                    details.append(f"{entry['carbs']}g carbs")
                if entry.get('fat'):
                    details.append(f"{entry['fat']}g fat")
                if entry.get('quantity'):
                    details.append(f"{entry['quantity']} {entry.get('unit', '')}")
                
                details_str = f" ({', '.join(details)})" if details else ""
                time_str = f" at {entry_time}" if entry_time else ""
                
                nutrition_summary += f"\n[{entry_date}{time_str}] {entry_type.upper()}: {description}{details_str}\n"
            
            # Add summary statistics
            total_cals = sum(n.get('calories', 0) for n in nutrition_entries if n.get('calories'))
            total_protein = sum(n.get('protein', 0) for n in nutrition_entries if n.get('protein'))
            total_carbs = sum(n.get('carbs', 0) for n in nutrition_entries if n.get('carbs'))
            total_fat = sum(n.get('fat', 0) for n in nutrition_entries if n.get('fat'))
            days_tracked = len(set(n.get('entry_date') for n in nutrition_entries if n.get('entry_date')))
            if days_tracked > 0:
                nutrition_summary += f"\n7-DAY AVERAGE: {total_cals/days_tracked:.0f}cal, {total_protein/days_tracked:.0f}g protein, {total_carbs/days_tracked:.0f}g carbs, {total_fat/days_tracked:.0f}g fat per day\n"
        else:
            nutrition_summary = "\n\nNo nutrition logs available."
        
        # Summarize supplements
        supplements = context.get('supplements', [])
        supplement_logs = context.get('supplement_logs', [])
        supplement_summary = ""
        if supplements:
            supplement_summary = f"{len(supplements)} supplements registered: " + ", ".join([f"{s.get('name')} ({s.get('dosage')} {s.get('unit')})" for s in supplements[:5]])
        if supplement_logs:
            supplement_summary += f" | {len(supplement_logs)} supplement logs in last 7 days"
        if not supplement_summary:
            supplement_summary = "No supplements tracked"
        
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
- Preferred Language: {language_name} (RESPOND IN {language_name.upper()} - all responses must be in this language)
{memory_summary}

RECENT ACTIVITY SUMMARY:
- Workouts: {workout_summary}
- Sleep: {sleep_summary}
- Readiness: {readiness_summary}
- Journal: {journal_summary}
- Nutrition: {nutrition_summary}
- Supplements: {supplement_summary}
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
            # Check for OpenAI API key (personal or global)
            openai_key = await self.get_openai_key(athlete_id)
            
            if not openai_key:
                print(f"❌ ERROR: No OpenAI API key found for athlete {athlete_id}")
                logging.error(f"No OpenAI API key found for athlete {athlete_id}")
                return "I need an OpenAI API key to function properly. Please ask your administrator to add a global OpenAI API key in System Settings → Advanced tab to enable all features including calendar management, web search, and training plan creation."
            
            # Use OpenAI API key with function calling
            import openai
            
            print(f"✅ Using OpenAI API key for athlete {athlete_id}")
            logging.info(f"Using OpenAI API key for athlete {athlete_id}")
            client = openai.AsyncOpenAI(api_key=openai_key)
            
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
        # Credentials will be loaded from system_settings at runtime
        pass
    
    async def get_system_credentials(self):
        """Get Oura credentials from system settings"""
        system_settings = await db.system_settings.find_one({"category": "advanced"})
        if not system_settings or not system_settings.get("oura"):
            raise HTTPException(status_code=404, detail="Oura credentials not configured in System Settings")
        
        oura_config = system_settings["oura"]
        if not oura_config.get("clientId") or not oura_config.get("clientSecret"):
            raise HTTPException(status_code=404, detail="Oura Client ID or Secret missing")
        
        callback_domain = oura_config.get("callbackDomain", "kaizenlifetracker.com")
        return {
            "client_id": oura_config["clientId"],
            "client_secret": oura_config["clientSecret"],
            "redirect_uri": f"https://{callback_domain}/api/auth/oura/callback"
        }
        
    async def exchange_code_for_tokens(self, auth_code: str) -> Dict[str, Any]:
        """Exchange authorization code for access and refresh tokens"""
        credentials = await self.get_system_credentials()
        
        token_data = {
            "grant_type": "authorization_code",
            "code": auth_code,
            "redirect_uri": credentials["redirect_uri"],
            "client_id": credentials["client_id"],
            "client_secret": credentials["client_secret"]
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
        credentials = await self.get_system_credentials()
        
        refresh_data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": credentials["client_id"],
            "client_secret": credentials["client_secret"]
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
    
    # Send welcome email
    email_service = get_email_service()
    if email_service.enabled:
        try:
            email_service.send_welcome_email(
                to_email=profile.email,
                user_name=profile.name
            )
            logging.info(f"Welcome email sent to {profile.email}")
        except Exception as e:
            logging.error(f"Failed to send welcome email: {e}")
            # Don't fail signup if email sending fails
    
    # Retrieve the created profile and return it properly parsed
    created_profile = await db.athlete_profiles.find_one({"id": profile.id}, {"_id": 0})
    return parse_from_mongo(created_profile)

@api_router.post("/auth/login")
async def login_athlete(login_data: LoginRequest):
    """Login athlete by email and password"""
    # Try athlete_profiles first (new collection)
    athlete = await db.athlete_profiles.find_one(
        {"email": login_data.email.lower().strip()}, 
        {"_id": 0}
    )
    
    # Fallback to athletes collection (legacy)
    if not athlete:
        athlete = await db.athletes.find_one(
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

@api_router.post("/auth/google-login")
async def google_login(google_data: GoogleLoginRequest):
    """Handle Google OAuth login/registration"""
    email = google_data.email.lower().strip()
    
    # Check if user already exists
    existing_athlete = await db.athlete_profiles.find_one(
        {"email": email},
        {"_id": 0}
    )
    
    is_new_user = False
    
    if existing_athlete:
        # Existing user - update Google ID if not set
        athlete_id = existing_athlete["id"]
        if not existing_athlete.get("google_id"):
            await db.athlete_profiles.update_one(
                {"id": athlete_id},
                {"$set": {"google_id": google_data.google_id, "picture": google_data.picture}}
            )
    else:
        # New user - create profile
        is_new_user = True
        athlete_id = str(uuid.uuid4())
        new_athlete = {
            "id": athlete_id,
            "email": email,
            "name": google_data.name,
            "google_id": google_data.google_id,
            "picture": google_data.picture,
            "password": "",  # No password for Google users
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.athlete_profiles.insert_one(new_athlete)
    
    # Store session token in database
    session_expires = datetime.now(timezone.utc) + timedelta(days=7)
    session_data = {
        "id": str(uuid.uuid4()),
        "athlete_id": athlete_id,
        "session_token": google_data.session_token,
        "expires_at": session_expires.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.auth_sessions.insert_one(session_data)
    
    return {
        "athlete_id": athlete_id,
        "is_new_user": is_new_user,
        "name": google_data.name,
        "email": email
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
    
    # Send password reset email
    email_service = get_email_service()
    if email_service.enabled:
        try:
            # Get the frontend URL from environment or use default
            frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
            reset_url = f"{frontend_url}/reset-password"
            
            email_service.send_password_reset_email(
                to_email=request.email,
                reset_token=reset_token,
                reset_url=reset_url
            )
            logging.info(f"Password reset email sent to {request.email}")
        except Exception as e:
            logging.error(f"Failed to send password reset email: {e}")
            # Don't fail the request if email sending fails
    
    return {
        "message": "If the email exists, a reset link will be sent",
        # In development, optionally return the token for testing
        **({"reset_token": reset_token} if os.getenv('ENVIRONMENT') == 'development' else {})
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
    
    # Send password change notification email
    email_service = get_email_service()
    if email_service.enabled:
        try:
            user_name = athlete.get("name", "User")
            user_email = athlete.get("email")
            
            html_content = f"""
            <html>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0;">Password Changed</h1>
                    </div>
                    <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 10px 10px;">
                        <p style="font-size: 16px; color: #333;">Hi {user_name},</p>
                        <p style="font-size: 16px; color: #333;">
                            This is to confirm that your password has been successfully changed.
                        </p>
                        <p style="font-size: 14px; color: #666;">
                            If you did not make this change, please contact support immediately and reset your password.
                        </p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/forgot-password" 
                               style="background: #00C2A8; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                                Reset Password
                            </a>
                        </div>
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                        <p style="font-size: 12px; color: #999; text-align: center;">
                            TrainSmart - Your Personal Fitness Companion<br>
                            This is an automated message, please do not reply.
                        </p>
                    </div>
                </body>
            </html>
            """
            
            email_service.send_email(
                to_email=user_email,
                subject="Password Changed",
                html_content=html_content
            )
            
            logging.info(f"Password change notification sent to {user_email}")
        except Exception as e:
            logging.error(f"Failed to send password change notification: {e}")
            # Don't fail the request if email sending fails
    
    return {"message": "Password changed successfully"}

@api_router.post("/auth/change-email")
async def change_email(request: ChangeEmailRequest):
    """Change email for logged-in user"""
    # Find athlete
    athlete = await db.athlete_profiles.find_one(
        {"id": request.athlete_id}, 
        {"_id": 0}
    )
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    # Verify password
    if not pwd_context.verify(request.password, athlete["password"]):
        raise HTTPException(status_code=401, detail="Password is incorrect")
    
    # Check if new email is already in use by another user
    existing_user = await db.athlete_profiles.find_one(
        {"email": request.new_email.lower()},
        {"_id": 0, "id": 1}
    )
    if existing_user and existing_user["id"] != request.athlete_id:
        raise HTTPException(status_code=400, detail="Email already in use")
    
    # Check athletes collection as well for backward compatibility
    existing_athlete = await db.athletes.find_one(
        {"email": request.new_email.lower()},
        {"_id": 0, "id": 1}
    )
    if existing_athlete and existing_athlete["id"] != request.athlete_id:
        raise HTTPException(status_code=400, detail="Email already in use")
    
    # Store old email for notification
    old_email = athlete["email"]
    
    # Update email in both collections
    await db.athlete_profiles.update_one(
        {"id": request.athlete_id},
        {"$set": {"email": request.new_email.lower()}}
    )
    
    await db.athletes.update_one(
        {"id": request.athlete_id},
        {"$set": {"email": request.new_email.lower()}}
    )
    
    # Send email notifications to both old and new addresses
    email_service = get_email_service()
    if email_service.enabled:
        try:
            user_name = athlete.get("name", "User")
            
            # Email to old address
            old_email_html = f"""
            <html>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0;">Email Address Changed</h1>
                    </div>
                    <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 10px 10px;">
                        <p style="font-size: 16px; color: #333;">Hi {user_name},</p>
                        <p style="font-size: 16px; color: #333;">
                            This is to confirm that your email address has been changed from <strong>{old_email}</strong> to <strong>{request.new_email}</strong>.
                        </p>
                        <p style="font-size: 14px; color: #666;">
                            If you did not make this change, please contact support immediately.
                        </p>
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                        <p style="font-size: 12px; color: #999; text-align: center;">
                            TrainSmart - Your Personal Fitness Companion<br>
                            This is an automated message, please do not reply.
                        </p>
                    </div>
                </body>
            </html>
            """
            
            # Email to new address
            new_email_html = f"""
            <html>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0;">Email Address Updated</h1>
                    </div>
                    <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 10px 10px;">
                        <p style="font-size: 16px; color: #333;">Hi {user_name},</p>
                        <p style="font-size: 16px; color: #333;">
                            Welcome to your new email address! Your TrainSmart account email has been successfully updated to <strong>{request.new_email}</strong>.
                        </p>
                        <p style="font-size: 14px; color: #666;">
                            You can now use this email address to log in to your account.
                        </p>
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                        <p style="font-size: 12px; color: #999; text-align: center;">
                            TrainSmart - Your Personal Fitness Companion<br>
                            This is an automated message, please do not reply.
                        </p>
                    </div>
                </body>
            </html>
            """
            
            # Send to old email
            email_service.send_email(
                to_email=old_email,
                subject="Email Address Changed",
                html_content=old_email_html
            )
            
            # Send to new email
            email_service.send_email(
                to_email=request.new_email,
                subject="Email Address Updated",
                html_content=new_email_html
            )
            
            logging.info(f"Email change notifications sent for athlete {request.athlete_id}")
        except Exception as e:
            logging.error(f"Failed to send email change notification: {e}")
            # Don't fail the request if email sending fails
    
    return {"message": "Email changed successfully"}

@api_router.get("/athlete/{athlete_id}")
async def get_athlete_profile(athlete_id: str):
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    return parse_from_mongo(athlete)

async def cascade_profile_picture_update(athlete_id: str, new_profile_picture: str):
    """Update profile picture across all posts, comments, and other user content"""
    try:
        # Update community posts
        posts_result = await db.community_posts.update_many(
            {"athlete_id": athlete_id},
            {"$set": {"athlete_profile_picture": new_profile_picture}}
        )
        logging.info(f"[CASCADE] Updated profile picture in {posts_result.modified_count} community posts for athlete {athlete_id}")
        
        # Update community comments
        comments_result = await db.community_comments.update_many(
            {"athlete_id": athlete_id},
            {"$set": {"athlete_profile_picture": new_profile_picture}}
        )
        logging.info(f"[CASCADE] Updated profile picture in {comments_result.modified_count} community comments for athlete {athlete_id}")
        
        # Update group posts
        group_posts_result = await db.community_group_posts.update_many(
            {"athlete_id": athlete_id},
            {"$set": {"athlete_profile_picture": new_profile_picture}}
        )
        logging.info(f"[CASCADE] Updated profile picture in {group_posts_result.modified_count} group posts for athlete {athlete_id}")
        
        # Update challenge participations
        challenge_participations_result = await db.community_challenge_participations.update_many(
            {"athlete_id": athlete_id},
            {"$set": {"athlete_profile_picture": new_profile_picture}}
        )
        logging.info(f"[CASCADE] Updated profile picture in {challenge_participations_result.modified_count} challenge participations for athlete {athlete_id}")
        
        # Update challenge comments
        challenge_comments_result = await db.community_challenge_comments.update_many(
            {"athlete_id": athlete_id},
            {"$set": {"athlete_profile_picture": new_profile_picture}}
        )
        logging.info(f"[CASCADE] Updated profile picture in {challenge_comments_result.modified_count} challenge comments for athlete {athlete_id}")
        
        # Update challenges where user is creator
        challenges_result = await db.community_challenges.update_many(
            {"creator_id": athlete_id},
            {"$set": {"creator_profile_picture": new_profile_picture}}
        )
        logging.info(f"[CASCADE] Updated profile picture in {challenges_result.modified_count} challenges as creator for athlete {athlete_id}")
        
        # Update notifications (from_athlete_profile_picture is not in the model - skip)
        # The CommunityNotification model doesn't have from_athlete_profile_picture field
        # Notifications should fetch profile picture from athlete_profiles at read time
        
        total_updated = (
            posts_result.modified_count + 
            comments_result.modified_count + 
            group_posts_result.modified_count +
            challenge_participations_result.modified_count +
            challenge_comments_result.modified_count +
            challenges_result.modified_count
        )
        
        logging.info(f"[CASCADE] TOTAL: Updated profile picture in {total_updated} records across all collections for athlete {athlete_id}")
        
        return {
            "community_posts": posts_result.modified_count,
            "community_comments": comments_result.modified_count,
            "community_group_posts": group_posts_result.modified_count,
            "community_challenge_participations": challenge_participations_result.modified_count,
            "community_challenge_comments": challenge_comments_result.modified_count,
            "community_challenges": challenges_result.modified_count,
            "total": total_updated
        }
    except Exception as e:
        logging.error(f"[CASCADE] Error cascading profile picture update: {e}")
        return None

@api_router.put("/athlete/{athlete_id}", response_model=AthleteProfile)
async def update_athlete_profile(athlete_id: str, updates: AthleteUpdate):
    """Update athlete profile with partial data"""
    # Get current athlete
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    # Log incoming data for debugging
    logging.info(f"[ATHLETE UPDATE] Updating athlete {athlete_id}")
    logging.info(f"[ATHLETE UPDATE] Raw updates: {updates.model_dump()}")
    logging.info(f"[ATHLETE UPDATE] Allergies: {updates.allergies}")
    logging.info(f"[ATHLETE UPDATE] Dietary preferences: {updates.dietary_preferences}")
    
    # Update only provided fields (include empty lists, exclude None)
    update_data = {}
    for k, v in updates.model_dump(exclude_unset=True).items():
        if v is not None or k in ['allergies', 'dietary_preferences', 'health_goals']:
            update_data[k] = v if v is not None else []
    
    logging.info(f"[ATHLETE UPDATE] Final update_data: {update_data}")
    
    # If date_of_birth is being updated, calculate and set age
    if 'date_of_birth' in update_data and update_data['date_of_birth']:
        calculated_age = calculate_age(update_data['date_of_birth'])
        if calculated_age is not None:
            update_data['age'] = calculated_age
    
    # Convert date objects to ISO strings for MongoDB storage
    if update_data:
        prepared_data = prepare_for_mongo(update_data)
        logging.info(f"[ATHLETE UPDATE] Prepared data for MongoDB: {prepared_data}")
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": prepared_data}
        )
        
        # If profile picture was updated, cascade the update to all user content
        if 'profile_picture' in prepared_data:
            cascade_result = await cascade_profile_picture_update(athlete_id, prepared_data['profile_picture'])
            if cascade_result:
                logging.info(f"[PROFILE PICTURE CASCADE] Updated across collections: {cascade_result}")
    
    # Return updated athlete
    updated_athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    logging.info(f"[ATHLETE UPDATE] Updated allergies: {updated_athlete.get('allergies')}")
    logging.info(f"[ATHLETE UPDATE] Updated dietary_preferences: {updated_athlete.get('dietary_preferences')}")
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
        
        # Cascade the profile picture update to all user content
        cascade_result = await cascade_profile_picture_update(athlete_id, profile_picture)
        if cascade_result:
            logging.info(f"[PROFILE PICTURE CASCADE] Updated across collections: {cascade_result}")
        
        return {"success": True, "message": "Profile picture updated successfully", "profile_picture": profile_picture}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading profile picture: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload profile picture")

@api_router.post("/athlete/{athlete_id}/coach-avatar")
async def upload_coach_avatar(athlete_id: str, file: UploadFile = File(...)):
    """Upload and update AI coach avatar"""
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
            
            # Convert to RGB if needed
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
            x = (200 - image.width) // 2
            y = (200 - image.height) // 2
            canvas.paste(image, (x, y))
            
            # Convert to base64
            buffer = io.BytesIO()
            canvas.save(buffer, format='JPEG', quality=85)
            image_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
            coach_avatar = f"data:image/jpeg;base64,{image_data}"
            
        except Exception as e:
            logging.error(f"Error processing coach avatar: {e}")
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Update athlete profile with new coach avatar
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": {"coach_avatar": coach_avatar}}
        )
        
        return {"success": True, "message": "Coach avatar updated successfully", "coach_avatar": coach_avatar}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading coach avatar: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload coach avatar")

@api_router.post("/athlete/{athlete_id}/background-image")
async def upload_background_image(athlete_id: str, file: UploadFile = File(...)):
    """Upload and update custom background image"""
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
            
            # Convert to RGB if needed
            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = background
            
            # Resize to 1920px width (standard desktop size), maintaining aspect ratio
            max_width = 1920
            if image.width > max_width:
                ratio = max_width / image.width
                new_height = int(image.height * ratio)
                image = image.resize((max_width, new_height), Image.Resampling.LANCZOS)
            
            # Convert to base64
            buffer = io.BytesIO()
            image.save(buffer, format='JPEG', quality=85)
            image_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
            background_image = f"data:image/jpeg;base64,{image_data}"
            
        except Exception as e:
            logging.error(f"Error processing background image: {e}")
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Update athlete profile with new background image
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": {"background_image": background_image}}
        )
        
        return {"success": True, "message": "Background image updated successfully", "background_image": background_image}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading background image: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload background image")

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
    
    # Get Stripe settings from system_settings
    system_settings = await db.system_settings.find_one({}, {"_id": 0})
    if not system_settings:
        raise HTTPException(status_code=500, detail="System settings not found")
    
    stripe_settings = system_settings.get("advanced", {}).get("stripe", {})
    stripe_mode = stripe_settings.get("mode", "test")
    
    # Get the appropriate API key based on mode
    if stripe_mode == "live":
        stripe_secret_key = stripe_settings.get("live", {}).get("apiKey") or stripe_settings.get("live", {}).get("secretKey")
    else:
        stripe_secret_key = stripe_settings.get("sandbox", {}).get("apiKey") or stripe_settings.get("sandbox", {}).get("secretKey")
    
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail=f"Stripe API key not configured for {stripe_mode} mode")
    
    stripe.api_key = stripe_secret_key
    
    # Fetch subscription plans from database to get synced Stripe price IDs
    all_plans = await db.subscription_plans.find({"enabled": True}, {"_id": 0}).to_list(length=None)
    
    # Find the matching variation by plan_id (format: tier_interval, e.g., "pro_monthly" or "pro_annual")
    # Normalize interval: "monthly" -> "month", "annual" -> "year"
    plan = None
    stripe_price_id = None
    tier = None
    interval = None
    price = None
    
    for db_plan in all_plans:
        variations = db_plan.get("variations", [])
        for variation in variations:
            db_interval = variation.get("interval")  # "month" or "year" from database
            # Match plan_id with both formats: "pro_month"/"pro_year" AND "pro_monthly"/"pro_annual"
            variation_id_month = f"{db_plan.get('tier')}_{db_interval}"  # "pro_month"
            variation_id_ly = f"{db_plan.get('tier')}_{'monthly' if db_interval == 'month' else 'annual'}"  # "pro_monthly"
            
            if request.plan_id in [variation_id_month, variation_id_ly]:
                stripe_price_id = variation.get("stripe_price_id")
                tier = db_plan.get("tier")
                interval = db_interval
                price = variation.get("price")
                plan = {
                    "tier": tier,
                    "interval": interval,
                    "price": price,
                    "name": f"{db_plan.get('name', tier.capitalize())} {interval.capitalize()}"
                }
                break
        if plan:
            break
    
    if not plan:
        raise HTTPException(status_code=400, detail=f"Invalid plan ID: {request.plan_id}")
    
    if not stripe_price_id:
        raise HTTPException(status_code=500, detail=f"Stripe price ID not found for plan {request.plan_id}. Please run 'Sync to Stripe' first.")
    
    # Build success and cancel URLs
    origin_url = request.origin_url.rstrip('/')
    success_url = f"{origin_url}/dashboard/account?session_id={{CHECKOUT_SESSION_ID}}&success=true"
    cancel_url = f"{origin_url}/pricing?canceled=true"
    
    try:
        # Check for referral discount (new subscriber)
        referral_discount = None
        discounts_list = []
        
        # Check if referral code was provided in request (new user signup)
        if request.referral_code:
            # Verify the referral code exists and is valid
            referral_doc = await db.referrals.find_one({
                "referral_code": request.referral_code
            })
            
            if referral_doc:
                # Create one-time 20% discount coupon for referred user
                try:
                    coupon = stripe.Coupon.create(
                        percent_off=20,
                        duration="once",  # Only applies to first payment
                        name=f"Referral Discount - {request.referral_code}"
                    )
                    discounts_list.append({"coupon": coupon.id})
                    logging.info(f"Applied 20% referral discount for user {request.athlete_id} with code {request.referral_code}")
                    
                    # Mark referral as converted (track the signup)
                    try:
                        await db.referrals.update_one(
                            {"referral_code": request.referral_code},
                            {
                                "$set": {
                                    "referred_user_id": request.athlete_id,
                                    "status": "converted",
                                    "converted_at": datetime.now(timezone.utc).isoformat()
                                }
                            }
                        )
                        logging.info(f"Referral {request.referral_code} marked as converted for user {request.athlete_id}")
                        
                        # Create reward for referrer (20% discount on their renewal)
                        referrer_id = referral_doc.get("referrer_id")
                        if referrer_id:
                            reward = {
                                "athlete_id": referrer_id,
                                "referral_code": request.referral_code,
                                "discount_percentage": 20,
                                "status": "pending",  # Will be applied on next renewal
                                "created_at": datetime.now(timezone.utc).isoformat(),
                                "expires_at": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
                            }
                            await db.referral_rewards.insert_one(reward)
                            logging.info(f"Created reward for referrer {referrer_id}: 20% discount")
                    except Exception as e:
                        logging.error(f"Failed to mark referral as converted: {e}")
                except Exception as e:
                    logging.error(f"Failed to create referral coupon: {e}")
            else:
                logging.warning(f"Referral code {request.referral_code} not found in database")
        
        # Check for existing rewards (for returning/renewing customers)
        if not request.referral_code:  # Only if not a new signup with referral
            try:
                rewards = await db.referral_rewards.find({
                    "athlete_id": request.athlete_id,
                    "status": "pending"
                }).to_list(length=None)
                
                if rewards:
                    # Calculate total discount (cap at 100%, max 5 rewards)
                    total_discount = min(sum(r.get("discount_percentage", 0) for r in rewards[:5]), 100)
                    
                    if total_discount > 0:
                        # Create one-time discount coupon
                        coupon = stripe.Coupon.create(
                            percent_off=total_discount,
                            duration="once",
                            name=f"Referral Rewards - {total_discount}% off"
                        )
                        discounts_list.append({"coupon": coupon.id})
                        logging.info(f"Applied {total_discount}% referral rewards discount for user {request.athlete_id}")
                        
                        # Mark rewards as used (will be done after successful payment via webhook)
                        # For now, we'll mark them here
                        for reward in rewards[:5]:
                            await db.referral_rewards.update_one(
                                {"_id": reward["_id"]},
                                {"$set": {"status": "applied", "applied_at": datetime.now(timezone.utc).isoformat()}}
                            )
            except Exception as e:
                logging.error(f"Failed to apply referral rewards: {e}")
        
        # Handle custom coupon code
        if request.coupon_code:
            try:
                # Validate coupon from database
                coupon_doc = await db.coupons.find_one({
                    "code": request.coupon_code.upper(),
                    "enabled": True
                }, {"_id": 0})
                
                if coupon_doc:
                    # Check expiration
                    expired = False
                    if coupon_doc.get("expires_at"):
                        expiry = datetime.fromisoformat(coupon_doc["expires_at"]) if isinstance(coupon_doc["expires_at"], str) else coupon_doc["expires_at"]
                        if datetime.now(timezone.utc) > expiry:
                            expired = True
                    
                    # Check usage limit
                    usage_limit_reached = False
                    if coupon_doc.get("max_uses") is not None:
                        if coupon_doc.get("current_uses", 0) >= coupon_doc["max_uses"]:
                            usage_limit_reached = True
                    
                    if not expired and not usage_limit_reached:
                        # Check if applies to subscriptions
                        applies_to = coupon_doc.get("applies_to", "all")
                        if applies_to in ["all", "subscriptions"]:
                            # Check specific plans if specified
                            specific_plans = coupon_doc.get("specific_plans")
                            plan_valid = True
                            if specific_plans:
                                if request.plan_id not in specific_plans:
                                    plan_valid = False
                                    logging.warning(f"Coupon {request.coupon_code} not valid for plan {request.plan_id}")
                            
                            if plan_valid:
                                # Create Stripe coupon
                                stripe_coupon_params = {
                                    "name": coupon_doc.get("name", coupon_doc["code"])
                                }
                                
                                if coupon_doc["type"] == "percentage":
                                    stripe_coupon_params["percent_off"] = coupon_doc["value"]
                                else:
                                    # Fixed amount in cents
                                    stripe_coupon_params["amount_off"] = int(coupon_doc["value"] * 100)
                                    stripe_coupon_params["currency"] = coupon_doc.get("currency", "usd")
                                
                                # Apply coupon only once for subscription
                                stripe_coupon_params["duration"] = "once"
                                
                                stripe_coupon = stripe.Coupon.create(**stripe_coupon_params)
                                discounts_list.append({"coupon": stripe_coupon.id})
                                
                                logging.info(f"Applied coupon {request.coupon_code} for user {request.athlete_id}")
                                
                                # Increment usage counter
                                await db.coupons.update_one(
                                    {"code": request.coupon_code.upper()},
                                    {"$inc": {"current_uses": 1}}
                                )
                        else:
                            logging.warning(f"Coupon {request.coupon_code} does not apply to subscriptions")
                    else:
                        if expired:
                            logging.warning(f"Coupon {request.coupon_code} has expired")
                        if usage_limit_reached:
                            logging.warning(f"Coupon {request.coupon_code} usage limit reached")
                else:
                    logging.warning(f"Coupon {request.coupon_code} not found or disabled")
            except Exception as e:
                logging.error(f"Failed to apply coupon: {e}")
        
        # Create Stripe Checkout Session for subscription
        session_params = {
            'mode': 'subscription',
            'line_items': [{
                'price': stripe_price_id,
                'quantity': 1,
            }],
            'success_url': success_url,
            'cancel_url': cancel_url,
            'metadata': {
                "plan_id": request.plan_id,
                "tier": plan["tier"],
                "interval": plan["interval"],
                "athlete_id": request.athlete_id,
                "coupon_code": request.coupon_code if request.coupon_code else ""
            }
        }
        
        # Add discounts if available
        if discounts_list:
            session_params['discounts'] = discounts_list
        
        checkout_session = stripe.checkout.Session.create(**session_params)
        
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
    
    # Get Stripe settings from system_settings
    system_settings = await db.system_settings.find_one({}, {"_id": 0})
    if not system_settings:
        raise HTTPException(status_code=500, detail="System settings not found")
    
    stripe_settings = system_settings.get("advanced", {}).get("stripe", {})
    stripe_mode = stripe_settings.get("mode", "test")
    
    # Get the appropriate API key based on mode
    if stripe_mode == "live":
        stripe_secret_key = stripe_settings.get("live", {}).get("apiKey") or stripe_settings.get("live", {}).get("secretKey")
    else:
        stripe_secret_key = stripe_settings.get("sandbox", {}).get("apiKey") or stripe_settings.get("sandbox", {}).get("secretKey")
    
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail=f"Stripe API key not configured for {stripe_mode} mode")
    
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
                        
                        # Get athlete details for email
                        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
                        
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
                        
                        # Send subscription confirmation email
                        email_service = get_email_service()
                        if email_service.enabled and athlete:
                            try:
                                tier_name = transaction["tier"].capitalize()
                                interval_text = "monthly" if transaction["interval"] == "month" else "annual"
                                amount = checkout_session.amount_total / 100  # Convert from cents
                                currency = checkout_session.currency.upper()
                                
                                html_content = f"""
                                <html>
                                    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                                            <h1 style="color: white; margin: 0;">Subscription Confirmed! 🎉</h1>
                                        </div>
                                        <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 10px 10px;">
                                            <p style="font-size: 16px; color: #333;">Hi {athlete.get('name', 'there')},</p>
                                            <p style="font-size: 16px; color: #333;">
                                                Thank you for subscribing to TrainSmart {tier_name}! Your subscription is now active.
                                            </p>
                                            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                                <h2 style="color: #667eea; margin-top: 0;">Subscription Details</h2>
                                                <table style="width: 100%; font-size: 14px; color: #666;">
                                                    <tr>
                                                        <td style="padding: 8px 0;"><strong>Plan:</strong></td>
                                                        <td style="padding: 8px 0;">{tier_name}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding: 8px 0;"><strong>Billing:</strong></td>
                                                        <td style="padding: 8px 0;">{interval_text.capitalize()}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding: 8px 0;"><strong>Amount:</strong></td>
                                                        <td style="padding: 8px 0;">{amount:.2f} {currency}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding: 8px 0;"><strong>Next billing date:</strong></td>
                                                        <td style="padding: 8px 0;">{period_end.strftime('%B %d, %Y')}</td>
                                                    </tr>
                                                </table>
                                            </div>
                                            <p style="font-size: 14px; color: #666;">
                                                You now have access to all {tier_name} features. Visit your dashboard to start exploring!
                                            </p>
                                            <div style="text-align: center; margin: 30px 0;">
                                                <a href="{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dashboard" 
                                                   style="background: #00C2A8; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                                                    Go to Dashboard
                                                </a>
                                            </div>
                                            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                                            <p style="font-size: 12px; color: #999; text-align: center;">
                                                TrainSmart - Your Personal Fitness Companion<br>
                                                This is an automated message, please do not reply.
                                            </p>
                                        </div>
                                    </body>
                                </html>
                                """
                                
                                email_service.send_email(
                                    to_email=athlete.get('email'),
                                    subject=f"Welcome to TrainSmart {tier_name}!",
                                    html_content=html_content
                                )
                                
                                logging.info(f"Subscription confirmation email sent to {athlete.get('email')}")
                            except Exception as e:
                                logging.error(f"Failed to send subscription confirmation email: {e}")
                
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
    
    # Get athlete
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    stripe_subscription_id = athlete.get("stripe_subscription_id")
    if not stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription found")
    
    # Get Stripe settings from system_settings
    system_settings = await db.system_settings.find_one({}, {"_id": 0})
    if not system_settings:
        raise HTTPException(status_code=500, detail="System settings not found")
    
    stripe_settings = system_settings.get("advanced", {}).get("stripe", {})
    stripe_mode = stripe_settings.get("mode", "test")
    
    # Get the appropriate API key based on mode
    if stripe_mode == "live":
        stripe_secret_key = stripe_settings.get("live", {}).get("apiKey") or stripe_settings.get("live", {}).get("secretKey")
    else:
        stripe_secret_key = stripe_settings.get("sandbox", {}).get("apiKey") or stripe_settings.get("sandbox", {}).get("secretKey")
    
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail=f"Stripe API key not configured for {stripe_mode} mode")
    
    stripe.api_key = stripe_secret_key
    
    # Fetch subscription plans from database to get synced Stripe price IDs
    all_plans = await db.subscription_plans.find({"enabled": True}, {"_id": 0}).to_list(length=None)
    
    # Find the matching variation by plan_id
    # Normalize interval: "monthly" -> "month", "annual" -> "year"
    new_plan = None
    new_price_id = None
    
    for db_plan in all_plans:
        variations = db_plan.get("variations", [])
        for variation in variations:
            db_interval = variation.get("interval")  # "month" or "year" from database
            # Match plan_id with both formats: "pro_month"/"pro_year" AND "pro_monthly"/"pro_annual"
            variation_id_month = f"{db_plan.get('tier')}_{db_interval}"  # "pro_month"
            variation_id_ly = f"{db_plan.get('tier')}_{'monthly' if db_interval == 'month' else 'annual'}"  # "pro_monthly"
            
            if new_plan_id in [variation_id_month, variation_id_ly]:
                new_price_id = variation.get("stripe_price_id")
                new_plan = {
                    "tier": db_plan.get("tier"),
                    "interval": db_interval,
                    "price": variation.get("price")
                }
                break
        if new_plan:
            break
    
    if not new_plan:
        raise HTTPException(status_code=400, detail=f"Invalid plan ID: {new_plan_id}")
    
    if not new_price_id:
        raise HTTPException(status_code=500, detail=f"Stripe price ID not found for plan {new_plan_id}. Please run 'Sync to Stripe' first.")
    
    try:
        # Get current subscription
        subscription = stripe.Subscription.retrieve(stripe_subscription_id)
        
        # Update subscription with new price (using synced price ID)
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
        # Get OpenAI API key from system_settings (global key stored in Advanced tab)
        system_settings = await db.system_settings.find_one(
            {"setting_type": "global"},
            {"_id": 0}
        )
        
        if not system_settings or not system_settings.get('advanced', {}).get('openaiApiKey'):
            raise HTTPException(
                status_code=400, 
                detail="OpenAI API key not found. Please add your OpenAI API key in System Settings → Advanced tab (Super Admin only), then try again."
            )
        
        openai_key = system_settings['advanced']['openaiApiKey']
        
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
            raise HTTPException(
                status_code=400, 
                detail="Invalid OpenAI API key. Please update your API key in System Settings → Advanced tab."
            )
        raise HTTPException(status_code=500, detail=f"Transcription failed: {error_message}")
    except Exception as e:
        logging.error(f"Error transcribing audio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to transcribe audio: {str(e)}")

@api_router.post("/journal/transcribe-video/{athlete_id}")
async def transcribe_video(athlete_id: str, video: UploadFile = File(...)):
    """Transcribe video to text with timestamps using OpenAI Whisper"""
    import openai
    import subprocess
    import tempfile
    
    try:
        # Get OpenAI API key from system_settings
        system_settings = await db.system_settings.find_one(
            {"setting_type": "global"},
            {"_id": 0}
        )
        
        if not system_settings or not system_settings.get('advanced', {}).get('openaiApiKey'):
            raise HTTPException(
                status_code=400, 
                detail="OpenAI API key not found. Please add your OpenAI API key in System Settings → Advanced tab (Super Admin only), then try again."
            )
        
        openai_key = system_settings['advanced']['openaiApiKey']
        
        # Read video file
        video_content = await video.read()
        
        # Create temporary files for video and audio
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as video_temp:
            video_temp.write(video_content)
            video_temp_path = video_temp.name
        
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as audio_temp:
            audio_temp_path = audio_temp.name
        
        try:
            # Extract audio from video using FFmpeg
            subprocess.run([
                'ffmpeg', '-i', video_temp_path,
                '-vn',  # No video
                '-acodec', 'pcm_s16le',  # PCM audio codec
                '-ar', '16000',  # 16kHz sample rate
                '-ac', '1',  # Mono
                audio_temp_path,
                '-y'  # Overwrite output file
            ], check=True, capture_output=True)
            
            # Create OpenAI client
            client = openai.OpenAI(api_key=openai_key)
            
            # Transcribe audio with timestamps using Whisper
            with open(audio_temp_path, 'rb') as audio_file:
                transcription = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="verbose_json",
                    timestamp_granularities=["segment"]
                )
            
            # Generate SRT subtitle format
            srt_content = ""
            for i, segment in enumerate(transcription.segments, 1):
                start_time = format_timestamp(segment['start'])
                end_time = format_timestamp(segment['end'])
                text = segment['text'].strip()
                srt_content += f"{i}\n{start_time} --> {end_time}\n{text}\n\n"
            
            return {
                "transcription": transcription.text,
                "srt": srt_content,
                "segments": transcription.segments
            }
            
        finally:
            # Clean up temporary files
            import os
            if os.path.exists(video_temp_path):
                os.unlink(video_temp_path)
            if os.path.exists(audio_temp_path):
                os.unlink(audio_temp_path)
        
    except openai.OpenAIError as e:
        error_message = str(e)
        if "invalid_api_key" in error_message.lower() or "incorrect api key" in error_message.lower():
            raise HTTPException(
                status_code=400, 
                detail="Invalid OpenAI API key. Please update your API key in System Settings → Advanced tab."
            )
        raise HTTPException(status_code=500, detail=f"Transcription failed: {error_message}")
    except Exception as e:
        logging.error(f"Error transcribing video: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to transcribe video: {str(e)}")

def format_timestamp(seconds):
    """Convert seconds to SRT timestamp format (HH:MM:SS,mmm)"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

@api_router.post("/journal/process-video/{athlete_id}")
async def process_video_journal(
    athlete_id: str,
    video: UploadFile = File(...),
    transcription: str = Form(...),
    srt_content: str = Form(...),
    burn_subtitles: bool = Form(False)
):
    """Process video journal entry with optional subtitle burning"""
    import subprocess
    import tempfile
    
    try:
        # Create unique filename
        video_id = str(uuid.uuid4())
        video_filename = f"{athlete_id}_{video_id}.mp4"
        subtitle_filename = f"{athlete_id}_{video_id}.srt"
        
        video_dir = "/app/backend/uploaded_videos/journal"
        video_path = os.path.join(video_dir, video_filename)
        subtitle_path = os.path.join(video_dir, subtitle_filename)
        
        # Read uploaded video
        video_content = await video.read()
        
        if burn_subtitles:
            # Create temporary files
            with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as input_temp:
                input_temp.write(video_content)
                input_temp_path = input_temp.name
            
            with tempfile.NamedTemporaryFile(suffix='.srt', delete=False, mode='w') as srt_temp:
                srt_temp.write(srt_content)
                srt_temp_path = srt_temp.name
            
            try:
                # Burn subtitles into video with compression
                # White text with 80% black background
                subprocess.run([
                    'ffmpeg', '-i', input_temp_path,
                    '-vf', f"subtitles={srt_temp_path}:force_style='FontSize=18,PrimaryColour=&HFFFFFF,BackColour=&H80000000,BorderStyle=3,Outline=1,Shadow=2'",
                    '-c:v', 'libx264',  # H.264 codec
                    '-crf', '28',  # Compression quality (23-28 is good balance)
                    '-preset', 'medium',  # Encoding speed
                    '-c:a', 'aac',  # AAC audio codec
                    '-b:a', '128k',  # Audio bitrate
                    video_path,
                    '-y'
                ], check=True, capture_output=True)
                
                final_video_path = video_path
                final_subtitle_path = None
                
            finally:
                # Clean up temp files
                if os.path.exists(input_temp_path):
                    os.unlink(input_temp_path)
                if os.path.exists(srt_temp_path):
                    os.unlink(srt_temp_path)
        else:
            # Save video with compression (no subtitles burned in)
            with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as input_temp:
                input_temp.write(video_content)
                input_temp_path = input_temp.name
            
            try:
                # Compress video
                subprocess.run([
                    'ffmpeg', '-i', input_temp_path,
                    '-c:v', 'libx264',
                    '-crf', '28',
                    '-preset', 'medium',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    video_path,
                    '-y'
                ], check=True, capture_output=True)
                
                # Save separate subtitle file
                with open(subtitle_path, 'w') as srt_file:
                    srt_file.write(srt_content)
                
                final_video_path = video_path
                final_subtitle_path = subtitle_path
                
            finally:
                if os.path.exists(input_temp_path):
                    os.unlink(input_temp_path)
        
        # Create journal entry
        entry = JournalEntry(
            athlete_id=athlete_id,
            content=transcription,
            entry_type="video",
            video_path=f"/api/uploaded_videos/journal/{video_filename}",
            subtitle_path=f"/api/uploaded_videos/journal/{subtitle_filename}" if final_subtitle_path else None,
            has_burned_subtitles=burn_subtitles
        )
        
        # Save to database
        entry_dict = entry.model_dump()
        entry_dict = prepare_for_mongo(entry_dict)
        await db.journal_entries.insert_one(entry_dict)
        
        return {
            "success": True,
            "entry": entry
        }
        
    except Exception as e:
        logging.error(f"Error processing video journal: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process video: {str(e)}")

# Nutrition routes
@api_router.get("/nutrition/{athlete_id}")
async def get_nutrition_entries(athlete_id: str, date: Optional[str] = None):
    """Get nutrition entries for an athlete, optionally filtered by date"""
    query = {"athlete_id": athlete_id}
    
    # Add date filter if provided
    if date:
        query["entry_date"] = date
    
    entries = await db.nutrition_entries.find(
        query,
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

async def generate_meal_details_with_ai(description: str, image_data: str, openai_key: str) -> dict:
    """
    Use OpenAI Vision API to analyze meal image and description
    Returns: dict with 'ingredients' (list) and 'instructions' (list)
    """
    try:
        # Prepare the prompt
        prompt = f"""Analyze this meal: "{description}"

Based on the image and description, provide:
1. A detailed list of ingredients with quantities needed to recreate this meal
2. Step-by-step preparation instructions

Return your response in this exact JSON format:
{{
  "ingredients": ["ingredient 1 with quantity", "ingredient 2 with quantity", ...],
  "instructions": ["step 1", "step 2", ...]
}}

Be specific with quantities (e.g., "200g chicken breast", "1 cup rice", "2 tbsp olive oil").
Make instructions clear and easy to follow."""

        # Call OpenAI Vision API
        client = openai.AsyncOpenAI(api_key=openai_key)
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_data  # Already in data:image format
                            }
                        }
                    ]
                }
            ],
            temperature=0.7
        )
        
        # Parse response
        content = response.choices[0].message.content
        
        # Clean and parse JSON
        import re
        cleaned_text = content.strip()
        if cleaned_text.startswith('```'):
            cleaned_text = re.sub(r'^```(?:json)?\n', '', cleaned_text)
            cleaned_text = re.sub(r'\n```$', '', cleaned_text)
        
        # Try to find JSON object
        json_match = re.search(r'\{.*\}', cleaned_text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group(0))
        else:
            result = json.loads(cleaned_text)
        
        return {
            "ingredients": result.get("ingredients", []),
            "instructions": result.get("instructions", [])
        }
        
    except Exception as e:
        logging.error(f"[NUTRITION AI] Failed to generate meal details: {str(e)}")
        return {"ingredients": [], "instructions": []}

@api_router.post("/nutrition")
async def create_nutrition_entry(entry: NutritionEntry):
    """Create a new nutrition entry with AI-generated ingredients and instructions"""
    entry_dict = prepare_for_mongo(entry.model_dump())
    await db.nutrition_entries.insert_one(entry_dict)
    
    # Generate ingredients and instructions with AI if image and description are provided
    if entry.description and entry.image_data:
        try:
            # Get OpenAI key from system settings (global key stored in Advanced tab)
            system_settings = await db.system_settings.find_one(
                {"setting_type": "global"},
                {"_id": 0}
            )
            
            if system_settings and system_settings.get('advanced', {}).get('openaiApiKey'):
                openai_key = system_settings['advanced']['openaiApiKey']
                logging.info(f"[NUTRITION AI] Generating meal details for entry {entry.id}")
                
                # Generate ingredients and instructions
                ai_details = await generate_meal_details_with_ai(
                    entry.description, 
                    entry.image_data, 
                    openai_key
                )
                
                # Update the entry with AI-generated data
                await db.nutrition_entries.update_one(
                    {"id": entry.id},
                    {"$set": {
                        "ingredients": ai_details["ingredients"],
                        "instructions": ai_details["instructions"]
                    }}
                )
                logging.info(f"[NUTRITION AI] Successfully generated {len(ai_details['ingredients'])} ingredients and {len(ai_details['instructions'])} instructions")
            else:
                logging.info(f"[NUTRITION AI] No OpenAI key found for athlete {entry.athlete_id}, skipping AI generation")
        except Exception as e:
            logging.error(f"[NUTRITION AI] Failed to generate meal details: {str(e)}")
            # Don't fail the entire request if AI generation fails
    
    return {"success": True, "id": entry.id}

@api_router.get("/nutrition/entry/{entry_id}")
async def get_nutrition_entry(entry_id: str):
    """Get a single nutrition entry by ID"""
    entry = await db.nutrition_entries.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Nutrition entry not found")
    return entry

@api_router.post("/nutrition/entry/{entry_id}/reanalyze")
async def reanalyze_nutrition_entry(entry_id: str):
    """Re-analyze an existing nutrition entry to generate ingredients and instructions with AI"""
    try:
        # Fetch the existing entry
        entry = await db.nutrition_entries.find_one({"id": entry_id}, {"_id": 0})
        if not entry:
            raise HTTPException(status_code=404, detail="Nutrition entry not found")
        
        # Check if entry has image and description
        if not entry.get("description") or not entry.get("image_data"):
            raise HTTPException(status_code=400, detail="Entry must have both description and image for AI analysis")
        
        # Get OpenAI key from system settings (global key stored in Advanced tab)
        system_settings = await db.system_settings.find_one(
            {"setting_type": "global"},
            {"_id": 0}
        )
        
        if not system_settings or not system_settings.get('advanced', {}).get('openaiApiKey'):
            raise HTTPException(
                status_code=400, 
                detail="OpenAI API key not found. Please add your OpenAI API key in System Settings → Advanced tab (Super Admin only), then try again."
            )
        
        openai_key = system_settings['advanced']['openaiApiKey']
        logging.info(f"[NUTRITION REANALYZE] Re-analyzing entry {entry_id}")
        
        # Generate ingredients and instructions
        ai_details = await generate_meal_details_with_ai(
            entry["description"], 
            entry["image_data"], 
            openai_key
        )
        
        # Update the entry with AI-generated data
        await db.nutrition_entries.update_one(
            {"id": entry_id},
            {"$set": {
                "ingredients": ai_details["ingredients"],
                "instructions": ai_details["instructions"],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logging.info(f"[NUTRITION REANALYZE] Successfully generated {len(ai_details['ingredients'])} ingredients and {len(ai_details['instructions'])} instructions for entry {entry_id}")
        
        return {
            "success": True,
            "ingredients": ai_details["ingredients"],
            "instructions": ai_details["instructions"]
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"[NUTRITION REANALYZE] Failed to reanalyze entry: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reanalyze entry: {str(e)}")

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
        # Get OpenAI API key (checks personal key, then system settings, then Emergent LLM key)
        openai_key = await ai_coach.get_openai_key(athlete_id)
        
        if not openai_key:
            # Try to use Emergent LLM key as fallback
            try:
                from emergentintegrations.openai import client as emergent_openai_client
                client = emergent_openai_client
                logging.info(f"Using Emergent LLM key for food analysis for athlete {athlete_id}")
            except Exception as e:
                logging.error(f"Failed to use Emergent LLM key: {e}")
                raise HTTPException(status_code=400, detail="OpenAI API key required for food analysis. Please configure your API key in System Settings (Advanced tab) or use the Emergent LLM key.")
        else:
            # Create OpenAI client with the found key
            client = openai.OpenAI(api_key=openai_key)
            logging.info(f"Using OpenAI key for food analysis for athlete {athlete_id}")
        
        # Get the base64 image data and optional description
        base64_image = request.get("image_data", "")
        user_description = request.get("description", "")
        
        if not base64_image:
            raise HTTPException(status_code=400, detail="No image data provided")
        
        # Get athlete's language preference (use coach_language for AI responses)
        athlete = await db.athlete_profiles.find_one({"id": athlete_id})
        user_language = athlete.get("coach_language", athlete.get("language", "en")) if athlete else "en"
        
        # Map language codes to language names
        language_map = {
            "en": "English",
            "no": "Norwegian",
            "sv": "Swedish", 
            "de": "German",
            "fr": "French"
        }
        language_name = language_map.get(user_language, "English")
        
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

14. A brief description of the food items you can see IN {language_name.upper()}

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
  "description": "<brief description in {language_name}>"
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
    
    return {"supplements": supplements}

@api_router.post("/supplements")
async def create_supplement(supplement: Supplement):
    """Create a new supplement entry"""
    supplement_dict = supplement.model_dump()
    # Convert datetime to ISO string for MongoDB
    if isinstance(supplement_dict.get('created_at'), datetime):
        supplement_dict['created_at'] = supplement_dict['created_at'].isoformat()
    await db.supplements.insert_one(supplement_dict)
    return {"success": True, "id": supplement.id}

@api_router.put("/supplements/{supplement_id}")
async def update_supplement(supplement_id: str, data: dict):
    """Update a supplement entry"""
    update_data = {k: v for k, v in data.items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
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

# Supplement Log routes
@api_router.get("/supplement-logs/{athlete_id}")
async def get_supplement_logs(athlete_id: str):
    """Get all supplement logs for an athlete"""
    logs = await db.supplement_logs.find(
        {"athlete_id": athlete_id},
        {"_id": 0}
    ).sort("log_date", -1).to_list(length=None)
    
    # Parse date and time from strings
    for log in logs:
        if isinstance(log.get('log_date'), str):
            log['log_date'] = log['log_date']
        if isinstance(log.get('log_time'), str):
            log['log_time'] = log['log_time']
    
    return {"logs": logs}

@api_router.post("/supplement-logs")
async def create_supplement_log(log: SupplementLog):
    """Create a new supplement log entry"""
    log_dict = log.model_dump()
    # Convert date and time to ISO strings for MongoDB
    if isinstance(log_dict.get('log_date'), date):
        log_dict['log_date'] = log_dict['log_date'].isoformat()
    if isinstance(log_dict.get('log_time'), time):
        log_dict['log_time'] = log_dict['log_time'].strftime('%H:%M:%S')
    if isinstance(log_dict.get('created_at'), datetime):
        log_dict['created_at'] = log_dict['created_at'].isoformat()
    
    await db.supplement_logs.insert_one(log_dict)
    return {"success": True, "id": log.id}

@api_router.put("/supplement-logs/{log_id}")
async def update_supplement_log(log_id: str, data: dict):
    """Update a supplement log entry"""
    update_data = {k: v for k, v in data.items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Convert date and time if present
    if 'log_date' in update_data and isinstance(update_data['log_date'], date):
        update_data['log_date'] = update_data['log_date'].isoformat()
    if 'log_time' in update_data and isinstance(update_data['log_time'], time):
        update_data['log_time'] = update_data['log_time'].strftime('%H:%M:%S')
    
    result = await db.supplement_logs.update_one(
        {"id": log_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supplement log not found")
    
    return {"success": True}

@api_router.delete("/supplement-logs/{log_id}")
async def delete_supplement_log(log_id: str):
    """Delete a supplement log entry"""
    result = await db.supplement_logs.delete_one({"id": log_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplement log not found")
    
    return {"success": True}

# Drink log routes
@api_router.get("/drinks/{athlete_id}")
async def get_drink_logs(athlete_id: str, date: Optional[str] = None):
    """Get drink logs for an athlete, optionally filtered by date"""
    query = {"athlete_id": athlete_id}
    
    if date:
        # Parse date and query for that specific date
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
            query["log_date"] = target_date.isoformat()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    drinks = await db.drink_logs.find(query, {"_id": 0}).sort("log_time", -1).to_list(length=None)
    
    # Parse drinks from MongoDB format
    parsed_drinks = [parse_from_mongo(drink) for drink in drinks]
    
    return {"drinks": parsed_drinks}

@api_router.post("/drinks/{athlete_id}")
async def create_drink_log(athlete_id: str, drink_data: dict):
    """Create a new drink log entry"""
    # Create drink log with athlete_id
    drink_log = DrinkLog(
        athlete_id=athlete_id,
        drink_type=drink_data.get("drink_type", "water"),
        amount_ml=drink_data.get("amount_ml", 250),
        log_date=datetime.strptime(drink_data.get("log_date"), "%Y-%m-%d").date(),
        log_time=datetime.strptime(drink_data.get("log_time"), "%H:%M").time(),
        notes=drink_data.get("notes", "")
    )
    
    # Prepare for MongoDB
    drink_dict = drink_log.model_dump()
    drink_dict = prepare_for_mongo(drink_dict)
    
    # Insert into database
    await db.drink_logs.insert_one(drink_dict)
    
    return {"success": True, "drink": drink_log}

@api_router.put("/drinks/{athlete_id}/{drink_id}")
async def update_drink_log(athlete_id: str, drink_id: str, drink_data: dict):
    """Update a drink log entry"""
    # Prepare update data
    update_data = {}
    
    if "drink_type" in drink_data:
        update_data["drink_type"] = drink_data["drink_type"]
    if "amount_ml" in drink_data:
        update_data["amount_ml"] = drink_data["amount_ml"]
    if "log_date" in drink_data:
        update_data["log_date"] = datetime.strptime(drink_data["log_date"], "%Y-%m-%d").date().isoformat()
    if "log_time" in drink_data:
        update_data["log_time"] = datetime.strptime(drink_data["log_time"], "%H:%M").time().strftime("%H:%M:%S")
    if "notes" in drink_data:
        update_data["notes"] = drink_data["notes"]
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Update in database
    result = await db.drink_logs.update_one(
        {"id": drink_id, "athlete_id": athlete_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Drink log not found")
    
    return {"success": True}

@api_router.delete("/drinks/{athlete_id}/{drink_id}")
async def delete_drink_log(athlete_id: str, drink_id: str):
    """Delete a drink log entry"""
    result = await db.drink_logs.delete_one({"id": drink_id, "athlete_id": athlete_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Drink log not found")
    
    return {"success": True}

# File routes
@api_router.get("/files/{athlete_id}")
async def get_files(athlete_id: str):
    """Get all file entries for an athlete"""
    entries = await db.file_entries.find(
        {"athlete_id": athlete_id},
        {"_id": 0}
    ).to_list(length=None)
    
    # Parse entries and sort by entry_date and entry_time (most recent first)
    parsed_entries = [parse_from_mongo(entry) for entry in entries]
    
    def sort_key(entry):
        # Create sortable datetime from entry_date and entry_time
        if entry.get('entry_date') and entry.get('entry_time'):
            try:
                date_str = entry['entry_date']
                time_str = entry['entry_time']
                datetime_str = f"{date_str} {time_str}"
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
            dt = entry['created_at']
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt
        return datetime.min.replace(tzinfo=timezone.utc)
    
    parsed_entries.sort(key=sort_key, reverse=True)
    
    return {"entries": parsed_entries}

@api_router.post("/files/{athlete_id}")
async def create_file_entry(athlete_id: str, entry: FileEntry):
    """Create a new file entry"""
    entry_dict = prepare_for_mongo(entry.model_dump())
    await db.file_entries.insert_one(entry_dict)
    return {"success": True, "id": entry.id}

@api_router.put("/files/{entry_id}")
async def update_file_entry(entry_id: str, data: dict):
    """Update a file entry"""
    update_data = {
        "file_type": data.get("file_type"),
        "description": data.get("description"),
        "file_data": data.get("file_data"),
        "file_name": data.get("file_name"),
        "entry_date": data.get("entry_date"),
        "entry_time": data.get("entry_time"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Remove None values
    update_data = {k: v for k, v in update_data.items() if v is not None}
    
    result = await db.file_entries.update_one(
        {"id": entry_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="File entry not found")
    
    return {"success": True}

@api_router.delete("/files/{entry_id}")
async def delete_file_entry(entry_id: str):
    """Delete a file entry"""
    result = await db.file_entries.delete_one({"id": entry_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="File entry not found")
    
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
    try:
        # Validate file size - MongoDB has 16MB BSON limit
        # Base64 encoding increases size by ~33%, so limit original to ~12MB
        if document.file_data:
            # Estimate original file size from base64
            base64_data = document.file_data
            if ',' in base64_data:
                base64_data = base64_data.split(',')[1]
            
            # Base64 length * 0.75 = approximate original size
            estimated_size = len(base64_data) * 0.75
            max_size = 12 * 1024 * 1024  # 12MB
            
            if estimated_size > max_size:
                raise HTTPException(
                    status_code=400,
                    detail=f"File size too large. Maximum size is 12MB. Current size: {estimated_size / (1024*1024):.1f}MB"
                )
        
        document_dict = prepare_for_mongo(document.model_dump())
        await db.documents.insert_one(document_dict)
        return {"success": True, "id": document.id}
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Handle MongoDB size errors and other database errors
        error_msg = str(e)
        if 'document is too large' in error_msg.lower() or 'bson' in error_msg.lower():
            raise HTTPException(
                status_code=400,
                detail="Document size exceeds MongoDB limit (16MB). Please upload a smaller file or compress images further."
            )
        else:
            logging.error(f"Error creating document: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload document: {str(e)}"
            )

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

# Files endpoints
@api_router.post("/files/{athlete_id}")
async def create_file_entry(athlete_id: str, file_entry: FileEntry):
    """Create a new file entry"""
    try:
        # Validate file size
        if file_entry.file_data:
            base64_data = file_entry.file_data
            if ',' in base64_data:
                base64_data = base64_data.split(',')[1]
            
            estimated_size = len(base64_data) * 0.75
            max_size = 12 * 1024 * 1024
            
            if estimated_size > max_size:
                raise HTTPException(
                    status_code=400,
                    detail=f"File size too large. Maximum size is 12MB."
                )
        
        file_entry_dict = prepare_for_mongo(file_entry.model_dump())
        await db.file_entries.insert_one(file_entry_dict)
        return {"success": True, "id": file_entry.id}
        
    except HTTPException:
        raise
    except DocumentTooLarge as e:
        raise HTTPException(
            status_code=400,
            detail="File size exceeds MongoDB limit (16MB)."
        )
    except Exception as e:
        logging.error(f"Error creating file entry: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload file: {str(e)}"
        )

@api_router.get("/files/{athlete_id}")
async def get_file_entries(athlete_id: str):
    """Get all file entries for an athlete"""
    entries = await db.file_entries.find(
        {"athlete_id": athlete_id}, 
        {"_id": 0}
    ).sort("entry_date", -1).to_list(length=None)
    
    # Parse dates
    for entry in entries:
        entry = parse_from_mongo(entry)
    
    return {"entries": entries}

@api_router.put("/files/{entry_id}")
async def update_file_entry(entry_id: str, file_entry: FileEntry):
    """Update a file entry"""
    file_entry_dict = prepare_for_mongo(file_entry.model_dump())
    result = await db.file_entries.update_one(
        {"id": entry_id},
        {"$set": file_entry_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="File entry not found")
    
    return {"success": True}

@api_router.delete("/files/{entry_id}")
async def delete_file_entry(entry_id: str):
    """Delete a file entry"""
    result = await db.file_entries.delete_one({"id": entry_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="File entry not found")
    
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


# Recipe routes
@api_router.post("/recipes/generate/{athlete_id}")
async def generate_recipe(athlete_id: str, recipe_request: dict):
    """Generate a single recipe (breakfast, lunch, or dinner) based on athlete's nutrition data and preferences"""
    meal_type = recipe_request.get('meal_type')  # 'breakfast', 'lunch', or 'dinner'
    
    if not meal_type or meal_type not in ['breakfast', 'lunch', 'dinner']:
        raise HTTPException(status_code=400, detail="meal_type must be 'breakfast', 'lunch', or 'dinner'")
    
    logging.info(f"[RECIPE] Generating {meal_type} recipe for athlete: {athlete_id}")
    try:
        
        # Get athlete data
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            logging.error(f"[RECIPE] Athlete not found: {athlete_id}")
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        logging.info(f"[RECIPE] Fetching OpenAI key from system settings")
        # Get OpenAI key from system_settings collection
        system_settings = await db.system_settings.find_one(
            {"setting_type": "global"},
            {"_id": 0}
        )
        
        if not system_settings or not system_settings.get('advanced', {}).get('openaiApiKey'):
            logging.error(f"[RECIPE] OpenAI API key not found in system settings")
            raise HTTPException(status_code=400, detail="OpenAI API key not found. Please add your OpenAI API key in System Settings → Advanced tab (Super Admin only), then try again.")
        
        openai_key = system_settings['advanced']['openaiApiKey']
        logging.info(f"[RECIPE] OpenAI key found, length: {len(openai_key)}")
        
        # Get recent nutrition entries (last 14 days)
        two_weeks_ago = (datetime.now(timezone.utc) - timedelta(days=14)).strftime("%Y-%m-%d")
        nutrition_entries = await db.nutrition_entries.find(
            {"athlete_id": athlete_id, "entry_date": {"$gte": two_weeks_ago}},
            {"_id": 0}
        ).to_list(length=None)
        
        # Get supplements
        supplements = await db.supplements.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).to_list(length=None)
        
        # Calculate average daily nutrition
        total_cals = sum(n.get('calories', 0) for n in nutrition_entries if n.get('calories'))
        total_protein = sum(n.get('protein', 0) for n in nutrition_entries if n.get('protein'))
        total_carbs = sum(n.get('carbs', 0) for n in nutrition_entries if n.get('carbs'))
        total_fat = sum(n.get('fat', 0) for n in nutrition_entries if n.get('fat'))
        days_tracked = len(set(n.get('entry_date') for n in nutrition_entries if n.get('entry_date'))) or 1
        
        avg_nutrition = {
            "calories": total_cals / days_tracked if days_tracked > 0 else 2000,
            "protein": total_protein / days_tracked if days_tracked > 0 else 150,
            "carbs": total_carbs / days_tracked if days_tracked > 0 else 200,
            "fat": total_fat / days_tracked if days_tracked > 0 else 65
        }
        
        # Get dietary restrictions and preferences
        allergies = athlete.get('allergies', [])
        dietary_prefs = athlete.get('dietary_preferences', [])
        
        # Get measurement preferences
        measurement_system = athlete.get('measurement_system', 'imperial')
        weight_unit = athlete.get('weight_unit', 'lbs')
        fluid_unit = athlete.get('fluid_unit', 'fl oz')
        
        # Determine measurement units based on preferences
        if measurement_system == 'metric':
            volume_unit = 'ml or liters'
            weight_example = 'grams or kg'
            temp_unit = 'Celsius'
        else:
            volume_unit = 'cups, tablespoons, or teaspoons'
            weight_example = 'oz or lbs'
            temp_unit = 'Fahrenheit'
        
        # Build context for AI
        context = f"""
        Athlete Profile:
        - Estimated daily calorie need: {athlete.get('estimated_calorie_need', 2000)} calories
        - Current average intake: {avg_nutrition['calories']:.0f} calories
        - Average macros: {avg_nutrition['protein']:.0f}g protein, {avg_nutrition['carbs']:.0f}g carbs, {avg_nutrition['fat']:.0f}g fat
        - Allergies: {', '.join(allergies) if allergies else 'None'}
        - Dietary preferences: {', '.join(dietary_prefs) if dietary_prefs else 'None'}
        - Running goals: {athlete.get('running_goals', 'General fitness')}
        - Supplements: {', '.join([s.get('name', '') for s in supplements[:5]]) if supplements else 'None'}
        - Measurement system: {measurement_system}
        
        Generate a complete 7-day meal plan (breakfast, lunch, dinner for each day).
        Each meal should be athlete-appropriate, balanced, and delicious.
        Target calories per meal: ~{athlete.get('estimated_calorie_need', 2000) / 3:.0f}
        """
        
        prompt = f"""{context}

        Create 1 delicious {meal_type.upper()} recipe formatted as JSON object (not array).
        The recipe must have:
        - recipe_name: string (creative, appetizing name appropriate for {meal_type})
        - ingredients: array of strings with quantities (e.g., "2 cups rice", "1 lb chicken breast")
        - instructions: detailed step-by-step cooking instructions as single string
        - nutrition_info: object with calories, protein, carbs, fat (numbers)
        - prep_time: minutes (number)
        - cook_time: minutes (number)
        - servings: number
        
        CRITICAL MEASUREMENT REQUIREMENTS:
        - Use {measurement_system} measurements ONLY
        - Volume: Use {volume_unit}
        - Weight: Use {weight_example}
        - Temperature: Use {temp_unit}
        - Be specific and consistent with units throughout the recipe
        
        IMPORTANT: Avoid all allergens: {', '.join(allergies) if allergies else 'none'}
        Follow dietary preferences: {', '.join(dietary_prefs) if dietary_prefs else 'balanced diet'}
        
        Return ONLY a valid JSON object for one recipe, no other text."""
        
        # Generate recipes using OpenAI
        logging.info(f"[RECIPE] Creating OpenAI client and calling API...")
        try:
            client = openai.AsyncOpenAI(api_key=openai_key)
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a nutrition expert and chef specializing in athlete meal planning."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.8
            )
            recipes_text = response.choices[0].message.content
            logging.info(f"[RECIPE] OpenAI API call successful. Response length: {len(recipes_text)}")
            logging.info(f"[RECIPE] Response preview: {recipes_text[:200]}...")
        except Exception as api_error:
            logging.error(f"[RECIPE] OpenAI API call failed: {str(api_error)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to generate recipe text: {str(api_error)}")
        
        # Parse JSON
        import json
        import re
        
        logging.info(f"[RECIPE] Parsing JSON response...")
        try:
            # Remove markdown code blocks if present
            cleaned_text = recipes_text.strip()
            if cleaned_text.startswith('```'):
                # Extract content between code blocks
                cleaned_text = re.sub(r'^```(?:json)?\n', '', cleaned_text)
                cleaned_text = re.sub(r'\n```$', '', cleaned_text)
            
            # Try to find JSON object
            json_match = re.search(r'\{.*\}', cleaned_text, re.DOTALL)
            if json_match:
                recipe_data = json.loads(json_match.group(0))
            else:
                recipe_data = json.loads(cleaned_text)
            
            logging.info(f"[RECIPE] JSON parsed successfully. Recipe name: {recipe_data.get('recipe_name', 'N/A')}")
            
            # Validate required fields
            required_fields = ['recipe_name', 'ingredients', 'instructions', 'nutrition_info', 'prep_time', 'cook_time', 'servings']
            missing_fields = [field for field in required_fields if field not in recipe_data]
            if missing_fields:
                logging.error(f"[RECIPE] Missing required fields: {missing_fields}")
                raise ValueError(f"Recipe data missing required fields: {missing_fields}")
                
        except json.JSONDecodeError as json_error:
            logging.error(f"[RECIPE] JSON parsing failed: {str(json_error)}", exc_info=True)
            logging.error(f"[RECIPE] Raw response text: {recipes_text}")
            raise HTTPException(status_code=500, detail=f"Failed to parse recipe data (invalid JSON): {str(json_error)}")
        except ValueError as val_error:
            logging.error(f"[RECIPE] Validation failed: {str(val_error)}")
            raise HTTPException(status_code=500, detail=str(val_error))
        except Exception as parse_error:
            logging.error(f"[RECIPE] Unexpected parsing error: {str(parse_error)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to parse recipe data: {str(parse_error)}")
        
        # Generate image for the recipe using DALL-E 3
        logging.info(f"[RECIPE] === IMAGE GENERATION START ===")
        logging.info(f"[RECIPE] Generating image for recipe: {recipe_data['recipe_name']}")
        try:
            # Generate food image using DALL-E 3 (reliable, widely available)
            image_prompt = f"Hyper-realistic professional food photography of {recipe_data['recipe_name']}, shot with high-end camera, studio lighting, perfectly plated on elegant dishware, appetizing presentation, shallow depth of field, food magazine quality, 8K resolution, photorealistic"
            
            logging.info(f"[RECIPE] Creating OpenAI client for DALL-E 3...")
            image_client = openai.AsyncOpenAI(api_key=openai_key)
            
            logging.info(f"[RECIPE] Calling DALL-E 3 for image generation...")
            image_response = await image_client.images.generate(
                model="dall-e-3",
                prompt=image_prompt,
                size="1024x1024",
                quality="hd"
            )
            logging.info(f"[RECIPE] DALL-E 3 image generated successfully")
            
            # Download image from URL
            import httpx
            image_url = image_response.data[0].url
            logging.info(f"[RECIPE] Downloading image from: {image_url}")
            
            async with httpx.AsyncClient() as http_client:
                img_response = await http_client.get(image_url)
                if img_response.status_code != 200:
                    raise Exception(f"Failed to download image. Status: {img_response.status_code}")
                img_bytes = img_response.content
                logging.info(f"[RECIPE] Downloaded image, size: {len(img_bytes)} bytes")
            
            # Compress the image before storing
            try:
                original_size = len(img_bytes)
                image = Image.open(io.BytesIO(img_bytes))
                
                # Convert to RGB if needed
                if image.mode in ('RGBA', 'LA', 'P'):
                    background = Image.new('RGB', image.size, (255, 255, 255))
                    if image.mode == 'P':
                        image = image.convert('RGBA')
                    background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                    image = background
                
                # Resize to 800x800 (smaller than original 1024x1024)
                image.thumbnail((800, 800), Image.Resampling.LANCZOS)
                
                # Convert to base64 with JPEG compression
                buffer = io.BytesIO()
                image.save(buffer, format='JPEG', quality=85)
                image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                compressed_size = len(image_base64)
                compression_ratio = (1 - compressed_size / original_size) * 100
                logging.info(f"[RECIPE] Image compressed: {original_size} → {compressed_size} bytes ({compression_ratio:.1f}% reduction)")
            except Exception as compress_error:
                logging.error(f"[RECIPE] Error compressing image: {str(compress_error)}")
                # Fallback to uncompressed
                image_base64 = b64_data
                logging.info(f"[RECIPE] Using uncompressed image. Size: {len(image_base64)} chars")
        except Exception as img_error:
            logging.error(f"[RECIPE] === IMAGE GENERATION FAILED ===")
            logging.error(f"[RECIPE] Error generating image: {str(img_error)}", exc_info=True)
            logging.error(f"[RECIPE] Error type: {type(img_error).__name__}")
            image_base64 = None
        
        # Create recipe document
        logging.info(f"[RECIPE] Creating recipe document for database...")
        try:
            current_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            recipe = Recipe(
                athlete_id=athlete_id,
                week_start_date=current_date,
                day_of_week='',  # Not used in new format
                meal_type=meal_type,
                recipe_name=recipe_data['recipe_name'],
                ingredients=recipe_data['ingredients'],
                instructions=recipe_data['instructions'],
                nutrition_info=recipe_data['nutrition_info'],
                prep_time=recipe_data['prep_time'],
                cook_time=recipe_data['cook_time'],
                servings=recipe_data['servings'],
                image_base64=image_base64,
                measurement_system=measurement_system  # Store user's measurement preference
            )
            
            recipe_dict = prepare_for_mongo(recipe.model_dump())
            recipe_id = recipe_dict.get('id')
            await db.recipes.insert_one(recipe_dict)
            logging.info(f"[RECIPE] Recipe saved to database successfully. ID: {recipe_id}")
            
            # Fetch the saved recipe without _id to avoid serialization issues
            saved_recipe = await db.recipes.find_one({"id": recipe_id}, {"_id": 0})
            
            return {
                "success": True,
                "meal_type": meal_type,
                "recipe_name": recipe_data['recipe_name'],
                "recipe": parse_from_mongo(saved_recipe)
            }
        except Exception as db_error:
            logging.error(f"[RECIPE] Database error: {str(db_error)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to save recipe: {str(db_error)}")
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[RECIPE] Error generating recipe: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Recipe generation failed: {str(e)}")

@api_router.get("/recipes/{athlete_id}")
async def get_recipes(athlete_id: str, week_start_date: Optional[str] = None, include_images: bool = True):
    """Get recipes for an athlete, optionally filtered by week
    
    Args:
        athlete_id: The athlete's ID
        week_start_date: Optional filter by week
        include_images: Whether to include base64 images (default True, now compressed)
    """
    query = {"athlete_id": athlete_id}
    if week_start_date:
        query["week_start_date"] = week_start_date
    
    # Include compressed images by default (they're now small enough)
    projection = {"_id": 0}
    if not include_images:
        projection["image_base64"] = 0
    
    recipes = await db.recipes.find(query, projection).sort("day_of_week", 1).to_list(length=None)
    return {"recipes": [parse_from_mongo(recipe) for recipe in recipes]}

@api_router.get("/recipe/{recipe_id}")
async def get_recipe(recipe_id: str):
    """Get a single recipe by ID with full details including image"""
    recipe = await db.recipes.find_one({"id": recipe_id}, {"_id": 0})
    
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    return parse_from_mongo(recipe)

@api_router.put("/recipes/{recipe_id}/rating")
async def rate_recipe(recipe_id: str, rating: dict):
    """Update recipe rating"""
    user_rating = rating.get('rating')
    if user_rating is None or not (1 <= user_rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    result = await db.recipes.update_one(
        {"id": recipe_id},
        {"$set": {"user_rating": user_rating, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    return {"success": True}

@api_router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str):
    """Delete a recipe"""
    result = await db.recipes.delete_one({"id": recipe_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    return {"success": True}


# Weekly Menu routes
@api_router.get("/weekly-menus/{athlete_id}")
async def get_weekly_menus(athlete_id: str):
    """Get all weekly menus for an athlete"""
    menus = await db.weekly_menus.find(
        {"athlete_id": athlete_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=None)
    
    return {"menus": [parse_from_mongo(menu) for menu in menus]}

@api_router.post("/weekly-menus")
async def create_weekly_menu(menu: WeeklyMenu):
    """Create a new weekly menu template"""
    try:
        # If this menu is set as active, deactivate all other menus for this athlete
        if menu.is_active:
            await db.weekly_menus.update_many(
                {"athlete_id": menu.athlete_id, "is_active": True},
                {"$set": {"is_active": False}}
            )
        
        menu_dict = prepare_for_mongo(menu.model_dump())
        await db.weekly_menus.insert_one(menu_dict)
        
        # Fetch the saved menu
        saved_menu = await db.weekly_menus.find_one({"id": menu.id}, {"_id": 0})
        
        return {
            "success": True,
            "menu": parse_from_mongo(saved_menu)
        }
    except Exception as e:
        logging.error(f"Error creating weekly menu: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create menu: {str(e)}")

@api_router.put("/weekly-menus/{menu_id}")
async def update_weekly_menu(menu_id: str, menu_update: dict):
    """Update a weekly menu template"""
    try:
        # If setting this menu as active, deactivate others
        if menu_update.get('is_active'):
            athlete_id = menu_update.get('athlete_id')
            if athlete_id:
                await db.weekly_menus.update_many(
                    {"athlete_id": athlete_id, "id": {"$ne": menu_id}, "is_active": True},
                    {"$set": {"is_active": False}}
                )
        
        menu_update['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        result = await db.weekly_menus.update_one(
            {"id": menu_id},
            {"$set": menu_update}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Menu not found")
        
        # Fetch updated menu
        updated_menu = await db.weekly_menus.find_one({"id": menu_id}, {"_id": 0})
        
        return {
            "success": True,
            "menu": parse_from_mongo(updated_menu)
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating weekly menu: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update menu: {str(e)}")

@api_router.delete("/weekly-menus/{menu_id}")
async def delete_weekly_menu(menu_id: str):
    """Delete a weekly menu"""
    result = await db.weekly_menus.delete_one({"id": menu_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    return {"success": True}

@api_router.get("/weekly-menus/{menu_id}/details")
async def get_weekly_menu_details(menu_id: str):
    """Get a weekly menu with full recipe details"""
    menu = await db.weekly_menus.find_one({"id": menu_id}, {"_id": 0})
    
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    # Fetch full recipe details for each meal
    recipe_ids = [meal.get('recipe_id') for meal in menu.get('meals', []) if meal.get('recipe_id')]
    recipes = {}
    
    if recipe_ids:
        recipe_list = await db.recipes.find(
            {"id": {"$in": recipe_ids}},
            {"_id": 0}
        ).to_list(length=None)
        
        for recipe in recipe_list:
            recipes[recipe['id']] = parse_from_mongo(recipe)
    
    return {
        "menu": parse_from_mongo(menu),
        "recipes": recipes
    }


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
    
    # Get Stripe settings from system_settings
    system_settings = await db.system_settings.find_one({}, {"_id": 0})
    if not system_settings:
        raise HTTPException(status_code=500, detail="System settings not found")
    
    stripe_settings = system_settings.get("advanced", {}).get("stripe", {})
    stripe_mode = stripe_settings.get("mode", "test")
    
    # Get the appropriate API key based on mode
    if stripe_mode == "live":
        stripe_secret_key = stripe_settings.get("live", {}).get("apiKey") or stripe_settings.get("live", {}).get("secretKey")
    else:
        stripe_secret_key = stripe_settings.get("sandbox", {}).get("apiKey") or stripe_settings.get("sandbox", {}).get("secretKey")
    
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail=f"Stripe API key not configured for {stripe_mode} mode")
    
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
                    
                    # Track purchase event (analytics)
                    try:
                        coupon_code = webhook_response.metadata.get("coupon_code")
                        purchase_event = {
                            "event": "purchase",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "user_id": athlete_id,
                            "transaction_id": webhook_response.session_id,
                            "value": float(transaction.get("amount", 0)),
                            "currency": transaction.get("currency", "EUR").upper(),
                            "items": [{
                                "item_id": transaction.get("plan_id"),
                                "item_name": f"{transaction.get('tier', 'Unknown')} - {transaction.get('interval', 'month')}",
                                "price": float(transaction.get("amount", 0)),
                                "quantity": 1
                            }],
                            "payment_method": "stripe",
                            "subscription_tier": transaction.get("tier"),
                            "billing_interval": transaction.get("interval"),
                            **({"coupon": coupon_code} if coupon_code else {}),
                            "webhook_event": True
                        }
                        
                        # Store analytics event
                        await db.analytics_events.insert_one(purchase_event)
                        logging.info(f"Purchase event tracked for athlete {athlete_id}: {webhook_response.session_id}")
                    except Exception as analytics_error:
                        logging.error(f"Failed to track purchase event: {analytics_error}")
                    
                    # Record coupon usage if coupon was applied
                    coupon_code = webhook_response.metadata.get("coupon_code")
                    if coupon_code:
                        try:
                            # Get coupon details
                            coupon_doc = await db.coupons.find_one({"code": coupon_code.upper()}, {"_id": 0})
                            if coupon_doc:
                                # Calculate discount amount
                                amount = transaction.get("amount", 0)
                                if coupon_doc["type"] == "percentage":
                                    discount_amount = (amount * coupon_doc["value"]) / 100
                                else:
                                    discount_amount = min(coupon_doc["value"], amount)
                                
                                # Create coupon usage record
                                usage_record = CouponUsage(
                                    coupon_id=coupon_doc["id"],
                                    coupon_code=coupon_code.upper(),
                                    athlete_id=athlete_id,
                                    session_id=webhook_response.session_id,
                                    discount_amount=discount_amount,
                                    original_amount=amount,
                                    final_amount=amount - discount_amount
                                )
                                
                                await db.coupon_usage.insert_one(usage_record.model_dump())
                                logging.info(f"Recorded coupon usage: {coupon_code} for athlete {athlete_id}")
                        except Exception as e:
                            logging.error(f"Failed to record coupon usage: {e}")
        
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
async def get_workouts(athlete_id: str, limit: int = 20, date: Optional[str] = None):
    """Get workouts for an athlete, optionally filtered by date"""
    query = {"athlete_id": athlete_id}
    
    # Add date filter if provided
    if date:
        # Match workouts where start_date contains the date string
        query["start_date"] = {"$regex": f"^{date}"}
    
    workouts = await db.workouts.find(
        query, 
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
        print(f"[VOICE] Starting voice session creation for athlete {athlete_id}")
        
        # Get the realtime chat instance for this athlete (this can raise HTTPException)
        realtime_chat = await get_realtime_chat_for_athlete(athlete_id)
        print(f"[VOICE] Realtime chat instance created")
        
        # Get athlete context for the voice session
        context = await ai_coach.get_athlete_context(athlete_id)
        print(f"[VOICE] Athlete context retrieved")
        
        # Create the system message with athlete context (similar to text chat)
        athlete_info = context.get('athlete', {})
        distance_unit = athlete_info.get('distance_unit', 'miles')
        measurement_system = athlete_info.get('measurement_system', 'imperial')
        voice_preference = athlete_info.get('voice_preference', 'alloy')
        coach_language = athlete_info.get('coach_language', 'en')
        
        # Language name mapping
        language_names = {
            'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German', 
            'it': 'Italian', 'pt': 'Portuguese', 'nl': 'Dutch', 'no': 'Norwegian',
            'sv': 'Swedish', 'da': 'Danish', 'fi': 'Finnish', 'pl': 'Polish',
            'ru': 'Russian', 'ja': 'Japanese', 'zh': 'Chinese', 'ko': 'Korean'
        }
        language_name = language_names.get(coach_language, 'English')
        
        # Validate voice preference - OpenAI Realtime API supported voices
        valid_voices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar']
        if voice_preference not in valid_voices:
            print(f"[VOICE] Invalid voice '{voice_preference}', using default 'alloy'")
            voice_preference = 'alloy'
        
        print(f"[VOICE] Voice preference: {voice_preference}, Language: {language_name}")
        
        # Get current date for context
        from datetime import datetime, timezone as dt_timezone
        current_date = datetime.now(dt_timezone.utc).strftime("%Y-%m-%d")
        current_day = datetime.now(dt_timezone.utc).strftime("%A, %B %d, %Y")
        
        # Format athlete summary with proper units
        weekly_distance = athlete_info.get('weekly_mileage', 0)
        distance_label = 'km' if distance_unit == 'km' else 'miles'
        
        # Get available data
        workouts = context.get('recent_workouts', [])
        sleep_data = context.get('recent_sleep', [])
        journal_entries = context.get('journal_entries', [])
        nutrition_entries = context.get('nutrition_entries', [])
        test_results = context.get('test_results', [])
        readiness = context.get('current_readiness', {})
        
        # Build concise data availability summary
        data_summary = []
        if workouts:
            data_summary.append(f"{len(workouts)} recent workouts")
        if sleep_data:
            avg_sleep = sum(s.get('total_sleep_hours', 0) for s in sleep_data) / len(sleep_data)
            data_summary.append(f"sleep data (avg {avg_sleep:.1f}h)")
        if nutrition_entries:
            data_summary.append(f"{len(nutrition_entries)} nutrition logs")
        if test_results:
            test_names = list(set(t.get('test_name') for t in test_results[:5]))
            data_summary.append(f"test results ({', '.join(test_names[:3])})")
        if journal_entries:
            data_summary.append(f"{len(journal_entries)} journal entries")
        if readiness:
            data_summary.append(f"readiness score: {readiness.get('readiness_score', 'N/A')}")
        
        available_data = ", ".join(data_summary) if data_summary else "No recent data"
        
        system_message = f"""
You are an expert endurance running coach speaking directly with your athlete via voice.

TODAY'S DATE: {current_day}

CRITICAL: RESPOND IN {language_name.upper()} - All responses must be in {language_name}.

ATHLETE: {athlete_info.get('name')}, Age {athlete_info.get('age')}, Weekly: {weekly_distance} {distance_label}, Goals: {athlete_info.get('running_goals', 'General fitness')}

PREFERENCES: Always use {distance_unit} for distances, {measurement_system} system

AVAILABLE DATA: {available_data}

You can use these tools to get detailed information:
- get_athlete_profile() - Full profile details
- get_recent_workouts(days) - Workout history 
- get_nutrition_data(days) - Nutrition logs with macros
- get_test_results(test_name) - Performance test data
- get_training_blocks_for_period(start, end) - View calendar
- create_training_blocks(blocks_data) - Add workouts
- update_training_blocks(updates) - Modify workouts
- delete_training_blocks(block_ids) - Remove workouts

VOICE GUIDELINES:
- Natural, conversational tone
- Concise responses
- Reference specific data when relevant
- Ask follow-up questions
- Use athlete's name
- Always use {distance_unit}

COACHING:
- Safety and injury prevention first
- Data-driven recommendations
- Encouraging but realistic
- Calendar management available
"""
        
        # Create ephemeral session for audio chat with voice preference
        # Pass voice preference to use the athlete's selected voice
        try:
            print(f"[VOICE] Creating ephemeral session with voice={voice_preference}")
            session_data = await realtime_chat.create_ephemeral_session_for_audio_chat(
                voice=voice_preference,
                system_message=system_message
            )
            print(f"[VOICE] Session data received: {type(session_data)}")
        except TypeError as te:
            print(f"[VOICE] TypeError with system_message: {te}")
            # Fallback: Try with just voice parameter if system_message not supported
            try:
                print(f"[VOICE] Retrying with just voice parameter")
                session_data = await realtime_chat.create_ephemeral_session_for_audio_chat(voice=voice_preference)
                print(f"[VOICE] Session data received (fallback 1): {type(session_data)}")
            except TypeError as te2:
                print(f"[VOICE] TypeError with voice only: {te2}")
                # Final fallback: Use default parameters
                print(f"[VOICE] Using default parameters")
                session_data = await realtime_chat.create_ephemeral_session_for_audio_chat()
                print(f"[VOICE] Session data received (fallback 2): {type(session_data)}")
        
        print(f"[VOICE] Inspecting session_data structure: {session_data}")
        
        # Check if the session creation returned an error (invalid API key, etc.)
        if isinstance(session_data, dict):
            # Check for direct error response (emergentintegrations format)
            if "error" in session_data:
                error_info = session_data["error"]
                error_message = error_info.get("message", "OpenAI API error")
                
                print(f"[VOICE] DETECTED ERROR in session_data: {error_message}")
                logging.warning(f"DETECTED ERROR in voice session for athlete {athlete_id}: {error_message}")
                
                # Convert OpenAI API errors to proper 400 HTTPException
                if "API key" in error_message or error_info.get("code") == "invalid_api_key":
                    logging.warning(f"Invalid OpenAI API key for athlete {athlete_id}: {error_message}")
                    raise HTTPException(status_code=400, detail="OpenAI API key required for voice chat")
                else:
                    logging.error(f"OpenAI API error for athlete {athlete_id}: {error_message}")
                    raise HTTPException(status_code=400, detail=f"OpenAI API error: {error_message}")
            
            # Check for client_secret structure
            elif "client_secret" in session_data:
                client_secret_data = session_data["client_secret"]
                print(f"[VOICE] Found client_secret: {type(client_secret_data)}")
                
                # Check for error in the client_secret
                if isinstance(client_secret_data, dict) and "error" in client_secret_data:
                    error_info = client_secret_data["error"]
                    error_message = error_info.get("message", "OpenAI API error")
                    
                    print(f"[VOICE] DETECTED ERROR in client_secret: {error_message}")
                    logging.warning(f"DETECTED ERROR in client_secret for athlete {athlete_id}: {error_message}")
                    
                    # Convert OpenAI API errors to proper 400 HTTPException
                    if "API key" in error_message or error_info.get("code") == "invalid_api_key":
                        logging.warning(f"Invalid OpenAI API key for athlete {athlete_id}: {error_message}")
                        raise HTTPException(status_code=400, detail="OpenAI API key required for voice chat")
                    else:
                        logging.error(f"OpenAI API error for athlete {athlete_id}: {error_message}")
                        raise HTTPException(status_code=400, detail=f"OpenAI API error: {error_message}")
                
                # Check for valid token
                elif isinstance(client_secret_data, dict) and "value" in client_secret_data:
                    # Valid token found, return it
                    print(f"[VOICE] Valid token found, returning to client")
                    return {"client_secret": {"value": client_secret_data["value"]}}
        
        print(f"[VOICE] WARNING: Unexpected session_data structure, returning raw data")
        logging.warning(f"Unexpected session_data structure for athlete {athlete_id}, returning raw data")
        # Fallback: return the raw session data if structure is unexpected
        return {"client_secret": session_data}
        
    except HTTPException:
        # Re-raise HTTPExceptions (like 400 for missing API key) without modification
        raise
    except Exception as e:
        print(f"[VOICE] ERROR: {type(e).__name__}: {str(e)}")
        logging.error(f"Voice session creation error: {e}")
        import traceback
        traceback.print_exc()
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
    """Initiate Oura OAuth authorization flow using system-wide credentials"""
    # Get system-wide Oura credentials from system_settings
    system_settings = await db.system_settings.find_one({"category": "advanced"})
    
    print(f"DEBUG: System settings found: {system_settings is not None}")
    if system_settings:
        print(f"DEBUG: Oura config: {system_settings.get('oura')}")
    
    if not system_settings or not system_settings.get("oura"):
        raise HTTPException(
            status_code=404, 
            detail="Oura credentials not configured in System Settings. Please configure them in System Settings > Advanced."
        )
    
    oura_config = system_settings["oura"]
    if not oura_config.get("clientId") or not oura_config.get("clientSecret"):
        raise HTTPException(
            status_code=404,
            detail="Oura Client ID or Secret missing in System Settings."
        )
    
    state = f"{athlete_id}_{secrets.token_urlsafe(16)}"
    
    # Use callback domain from system settings or default
    callback_domain = oura_config.get("callbackDomain", "kaizenlifetracker.com")
    redirect_uri = f"https://{callback_domain}/api/auth/oura/callback"
    
    print(f"DEBUG: Callback domain: {callback_domain}")
    print(f"DEBUG: Redirect URI: {redirect_uri}")
    
    auth_params = {
        "response_type": "code",
        "client_id": oura_config["clientId"],
        "redirect_uri": redirect_uri,
        "scope": "email personal daily heartrate workout session tag spo2",
        "state": state
    }
    
    auth_url = f"https://cloud.ouraring.com/oauth/authorize?{urlencode(auth_params)}"
    print(f"DEBUG: Full auth URL: {auth_url}")
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
    # Check if system credentials are configured
    system_settings = await db.system_settings.find_one({"category": "advanced"})
    has_system_credentials = bool(
        system_settings and 
        system_settings.get("oura", {}).get("clientId") and 
        system_settings.get("oura", {}).get("clientSecret")
    )
    
    # Check user's integration status
    integration = await db.integrations.find_one({
        "athlete_id": athlete_id, 
        "integration_type": "oura"
    })
    
    if not integration:
        return {
            "connected": False, 
            "last_sync": None, 
            "has_credentials": has_system_credentials
        }
    
    is_connected = integration.get("is_active", False) and integration.get("credentials", {}).get("access_token")
    
    return {
        "connected": is_connected,
        "has_credentials": has_system_credentials,
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
    # Check subscription tier and enforce limits
    athlete_id = schedule.athlete_id
    
    # Get current subscription status
    try:
        subscription = await db.athlete_profiles.find_one(
            {"id": athlete_id},
            {"_id": 0, "subscription_tier": 1}
        )
        tier = subscription.get('subscription_tier', 'free') if subscription else 'free'
    except:
        tier = 'free'
    
    # Define schedule limits per tier
    schedule_limits = {
        'free': 1,
        'pro': 5,
        'premium': float('inf')
    }
    limit = schedule_limits.get(tier, 1)
    
    # Count existing schedules for this athlete
    existing_count = await db.schedules.count_documents({
        "athlete_id": athlete_id,
        "active": True
    })
    
    # Check if limit would be exceeded
    if existing_count >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"Schedule limit reached for {tier} plan. Current: {existing_count}, Limit: {int(limit) if limit != float('inf') else 'unlimited'}. Please upgrade to add more schedules."
        )
    
    schedule_dict = schedule.model_dump()
    # Convert datetime to ISO string for MongoDB
    if isinstance(schedule_dict.get('created_at'), datetime):
        schedule_dict['created_at'] = schedule_dict['created_at'].isoformat()
    if isinstance(schedule_dict.get('last_executed'), datetime):
        schedule_dict['last_executed'] = schedule_dict['last_executed'].isoformat()
    
    await db.schedules.insert_one(schedule_dict)
    return schedule

@api_router.get("/schedules/{athlete_id}", response_model=List[Schedule])
async def get_athlete_schedules(athlete_id: str):
    """Get all schedules for an athlete"""
    schedules = await db.schedules.find(
        {"athlete_id": athlete_id, "active": True}, 
        {"_id": 0}
    ).to_list(length=None)
    return schedules

@api_router.put("/schedules/{schedule_id}", response_model=Schedule)
async def update_schedule(schedule_id: str, updates: dict):
    """Update an existing schedule"""
    # Get the existing schedule to compare changes
    existing_schedule = await db.schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not existing_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Check if time or frequency is being changed
    time_changed = 'time' in updates and updates['time'] != existing_schedule.get('time')
    frequency_changed = 'frequency' in updates and updates['frequency'] != existing_schedule.get('frequency')
    
    # If time or frequency changed, reset last_executed to allow immediate re-execution
    if time_changed or frequency_changed:
        updates['last_executed'] = None
        print(f"[SCHEDULE UPDATE] Resetting last_executed for schedule {schedule_id} due to time/frequency change")
    
    # Convert datetime fields if present
    if 'last_executed' in updates and isinstance(updates['last_executed'], datetime):
        updates['last_executed'] = updates['last_executed'].isoformat()
    
    await db.schedules.update_one(
        {"id": schedule_id},
        {"$set": updates}
    )
    updated_schedule = await db.schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not updated_schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return updated_schedule

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

# Manual trigger endpoint for testing
@api_router.post("/schedules/execute-now/{schedule_id}")
async def execute_schedule_now(schedule_id: str):
    """Manually trigger a schedule execution (for testing)"""
    schedule = await db.schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    await execute_scheduled_prompt(
        schedule['id'],
        schedule['athlete_id'],
        schedule['prompt'],
        schedule['title']
    )
    
    return {"message": "Schedule executed successfully", "schedule_id": schedule_id}

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

@api_router.put("/recommendations/{recommendation_id}/read")
async def mark_recommendation_read_put(recommendation_id: str):
    """Mark a recommendation as read (PUT method)"""
    await db.recommendations.update_one(
        {"id": recommendation_id},
        {"$set": {"read": True}}
    )
    return {"message": "Recommendation marked as read"}

@api_router.delete("/recommendations/{recommendation_id}")
async def delete_recommendation(recommendation_id: str):
    """Delete a recommendation"""
    result = await db.recommendations.delete_one({"id": recommendation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return {"message": "Recommendation deleted successfully"}

# Memory Management Routes
@api_router.get("/memories/{athlete_id}")
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
    ).sort("importance", -1).sort("created_at", -1).to_list(length=None)
    
    return {"memories": [parse_from_mongo(m) for m in memories]}

@api_router.post("/memories/{athlete_id}")
async def create_memory(athlete_id: str, memory: AthleteMemory):
    """Create a new memory manually"""
    memory.athlete_id = athlete_id
    memory_dict = prepare_for_mongo(memory.model_dump())
    await db.athlete_memories.insert_one(memory_dict)
    return {"message": "Memory created successfully", "id": memory.id}

@api_router.put("/memories/{memory_id}")
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

@api_router.delete("/memories/{memory_id}")
async def delete_memory(memory_id: str):
    """Delete a memory"""
    result = await db.athlete_memories.delete_one({"id": memory_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    return {"message": "Memory deleted successfully"}

@api_router.get("/memories/{athlete_id}/categories")
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
    
    results = await db.athlete_memories.aggregate(pipeline).to_list(length=None)
    
    categories = [{"category": r["_id"], "count": r["count"]} for r in results]
    
    return {"categories": categories}

# Push Notification Routes
@api_router.get("/push/vapid-public-key")
async def get_vapid_public_key():
    """Get VAPID public key for push notification subscription"""
    public_key = os.environ.get('VAPID_PUBLIC_KEY')
    if not public_key:
        raise HTTPException(status_code=500, detail="VAPID public key not configured")
    return {"publicKey": public_key}

@api_router.post("/push/subscribe")
async def subscribe_to_push(subscription: PushSubscription):
    """Subscribe to push notifications"""
    try:
        # Check if subscription already exists
        existing = await db.push_subscriptions.find_one({
            "athlete_id": subscription.athlete_id,
            "endpoint": subscription.endpoint
        })
        
        if existing:
            # Update existing subscription
            await db.push_subscriptions.update_one(
                {"id": existing['id']},
                {"$set": {
                    "keys": subscription.keys,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            return {"message": "Push subscription updated successfully"}
        else:
            # Create new subscription
            subscription_dict = prepare_for_mongo(subscription.model_dump())
            await db.push_subscriptions.insert_one(subscription_dict)
            return {"message": "Push subscription created successfully", "id": subscription.id}
            
    except Exception as e:
        logging.error(f"Error subscribing to push: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to subscribe: {str(e)}")

@api_router.delete("/push/unsubscribe/{athlete_id}")
async def unsubscribe_from_push(athlete_id: str, endpoint: str = Query(...)):
    """Unsubscribe from push notifications"""
    try:
        result = await db.push_subscriptions.delete_one({
            "athlete_id": athlete_id,
            "endpoint": endpoint
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Subscription not found")
            
        return {"message": "Push subscription removed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error unsubscribing from push: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to unsubscribe: {str(e)}")

@api_router.get("/push/subscriptions/{athlete_id}")
async def get_push_subscriptions(athlete_id: str):
    """Get all push subscriptions for an athlete"""
    subscriptions = await db.push_subscriptions.find(
        {"athlete_id": athlete_id},
        {"_id": 0}
    ).to_list(length=None)
    return {"subscriptions": subscriptions}

@api_router.post("/push/test/{athlete_id}")
async def test_push_notification(athlete_id: str):
    """Test push notification (for development/testing)"""
    await send_push_notification(
        athlete_id=athlete_id,
        title="Test Notification",
        body="This is a test push notification from TrainSmart!",
        url="/dashboard"
    )
    return {"message": "Test push notification sent"}

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
        callback_domain = None
        
        if not client_id:
            # Try to get from user's saved credentials
            integration = await db.integrations.find_one({
                "athlete_id": user_id, 
                "integration_type": "strava"
            })
            if integration and integration.get("credentials"):
                client_id = integration["credentials"].get("client_id")
        
        if not client_id:
            # Fallback: Check system_settings for global Strava credentials
            settings_doc = await db.system_settings.find_one({"setting_type": "global"})
            if settings_doc and "advanced" in settings_doc and "strava" in settings_doc["advanced"]:
                strava_settings = settings_doc["advanced"]["strava"]
                client_id = strava_settings.get("clientId")
                callback_domain = strava_settings.get("callbackDomain")
        
        if not client_id:
            raise HTTPException(status_code=400, detail="Strava credentials not configured")
        
        # Store OAuth state in database for callback verification (expires in 10 minutes)
        await db.strava_oauth_state.update_one(
            {'user_id': user_id},
            {
                '$set': {
                    'user_id': user_id,
                    'state': state,
                    'created_at': datetime.now(timezone.utc),
                    'expires_at': datetime.now(timezone.utc) + timedelta(minutes=10)
                }
            },
            upsert=True
        )
        
        # Use callback domain from settings if available, otherwise fall back to BACKEND_URL
        if callback_domain:
            redirect_uri = f"https://{callback_domain}/auth/strava/callback"
        else:
            redirect_uri = f"{os.environ.get('BACKEND_URL', 'http://localhost:8001')}/auth/strava/callback"
        
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
    allow_origins=[origin.strip().strip('"').strip("'") for origin in os.environ.get('CORS_ORIGINS', '*').split(',')],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for uploaded images - MUST be before including the router
UPLOAD_DIR = Path("/app/backend/uploads/images")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Ensure uploaded_images directory exists for CMS pages
UPLOADED_IMAGES_DIR = Path("/app/backend/uploaded_images")
UPLOADED_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# Mount static files on the API router path so ingress can reach it
app.mount("/api/uploads", StaticFiles(directory="/app/backend/uploads"), name="uploads")
# Mount static files for CMS page images (must use /api prefix for Kubernetes ingress routing)
app.mount("/api/uploaded_images", StaticFiles(directory="/app/backend/uploaded_images"), name="uploaded_images")
# Mount static files for video journals
app.mount("/api/uploaded_videos", StaticFiles(directory="/app/backend/uploaded_videos"), name="uploaded_videos")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def create_community_indexes():
    """Create MongoDB indexes for community collections to improve query performance"""
    try:
        # Community posts indexes
        await db.community_posts.create_index([("created_at", -1)])
        await db.community_posts.create_index([("athlete_id", 1)])
        await db.community_posts.create_index([("id", 1)])
        
        # Community likes indexes
        await db.community_likes.create_index([("post_id", 1), ("athlete_id", 1)], unique=True)
        await db.community_likes.create_index([("post_id", 1)])
        
        # Community groups indexes
        await db.community_groups.create_index([("created_at", -1)])
        await db.community_groups.create_index([("id", 1)])
        await db.community_groups.create_index([("admin_id", 1)])
        
        # Community group memberships indexes
        await db.community_group_memberships.create_index([("group_id", 1), ("athlete_id", 1)], unique=True)
        await db.community_group_memberships.create_index([("athlete_id", 1), ("status", 1)])
        await db.community_group_memberships.create_index([("group_id", 1), ("status", 1)])
        
        # Community events indexes
        await db.community_events.create_index([("created_at", -1)])
        await db.community_events.create_index([("event_date", 1)])
        await db.community_events.create_index([("id", 1)])
        await db.community_events.create_index([("organizer_id", 1)])
        
        # Community event RSVPs indexes
        await db.community_event_rsvps.create_index([("event_id", 1), ("athlete_id", 1)], unique=True)
        await db.community_event_rsvps.create_index([("event_id", 1)])
        
        # Community notifications indexes
        await db.community_notifications.create_index([("athlete_id", 1), ("read", 1)])
        await db.community_notifications.create_index([("created_at", -1)])
        
        logging.info("Community collection indexes created successfully")
    except Exception as e:
        logging.error(f"Error creating community indexes: {e}")

@app.on_event("startup")
async def startup_scheduler():
    """Start the scheduler on app startup"""
    try:
        # Create community indexes for better performance
        await create_community_indexes()
        
        # Initialize SendGrid email service from database settings
        try:
            settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
            if settings and settings.get("advanced", {}).get("sendgrid"):
                sendgrid_config = settings["advanced"]["sendgrid"]
                if sendgrid_config.get("apiKey") and sendgrid_config.get("senderEmail"):
                    initialize_email_service(
                        api_key=sendgrid_config["apiKey"],
                        sender_email=sendgrid_config["senderEmail"],
                        sender_name=sendgrid_config.get("senderName", "TrainSmart")
                    )
                    print("=" * 50)
                    print("SENDGRID EMAIL SERVICE INITIALIZED")
                    print(f"Sender: {sendgrid_config['senderEmail']}")
                    print("=" * 50)
                    logging.info(f"SendGrid email service initialized from database: {sendgrid_config['senderEmail']}")
                else:
                    logging.warning("SendGrid credentials found in database but incomplete")
            else:
                logging.warning("No SendGrid configuration found in database - email service disabled")
        except Exception as email_error:
            logging.error(f"Failed to initialize email service from database: {email_error}")
        
        # Add job to check schedules every minute
        scheduler.add_job(
            check_and_execute_schedules,
            CronTrigger(minute='*'),  # Run every minute
            id='check_schedules',
            replace_existing=True
        )
        
        # Add job for weekly cookie scan (every Monday at 2 AM)
        scheduler.add_job(
            auto_scan_cookies,
            CronTrigger(day_of_week='mon', hour=2, minute=0),
            id='auto_cookie_scan',
            replace_existing=True
        )
        
        scheduler.start()
        print("=" * 50)
        print("SCHEDULER STARTED SUCCESSFULLY")
        print("Cookie auto-scan: Every Monday at 2 AM")
        print("=" * 50)
        logging.info("Scheduler started - checking for due schedules every minute")
        logging.info("Cookie auto-scan scheduled - every Monday at 2 AM")
    except Exception as e:
        print(f"ERROR STARTING SCHEDULER: {e}")
        logging.error(f"Failed to start scheduler: {e}")



# =====================================================
# HABIT TRACKER
# =====================================================

class Habit(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    title: str
    days_of_week: List[str]  # ['monday', 'tuesday', etc.]
    times_per_day: int
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class HabitCompletion(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    habit_id: str
    athlete_id: str
    date: str  # ISO date string YYYY-MM-DD
    completions: int  # Number of times completed that day
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class HabitUpdate(BaseModel):
    title: Optional[str] = None
    days_of_week: Optional[List[str]] = None
    times_per_day: Optional[int] = None

@app.post("/api/habits")
async def create_habit(habit: Habit):
    """Create a new habit"""
    try:
        habit_dict = habit.model_dump()
        await db.habits.insert_one(habit_dict)
        return {"success": True, "habit_id": habit.id}
    except Exception as e:
        logging.error(f"Error creating habit: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/habits/{athlete_id}")
async def get_habits(athlete_id: str):
    """Get all habits for an athlete"""
    try:
        habits = await db.habits.find({"athlete_id": athlete_id}, {"_id": 0}).to_list(length=None)
        return {"habits": habits}
    except Exception as e:
        logging.error(f"Error fetching habits: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/habits/{habit_id}")
async def update_habit(habit_id: str, update: HabitUpdate):
    """Update a habit"""
    try:
        update_data = {k: v for k, v in update.model_dump().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        result = await db.habits.update_one(
            {"id": habit_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Habit not found")
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating habit: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/habits/{habit_id}")
async def delete_habit(habit_id: str):
    """Delete a habit and all its completions"""
    try:
        # Delete habit
        result = await db.habits.delete_one({"id": habit_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Habit not found")
        
        # Delete all completions for this habit
        await db.habit_completions.delete_many({"habit_id": habit_id})
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting habit: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/habits/{habit_id}/complete")
async def log_habit_completion(habit_id: str, athlete_id: str, date: str):
    """Log a completion for a habit on a specific date"""
    try:
        # Check if completion already exists for this date
        existing = await db.habit_completions.find_one({
            "habit_id": habit_id,
            "athlete_id": athlete_id,
            "date": date
        })
        
        if existing:
            # Increment completion count
            await db.habit_completions.update_one(
                {"id": existing["id"]},
                {"$inc": {"completions": 1}}
            )
            return {"success": True, "completions": existing["completions"] + 1}
        else:
            # Create new completion record
            completion = HabitCompletion(
                habit_id=habit_id,
                athlete_id=athlete_id,
                date=date,
                completions=1
            )
            await db.habit_completions.insert_one(completion.model_dump())
            return {"success": True, "completions": 1}
    except Exception as e:
        logging.error(f"Error logging habit completion: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/habits/{habit_id}/uncomplete")
async def undo_habit_completion(habit_id: str, athlete_id: str, date: str):
    """Undo one completion for a habit on a specific date"""
    try:
        existing = await db.habit_completions.find_one({
            "habit_id": habit_id,
            "athlete_id": athlete_id,
            "date": date
        })
        
        if not existing:
            return {"success": True, "completions": 0}
        
        if existing["completions"] <= 1:
            # Delete the completion record
            await db.habit_completions.delete_one({"id": existing["id"]})
            return {"success": True, "completions": 0}
        else:
            # Decrement completion count
            await db.habit_completions.update_one(
                {"id": existing["id"]},
                {"$inc": {"completions": -1}}
            )
            return {"success": True, "completions": existing["completions"] - 1}
    except Exception as e:
        logging.error(f"Error undoing habit completion: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/habits/{athlete_id}/completions")
async def get_habit_completions(athlete_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get all habit completions for an athlete within a date range"""
    try:
        query = {"athlete_id": athlete_id}
        
        if start_date and end_date:
            query["date"] = {"$gte": start_date, "$lte": end_date}
        elif start_date:
            query["date"] = {"$gte": start_date}
        elif end_date:
            query["date"] = {"$lte": end_date}
        
        completions = await db.habit_completions.find(query, {"_id": 0}).to_list(length=None)
        return {"completions": completions}
    except Exception as e:
        logging.error(f"Error fetching habit completions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# IMAGE UPLOAD ENDPOINTS
# ==========================================

@api_router.post("/upload/images")
async def upload_images(
    request: Request,
    files: List[UploadFile] = File(...),
    max_files: int = Query(5, description="Maximum number of files allowed")
):
    """
    Upload multiple images with processing:
    - Resize to max 1024x1024px (maintains aspect ratio)
    - Convert to WebP format
    - Compress with minimal quality loss
    """
    # Validate max files first (before try block to preserve 400 status)
    if len(files) > max_files:
        raise HTTPException(status_code=400, detail=f"Maximum {max_files} images allowed")
    
    uploaded_urls = []
    
    for file in files:
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail=f"File {file.filename} is not an image")
        
        try:
            # Read file bytes
            file_bytes = await file.read()
            
            # Process and save image using image_processor
            # This will resize, convert to WebP, and compress
            processed_filename = process_and_save_image(
                file_data=file_bytes,
                upload_dir=UPLOAD_DIR,
                max_dimension=1024,
                quality=85
            )
            
            # Generate relative URL with /api prefix
            image_url = f"/api/uploads/images/{processed_filename}"
            uploaded_urls.append(image_url)
            
            logging.info(f"Processed and uploaded image: {processed_filename} -> {image_url}")
            
        except Exception as e:
            logging.error(f"Error processing image {file.filename}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to process image {file.filename}: {str(e)}")
    
    return {"urls": uploaded_urls}


@api_router.post("/upload/video")
async def upload_video(
    request: Request,
    file: UploadFile = File(...)
):
    """
    Upload and process a single video:
    - Compress to MP4 (H.264, max 720p)
    - Generate thumbnail
    - Max 2 minutes duration
    - Returns video URL and thumbnail URL
    """
    # Validate file type
    if not file.content_type.startswith('video/'):
        raise HTTPException(status_code=400, detail=f"File {file.filename} is not a video")
    
    # Check file size (max 200MB)
    file_bytes = await file.read()
    max_size = 200 * 1024 * 1024  # 200MB
    if len(file_bytes) > max_size:
        raise HTTPException(status_code=400, detail=f"Video file too large. Maximum size is 200MB")
    
    try:
        # Process video: compress and generate thumbnail
        video_filename, thumbnail_filename = process_and_save_video(
            file_data=file_bytes,
            upload_dir=UPLOAD_DIR,
            max_duration=120  # 2 minutes
        )
        
        # Generate relative URLs with /api prefix
        video_url = f"/api/uploads/images/{video_filename}"
        thumbnail_url = f"/api/uploads/images/{thumbnail_filename}"
        
        logging.info(f"Processed video: {video_filename}, thumbnail: {thumbnail_filename}")
        
        return {
            "video_url": video_url,
            "thumbnail_url": thumbnail_url,
            "type": "video"
        }
        
    except ValueError as e:
        # Duration or validation error
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error processing video: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process video: {str(e)}")


# ==========================================
# COMMUNITY ENDPOINTS
# ==========================================

@api_router.post("/community/fetch-youtube-metadata")
async def fetch_youtube_metadata(data: dict):
    """Fetch YouTube video metadata"""
    try:
        url = data.get("url", "")
        
        # Extract video ID from YouTube URL
        video_id = None
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\?\/]+)',
            r'youtube\.com\/embed\/([^&\?\/]+)',
            r'youtube\.com\/v\/([^&\?\/]+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                video_id = match.group(1)
                break
        
        if not video_id:
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")
        
        # Fetch video info using oEmbed API (no API key needed)
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch YouTube metadata")
            
            video_data = response.json()
            
            return {
                "video_id": video_id,
                "title": video_data.get("title", ""),
                "author": video_data.get("author_name", ""),
                "thumbnail": video_data.get("thumbnail_url", ""),
                "embed_url": f"https://www.youtube.com/embed/{video_id}"
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching YouTube metadata: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/community/fetch-url-preview")
async def fetch_url_preview(data: dict):
    """Fetch OpenGraph metadata from URL"""
    try:
        url = data.get("url", "")
        
        if not url:
            raise HTTPException(status_code=400, detail="URL is required")
        
        # Fetch the webpage
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            response = await client.get(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch URL")
            
            # Parse HTML
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract OpenGraph data
            og_data = {}
            og_tags = soup.find_all('meta', property=re.compile(r'^og:'))
            for tag in og_tags:
                property_name = tag.get('property', '').replace('og:', '')
                content = tag.get('content', '')
                if property_name and content:
                    og_data[property_name] = content
            
            # Fallback to standard meta tags
            if not og_data.get('title'):
                title_tag = soup.find('title')
                if title_tag:
                    og_data['title'] = title_tag.string
            
            if not og_data.get('description'):
                desc_tag = soup.find('meta', attrs={'name': 'description'})
                if desc_tag:
                    og_data['description'] = desc_tag.get('content', '')
            
            # Get favicon if no image
            if not og_data.get('image'):
                icon_tag = soup.find('link', rel=re.compile(r'icon', re.I))
                if icon_tag:
                    icon_url = icon_tag.get('href', '')
                    if icon_url:
                        if not icon_url.startswith('http'):
                            from urllib.parse import urljoin
                            icon_url = urljoin(url, icon_url)
                        og_data['image'] = icon_url
            
            return {
                "url": url,
                "title": og_data.get('title', url),
                "description": og_data.get('description', '')[:200],  # Limit description length
                "image": og_data.get('image', ''),
                "site_name": og_data.get('site_name', '')
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching URL preview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/community/posts")
async def create_community_post(post_data: dict, athlete_id: str = Query(...)):
    """Create a new community post"""
    try:
        # Get athlete info for caching
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        content = post_data.get("content", "")
        
        # Extract mentions from content (@[user_id:username])
        import re
        mention_pattern = r'@\[([^:]+):([^\]]+)\]'
        mentions = re.findall(mention_pattern, content)
        
        # Create post
        post = {
            "id": str(uuid.uuid4()),
            "athlete_id": athlete_id,
            "athlete_name": athlete.get("name", "Unknown"),
            "athlete_profile_picture": athlete.get("profile_picture"),
            "content": content,
            "image_urls": post_data.get("image_urls", []),  # Array of image URLs (backward compatibility)
            "media": post_data.get("media", []),  # Array of media items [{type, url, thumbnail}]
            "visibility": post_data.get("visibility", "public"),  # Default to public
            "likes_count": 0,
            "comments_count": 0,
            "shares_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": None,
            "is_edited": False,
            "youtube_data": post_data.get("youtube_data"),  # YouTube video metadata
            "url_preview": post_data.get("url_preview")  # Website URL preview metadata
        }
        
        # Prepare for MongoDB and insert
        post_for_mongo = prepare_for_mongo(post.copy())
        await db.community_posts.insert_one(post_for_mongo)
        
        # Create notifications for mentioned users
        for user_id, user_name in mentions:
            if user_id != athlete_id:  # Don't notify self
                notification = {
                    "id": str(uuid.uuid4()),
                    "athlete_id": user_id,
                    "type": "mention",
                    "message": f"{athlete.get('name', 'Someone')} mentioned you in a post",
                    "from_athlete_id": athlete_id,
                    "from_athlete_name": athlete.get('name', 'Unknown'),
                    "post_id": post["id"],
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                notification_for_mongo = prepare_for_mongo(notification.copy())
                await db.community_notifications.insert_one(notification_for_mongo)
        
        return post  # Return original post without MongoDB _id
    except Exception as e:
        logging.error(f"Error creating community post: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/posts/{post_id}")
async def get_single_post(post_id: str, athlete_id: str = Query(...)):
    """Get a single post by ID with liked status"""
    try:
        post = await db.community_posts.find_one({"id": post_id}, {"_id": 0})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Check if user has liked it
        like = await db.community_likes.find_one({
            "post_id": post_id,
            "athlete_id": athlete_id
        })
        post["liked_by_user"] = like is not None
        
        return post
    except Exception as e:
        logging.error(f"Error fetching post: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/feed/{athlete_id}")
async def get_community_feed(athlete_id: str, limit: int = Query(50), skip: int = Query(0), exclude_images: bool = Query(False)):
    """Get community posts feed (all posts, sorted by newest first) - Optimized with pagination and optional image exclusion"""
    try:
        # Build projection to exclude image_data if requested
        projection_stage = {
            "$project": {
                "_id": 0,
                "user_like": 0,
                "author_info": 0
            }
        }
        
        if exclude_images:
            projection_stage["$project"]["image_data"] = 0
        
        # Use aggregation pipeline to fetch posts with like status and subscription tier in single query
        pipeline = [
            {"$match": {"visibility": "public"}},  # Only public posts in main feed
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$lookup": {
                    "from": "community_likes",
                    "let": {"post_id": "$id"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$and": [
                                        {"$eq": ["$post_id", "$$post_id"]},
                                        {"$eq": ["$athlete_id", athlete_id]}
                                    ]
                                }
                            }
                        }
                    ],
                    "as": "user_like"
                }
            },
            {
                "$lookup": {
                    "from": "athlete_profiles",
                    "localField": "athlete_id",
                    "foreignField": "id",
                    "as": "author_info"
                }
            },
            {
                "$addFields": {
                    "liked_by_user": {"$gt": [{"$size": "$user_like"}, 0]},
                    "has_image": {"$cond": [{"$ifNull": ["$image_data", False]}, True, False]},
                    "subscription_tier": {"$arrayElemAt": ["$author_info.subscription_tier", 0]},
                    "nationality": {"$arrayElemAt": ["$author_info.nationality", 0]}
                }
            },
            projection_stage
        ]
        
        posts = await db.community_posts.aggregate(pipeline).to_list(length=None)
        
        return {"posts": posts}
    except Exception as e:
        logging.error(f"Error fetching community feed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/following-feed/{athlete_id}")
async def get_following_feed(athlete_id: str, limit: int = Query(50), skip: int = Query(0), exclude_images: bool = Query(False)):
    """Get posts from people the user follows + own posts (personal/following feed)"""
    try:
        # Get list of users the athlete follows
        follows = await db.community_follows.find(
            {"follower_id": athlete_id},
            {"_id": 0, "following_id": 1}
        ).to_list(length=None)
        
        following_ids = [f["following_id"] for f in follows]
        # Add user's own ID to see their own posts
        following_ids.append(athlete_id)
        
        # Build projection to exclude image_data if requested
        projection_stage = {
            "$project": {
                "_id": 0,
                "user_like": 0,
                "author_info": 0
            }
        }
        
        if exclude_images:
            projection_stage["$project"]["image_data"] = 0
        
        # Use aggregation pipeline to fetch posts from followed users + own posts
        # Show all posts (both public and private) for users you follow and yourself
        pipeline = [
            {"$match": {"athlete_id": {"$in": following_ids}}},
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$lookup": {
                    "from": "community_likes",
                    "let": {"post_id": "$id"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$and": [
                                        {"$eq": ["$post_id", "$$post_id"]},
                                        {"$eq": ["$athlete_id", athlete_id]}
                                    ]
                                }
                            }
                        }
                    ],
                    "as": "user_like"
                }
            },
            {
                "$lookup": {
                    "from": "athlete_profiles",
                    "localField": "athlete_id",
                    "foreignField": "id",
                    "as": "author_info"
                }
            },
            {
                "$addFields": {
                    "liked_by_user": {"$gt": [{"$size": "$user_like"}, 0]},
                    "has_image": {"$cond": [{"$ifNull": ["$image_data", False]}, True, False]},
                    "subscription_tier": {"$arrayElemAt": ["$author_info.subscription_tier", 0]},
                    "nationality": {"$arrayElemAt": ["$author_info.nationality", 0]}
                }
            },
            projection_stage
        ]
        
        posts = await db.community_posts.aggregate(pipeline).to_list(length=None)
        
        return {"posts": posts}
    except Exception as e:
        logging.error(f"Error fetching following feed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/community/user/{target_athlete_id}/posts")
async def get_user_posts(target_athlete_id: str, viewer_athlete_id: str = Query(...), limit: int = Query(50), skip: int = Query(0), exclude_images: bool = Query(False)):
    """Get posts created by a specific user (for their profile/wall)"""
    try:
        # Build projection to exclude image_data if requested
        projection_stage = {
            "$project": {
                "_id": 0,
                "user_like": 0,
                "author_info": 0
            }
        }
        
        if exclude_images:
            projection_stage["$project"]["image_data"] = 0
            # Don't exclude image_urls - they should always be returned
        
        # Use aggregation pipeline to fetch user's posts with like status
        pipeline = [
            {"$match": {"athlete_id": target_athlete_id}},
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$lookup": {
                    "from": "community_likes",
                    "let": {"post_id": "$id"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$and": [
                                        {"$eq": ["$post_id", "$$post_id"]},
                                        {"$eq": ["$athlete_id", viewer_athlete_id]}
                                    ]
                                }
                            }
                        }
                    ],
                    "as": "user_like"
                }
            },
            {
                "$lookup": {
                    "from": "athlete_profiles",
                    "localField": "athlete_id",
                    "foreignField": "id",
                    "as": "author_info"
                }
            },
            {
                "$addFields": {
                    "liked_by_user": {"$gt": [{"$size": "$user_like"}, 0]},
                    "has_image": {"$cond": [{"$ifNull": ["$image_data", False]}, True, False]},
                    "subscription_tier": {"$arrayElemAt": ["$author_info.subscription_tier", 0]},
                    "nationality": {"$arrayElemAt": ["$author_info.nationality", 0]}
                }
            },
            projection_stage
        ]
        
        posts = await db.community_posts.aggregate(pipeline).to_list(length=None)
        
        return {"posts": posts}
    except Exception as e:
        logging.error(f"Error fetching user posts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/community/posts/post/{post_id}")
async def get_single_post(post_id: str, athlete_id: str = Query(...)):
    """Get a single post by ID"""
    try:
        post = await db.community_posts.find_one({"id": post_id}, {"_id": 0})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Check if current user has liked it
        like = await db.community_likes.find_one({
            "post_id": post_id,
            "athlete_id": athlete_id
        })
        post["liked_by_user"] = like is not None
        
        return post
    except Exception as e:
        logging.error(f"Error fetching post: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/community/posts/{post_id}")
async def edit_community_post(post_id: str, post_data: dict, athlete_id: str = Query(...)):
    """Edit a community post"""
    try:
        # Verify ownership
        post = await db.community_posts.find_one({"id": post_id})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        if post["athlete_id"] != athlete_id:
            raise HTTPException(status_code=403, detail="Not authorized to edit this post")
        
        # Update post
        update_data = {
            "content": post_data.get("content", post["content"]),
            "image_data": post_data.get("image_data", post.get("image_data")),
            "image_urls": post_data.get("image_urls", post.get("image_urls", [])),
            "media": post_data.get("media", post.get("media", [])),
            "visibility": post_data.get("visibility", post.get("visibility", "public")),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "is_edited": True
        }
        
        await db.community_posts.update_one(
            {"id": post_id},
            {"$set": update_data}
        )
        
        updated_post = await db.community_posts.find_one({"id": post_id}, {"_id": 0})
        return {"success": True, "post": updated_post}
    except Exception as e:
        logging.error(f"Error editing post: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/community/posts/{post_id}")
async def delete_community_post(post_id: str, athlete_id: str = Query(...)):
    """Delete a community post - owner or super-admin"""
    try:
        # Verify ownership or super-admin status
        post = await db.community_posts.find_one({"id": post_id})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Check if user is super-admin
        athlete = await db.athlete_profiles.find_one({"id": athlete_id})
        is_super_admin = athlete.get("is_super_admin", False) if athlete else False
        
        if post["athlete_id"] != athlete_id and not is_super_admin:
            raise HTTPException(status_code=403, detail="Not authorized to delete this post")
        
        # Delete post and associated data (likes, comments, shares)
        await db.community_posts.delete_one({"id": post_id})
        await db.community_likes.delete_many({"post_id": post_id})
        await db.community_comments.delete_many({"post_id": post_id})
        await db.community_shares.delete_many({"post_id": post_id})
        
        return {"success": True, "message": "Post deleted"}
    except Exception as e:
        logging.error(f"Error deleting post: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/community/posts/{post_id}/like")
async def toggle_post_like(post_id: str, athlete_id: str = Query(...)):
    """Like or unlike a post"""
    try:
        # Check if post exists
        post = await db.community_posts.find_one({"id": post_id})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Check if already liked
        existing_like = await db.community_likes.find_one({
            "post_id": post_id,
            "athlete_id": athlete_id
        })
        
        if existing_like:
            # Unlike
            await db.community_likes.delete_one({"id": existing_like["id"]})
            await db.community_posts.update_one(
                {"id": post_id},
                {"$inc": {"likes_count": -1}}
            )
            liked = False
        else:
            # Like
            like = {
                "id": str(uuid.uuid4()),
                "post_id": post_id,
                "athlete_id": athlete_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.community_likes.insert_one(prepare_for_mongo(like.copy()))
            await db.community_posts.update_one(
                {"id": post_id},
                {"$inc": {"likes_count": 1}}
            )
            liked = True
            
            # Create notification for post owner (if not liking own post)
            if post["athlete_id"] != athlete_id:
                athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
                notification = {
                    "id": str(uuid.uuid4()),
                    "athlete_id": post["athlete_id"],
                    "type": "like",
                    "content": f"{athlete.get('name', 'Someone')} liked your post",
                    "post_id": post_id,
                    "from_athlete_id": athlete_id,
                    "from_athlete_name": athlete.get("name", "Unknown"),
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.community_notifications.insert_one(prepare_for_mongo(notification.copy()))
        
        # Get updated like count
        updated_post = await db.community_posts.find_one({"id": post_id}, {"_id": 0})
        return {
            "success": True,
            "liked": liked,
            "likes_count": updated_post["likes_count"]
        }
    except Exception as e:
        logging.error(f"Error toggling like: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/community/comments/{comment_id}/like")
async def toggle_comment_like(comment_id: str, athlete_id: str = Query(...)):
    """Like or unlike a comment"""
    try:
        # Check if comment exists
        comment = await db.community_comments.find_one({"id": comment_id})
        if not comment:
            raise HTTPException(status_code=404, detail="Comment not found")
        
        # Check if already liked
        existing_like = await db.community_comment_likes.find_one({
            "comment_id": comment_id,
            "athlete_id": athlete_id
        })
        
        if existing_like:
            # Unlike
            await db.community_comment_likes.delete_one({"id": existing_like["id"]})
            await db.community_comments.update_one(
                {"id": comment_id},
                {"$inc": {"likes_count": -1}}
            )
            liked = False
        else:
            # Like
            like = {
                "id": str(uuid.uuid4()),
                "comment_id": comment_id,
                "athlete_id": athlete_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.community_comment_likes.insert_one(prepare_for_mongo(like.copy()))
            await db.community_comments.update_one(
                {"id": comment_id},
                {"$inc": {"likes_count": 1}}
            )
            liked = True
            
            # Create notification for comment owner (if not liking own comment)
            if comment["athlete_id"] != athlete_id:
                athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
                notification = {
                    "id": str(uuid.uuid4()),
                    "athlete_id": comment["athlete_id"],
                    "type": "comment_like",
                    "content": f"{athlete.get('name', 'Someone')} liked your comment",
                    "post_id": comment.get("post_id"),
                    "comment_id": comment_id,
                    "from_athlete_id": athlete_id,
                    "from_athlete_name": athlete.get("name", "Unknown"),
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.community_notifications.insert_one(prepare_for_mongo(notification.copy()))
        
        # Get updated like count
        updated_comment = await db.community_comments.find_one({"id": comment_id}, {"_id": 0})
        return {
            "success": True,
            "liked": liked,
            "likes_count": updated_comment.get("likes_count", 0)
        }
    except Exception as e:
        logging.error(f"Error toggling comment like: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/community/posts/{post_id}/comment")
async def add_comment(post_id: str, comment_data: dict, athlete_id: str = Query(...)):
    """Add a comment to a post"""
    try:
        # Check if post exists
        post = await db.community_posts.find_one({"id": post_id})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Get athlete info
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        content = comment_data.get("content", "")
        
        # Extract mentions from content
        import re
        mention_pattern = r'@\[([^:]+):([^\]]+)\]'
        mentions = re.findall(mention_pattern, content)
        
        # Create comment
        comment = {
            "id": str(uuid.uuid4()),
            "post_id": post_id,
            "athlete_id": athlete_id,
            "athlete_name": athlete.get("name", "Unknown"),
            "athlete_profile_picture": athlete.get("profile_picture"),
            "content": content,
            "image_urls": comment_data.get("image_urls", []),  # Array of image URLs (max 3)
            "likes_count": 0,  # Initialize likes count
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.community_comments.insert_one(prepare_for_mongo(comment.copy()))
        await db.community_posts.update_one(
            {"id": post_id},
            {"$inc": {"comments_count": 1}}
        )
        
        # Create notification for post owner (if not commenting on own post)
        if post["athlete_id"] != athlete_id:
            notification = {
                "id": str(uuid.uuid4()),
                "athlete_id": post["athlete_id"],
                "type": "comment",
                "content": f"{athlete.get('name', 'Someone')} commented on your post",
                "post_id": post_id,
                "from_athlete_id": athlete_id,
                "from_athlete_name": athlete.get("name", "Unknown"),
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.community_notifications.insert_one(prepare_for_mongo(notification.copy()))
        
        # Create notifications for mentioned users
        for user_id, user_name in mentions:
            if user_id != athlete_id and user_id != post["athlete_id"]:  # Don't notify self or post owner (already notified)
                notification = {
                    "id": str(uuid.uuid4()),
                    "athlete_id": user_id,
                    "type": "mention",
                    "message": f"{athlete.get('name', 'Someone')} mentioned you in a comment",
                    "from_athlete_id": athlete_id,
                    "from_athlete_name": athlete.get('name', 'Unknown'),
                    "post_id": post_id,
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.community_notifications.insert_one(prepare_for_mongo(notification.copy()))
        
        # Get updated comment count
        updated_post = await db.community_posts.find_one({"id": post_id}, {"_id": 0})
        return {
            "success": True,
            "id": comment["id"],
            "comments_count": updated_post["comments_count"]
        }
    except Exception as e:
        logging.error(f"Error adding comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/athletes/search")
async def search_athletes_for_mention(q: str = Query(..., min_length=1)):
    """Search athletes for @mention - returns name and id"""
    try:
        # Search by name (case-insensitive)
        athletes = await db.athlete_profiles.find(
            {"name": {"$regex": q, "$options": "i"}},
            {"_id": 0, "id": 1, "name": 1}
        ).limit(10).to_list(length=None)
        
        return {"athletes": athletes}
    except Exception as e:
        logging.error(f"Error searching athletes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/posts/{post_id}/comments")
async def get_comments(post_id: str, athlete_id: str = Query(None)):
    """Get all comments for a post with subscription tier and liked status"""
    try:
        # Use aggregation to include subscription tier from athletes collection
        pipeline = [
            {"$match": {"post_id": post_id}},
            {"$sort": {"created_at": 1}},
            {
                "$lookup": {
                    "from": "athlete_profiles",
                    "localField": "athlete_id",
                    "foreignField": "id",
                    "as": "author_info"
                }
            },
            {
                "$addFields": {
                    "subscription_tier": {"$arrayElemAt": ["$author_info.subscription_tier", 0]},
                    "nationality": {"$arrayElemAt": ["$author_info.nationality", 0]}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "author_info": 0
                }
            }
        ]
        
        comments = await db.community_comments.aggregate(pipeline).to_list(length=None)
        
        # If athlete_id provided, check which comments are liked by this user
        if athlete_id:
            comment_ids = [c["id"] for c in comments]
            liked_comments = await db.community_comment_likes.find({
                "comment_id": {"$in": comment_ids},
                "athlete_id": athlete_id
            }).to_list(length=None)
            liked_comment_ids = {like["comment_id"] for like in liked_comments}
            
            for comment in comments:
                comment["liked_by_user"] = comment["id"] in liked_comment_ids
        else:
            for comment in comments:
                comment["liked_by_user"] = False
        
        return {"comments": comments}
    except Exception as e:
        logging.error(f"Error fetching comments: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/community/posts/{post_id}/share")
async def share_post(post_id: str, share_data: dict, athlete_id: str = Query(...)):
    """Share a post with optional commentary - Twitter-style quoted repost"""
    try:
        # Check if post exists
        original_post = await db.community_posts.find_one({"id": post_id})
        if not original_post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Get sharing athlete info
        sharing_athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not sharing_athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        # Get user's commentary (optional)
        user_commentary = share_data.get("content", "").strip()
        
        # Create share record
        share = {
            "id": str(uuid.uuid4()),
            "post_id": post_id,
            "athlete_id": athlete_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.community_shares.insert_one(prepare_for_mongo(share.copy()))
        
        # Increment share count on original post
        await db.community_posts.update_one(
            {"id": post_id},
            {"$inc": {"shares_count": 1}}
        )
        
        # Get original post author's subscription tier and nationality
        original_author = await db.athlete_profiles.find_one(
            {"id": original_post["athlete_id"]},
            {"_id": 0, "subscription_tier": 1, "nationality": 1}
        )
        
        # Prepare embedded original post data (for display in shared post)
        original_post_data = {
            "id": original_post["id"],
            "athlete_id": original_post["athlete_id"],
            "athlete_name": original_post.get("athlete_name", "Unknown"),
            "athlete_profile_picture": original_post.get("athlete_profile_picture"),
            "subscription_tier": original_author.get("subscription_tier") if original_author else None,
            "nationality": original_author.get("nationality") if original_author else None,
            "content": original_post.get("content", ""),
            "media": original_post.get("media", []),
            "image_urls": original_post.get("image_urls", []),
            "likes_count": original_post.get("likes_count", 0),
            "comments_count": original_post.get("comments_count", 0),
            "shares_count": original_post.get("shares_count", 0),
            "created_at": original_post.get("created_at")
        }
        
        # Create a new shared post in the user's feed with commentary
        shared_post = {
            "id": str(uuid.uuid4()),
            "athlete_id": athlete_id,
            "athlete_name": sharing_athlete.get("name", "Unknown"),
            "athlete_profile_picture": sharing_athlete.get("profile_picture"),
            "content": user_commentary if user_commentary else "",  # User's commentary
            "media": [],  # Shared posts don't have their own media
            "image_urls": [],
            "visibility": "public",
            "likes_count": 0,
            "comments_count": 0,
            "shares_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": None,
            "is_edited": False,
            "shared_post_id": post_id,  # Reference to original post
            "shared_post_data": original_post_data  # Embedded original post for display
        }
        
        await db.community_posts.insert_one(prepare_for_mongo(shared_post.copy()))
        
        # Create notification for original post owner (if not sharing own post)
        if original_post["athlete_id"] != athlete_id:
            notification_content = f"{sharing_athlete.get('name', 'Someone')} shared your post"
            if user_commentary:
                notification_content = f"{sharing_athlete.get('name', 'Someone')} shared your post with a comment"
            
            notification = {
                "id": str(uuid.uuid4()),
                "athlete_id": original_post["athlete_id"],
                "type": "share",
                "content": notification_content,
                "post_id": post_id,
                "from_athlete_id": athlete_id,
                "from_athlete_name": sharing_athlete.get("name", "Unknown"),
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.community_notifications.insert_one(prepare_for_mongo(notification.copy()))
        
        # Get updated share count
        updated_post = await db.community_posts.find_one({"id": post_id}, {"_id": 0})
        
        # Return the new shared post with embedded original post data
        return {
            "success": True,
            "shares_count": updated_post["shares_count"],
            "shared_post": parse_from_mongo(shared_post)
        }
    except Exception as e:
        logging.error(f"Error sharing post: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Event Comments Endpoints
@api_router.post("/community/events/{event_id}/comment")
async def add_event_comment(event_id: str, comment: dict, athlete_id: str = Query(...)):
    """Add a comment to an event"""
    try:
        # Get athlete info
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        # Create comment
        new_comment = {
            "id": str(uuid.uuid4()),
            "event_id": event_id,
            "athlete_id": athlete_id,
            "athlete_name": athlete.get("name", "Unknown"),
            "athlete_profile_picture": athlete.get("profile_picture"),
            "content": comment.get("content", ""),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.community_event_comments.insert_one(prepare_for_mongo(new_comment.copy()))
        
        # Increment comment count
        await db.community_events.update_one(
            {"id": event_id},
            {"$inc": {"comments_count": 1}}
        )
        
        # Get updated count
        event = await db.community_events.find_one({"id": event_id}, {"_id": 0, "comments_count": 1, "creator_id": 1})
        
        # Send notification to event creator (if not commenting on own event)
        if event and event.get("creator_id") and event["creator_id"] != athlete_id:
            notification = {
                "id": str(uuid.uuid4()),
                "athlete_id": event["creator_id"],
                "type": "event_comment",
                "content": f"{athlete.get('name', 'Someone')} commented on your event",
                "event_id": event_id,
                "from_athlete_id": athlete_id,
                "from_athlete_name": athlete.get("name", "Unknown"),
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.community_notifications.insert_one(prepare_for_mongo(notification.copy()))
        
        # Handle @mentions in comment
        content = comment.get("content", "")
        mention_pattern = r'@\[\[([^\]]+)::([^\]]+)\]\]'
        mentions = re.findall(mention_pattern, content)
        
        for mentioned_id, mentioned_name in mentions:
            if mentioned_id != athlete_id:  # Don't notify yourself
                notification = {
                    "id": str(uuid.uuid4()),
                    "athlete_id": mentioned_id,
                    "type": "mention",
                    "content": f"{athlete.get('name', 'Someone')} mentioned you in an event comment",
                    "event_id": event_id,
                    "comment_id": new_comment["id"],
                    "from_athlete_id": athlete_id,
                    "from_athlete_name": athlete.get("name", "Unknown"),
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.community_notifications.insert_one(prepare_for_mongo(notification.copy()))
        
        return {
            "comment": new_comment,
            "comments_count": event.get("comments_count", 1)
        }
    except Exception as e:
        logging.error(f"Error adding event comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/events/{event_id}/comments")
async def get_event_comments(event_id: str):
    """Get all comments for an event with subscription tier"""
    try:
        # Use aggregation to include subscription tier from athlete_profiles
        pipeline = [
            {"$match": {"event_id": event_id}},
            {"$sort": {"created_at": 1}},
            {
                "$lookup": {
                    "from": "athlete_profiles",
                    "localField": "athlete_id",
                    "foreignField": "id",
                    "as": "athlete_info"
                }
            },
            {
                "$addFields": {
                    "subscription_tier": {"$arrayElemAt": ["$athlete_info.subscription_tier", 0]},
                    "nationality": {"$arrayElemAt": ["$athlete_info.nationality", 0]}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "athlete_info": 0
                }
            }
        ]
        
        comments = await db.community_event_comments.aggregate(pipeline).to_list(length=None)
        
        return {"comments": comments}
    except Exception as e:
        logging.error(f"Error fetching event comments: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@api_router.delete("/community/posts/{post_id}/comment/{comment_id}")
async def delete_post_comment(post_id: str, comment_id: str, athlete_id: str = Query(...)):
    """Delete a comment from a post (by comment author or super-admin)"""
    try:
        # Check if comment exists
        comment = await db.community_comments.find_one({"id": comment_id, "post_id": post_id}, {"_id": 0})
        if not comment:
            raise HTTPException(status_code=404, detail="Comment not found")
        
        # Check if user is super-admin
        athlete = await db.athlete_profiles.find_one({"id": athlete_id})
        is_super_admin = athlete.get("is_super_admin", False) if athlete else False
        
        if comment.get("athlete_id") != athlete_id and not is_super_admin:
            raise HTTPException(status_code=403, detail="You can only delete your own comments")
        
        # Delete the comment
        await db.community_comments.delete_one({"id": comment_id})
        
        # Decrement comment count
        await db.community_posts.update_one(
            {"id": post_id},
            {"$inc": {"comments_count": -1}}
        )
        
        # Get updated count
        post = await db.community_posts.find_one({"id": post_id}, {"_id": 0, "comments_count": 1})
        
        return {
            "message": "Comment deleted successfully",
            "comments_count": post.get("comments_count", 0) if post else 0
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting post comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/community/events/{event_id}/comment/{comment_id}")
async def delete_event_comment(event_id: str, comment_id: str, athlete_id: str = Query(...)):
    """Delete a comment from an event (by comment author or super-admin)"""
    try:
        # Check if comment exists
        comment = await db.community_event_comments.find_one({"id": comment_id, "event_id": event_id}, {"_id": 0})
        if not comment:
            raise HTTPException(status_code=404, detail="Comment not found")
        
        # Check if user is super-admin
        athlete = await db.athlete_profiles.find_one({"id": athlete_id})
        is_super_admin = athlete.get("is_super_admin", False) if athlete else False
        
        if comment.get("athlete_id") != athlete_id and not is_super_admin:
            raise HTTPException(status_code=403, detail="You can only delete your own comments")
        
        # Delete the comment
        await db.community_event_comments.delete_one({"id": comment_id})
        
        # Decrement comment count
        await db.community_events.update_one(
            {"id": event_id},
            {"$inc": {"comments_count": -1}}
        )
        
        # Get updated count
        event = await db.community_events.find_one({"id": event_id}, {"_id": 0, "comments_count": 1})
        
        return {
            "message": "Comment deleted successfully",
            "comments_count": event.get("comments_count", 0) if event else 0
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting event comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# CHALLENGES ENDPOINTS
# ============================================================================

@api_router.post("/community/challenges")
async def create_challenge(challenge: dict, athlete_id: str = Query(...)):
    """Create a new challenge"""
    try:
        print(f"🔍 DEBUG: create_challenge called with athlete_id: {athlete_id}", flush=True)
        print(f"🔍 DEBUG: challenge data received: {challenge}", flush=True)
        
        # Get creator info - try multiple field names (id, athlete_id, _id string)
        athlete = await db.athletes.find_one(
            {"$or": [{"id": athlete_id}, {"athlete_id": athlete_id}, {"_id": athlete_id}]},
            {"_id": 0, "name": 1, "profile_picture": 1}
        )
        print(f"🔍 DEBUG: athlete from athletes collection (by id/athlete_id/_id): {athlete}", flush=True)
        
        if not athlete:
            print(f"🔍 DEBUG: Athlete not found by id, trying users collection", flush=True)
            # Fallback to user collection
            user = await db.users.find_one(
                {"$or": [{"id": athlete_id}, {"user_id": athlete_id}, {"_id": athlete_id}]},
                {"_id": 0, "name": 1, "email": 1}
            )
            print(f"🔍 DEBUG: user from users collection: {user}", flush=True)
            if user:
                athlete = {"name": user.get("name", "Unknown User"), "profile_picture": None}
                print(f"🔍 DEBUG: Using user data as athlete: {athlete}", flush=True)
            else:
                # Last resort: use athleteId as the user identifier
                print(f"⚠️ DEBUG: No user found, creating with default values", flush=True)
                athlete = {"name": "User", "profile_picture": None}
        
        # Create challenge object
        print(f"🔍 DEBUG: Creating challenge object with data:", flush=True)
        print(f"  - title: {challenge.get('title')}", flush=True)
        print(f"  - challenge_type: {challenge.get('challenge_type')}", flush=True)
        print(f"  - goal_value: {challenge.get('goal_value')}", flush=True)
        print(f"  - start_date: {challenge.get('start_date')}", flush=True)
        print(f"  - end_date: {challenge.get('end_date')}", flush=True)
        
        challenge_obj = Challenge(
            id=str(uuid.uuid4()),
            title=challenge.get("title"),
            description=challenge.get("description"),
            challenge_type=challenge.get("challenge_type"),  # distance, activity_count, duration
            goal_value=float(challenge.get("goal_value")),
            goal_unit=challenge.get("goal_unit"),  # km, activities, minutes
            start_date=challenge.get("start_date"),
            end_date=challenge.get("end_date"),
            visibility=challenge.get("visibility", "public"),
            competition_type=challenge.get("competition_type", "individual"),
            cover_photo=challenge.get("cover_photo"),
            trophy_image=challenge.get("trophy_image"),
            creator_id=athlete_id,
            creator_name=athlete.get("name", "Unknown User"),
            creator_profile_picture=athlete.get("profile_picture"),
            participants_count=0,
            is_recurring=challenge.get("is_recurring", False),
            recurrence_frequency=challenge.get("recurrence_frequency"),
            recurrence_count=challenge.get("recurrence_count"),
            group_id=challenge.get("group_id"),
            created_at=datetime.now(timezone.utc)
        )
        
        print(f"✅ DEBUG: Challenge object created successfully", flush=True)
        
        # Convert to dict and prepare for MongoDB
        challenge_dict = challenge_obj.model_dump()
        challenge_dict["created_at"] = challenge_dict["created_at"].isoformat()
        
        print(f"🔍 DEBUG: Inserting challenge into database", flush=True)
        # Insert into database
        await db.community_challenges.insert_one(challenge_dict)
        
        print(f"✅ DEBUG: Challenge inserted successfully with id: {challenge_obj.id}", flush=True)
        return challenge_obj
    except HTTPException as he:
        print(f"❌ DEBUG: HTTPException in create_challenge: {he.detail}", flush=True)
        raise
    except Exception as e:
        print(f"❌ DEBUG: Exception in create_challenge: {str(e)}", flush=True)
        print(f"❌ DEBUG: Exception type: {type(e).__name__}", flush=True)
        import traceback
        print(f"❌ DEBUG: Traceback: {traceback.format_exc()}", flush=True)
        logging.error(f"Error creating challenge: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/challenges")
async def get_challenges(
    athlete_id: str = Query(...),
    filter_type: str = Query("all"),  # all, active, completed, joined
    limit: int = Query(20),
    skip: int = Query(0)
):
    """Get challenges with optional filtering"""
    try:
        from datetime import datetime
        
        query = {}
        current_date = datetime.now(timezone.utc).isoformat()
        
        # Apply filters
        if filter_type == "active":
            query["end_date"] = {"$gte": current_date}
        elif filter_type == "completed":
            query["end_date"] = {"$lt": current_date}
        elif filter_type == "joined":
            # Get challenges where user is a participant
            participations = await db.community_challenge_participants.find(
                {"athlete_id": athlete_id},
                {"_id": 0, "challenge_id": 1}
            ).to_list(length=None)
            challenge_ids = [p["challenge_id"] for p in participations]
            query["id"] = {"$in": challenge_ids}
        
        # Fetch challenges
        challenges = await db.community_challenges.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=None)
        
        # For each challenge, check if user has joined and get their progress
        for challenge in challenges:
            participation = await db.community_challenge_participants.find_one(
                {"challenge_id": challenge["id"], "athlete_id": athlete_id},
                {"_id": 0}
            )
            challenge["has_joined"] = participation is not None
            challenge["user_progress"] = participation.get("current_progress", 0) if participation else 0
            challenge["user_percentage"] = participation.get("percentage_complete", 0) if participation else 0
            
            print(f"🔍 DEBUG: Challenge '{challenge.get('title')}' - has_joined: {challenge['has_joined']}, creator_id: {challenge.get('creator_id')}, athlete_id: {athlete_id}", flush=True)
        
        print(f"✅ DEBUG: Returning {len(challenges)} challenges", flush=True)
        return {"challenges": challenges}
    except Exception as e:
        logging.error(f"Error fetching challenges: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/challenges/{challenge_id}")
async def get_challenge_details(challenge_id: str, athlete_id: str = Query(...)):
    """Get detailed challenge information including leaderboard"""
    try:
        # Get challenge
        challenge = await db.community_challenges.find_one({"id": challenge_id}, {"_id": 0})
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        
        # Check if user has joined
        participation = await db.community_challenge_participants.find_one(
            {"challenge_id": challenge_id, "athlete_id": athlete_id},
            {"_id": 0}
        )
        challenge["has_joined"] = participation is not None
        challenge["user_progress"] = participation.get("current_progress", 0) if participation else 0
        challenge["user_percentage"] = participation.get("percentage_complete", 0) if participation else 0
        
        # Get leaderboard (top participants sorted by progress) with subscription tier
        leaderboard_pipeline = [
            {"$match": {"challenge_id": challenge_id}},
            {"$sort": {"current_progress": -1}},
            {"$limit": 10},
            {
                "$lookup": {
                    "from": "athlete_profiles",
                    "localField": "athlete_id",
                    "foreignField": "id",
                    "as": "athlete_info"
                }
            },
            {
                "$addFields": {
                    "subscription_tier": {"$arrayElemAt": ["$athlete_info.subscription_tier", 0]},
                    "nationality": {"$arrayElemAt": ["$athlete_info.nationality", 0]}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "athlete_info": 0
                }
            }
        ]
        
        leaderboard = await db.community_challenge_participants.aggregate(leaderboard_pipeline).to_list(length=None)
        
        # Update ranks
        for idx, participant in enumerate(leaderboard, 1):
            participant["rank"] = idx
        
        challenge["leaderboard"] = leaderboard
        
        return challenge
    except Exception as e:
        logging.error(f"Error fetching challenge details: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/community/challenges/{challenge_id}")
async def edit_challenge(challenge_id: str, updates: dict, athlete_id: str = Query(...)):
    """Edit a challenge (creator only)"""
    try:
        # Check if challenge exists and user is creator
        challenge = await db.community_challenges.find_one({"id": challenge_id}, {"_id": 0})
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        
        if challenge.get("creator_id") != athlete_id:
            raise HTTPException(status_code=403, detail="Only the creator can edit this challenge")
        
        # Update challenge
        update_fields = {}
        allowed_fields = ["title", "description", "cover_photo", "trophy_image", "end_date", "visibility", "goal_value"]
        for field in allowed_fields:
            if field in updates:
                update_fields[field] = updates[field]
        
        if update_fields:
            update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.community_challenges.update_one(
                {"id": challenge_id},
                {"$set": update_fields}
            )
        
        return {"message": "Challenge updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error editing challenge: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/community/challenges/{challenge_id}")
async def delete_challenge(challenge_id: str, athlete_id: str = Query(...)):
    """Delete a challenge (creator or super-admin)"""
    try:
        # Check if challenge exists
        challenge = await db.community_challenges.find_one({"id": challenge_id}, {"_id": 0})
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        
        # Check if user is super-admin
        athlete = await db.athlete_profiles.find_one({"id": athlete_id})
        is_super_admin = athlete.get("is_super_admin", False) if athlete else False
        
        if challenge.get("creator_id") != athlete_id and not is_super_admin:
            raise HTTPException(status_code=403, detail="Only the creator can delete this challenge")
        
        # Delete challenge and all related data
        await db.community_challenges.delete_one({"id": challenge_id})
        await db.community_challenge_participants.delete_many({"challenge_id": challenge_id})
        await db.community_challenge_comments.delete_many({"challenge_id": challenge_id})
        
        return {"message": "Challenge deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting challenge: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/community/challenges/{challenge_id}/join")
async def join_challenge(challenge_id: str, athlete_id: str = Query(...)):
    """Join a challenge"""
    try:
        print(f"🔍 DEBUG: join_challenge called - challenge_id: {challenge_id}, athlete_id: {athlete_id}", flush=True)
        
        # Check if challenge exists
        challenge = await db.community_challenges.find_one({"id": challenge_id}, {"_id": 0})
        if not challenge:
            print(f"❌ DEBUG: Challenge not found: {challenge_id}", flush=True)
            raise HTTPException(status_code=404, detail="Challenge not found")
        
        print(f"✅ DEBUG: Challenge found: {challenge.get('title')}", flush=True)
        
        # Check if already joined
        existing = await db.community_challenge_participants.find_one(
            {"challenge_id": challenge_id, "athlete_id": athlete_id}
        )
        if existing:
            print(f"❌ DEBUG: Already joined this challenge", flush=True)
            raise HTTPException(status_code=400, detail="Already joined this challenge")
        
        print(f"✅ DEBUG: Not yet joined, proceeding with join", flush=True)
        
        # Get athlete info - try multiple field names
        athlete = await db.athletes.find_one(
            {"$or": [{"id": athlete_id}, {"athlete_id": athlete_id}, {"_id": athlete_id}]},
            {"_id": 0, "name": 1, "profile_picture": 1}
        )
        if not athlete:
            # Fallback to user collection
            user = await db.users.find_one(
                {"$or": [{"id": athlete_id}, {"user_id": athlete_id}, {"_id": athlete_id}]},
                {"_id": 0, "name": 1, "email": 1}
            )
            if user:
                athlete = {"name": user.get("name", "Unknown User"), "profile_picture": None}
            else:
                # Use default values
                athlete = {"name": "User", "profile_picture": None}
        
        # Create participation
        participation = ChallengeParticipation(
            id=str(uuid.uuid4()),
            challenge_id=challenge_id,
            athlete_id=athlete_id,
            athlete_name=athlete.get("name", "Unknown User"),
            athlete_profile_picture=athlete.get("profile_picture"),
            current_progress=0.0,
            percentage_complete=0.0,
            joined_at=datetime.now(timezone.utc)
        )
        
        participation_dict = participation.model_dump()
        participation_dict["joined_at"] = participation_dict["joined_at"].isoformat()
        participation_dict["last_updated"] = participation_dict["last_updated"].isoformat()
        
        await db.community_challenge_participants.insert_one(participation_dict)
        print(f"✅ DEBUG: Participation record created", flush=True)
        
        # Increment participants count
        await db.community_challenges.update_one(
            {"id": challenge_id},
            {"$inc": {"participants_count": 1}}
        )
        print(f"✅ DEBUG: Participants count incremented", flush=True)
        
        print(f"✅ DEBUG: Successfully joined challenge!", flush=True)
        return {"message": "Joined challenge successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error joining challenge: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/community/challenges/{challenge_id}/leave")
async def leave_challenge(challenge_id: str, athlete_id: str = Query(...)):
    """Leave a challenge"""
    try:
        print(f"🔍 DEBUG: leave_challenge called - challenge_id: {challenge_id}, athlete_id: {athlete_id}", flush=True)
        
        # Check if participant exists
        participation = await db.community_challenge_participants.find_one(
            {"challenge_id": challenge_id, "athlete_id": athlete_id}
        )
        if not participation:
            print(f"❌ DEBUG: Not participating in this challenge", flush=True)
            raise HTTPException(status_code=404, detail="Not participating in this challenge")
        
        print(f"✅ DEBUG: Participation found, proceeding with leave", flush=True)
        
        # Delete participation
        await db.community_challenge_participants.delete_one(
            {"challenge_id": challenge_id, "athlete_id": athlete_id}
        )
        print(f"✅ DEBUG: Participation record deleted", flush=True)
        
        # Decrement participants count
        await db.community_challenges.update_one(
            {"id": challenge_id},
            {"$inc": {"participants_count": -1}}
        )
        print(f"✅ DEBUG: Participants count decremented", flush=True)
        
        print(f"✅ DEBUG: Successfully left challenge!", flush=True)
        return {"message": "Left challenge successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error leaving challenge: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/community/challenges/{challenge_id}/update-progress")
async def update_challenge_progress(challenge_id: str, athlete_id: str = Query(...)):
    """Update progress for a challenge participant (called when workout is logged)"""
    try:
        # Get challenge
        challenge = await db.community_challenges.find_one({"id": challenge_id}, {"_id": 0})
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        
        # Check if user is participating
        participation = await db.community_challenge_participants.find_one(
            {"challenge_id": challenge_id, "athlete_id": athlete_id},
            {"_id": 0}
        )
        if not participation:
            raise HTTPException(status_code=404, detail="Not participating in this challenge")
        
        # Calculate progress based on challenge type and workout logs within challenge dates
        start_date = challenge.get("start_date")
        end_date = challenge.get("end_date")
        challenge_type = challenge.get("challenge_type")
        
        progress = 0.0
        
        if challenge_type == "distance":
            # Sum up distance from workouts
            workouts = await db.workouts.find(
                {
                    "athlete_id": athlete_id,
                    "date": {"$gte": start_date, "$lte": end_date}
                },
                {"_id": 0, "distance": 1}
            ).to_list(length=None)
            progress = sum(float(w.get("distance", 0)) for w in workouts)
        
        elif challenge_type == "activity_count":
            # Count workouts
            count = await db.workouts.count_documents({
                "athlete_id": athlete_id,
                "date": {"$gte": start_date, "$lte": end_date}
            })
            progress = float(count)
        
        elif challenge_type == "duration":
            # Sum up duration from workouts
            workouts = await db.workouts.find(
                {
                    "athlete_id": athlete_id,
                    "date": {"$gte": start_date, "$lte": end_date}
                },
                {"_id": 0, "duration": 1}
            ).to_list(length=None)
            # Convert duration to minutes
            total_minutes = 0.0
            for w in workouts:
                duration_str = w.get("duration", "0:00")
                if ":" in duration_str:
                    parts = duration_str.split(":")
                    hours = int(parts[0]) if len(parts) > 0 else 0
                    minutes = int(parts[1]) if len(parts) > 1 else 0
                    total_minutes += hours * 60 + minutes
            progress = total_minutes
        
        # Calculate percentage
        goal_value = float(challenge.get("goal_value", 1))
        percentage = min((progress / goal_value) * 100, 100) if goal_value > 0 else 0
        
        # Update participation
        await db.community_challenge_participants.update_one(
            {"challenge_id": challenge_id, "athlete_id": athlete_id},
            {
                "$set": {
                    "current_progress": progress,
                    "percentage_complete": percentage,
                    "last_updated": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Check if challenge is completed (100% or more) and award trophy
        trophy_awarded = False
        if percentage >= 100:
            # Check if trophy already awarded
            existing_achievement = await db.community_challenge_achievements.find_one({
                "challenge_id": challenge_id,
                "athlete_id": athlete_id
            })
            
            if not existing_achievement:
                # Award trophy
                achievement = ChallengeAchievement(
                    id=str(uuid.uuid4()),
                    challenge_id=challenge_id,
                    challenge_title=challenge.get("title"),
                    challenge_type=challenge.get("challenge_type"),
                    trophy_image=challenge.get("trophy_image"),
                    athlete_id=athlete_id,
                    athlete_name=participation.get("athlete_name", "User"),
                    completed_at=datetime.now(timezone.utc),
                    final_value=progress
                )
                
                achievement_dict = achievement.model_dump()
                achievement_dict["completed_at"] = achievement_dict["completed_at"].isoformat()
                
                await db.community_challenge_achievements.insert_one(achievement_dict)
                trophy_awarded = True
                logging.info(f"Trophy awarded to {athlete_id} for completing challenge {challenge_id}")
        
        return {
            "message": "Progress updated successfully",
            "current_progress": progress,
            "percentage_complete": percentage,
            "trophy_awarded": trophy_awarded
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating challenge progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/community/challenges/{challenge_id}/comments")
async def add_challenge_comment(challenge_id: str, comment: dict, athlete_id: str = Query(...)):
    """Add a comment to a challenge"""
    try:
        # Get athlete info - try multiple field names
        athlete = await db.athletes.find_one(
            {"$or": [{"id": athlete_id}, {"athlete_id": athlete_id}, {"_id": athlete_id}]},
            {"_id": 0, "name": 1, "profile_picture": 1}
        )
        if not athlete:
            # Fallback to user collection
            user = await db.users.find_one(
                {"$or": [{"id": athlete_id}, {"user_id": athlete_id}, {"_id": athlete_id}]},
                {"_id": 0, "name": 1, "email": 1}
            )
            if user:
                athlete = {"name": user.get("name", "Unknown User"), "profile_picture": None}
            else:
                # Use default values
                athlete = {"name": "User", "profile_picture": None}
        
        # Create comment
        comment_obj = ChallengeComment(
            id=str(uuid.uuid4()),
            challenge_id=challenge_id,
            athlete_id=athlete_id,
            athlete_name=athlete.get("name", "Unknown User"),
            athlete_profile_picture=athlete.get("profile_picture"),
            content=comment.get("content"),
            created_at=datetime.now(timezone.utc)
        )
        
        comment_dict = comment_obj.model_dump()
        comment_dict["created_at"] = comment_dict["created_at"].isoformat()
        
        await db.community_challenge_comments.insert_one(comment_dict)
        
        return comment_obj
    except Exception as e:
        logging.error(f"Error adding challenge comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/challenges/{challenge_id}/comments")
async def get_challenge_comments(challenge_id: str):
    """Get comments for a challenge with subscription tier"""
    try:
        # Use aggregation to include subscription tier from athlete_profiles
        pipeline = [
            {"$match": {"challenge_id": challenge_id}},
            {"$sort": {"created_at": 1}},
            {
                "$lookup": {
                    "from": "athlete_profiles",
                    "localField": "athlete_id",
                    "foreignField": "id",
                    "as": "athlete_info"
                }
            },
            {
                "$addFields": {
                    "subscription_tier": {"$arrayElemAt": ["$athlete_info.subscription_tier", 0]},
                    "nationality": {"$arrayElemAt": ["$athlete_info.nationality", 0]}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "athlete_info": 0
                }
            }
        ]
        
        comments = await db.community_challenge_comments.aggregate(pipeline).to_list(length=None)
        
        return {"comments": comments}
    except Exception as e:
        logging.error(f"Error fetching challenge comments: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/challenges/achievements/{athlete_id}")
async def get_athlete_achievements(athlete_id: str):
    """Get all earned trophies/achievements for an athlete"""
    try:
        achievements = await db.community_challenge_achievements.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).sort("completed_at", -1).to_list(length=None)
        
        return {"achievements": achievements}
    except Exception as e:
        logging.error(f"Error fetching achievements: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/notifications/{athlete_id}")
async def get_notifications(athlete_id: str, unread_only: bool = Query(False)):
    """Get notifications for an athlete"""
    try:
        query = {"athlete_id": athlete_id}
        if unread_only:
            query["read"] = False
        
        notifications = await db.community_notifications.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).limit(50).to_list(length=None)
        
        return {"notifications": notifications}
    except Exception as e:
        logging.error(f"Error fetching notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/community/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark a notification as read"""
    try:
        await db.community_notifications.update_one(
            {"id": notification_id},
            {"$set": {"read": True}}
        )
        return {"success": True}
    except Exception as e:
        logging.error(f"Error marking notification as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/community/notifications/{athlete_id}/unread-count")
async def get_unread_count(athlete_id: str):
    """Get count of unread notifications"""
    try:
        count = await db.community_notifications.count_documents({
            "athlete_id": athlete_id,
            "read": False
        })
        return {"unread_count": count}
    except Exception as e:
        logging.error(f"Error fetching unread count: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# FOLLOW/UNFOLLOW ENDPOINTS
# ==========================================

@api_router.post("/community/follow/{target_athlete_id}")
async def toggle_follow(target_athlete_id: str, athlete_id: str = Query(...)):
    """Follow or unfollow a user"""
    try:
        # Check if already following
        existing_follow = await db.community_follows.find_one({
            "follower_id": athlete_id,
            "following_id": target_athlete_id
        })
        
        if existing_follow:
            # Unfollow
            await db.community_follows.delete_one({"id": existing_follow["id"]})
            following = False
        else:
            # Follow
            follow = {
                "id": str(uuid.uuid4()),
                "follower_id": athlete_id,
                "following_id": target_athlete_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.community_follows.insert_one(prepare_for_mongo(follow.copy()))
            following = True
            
            # Create notification
            if target_athlete_id != athlete_id:
                athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
                notification = {
                    "id": str(uuid.uuid4()),
                    "athlete_id": target_athlete_id,
                    "type": "follow",
                    "content": f"{athlete.get('name', 'Someone')} started following you",
                    "from_athlete_id": athlete_id,
                    "from_athlete_name": athlete.get("name", "Unknown"),
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.community_notifications.insert_one(prepare_for_mongo(notification.copy()))
        
        # Get updated counts
        followers_count = await db.community_follows.count_documents({"following_id": target_athlete_id})
        following_count = await db.community_follows.count_documents({"follower_id": target_athlete_id})
        
        return {
            "success": True,
            "following": following,
            "followers_count": followers_count,
            "following_count": following_count
        }
    except Exception as e:
        logging.error(f"Error toggling follow: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/profile/{target_athlete_id}")
async def get_athlete_profile(target_athlete_id: str, viewer_athlete_id: str = Query(...)):
    """Get athlete profile with stats"""
    try:
        # Get athlete info
        athlete = await db.athlete_profiles.find_one({"id": target_athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        # Get stats
        posts_count = await db.community_posts.count_documents({"athlete_id": target_athlete_id})
        
        # Count likes received on all posts
        posts = await db.community_posts.find({"athlete_id": target_athlete_id}, {"_id": 0, "likes_count": 1}).to_list(length=None)
        likes_received = sum(post.get("likes_count", 0) for post in posts)
        
        # Get followers/following counts
        followers_count = await db.community_follows.count_documents({"following_id": target_athlete_id})
        following_count = await db.community_follows.count_documents({"follower_id": target_athlete_id})
        
        # Check if viewer is following this athlete
        is_following = await db.community_follows.find_one({
            "follower_id": viewer_athlete_id,
            "following_id": target_athlete_id
        }) is not None
        
        return {
            "id": athlete["id"],
            "name": athlete.get("name", "Unknown"),
            "profile_picture": athlete.get("profile_picture"),
            "nationality": athlete.get("nationality"),
            "subscription_tier": athlete.get("subscription_tier"),
            "bio": athlete.get("bio", ""),
            "date_of_birth": athlete.get("date_of_birth"),
            "interests": athlete.get("interests", []),
            "running_goals": athlete.get("running_goals", ""),
            "share_bio": athlete.get("share_bio", True),
            "share_goals": athlete.get("share_goals", True),
            "share_interests": athlete.get("share_interests", True),
            "posts_count": posts_count,
            "likes_received": likes_received,
            "followers_count": followers_count,
            "following_count": following_count,
            "is_following": is_following,
            "is_own_profile": target_athlete_id == viewer_athlete_id
        }
    except Exception as e:
        logging.error(f"Error fetching athlete profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/followers/{athlete_id}")
async def get_followers(athlete_id: str):
    """Get list of followers"""
    try:
        follows = await db.community_follows.find(
            {"following_id": athlete_id},
            {"_id": 0}
        ).to_list(length=None)
        
        # Get athlete info for each follower
        follower_ids = [f["follower_id"] for f in follows]
        followers = []
        for follower_id in follower_ids:
            athlete = await db.athlete_profiles.find_one({"id": follower_id}, {"_id": 0})
            if athlete:
                followers.append({
                    "id": athlete["id"],
                    "name": athlete.get("name", "Unknown"),
                    "profile_picture": athlete.get("profile_picture")
                })
        
        return {"followers": followers}
    except Exception as e:
        logging.error(f"Error fetching followers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/following/{athlete_id}")
async def get_following(athlete_id: str):
    """Get list of users being followed"""
    try:
        follows = await db.community_follows.find(
            {"follower_id": athlete_id},
            {"_id": 0}
        ).to_list(length=None)
        
        # Get athlete info for each following
        following_ids = [f["following_id"] for f in follows]
        following = []
        for following_id in following_ids:
            athlete = await db.athlete_profiles.find_one({"id": following_id}, {"_id": 0})
            if athlete:
                following.append({
                    "id": athlete["id"],
                    "name": athlete.get("name", "Unknown"),
                    "profile_picture": athlete.get("profile_picture")
                })
        
        return {"following": following}
    except Exception as e:
        logging.error(f"Error fetching following: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/community/athletes")
async def get_all_athletes(viewer_athlete_id: str = Query(...), search: str = Query(None), limit: int = Query(50)):
    """Get all athletes with optional search"""
    try:
        # Build query
        query = {}
        if search:
            # Search by name (case-insensitive)
            query["name"] = {"$regex": search, "$options": "i"}
        
        # Get athletes
        athletes = await db.athlete_profiles.find(
            query,
            {"_id": 0, "id": 1, "name": 1, "profile_picture": 1, "bio": 1, "nationality": 1, "subscription_tier": 1}
        ).limit(limit).to_list(length=None)
        
        # For each athlete, check if viewer is following them and get their stats
        result = []
        for athlete in athletes:
            if athlete["id"] == viewer_athlete_id:
                continue  # Skip self
            
            # Check if following
            is_following = await db.community_follows.find_one({
                "follower_id": viewer_athlete_id,
                "following_id": athlete["id"]
            }) is not None
            
            # Get stats
            posts_count = await db.community_posts.count_documents({"athlete_id": athlete["id"]})
            followers_count = await db.community_follows.count_documents({"following_id": athlete["id"]})
            
            result.append({
                "id": athlete["id"],
                "name": athlete.get("name", "Unknown"),
                "profile_picture": athlete.get("profile_picture"),
                "nationality": athlete.get("nationality"),
                "subscription_tier": athlete.get("subscription_tier"),
                "bio": athlete.get("bio", ""),
                "posts_count": posts_count,
                "followers_count": followers_count,
                "is_following": is_following
            })
        
        return {"athletes": result}
    except Exception as e:
        logging.error(f"Error fetching athletes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# GROUPS ENDPOINTS
# ==========================================

@api_router.post("/community/groups")
async def create_group(group_data: dict, athlete_id: str = Query(...)):
    """Create a new group"""
    try:
        # Create group
        group = {
            "id": str(uuid.uuid4()),
            "name": group_data.get("name", ""),
            "description": group_data.get("description", ""),
            "privacy": group_data.get("privacy", "public"),
            "profile_image": group_data.get("profile_image"),
            "cover_photo": group_data.get("cover_photo"),
            "rules": group_data.get("rules"),
            "admin_id": athlete_id,
            "members_count": 1,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": None
        }
        
        await db.community_groups.insert_one(prepare_for_mongo(group.copy()))
        
        # Add admin as member
        membership = {
            "id": str(uuid.uuid4()),
            "group_id": group["id"],
            "athlete_id": athlete_id,
            "role": "admin",
            "status": "approved",
            "rules_accepted": True,  # Admin auto-accepts rules
            "joined_at": datetime.now(timezone.utc).isoformat()
        }
        await db.community_group_memberships.insert_one(prepare_for_mongo(membership.copy()))
        
        return {"success": True, "group": group}
    except Exception as e:
        logging.error(f"Error creating group: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/groups")
async def get_all_groups(athlete_id: str = Query(...), limit: int = Query(50), skip: int = Query(0), exclude_images: bool = Query(False)):
    """Get all groups - Optimized with pagination and optional image exclusion"""
    try:
        # Build projection
        projection_stage = {
            "$project": {
                "_id": 0,
                "membership": 0
            }
        }
        
        if exclude_images:
            projection_stage["$project"]["profile_image"] = 0
            projection_stage["$project"]["cover_photo"] = 0
        
        # Use aggregation pipeline to fetch groups with membership status in single query
        pipeline = [
            {"$sort": {"created_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {
                "$lookup": {
                    "from": "community_group_memberships",
                    "let": {"group_id": "$id"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$and": [
                                        {"$eq": ["$group_id", "$$group_id"]},
                                        {"$eq": ["$athlete_id", athlete_id]},
                                        {"$eq": ["$status", "approved"]}
                                    ]
                                }
                            }
                        }
                    ],
                    "as": "membership"
                }
            },
            {
                "$addFields": {
                    "is_member": {"$gt": [{"$size": "$membership"}, 0]},
                    "member_role": {
                        "$cond": {
                            "if": {"$gt": [{"$size": "$membership"}, 0]},
                            "then": {"$arrayElemAt": ["$membership.role", 0]},
                            "else": None
                        }
                    }
                }
            },
            projection_stage
        ]
        
        groups = await db.community_groups.aggregate(pipeline).to_list(length=None)
        
        return {"groups": groups}
    except Exception as e:
        logging.error(f"Error fetching groups: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/groups/my/{athlete_id}")
async def get_my_groups(athlete_id: str, limit: int = Query(50), skip: int = Query(0), exclude_images: bool = Query(False)):
    """Get groups where user is a member - Optimized with optional image exclusion"""
    try:
        # Build projection
        projection_stage = {"$project": {"_id": 0}}
        
        if exclude_images:
            projection_stage["$project"]["profile_image"] = 0
            projection_stage["$project"]["cover_photo"] = 0
        
        # Use aggregation pipeline to join memberships with groups in single query
        pipeline = [
            {
                "$match": {
                    "athlete_id": athlete_id,
                    "status": "approved"
                }
            },
            {"$skip": skip},
            {"$limit": limit},
            {
                "$lookup": {
                    "from": "community_groups",
                    "localField": "group_id",
                    "foreignField": "id",
                    "as": "group_data"
                }
            },
            {
                "$unwind": "$group_data"
            },
            {
                "$replaceRoot": {
                    "newRoot": {
                        "$mergeObjects": [
                            "$group_data",
                            {"member_role": "$role"}
                        ]
                    }
                }
            },
            projection_stage
        ]
        
        groups = await db.community_group_memberships.aggregate(pipeline).to_list(length=None)
        
        return {"groups": groups}
    except Exception as e:
        logging.error(f"Error fetching my groups: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/groups/{group_id}")
async def get_group_details(group_id: str, athlete_id: str = Query(...)):
    """Get group details"""
    try:
        group = await db.community_groups.find_one({"id": group_id}, {"_id": 0})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        # Check membership
        membership = await db.community_group_memberships.find_one({
            "group_id": group_id,
            "athlete_id": athlete_id
        })
        
        group["is_member"] = membership is not None and membership.get("status") == "approved"
        group["member_role"] = membership.get("role") if membership else None
        group["membership_status"] = membership.get("status") if membership else None
        
        # Get members list
        memberships = await db.community_group_memberships.find({
            "group_id": group_id,
            "status": "approved"
        }, {"_id": 0}).to_list(length=None)
        
        members = []
        for m in memberships:
            athlete = await db.athlete_profiles.find_one({"id": m["athlete_id"]}, {"_id": 0})
            if athlete:
                members.append({
                    "id": athlete["id"],
                    "name": athlete.get("name", "Unknown"),
                    "profile_picture": athlete.get("profile_picture"),
                    "subscription_tier": athlete.get("subscription_tier"),
                    "nationality": athlete.get("nationality"),
                    "role": m.get("role")
                })
        
        group["members"] = members
        
        # Get pending members if user is admin/manager/moderator
        if membership and membership.get("role") in ["admin", "manager", "moderator"]:
            pending_memberships = await db.community_group_memberships.find({
                "group_id": group_id,
                "status": "pending"
            }, {"_id": 0}).to_list(length=None)
            
            pending_members = []
            for m in pending_memberships:
                athlete = await db.athlete_profiles.find_one({"id": m["athlete_id"]}, {"_id": 0})
                if athlete:
                    pending_members.append({
                        "id": athlete["id"],
                        "membership_id": m["id"],
                        "name": athlete.get("name", "Unknown"),
                        "profile_picture": athlete.get("profile_picture"),
                        "subscription_tier": athlete.get("subscription_tier"),
                        "nationality": athlete.get("nationality"),
                        "requested_at": m.get("joined_at")
                    })
            
            group["pending_members"] = pending_members
        else:
            group["pending_members"] = []
        
        return group
    except Exception as e:
        logging.error(f"Error fetching group details: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/community/groups/{group_id}")
async def edit_group(group_id: str, group_data: dict, athlete_id: str = Query(...)):
    """Edit group (admin/manager only)"""
    try:
        # Verify admin/manager
        membership = await db.community_group_memberships.find_one({
            "group_id": group_id,
            "athlete_id": athlete_id,
            "role": {"$in": ["admin", "manager"]}
        })
        if not membership:
            raise HTTPException(status_code=403, detail="Only admins/managers can edit groups")
        
        # Update group
        update_data = {
            "name": group_data.get("name"),
            "description": group_data.get("description"),
            "privacy": group_data.get("privacy"),
            "profile_image": group_data.get("profile_image"),
            "cover_photo": group_data.get("cover_photo"),
            "rules": group_data.get("rules"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        await db.community_groups.update_one(
            {"id": group_id},
            {"$set": update_data}
        )
        
        updated_group = await db.community_groups.find_one({"id": group_id}, {"_id": 0})
        return {"success": True, "group": updated_group}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error editing group: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/community/groups/{group_id}")
async def delete_group(group_id: str, athlete_id: str = Query(...)):
    """Delete group (admin or super-admin)"""
    try:
        # Check if user is super-admin
        athlete = await db.athlete_profiles.find_one({"id": athlete_id})
        is_super_admin = athlete.get("is_super_admin", False) if athlete else False
        
        if not is_super_admin:
            # Verify admin if not super-admin
            membership = await db.community_group_memberships.find_one({
                "group_id": group_id,
                "athlete_id": athlete_id,
                "role": "admin"
            })
            if not membership:
                raise HTTPException(status_code=403, detail="Only admins can delete groups")
        
        # Delete group and related data
        await db.community_groups.delete_one({"id": group_id})
        await db.community_group_memberships.delete_many({"group_id": group_id})
        await db.community_group_posts.delete_many({"group_id": group_id})
        
        return {"success": True, "message": "Group deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting group: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/community/groups/{group_id}/join")
async def join_group(group_id: str, join_data: dict, athlete_id: str = Query(...)):
    """Join a group"""
    try:
        # Check if already a member
        existing_membership = await db.community_group_memberships.find_one({
            "group_id": group_id,
            "athlete_id": athlete_id
        })
        
        if existing_membership:
            return {"success": False, "message": "Already a member or request pending"}
        
        # Get group
        group = await db.community_groups.find_one({"id": group_id}, {"_id": 0})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        # Check if rules exist and were accepted
        if group.get("rules") and not join_data.get("rules_accepted"):
            raise HTTPException(status_code=400, detail="You must accept the group rules to join")
        
        # Create membership
        membership = {
            "id": str(uuid.uuid4()),
            "group_id": group_id,
            "athlete_id": athlete_id,
            "role": "member",
            "status": "approved" if group["privacy"] == "public" else "pending",
            "rules_accepted": join_data.get("rules_accepted", False),
            "joined_at": datetime.now(timezone.utc).isoformat()
        }
        await db.community_group_memberships.insert_one(prepare_for_mongo(membership.copy()))
        
        # Update member count if approved
        if membership["status"] == "approved":
            await db.community_groups.update_one(
                {"id": group_id},
                {"$inc": {"members_count": 1}}
            )
        else:
            # Send notification to group admin for pending request
            athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
            notification = {
                "id": str(uuid.uuid4()),
                "athlete_id": group["admin_id"],
                "type": "group_join_request",
                "content": f"{athlete.get('name', 'Someone')} wants to join your group '{group['name']}'",
                "from_athlete_id": athlete_id,
                "from_athlete_name": athlete.get("name", "Unknown"),
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "group_id": group_id
            }
            await db.community_notifications.insert_one(prepare_for_mongo(notification.copy()))
        
        return {
            "success": True,
            "status": membership["status"],
            "message": "Joined successfully" if membership["status"] == "approved" else "Request pending approval"
        }
    except Exception as e:
        logging.error(f"Error joining group: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/community/groups/{group_id}/leave")
async def leave_group(group_id: str, athlete_id: str = Query(...)):
    """Leave a group"""
    try:
        # Check if admin
        membership = await db.community_group_memberships.find_one({
            "group_id": group_id,
            "athlete_id": athlete_id
        })
        
        if not membership:
            return {"success": False, "message": "Not a member"}
        
        if membership["role"] == "admin":
            return {"success": False, "message": "Admin cannot leave group. Delete group instead."}
        
        # Remove membership
        await db.community_group_memberships.delete_one({"id": membership["id"]})
        
        # Update member count
        await db.community_groups.update_one(
            {"id": group_id},
            {"$inc": {"members_count": -1}}
        )
        
        return {"success": True, "message": "Left group successfully"}
    except Exception as e:
        logging.error(f"Error leaving group: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/community/groups/{group_id}/members/{target_athlete_id}")
async def manage_group_member(group_id: str, target_athlete_id: str, action_data: dict, athlete_id: str = Query(...)):
    """Approve/reject membership or change role (admin/manager only)"""
    try:
        # Verify admin/manager/moderator
        requester_membership = await db.community_group_memberships.find_one({
            "group_id": group_id,
            "athlete_id": athlete_id,
            "role": {"$in": ["admin", "manager", "moderator"]}
        })
        if not requester_membership:
            raise HTTPException(status_code=403, detail="Admin/manager/moderator access required")
        
        # Get target membership
        target_membership = await db.community_group_memberships.find_one({
            "group_id": group_id,
            "athlete_id": target_athlete_id
        })
        if not target_membership:
            raise HTTPException(status_code=404, detail="Membership not found")
        
        action = action_data.get("action")  # 'approve', 'reject', 'change_role'
        
        if action == "approve":
            await db.community_group_memberships.update_one(
                {"id": target_membership["id"]},
                {"$set": {"status": "approved"}}
            )
            await db.community_groups.update_one(
                {"id": group_id},
                {"$inc": {"members_count": 1}}
            )
            return {"success": True, "message": "Member approved"}
        
        elif action == "reject":
            await db.community_group_memberships.delete_one({"id": target_membership["id"]})
            return {"success": True, "message": "Member rejected"}
        
        elif action == "change_role":
            # Only admin/manager can change roles
            if requester_membership["role"] not in ["admin", "manager"]:
                raise HTTPException(status_code=403, detail="Only admins/managers can change roles")
            
            new_role = action_data.get("role")
            if new_role not in ["admin", "manager", "moderator", "member"]:
                raise HTTPException(status_code=400, detail="Invalid role")
            
            await db.community_group_memberships.update_one(
                {"id": target_membership["id"]},
                {"$set": {"role": new_role}}
            )
            return {"success": True, "message": f"Role changed to {new_role}"}
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
    except Exception as e:
        logging.error(f"Error managing group member: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# GROUP POSTS ENDPOINTS
# ==========================================

@api_router.post("/community/groups/{group_id}/posts")
async def create_group_post(group_id: str, post_data: dict, athlete_id: str = Query(...)):
    """Create a post in a group"""
    try:
        # Verify membership
        membership = await db.community_group_memberships.find_one({
            "group_id": group_id,
            "athlete_id": athlete_id,
            "status": "approved"
        })
        if not membership:
            raise HTTPException(status_code=403, detail="Must be a group member to post")
        
        # Get athlete info
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        # Create post
        post = {
            "id": str(uuid.uuid4()),
            "group_id": group_id,
            "athlete_id": athlete_id,
            "athlete_name": athlete.get("name", "Unknown"),
            "athlete_profile_picture": athlete.get("profile_picture"),
            "content": post_data.get("content", ""),
            "image_data": post_data.get("image_data"),
            "likes_count": 0,
            "comments_count": 0,
            "shares_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": None,
            "is_edited": False
        }
        
        await db.community_group_posts.insert_one(prepare_for_mongo(post.copy()))
        return post
    except Exception as e:
        logging.error(f"Error creating group post: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/groups/{group_id}/posts")
async def get_group_posts(group_id: str, athlete_id: str = Query(...), limit: int = Query(50)):
    """Get posts from a group with subscription tier"""
    try:
        # Verify membership for private groups
        group = await db.community_groups.find_one({"id": group_id}, {"_id": 0})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        if group["privacy"] == "private":
            membership = await db.community_group_memberships.find_one({
                "group_id": group_id,
                "athlete_id": athlete_id,
                "status": "approved"
            })
            if not membership:
                raise HTTPException(status_code=403, detail="Must be a member to view posts")
        
        # Get posts with subscription tier using aggregation
        pipeline = [
            {"$match": {"group_id": group_id}},
            {"$sort": {"created_at": -1}},
            {"$limit": limit},
            {
                "$lookup": {
                    "from": "athlete_profiles",
                    "localField": "athlete_id",
                    "foreignField": "id",
                    "as": "athlete_info"
                }
            },
            {
                "$addFields": {
                    "subscription_tier": {"$arrayElemAt": ["$athlete_info.subscription_tier", 0]},
                    "nationality": {"$arrayElemAt": ["$athlete_info.nationality", 0]}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "athlete_info": 0
                }
            }
        ]
        
        posts = await db.community_group_posts.aggregate(pipeline).to_list(length=None)
        
        # For each post, check if current user has liked it
        for post in posts:
            like = await db.community_likes.find_one({
                "post_id": post["id"],
                "athlete_id": athlete_id
            })
            post["liked_by_user"] = like is not None
        
        return {"posts": posts}
    except Exception as e:
        logging.error(f"Error fetching group posts: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ==========================================
# EVENTS ENDPOINTS
# ==========================================

@api_router.post("/community/events")
async def create_event(event_data: dict, athlete_id: str = Query(...)):
    """Create a new event"""
    try:
        # Create event
        event = {
            "id": str(uuid.uuid4()),
            "name": event_data.get("name", ""),
            "description": event_data.get("description", ""),
            "visibility": event_data.get("visibility", "open"),
            "event_date": event_data.get("event_date", ""),
            "event_time": event_data.get("event_time", ""),
            "location": event_data.get("location"),
            "profile_image": event_data.get("profile_image"),
            "cover_photo": event_data.get("cover_photo"),
            "group_id": event_data.get("group_id"),
            "creator_id": athlete_id,
            "interested_count": 0,
            "going_count": 0,
            "comments_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": None
        }
        
        await db.community_events.insert_one(prepare_for_mongo(event.copy()))
        
        # If connected to a group, notify all group members
        if event.get("group_id"):
            group_memberships = await db.community_group_memberships.find({
                "group_id": event["group_id"],
                "status": "approved"
            }, {"_id": 0}).to_list(length=None)
            
            creator = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
            
            for membership in group_memberships:
                if membership["athlete_id"] != athlete_id:  # Don't notify creator
                    notification = {
                        "id": str(uuid.uuid4()),
                        "athlete_id": membership["athlete_id"],
                        "type": "event_invite",
                        "content": f"{creator.get('name', 'Someone')} created an event: {event['name']}",
                        "from_athlete_id": athlete_id,
                        "from_athlete_name": creator.get("name", "Unknown"),
                        "read": False,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "event_id": event["id"]
                    }
                    await db.community_notifications.insert_one(prepare_for_mongo(notification.copy()))
        
        return {"success": True, "event": event}
    except Exception as e:
        logging.error(f"Error creating event: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/events")
async def get_all_events(athlete_id: str = Query(...), group_id: str = Query(None), limit: int = Query(50), skip: int = Query(0), exclude_images: bool = Query(False)):
    """Get all events (open events + group events where user is member) - Optimized with pagination and image exclusion"""
    try:
        # Build projection to exclude images if requested
        projection_stage = {
            "$project": {
                "_id": 0,
                "user_attendance": 0
            }
        }
        
        if exclude_images:
            projection_stage["$project"]["profile_image"] = 0
            projection_stage["$project"]["cover_photo"] = 0
        
        if group_id:
            # Get events for specific group using aggregation
            pipeline = [
                {"$match": {"group_id": group_id}},
                {"$sort": {"event_date": 1}},
                {"$skip": skip},
                {"$limit": limit},
                {
                    "$lookup": {
                        "from": "community_event_attendance",
                        "let": {"event_id": "$id"},
                        "pipeline": [
                            {
                                "$match": {
                                    "$expr": {
                                        "$and": [
                                            {"$eq": ["$event_id", "$$event_id"]},
                                            {"$eq": ["$athlete_id", athlete_id]}
                                        ]
                                    }
                                }
                            }
                        ],
                        "as": "user_attendance"
                    }
                },
                {
                    "$addFields": {
                        "user_status": {
                            "$cond": {
                                "if": {"$gt": [{"$size": "$user_attendance"}, 0]},
                                "then": {"$arrayElemAt": ["$user_attendance.status", 0]},
                                "else": None
                            }
                        }
                    }
                },
                projection_stage
            ]
        else:
            # Get open events + events from user's groups using aggregation
            user_groups = await db.community_group_memberships.find({
                "athlete_id": athlete_id,
                "status": "approved"
            }, {"_id": 0, "group_id": 1}).to_list(length=None)
            
            group_ids = [m["group_id"] for m in user_groups]
            
            pipeline = [
                {
                    "$match": {
                        "$or": [
                            {"visibility": "open"},
                            {"group_id": {"$in": group_ids}}
                        ]
                    }
                },
                {"$sort": {"event_date": 1}},
                {"$skip": skip},
                {"$limit": limit},
                {
                    "$lookup": {
                        "from": "community_event_attendance",
                        "let": {"event_id": "$id"},
                        "pipeline": [
                            {
                                "$match": {
                                    "$expr": {
                                        "$and": [
                                            {"$eq": ["$event_id", "$$event_id"]},
                                            {"$eq": ["$athlete_id", athlete_id]}
                                        ]
                                    }
                                }
                            }
                        ],
                        "as": "user_attendance"
                    }
                },
                {
                    "$addFields": {
                        "user_status": {
                            "$cond": {
                                "if": {"$gt": [{"$size": "$user_attendance"}, 0]},
                                "then": {"$arrayElemAt": ["$user_attendance.status", 0]},
                                "else": None
                            }
                        }
                    }
                },
                projection_stage
            ]
        
        events = await db.community_events.aggregate(pipeline).to_list(length=None)
        
        return {"events": events}
    except Exception as e:
        logging.error(f"Error fetching events: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/community/events/{event_id}")
async def get_event_details(event_id: str, athlete_id: str = Query(...), exclude_images: bool = Query(False)):
    """Get event details with participant information - optimized"""
    try:
        # Exclude images from event data if requested
        projection = {"_id": 0}
        if exclude_images:
            projection["profile_image"] = 0
            projection["cover_photo"] = 0
        
        event = await db.community_events.find_one({"id": event_id}, projection)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Check user's RSVP status
        attendance = await db.community_event_attendance.find_one({
            "event_id": event_id,
            "athlete_id": athlete_id
        })
        event["user_status"] = attendance.get("status") if attendance else None
        
        # Get attendees with their details - only names, no profile pictures
        interested_pipeline = [
            {"$match": {"event_id": event_id, "status": "interested"}},
            {
                "$lookup": {
                    "from": "athlete_profiles",
                    "localField": "athlete_id",
                    "foreignField": "id",
                    "as": "athlete_info"
                }
            },
            {"$unwind": "$athlete_info"},
            {
                "$project": {
                    "_id": 0,
                    "athlete_id": 1,
                    "athlete_name": "$athlete_info.name",
                    "athlete_profile_picture": "$athlete_info.profile_picture",
                    "subscription_tier": "$athlete_info.subscription_tier",
                    "nationality": "$athlete_info.nationality"
                }
            }
        ]
        
        going_pipeline = [
            {"$match": {"event_id": event_id, "status": "going"}},
            {
                "$lookup": {
                    "from": "athlete_profiles",
                    "localField": "athlete_id",
                    "foreignField": "id",
                    "as": "athlete_info"
                }
            },
            {"$unwind": "$athlete_info"},
            {
                "$project": {
                    "_id": 0,
                    "athlete_id": 1,
                    "athlete_name": "$athlete_info.name",
                    "athlete_profile_picture": "$athlete_info.profile_picture",
                    "subscription_tier": "$athlete_info.subscription_tier",
                    "nationality": "$athlete_info.nationality"
                }
            }
        ]
        
        interested = await db.community_event_attendance.aggregate(interested_pipeline).to_list(length=None)
        going = await db.community_event_attendance.aggregate(going_pipeline).to_list(length=None)
        
        event["interested_users"] = interested
        event["going_users"] = going
        event["interested_count"] = len(interested)
        event["going_count"] = len(going)
        
        return event
    except Exception as e:
        logging.error(f"Error fetching event details: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/community/events/{event_id}")
async def edit_event(event_id: str, event_data: dict, athlete_id: str = Query(...)):
    """Edit event (creator only)"""
    try:
        # Verify creator
        event = await db.community_events.find_one({"id": event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        if event["creator_id"] != athlete_id:
            raise HTTPException(status_code=403, detail="Only event creator can edit")
        
        # Update event
        update_data = {
            "name": event_data.get("name"),
            "description": event_data.get("description"),
            "visibility": event_data.get("visibility"),
            "event_date": event_data.get("event_date"),
            "event_time": event_data.get("event_time"),
            "location": event_data.get("location"),
            "profile_image": event_data.get("profile_image"),
            "cover_photo": event_data.get("cover_photo"),
            "group_id": event_data.get("group_id"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        await db.community_events.update_one(
            {"id": event_id},
            {"$set": update_data}
        )
        
        updated_event = await db.community_events.find_one({"id": event_id}, {"_id": 0})
        return {"success": True, "event": updated_event}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error editing event: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/community/events/{event_id}")
async def delete_event(event_id: str, athlete_id: str = Query(...)):
    """Delete event (creator or super-admin)"""
    try:
        # Verify creator or super-admin
        event = await db.community_events.find_one({"id": event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Check if user is super-admin
        athlete = await db.athlete_profiles.find_one({"id": athlete_id})
        is_super_admin = athlete.get("is_super_admin", False) if athlete else False
        
        if event["creator_id"] != athlete_id and not is_super_admin:
            raise HTTPException(status_code=403, detail="Only event creator can delete")
        
        # Delete event and attendance
        await db.community_events.delete_one({"id": event_id})
        await db.community_event_attendance.delete_many({"event_id": event_id})
        await db.community_event_comments.delete_many({"event_id": event_id})
        
        return {"success": True, "message": "Event deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting event: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/community/events/{event_id}/rsvp")
async def rsvp_event(event_id: str, rsvp_data: dict, athlete_id: str = Query(...)):
    """RSVP to an event (interested/going)"""
    try:
        # Check if event exists
        event = await db.community_events.find_one({"id": event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        status = rsvp_data.get("status")  # 'interested', 'going', 'not_going'
        
        if status not in ["interested", "going", "not_going"]:
            raise HTTPException(status_code=400, detail="Invalid RSVP status")
        
        # Check existing RSVP
        existing_rsvp = await db.community_event_attendance.find_one({
            "event_id": event_id,
            "athlete_id": athlete_id
        })
        
        if status == "not_going":
            # Remove RSVP
            if existing_rsvp:
                old_status = existing_rsvp.get("status")
                await db.community_event_attendance.delete_one({"id": existing_rsvp["id"]})
                
                # Update counts
                if old_status == "interested":
                    await db.community_events.update_one({"id": event_id}, {"$inc": {"interested_count": -1}})
                elif old_status == "going":
                    await db.community_events.update_one({"id": event_id}, {"$inc": {"going_count": -1}})
        else:
            if existing_rsvp:
                # Update existing RSVP
                old_status = existing_rsvp.get("status")
                await db.community_event_attendance.update_one(
                    {"id": existing_rsvp["id"]},
                    {"$set": {"status": status}}
                )
                
                # Update counts
                if old_status == "interested":
                    await db.community_events.update_one({"id": event_id}, {"$inc": {"interested_count": -1}})
                elif old_status == "going":
                    await db.community_events.update_one({"id": event_id}, {"$inc": {"going_count": -1}})
                
                if status == "interested":
                    await db.community_events.update_one({"id": event_id}, {"$inc": {"interested_count": 1}})
                elif status == "going":
                    await db.community_events.update_one({"id": event_id}, {"$inc": {"going_count": 1}})
            else:
                # Create new RSVP
                rsvp = {
                    "id": str(uuid.uuid4()),
                    "event_id": event_id,
                    "athlete_id": athlete_id,
                    "status": status,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.community_event_attendance.insert_one(prepare_for_mongo(rsvp.copy()))
                
                # Update counts
                if status == "interested":
                    await db.community_events.update_one({"id": event_id}, {"$inc": {"interested_count": 1}})
                elif status == "going":
                    await db.community_events.update_one({"id": event_id}, {"$inc": {"going_count": 1}})
        
        # Get updated event
        updated_event = await db.community_events.find_one({"id": event_id}, {"_id": 0})
        return {
            "success": True,
            "status": status,
            "interested_count": updated_event["interested_count"],
            "going_count": updated_event["going_count"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error RSVP event: {e}")
        raise HTTPException(status_code=500, detail=str(e))




# Include the router in the main app (after all endpoints are defined)
# ==================== REFERRAL SYSTEM ENDPOINTS ====================

@api_router.post("/referrals/generate")
async def generate_referral_code(athlete_id: str = Query(...)):
    """Generate or retrieve referral code for an athlete"""
    try:
        # Check if athlete already has a referral code
        existing = await db.referrals.find_one({"referrer_id": athlete_id, "referred_user_id": None})
        
        if existing:
            return {
                "referral_code": existing["referral_code"],
                "referral_link": f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/?ref={existing['referral_code']}"
            }
        
        # Generate new code
        code = f"TRAIN{athlete_id[:8].upper()}"
        
        # Create referral record
        referral = Referral(
            referrer_id=athlete_id,
            referral_code=code
        )
        
        await db.referrals.insert_one(referral.dict())
        
        return {
            "referral_code": code,
            "referral_link": f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/?ref={code}"
        }
    except Exception as e:
        logging.error(f"Error generating referral code: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/referrals/track-click")
async def track_referral_click(referral_code: str = Query(...), ip_address: Optional[str] = Query(None)):
    """Track when someone clicks a referral link"""
    try:
        # Find referral by code
        referral = await db.referrals.find_one({"referral_code": referral_code, "referred_user_id": None})
        
        if not referral:
            return {"success": False, "message": "Referral code not found"}
        
        # Update click count and add IP
        update_data = {"$inc": {"click_count": 1}}
        if ip_address:
            update_data["$addToSet"] = {"ip_addresses": ip_address}
        
        await db.referrals.update_one(
            {"referral_code": referral_code, "referred_user_id": None},
            update_data
        )
        
        return {"success": True, "message": "Click tracked"}
    except Exception as e:
        logging.error(f"Error tracking click: {e}")
        return {"success": False, "message": str(e)}

@api_router.post("/referrals/convert")
async def convert_referral(athlete_id: str = Query(...), referral_code: Optional[str] = Query(None)):
    """Mark referral as converted when new user signs up and creates Stripe subscription"""
    try:
        if not referral_code:
            return {"success": False, "message": "No referral code provided"}
        
        # Find the referral
        referral = await db.referrals.find_one({
            "referral_code": referral_code,
            "referred_user_id": None  # Not yet converted
        })
        
        if not referral:
            return {"success": False, "message": "Referral not found or already used"}
        
        # Get athlete email
        athlete = await db.athletes.find_one({"id": athlete_id})
        if not athlete:
            return {"success": False, "message": "Athlete not found"}
        
        # Check for self-referral (fraud prevention)
        if referral["referrer_id"] == athlete_id:
            return {"success": False, "message": "Cannot refer yourself"}
        
        # Mark referral as converted
        await db.referrals.update_one(
            {"id": referral["id"]},
            {
                "$set": {
                    "referred_user_id": athlete_id,
                    "referred_user_email": athlete.get("email"),
                    "status": "converted",
                    "converted_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Create reward for referrer (20% discount)
        reward = ReferralReward(
            athlete_id=referral["referrer_id"],
            referral_id=referral["id"],
            discount_percentage=20,
            expires_at=(datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
        )
        
        await db.referral_rewards.insert_one(reward.dict())
        
        return {
            "success": True,
            "message": "Referral converted successfully",
            "reward_issued": True
        }
    except Exception as e:
        logging.error(f"Error converting referral: {e}")
        return {"success": False, "message": str(e)}

@api_router.get("/referrals/stats/{athlete_id}")
async def get_referral_stats(athlete_id: str):
    """Get referral statistics for an athlete"""
    try:
        # Get all referrals by this athlete
        referrals = await db.referrals.find({"referrer_id": athlete_id}).to_list(length=None)
        
        # Calculate stats
        total_clicks = sum(r.get("click_count", 0) for r in referrals)
        converted_referrals = [r for r in referrals if r.get("status") == "converted"]
        total_conversions = len(converted_referrals)
        conversion_rate = (total_conversions / total_clicks * 100) if total_clicks > 0 else 0
        
        # Get rewards
        rewards = await db.referral_rewards.find({
            "athlete_id": athlete_id,
            "status": "pending"
        }).to_list(length=None)
        
        # Calculate total discount available (cap at 100%)
        total_discount = min(sum(r.get("discount_percentage", 0) for r in rewards), 100)
        
        # Get referral code
        referral_code = referrals[0].get("referral_code") if referrals else f"TRAIN{athlete_id[:8].upper()}"
        
        return {
            "referral_code": referral_code,
            "total_clicks": total_clicks,
            "total_conversions": total_conversions,
            "conversion_rate": round(conversion_rate, 1),
            "pending_referrals": len([r for r in referrals if r.get("status") == "pending"]),
            "total_discount_available": total_discount,
            "rewards": [
                {
                    "discount_percentage": r.get("discount_percentage", 0),
                    "expires_at": r.get("expires_at", ""),
                    "created_at": r.get("created_at", ""),
                    "status": r.get("status", "pending")
                }
                for r in rewards
            ]
        }
    except Exception as e:
        logging.error(f"Error fetching referral stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/referrals/discount/{athlete_id}")
async def get_available_discount(athlete_id: str):
    """Get total available discount for an athlete (capped at 100%)"""
    try:
        # Get all pending rewards
        rewards = await db.referral_rewards.find({
            "athlete_id": athlete_id,
            "status": "pending"
        }).to_list(length=None)
        
        # Calculate total discount (cap at 100%)
        total_discount = min(sum(r.get("discount_percentage", 0) for r in rewards), 100)
        
        # Calculate how many rewards to apply (max 5 for 100%)
        rewards_to_apply = min(len(rewards), 5)
        
        return {
            "total_discount": total_discount,
            "rewards_count": len(rewards),
            "rewards_to_apply": rewards_to_apply,
            "capped": len(rewards) > 5
        }
    except Exception as e:
        logging.error(f"Error fetching discount: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/referrals/apply-discount")
async def apply_referral_discount(athlete_id: str = Query(...)):
    """Apply accumulated referral discounts to athlete's next payment"""
    try:
        # Get pending rewards (max 5 for 100%)
        rewards = await db.referral_rewards.find({
            "athlete_id": athlete_id,
            "status": "pending"
        }).sort("created_at", 1).limit(5).to_list(length=None)
        
        if not rewards:
            return {"success": False, "message": "No rewards available"}
        
        # Calculate total discount (cap at 100%)
        total_discount = min(sum(r.get("discount_percentage", 0) for r in rewards), 100)
        
        # Mark rewards as applied
        reward_ids = [r["id"] for r in rewards]
        await db.referral_rewards.update_many(
            {"id": {"$in": reward_ids}},
            {
                "$set": {
                    "status": "applied",
                    "applied_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "discount_applied": total_discount,
            "rewards_used": len(rewards)
        }
    except Exception as e:
        logging.error(f"Error applying discount: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===========================
# System Settings (Super Admin Only)
# ===========================

async def verify_super_admin(athlete_id: str):
    """Verify if athlete is super admin"""
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="User not found")
    if not athlete.get("is_super_admin", False):
        raise HTTPException(status_code=403, detail="Access denied. Super admin privileges required.")
    return athlete

@api_router.get("/system/stats")
async def get_system_stats(athlete_id: str):
    """Get system statistics (Super Admin only)"""
    # Verify super admin
    await verify_super_admin(athlete_id)
    
    try:
        # Count total users
        total_users = await db.athlete_profiles.count_documents({})
        
        # Count active sessions (placeholder - implement based on your session management)
        active_sessions = 0  # TODO: Implement session counting
        
        # Get database size (approximate)
        stats_result = await db.command("dbStats")
        db_size_bytes = stats_result.get("dataSize", 0)
        db_size_mb = round(db_size_bytes / (1024 * 1024), 2)
        db_size = f"{db_size_mb} MB"
        
        # System health check (basic)
        health = "Good"
        
        return {
            "total_users": total_users,
            "active_sessions": active_sessions,
            "db_size": db_size,
            "health": health
        }
    except Exception as e:
        logging.error(f"Error getting system stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve system stats: {str(e)}")

# Email Template Routes
@api_router.get("/email-templates")
async def get_email_templates():
    """Get all email templates"""
    try:
        templates = await db.email_templates.find({}, {"_id": 0}).to_list(length=None)
        return templates
    except Exception as e:
        logging.error(f"Error getting email templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/email-templates")
async def save_email_template(template: EmailTemplateUpdate):
    """Save or update an email template"""
    try:
        # Check if template exists
        existing = await db.email_templates.find_one({"template_id": template.template_id})
        
        template_data = {
            "template_id": template.template_id,
            "subject": template.subject,
            "body": template.body,
            "html_body": template.html_body,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if existing:
            # Update existing template
            await db.email_templates.update_one(
                {"template_id": template.template_id},
                {"$set": prepare_for_mongo(template_data)}
            )
        else:
            # Create new template
            template_data["id"] = str(uuid.uuid4())
            template_data["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.email_templates.insert_one(prepare_for_mongo(template_data))
        
        return {"success": True, "message": "Email template saved successfully"}
    except Exception as e:
        logging.error(f"Error saving email template: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/email-templates/{template_id}")
async def get_email_template(template_id: str):
    """Get a specific email template"""
    try:
        template = await db.email_templates.find_one({"template_id": template_id}, {"_id": 0})
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        return template
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting email template: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/email-templates/send-test")
async def send_test_email(request: dict):
    """Send a test email with sample data"""
    try:
        logging.info(f"=== SEND TEST EMAIL START ===")
        logging.info(f"Request payload: {request}")
        
        template_id = request.get("template_id")
        to_email = request.get("to_email")
        subject = request.get("subject")
        body = request.get("body")
        html_body = request.get("html_body")
        
        logging.info(f"Extracted values - to_email: {to_email}, subject: {subject}")
        logging.info(f"Body length: {len(body) if body else 'None'}, HTML body length: {len(html_body) if html_body else 'None'}")
        
        if not to_email:
            raise HTTPException(status_code=400, detail="Email address is required")
        
        # Sample data for variable replacement
        sample_data = {
            "{{user_name}}": "John Doe",
            "{{reset_link}}": "https://example.com/reset-password?token=sample123",
            "{{login_url}}": "https://example.com/login",
            "{{new_email}}": "newemail@example.com"
        }
        
        # Replace variables with sample data
        test_subject = subject if subject else "Test Email"
        test_body = body if body else ""
        test_html_body = html_body if html_body else ""
        
        logging.info(f"Before replacement - test_subject: {test_subject}, test_body length: {len(test_body)}, test_html_body length: {len(test_html_body)}")
        
        for variable, value in sample_data.items():
            if test_subject:
                test_subject = test_subject.replace(variable, value)
            if test_body:
                test_body = test_body.replace(variable, value)
            if test_html_body:
                test_html_body = test_html_body.replace(variable, value)
        
        logging.info(f"After replacement - test_subject: {test_subject}, test_body length: {len(test_body)}, test_html_body length: {len(test_html_body)}")
        
        # Get email service
        logging.info("Getting email service...")
        email_service = get_email_service()
        logging.info(f"Email service enabled: {email_service.enabled}")
        logging.info(f"Email service sender: {email_service.sender_email}")
        
        # Send email using email service
        logging.info(f"Attempting to send email to {to_email}...")
        await email_service.send_email(
            to_email=to_email,
            subject=f"[TEST] {test_subject}",
            html_content=test_html_body if test_html_body else None,
            text_content=test_body if test_body else None
        )
        
        logging.info("Email sent successfully!")
        return {"success": True, "message": "Test email sent successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending test email: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to send test email: {str(e)}")


# =====================================================
# SUPPORT FORM
# =====================================================

class SupportFormSubmission(BaseModel):
    """Model for support form submission"""
    name: str
    email: str
    subject: str
    message: str

@api_router.post("/support/submit")
async def submit_support_form(submission: SupportFormSubmission):
    """
    Handle support form submission and send email to support@kaizenlifetracker.com
    """
    try:
        logging.info(f"=== SUPPORT FORM SUBMISSION RECEIVED ===")
        logging.info(f"From: {submission.name} ({submission.email})")
        logging.info(f"Subject: {submission.subject}")
        
        # Get email service
        email_service = get_email_service()
        
        if not email_service or not email_service.enabled:
            logging.error("Email service not configured")
            raise HTTPException(status_code=500, detail="Email service not configured. Please contact support directly at support@kaizenlifetracker.com")
        
        # Create email content
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #00C2A8;">New Support Request</h2>
                <p><strong>From:</strong> {submission.name}</p>
                <p><strong>Email:</strong> {submission.email}</p>
                <p><strong>Subject:</strong> {submission.subject}</p>
                <hr style="border: 1px solid #eee; margin: 20px 0;">
                <p><strong>Message:</strong></p>
                <p style="background: #f5f5f5; padding: 15px; border-left: 4px solid #00C2A8;">
                    {submission.message.replace(chr(10), '<br>')}
                </p>
                <hr style="border: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 12px;">
                    This is an automated message from the TrainSmart support form.
                </p>
            </body>
        </html>
        """
        
        text_content = f"""
        New Support Request
        
        From: {submission.name}
        Email: {submission.email}
        Subject: {submission.subject}
        
        Message:
        {submission.message}
        
        ---
        This is an automated message from the TrainSmart support form.
        """
        
        # Send email to support
        logging.info(f"Sending support email to support@kaizenlifetracker.com...")
        await email_service.send_email(
            to_email="support@kaizenlifetracker.com",
            subject=f"Support Request: {submission.subject}",
            html_content=html_content,
            text_content=text_content
        )
        
        logging.info("Support email sent successfully")
        return {"success": True, "message": "Your support request has been submitted successfully"}
        
    except EmailDeliveryError as e:
        logging.error(f"Failed to send support email: {e}")
        raise HTTPException(status_code=500, detail="Failed to send support request. Please try again or contact support@kaizenlifetracker.com directly")
    except Exception as e:
        logging.error(f"Error submitting support form: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to submit support request: {str(e)}")


# =====================================================
# CUSTOM EMAILS
# =====================================================

class CustomEmail(BaseModel):
    """Model for custom email campaign"""
    name: str
    subject: str
    body: str
    html_body: Optional[str] = ""
    target_audience: str  # all, waitlist, free, pro, premium

@api_router.get("/custom-emails")
async def get_custom_emails():
    """Get all custom email campaigns"""
    try:
        emails = await db.custom_emails.find({}, {"_id": 0}).to_list(length=None)
        return {"emails": emails}
    except Exception as e:
        logging.error(f"Error fetching custom emails: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/custom-emails")
async def create_custom_email(email: CustomEmail):
    """Create a new custom email campaign"""
    try:
        email_data = {
            "id": str(uuid.uuid4()),
            "name": email.name,
            "subject": email.subject,
            "body": email.body,
            "html_body": email.html_body,
            "target_audience": email.target_audience,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.custom_emails.insert_one(prepare_for_mongo(email_data.copy()))
        
        return {"success": True, "email": email_data}
    except Exception as e:
        logging.error(f"Error creating custom email: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/custom-emails/{email_id}")
async def update_custom_email(email_id: str, email: CustomEmail):
    """Update an existing custom email campaign"""
    try:
        email_data = {
            "name": email.name,
            "subject": email.subject,
            "body": email.body,
            "html_body": email.html_body,
            "target_audience": email.target_audience,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        result = await db.custom_emails.update_one(
            {"id": email_id},
            {"$set": prepare_for_mongo(email_data)}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Custom email not found")
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating custom email: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/custom-emails/{email_id}")
async def delete_custom_email(email_id: str):
    """Delete a custom email campaign"""
    try:
        result = await db.custom_emails.delete_one({"id": email_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Custom email not found")
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting custom email: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/custom-emails/{email_id}/send")
async def send_custom_email(email_id: str):
    """Send custom email to targeted audience"""
    try:
        # Get the custom email
        email = await db.custom_emails.find_one({"id": email_id}, {"_id": 0})
        if not email:
            raise HTTPException(status_code=404, detail="Custom email not found")
        
        # Get email service
        email_service = get_email_service()
        if not email_service or not email_service.enabled:
            raise HTTPException(status_code=500, detail="Email service not configured")
        
        # Build query based on target audience
        query = {}
        target_audience = email.get("target_audience", "all")
        collection = db.athlete_profiles  # Default collection
        
        if target_audience == "waitlist":
            # Waitlist users are in a separate collection
            collection = db.waiting_list
            query = {}  # Get all waitlist entries
        elif target_audience in ["free", "pro", "premium"]:
            query["subscription_tier"] = target_audience
        # If "all", query remains empty (all users from athlete_profiles)
        
        # Get target users
        users = await collection.find(query, {"_id": 0, "email": 1, "name": 1}).to_list(length=None)
        
        if not users:
            raise HTTPException(status_code=400, detail=f"No users found for target audience: {target_audience}")
        
        # Send email to each user
        sent_count = 0
        failed_count = 0
        
        for user in users:
            try:
                # Replace variables in email content
                user_name = user.get("name", "User")
                user_email = user.get("email")
                
                if not user_email:
                    continue
                
                body = email["body"].replace("{{user_name}}", user_name).replace("{{user_email}}", user_email)
                html_body = email.get("html_body", "").replace("{{user_name}}", user_name).replace("{{user_email}}", user_email)
                
                # Send email
                await email_service.send_email(
                    to_email=user_email,
                    subject=email["subject"],
                    text_content=body,
                    html_content=html_body if html_body else None
                )
                sent_count += 1
                
            except Exception as e:
                logging.error(f"Failed to send email to {user.get('email')}: {e}")
                failed_count += 1
                continue
        
        logging.info(f"Custom email sent: {sent_count} successful, {failed_count} failed")
        
        return {
            "success": True,
            "sent_count": sent_count,
            "failed_count": failed_count,
            "target_audience": target_audience,
            "total_users": len(users)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending custom email: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# ANALYTICS - First-Party Tracking Endpoint
# =====================================================

class AnalyticsEvent(BaseModel):
    """Model for analytics events"""
    model_config = ConfigDict(protected_namespaces=())
    
    event: str
    timestamp: str
    page_location: Optional[str] = None
    page_path: Optional[str] = None
    page_title: Optional[str] = None
    page_referrer: Optional[str] = None
    anon_id: Optional[str] = None
    user_id: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_term: Optional[str] = None
    utm_content: Optional[str] = None
    properties: Optional[Dict[str, Any]] = {}

@api_router.post("/analytics/track")
async def track_analytics_event(event_data: dict, request: Request):
    """
    First-party analytics endpoint
    - Validates consent from cookie
    - Stores events (optional)
    - Forwards to GA4 Measurement Protocol (optional)
    - Ad-block resilient
    """
    try:
        logging.info(f"=== ANALYTICS EVENT RECEIVED ===")
        logging.info(f"Event: {event_data.get('event')}")
        
        # Check if analytics consent is granted
        # This can be done via cookie or header
        # For now, we'll accept all events and let GTM handle consent
        
        # Validate event data
        event = event_data.get('event')
        if not event:
            raise HTTPException(status_code=400, detail="Event name is required")
        
        # Extract key fields
        analytics_event = {
            "event": event,
            "timestamp": event_data.get('timestamp', datetime.now(timezone.utc).isoformat()),
            "anon_id": event_data.get('anon_id'),
            "user_id": event_data.get('user_id'),
            "page_location": event_data.get('page_location'),
            "page_path": event_data.get('page_path'),
            "page_title": event_data.get('page_title'),
            "page_referrer": event_data.get('page_referrer'),
            "utm_source": event_data.get('utm_source'),
            "utm_medium": event_data.get('utm_medium'),
            "utm_campaign": event_data.get('utm_campaign'),
            "utm_term": event_data.get('utm_term'),
            "utm_content": event_data.get('utm_content'),
            "properties": {k: v for k, v in event_data.items() if k not in [
                'event', 'timestamp', 'anon_id', 'user_id', 'page_location',
                'page_path', 'page_title', 'page_referrer', 'utm_source',
                'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'
            ]},
            "user_agent": request.headers.get("user-agent", ""),
            "ip_address": request.client.host if request.client else None,
            "received_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Store in database (optional - for data warehouse)
        try:
            await db.analytics_events.insert_one(analytics_event)
            logging.info(f"Analytics event stored: {event}")
        except Exception as db_error:
            logging.warning(f"Failed to store analytics event: {db_error}")
            # Continue even if storage fails
        
        # TODO: Forward to GA4 Measurement Protocol if needed
        # This would require GA4 API Secret and Measurement ID
        # For now, GTM handles the forwarding via client-side dataLayer
        
        return {
            "success": True,
            "message": "Event tracked successfully",
            "event": event
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error tracking analytics event: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to track event: {str(e)}")

@api_router.get("/analytics/events")
async def get_analytics_events(
    athlete_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = 100
):
    """
    Get analytics events (Super Admin only)
    Useful for debugging and data verification
    """
    try:
        # Verify super admin
        await verify_super_admin(athlete_id)
        
        # Build query
        query = {}
        
        if start_date:
            query["timestamp"] = {"$gte": start_date}
        
        if end_date:
            if "timestamp" in query:
                query["timestamp"]["$lte"] = end_date
            else:
                query["timestamp"] = {"$lte": end_date}
        
        if event_type:
            query["event"] = event_type
        
        # Fetch events
        events = await db.analytics_events.find(
            query,
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(length=None)
        
        return {
            "success": True,
            "count": len(events),
            "events": events
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching analytics events: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch events: {str(e)}")

@api_router.get("/analytics/stats")
async def get_analytics_stats(athlete_id: str, days: int = 30):
    """
    Get analytics statistics (Super Admin only)
    Provides overview of tracked events
    """
    try:
        # Verify super admin
        await verify_super_admin(athlete_id)
        
        # Calculate date range
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days)
        
        # Aggregate events by type
        pipeline = [
            {
                "$match": {
                    "timestamp": {
                        "$gte": start_date.isoformat(),
                        "$lte": end_date.isoformat()
                    }
                }
            },
            {
                "$group": {
                    "_id": "$event",
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"count": -1}
            }
        ]
        
        event_counts = await db.analytics_events.aggregate(pipeline).to_list(length=None)
        
        # Get total events
        total_events = sum(item["count"] for item in event_counts)
        
        # Get unique users
        unique_users = await db.analytics_events.distinct(
            "anon_id",
            {
                "timestamp": {
                    "$gte": start_date.isoformat(),
                    "$lte": end_date.isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "period_days": days,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_events": total_events,
            "unique_users": len(unique_users),
            "events_by_type": [
                {
                    "event": item["_id"],
                    "count": item["count"],
                    "percentage": round((item["count"] / total_events * 100), 2) if total_events > 0 else 0
                }
                for item in event_counts
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching analytics stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")

@api_router.get("/system/settings/public")
async def get_public_system_settings():
    """Get public system settings (no auth required)"""
    try:
        # Get settings from database
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        
        # Return only SEO settings and GTM codes for public access
        if settings:
            return {
                "seo": settings.get("advanced", {}).get("seo", {
                    "siteTitle": "TrainSmart",
                    "metaDescription": "",
                    "faviconUrl": None,
                    "logoUrl": None,
                    "ogImage": None
                }),
                "googleTagManager": settings.get("advanced", {}).get("googleTagManager", {
                    "headCode": "",
                    "bodyCode": ""
                }),
                "microsoftClarity": settings.get("advanced", {}).get("microsoftClarity", {
                    "scriptCode": ""
                }),
                "plans": settings.get("plans", {
                    "free": {
                        "title": "Free",
                        "description": "Get started with basic features",
                        "features": ["Basic training plans", "30-day history", "Community access"]
                    },
                    "pro": {
                        "title": "Pro",
                        "description": "Advanced features for serious runners",
                        "features": ["Everything in Free", "Unlimited history", "AI coach chat", "Advanced analytics"]
                    },
                    "premium": {
                        "title": "Premium",
                        "description": "Complete running coaching experience",
                        "features": ["Everything in Pro", "Custom training plans", "Nutrition guidance", "Priority support"]
                    }
                })
            }
        
        # Return defaults if none exist
        return {
            "seo": {
                "siteTitle": "TrainSmart",
                "metaDescription": "",
                "faviconUrl": None,
                "logoUrl": None,
                "ogImage": None
            },
            "googleTagManager": {
                "headCode": "",
                "bodyCode": ""
            },
            "microsoftClarity": {
                "scriptCode": ""
            },
            "plans": {
                "free": {
                    "title": "Free",
                    "description": "Get started with basic features",
                    "features": ["Basic training plans", "30-day history", "Community access"]
                },
                "pro": {
                    "title": "Pro",
                    "description": "Advanced features for serious runners",
                    "features": ["Everything in Free", "Unlimited history", "AI coach chat", "Advanced analytics"]
                },
                "premium": {
                    "title": "Premium",
                    "description": "Complete running coaching experience",
                    "features": ["Everything in Pro", "Custom training plans", "Nutrition guidance", "Priority support"]
                }
            }
        }
    except Exception as e:
        logging.error(f"Error getting public system settings: {e}")
        # Return defaults on error
        return {
            "seo": {
                "siteTitle": "TrainSmart",
                "metaTitle": "TrainSmart - AI-Powered Running Coach",
                "metaDescription": "Your personal AI running coach for optimal training and performance",
                "focusKeyword": "running coach",
                "faviconUrl": None
            }
        }

@api_router.get("/crm/users")
async def get_all_users(athlete_id: str):
    """Get all users for CRM (Super Admin only)"""
    # Verify super admin
    await verify_super_admin(athlete_id)
    
    try:
        # Fetch all athlete profiles with required data
        users = await db.athlete_profiles.find(
            {},
            {
                "_id": 0,
                "id": 1,
                "name": 1,
                "email": 1,
                "profile_picture": 1,
                "subscription_tier": 1,
                "subscription_interval": 1,
                "nationality": 1,
                "created_at": 1,
                "date_of_birth": 1,
                "gender": 1
            }
        ).to_list(length=None)
        
        # Format the data for CRM
        formatted_users = []
        for user in users:
            formatted_users.append({
                "id": user.get("id", ""),
                "name": user.get("name", "Unknown"),
                "email": user.get("email", ""),
                "profile_picture": user.get("profile_picture", ""),
                "subscription_tier": user.get("subscription_tier", "free"),
                "subscription_interval": user.get("subscription_interval", ""),
                "nationality": user.get("nationality", ""),
                "created_at": user.get("created_at", ""),
                "date_of_birth": user.get("date_of_birth", ""),
                "gender": user.get("gender", "")
            })
        
        return {"users": formatted_users, "total": len(formatted_users)}
    except Exception as e:
        logging.error(f"Error fetching CRM users: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")

@api_router.get("/crm/users/{user_id}")
async def get_user_profile(user_id: str, athlete_id: str):
    """Get detailed user profile for CRM (Super Admin only)"""
    # Verify super admin
    await verify_super_admin(athlete_id)
    
    try:
        # 1. Fetch user profile
        user = await db.athlete_profiles.find_one(
            {"id": user_id},
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # 2. Calculate lifetime value from payment transactions
        transactions = await db.payment_transactions.find(
            {"athlete_id": user_id, "payment_status": "paid"},
            {"_id": 0, "amount": 1}
        ).to_list(length=None)
        
        lifetime_value = sum([t.get("amount", 0) for t in transactions])
        
        # 3. Get community stats
        posts_count = await db.community_posts.count_documents({"athlete_id": user_id})
        comments_count = await db.community_comments.count_documents({"athlete_id": user_id})
        events_count = await db.community_events.count_documents({"creator_id": user_id})
        # Challenges - check if collection exists, default to 0 for now
        try:
            challenges_count = await db.challenges.count_documents({"athlete_id": user_id})
        except:
            challenges_count = 0
        
        # 4. Get referral stats
        # Count referrals where this user is the referrer
        referrals = await db.referrals.find(
            {"referrer_athlete_id": user_id},
            {"_id": 0, "referred_athlete_id": 1}
        ).to_list(length=None)
        
        referrals_count = len(referrals)
        
        # Calculate kickback and generated revenue
        kickback = 0
        generated_revenue = 0
        
        for referral in referrals:
            referred_user_id = referral.get("referred_athlete_id")
            if referred_user_id:
                # Get all payments made by referred user
                referred_payments = await db.payment_transactions.find(
                    {"athlete_id": referred_user_id, "payment_status": "paid"},
                    {"_id": 0, "amount": 1}
                ).to_list(length=None)
                
                referred_total = sum([p.get("amount", 0) for p in referred_payments])
                generated_revenue += referred_total
                
                # Calculate kickback (assuming 20% kickback rate)
                kickback += referred_total * 0.20
        
        # 5. Get interaction timeline (placeholder for now)
        interactions = []
        
        # Add payment transactions as interactions
        payment_interactions = await db.payment_transactions.find(
            {"athlete_id": user_id, "payment_status": "paid"},
            {"_id": 0, "tier": 1, "interval": 1, "created_at": 1, "updated_at": 1}
        ).to_list(length=None)
        
        for payment in payment_interactions:
            interactions.append({
                "type": "subscription_payment",
                "description": f"Subscribed to {payment.get('tier', 'plan').capitalize()} ({payment.get('interval', 'monthly')})",
                "timestamp": payment.get("updated_at") or payment.get("created_at", "")
            })
        
        # Sort interactions by timestamp (newest first)
        interactions.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        # 6. Format response
        profile_data = {
            "id": user.get("id", ""),
            "name": user.get("name", "Unknown"),
            "email": user.get("email", ""),
            "profile_picture": user.get("profile_picture", ""),
            "nationality": user.get("nationality", ""),
            "subscription_tier": user.get("subscription_tier", "free"),
            "subscription_interval": user.get("subscription_interval", ""),
            "subscription_current_period_end": user.get("subscription_current_period_end", ""),
            "created_at": user.get("created_at", ""),
            "lifetime_value": lifetime_value,
            "community_stats": {
                "posts_added": posts_count,
                "comments_created": comments_count,
                "events_created": events_count,
                "challenges_done": challenges_count
            },
            "referral_stats": {
                "referrals_count": referrals_count,
                "kickback": kickback,
                "generated_revenue": generated_revenue
            },
            "interactions": interactions[:20]  # Limit to 20 most recent interactions
        }
        
        return profile_data
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching user profile: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch user profile: {str(e)}")

@api_router.get("/crm/orders")
async def get_all_orders(athlete_id: str):
    """Get all Stripe orders/transactions (Super Admin only)"""
    # Verify super admin
    await verify_super_admin(athlete_id)
    
    try:
        # Fetch all transactions from the database, only where payment_status is "paid"
        transactions = await db.payment_transactions.find(
            {"payment_status": "paid"},
            {
                "_id": 0,
                "id": 1,
                "session_id": 1,
                "athlete_id": 1,
                "tier": 1,
                "interval": 1,
                "amount": 1,
                "currency": 1,
                "payment_status": 1,
                "status": 1,
                "created_at": 1,
                "updated_at": 1
            }
        ).to_list(length=None)
        
        # Get athlete names for each transaction and determine if renewal
        formatted_orders = []
        for transaction in transactions:
            athlete_id_val = transaction.get("athlete_id", "")
            
            # Fetch athlete name and profile
            athlete = await db.athlete_profiles.find_one(
                {"id": athlete_id_val},
                {"_id": 0, "name": 1, "email": 1, "created_at": 1}
            )
            
            # Determine if this is a renewal based on subscription history
            # Check if athlete has other completed transactions before this one
            athlete_transactions = await db.payment_transactions.count_documents({
                "athlete_id": athlete_id_val,
                "payment_status": "paid",
                "tier": transaction.get("tier"),
                "created_at": {"$lt": transaction.get("created_at", "")}
            })
            
            is_renewal = athlete_transactions > 0
            
            # Use created_at or updated_at for order date
            order_date = transaction.get("updated_at") or transaction.get("created_at", "")
            
            formatted_orders.append({
                "order_id": transaction.get("id", ""),
                "stripe_session_id": transaction.get("session_id", ""),
                "athlete_id": athlete_id_val,
                "athlete_name": athlete.get("name", "Unknown") if athlete else "Unknown",
                "athlete_email": athlete.get("email", "") if athlete else "",
                "plan": transaction.get("tier", ""),
                "interval": transaction.get("interval", ""),
                "amount": transaction.get("amount", 0),  # Keep amount as is (already in correct format)
                "currency": transaction.get("currency", "EUR").upper(),
                "payment_status": transaction.get("payment_status", ""),
                "status": transaction.get("status", ""),
                "order_date": order_date,
                "is_renewal": is_renewal
            })
        
        # Sort by date, newest first
        formatted_orders.sort(key=lambda x: x.get("order_date", ""), reverse=True)
        
        return {"orders": formatted_orders, "total": len(formatted_orders)}
    except Exception as e:
        logging.error(f"Error fetching orders: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch orders: {str(e)}")


@api_router.delete("/crm/users/{user_id}")
async def delete_user(user_id: str, athlete_id: str = Query(...)):
    """Delete a user and all their data (Super Admin only)"""
    try:
        # Verify super admin
        await verify_super_admin(athlete_id)
        
        # Check if user exists
        user = await db.athlete_profiles.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Delete all user data across collections
        
        # 1. Delete athlete profile
        await db.athlete_profiles.delete_one({"id": user_id})
        
        # 2. Delete community posts
        await db.community_posts.delete_many({"athlete_id": user_id})
        
        # 3. Delete community comments
        await db.community_comments.delete_many({"athlete_id": user_id})
        
        # 4. Delete likes
        await db.community_likes.delete_many({"athlete_id": user_id})
        
        # 5. Delete shares
        await db.community_shares.delete_many({"athlete_id": user_id})
        
        # 6. Delete follows (as follower and following)
        await db.community_follows.delete_many({"follower_id": user_id})
        await db.community_follows.delete_many({"following_id": user_id})
        
        # 7. Delete notifications
        await db.community_notifications.delete_many({"athlete_id": user_id})
        await db.community_notifications.delete_many({"from_athlete_id": user_id})
        
        # 8. Delete group memberships
        await db.community_group_memberships.delete_many({"athlete_id": user_id})
        
        # 9. Delete groups created by user
        await db.community_groups.delete_many({"creator_id": user_id})
        
        # 10. Delete group posts
        await db.community_group_posts.delete_many({"athlete_id": user_id})
        
        # 11. Delete events
        await db.community_events.delete_many({"creator_id": user_id})
        await db.community_event_attendance.delete_many({"athlete_id": user_id})
        await db.community_event_comments.delete_many({"athlete_id": user_id})
        
        # 12. Delete challenges
        await db.community_challenges.delete_many({"creator_id": user_id})
        await db.community_challenge_participants.delete_many({"athlete_id": user_id})
        await db.community_challenge_comments.delete_many({"athlete_id": user_id})
        
        # 13. Delete journal entries
        await db.journal_entries.delete_many({"athlete_id": user_id})
        
        # 14. Delete workouts
        await db.workouts.delete_many({"athlete_id": user_id})
        
        # 15. Delete nutrition logs
        await db.nutrition_logs.delete_many({"athlete_id": user_id})
        
        # 16. Delete supplement logs
        await db.supplement_logs.delete_many({"athlete_id": user_id})
        
        # 17. Delete drink logs
        await db.drink_logs.delete_many({"athlete_id": user_id})
        
        # 18. Delete habits
        await db.habits.delete_many({"athlete_id": user_id})
        
        # 19. Delete payment transactions
        await db.payment_transactions.delete_many({"athlete_id": user_id})
        
        # 20. Delete referrals
        await db.referrals.delete_many({"referrer_id": user_id})
        await db.referrals.delete_many({"referred_id": user_id})
        
        return {"success": True, "message": "User deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/crm/orders/{order_id}")
async def get_order_details(order_id: str, athlete_id: str):
    """Get detailed information for a specific order (Super Admin only)"""
    # Verify super admin
    await verify_super_admin(athlete_id)
    
    try:
        # Fetch the specific order
        transaction = await db.payment_transactions.find_one(
            {"id": order_id},
            {"_id": 0}
        )
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Order not found")
        
        athlete_id_val = transaction.get("athlete_id", "")
        
        # Fetch athlete information
        athlete = await db.athlete_profiles.find_one(
            {"id": athlete_id_val},
            {"_id": 0, "name": 1, "email": 1}
        )
        
        # Check if renewal
        athlete_transactions_before = await db.payment_transactions.count_documents({
            "athlete_id": athlete_id_val,
            "payment_status": "paid",
            "tier": transaction.get("tier"),
            "created_at": {"$lt": transaction.get("created_at", "")}
        })
        
        is_renewal = athlete_transactions_before > 0
        
        # Fetch all orders for this customer
        customer_orders = await db.payment_transactions.find(
            {"athlete_id": athlete_id_val},
            {"_id": 0, "id": 1, "tier": 1, "interval": 1, "amount": 1, "currency": 1, "payment_status": 1, "created_at": 1, "updated_at": 1}
        ).sort("created_at", -1).to_list(length=None)
        
        # Format order history
        order_history = []
        for order in customer_orders:
            # Check if this order is a renewal
            prev_orders = await db.payment_transactions.count_documents({
                "athlete_id": athlete_id_val,
                "payment_status": "paid",
                "tier": order.get("tier"),
                "created_at": {"$lt": order.get("created_at", "")}
            })
            
            order_history.append({
                "order_id": order.get("id", ""),
                "plan": order.get("tier", ""),
                "interval": order.get("interval", ""),
                "amount": order.get("amount", 0),
                "currency": order.get("currency", "EUR").upper(),
                "payment_status": order.get("payment_status", ""),
                "order_date": order.get("updated_at") or order.get("created_at", ""),
                "is_renewal": prev_orders > 0
            })
        
        # Format order details
        order_data = {
            "order_id": transaction.get("id", ""),
            "stripe_session_id": transaction.get("session_id", ""),
            "athlete_id": athlete_id_val,
            "athlete_name": athlete.get("name", "Unknown") if athlete else "Unknown",
            "athlete_email": athlete.get("email", "") if athlete else "",
            "plan": transaction.get("tier", ""),
            "interval": transaction.get("interval", ""),
            "amount": transaction.get("amount", 0),
            "currency": transaction.get("currency", "EUR").upper(),
            "payment_status": transaction.get("payment_status", ""),
            "status": transaction.get("status", ""),
            "order_date": transaction.get("updated_at") or transaction.get("created_at", ""),
            "is_renewal": is_renewal
        }
        
        return {
            "order": order_data,
            "order_history": order_history
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching order details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch order details: {str(e)}")

@api_router.post("/crm/orders/{order_id}/refund")
async def refund_order(order_id: str, athlete_id: str, amount: float, type: str):
    """Process a refund for an order (Super Admin only)"""
    # Verify super admin
    await verify_super_admin(athlete_id)
    
    try:
        # Fetch the order
        transaction = await db.payment_transactions.find_one({"id": order_id})
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Order not found")
        
        if transaction.get("payment_status") != "paid":
            raise HTTPException(status_code=400, detail="Only paid orders can be refunded")
        
        # Validate refund amount
        order_amount = transaction.get("amount", 0)
        if amount > order_amount:
            raise HTTPException(status_code=400, detail="Refund amount cannot exceed order amount")
        
        # Get Stripe settings
        system_settings = await db.system_settings.find_one({}, {"_id": 0})
        stripe_settings = system_settings.get("stripe", {}).get("live", {}) if system_settings else {}
        stripe_api_key = stripe_settings.get("secretKey")
        
        if not stripe_api_key:
            raise HTTPException(status_code=500, detail="Stripe API key not configured")
        
        import stripe
        stripe.api_key = stripe_api_key
        
        # Process the refund through Stripe
        session_id = transaction.get("session_id")
        if not session_id:
            raise HTTPException(status_code=400, detail="No Stripe session ID found for this order")
        
        # Get the payment intent from the session
        session = stripe.checkout.Session.retrieve(session_id)
        payment_intent_id = session.payment_intent
        
        if not payment_intent_id:
            raise HTTPException(status_code=400, detail="No payment intent found for this order")
        
        # Create the refund
        refund_amount_cents = int(amount * 100)  # Convert to cents
        refund = stripe.Refund.create(
            payment_intent=payment_intent_id,
            amount=refund_amount_cents if type == 'partial' else None  # None means full refund
        )
        
        # Update the transaction in database
        new_status = "refunded" if type == 'full' or amount == order_amount else "partially_refunded"
        await db.payment_transactions.update_one(
            {"id": order_id},
            {
                "$set": {
                    "payment_status": new_status,
                    "refund_id": refund.id,
                    "refund_amount": amount,
                    "refund_type": type,
                    "refunded_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "message": f"Refund of {amount} {transaction.get('currency', 'EUR')} processed successfully",
            "refund_id": refund.id,
            "new_status": new_status
        }
    except stripe.error.StripeError as e:
        logging.error(f"Stripe refund error: {e}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error processing refund: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process refund: {str(e)}")

@api_router.get("/crm/subscriptions")
async def get_all_subscriptions(athlete_id: str):
    """Get all active subscriptions (Super Admin only)"""
    # Verify super admin
    await verify_super_admin(athlete_id)
    
    try:
        # Fetch all users with subscription information
        users = await db.athlete_profiles.find(
            {},
            {
                "_id": 0,
                "id": 1,
                "name": 1,
                "email": 1,
                "subscription_tier": 1,
                "subscription_interval": 1,
                "subscription_status": 1,
                "subscription_current_period_start": 1,
                "subscription_current_period_end": 1,
                "subscription_cancel_at": 1,
                "created_at": 1,
                "stripe_customer_id": 1,
                "stripe_subscription_id": 1
            }
        ).to_list(length=None)
        
        subscriptions = []
        for user in users:
            user_id = user.get("id", "")
            
            # Calculate lifetime value from all paid transactions
            transactions = await db.payment_transactions.find(
                {"athlete_id": user_id, "payment_status": "paid"},
                {"_id": 0, "amount": 1}
            ).to_list(length=None)
            
            lifetime_value = sum([t.get("amount", 0) for t in transactions])
            
            # Determine subscription status
            subscription_tier = user.get("subscription_tier", "free")
            subscription_status = user.get("subscription_status", "inactive")
            
            # Skip users with no active subscription (free tier)
            if subscription_tier == "free" and subscription_status == "inactive":
                continue
            
            # Calculate next renewal date
            current_period_end = user.get("subscription_current_period_end", "")
            cancel_at = user.get("subscription_cancel_at", "")
            
            # Determine if subscription is ongoing or will be cancelled
            end_date = cancel_at if cancel_at else current_period_end
            next_renewal = current_period_end if subscription_status == "active" and not cancel_at else None
            
            subscriptions.append({
                "user_id": user_id,
                "customer_name": user.get("name", "Unknown"),
                "customer_email": user.get("email", ""),
                "plan": subscription_tier,
                "interval": user.get("subscription_interval", ""),
                "status": subscription_status,
                "start_date": user.get("subscription_current_period_start", "") or user.get("created_at", ""),
                "end_date": end_date,
                "next_renewal": next_renewal,
                "lifetime_value": lifetime_value,
                "is_cancelled": bool(cancel_at),
                "stripe_customer_id": user.get("stripe_customer_id", ""),
                "stripe_subscription_id": user.get("stripe_subscription_id", "")
            })
        
        # Sort by start date, newest first
        subscriptions.sort(key=lambda x: x.get("start_date", ""), reverse=True)
        
        return {"subscriptions": subscriptions, "total": len(subscriptions)}
    except Exception as e:
        logging.error(f"Error fetching subscriptions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch subscriptions: {str(e)}")

# CMS Pages Endpoints
@api_router.get("/pages")
async def get_all_pages(athlete_id: str, search: str = "", status: str = "", index_status: str = ""):
    """Get all pages with optional filters (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Build query
        query = {}
        
        if search:
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"url_slug": {"$regex": search, "$options": "i"}}
            ]
        
        if status:
            query["status"] = status
        
        if index_status:
            query["index_status"] = index_status
        
        # Fetch pages
        pages = await db.pages.find(query, {"_id": 0}).sort("updated_at", -1).to_list(length=None)
        
        return {"pages": pages, "total": len(pages)}
    except Exception as e:
        logging.error(f"Error fetching pages: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch pages: {str(e)}")

@api_router.get("/pages/{page_id}")
async def get_page(page_id: str, athlete_id: str):
    """Get a single page by ID (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        page = await db.pages.find_one({"id": page_id}, {"_id": 0})
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        return page
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching page: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch page: {str(e)}")

@api_router.get("/pages/public/by-slug")
async def get_page_by_slug(slug: str):
    """Get a published page by URL slug (Public access, no auth required)"""
    try:
        # Normalize slug
        if not slug.startswith('/'):
            slug = f"/{slug}"
        
        # Find published page by url_slug
        page = await db.pages.find_one({
            "url_slug": slug,
            "status": "published"
        }, {"_id": 0})
        
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        return page
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching page by slug: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch page: {str(e)}")

@api_router.post("/pages")
async def create_page(athlete_id: str, page_data: PageCreate):
    """Create a new page (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Handle home page logic
        if page_data.is_home:
            # If setting as home page, set URL slug to "/"
            url_slug = "/"
            
            # Remove is_home flag from any other page
            await db.pages.update_many(
                {"is_home": True},
                {"$set": {"is_home": False}}
            )
            logging.info("Removed home page flag from existing pages")
        else:
            # Auto-generate URL slug from title if not provided
            if not page_data.url_slug:
                url_slug = page_data.title.lower().replace(" ", "-").replace("/", "")
                # Remove special characters
                url_slug = "".join(c for c in url_slug if c.isalnum() or c == "-")
            else:
                url_slug = page_data.url_slug
            
            # Ensure slug starts with /
            if not url_slug.startswith("/"):
                url_slug = "/" + url_slug
        
        # Check if URL slug already exists (except for home page being updated)
        existing = await db.pages.find_one({"url_slug": url_slug})
        if existing:
            raise HTTPException(status_code=400, detail=f"A page with URL slug '{url_slug}' already exists")
        
        # Create page object
        page_dict = page_data.model_dump(exclude_unset=True)
        page_dict["url_slug"] = url_slug
        page_dict["created_by"] = athlete_id
        page_dict["last_modified_by"] = athlete_id
        page_dict["id"] = str(uuid.uuid4())
        page_dict["created_at"] = datetime.now(timezone.utc).isoformat()
        page_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Serialize content_blocks if present (convert ContentBlock objects to dicts)
        if "content_blocks" in page_dict and page_dict["content_blocks"]:
            page_dict["content_blocks"] = [
                block if isinstance(block, dict) else block 
                for block in page_dict["content_blocks"]
            ]
        
        # Insert into database
        await db.pages.insert_one(page_dict)
        
        # Remove _id from response (not JSON serializable)
        if "_id" in page_dict:
            del page_dict["_id"]
        
        # Auto-update index.html if this is the home page and it's published
        if url_slug == "/" and page_dict.get("status") == "published":
            try:
                await auto_update_index_html(page_dict)
                logging.info(f"✅ Auto-updated index.html with new home page metadata")
            except Exception as html_error:
                logging.error(f"Failed to auto-update index.html: {html_error}")
                # Don't fail the page creation if HTML update fails
        
        logging.info(f"Page created: {page_dict['id']} by {athlete_id}")
        return {"message": "Page created successfully", "page": page_dict}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating page: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create page: {str(e)}")



# Helper function to auto-update index.html with page metadata
async def auto_update_index_html(page_data: dict):
    """
    Automatically update index.html with page metadata
    Called when home page is saved/published
    """
    try:
        # Extract metadata
        meta_title = page_data.get('meta_title') or page_data.get('title') or 'My Health Tracker'
        meta_description = page_data.get('meta_description') or 'Your personal AI Health & Fitness coach'
        og_image = page_data.get('og_image') or ''
        
        # Construct full image URL
        backend_url = os.environ.get('REACT_APP_BACKEND_URL', 'https://trainsmart-cms.emergent.host')
        if og_image and not og_image.startswith('http'):
            og_image = f"{backend_url}{og_image}"
        
        # Read current index.html
        index_path = "/app/frontend/public/index.html"
        
        if not os.path.exists(index_path):
            logging.warning(f"index.html not found at {index_path}")
            return
        
        with open(index_path, 'r', encoding='utf-8') as f:
            html = f.read()
        
        # Replace meta tags
        html = re.sub(r'<title>.*?</title>', f'<title>{meta_title}</title>', html)
        html = re.sub(r'<meta name="description" content=".*?"', f'<meta name="description" content="{meta_description}"', html)
        html = re.sub(r'<meta property="og:title" content=".*?"', f'<meta property="og:title" content="{meta_title}"', html)
        html = re.sub(r'<meta property="og:description" content=".*?"', f'<meta property="og:description" content="{meta_description}"', html)
        
        if og_image:
            html = re.sub(r'<meta property="og:image" content=".*?"', f'<meta property="og:image" content="{og_image}"', html)
            html = re.sub(r'<meta property="og:image:secure_url" content=".*?"', f'<meta property="og:image:secure_url" content="{og_image}"', html)
            html = re.sub(r'<meta name="twitter:image" content=".*?"', f'<meta name="twitter:image" content="{og_image}"', html)
        
        html = re.sub(r'<meta name="twitter:title" content=".*?"', f'<meta name="twitter:title" content="{meta_title}"', html)
        html = re.sub(r'<meta name="twitter:description" content=".*?"', f'<meta name="twitter:description" content="{meta_description}"', html)
        
        # Write updated index.html
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(html)
        
        logging.info(f"✅ index.html updated automatically with metadata: {meta_title}")
        
    except Exception as e:
        logging.error(f"Error in auto_update_index_html: {e}", exc_info=True)
        raise


@api_router.put("/pages/{page_id}")
async def update_page(page_id: str, athlete_id: str, page_data: PageUpdate):
    """Update a page (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Check if page exists
        existing = await db.pages.find_one({"id": page_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Page not found")
        
        # Build update data
        update_data = page_data.model_dump(exclude_unset=True)
        
        # Handle home page logic
        if "is_home" in update_data and update_data["is_home"]:
            # If setting as home page, set URL slug to "/"
            update_data["url_slug"] = "/"
            
            # Remove is_home flag from any other page
            await db.pages.update_many(
                {"is_home": True, "id": {"$ne": page_id}},
                {"$set": {"is_home": False}}
            )
            logging.info(f"Removed home page flag from other pages, set {page_id} as home")
        elif "is_home" in update_data and not update_data["is_home"]:
            # If removing home page status, ensure URL slug is not "/"
            current_slug = existing.get("url_slug", "")
            if current_slug == "/":
                # Generate a new slug from title
                title = update_data.get("title", existing.get("title", "page"))
                new_slug = "/" + title.lower().replace(" ", "-")
                new_slug = "".join(c for c in new_slug if c.isalnum() or c == "-" or c == "/")
                update_data["url_slug"] = new_slug
                logging.info(f"Changed URL slug from / to {new_slug} as page is no longer home")
        
        # If URL slug is being updated manually (and not by is_home logic), check for conflicts
        if "url_slug" in update_data and not update_data.get("is_home"):
            url_slug = update_data["url_slug"]
            if not url_slug.startswith("/"):
                url_slug = "/" + url_slug
                update_data["url_slug"] = url_slug
            
            # Check if another page has this slug
            conflict = await db.pages.find_one({"url_slug": url_slug, "id": {"$ne": page_id}})
            if conflict:
                raise HTTPException(status_code=400, detail=f"Another page with URL slug '{url_slug}' already exists")
        
        # Add metadata
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        update_data["last_modified_by"] = athlete_id
        
        # Update page
        await db.pages.update_one(
            {"id": page_id},
            {"$set": update_data}
        )
        
        # Fetch updated page
        updated_page = await db.pages.find_one({"id": page_id}, {"_id": 0})
        
        # Auto-update index.html if this is the home page
        if updated_page.get("url_slug") == "/" and updated_page.get("status") == "published":
            try:
                await auto_update_index_html(updated_page)
                logging.info(f"✅ Auto-updated index.html with home page metadata")
            except Exception as html_error:
                logging.error(f"Failed to auto-update index.html: {html_error}")
                # Don't fail the page update if HTML update fails
        
        logging.info(f"Page updated: {page_id} by {athlete_id}")
        return {"message": "Page updated successfully", "page": updated_page}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating page: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update page: {str(e)}")

@api_router.delete("/pages/{page_id}")
async def delete_page(page_id: str, athlete_id: str):
    """Delete a page (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Check if page exists
        existing = await db.pages.find_one({"id": page_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Page not found")
        
        # Delete page
        await db.pages.delete_one({"id": page_id})
        
        logging.info(f"Page deleted: {page_id} by {athlete_id}")
        return {"message": "Page deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting page: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete page: {str(e)}")

@api_router.post("/pages/{page_id}/upload-image")
async def upload_page_image(page_id: str, athlete_id: str, image_type: str, file: UploadFile = File(...)):
    """Upload thumbnail or OG image for a page (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Check file size (limit to 5MB)
        file_content = await file.read()
        if len(file_content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size must be less than 5MB")
        
        # Check if page exists
        page = await db.pages.find_one({"id": page_id})
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        # Process image
        try:
            image = Image.open(io.BytesIO(file_content))
            
            # Convert to RGB if needed
            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = background
            
            # Resize based on image type
            if image_type == "thumbnail":
                # Thumbnail: 3:2 ratio, max 600x400
                image.thumbnail((600, 400), Image.Resampling.LANCZOS)
            elif image_type == "og_image":
                # OG image: 1200x630 (recommended for social media)
                image.thumbnail((1200, 630), Image.Resampling.LANCZOS)
            
            # Save to file
            filename = f"{page_id}_{image_type}_{int(datetime.now(timezone.utc).timestamp())}.jpg"
            filepath = f"/app/backend/uploaded_images/pages/{filename}"
            
            image.save(filepath, format='JPEG', quality=85)
            
            # Store path with /api prefix for Kubernetes ingress routing
            image_path = f"/api/uploaded_images/pages/{filename}"
            
            # Update page
            update_field = "thumbnail" if image_type == "thumbnail" else "og_image"
            await db.pages.update_one(
                {"id": page_id},
                {"$set": {
                    update_field: image_path,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "last_modified_by": athlete_id
                }}
            )
            
            return {"success": True, "message": f"{image_type.title()} uploaded successfully", "path": image_path}
            
        except Exception as e:
            logging.error(f"Error processing image: {e}")
            raise HTTPException(status_code=400, detail="Invalid image file")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading page image: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

# Menu Management Endpoints
@api_router.get("/menus")
async def get_menus(athlete_id: str):
    """Get menu settings (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Get menus from system settings or return defaults
        settings = await db.system_settings.find_one({})
        
        if settings and "menus" in settings:
            return settings["menus"]
        
        # Return default menus if not configured
        default_menus = {
            "header_logged_out": [
                {"id": str(uuid.uuid4()), "label": "Home", "url": "/", "order": 0},
                {"id": str(uuid.uuid4()), "label": "Pricing", "url": "/pricing", "order": 1},
                {"id": str(uuid.uuid4()), "label": "Login", "url": "/login", "order": 2}
            ],
            "header_logged_in": [
                {"id": str(uuid.uuid4()), "label": "Dashboard", "url": "/dashboard", "order": 0},
                {"id": str(uuid.uuid4()), "label": "Account", "url": "/dashboard/account", "order": 1}
            ],
            "slideout_menu": [
                {"id": str(uuid.uuid4()), "label": "Home", "url": "/dashboard/home", "order": 0, "icon": "Home"},
                {"id": str(uuid.uuid4()), "label": "Coach Chat", "url": "/dashboard/coach", "order": 1, "icon": "MessageSquare"},
                {"id": str(uuid.uuid4()), "label": "", "url": "", "order": 2, "is_separator": True},
                {"id": str(uuid.uuid4()), "label": "Account", "url": "/dashboard/account", "order": 3, "icon": "User"}
            ]
        }
        
        return default_menus
    except Exception as e:
        logging.error(f"Error fetching menus: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch menus: {str(e)}")

@api_router.get("/menus/public")
async def get_menus_public():
    """Get menu settings (public endpoint)"""
    try:
        # Get menus from system settings or return defaults
        settings = await db.system_settings.find_one({})
        
        if settings and "menus" in settings:
            return settings["menus"]
        
        # Return default menus if not configured
        default_menus = {
            "header_logged_out": [
                {"id": str(uuid.uuid4()), "label": "Home", "url": "/", "order": 0},
                {"id": str(uuid.uuid4()), "label": "Pricing", "url": "/pricing", "order": 1},
                {"id": str(uuid.uuid4()), "label": "Login", "url": "/login", "order": 2}
            ],
            "header_logged_in": [
                {"id": str(uuid.uuid4()), "label": "Dashboard", "url": "/dashboard", "order": 0},
                {"id": str(uuid.uuid4()), "label": "Account", "url": "/dashboard/account", "order": 1}
            ],
            "slideout_menu": [
                {"id": str(uuid.uuid4()), "label": "Home", "url": "/dashboard/home", "order": 0, "icon": "Home"},
                {"id": str(uuid.uuid4()), "label": "Coach Chat", "url": "/dashboard/coach", "order": 1, "icon": "MessageSquare"},
                {"id": str(uuid.uuid4()), "label": "", "url": "", "order": 2, "is_separator": True},
                {"id": str(uuid.uuid4()), "label": "Account", "url": "/dashboard/account", "order": 3, "icon": "User"}
            ]
        }
        
        return default_menus
    except Exception as e:
        logging.error(f"Error fetching menus: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch menus: {str(e)}")

@api_router.put("/menus")
async def update_menus(athlete_id: str, menu_data: MenuSettings):
    """Update menu settings (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Convert Pydantic models to dict
        menus_dict = menu_data.model_dump()
        
        # Update or create system settings with menus
        await db.system_settings.update_one(
            {},
            {"$set": {"menus": menus_dict}},
            upsert=True
        )
        
        logging.info(f"Menus updated by {athlete_id}")
        return {"message": "Menus updated successfully", "menus": menus_dict}
    except Exception as e:
        logging.error(f"Error updating menus: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update menus: {str(e)}")

@api_router.post("/system/translate-menus")
async def translate_menus(athlete_id: str):
    """Translate all menu items into available languages using OpenAI (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Get OpenAI API key from system settings (same logic as get_global_openai_key)
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        
        if not settings:
            raise HTTPException(status_code=400, detail="System settings not found")
        
        # Check for key in advanced settings (new location)
        openai_key = settings.get("advanced", {}).get("openaiApiKey")
        
        # Fallback to old location for backwards compatibility
        if not openai_key:
            openai_key = settings.get("openaiApiKey")
        
        if not openai_key or not openai_key.strip():
            raise HTTPException(status_code=400, detail="OpenAI API key not configured in System Settings")
        
        openai_key = openai_key.strip()
        
        # Detect available languages from frontend locales folder
        locales_path = Path(__file__).parent.parent / "frontend" / "src" / "locales"
        available_languages = []
        language_names = {
            'no': 'Norwegian',
            'sv': 'Swedish', 
            'de': 'German',
            'fr': 'French'
        }
        
        if locales_path.exists():
            for file in locales_path.glob("*.json"):
                lang_code = file.stem
                if lang_code != 'en':  # Skip English (source language)
                    available_languages.append({
                        'code': lang_code,
                        'name': language_names.get(lang_code, lang_code.upper())
                    })
        
        if not available_languages:
            raise HTTPException(status_code=400, detail="No translation languages found")
        
        logging.info(f"Detected languages for translation: {[l['name'] for l in available_languages]}")
        
        # Get current menus
        settings = await db.system_settings.find_one({})
        if not settings or 'menus' not in settings:
            raise HTTPException(status_code=404, detail="No menus found to translate")
        
        menus = settings['menus']
        translated_count = 0
        
        # Initialize OpenAI client
        client = openai.OpenAI(api_key=openai_key)
        
        # Translate each menu type
        for menu_type in ['header_logged_in', 'header_logged_out', 'slideout_menu']:
            if menu_type not in menus:
                continue
                
            menu_items = menus[menu_type]
            
            for item in menu_items:
                # Skip if item has no label
                if 'label' not in item or not item['label']:
                    continue
                
                english_label = item['label']
                
                # Initialize translations dict if not exists
                if 'translations' not in item:
                    item['translations'] = {}
                
                # Translate to each language
                for lang in available_languages:
                    lang_code = lang['code']
                    lang_name = lang['name']
                    
                    try:
                        # Use OpenAI to translate
                        response = client.chat.completions.create(
                            model="gpt-4o-mini",
                            messages=[
                                {
                                    "role": "system",
                                    "content": f"You are a professional translator. Translate the given navigation menu item from English to {lang_name}. Return ONLY the translated text, nothing else. Keep it concise and appropriate for a navigation menu."
                                },
                                {
                                    "role": "user",
                                    "content": english_label
                                }
                            ],
                            temperature=0.3,
                            max_tokens=50
                        )
                        
                        translated_text = response.choices[0].message.content.strip()
                        item['translations'][lang_code] = translated_text
                        translated_count += 1
                        
                        logging.info(f"Translated '{english_label}' to {lang_name}: '{translated_text}'")
                        
                    except Exception as e:
                        logging.error(f"Error translating '{english_label}' to {lang_name}: {e}")
                        # Continue with other translations even if one fails
                        continue
        
        # Save updated menus back to database
        await db.system_settings.update_one(
            {},
            {"$set": {"menus": menus}},
            upsert=True
        )
        
        logging.info(f"Successfully translated {translated_count} menu items")
        
        return {
            "message": f"Successfully translated {translated_count} menu items",
            "languages": [l['name'] for l in available_languages],
            "translated_count": translated_count,
            "menus": menus
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error translating menus: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to translate menus: {str(e)}")

@api_router.post("/system/upload-seo-image")
async def upload_seo_image(athlete_id: str, image_type: str, file: UploadFile = File(...)):
    """Upload favicon or logo for SEO settings (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Check file size (limit to 2MB)
        file_content = await file.read()
        if len(file_content) > 2 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size must be less than 2MB")
        
        # Process image
        try:
            image = Image.open(io.BytesIO(file_content))
            
            # Keep transparency for PNG images (logos and favicons)
            # Only convert P mode (palette) to RGBA to preserve transparency
            if image.mode == 'P':
                image = image.convert('RGBA')
            elif image.mode not in ('RGB', 'RGBA'):
                # Convert other modes to RGBA to be safe
                image = image.convert('RGBA')
            
            # Resize based on image type
            if image_type == "favicon":
                # Favicon: 32x32 for browser compatibility
                image = image.resize((32, 32), Image.Resampling.LANCZOS)
            elif image_type == "logo":
                # Logo: max 200x200, maintain aspect ratio
                image.thumbnail((200, 200), Image.Resampling.LANCZOS)
            elif image_type == "og_image":
                # OG Image: 1200x630 (standard Open Graph size)
                image = image.resize((1200, 630), Image.Resampling.LANCZOS)
            
            # Create directory if it doesn't exist
            seo_dir = Path("/app/backend/uploaded_images/seo")
            seo_dir.mkdir(parents=True, exist_ok=True)
            
            # Save to file - always save as PNG to preserve transparency
            filename = f"{image_type}_{int(datetime.now(timezone.utc).timestamp())}.png"
            filepath = f"/app/backend/uploaded_images/seo/{filename}"
            
            # Save with transparency
            image.save(filepath, format='PNG', optimize=True)
            
            # Store path with /api prefix for Kubernetes ingress routing
            image_path = f"/api/uploaded_images/seo/{filename}"
            
            return {"success": True, "message": f"{image_type.title()} uploaded successfully", "path": image_path}
            
        except Exception as e:
            logging.error(f"Error processing SEO image: {e}")
            raise HTTPException(status_code=400, detail="Invalid image file")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading SEO image: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

@api_router.get("/system/settings")
async def get_system_settings(athlete_id: str):
    """Get system settings (Super Admin only)"""
    # Verify super admin
    await verify_super_admin(athlete_id)
    
    try:
        # Get settings from database
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        
        # Return default settings if none exist
        if not settings:
            return {
                "modules": {
                    "affiliateProgram": {
                        "enabled": True,
                        "expanded": True
                    },
                    "community": {
                        "enabled": True,
                        "expanded": True
                    }
                },
                "seo": {
                    "siteTitle": "",
                    "metaTitle": "",
                    "metaDescription": "",
                    "focusKeyword": "",
                    "faviconUrl": None
                },
                "plans": {
                    "free": {
                        "title": "Free",
                        "description": "Get started with basic features",
                        "features": ["Basic training plans", "30-day history", "Community access"]
                    },
                    "pro": {
                        "title": "Pro",
                        "description": "Advanced features for serious runners",
                        "features": ["Everything in Free", "Unlimited history", "AI coach chat", "Advanced analytics"]
                    },
                    "premium": {
                        "title": "Premium",
                        "description": "Complete running coaching experience",
                        "features": ["Everything in Pro", "Custom training plans", "Nutrition guidance", "Priority support"]
                    }
                },
                "advanced": {
                    "openaiApiKey": "",
                    "stripe": {
                        "live": {
                            "apiKey": "",
                            "webhookSecret": ""
                        },
                        "sandbox": {
                            "apiKey": "",
                            "webhookSecret": ""
                        }
                    }
                }
            }
        
        return settings
    except Exception as e:
        logging.error(f"Error getting system settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve system settings: {str(e)}")

@api_router.post("/system/settings")
async def save_system_settings(athlete_id: str, settings: dict):
    """Save system settings (Super Admin only)"""
    # Verify super admin
    await verify_super_admin(athlete_id)
    
    try:
        # Update or insert settings
        result = await db.system_settings.update_one(
            {"setting_type": "global"},
            {
                "$set": {
                    **settings,
                    "setting_type": "global",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "updated_by": athlete_id
                }
            },
            upsert=True
        )
        
        # Initialize SendGrid email service if credentials provided
        if settings.get("advanced", {}).get("sendgrid"):
            sendgrid_config = settings["advanced"]["sendgrid"]
            if sendgrid_config.get("apiKey") and sendgrid_config.get("senderEmail"):
                try:
                    initialize_email_service(
                        api_key=sendgrid_config["apiKey"],
                        sender_email=sendgrid_config["senderEmail"],
                        sender_name=sendgrid_config.get("senderName", "TrainSmart")
                    )
                    logging.info("SendGrid email service initialized successfully")
                except Exception as email_error:
                    logging.error(f"Failed to initialize email service: {email_error}")
        
        logging.info(f"System settings saved by {athlete_id}")
        return {"message": "Settings saved successfully", "modified": result.modified_count > 0}
    except Exception as e:
        logging.error(f"Error saving system settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save system settings: {str(e)}")

# =====================================================
# COOKIE MANAGEMENT - Google Consent Mode v2
# =====================================================

class DetectedCookie(BaseModel):
    """Model for detected cookies"""
    model_config = ConfigDict(protected_namespaces=())
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    domain: str
    category: str  # necessary, analytics, marketing, functional
    description: str = ""
    expiry: str = ""  # Cookie expiration info
    source: str  # frontend, backend, third-party
    detected_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CookieConsentTexts(BaseModel):
    """Customizable texts for cookie consent banner"""
    model_config = ConfigDict(protected_namespaces=())
    
    banner_title: str = "We value your privacy"
    banner_description: str = "We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking 'Accept All', you consent to our use of cookies."
    accept_all_button: str = "Accept All"
    reject_all_button: str = "Reject All"  
    customize_button: str = "Customize"
    save_preferences_button: str = "Save Preferences"
    cookie_policy_link: str = "/cookie-policy"
    cookie_policy_text: str = "Cookie Policy"
    necessary_title: str = "Necessary Cookies"
    necessary_description: str = "These cookies are essential for the website to function properly."
    analytics_title: str = "Analytics Cookies"
    analytics_description: str = "These cookies help us understand how visitors interact with our website."
    marketing_title: str = "Marketing Cookies"
    marketing_description: str = "These cookies are used to track visitors across websites for advertising purposes."
    functional_title: str = "Functional Cookies"
    functional_description: str = "These cookies enable enhanced functionality and personalization."

@api_router.post("/cookies/scan")
async def scan_cookies(athlete_id: str, request: Request):
    """Scan for cookies - frontend, backend, and third-party"""
    try:
        # Verify super admin
        await verify_super_admin(athlete_id)
        
        logging.info(f"=== COOKIE SCAN INITIATED by {athlete_id} ===")
        
        detected_cookies = []
        
        # 1. Scan Backend Cookies (from response headers)
        # Check for session cookies, auth cookies, etc.
        backend_cookies = [
            {
                "name": "session_token",
                "domain": request.headers.get("host", "app.domain.com"),
                "category": "necessary",
                "description": "Session authentication token",
                "expiry": "Session",
                "source": "backend"
            }
        ]
        
        # 2. Detect Third-Party Cookies from System Settings
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        
        if settings:
            # Google Tag Manager cookies
            if settings.get("advanced", {}).get("googleTagManager", {}).get("headCode"):
                detected_cookies.extend([
                    {
                        "name": "_ga",
                        "domain": ".domain.com",
                        "category": "analytics",
                        "description": "Google Analytics - Used to distinguish users",
                        "expiry": "2 years",
                        "source": "third-party"
                    },
                    {
                        "name": "_ga_*",
                        "domain": ".domain.com",
                        "category": "analytics",
                        "description": "Google Analytics - Used to persist session state",
                        "expiry": "2 years",
                        "source": "third-party"
                    },
                    {
                        "name": "_gid",
                        "domain": ".domain.com",
                        "category": "analytics",
                        "description": "Google Analytics - Used to distinguish users",
                        "expiry": "24 hours",
                        "source": "third-party"
                    },
                    {
                        "name": "_gat",
                        "domain": ".domain.com",
                        "category": "analytics",
                        "description": "Google Analytics - Used to throttle request rate",
                        "expiry": "1 minute",
                        "source": "third-party"
                    }
                ])
            
            # Microsoft Clarity cookies
            if settings.get("advanced", {}).get("microsoftClarity", {}).get("scriptCode"):
                detected_cookies.extend([
                    {
                        "name": "_clck",
                        "domain": ".domain.com",
                        "category": "analytics",
                        "description": "Microsoft Clarity - Persists the Clarity User ID",
                        "expiry": "1 year",
                        "source": "third-party"
                    },
                    {
                        "name": "_clsk",
                        "domain": ".domain.com",
                        "category": "analytics",
                        "description": "Microsoft Clarity - Connects multiple page views",
                        "expiry": "1 day",
                        "source": "third-party"
                    },
                    {
                        "name": "CLID",
                        "domain": ".clarity.ms",
                        "category": "analytics",
                        "description": "Microsoft Clarity - Identifies the first-time visitor",
                        "expiry": "1 year",
                        "source": "third-party"
                    }
                ])
            
            # Stripe cookies (if enabled)
            if settings.get("advanced", {}).get("stripe", {}).get("live", {}).get("apiKey"):
                detected_cookies.extend([
                    {
                        "name": "__stripe_mid",
                        "domain": ".stripe.com",
                        "category": "functional",
                        "description": "Stripe - Fraud prevention and detection",
                        "expiry": "1 year",
                        "source": "third-party"
                    },
                    {
                        "name": "__stripe_sid",
                        "domain": ".stripe.com",
                        "category": "functional",
                        "description": "Stripe - Fraud prevention and detection",
                        "expiry": "30 minutes",
                        "source": "third-party"
                    }
                ])
        
        # 3. Add common frontend cookies
        frontend_cookies = [
            {
                "name": "cookie_consent",
                "domain": request.headers.get("host", "app.domain.com"),
                "category": "necessary",
                "description": "Stores user's cookie consent preferences",
                "expiry": "1 year",
                "source": "frontend"
            },
            {
                "name": "auth_token",
                "domain": request.headers.get("host", "app.domain.com"),
                "category": "necessary",
                "description": "User authentication token",
                "expiry": "Session or 30 days",
                "source": "frontend"
            },
            {
                "name": "user_preferences",
                "domain": request.headers.get("host", "app.domain.com"),
                "category": "functional",
                "description": "Stores user interface preferences",
                "expiry": "1 year",
                "source": "frontend"
            }
        ]
        
        detected_cookies.extend(backend_cookies)
        detected_cookies.extend(frontend_cookies)
        
        # Convert to DetectedCookie models
        cookie_objects = []
        for cookie_data in detected_cookies:
            cookie_obj = DetectedCookie(**cookie_data)
            cookie_objects.append(cookie_obj.model_dump())
        
        # Store scan results in database
        scan_result = {
            "scan_id": str(uuid.uuid4()),
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "scanned_by": athlete_id,
            "cookies": cookie_objects,
            "total_count": len(cookie_objects)
        }
        
        await db.cookie_scans.insert_one(scan_result)
        
        # Update system settings with latest scan
        await db.system_settings.update_one(
            {"setting_type": "global"},
            {
                "$set": {
                    "cookies.last_scan": scan_result,
                    "cookies.updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        logging.info(f"Cookie scan completed: {len(cookie_objects)} cookies detected")
        
        return {
            "success": True,
            "scan_id": scan_result["scan_id"],
            "cookies": cookie_objects,
            "total_count": len(cookie_objects),
            "scanned_at": scan_result["scanned_at"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error scanning cookies: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to scan cookies: {str(e)}")

@api_router.get("/cookies/settings")
async def get_cookie_settings(athlete_id: str):
    """Get cookie management settings"""
    try:
        # Verify super admin
        await verify_super_admin(athlete_id)
        
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        
        if not settings or "cookies" not in settings:
            # Return default cookie settings
            default_texts = CookieConsentTexts()
            return {
                "enabled": False,
                "consent_mode": "gtm",  # gtm or gtag
                "auto_scan_enabled": True,
                "auto_scan_frequency": "weekly",  # weekly, monthly
                "last_scan": None,
                "detected_cookies": [],
                "consent_texts": default_texts.model_dump(),
                "gtm_integration": {
                    "enabled": True,
                    "container_id": ""
                }
            }
        
        cookie_settings = settings.get("cookies", {})
        
        # Ensure consent_texts has all fields
        if "consent_texts" not in cookie_settings:
            default_texts = CookieConsentTexts()
            cookie_settings["consent_texts"] = default_texts.model_dump()
        
        # Remove _id from last_scan if present (MongoDB ObjectId serialization issue)
        if "last_scan" in cookie_settings and cookie_settings["last_scan"]:
            if "_id" in cookie_settings["last_scan"]:
                del cookie_settings["last_scan"]["_id"]
        
        return cookie_settings
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting cookie settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get cookie settings: {str(e)}")

@api_router.post("/cookies/settings")
async def save_cookie_settings(athlete_id: str, settings: dict):
    """Save cookie management settings"""
    try:
        # Verify super admin
        await verify_super_admin(athlete_id)
        
        logging.info(f"Saving cookie settings by {athlete_id}")
        
        # Update system settings
        result = await db.system_settings.update_one(
            {"setting_type": "global"},
            {
                "$set": {
                    "cookies": {
                        **settings,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "updated_by": athlete_id
                    }
                }
            },
            upsert=True
        )
        
        logging.info("Cookie settings saved successfully")
        
        return {
            "success": True,
            "message": "Cookie settings saved successfully",
            "modified": result.modified_count > 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error saving cookie settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to save cookie settings: {str(e)}")

@api_router.get("/cookies/consent/public")
async def get_public_cookie_consent():
    """Get public cookie consent settings (no auth required)"""
    try:
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        
        if not settings or "cookies" not in settings:
            default_texts = CookieConsentTexts()
            return {
                "enabled": False,
                "consent_texts": default_texts.model_dump(),
                "detected_cookies": []
            }
        
        cookie_settings = settings.get("cookies", {})
        
        # Return only necessary info for frontend banner
        return {
            "enabled": cookie_settings.get("enabled", False),
            "consent_texts": cookie_settings.get("consent_texts", CookieConsentTexts().model_dump()),
            "detected_cookies": cookie_settings.get("last_scan", {}).get("cookies", []),
            "gtm_integration": cookie_settings.get("gtm_integration", {})
        }
        
    except Exception as e:
        logging.error(f"Error getting public cookie consent: {e}", exc_info=True)
        # Return defaults on error to not break the frontend
        default_texts = CookieConsentTexts()
        return {
            "enabled": False,
            "consent_texts": default_texts.model_dump(),
            "detected_cookies": []
        }

# Weekly auto-scan function for cookies
async def auto_scan_cookies():
    """Automatically scan for cookies weekly"""
    try:
        logging.info("=== AUTO COOKIE SCAN STARTED ===")
        
        # Get system settings to check if auto-scan is enabled
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        
        if not settings or not settings.get("cookies", {}).get("auto_scan_enabled", False):
            logging.info("Auto cookie scan is disabled")
            return
        
        # Get a super admin user to perform the scan
        super_admin = await db.athlete_profiles.find_one({"is_super_admin": True})
        
        if not super_admin:
            logging.warning("No super admin found for auto cookie scan")
            return
        
        athlete_id = super_admin.get("athlete_id")
        
        # Create a mock request object
        class MockRequest:
            def __init__(self):
                self.headers = {"host": "app.domain.com"}
        
        mock_request = MockRequest()
        
        # Perform the scan
        result = await scan_cookies(athlete_id, mock_request)
        
        logging.info(f"Auto cookie scan completed: {result.get('total_count', 0)} cookies detected")
        
    except Exception as e:
        logging.error(f"Error in auto cookie scan: {e}", exc_info=True)


@api_router.get("/system/subscriber-stats")
async def get_subscriber_stats(
    athlete_id: str, 
    period: str = "90d",  # Options: 7d, 30d, 90d, 1y, all
    compare: bool = False
):
    """Get subscriber statistics over time (Super Admin only)"""
    # Verify super admin
    await verify_super_admin(athlete_id)
    
    print(f"=== SUBSCRIBER STATS DEBUG: period={period}, compare={compare} ===", flush=True)
    
    try:
        from datetime import datetime, timedelta
        
        # Define period ranges
        period_days = {
            "7d": 7,
            "30d": 30,
            "90d": 90,
            "1y": 365,
            "all": None
        }
        
        days = period_days.get(period, 90)
        
        # Get all athletes
        athletes = await db.athletes.find(
            {},
            {"_id": 0, "created_at": 1, "subscription_tier": 1}
        ).to_list(length=None)
        
        print(f"Found {len(athletes)} total athletes", flush=True)
        
        # Calculate date ranges
        now = datetime.now()
        if days:
            current_period_start = now - timedelta(days=days)
            previous_period_start = current_period_start - timedelta(days=days)
        else:
            # For "all", use earliest subscriber date
            dates = [datetime.fromisoformat(a["created_at"].replace('Z', '+00:00')) 
                    for a in athletes if a.get("created_at")]
            if dates:
                current_period_start = min(dates)
                days = (now - current_period_start).days
                previous_period_start = current_period_start - timedelta(days=days)
            else:
                current_period_start = now - timedelta(days=90)
                previous_period_start = current_period_start - timedelta(days=90)
                days = 90
        
        # Filter athletes by period for accurate metrics
        period_athletes = []
        for athlete in athletes:
            if not athlete.get("created_at"):
                period_athletes.append(athlete)  # Include athletes without dates
                continue
            try:
                created_date = datetime.fromisoformat(athlete["created_at"].replace('Z', '+00:00'))
                # Include all athletes created up to now (cumulative)
                if created_date <= now:
                    period_athletes.append(athlete)
            except Exception:
                period_athletes.append(athlete)
        
        # Current period data (new subscribers in period)
        current_period_athletes = []
        previous_period_athletes = []
        
        for athlete in athletes:
            if not athlete.get("created_at"):
                continue
            try:
                created_date = datetime.fromisoformat(athlete["created_at"].replace('Z', '+00:00'))
                if created_date >= current_period_start:
                    current_period_athletes.append(athlete)
                elif compare and created_date >= previous_period_start and created_date < current_period_start:
                    previous_period_athletes.append(athlete)
            except Exception:
                continue
        
        # Current period counts (cumulative at end of period)
        tier_counts = {"free": 0, "pro": 0, "premium": 0}
        for athlete in period_athletes:
            tier = athlete.get("subscription_tier", "free")
            tier_counts[tier] = tier_counts.get(tier, 0) + 1
        
        total_subscribers = sum(tier_counts.values())
        paid_subscribers = tier_counts.get("pro", 0) + tier_counts.get("premium", 0)
        
        # Growth in current period
        growth_count = len(current_period_athletes)
        base_count = total_subscribers - growth_count
        growth_percentage = (growth_count / max(base_count, 1)) * 100 if base_count > 0 else 0
        
        # Create time series data for current period
        daily_counts = {}
        for athlete in athletes:
            created_at = athlete.get("created_at")
            if created_at:
                try:
                    date_obj = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    if date_obj >= current_period_start:
                        date_key = date_obj.strftime('%Y-%m-%d')
                        daily_counts[date_key] = daily_counts.get(date_key, 0) + 1
                except Exception:
                    continue
        
        # Create cumulative counts
        sorted_dates = sorted(daily_counts.keys())
        cumulative_data = []
        cumulative_total = total_subscribers - sum(daily_counts.values())
        
        for date in sorted_dates:
            cumulative_total += daily_counts[date]
            cumulative_data.append({
                "date": date,
                "count": cumulative_total
            })
        
        # If no data, provide default points
        if not cumulative_data:
            for i in range(min(days, 7), 0, -1):
                date = (now - timedelta(days=i)).strftime('%Y-%m-%d')
                cumulative_data.append({
                    "date": date,
                    "count": total_subscribers
                })
        
        result = {
            "total_subscribers": total_subscribers,
            "paid_subscribers": paid_subscribers,
            "free_subscribers": tier_counts.get("free", 0),
            "pro_subscribers": tier_counts.get("pro", 0),
            "premium_subscribers": tier_counts.get("premium", 0),
            "growth_count": growth_count,
            "growth_percentage": round(growth_percentage, 1),
            "time_series": cumulative_data,
            "period": period
        }
        
        # Calculate business metrics
        # Conversion rate: percentage of free users who became paid
        conversion_rate = (paid_subscribers / max(total_subscribers, 1)) * 100
        
        # Average Revenue Per User (ARPU) - assuming Pro = €9.99/mo, Premium = €19.99/mo
        pro_revenue = tier_counts.get("pro", 0) * 9.99
        premium_revenue = tier_counts.get("premium", 0) * 19.99
        total_revenue = pro_revenue + premium_revenue
        arpu = total_revenue / max(total_subscribers, 1)
        
        # Monthly Recurring Revenue (MRR)
        mrr = total_revenue
        
        # Annual Recurring Revenue (ARR)
        arr = mrr * 12
        
        # Customer Lifetime Value (LTV) - simplified: ARPU * avg customer lifetime (assume 24 months)
        avg_lifetime_months = 24
        ltv = arpu * avg_lifetime_months
        
        # Average Revenue Per Paid User (ARPPU)
        arppu = total_revenue / max(paid_subscribers, 1) if paid_subscribers > 0 else 0
        
        # Pro vs Premium ratio
        pro_percentage = (tier_counts.get("pro", 0) / max(paid_subscribers, 1)) * 100 if paid_subscribers > 0 else 0
        premium_percentage = (tier_counts.get("premium", 0) / max(paid_subscribers, 1)) * 100 if paid_subscribers > 0 else 0
        
        result["business_metrics"] = {
            "conversion_rate": round(conversion_rate, 2),
            "arpu": round(arpu, 2),
            "arppu": round(arppu, 2),
            "mrr": round(mrr, 2),
            "arr": round(arr, 2),
            "ltv": round(ltv, 2),
            "pro_percentage": round(pro_percentage, 1),
            "premium_percentage": round(premium_percentage, 1)
        }
        
        # Calculate community metrics
        # Get posts from the period
        posts_query = {}
        if days:
            posts_query["created_at"] = {"$gte": current_period_start.isoformat()}
        
        posts = await db.community_posts.find(posts_query).to_list(length=None)
        total_posts = len(posts)
        
        # Calculate engagement metrics
        total_likes = sum(post.get("likes_count", 0) for post in posts)
        total_comments = sum(post.get("comments_count", 0) for post in posts)
        
        # Get unique posters
        unique_posters = len(set(post.get("athlete_id") for post in posts if post.get("athlete_id")))
        
        # Calculate averages
        avg_likes_per_post = total_likes / max(total_posts, 1)
        avg_comments_per_post = total_comments / max(total_posts, 1)
        engagement_rate = (unique_posters / max(total_subscribers, 1)) * 100
        
        # Get top contributors (most posts)
        poster_counts = {}
        for post in posts:
            athlete_id = post.get("athlete_id")
            if athlete_id:
                poster_counts[athlete_id] = poster_counts.get(athlete_id, 0) + 1
        
        top_contributors = sorted(poster_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Calculate daily post distribution for time series
        daily_posts = {}
        for post in posts:
            created_at = post.get("created_at")
            if created_at:
                try:
                    if isinstance(created_at, str):
                        date_obj = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    else:
                        date_obj = created_at
                    date_key = date_obj.strftime('%Y-%m-%d')
                    daily_posts[date_key] = daily_posts.get(date_key, 0) + 1
                except Exception:
                    continue
        
        # Create time series for posts
        sorted_post_dates = sorted(daily_posts.keys())
        post_time_series = []
        for date in sorted_post_dates:
            post_time_series.append({
                "date": date,
                "count": daily_posts[date]
            })
        
        result["community_metrics"] = {
            "total_posts": total_posts,
            "total_likes": total_likes,
            "total_comments": total_comments,
            "unique_posters": unique_posters,
            "avg_likes_per_post": round(avg_likes_per_post, 1),
            "avg_comments_per_post": round(avg_comments_per_post, 1),
            "engagement_rate": round(engagement_rate, 2),
            "top_contributors_count": len(top_contributors),
            "post_time_series": post_time_series
        }
        
        # Calculate referral metrics
        # Get all referrals
        referrals_query = {}
        if days:
            # Convert current_period_start to datetime for comparison
            if isinstance(current_period_start, str):
                date_threshold = datetime.fromisoformat(current_period_start.replace('Z', '+00:00'))
            else:
                date_threshold = current_period_start
            referrals_query["created_at"] = {"$gte": date_threshold}
        
        referrals = await db.referrals.find(referrals_query).to_list(length=None)
        total_referrals = len(referrals)
        
        # Count successful referrals (where referred user signed up)
        successful_referrals = sum(1 for ref in referrals if ref.get("status") in ["converted", "rewarded"] or ref.get("referred_user_id"))
        
        # Calculate referral conversion rate
        referral_conversion_rate = (successful_referrals / max(total_referrals, 1)) * 100
        
        # Get unique referrers
        unique_referrers = len(set(ref.get("referrer_id") for ref in referrals if ref.get("referrer_id")))
        
        # Calculate total rewards distributed
        total_rewards = sum(ref.get("reward_amount", 0) for ref in referrals if ref.get("status") == "rewarded")
        
        # Get top referrers (most referrals)
        referrer_counts = {}
        for ref in referrals:
            referrer_id = ref.get("referrer_id")
            if referrer_id:
                referrer_counts[referrer_id] = referrer_counts.get(referrer_id, 0) + 1
        
        top_referrers = sorted(referrer_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        top_referrers_count = len(top_referrers)
        
        # Calculate average referrals per referrer
        avg_referrals_per_user = total_referrals / max(unique_referrers, 1)
        
        # Calculate referral participation rate (users who made at least 1 referral)
        referral_participation = (unique_referrers / max(total_subscribers, 1)) * 100
        
        # Daily referral distribution
        daily_referrals = {}
        for ref in referrals:
            created_at = ref.get("created_at")
            if created_at:
                try:
                    if isinstance(created_at, str):
                        date_obj = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    else:
                        date_obj = created_at
                    date_key = date_obj.strftime('%Y-%m-%d')
                    daily_referrals[date_key] = daily_referrals.get(date_key, 0) + 1
                except Exception:
                    continue
        
        result["referral_metrics"] = {
            "total_referrals": total_referrals,
            "successful_referrals": successful_referrals,
            "referral_conversion_rate": round(referral_conversion_rate, 1),
            "unique_referrers": unique_referrers,
            "total_rewards": round(total_rewards, 2),
            "avg_referrals_per_user": round(avg_referrals_per_user, 1),
            "referral_participation": round(referral_participation, 2),
            "top_referrers_count": top_referrers_count
        }
        
        # Add comparison data if requested
        if compare:
            previous_growth_count = len(previous_period_athletes)
            comparison_change = growth_count - previous_growth_count
            comparison_percentage = ((comparison_change / max(previous_growth_count, 1)) * 100) if previous_growth_count > 0 else 0
            
            result["comparison"] = {
                "previous_period_growth": previous_growth_count,
                "change": comparison_change,
                "change_percentage": round(comparison_percentage, 1)
            }
        
        return result
    except Exception as e:
        logging.error(f"Error getting subscriber stats: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ===========================
# COUPON MANAGEMENT ENDPOINTS
# ===========================

@api_router.post("/coupons")
async def create_coupon(coupon_data: dict, athlete_id: str):
    """Create a new coupon (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Normalize code to uppercase
        code = coupon_data.get("code", "").upper().strip()
        
        if not code:
            raise HTTPException(status_code=400, detail="Coupon code is required")
        
        # Check if coupon code already exists
        existing = await db.coupons.find_one({"code": code}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Coupon code already exists")
        
        # Validate required fields
        if not coupon_data.get("name"):
            raise HTTPException(status_code=400, detail="Coupon name is required")
        
        if not coupon_data.get("type") or coupon_data["type"] not in ["percentage", "fixed"]:
            raise HTTPException(status_code=400, detail="Invalid coupon type")
        
        value = coupon_data.get("value")
        if value is None:
            raise HTTPException(status_code=400, detail="Coupon value is required")
        
        # Validate coupon data
        if coupon_data["type"] == "percentage" and (value < 0 or value > 100):
            raise HTTPException(status_code=400, detail="Percentage must be between 0 and 100")
        
        if coupon_data["type"] == "fixed" and value <= 0:
            raise HTTPException(status_code=400, detail="Fixed amount must be greater than 0")
        
        # Create coupon object
        coupon = Coupon(
            code=code,
            name=coupon_data["name"],
            type=coupon_data["type"],
            value=value,
            currency=coupon_data.get("currency", "usd"),
            max_uses=coupon_data.get("max_uses"),
            enabled=coupon_data.get("enabled", True),
            expires_at=coupon_data.get("expires_at"),
            created_by=athlete_id,
            applies_to=coupon_data.get("applies_to", "all"),
            min_purchase_amount=coupon_data.get("min_purchase_amount")
        )
        
        # Insert coupon
        await db.coupons.insert_one(coupon.model_dump())
        
        logging.info(f"Coupon created: {coupon.code} by {athlete_id}")
        return {"message": "Coupon created successfully", "coupon": coupon.model_dump()}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating coupon: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/coupons")
async def list_coupons(athlete_id: str, include_disabled: bool = False):
    """List all coupons (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        query = {} if include_disabled else {"enabled": True}
        coupons = await db.coupons.find(query, {"_id": 0}).to_list(length=None)
        
        # Sort by created_at desc
        coupons.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return {"coupons": coupons}
    except Exception as e:
        logging.error(f"Error listing coupons: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/coupons/{code}")
async def update_coupon(code: str, updates: dict, athlete_id: str):
    """Update a coupon (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        code = code.upper().strip()
        
        # Don't allow changing the code itself
        if "code" in updates:
            del updates["code"]
        
        # Validate updates
        if "value" in updates:
            if updates.get("type", "") == "percentage" and (updates["value"] < 0 or updates["value"] > 100):
                raise HTTPException(status_code=400, detail="Percentage must be between 0 and 100")
            if updates.get("type", "") == "fixed" and updates["value"] <= 0:
                raise HTTPException(status_code=400, detail="Fixed amount must be greater than 0")
        
        result = await db.coupons.update_one(
            {"code": code},
            {"$set": updates}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Coupon not found")
        
        logging.info(f"Coupon updated: {code} by {athlete_id}")
        return {"message": "Coupon updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating coupon: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/coupons/{code}")
async def delete_coupon(code: str, athlete_id: str):
    """Delete a coupon (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        code = code.upper().strip()
        
        result = await db.coupons.delete_one({"code": code})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Coupon not found")
        
        logging.info(f"Coupon deleted: {code} by {athlete_id}")
        return {"message": "Coupon deleted successfully"}
    except Exception as e:
        logging.error(f"Error deleting coupon: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/coupons/validate")
async def validate_coupon(code: str, amount: float, purchase_type: str = "all", plan_id: str = None):
    """Validate a coupon code and return discount details (public endpoint)"""
    try:
        code = code.upper().strip()
        
        # Find coupon
        coupon = await db.coupons.find_one({"code": code}, {"_id": 0})
        
        if not coupon:
            raise HTTPException(status_code=404, detail="Invalid coupon code")
        
        # Check if enabled
        if not coupon.get("enabled", False):
            raise HTTPException(status_code=400, detail="This coupon is no longer valid")
        
        # Check expiration
        if coupon.get("expires_at"):
            expiry = datetime.fromisoformat(coupon["expires_at"]) if isinstance(coupon["expires_at"], str) else coupon["expires_at"]
            if datetime.now(timezone.utc) > expiry:
                raise HTTPException(status_code=400, detail="This coupon has expired")
        
        # Check usage limit
        if coupon.get("max_uses") is not None:
            if coupon.get("current_uses", 0) >= coupon["max_uses"]:
                raise HTTPException(status_code=400, detail="This coupon has reached its usage limit")
        
        # Check minimum purchase amount
        if coupon.get("min_purchase_amount") and amount < coupon["min_purchase_amount"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Minimum purchase amount of ${coupon['min_purchase_amount']:.2f} required"
            )
        
        # Check applies_to
        applies_to = coupon.get("applies_to", "all")
        if applies_to != "all" and applies_to != purchase_type:
            raise HTTPException(
                status_code=400, 
                detail=f"This coupon is only valid for {applies_to}"
            )
        
        # Check specific plans
        specific_plans = coupon.get("specific_plans")
        if specific_plans and plan_id:
            if plan_id not in specific_plans:
                raise HTTPException(
                    status_code=400,
                    detail=f"This coupon is not valid for the selected plan"
                )
        
        # Calculate discount
        if coupon["type"] == "percentage":
            discount_amount = (amount * coupon["value"]) / 100
        else:  # fixed
            discount_amount = min(coupon["value"], amount)  # Can't discount more than the amount
        
        final_amount = max(0, amount - discount_amount)
        
        return {
            "valid": True,
            "coupon": {
                "code": coupon["code"],
                "name": coupon.get("name", ""),
                "type": coupon["type"],
                "value": coupon["value"],
                "specific_plans": coupon.get("specific_plans")
            },
            "original_amount": amount,
            "discount_amount": round(discount_amount, 2),
            "final_amount": round(final_amount, 2)
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error validating coupon: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/coupons/{code}/usage")
async def get_coupon_usage(code: str, athlete_id: str):
    """Get usage statistics for a specific coupon (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        code = code.upper().strip()
        
        # Get coupon
        coupon = await db.coupons.find_one({"code": code}, {"_id": 0})
        if not coupon:
            raise HTTPException(status_code=404, detail="Coupon not found")
        
        # Get usage records
        usage_records = await db.coupon_usage.find(
            {"coupon_code": code}, 
            {"_id": 0}
        ).to_list(length=None)
        
        # Calculate stats
        total_uses = len(usage_records)
        total_discount_given = sum(r.get("discount_amount", 0) for r in usage_records)
        total_revenue = sum(r.get("final_amount", 0) for r in usage_records)
        
        return {
            "coupon": coupon,
            "usage_stats": {
                "total_uses": total_uses,
                "remaining_uses": None if coupon.get("max_uses") is None else max(0, coupon["max_uses"] - total_uses),
                "total_discount_given": round(total_discount_given, 2),
                "total_revenue": round(total_revenue, 2)
            },
            "recent_usage": usage_records[:10]  # Last 10 uses
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting coupon usage: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===========================
# SUBSCRIPTION PLAN MANAGEMENT
# ===========================

@api_router.get("/subscription-plans-public")
async def get_subscription_plans_public():
    """Get all active subscription plans with their variations (public endpoint)"""
    try:
        # Get all enabled plans (variations are embedded in the plans)
        plans = await db.subscription_plans.find(
            {"enabled": {"$ne": False}},
            {"_id": 0}
        ).sort("sort_order", 1).to_list(length=None)
        
        return {"plans": plans}
    except Exception as e:
        logging.error(f"Error getting public subscription plans: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/subscription-plans")
async def get_subscription_plans(athlete_id: str = None):
    """Get all subscription plans and their variations"""
    try:
        # Get plans from database (variations are now embedded in the plans)
        plans = await db.subscription_plans.find({"enabled": True}, {"_id": 0}).to_list(length=None)
        
        # Sort by sort_order
        plans.sort(key=lambda x: x.get("sort_order", 0))
        
        return {"plans": plans}
    except Exception as e:
        logging.error(f"Error getting subscription plans: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/subscription-plans/quick-setup")
async def quick_setup_plans(athlete_id: str):
    """Quick setup: Create standard 3-tier plan structure with Stripe (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Initialize Stripe
        stripe_api_key = os.environ.get("STRIPE_API_KEY")
        if not stripe_api_key:
            raise HTTPException(status_code=500, detail="Stripe API key not configured")
        
        stripe.api_key = stripe_api_key
        
        # Define standard 3-tier structure
        standard_plans = [
            {
                "tier": "free",
                "name": "Free",
                "description": "Get started with basic features",
                "features": [
                    "Basic training plans",
                    "30-day history",
                    "Community access",
                    "Basic analytics"
                ],
                "sort_order": 0,
                "variations": []  # Free plan has no paid variations
            },
            {
                "tier": "pro",
                "name": "Pro",
                "description": "Advanced features for serious athletes",
                "features": [
                    "Everything in Free",
                    "Unlimited history",
                    "AI coach chat",
                    "Advanced analytics",
                    "Custom training plans",
                    "Priority support"
                ],
                "sort_order": 1,
                "variations": [
                    {"plan_id": "pro_monthly", "name": "Pro Monthly", "price": 29.99, "interval": "month"},
                    {"plan_id": "pro_annual", "name": "Pro Annual", "price": 299.99, "interval": "year"}
                ]
            },
            {
                "tier": "premium",
                "name": "Premium",
                "description": "Complete coaching experience",
                "features": [
                    "Everything in Pro",
                    "Personalized nutrition plans",
                    "1-on-1 coaching sessions",
                    "Race strategy planning",
                    "Injury prevention programs",
                    "VIP community access"
                ],
                "sort_order": 2,
                "variations": [
                    {"plan_id": "premium_monthly", "name": "Premium Monthly", "price": 99.99, "interval": "month"},
                    {"plan_id": "premium_annual", "name": "Premium Annual", "price": 999.99, "interval": "year"}
                ]
            }
        ]
        
        created_plans = []
        created_variations = []
        
        for plan_template in standard_plans:
            # Check if plan already exists
            existing = await db.subscription_plans.find_one({"tier": plan_template["tier"]}, {"_id": 0})
            
            if existing:
                logging.info(f"Plan {plan_template['tier']} already exists, skipping")
                continue
            
            # Create Stripe product
            stripe_product = stripe.Product.create(
                name=plan_template["name"],
                description=plan_template["description"],
                metadata={"tier": plan_template["tier"]}
            )
            
            # Create plan in database
            plan = SubscriptionPlan(
                tier=plan_template["tier"],
                name=plan_template["name"],
                description=plan_template["description"],
                features=plan_template["features"],
                stripe_product_id=stripe_product.id,
                sort_order=plan_template["sort_order"]
            )
            
            await db.subscription_plans.insert_one(plan.model_dump())
            created_plans.append(plan_template["tier"])
            
            # Create variations if any
            for var_template in plan_template["variations"]:
                # Create Stripe price
                stripe_price = stripe.Price.create(
                    product=stripe_product.id,
                    unit_amount=int(var_template["price"] * 100),  # Convert to cents
                    currency="usd",
                    recurring={
                        "interval": var_template["interval"],
                        "interval_count": 1
                    }
                )
                
                # Create variation in database
                variation = SubscriptionPlanVariation(
                    plan_id=var_template["plan_id"],
                    name=var_template["name"],
                    price=var_template["price"],
                    interval=var_template["interval"],
                    interval_count=1,
                    stripe_price_id=stripe_price.id
                )
                
                await db.subscription_plan_variations.insert_one(variation.model_dump())
                created_variations.append(var_template["plan_id"])
        
        logging.info(f"Quick setup completed by {athlete_id}: {len(created_plans)} plans, {len(created_variations)} variations")
        return {
            "message": "Quick setup completed",
            "created_plans": created_plans,
            "created_variations": created_variations
        }
        
    except Exception as e:
        logging.error(f"Error in quick setup: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/subscription-plans")
async def create_subscription_plan(plan_data: dict, athlete_id: str):
    """Create a new subscription plan with Stripe integration (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Initialize Stripe
        stripe_api_key = os.environ.get("STRIPE_API_KEY")
        if not stripe_api_key:
            raise HTTPException(status_code=500, detail="Stripe API key not configured")
        
        stripe.api_key = stripe_api_key
        
        # Create Stripe product
        stripe_product = stripe.Product.create(
            name=plan_data["name"],
            description=plan_data.get("description", ""),
            metadata={"tier": plan_data["tier"]}
        )
        
        # Create plan in database
        plan = SubscriptionPlan(
            tier=plan_data["tier"],
            name=plan_data["name"],
            description=plan_data.get("description"),
            features=plan_data.get("features", []),
            stripe_product_id=stripe_product.id,
            sort_order=plan_data.get("sort_order", 0)
        )
        
        await db.subscription_plans.insert_one(plan.model_dump())
        
        logging.info(f"Subscription plan created: {plan.tier} by {athlete_id}")
        return {"message": "Plan created successfully", "plan": plan.model_dump()}
    except Exception as e:
        logging.error(f"Error creating subscription plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/subscription-plans/{tier}")
async def update_subscription_plan(tier: str, updates: dict, athlete_id: str):
    """Update a subscription plan (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Get current plan
        plan = await db.subscription_plans.find_one({"tier": tier}, {"_id": 0})
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        # Update Stripe product if needed
        if plan.get("stripe_product_id") and ("name" in updates or "description" in updates):
            stripe_api_key = os.environ.get("STRIPE_API_KEY")
            if stripe_api_key:
                stripe.api_key = stripe_api_key
                update_params = {}
                if "name" in updates:
                    update_params["name"] = updates["name"]
                if "description" in updates:
                    update_params["description"] = updates["description"]
                
                stripe.Product.modify(plan["stripe_product_id"], **update_params)
        
        # Update in database
        updates["updated_at"] = datetime.now(timezone.utc)
        
        logging.info(f"Updating plan {tier} with data: {updates}")
        
        result = await db.subscription_plans.update_one(
            {"tier": tier},
            {"$set": updates}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        # Verify the update
        updated_plan = await db.subscription_plans.find_one({"tier": tier}, {"_id": 0})
        logging.info(f"Plan after update: features={updated_plan.get('features')}")
        
        logging.info(f"Subscription plan updated: {tier} by {athlete_id}")
        return {"message": "Plan updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating subscription plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/subscription-plans/{tier}")
async def delete_subscription_plan(tier: str, athlete_id: str):
    """Delete a subscription plan (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Get plan
        plan = await db.subscription_plans.find_one({"tier": tier}, {"_id": 0})
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        # Archive Stripe product (don't delete to preserve history)
        if plan.get("stripe_product_id"):
            # Get Stripe settings from system_settings
            system_settings = await db.system_settings.find_one({}, {"_id": 0})
            if system_settings:
                stripe_settings = system_settings.get("advanced", {}).get("stripe", {})
                stripe_mode = stripe_settings.get("mode", "test")
                
                # Get the appropriate API key based on mode
                if stripe_mode == "live":
                    stripe_api_key = stripe_settings.get("live", {}).get("apiKey") or stripe_settings.get("live", {}).get("secretKey")
                else:
                    stripe_api_key = stripe_settings.get("sandbox", {}).get("apiKey") or stripe_settings.get("sandbox", {}).get("secretKey")
                
                if stripe_api_key:
                    stripe.api_key = stripe_api_key
                    try:
                        stripe.Product.modify(plan["stripe_product_id"], active=False)
                    except Exception as e:
                        logging.error(f"Error archiving Stripe product: {e}")
        
        # Delete variations
        await db.subscription_plan_variations.delete_many({"plan_id": {"$regex": f"^{tier}_"}})
        
        # Delete plan
        result = await db.subscription_plans.delete_one({"tier": tier})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        logging.info(f"Subscription plan deleted: {tier} by {athlete_id}")
        return {"message": "Plan deleted successfully"}
    except Exception as e:
        logging.error(f"Error deleting subscription plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/subscription-plans/{tier}/variations")
async def create_plan_variation(tier: str, variation_data: dict, athlete_id: str):
    """Create a plan variation (pricing tier) with Stripe price (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Get parent plan
        plan = await db.subscription_plans.find_one({"tier": tier}, {"_id": 0})
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        # Initialize Stripe only if product ID exists
        stripe_price_id = None
        
        if plan.get("stripe_product_id"):
            # Get Stripe settings from system_settings
            system_settings = await db.system_settings.find_one({}, {"_id": 0})
            stripe_settings = system_settings.get("advanced", {}).get("stripe", {}) if system_settings else {}
            stripe_mode = stripe_settings.get("mode", "test")
            
            # Get the appropriate API key
            if stripe_mode == "live":
                stripe_api_key = stripe_settings.get("live", {}).get("apiKey") or stripe_settings.get("live", {}).get("secretKey")
            else:
                stripe_api_key = stripe_settings.get("sandbox", {}).get("apiKey") or stripe_settings.get("sandbox", {}).get("secretKey")
            
            if stripe_api_key:
                try:
                    stripe.api_key = stripe_api_key
                    
                    # Create Stripe price
                    stripe_price = stripe.Price.create(
                        product=plan["stripe_product_id"],
                        unit_amount=int(variation_data["price"] * 100),  # Convert to cents
                        currency=variation_data.get("currency", "eur").lower(),
                        recurring={
                            "interval": variation_data["interval"],
                            "interval_count": variation_data.get("interval_count", 1)
                        },
                        metadata={
                            "plan_id": variation_data["plan_id"],
                            "tier": tier
                        }
                    )
                    stripe_price_id = stripe_price.id
                    logging.info(f"Stripe price created: {stripe_price_id}")
                except Exception as e:
                    logging.warning(f"Failed to create Stripe price: {e}. Variation will be saved without Stripe price ID.")
            else:
                logging.warning(f"No Stripe API key configured. Variation will be saved without Stripe price ID.")
        else:
            logging.warning(f"Plan {tier} has no Stripe product ID. Variation will be saved without Stripe price ID.")
        
        # Add variation to the plan's variations array
        import uuid
        variation_id = str(uuid.uuid4())
        
        new_variation = {
            "id": variation_id,
            "interval": variation_data["interval"],
            "price": variation_data["price"],
            "currency": variation_data.get("currency", "EUR"),
            "stripe_price_id": stripe_price_id
        }
        
        # Add to plan's variations
        await db.subscription_plans.update_one(
            {"tier": tier},
            {"$push": {"variations": new_variation}}
        )
        
        logging.info(f"Plan variation created for {tier} by {athlete_id}")
        return {
            "message": "Variation created successfully" + (" (without Stripe sync - run 'Sync to Stripe' to create price)" if not stripe_price_id else ""),
            "variation": new_variation
        }
    except Exception as e:
        logging.error(f"Error creating plan variation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/subscription-plans/variations/{variation_id}")
async def update_plan_variation(variation_id: str, updates: dict, athlete_id: str):
    """Update a plan variation (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Find the plan containing this variation
        plan = await db.subscription_plans.find_one(
            {"variations.id": variation_id},
            {"_id": 0}
        )
        
        if not plan:
            raise HTTPException(status_code=404, detail="Variation not found")
        
        # Find the variation in the plan
        variation = None
        for var in plan.get("variations", []):
            if var.get("id") == variation_id:
                variation = var
                break
        
        if not variation:
            raise HTTPException(status_code=404, detail="Variation not found")
        
        # Update the variation in the array
        update_fields = {}
        for key, value in updates.items():
            update_fields[f"variations.$.{key}"] = value
        
        result = await db.subscription_plans.update_one(
            {"variations.id": variation_id},
            {"$set": update_fields}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Variation not found")
        
        logging.info(f"Plan variation updated: {variation_id} by {athlete_id}")
        return {"message": "Variation updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating plan variation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/subscription-plans/variations/{variation_id}")
async def delete_plan_variation(variation_id: str, athlete_id: str):
    """Delete a plan variation (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Find the plan containing this variation
        plan = await db.subscription_plans.find_one(
            {"variations.id": variation_id},
            {"_id": 0}
        )
        
        if not plan:
            raise HTTPException(status_code=404, detail="Variation not found")
        
        # Remove the variation from the array
        result = await db.subscription_plans.update_one(
            {"variations.id": variation_id},
            {"$pull": {"variations": {"id": variation_id}}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Variation not found or already deleted")
        
        logging.info(f"Plan variation deleted: {variation_id} by {athlete_id}")
        return {"message": "Variation deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting plan variation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/subscription-plans/sync-stripe")
async def sync_stripe_plans(athlete_id: str):
    """Fetch and sync all Stripe products and prices with database (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Initialize Stripe
        stripe_api_key = os.environ.get("STRIPE_API_KEY")
        if not stripe_api_key:
            raise HTTPException(status_code=500, detail="Stripe API key not configured")
        
        stripe.api_key = stripe_api_key
        
        sync_stats = {
            "products_synced": 0,
            "products_created": 0,
            "products_updated": 0,
            "prices_synced": 0,
            "prices_created": 0,
            "prices_updated": 0,
            "errors": []
        }
        
        # Fetch all active Stripe products
        stripe_products = stripe.Product.list(active=True, limit=100)
        
        for stripe_product in stripe_products.data:
            try:
                # Check if product exists in our database
                existing_plan = await db.subscription_plans.find_one(
                    {"stripe_product_id": stripe_product.id},
                    {"_id": 0}
                )
                
                # Extract tier from metadata or generate one
                tier = stripe_product.metadata.get("tier", stripe_product.id.replace("prod_", "").lower())
                
                if existing_plan:
                    # Update existing plan
                    await db.subscription_plans.update_one(
                        {"stripe_product_id": stripe_product.id},
                        {"$set": {
                            "name": stripe_product.name,
                            "description": stripe_product.description or "",
                            "updated_at": datetime.now(timezone.utc)
                        }}
                    )
                    sync_stats["products_updated"] += 1
                else:
                    # Create new plan
                    new_plan = SubscriptionPlan(
                        tier=tier,
                        name=stripe_product.name,
                        description=stripe_product.description or "",
                        features=[],
                        stripe_product_id=stripe_product.id,
                        sort_order=sync_stats["products_created"]
                    )
                    await db.subscription_plans.insert_one(new_plan.model_dump())
                    sync_stats["products_created"] += 1
                
                sync_stats["products_synced"] += 1
                
            except Exception as e:
                sync_stats["errors"].append(f"Product {stripe_product.id}: {str(e)}")
                logging.error(f"Error syncing product {stripe_product.id}: {e}")
        
        # Fetch all active Stripe prices
        stripe_prices = stripe.Price.list(active=True, limit=100)
        
        for stripe_price in stripe_prices.data:
            try:
                # Get the product this price belongs to
                product_id = stripe_price.product
                
                # Check if the product exists in our database
                plan = await db.subscription_plans.find_one(
                    {"stripe_product_id": product_id},
                    {"_id": 0}
                )
                
                if not plan:
                    # Skip prices for products we don't have
                    continue
                
                # Check if price exists in our database
                existing_variation = await db.subscription_plan_variations.find_one(
                    {"stripe_price_id": stripe_price.id},
                    {"_id": 0}
                )
                
                # Generate plan_id (e.g., "pro_monthly", "pro_annual")
                interval = stripe_price.recurring.get("interval") if stripe_price.recurring else "one_time"
                interval_count = stripe_price.recurring.get("interval_count", 1) if stripe_price.recurring else 1
                plan_id_suffix = f"{interval}" if interval_count == 1 else f"{interval_count}_{interval}"
                plan_id = f"{plan['tier']}_{plan_id_suffix}"
                
                # Convert price from cents to dollars
                price_amount = stripe_price.unit_amount / 100.0 if stripe_price.unit_amount else 0
                
                if existing_variation:
                    # Update existing variation
                    await db.subscription_plan_variations.update_one(
                        {"stripe_price_id": stripe_price.id},
                        {"$set": {
                            "price": price_amount,
                            "updated_at": datetime.now(timezone.utc)
                        }}
                    )
                    sync_stats["prices_updated"] += 1
                else:
                    # Create new variation
                    new_variation = SubscriptionPlanVariation(
                        plan_id=plan_id,
                        name=f"{plan['name']} {interval.capitalize()}",
                        price=price_amount,
                        interval=interval,
                        interval_count=interval_count,
                        stripe_price_id=stripe_price.id
                    )
                    await db.subscription_plan_variations.insert_one(new_variation.model_dump())
                    sync_stats["prices_created"] += 1
                
                sync_stats["prices_synced"] += 1
                
            except Exception as e:
                sync_stats["errors"].append(f"Price {stripe_price.id}: {str(e)}")
                logging.error(f"Error syncing price {stripe_price.id}: {e}")
        
        logging.info(f"Stripe sync completed by {athlete_id}: {sync_stats}")
        return {
            "message": "Stripe sync completed",
            "stats": sync_stats
        }
        
    except Exception as e:
        logging.error(f"Error syncing with Stripe: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/subscription-plans/push-to-stripe")
async def push_plans_to_stripe(athlete_id: str):
    """Push local subscription plans to Stripe (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Get Stripe settings from system_settings
        system_settings = await db.system_settings.find_one({}, {"_id": 0})
        if not system_settings:
            raise HTTPException(status_code=500, detail="System settings not found")
        
        stripe_settings = system_settings.get("advanced", {}).get("stripe", {})
        stripe_mode = stripe_settings.get("mode", "test")
        
        # Get the appropriate API key
        if stripe_mode == "live":
            stripe_api_key = stripe_settings.get("live", {}).get("apiKey") or stripe_settings.get("live", {}).get("secretKey")
        else:
            stripe_api_key = stripe_settings.get("sandbox", {}).get("apiKey") or stripe_settings.get("sandbox", {}).get("secretKey")
        
        if not stripe_api_key:
            raise HTTPException(status_code=500, detail=f"Stripe API key not configured for {stripe_mode} mode")
        
        stripe.api_key = stripe_api_key
        
        push_stats = {
            "products_created": 0,
            "prices_created": 0,
            "plans_updated": 0,
            "errors": []
        }
        
        # Get all local subscription plans
        plans = await db.subscription_plans.find({}, {"_id": 0}).to_list(length=None)
        
        if not plans:
            return {
                "message": "No plans found to push",
                "stats": push_stats
            }
        
        for plan in plans:
            try:
                tier = plan.get("tier")
                plan_id = plan.get("id")
                variations = plan.get("variations", [])
                
                # Check if this plan already has a Stripe product ID
                stripe_product_id = plan.get("stripe_product_id")
                
                if not stripe_product_id:
                    # Create Stripe product
                    stripe_product = stripe.Product.create(
                        name=plan.get("name", tier.capitalize()),
                        description=plan.get("description", ""),
                        active=True,  # Make sure product is active
                        metadata={
                            "tier": tier,
                            "plan_id": plan_id
                        }
                    )
                    
                    stripe_product_id = stripe_product.id
                    push_stats["products_created"] += 1
                    
                    # Update plan with Stripe product ID
                    await db.subscription_plans.update_one(
                        {"id": plan_id},
                        {"$set": {"stripe_product_id": stripe_product_id}}
                    )
                    
                    push_stats["plans_updated"] += 1
                else:
                    # Product already exists, make sure it's active
                    try:
                        stripe.Product.modify(stripe_product_id, active=True)
                        logging.info(f"Plan {tier} product activated: {stripe_product_id}")
                    except Exception as e:
                        logging.warning(f"Could not activate product {stripe_product_id}: {e}")
                
                # Create prices for each variation
                if not variations:
                    push_stats["errors"].append(f"Plan '{tier}' has no variations. Add monthly/yearly pricing first.")
                    logging.warning(f"Plan {tier} has no variations to create prices for")
                else:
                    for variation in variations:
                        try:
                            # Skip if already has Stripe price ID
                            if variation.get("stripe_price_id"):
                                logging.info(f"Variation {variation.get('interval')} for {tier} already has Stripe price ID: {variation.get('stripe_price_id')}")
                                continue
                            
                            interval = variation.get("interval", "month")
                            price_amount = variation.get("price", 0)
                            
                            # Convert to cents for Stripe
                            price_in_cents = int(price_amount * 100)
                            
                            # Create Stripe price
                            stripe_price = stripe.Price.create(
                                product=stripe_product_id,
                                unit_amount=price_in_cents,
                                currency=variation.get("currency", "eur").lower(),
                                active=True,  # Make sure price is active
                                recurring={
                                    "interval": interval,
                                    "interval_count": 1
                                },
                                metadata={
                                    "tier": tier,
                                    "interval": interval,
                                    "variation_id": variation.get("id", "")
                                }
                            )
                            
                            push_stats["prices_created"] += 1
                            
                            # Update variation with Stripe price ID
                            await db.subscription_plans.update_one(
                                {"id": plan_id, "variations.id": variation.get("id")},
                                {"$set": {"variations.$.stripe_price_id": stripe_price.id}}
                            )
                            
                        except Exception as e:
                            error_msg = f"Variation {variation.get('interval')} for {tier}: {str(e)}"
                            push_stats["errors"].append(error_msg)
                            logging.error(error_msg)
                
            except Exception as e:
                error_msg = f"Plan {plan.get('tier')}: {str(e)}"
                push_stats["errors"].append(error_msg)
                logging.error(error_msg)
        
        logging.info(f"Push to Stripe completed by {athlete_id}: {push_stats}")
        return {
            "message": "Push to Stripe completed",
            "stats": push_stats
        }
        
    except Exception as e:
        logging.error(f"Error pushing to Stripe: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/subscription-plans/reset-stripe-ids")
async def reset_stripe_ids(athlete_id: str):
    """Reset all Stripe IDs from subscription plans (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Get all plans
        plans = await db.subscription_plans.find({}, {"_id": 0}).to_list(length=None)
        
        if not plans:
            return {
                "message": "No plans found",
                "plans_updated": 0
            }
        
        plans_updated = 0
        
        # Remove stripe_product_id from all plans
        result = await db.subscription_plans.update_many(
            {},
            {
                "$unset": {"stripe_product_id": ""}
            }
        )
        plans_updated = result.modified_count
        
        # Remove stripe_price_id from all variations
        for plan in plans:
            variations = plan.get("variations", [])
            if variations:
                # Update each variation to remove stripe_price_id
                for variation in variations:
                    await db.subscription_plans.update_one(
                        {"id": plan.get("id"), "variations.id": variation.get("id")},
                        {"$unset": {"variations.$.stripe_price_id": ""}}
                    )
        
        logging.info(f"Stripe IDs reset by {athlete_id}: {plans_updated} plans affected")
        return {
            "message": "All Stripe IDs have been reset. You can now sync to a new Stripe account.",
            "plans_updated": plans_updated
        }
        
    except Exception as e:
        logging.error(f"Error resetting Stripe IDs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Waiting List Endpoints
@api_router.post("/waiting-list")
async def add_to_waiting_list(entry_data: dict):
    """Add entry to waiting list (public endpoint, no auth required)"""
    try:
        # Validate required fields
        if not entry_data.get("name") or not entry_data.get("email") or not entry_data.get("nationality"):
            raise HTTPException(status_code=400, detail="Name, email, and nationality are required")
        
        # Check if email already exists
        existing = await db.waiting_list.find_one(
            {"email": entry_data["email"].lower().strip()},
            {"_id": 0}
        )
        
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered in waiting list")
        
        # Create entry
        entry = WaitingListEntry(
            name=entry_data["name"].strip(),
            email=entry_data["email"].lower().strip(),
            nationality=entry_data["nationality"].strip(),
            source=entry_data.get("source", "homepage"),
            notes=entry_data.get("notes")
        )
        
        await db.waiting_list.insert_one(entry.model_dump())
        
        logging.info(f"Waiting list entry added: {entry.email}")
        return {
            "message": "Successfully added to waiting list",
            "id": entry.id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error adding to waiting list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/waiting-list")
async def get_waiting_list(
    athlete_id: str,
    status: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    """Get waiting list entries (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Build query
        query = {}
        if status:
            query["status"] = status
        
        # Get entries
        entries = await db.waiting_list.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=None)
        
        # Get total count
        total_count = await db.waiting_list.count_documents(query)
        
        return {
            "entries": entries,
            "total": total_count,
            "limit": limit,
            "skip": skip
        }
        
    except Exception as e:
        logging.error(f"Error getting waiting list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/waiting-list/export")
async def export_waiting_list_csv(athlete_id: str, status: Optional[str] = None):
    """Export waiting list to CSV (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Build query
        query = {}
        if status:
            query["status"] = status
        
        # Get all entries
        entries = await db.waiting_list.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).to_list(length=None)
        
        # Create CSV content
        csv_lines = []
        csv_lines.append("Name,Email,Nationality,Status,Source,Created At,Notes")
        
        for entry in entries:
            name = entry.get("name", "").replace(",", ";")
            email = entry.get("email", "")
            nationality = entry.get("nationality", "").replace(",", ";")
            status = entry.get("status", "pending")
            source = entry.get("source", "homepage")
            created_at = entry.get("created_at", "")
            if isinstance(created_at, datetime):
                created_at = created_at.isoformat()
            notes = entry.get("notes", "").replace(",", ";") if entry.get("notes") else ""
            
            csv_lines.append(f"{name},{email},{nationality},{status},{source},{created_at},{notes}")
        
        csv_content = "\n".join(csv_lines)
        
        from fastapi.responses import Response
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=waiting-list-{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
            }
        )
        
    except Exception as e:
        logging.error(f"Error exporting waiting list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/waiting-list/{entry_id}")
async def update_waiting_list_entry(entry_id: str, updates: dict, athlete_id: str):
    """Update waiting list entry (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Check if entry exists
        entry = await db.waiting_list.find_one({"id": entry_id}, {"_id": 0})
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        # Update entry
        update_data = {}
        if "status" in updates:
            update_data["status"] = updates["status"]
        if "notes" in updates:
            update_data["notes"] = updates["notes"]
        
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        await db.waiting_list.update_one(
            {"id": entry_id},
            {"$set": update_data}
        )
        
        logging.info(f"Waiting list entry updated: {entry_id} by {athlete_id}")
        return {"message": "Entry updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating waiting list entry: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/waiting-list/{entry_id}")
async def delete_waiting_list_entry(entry_id: str, athlete_id: str):
    """Delete waiting list entry (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        result = await db.waiting_list.delete_one({"id": entry_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        logging.info(f"Waiting list entry deleted: {entry_id} by {athlete_id}")
        return {"message": "Entry deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting waiting list entry: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Function to read and modify the React index.html with SEO meta tags
async def get_html_with_seo_tags(slug: str, backend_url: str):
    """Read React index.html and inject SEO meta tags"""
    try:
        # Read the React build index.html
        index_path = Path("/app/frontend/build/index.html")
        if not index_path.exists():
            # Fallback to public index.html during development
            index_path = Path("/app/frontend/public/index.html")
        
        with open(index_path, 'r') as f:
            html_content = f.read()
        
        # Fetch page data from database
        page = await db.pages.find_one({
            "url_slug": slug,
            "status": "published"
        }, {"_id": 0})
        
        if page:
            title = page.get('meta_title') or page.get('title', '')
            description = page.get('meta_description', '')
            og_image = page.get('og_image', '')
            
            # Construct full OG image URL
            og_image_url = f"{backend_url}{og_image}" if og_image and not og_image.startswith('http') else og_image
            
            # Build meta tags
            meta_tags = f"""
    <title>{title}</title>
    <meta name="description" content="{description}" />
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="{title}" />
    <meta property="og:description" content="{description}" />
    <meta property="og:type" content="website" />"""
            
            if og_image_url:
                meta_tags += f"""
    <meta property="og:image" content="{og_image_url}" />
    <meta property="og:image:secure_url" content="{og_image_url}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />"""
            
            meta_tags += f"""
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{title}" />
    <meta name="twitter:description" content="{description}" />"""
            
            if og_image_url:
                meta_tags += f"""
    <meta name="twitter:image" content="{og_image_url}" />"""
            
            # Replace the title and inject meta tags into head
            html_content = html_content.replace('<title>Loading...</title>', meta_tags)
        
        return html_content
        
    except Exception as e:
        logging.error(f"Error generating HTML with SEO: {e}")
        # Return original HTML if error
        with open(index_path, 'r') as f:
            return f.read()

app.include_router(api_router)


# =====================================================
# DYNAMIC OG METADATA API - For Pre-rendering / SSR
# =====================================================

@api_router.get("/pages/meta-html/{page_id}")
async def get_page_meta_html(page_id: str):
    """
    Get HTML snippet with OG meta tags for a specific page
    Useful for pre-rendering services or SSR implementations
    """
    try:
        # Fetch page from database
        page = await db.pages.find_one({"id": page_id}, {"_id": 0})
        
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")
        
        # Extract metadata
        meta_title = page.get('meta_title') or page.get('title') or 'My Health Tracker'
        meta_description = page.get('meta_description') or 'Your personal AI Health & Fitness coach'
        og_image = page.get('og_image') or ''
        
        # Construct full image URL
        backend_url = os.environ.get('REACT_APP_BACKEND_URL', 'https://trainsmart-cms.emergent.host')
        if og_image:
            if og_image.startswith('http'):
                full_image_url = og_image
            else:
                full_image_url = f"{backend_url}{og_image}"
        else:
            full_image_url = f"{backend_url}/static/default-og-image.jpg"
        
        # Generate meta tags HTML
        meta_html = f'''
        <!-- SEO Meta Tags -->
        <title>{meta_title}</title>
        <meta name="description" content="{meta_description}" />
        
        <!-- Open Graph Meta Tags -->
        <meta property="og:title" content="{meta_title}" />
        <meta property="og:description" content="{meta_description}" />
        <meta property="og:image" content="{full_image_url}" />
        <meta property="og:image:secure_url" content="{full_image_url}" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:type" content="website" />
        
        <!-- Twitter Card Meta Tags -->
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="{meta_title}" />
        <meta name="twitter:description" content="{meta_description}" />
        <meta name="twitter:image" content="{full_image_url}" />
        '''
        
        return {
            "success": True,
            "page_id": page_id,
            "meta_html": meta_html,
            "meta_title": meta_title,
            "meta_description": meta_description,
            "og_image": full_image_url
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error generating meta HTML: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate meta HTML")

@api_router.post("/pages/update-index-html")
async def update_index_html_meta(athlete_id: str):
    """
    Update index.html with current home page metadata
    Super admin only - updates the default OG tags in index.html
    """
    try:
        # Verify super admin
        await verify_super_admin(athlete_id)
        
        # Find home page (slug "/")
        home_page = await db.pages.find_one({"url_slug": "/", "status": "published"}, {"_id": 0})
        
        if not home_page:
            raise HTTPException(status_code=404, detail="Home page not found")
        
        # Extract metadata
        meta_title = home_page.get('meta_title') or home_page.get('title') or 'My Health Tracker'
        meta_description = home_page.get('meta_description') or 'Your personal AI Health & Fitness coach'
        og_image = home_page.get('og_image') or ''
        
        # Construct full image URL
        backend_url = os.environ.get('REACT_APP_BACKEND_URL', 'https://trainsmart-cms.emergent.host')
        if og_image and not og_image.startswith('http'):
            og_image = f"{backend_url}{og_image}"
        
        # Read current index.html
        index_path = "/app/frontend/public/index.html"
        
        if not os.path.exists(index_path):
            raise HTTPException(status_code=500, detail="index.html not found")
        
        with open(index_path, 'r', encoding='utf-8') as f:
            html = f.read()
        
        # Replace meta tags
        html = re.sub(r'<title>.*?</title>', f'<title>{meta_title}</title>', html)
        html = re.sub(r'<meta name="description" content=".*?"', f'<meta name="description" content="{meta_description}"', html)
        html = re.sub(r'<meta property="og:title" content=".*?"', f'<meta property="og:title" content="{meta_title}"', html)
        html = re.sub(r'<meta property="og:description" content=".*?"', f'<meta property="og:description" content="{meta_description}"', html)
        
        if og_image:
            html = re.sub(r'<meta property="og:image" content=".*?"', f'<meta property="og:image" content="{og_image}"', html)
            html = re.sub(r'<meta property="og:image:secure_url" content=".*?"', f'<meta property="og:image:secure_url" content="{og_image}"', html)
            html = re.sub(r'<meta name="twitter:image" content=".*?"', f'<meta name="twitter:image" content="{og_image}"', html)
        
        html = re.sub(r'<meta name="twitter:title" content=".*?"', f'<meta name="twitter:title" content="{meta_title}"', html)
        html = re.sub(r'<meta name="twitter:description" content=".*?"', f'<meta name="twitter:description" content="{meta_description}"', html)
        
        # Write updated index.html
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(html)
        
        logging.info(f"✅ Updated index.html with home page metadata by {athlete_id}")
        
        return {
            "success": True,
            "message": "index.html updated with home page metadata",
            "meta_title": meta_title,
            "meta_description": meta_description,
            "og_image": og_image
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating index.html: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update index.html")


# ============================================================================
# STRAVA INTEGRATION ENDPOINTS
# ============================================================================

@api_router.get("/auth/strava")
async def strava_auth_start(user_id: str):
    """
    Initiate Strava OAuth flow
    Returns authorization URL for user to visit
    """
    try:
        strava_service = StravaService(db)
        auth_data = await strava_service.get_authorization_url(user_id)
        
        # Return the authorization URL - frontend will redirect user
        return {
            'authUrl': auth_data['url'],
            'state': auth_data['state']
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error starting Strava auth: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/auth/strava/callback")
async def strava_auth_callback_redirect(
    code: str = Query(...),
    state: str = Query(...),
    scope: Optional[str] = Query(None)
):
    """
    Handle Strava OAuth callback
    Exchange code for tokens and store connection
    """
    try:
        print(f"🔷 [STRAVA CALLBACK START] code={code[:10]}..., state={state[:20]}..., scope={scope}")
        logging.info(f"[STRAVA CALLBACK] Received: code={code[:10]}..., state={state[:20]}..., scope={scope}")
        
        # Extract user_id from state or session
        # For now, we'll need to store user_id in the oauth_state collection
        strava_service = StravaService(db)
        
        # Find the OAuth state to get user_id
        oauth_state = await db.strava_oauth_state.find_one({'state': state})
        if not oauth_state:
            logging.error(f"OAuth state not found for state: {state}")
            raise HTTPException(status_code=400, detail="Invalid OAuth state")
        
        user_id = oauth_state['user_id']
        logging.info(f"Found user_id from OAuth state: {user_id}")
        
        # Exchange code for tokens
        logging.info(f"Attempting to exchange code for tokens...")
        result = await strava_service.exchange_code_for_tokens(code, state, user_id)
        logging.info(f"Successfully exchanged code for tokens")
        
        # Redirect back to frontend with success
        await strava_service.load_settings()
        frontend_url = f"https://{strava_service.system_settings['callbackDomain']}/dashboard/account?tab=integrations&strava=connected"
        logging.info(f"Redirecting to: {frontend_url}")
        return RedirectResponse(url=frontend_url)
        
    except HTTPException as he:
        logging.error(f"HTTPException in Strava callback: status={he.status_code}, detail={he.detail}", exc_info=True)
        # Redirect to frontend with error
        try:
            await strava_service.load_settings()
            frontend_url = f"https://{strava_service.system_settings['callbackDomain']}/dashboard/account?tab=integrations&strava=error"
        except:
            frontend_url = "/dashboard/account?tab=integrations&strava=error"
        return RedirectResponse(url=frontend_url)
    except Exception as e:
        logging.error(f"Unexpected error in Strava callback: {type(e).__name__}: {str(e)}", exc_info=True)
        # Redirect to frontend with error - try to get callback domain
        try:
            settings_doc = await db.system_settings.find_one({"setting_type": "global"})
            if settings_doc and "advanced" in settings_doc and "strava" in settings_doc["advanced"]:
                callback_domain = settings_doc["advanced"]["strava"].get("callbackDomain", "trainsmart-ui.preview.emergentagent.com")
                frontend_url = f"https://{callback_domain}/dashboard/account?tab=integrations&strava=error"
                return RedirectResponse(url=frontend_url)
        except:
            pass
        return RedirectResponse(url="/dashboard/account?tab=integrations&strava=error")


@api_router.post("/auth/strava/disconnect")
async def strava_disconnect(request: Request):
    """
    Disconnect Strava integration
    Revokes tokens and removes connection
    """
    try:
        data = await request.json()
        user_id = data.get('user_id')
        
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id required")
        
        strava_service = StravaService(db)
        result = await strava_service.disconnect(user_id)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error disconnecting Strava: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/auth/strava/status")
async def strava_connection_status(user_id: str):
    """
    Get current Strava connection status
    """
    try:
        strava_service = StravaService(db)
        status = await strava_service.get_connection_status(user_id)
        
        if status is None:
            return {'connected': False}
        
        return status
        
    except Exception as e:
        logging.error(f"Error checking Strava status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/strava/activities")
async def fetch_strava_activities(
    user_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=200)
):
    """
    Fetch activities from Strava
    """
    try:
        strava_service = StravaService(db)
        activities = await strava_service.fetch_athlete_activities(user_id, page, per_page)
        
        return {
            'activities': activities,
            'page': page,
            'per_page': per_page
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching Strava activities: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/strava/sync")
async def sync_strava_activities(request: Request):
    """
    Sync activities from Strava to database
    """
    try:
        data = await request.json()
        user_id = data.get('user_id')
        
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id required")
        
        strava_service = StravaService(db)
        result = await strava_service.sync_activities(user_id)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error syncing Strava activities: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# STRAVA WEBHOOKS
# ============================================================================

@app.get("/api/webhook/strava")
async def strava_webhook_verify(request: Request):
    """
    Verify webhook subscription (Strava's challenge)
    """
    try:
        params = request.query_params
        mode = params.get('hub.mode')
        token = params.get('hub.verify_token')
        challenge = params.get('hub.challenge')
        
        # Load verify token from system settings
        settings = await db.system_settings.find_one({})
        if not settings or 'advanced' not in settings or 'strava' not in settings['advanced']:
            raise HTTPException(status_code=400, detail="Strava not configured")
        
        verify_token = settings['advanced']['strava'].get('webhookVerifyToken')
        
        if mode == 'subscribe' and token == verify_token:
            logging.info(f"Strava webhook verified with challenge: {challenge}")
            return {'hub.challenge': challenge}
        
        raise HTTPException(status_code=403, detail="Verification failed")
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error verifying Strava webhook: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/webhook/strava")
async def strava_webhook_event(request: Request):
    """
    Handle Strava webhook events
    """
    try:
        event = await request.json()
        logging.info(f"Received Strava webhook event: {event}")
        
        # Event structure:
        # {
        #   "aspect_type": "create|update|delete",
        #   "event_time": timestamp,
        #   "object_id": activity_id,
        #   "object_type": "activity|athlete",
        #   "owner_id": athlete_id,
        #   "subscription_id": subscription_id
        # }
        
        aspect_type = event.get('aspect_type')
        object_type = event.get('object_type')
        object_id = event.get('object_id')
        owner_id = event.get('owner_id')
        
        # Find user by athlete_id
        connection = await db.strava_connections.find_one({'athlete_id': owner_id})
        if not connection:
            logging.warning(f"No connection found for athlete {owner_id}")
            return {'received': True}
        
        user_id = connection['user_id']
        
        if object_type == 'activity':
            if aspect_type in ['create', 'update']:
                # Fetch full activity details
                strava_service = StravaService(db)
                token = await strava_service.get_valid_token(user_id)
                
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"https://www.strava.com/api/v3/activities/{object_id}",
                        headers={'Authorization': f'Bearer {token}'}
                    )
                    
                    if response.status_code == 200:
                        activity = response.json()
                        
                        # Store/update in database
                        await db.strava_activities.update_one(
                            {'activity_id': object_id, 'user_id': user_id},
                            {
                                '$set': {
                                    'activity_id': activity['id'],
                                    'user_id': user_id,
                                    'athlete_id': owner_id,
                                    'name': activity['name'],
                                    'type': activity['type'],
                                    'sport_type': activity.get('sport_type'),
                                    'distance': activity.get('distance'),
                                    'moving_time': activity.get('moving_time'),
                                    'elapsed_time': activity.get('elapsed_time'),
                                    'total_elevation_gain': activity.get('total_elevation_gain'),
                                    'start_date': datetime.fromisoformat(activity['start_date'].replace('Z', '+00:00')),
                                    'start_date_local': datetime.fromisoformat(activity['start_date_local']),
                                    'average_speed': activity.get('average_speed'),
                                    'max_speed': activity.get('max_speed'),
                                    'average_heartrate': activity.get('average_heartrate'),
                                    'max_heartrate': activity.get('max_heartrate'),
                                    'calories': activity.get('calories'),
                                    'raw_data': activity,
                                    'synced_at': datetime.now(timezone.utc)
                                }
                            },
                            upsert=True
                        )
                        logging.info(f"Activity {object_id} {aspect_type}d for user {user_id}")
                    
            elif aspect_type == 'delete':
                # Remove from database
                await db.strava_activities.delete_one({
                    'activity_id': object_id,
                    'user_id': user_id
                })
                logging.info(f"Activity {object_id} deleted for user {user_id}")
        
        elif object_type == 'athlete' and aspect_type == 'update':
            # Handle deauthorization
            if event.get('updates', {}).get('authorized') == 'false':
                await db.strava_connections.delete_one({'user_id': user_id})
                logging.info(f"User {user_id} deauthorized Strava")
        
        return {'received': True}
        
    except Exception as e:
        logging.error(f"Error handling Strava webhook: {e}", exc_info=True)
        # Return 200 to prevent Strava from retrying
        return {'received': True, 'error': str(e)}


@app.post("/api/strava/webhook/create")
async def create_strava_webhook():
    """
    Create a new webhook subscription (admin only)
    """
    try:
        # Get callback URL from settings
        settings = await db.system_settings.find_one({})
        if not settings or 'advanced' not in settings or 'strava' not in settings['advanced']:
            raise HTTPException(status_code=400, detail="Strava not configured")
        
        callback_domain = settings['advanced']['strava'].get('callbackDomain')
        if not callback_domain:
            raise HTTPException(status_code=400, detail="Callback domain not configured")
        
        callback_url = f"https://{callback_domain}/api/webhook/strava"
        
        strava_service = StravaService(db)
        subscription = await strava_service.create_webhook_subscription(callback_url)
        
        return subscription
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating Strava webhook: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/strava/webhook/list")
async def list_strava_webhooks():
    """
    List active webhook subscriptions
    """
    try:
        strava_service = StravaService(db)
        subscriptions = await strava_service.list_webhook_subscriptions()
        
        return {'subscriptions': subscriptions}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error listing Strava webhooks: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/strava/webhook/{subscription_id}")
async def delete_strava_webhook(subscription_id: int):
    """
    Delete a webhook subscription
    """
    try:
        strava_service = StravaService(db)
        result = await strava_service.delete_webhook_subscription(subscription_id)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting Strava webhook: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    scheduler.shutdown()
    logging.info("Scheduler shutdown")

@app.get("/api/schedules/debug/trigger")
async def debug_trigger_schedules():
    """Debug endpoint to manually trigger schedule checking"""
    await check_and_execute_schedules()
    return {"message": "Schedule check triggered"}

# Catch-all route for React app with SEO support - MUST BE LAST
@app.get("/{full_path:path}", response_class=HTMLResponse)
async def serve_react_app(full_path: str, request: Request):
    """Serve React app with SEO meta tags for main routes"""
    
    # Exclude API routes and static files
    if full_path.startswith('api/') or full_path.startswith('api') or full_path.startswith('uploaded_images'):
        raise HTTPException(status_code=404, detail="Not found")
    
    # List of routes that should get SEO treatment
    seo_routes = ['', 'pricing', 'privacy', 'terms']
    
    # Normalize the path
    path = f"/{full_path}" if full_path else '/'
    
    # Check if this is a route that needs SEO
    if full_path in seo_routes:
        try:
            backend_url = os.environ.get('REACT_APP_BACKEND_URL', str(request.base_url).rstrip('/'))
            html_content = await get_html_with_seo_tags(path, backend_url)
            return HTMLResponse(content=html_content)
        except Exception as e:
            logging.error(f"Error serving page with SEO: {e}")
    
    # For other routes or if SEO fails, serve the default React index.html
    index_path = Path("/app/frontend/build/index.html")
    if not index_path.exists():
        index_path = Path("/app/frontend/public/index.html")
    
    with open(index_path, 'r') as f:
        html_content = f.read()
    
    return HTMLResponse(content=html_content)



