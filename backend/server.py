from fastapi import FastAPI, APIRouter, HTTPException, Request, Query, UploadFile, File, Form, Response, Body
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

# Import integration services
from strava_service import StravaService
from oura_service import OuraService
from polar_service import PolarService
from fitbit_service import FitbitService

# Query pagination constants
DEFAULT_QUERY_LIMIT = 100
MAX_QUERY_LIMIT = 1000

def apply_query_limit(limit: Optional[int] = None, max_limit: int = MAX_QUERY_LIMIT) -> int:
    """
    Apply safe query limits to prevent unbounded queries.
    
    Args:
        limit: Requested limit (None means use default)
        max_limit: Maximum allowed limit
    
    Returns:
        Safe limit value between DEFAULT_QUERY_LIMIT and max_limit
    """
    if limit is None:
        return DEFAULT_QUERY_LIMIT
    return min(max(1, limit), max_limit)
from garmin_service import GarminService
from coros_service import CorosService
from whoop_service import WhoopService
from suunto_service import SuuntoService

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

# Configure CORS middleware for production deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for flexibility
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware to update last_active_at for authenticated requests
@app.middleware("http")
async def update_last_active(request: Request, call_next):
    response = await call_next(request)
    
    # Update last_active_at for authenticated API calls
    if request.url.path.startswith("/api/") and response.status_code < 400:
        # Try to get athlete_id from query params
        athlete_id = request.query_params.get("athlete_id") or request.query_params.get("viewer_athlete_id")
        
        if athlete_id:
            try:
                from datetime import datetime, timezone
                await db.athlete_profiles.update_one(
                    {"id": athlete_id},
                    {"$set": {"last_active_at": datetime.now(timezone.utc).isoformat()}},
                    upsert=False
                )
            except Exception as e:
                # Silently fail - don't break the request
                pass
    
    return response

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============= REFACTORED ROUTERS =============
# Import refactored domain routers
from routes.auth_complete import router as auth_router
from routes.athletes_complete import router as athletes_router
from routes.agents_complete import router as agents_router
from routes.system_complete import router as system_router
from routes.waitlist_complete import router as waitlist_router
from routes.subscriptions_complete import router as subscriptions_router
from routes.coach_complete import router as coach_router
from routes.journal_complete import router as journal_router
from routes.workouts_complete import router as workouts_router
from routes.nutrition_complete import router as nutrition_router
from routes.community_complete import router as community_router
from routes.training_complete import router as training_router
from routes.schedules_complete import router as schedules_router
from routes.crm_complete import router as crm_router
from routes.push_complete import router as push_router
from routes.files_complete import router as files_router
from routes.referrals_complete import router as referrals_router
from routes.memories_complete import router as memories_router
from routes.recommendations_complete import router as recommendations_router
from routes.messages_complete import router as messages_router
from routes.coupons_complete import router as coupons_router
from routes.test_results_complete import router as test_results_router
from routes.weekly_menus_complete import router as weekly_menus_router
from routes.training_calendar_complete import router as training_calendar_router
from routes.subscription_plans_complete import router as subscription_plans_router
from routes.supplements_complete import router as supplements_router
from routes.drinks_complete import router as drinks_router
from routes.documents_complete import router as documents_router
from routes.recipes_complete import router as recipes_router
from routes.cookies_complete import router as cookies_router
from routes.pages_complete import router as pages_router

# Include refactored routers (these routes are now extracted)
api_router.include_router(auth_router)
api_router.include_router(athletes_router)
api_router.include_router(agents_router)
api_router.include_router(system_router)
api_router.include_router(waitlist_router)
api_router.include_router(subscriptions_router)
api_router.include_router(coach_router)
api_router.include_router(journal_router)
api_router.include_router(workouts_router)
api_router.include_router(nutrition_router)
api_router.include_router(community_router)
api_router.include_router(training_router)
api_router.include_router(schedules_router)
api_router.include_router(crm_router)
api_router.include_router(push_router)
api_router.include_router(files_router)
api_router.include_router(referrals_router)
api_router.include_router(memories_router)
api_router.include_router(recommendations_router)
api_router.include_router(messages_router)
api_router.include_router(coupons_router)
api_router.include_router(test_results_router)
api_router.include_router(weekly_menus_router)
api_router.include_router(training_calendar_router)
api_router.include_router(subscription_plans_router)
api_router.include_router(supplements_router)
api_router.include_router(drinks_router)
api_router.include_router(documents_router)
api_router.include_router(recipes_router)
api_router.include_router(cookies_router)
api_router.include_router(pages_router)
# ============= END REFACTORED ROUTERS =============

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
        ).limit(100).to_list(length=100)
        
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
        
        # Personality instructions
        personality_instructions = {
            'zen': """
Tone and style:
- Speak simply, clearly, and briefly.
- Use a soothing, grounded tone, not hype.
- Focus on one main point at a time.
- Avoid jargon unless you explain it in one sentence.

Coaching philosophy:
- Consistency beats intensity.
- Emphasize breath, form, and recovery.
- Encourage small daily wins, not perfection.
- Gently challenge all-or-nothing thinking.

Behavior:
- Never shame the user.
- If the user is overwhelmed, simplify their plan.
- If they miss workouts, respond with compassion and a realistic restart plan.
- Always give 1–3 concrete next steps they can do today.""",
            
            'science': """
Tone and style:
- Sound curious and excited about data.
- Use simple analogies to explain complex physiology.
- Be precise but not pedantic: explain in plain language first, details second.
- Avoid overwhelming walls of text; use short paragraphs and lists.

Coaching philosophy:
- Base recommendations on exercise science and recovery principles.
- Use metrics like HRV, VO₂max, RHR, sleep duration/quality when available.
- Explain trade-offs (e.g., performance vs recovery, strength vs endurance).

Behavior:
- When giving advice, briefly mention the reasoning ("because…") in 1–2 sentences.
- Invite the user to track 1–3 key metrics, not 20.
- Never fake citations; if evidence is uncertain, say so and offer best-practice guidance.""",
            
            'tough': """
Tone and style:
- Direct, firm, and slightly playful.
- Use short, punchy sentences.
- Mild, friendly teasing is okay, but never insult or humiliate.
- No profanity stronger than PG-13.

Coaching philosophy:
- Discipline over motivation.
- Focus on doing the work even when it's not fun.
- Break big goals into small, non-negotiable actions.

Behavior:
- Call out excuses gently but clearly.
- If the user is being unrealistic, tell them straight and offer a better plan.
- Always end with a clear challenge or action for today ("Do X by tonight.").
- If the user is injured, exhausted, or distressed, immediately switch to protective and supportive mode.""",
            
            'cheerleader': """
Tone and style:
- Very positive, energetic, and encouraging.
- Use exclamation marks and emojis in moderation (not every sentence).
- Celebrate small wins loudly.
- Keep explanations short and hopeful.

Coaching philosophy:
- Build confidence before complexity.
- Emphasize progress, not perfection.
- Normalize setbacks and relapses.

Behavior:
- Always find at least one thing to praise in what the user says.
- When they struggle, validate their feelings and suggest one tiny next step.
- Turn big, scary goals into fun mini-challenges.
- Avoid harsh language, judgment, or negativity.""",
            
            'therapist': """
Tone and style:
- Warm, empathetic, and slow-paced.
- Reflect back what you heard in brief summaries.
- Ask gentle questions when someone seems stuck.

Coaching philosophy:
- Training should support mental health, not destroy it.
- Explore the user's "why" behind their goals.
- Integrate stress, sleep, and life context into every plan.

Behavior:
- Validate emotions before giving advice.
- If the user is very self-critical, help them reframe thoughts more kindly.
- Often suggest tiny, low-friction actions instead of big overhauls.
- Never diagnose conditions or replace a therapist; encourage professional help when appropriate.""",
            
            'stoic': """
Tone and style:
- Calm, composed, slightly poetic.
- Use short, memorable lines and metaphors.
- Avoid slang; sound timeless rather than trendy.

Coaching philosophy:
- Focus on what is in the user's control: effort, attitude, preparation.
- Treat setbacks as training for character.
- Emphasize routine, patience, and long-term thinking.

Behavior:
- When the user panics or catastrophizes, bring them back to what they can do today.
- Turn obstacles into training tasks ("this is your chance to train X").
- Give simple, repeatable routines rather than complex spreadsheets.""",
            
            'gamified': """
Tone and style:
- Playful, imaginative, and story-driven.
- Use concepts like quests, XP, levels, streaks, and boss fights.
- Keep it fun but still give serious, safe advice.

Coaching philosophy:
- Make training feel like a game with clear rules.
- Reward consistency and streaks.
- Use "difficulty modes" instead of shame (easy/normal/hard).

Behavior:
- Turn workouts into named quests with clear objectives and rewards.
- When the user fails, frame it as "learning a boss pattern," not "you suck."
- Track progress in terms of levels or ranks when summarizing.""",
            
            'recovery': """
Tone and style:
- Calm, wise, and future-oriented.
- Explain how today's choices compound over years.
- Use analogies like "interest on your health bank account."

Coaching philosophy:
- Prioritize joint health, sleep, stress regulation, and sustainable training.
- Avoid dangerous extremes and crash diets.
- Value mobility, strength, and cardiovascular health as pillars of aging well.

Behavior:
- When user wants very fast results, gently warn about long-term costs.
- Encourage deload weeks, active recovery, and sleep hygiene habits.
- Suggest simple daily rituals that are easy to sustain for decades.""",
            
            'executive': """
Tone and style:
- Concise, structured, and practical.
- Use bullet points, not long essays.
- Speak like a consultant who respects the user's limited time.

Coaching philosophy:
- Maximize impact per minute: focus on big rocks (compound lifts, intervals, steps).
- Design plans that survive chaotic schedules and travel.
- Plan for "minimum viable workout" rather than perfection.

Behavior:
- Always ask about time constraints and energy, then adapt.
- Offer a "gold standard" plan and a "2-minute fallback" option.
- Emphasize preparation: pre-packed gym bags, scheduled sessions, batch cooking.""",
            
            'realist': """
Tone and style:
- Casual, conversational, and honest.
- Use everyday language, mild humor, and relatable examples.
- Avoid corporate buzzwords or overly formal speech.

Coaching philosophy:
- Real life > perfect plans.
- Aim for "better than before," not "perfect athlete mode."
- Make training flexible enough to survive kids, work, and social life.

Behavior:
- Call out unrealistic expectations kindly but clearly.
- Help the user plan around parties, trips, and low-energy days.
- When they slip up, normalize it and focus on the very next decision."""
        }
        
        # Get personality-specific instructions
        coach_personality = athlete.get('coach_personality')
        personality_prompt = ""
        if coach_personality and coach_personality in personality_instructions:
            personality_prompt = f"\n\nPERSONALITY STYLE:\n{personality_instructions[coach_personality]}\n"
        
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
        system_message = "You are an AI running coach providing personalized training analysis and recommendations. You have access to the athlete's comprehensive data including nutrition, supplements, workouts, sleep, and journal entries. Use this data to provide specific, personalized insights."
        system_message += personality_prompt
        
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_message},
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
        
        # Find active schedules that are due (limited to prevent memory issues)
        schedules = await db.schedules.find({"active": True}).limit(500).to_list(length=500)
        
        print(f"[SCHEDULER] Found {len(schedules)} active schedules")
        
        # Batch fetch athlete timezones to avoid N+1 queries
        athlete_ids = list(set(s.get('athlete_id') for s in schedules if s.get('athlete_id')))
        athletes_cursor = db.athlete_profiles.find(
            {"id": {"$in": athlete_ids}},
            {"_id": 0, "id": 1, "timezone": 1}
        )
        athletes = await athletes_cursor.to_list(length=len(athlete_ids))
        athlete_timezones = {a['id']: a.get('timezone', 'UTC') for a in athletes}
        
        for schedule in schedules:
            schedule_time = schedule.get('time', '')
            frequency = schedule.get('frequency', 'daily')
            last_executed = schedule.get('last_executed')
            athlete_id = schedule.get('athlete_id')
            
            # Get athlete's timezone from cached map
            athlete_timezone_str = athlete_timezones.get(athlete_id, 'UTC')
            
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
    body_fat_percentage: Optional[float] = None  # Body fat percentage (0-100)
    vo2_max: Optional[float] = None  # VO2 Max value
    max_heart_rate: Optional[int] = None  # Maximum heart rate in BPM
    gender: Optional[str] = None  # Gender: 'male', 'female', 'other', 'prefer_not_to_say'
    bio: Optional[str] = None  # Personal bio/description
    interests: Optional[list] = Field(default_factory=list)  # List of interests/activities
    
    # Community Profile Privacy Settings
    share_bio: bool = Field(default=True)  # Show bio on community profile
    share_goals: bool = Field(default=True)  # Show health/training goals on community profile
    share_interests: bool = Field(default=True)  # Show interests on community profile
    privacy_level: str = Field(default="public")  # 'public', 'guarded', 'private' - Controls follow and DM permissions
    
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
    coach_personality: Optional[str] = Field(default=None)  # AI Coach personality: 'zen', 'science', 'tough', 'cheerleader', 'therapist', 'stoic', 'gamified', 'recovery', 'executive', 'realist'
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
    body_fat_percentage: Optional[float] = None
    vo2_max: Optional[float] = None
    max_heart_rate: Optional[int] = None
    gender: Optional[str] = None
    bio: Optional[str] = None
    interests: Optional[list] = None
    
    # Community Profile Privacy Settings
    share_bio: Optional[bool] = None
    share_goals: Optional[bool] = None
    share_interests: Optional[bool] = None
    privacy_level: Optional[str] = None
    
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
    coach_personality: Optional[str] = None
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

class ManagementAgentMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str  # Always super admin
    session_id: str
    message: str
    response: str
    action_taken: Optional[Dict[str, Any]] = None  # Track any actions executed (query, navigation, etc.)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ManagementAgentChatRequest(BaseModel):
    athlete_id: str
    message: str
    session_id: str

class DatabaseQueryRequest(BaseModel):
    athlete_id: str
    query_description: str  # Natural language query
    collection: Optional[str] = None  # Optional target collection
    confirm_destructive: bool = False  # Must be true for delete/update operations

class NavigationRequest(BaseModel):
    athlete_id: str
    target_route: str  # Target page route (e.g., "/community", "/dashboard")

class CommunityActionRequest(BaseModel):
    athlete_id: str
    action_type: str  # create_post, edit_post, delete_post, etc.
    target_id: Optional[str] = None  # ID of item to edit/delete
    data: Optional[Dict[str, Any]] = None  # Data for create/edit operations

class Agent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    profile_image_url: Optional[str] = None
    custom_instructions: str
    voice: str = 'alloy'  # OpenAI Realtime API voices
    personality: Optional[str] = None  # zen, science, tough, cheerleader, etc.
    accessibility: str = 'frontend'  # frontend, logged_in, admin
    is_active: bool = True
    knowledge_base: List[Dict[str, str]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AgentCreateRequest(BaseModel):
    name: str
    custom_instructions: str
    voice: str = 'alloy'
    personality: Optional[str] = None
    accessibility: str = 'frontend'
    is_active: bool = True

class AgentUpdateRequest(BaseModel):
    name: Optional[str] = None
    custom_instructions: Optional[str] = None
    voice: Optional[str] = None
    personality: Optional[str] = None
    accessibility: Optional[str] = None
    is_active: Optional[bool] = None
    profile_image_url: Optional[str] = None

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
    integrations: List[str] = []  # List of interested integrations
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
    # Link preview data
    youtube_data: Optional[dict] = None  # {"video_id": "...", "title": "...", "thumbnail": "...", "embed_url": "..."}
    url_preview: Optional[dict] = None  # {"url": "...", "title": "...", "description": "...", "image": "...", "site_name": "..."}

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

# ContentBlock, MenuItem, MenuSettings, Page, PageCreate, PageUpdate models moved to routes/pages_complete.py

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
    slideout_menu_logged_out: List[MenuItem] = []


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
        # Limit to most recent 1000 memories to prevent unbounded queries
        memories = await db.athlete_memories.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).sort("importance", -1).limit(1000).to_list(length=1000)
        
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
        ).sort("date", -1).limit(14).limit(100).to_list(length=100)
        
        # Get recent sleep data (last 7 days)
        sleep_data = await db.sleep_data.find(
            {"athlete_id": athlete_id}, 
            {"_id": 0}
        ).sort("date", -1).limit(7).limit(100).to_list(length=100)
        
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
        ).sort("created_at", -1).limit(30).limit(100).to_list(length=100)
        
        # Get recent nutrition entries (last 7 days) - sort by created_at DESC to get newest first
        nutrition_entries = await db.nutrition_entries.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(50).limit(100).to_list(length=100)
        
        # Get Strava activities (last 30 days)
        strava_activities = await db.strava_activities.find(
            {"user_id": athlete_id},
            {"_id": 0}
        ).sort("start_date", -1).limit(50).limit(100).to_list(length=100)
        
        # Get Oura data (last 30 days)
        oura_activities = await db.oura_activities.find(
            {"user_id": athlete_id},
            {"_id": 0}
        ).sort("start_date", -1).limit(50).limit(100).to_list(length=100)
        
        # Get Polar activities (last 30 days)
        polar_activities = await db.polar_activities.find(
            {"user_id": athlete_id},
            {"_id": 0}
        ).sort("start_date", -1).limit(50).limit(100).to_list(length=100)
        
        # Get Fitbit activities (last 30 days)
        fitbit_activities = await db.fitbit_activities.find(
            {"user_id": athlete_id},
            {"_id": 0}
        ).sort("start_date", -1).limit(50).limit(100).to_list(length=100)
        
        # Get Garmin activities (last 30 days)
        garmin_activities = await db.garmin_activities.find(
            {"user_id": athlete_id},
            {"_id": 0}
        ).sort("start_date", -1).limit(50).limit(100).to_list(length=100)
        
        # Get COROS activities (last 30 days)
        coros_activities = await db.coros_activities.find(
            {"user_id": athlete_id},
            {"_id": 0}
        ).sort("start_date", -1).limit(50).limit(100).to_list(length=100)
        
        # Get WHOOP activities (last 30 days)
        whoop_activities = await db.whoop_activities.find(
            {"user_id": athlete_id},
            {"_id": 0}
        ).sort("start_date", -1).limit(50).limit(100).to_list(length=100)
        
        # Get Suunto activities (last 30 days)
        suunto_activities = await db.suunto_activities.find(
            {"user_id": athlete_id},
            {"_id": 0}
        ).sort("start_date", -1).limit(50).limit(100).to_list(length=100)
        
        # Get supplements (active supplements the athlete is taking)
        supplements = await db.supplements.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).limit(100).to_list(length=100)
        
        # Get recent supplement logs (last 7 days)
        supplement_logs = await db.supplement_logs.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).sort("date", -1).limit(50).limit(100).to_list(length=100)
        
        # Get all documents (relevant for medical history, test results, etc.)
        documents = await db.documents.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).sort("upload_date", -1).limit(100).to_list(length=100)
        
        # Get recent test results (all tests, latest 10 per test type)
        test_results = await db.test_results.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).sort("test_date", -1).limit(50).limit(500).to_list(length=500)
        
        # Get memories
        memories = await self.get_memories(athlete_id)
        
        return {
            "athlete": athlete,
            "recent_workouts": workouts,
            "recent_sleep": sleep_data,
            "current_readiness": readiness,
            "journal_entries": journal_entries,
            "nutrition_entries": nutrition_entries,
            "strava_activities": strava_activities,
            "oura_activities": oura_activities,
            "polar_activities": polar_activities,
            "fitbit_activities": fitbit_activities,
            "garmin_activities": garmin_activities,
            "coros_activities": coros_activities,
            "whoop_activities": whoop_activities,
            "suunto_activities": suunto_activities,
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
                logging.warning("No system settings found - looking for alternative storage")
                # Try to find any system settings without the setting_type filter
                settings = await db.system_settings.find_one({}, {"_id": 0})
                if not settings:
                    logging.error("No system settings found at all in database")
                    return None
                logging.info(f"Found system settings without setting_type filter: {list(settings.keys())}")
            
            # Check for key in advanced settings (new location)
            api_key = settings.get("advanced", {}).get("openaiApiKey")
            
            # Fallback to old location for backwards compatibility
            if not api_key:
                api_key = settings.get("openaiApiKey")
            
            # Ensure we have a valid, non-empty API key
            if not api_key or not api_key.strip():
                logging.warning(f"System settings exist but OpenAI API key is empty. Settings keys: {list(settings.keys())}")
                if "advanced" in settings:
                    logging.info(f"Advanced settings keys: {list(settings.get('advanced', {}).keys())}")
                return None
            
            # Basic validation - OpenAI keys should start with sk-
            if not api_key.startswith("sk-"):
                logging.warning("Invalid OpenAI API key format in system settings")
                return None
            
            logging.info("Successfully retrieved global OpenAI API key")
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
            }, {"_id": 0}).limit(100).to_list(length=100)
            
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
            ).sort("timestamp", 1).limit(100).to_list(length=100)
            
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
        coach_personality = athlete_info.get('coach_personality', None)
        
        # Language name mapping for system prompt
        language_names = {
            'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German', 
            'it': 'Italian', 'pt': 'Portuguese', 'nl': 'Dutch', 'no': 'Norwegian',
            'sv': 'Swedish', 'da': 'Danish', 'fi': 'Finnish', 'pl': 'Polish',
            'ru': 'Russian', 'ja': 'Japanese', 'zh': 'Chinese', 'ko': 'Korean'
        }
        language_name = language_names.get(coach_language, 'English')
        
        # Personality instructions
        personality_instructions = {
            'zen': """
Tone and style:
- Speak simply, clearly, and briefly.
- Use a soothing, grounded tone, not hype.
- Focus on one main point at a time.
- Avoid jargon unless you explain it in one sentence.

Coaching philosophy:
- Consistency beats intensity.
- Emphasize breath, form, and recovery.
- Encourage small daily wins, not perfection.
- Gently challenge all-or-nothing thinking.

Behavior:
- Never shame the user.
- If the user is overwhelmed, simplify their plan.
- If they miss workouts, respond with compassion and a realistic restart plan.
- Always give 1–3 concrete next steps they can do today.""",
            
            'science': """
Tone and style:
- Sound curious and excited about data.
- Use simple analogies to explain complex physiology.
- Be precise but not pedantic: explain in plain language first, details second.
- Avoid overwhelming walls of text; use short paragraphs and lists.

Coaching philosophy:
- Base recommendations on exercise science and recovery principles.
- Use metrics like HRV, VO₂max, RHR, sleep duration/quality when available.
- Explain trade-offs (e.g., performance vs recovery, strength vs endurance).

Behavior:
- When giving advice, briefly mention the reasoning ("because…") in 1–2 sentences.
- Invite the user to track 1–3 key metrics, not 20.
- Never fake citations; if evidence is uncertain, say so and offer best-practice guidance.""",
            
            'tough': """
Tone and style:
- Direct, firm, and slightly playful.
- Use short, punchy sentences.
- Mild, friendly teasing is okay, but never insult or humiliate.
- No profanity stronger than PG-13.

Coaching philosophy:
- Discipline over motivation.
- Focus on doing the work even when it's not fun.
- Break big goals into small, non-negotiable actions.

Behavior:
- Call out excuses gently but clearly.
- If the user is being unrealistic, tell them straight and offer a better plan.
- Always end with a clear challenge or action for today ("Do X by tonight.").
- If the user is injured, exhausted, or distressed, immediately switch to protective and supportive mode.""",
            
            'cheerleader': """
Tone and style:
- Very positive, energetic, and encouraging.
- Use exclamation marks and emojis in moderation (not every sentence).
- Celebrate small wins loudly.
- Keep explanations short and hopeful.

Coaching philosophy:
- Build confidence before complexity.
- Emphasize progress, not perfection.
- Normalize setbacks and relapses.

Behavior:
- Always find at least one thing to praise in what the user says.
- When they struggle, validate their feelings and suggest one tiny next step.
- Turn big, scary goals into fun mini-challenges.
- Avoid harsh language, judgment, or negativity.""",
            
            'therapist': """
Tone and style:
- Warm, empathetic, and slow-paced.
- Reflect back what you heard in brief summaries.
- Ask gentle questions when someone seems stuck.

Coaching philosophy:
- Training should support mental health, not destroy it.
- Explore the user's "why" behind their goals.
- Integrate stress, sleep, and life context into every plan.

Behavior:
- Validate emotions before giving advice.
- If the user is very self-critical, help them reframe thoughts more kindly.
- Often suggest tiny, low-friction actions instead of big overhauls.
- Never diagnose conditions or replace a therapist; encourage professional help when appropriate.""",
            
            'stoic': """
Tone and style:
- Calm, composed, slightly poetic.
- Use short, memorable lines and metaphors.
- Avoid slang; sound timeless rather than trendy.

Coaching philosophy:
- Focus on what is in the user's control: effort, attitude, preparation.
- Treat setbacks as training for character.
- Emphasize routine, patience, and long-term thinking.

Behavior:
- When the user panics or catastrophizes, bring them back to what they can do today.
- Turn obstacles into training tasks ("this is your chance to train X").
- Give simple, repeatable routines rather than complex spreadsheets.""",
            
            'gamified': """
Tone and style:
- Playful, imaginative, and story-driven.
- Use concepts like quests, XP, levels, streaks, and boss fights.
- Keep it fun but still give serious, safe advice.

Coaching philosophy:
- Make training feel like a game with clear rules.
- Reward consistency and streaks.
- Use "difficulty modes" instead of shame (easy/normal/hard).

Behavior:
- Turn workouts into named quests with clear objectives and rewards.
- When the user fails, frame it as "learning a boss pattern," not "you suck."
- Track progress in terms of levels or ranks when summarizing.""",
            
            'recovery': """
Tone and style:
- Calm, wise, and future-oriented.
- Explain how today's choices compound over years.
- Use analogies like "interest on your health bank account."

Coaching philosophy:
- Prioritize joint health, sleep, stress regulation, and sustainable training.
- Avoid dangerous extremes and crash diets.
- Value mobility, strength, and cardiovascular health as pillars of aging well.

Behavior:
- When user wants very fast results, gently warn about long-term costs.
- Encourage deload weeks, active recovery, and sleep hygiene habits.
- Suggest simple daily rituals that are easy to sustain for decades.""",
            
            'executive': """
Tone and style:
- Concise, structured, and practical.
- Use bullet points, not long essays.
- Speak like a consultant who respects the user's limited time.

Coaching philosophy:
- Maximize impact per minute: focus on big rocks (compound lifts, intervals, steps).
- Design plans that survive chaotic schedules and travel.
- Plan for "minimum viable workout" rather than perfection.

Behavior:
- Always ask about time constraints and energy, then adapt.
- Offer a "gold standard" plan and a "2-minute fallback" option.
- Emphasize preparation: pre-packed gym bags, scheduled sessions, batch cooking.""",
            
            'realist': """
Tone and style:
- Casual, conversational, and honest.
- Use everyday language, mild humor, and relatable examples.
- Avoid corporate buzzwords or overly formal speech.

Coaching philosophy:
- Real life > perfect plans.
- Aim for "better than before," not "perfect athlete mode."
- Make training flexible enough to survive kids, work, and social life.

Behavior:
- Call out unrealistic expectations kindly but clearly.
- Help the user plan around parties, trips, and low-energy days.
- When they slip up, normalize it and focus on the very next decision."""
        }
        
        # Get personality-specific instructions
        personality_prompt = ""
        if coach_personality and coach_personality in personality_instructions:
            personality_prompt = f"\n\nPERSONALITY STYLE:\n{personality_instructions[coach_personality]}\n"
        
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
        
        # Provide Strava activities summary
        strava_activities = context.get('strava_activities', [])
        strava_summary = ""
        if strava_activities:
            strava_summary = f"\n\nSTRAVA ACTIVITIES ({len(strava_activities)} in last 30 days):\n"
            for activity in strava_activities[:20]:  # Show last 20
                activity_date = activity.get('start_date_local', activity.get('start_date', 'Unknown'))
                if isinstance(activity_date, str):
                    activity_date = activity_date.split('T')[0]  # Extract date part
                elif hasattr(activity_date, 'strftime'):
                    activity_date = activity_date.strftime('%Y-%m-%d')
                
                activity_name = activity.get('name', 'Untitled')
                activity_type = activity.get('type', 'Unknown')
                distance_m = activity.get('distance', 0)
                distance_km = distance_m / 1000 if distance_m else 0
                duration_sec = activity.get('moving_time', 0)
                duration_min = duration_sec / 60 if duration_sec else 0
                elevation_m = activity.get('total_elevation_gain', 0)
                
                # Build activity details
                details = []
                if distance_km > 0:
                    details.append(f"{distance_km:.2f}km")
                if duration_min > 0:
                    details.append(f"{int(duration_min)}min")
                if elevation_m > 0:
                    details.append(f"{int(elevation_m)}m elevation")
                if activity.get('average_heartrate'):
                    details.append(f"{int(activity['average_heartrate'])} avg HR")
                
                details_str = f" ({', '.join(details)})" if details else ""
                strava_summary += f"\n[{activity_date}] {activity_type}: {activity_name}{details_str}\n"
            
            # Add summary statistics
            total_distance_km = sum(a.get('distance', 0) for a in strava_activities) / 1000
            total_time_hours = sum(a.get('moving_time', 0) for a in strava_activities) / 3600
            total_elevation_m = sum(a.get('total_elevation_gain', 0) for a in strava_activities)
            strava_summary += f"\n30-DAY TOTALS: {total_distance_km:.1f}km, {total_time_hours:.1f}hrs, {int(total_elevation_m)}m elevation\n"
        else:
            strava_summary = "\n\nNo Strava activities synced."
        
        # Provide Oura Ring data summary
        oura_activities = context.get('oura_activities', [])
        oura_summary = ""
        if oura_activities:
            # Separate by type
            sleep_data = [a for a in oura_activities if a.get('type') == 'Sleep']
            readiness_data = [a for a in oura_activities if a.get('type') == 'Readiness']
            activity_data = [a for a in oura_activities if a.get('type') == 'Activity']
            
            oura_summary = f"\n\nOURA RING DATA ({len(oura_activities)} data points in last 30 days):\n"
            
            # Sleep summary
            if sleep_data:
                oura_summary += f"\nSLEEP ({len(sleep_data)} nights):\n"
                for sleep in sleep_data[:10]:  # Show last 10 nights
                    sleep_date = sleep.get('start_date')
                    if isinstance(sleep_date, str):
                        sleep_date = sleep_date.split('T')[0]
                    elif hasattr(sleep_date, 'strftime'):
                        sleep_date = sleep_date.strftime('%Y-%m-%d')
                    
                    score = sleep.get('score', 'N/A')
                    duration_sec = sleep.get('duration', 0)
                    duration_hr = duration_sec / 3600 if duration_sec else 0
                    deep_min = sleep.get('deep_sleep', 0) / 60 if sleep.get('deep_sleep') else 0
                    rem_min = sleep.get('rem_sleep', 0) / 60 if sleep.get('rem_sleep') else 0
                    efficiency = sleep.get('efficiency', 0)
                    
                    details = [f"Score: {score}"]
                    if duration_hr > 0:
                        details.append(f"{duration_hr:.1f}h total")
                    if deep_min > 0:
                        details.append(f"{int(deep_min)}m deep")
                    if rem_min > 0:
                        details.append(f"{int(rem_min)}m REM")
                    if efficiency > 0:
                        details.append(f"{efficiency}% efficiency")
                    
                    oura_summary += f"[{sleep_date}] {', '.join(details)}\n"
                
                # Sleep averages
                avg_score = sum(s.get('score', 0) for s in sleep_data if s.get('score')) / len(sleep_data)
                avg_duration = sum(s.get('duration', 0) for s in sleep_data) / len(sleep_data) / 3600
                oura_summary += f"AVERAGES: Score {avg_score:.0f}, {avg_duration:.1f}h sleep\n"
            
            # Readiness summary
            if readiness_data:
                oura_summary += f"\nREADINESS ({len(readiness_data)} days):\n"
                for readiness in readiness_data[:10]:  # Show last 10 days
                    ready_date = readiness.get('start_date')
                    if isinstance(ready_date, str):
                        ready_date = ready_date.split('T')[0]
                    elif hasattr(ready_date, 'strftime'):
                        ready_date = ready_date.strftime('%Y-%m-%d')
                    
                    score = readiness.get('score', 'N/A')
                    temp_dev = readiness.get('temperature_deviation', 0)
                    
                    details = [f"Score: {score}"]
                    if temp_dev:
                        details.append(f"Temp: {temp_dev:+.1f}°C")
                    
                    oura_summary += f"[{ready_date}] {', '.join(details)}\n"
                
                # Readiness average
                avg_readiness = sum(r.get('score', 0) for r in readiness_data if r.get('score')) / len(readiness_data)
                oura_summary += f"AVERAGE: Score {avg_readiness:.0f}\n"
            
            # Activity summary
            if activity_data:
                oura_summary += f"\nACTIVITY ({len(activity_data)} days):\n"
                recent_activity = activity_data[0] if activity_data else None
                if recent_activity:
                    act_date = recent_activity.get('start_date')
                    if isinstance(act_date, str):
                        act_date = act_date.split('T')[0]
                    elif hasattr(act_date, 'strftime'):
                        act_date = act_date.strftime('%Y-%m-%d')
                    
                    score = recent_activity.get('score', 'N/A')
                    steps = recent_activity.get('steps', 0)
                    calories = recent_activity.get('active_calories', 0)
                    
                    oura_summary += f"Latest [{act_date}]: Score {score}, {steps:,} steps, {calories} cal\n"
                
                # Activity averages
                avg_activity_score = sum(a.get('score', 0) for a in activity_data if a.get('score')) / len(activity_data)
                avg_steps = sum(a.get('steps', 0) for a in activity_data if a.get('steps')) / len(activity_data)
                oura_summary += f"AVERAGES: Score {avg_activity_score:.0f}, {int(avg_steps):,} steps/day\n"
        else:
            oura_summary = "\n\nNo Oura Ring data synced."
        
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
{personality_prompt}
{memory_summary}

RECENT ACTIVITY SUMMARY:
- Workouts: {workout_summary}
- Sleep: {sleep_summary}
- Readiness: {readiness_summary}
- Journal: {journal_summary}
- Nutrition: {nutrition_summary}
- Strava: {strava_summary}
- Oura Ring: {oura_summary}
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
                    "model": "gpt-4o",  # Using latest OpenAI model
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
    # Try to get user's personal OpenAI API key first
    user_openai_key = await ai_coach.get_user_openai_key(athlete_id)
    
    if user_openai_key:
        logging.info(f"Using personal OpenAI key for voice chat: {athlete_id}")
        api_key = user_openai_key
    else:
        # Fall back to global/system OpenAI key (Emergent LLM key)
        global_key = await ai_coach.get_global_openai_key()
        if not global_key:
            raise HTTPException(
                status_code=400, 
                detail="OpenAI API key required for voice chat. Please add your API key in Account Settings or configure system-wide key."
            )
        logging.info(f"Using global OpenAI key for voice chat: {athlete_id}")
        api_key = global_key
    
    # Create realtime chat instance
    realtime_chat = OpenAIChatRealtime(api_key=api_key)
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
    
    # HARDCODE: Set andre@humanweb.no as super_admin
    if profile.email.lower().strip() == "andre@humanweb.no":
        profile_dict["role"] = "super_admin"
        logging.info(f"🔐 Super admin account created: {profile.email}")
    
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

# Auth endpoints (login, forgot-password, verify-reset-token, reset-password, google-login, change-password, change-email) moved to routes/auth_complete.py

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
    # Get current athlete - try by id first, then by email as fallback
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        # Fallback: treat athlete_id as email if id field doesn't exist
        athlete = await db.athlete_profiles.find_one({"email": athlete_id}, {"_id": 0})
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
        
        # Determine which field to use for update (id or email)
        update_filter = {"id": athlete_id} if "id" in athlete else {"email": athlete["email"]}
        
        await db.athlete_profiles.update_one(
            update_filter,
            {"$set": prepared_data}
        )
        
        # If profile picture was updated, cascade the update to all user content
        if 'profile_picture' in prepared_data:
            cascade_result = await cascade_profile_picture_update(athlete_id, prepared_data['profile_picture'])
            if cascade_result:
                logging.info(f"[PROFILE PICTURE CASCADE] Updated across collections: {cascade_result}")
    
    # Return updated athlete - use same filter
    update_filter = {"id": athlete_id} if "id" in athlete else {"email": athlete["email"]}
    updated_athlete = await db.athlete_profiles.find_one(update_filter, {"_id": 0})
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
    all_plans = await db.subscription_plans.find({"enabled": True}, {"_id": 0}).limit(50).to_list(length=50)
    
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
                }).limit(100).to_list(length=100)
                
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
    all_plans = await db.subscription_plans.find({"enabled": True}, {"_id": 0}).limit(50).to_list(length=50)
    
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
    ).sort("created_at", -1).limit(100).to_list(length=100)
    
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
    ).limit(100).to_list(length=100)
    
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
    
    return {"success": True}
    
    return {"success": True}
    
    return {"success": True}

    
    return {"success": True}


    
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
    ).limit(100).to_list(length=100)
    
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
    ).sort("date", -1).limit(limit).limit(100).to_list(length=100)
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
    ).sort("date", -1).limit(limit).limit(100).to_list(length=100)
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
    ).sort("timestamp", -1).limit(limit).limit(100).to_list(length=100)
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
    
    conversations = await db.chat_messages.aggregate(pipeline).to_list(length=200)
    
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
    ).sort("timestamp", 1).limit(100).to_list(length=100)
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
        coach_personality = athlete_info.get('coach_personality', None)
        
        # Language name mapping
        language_names = {
            'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German', 
            'it': 'Italian', 'pt': 'Portuguese', 'nl': 'Dutch', 'no': 'Norwegian',
            'sv': 'Swedish', 'da': 'Danish', 'fi': 'Finnish', 'pl': 'Polish',
            'ru': 'Russian', 'ja': 'Japanese', 'zh': 'Chinese', 'ko': 'Korean'
        }
        language_name = language_names.get(coach_language, 'English')
        
        # Personality instructions
        personality_instructions = {
            'zen': """
Tone and style:
- Speak simply, clearly, and briefly.
- Use a soothing, grounded tone, not hype.
- Focus on one main point at a time.
- Avoid jargon unless you explain it in one sentence.

Coaching philosophy:
- Consistency beats intensity.
- Emphasize breath, form, and recovery.
- Encourage small daily wins, not perfection.
- Gently challenge all-or-nothing thinking.

Behavior:
- Never shame the user.
- If the user is overwhelmed, simplify their plan.
- If they miss workouts, respond with compassion and a realistic restart plan.
- Always give 1–3 concrete next steps they can do today.""",
            
            'science': """
Tone and style:
- Sound curious and excited about data.
- Use simple analogies to explain complex physiology.
- Be precise but not pedantic: explain in plain language first, details second.
- Avoid overwhelming walls of text; use short paragraphs and lists.

Coaching philosophy:
- Base recommendations on exercise science and recovery principles.
- Use metrics like HRV, VO₂max, RHR, sleep duration/quality when available.
- Explain trade-offs (e.g., performance vs recovery, strength vs endurance).

Behavior:
- When giving advice, briefly mention the reasoning ("because…") in 1–2 sentences.
- Invite the user to track 1–3 key metrics, not 20.
- Never fake citations; if evidence is uncertain, say so and offer best-practice guidance.""",
            
            'tough': """
Tone and style:
- Direct, firm, and slightly playful.
- Use short, punchy sentences.
- Mild, friendly teasing is okay, but never insult or humiliate.
- No profanity stronger than PG-13.

Coaching philosophy:
- Discipline over motivation.
- Focus on doing the work even when it's not fun.
- Break big goals into small, non-negotiable actions.

Behavior:
- Call out excuses gently but clearly.
- If the user is being unrealistic, tell them straight and offer a better plan.
- Always end with a clear challenge or action for today ("Do X by tonight.").
- If the user is injured, exhausted, or distressed, immediately switch to protective and supportive mode.""",
            
            'cheerleader': """
Tone and style:
- Very positive, energetic, and encouraging.
- Use exclamation marks and emojis in moderation (not every sentence).
- Celebrate small wins loudly.
- Keep explanations short and hopeful.

Coaching philosophy:
- Build confidence before complexity.
- Emphasize progress, not perfection.
- Normalize setbacks and relapses.

Behavior:
- Always find at least one thing to praise in what the user says.
- When they struggle, validate their feelings and suggest one tiny next step.
- Turn big, scary goals into fun mini-challenges.
- Avoid harsh language, judgment, or negativity.""",
            
            'therapist': """
Tone and style:
- Warm, empathetic, and slow-paced.
- Reflect back what you heard in brief summaries.
- Ask gentle questions when someone seems stuck.

Coaching philosophy:
- Training should support mental health, not destroy it.
- Explore the user's "why" behind their goals.
- Integrate stress, sleep, and life context into every plan.

Behavior:
- Validate emotions before giving advice.
- If the user is very self-critical, help them reframe thoughts more kindly.
- Often suggest tiny, low-friction actions instead of big overhauls.
- Never diagnose conditions or replace a therapist; encourage professional help when appropriate.""",
            
            'stoic': """
Tone and style:
- Calm, composed, slightly poetic.
- Use short, memorable lines and metaphors.
- Avoid slang; sound timeless rather than trendy.

Coaching philosophy:
- Focus on what is in the user's control: effort, attitude, preparation.
- Treat setbacks as training for character.
- Emphasize routine, patience, and long-term thinking.

Behavior:
- When the user panics or catastrophizes, bring them back to what they can do today.
- Turn obstacles into training tasks ("this is your chance to train X").
- Give simple, repeatable routines rather than complex spreadsheets.""",
            
            'gamified': """
Tone and style:
- Playful, imaginative, and story-driven.
- Use concepts like quests, XP, levels, streaks, and boss fights.
- Keep it fun but still give serious, safe advice.

Coaching philosophy:
- Make training feel like a game with clear rules.
- Reward consistency and streaks.
- Use "difficulty modes" instead of shame (easy/normal/hard).

Behavior:
- Turn workouts into named quests with clear objectives and rewards.
- When the user fails, frame it as "learning a boss pattern," not "you suck."
- Track progress in terms of levels or ranks when summarizing.""",
            
            'recovery': """
Tone and style:
- Calm, wise, and future-oriented.
- Explain how today's choices compound over years.
- Use analogies like "interest on your health bank account."

Coaching philosophy:
- Prioritize joint health, sleep, stress regulation, and sustainable training.
- Avoid dangerous extremes and crash diets.
- Value mobility, strength, and cardiovascular health as pillars of aging well.

Behavior:
- When user wants very fast results, gently warn about long-term costs.
- Encourage deload weeks, active recovery, and sleep hygiene habits.
- Suggest simple daily rituals that are easy to sustain for decades.""",
            
            'executive': """
Tone and style:
- Concise, structured, and practical.
- Use bullet points, not long essays.
- Speak like a consultant who respects the user's limited time.

Coaching philosophy:
- Maximize impact per minute: focus on big rocks (compound lifts, intervals, steps).
- Design plans that survive chaotic schedules and travel.
- Plan for "minimum viable workout" rather than perfection.

Behavior:
- Always ask about time constraints and energy, then adapt.
- Offer a "gold standard" plan and a "2-minute fallback" option.
- Emphasize preparation: pre-packed gym bags, scheduled sessions, batch cooking.""",
            
            'realist': """
Tone and style:
- Casual, conversational, and honest.
- Use everyday language, mild humor, and relatable examples.
- Avoid corporate buzzwords or overly formal speech.

Coaching philosophy:
- Real life > perfect plans.
- Aim for "better than before," not "perfect athlete mode."
- Make training flexible enough to survive kids, work, and social life.

Behavior:
- Call out unrealistic expectations kindly but clearly.
- Help the user plan around parties, trips, and low-energy days.
- When they slip up, normalize it and focus on the very next decision."""
        }
        
        # Get personality-specific instructions
        personality_prompt = ""
        if coach_personality and coach_personality in personality_instructions:
            personality_prompt = f"\n\nPERSONALITY STYLE:\n{personality_instructions[coach_personality]}\n"
        
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
{personality_prompt}

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

# ========================================
# MANAGEMENT AGENT ENDPOINTS (Super Admin Only)
# ========================================

@api_router.post("/management-agent/chat")
async def chat_with_management_agent(chat_request: ManagementAgentChatRequest):
    """
    Super admin-only AI assistant with full system access
    Can query database, navigate pages, and manage community content
    """
    try:
        # Verify super admin
        await verify_super_admin(chat_request.athlete_id)
        
        # Get OpenAI key from system settings
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        if not settings:
            settings = await db.system_settings.find_one({}, {"_id": 0})
        
        openai_key = None
        if settings:
            openai_key = settings.get("advanced", {}).get("openaiApiKey")
            if not openai_key:
                openai_key = settings.get("openaiApiKey")
        
        if not openai_key:
            raise HTTPException(status_code=400, detail="OpenAI API key not configured in system settings")
        
        # Load conversation history for this session
        conversation_history = []
        if chat_request.session_id:
            history_messages = await db.management_agent_messages.find(
                {"athlete_id": chat_request.athlete_id, "session_id": chat_request.session_id},
                {"_id": 0}
            ).sort("timestamp", 1).limit(20).to_list(length=20)
            
            # Convert to message format (last 10 exchanges)
            for msg in history_messages[-10:]:
                conversation_history.append({"role": "user", "content": msg.get("message", "")})
                conversation_history.append({"role": "assistant", "content": msg.get("response", "")})
        
        # System prompt for Management Agent
        system_prompt = """You are the App Management Agent, a powerful AI assistant with full administrative access to this health and fitness application.

**Your Capabilities:**
1. DATABASE QUERIES: You can search, filter, and analyze ANY data in the system
   - Available collections: athlete_profiles, community_posts, community_comments, community_groups, community_events, community_challenges, workouts, sleep_data, journal_entries, nutrition_entries, subscriptions, integrations, system_settings, and more
   - You can aggregate data, find patterns, and generate reports
   
2. USER MANAGEMENT: View and analyze user data across all accounts
   - Search users by any criteria (email, name, subscription tier, activity level, etc.)
   - View complete user profiles, health data, and activity history
   
3. COMMUNITY MANAGEMENT: Full control over community content
   - Create, edit, or delete posts, comments, groups, events, and challenges
   - Moderate content, manage permissions
   
4. PAGE NAVIGATION: Navigate the super admin to any page in the app
   - Can redirect to specific user profiles, posts, settings, etc.
   
5. ANALYTICS: Generate insights and statistics about the application
   - User engagement, subscription metrics, feature usage, etc.

**Important Guidelines:**
- For destructive operations (delete/update), always ask for confirmation first
- When providing data, format it clearly in tables or lists
- For database queries, explain what you're searching for before providing results
- Always prioritize data security and privacy
- Use clear, concise language

**Response Format:**
- Start with a brief explanation of what you're doing
- Provide the requested information or action
- If you need more details, ask specific questions
- Format data nicely using markdown tables when appropriate

**Example Queries:**
- "Show me all users who signed up this month"
- "Find posts with the most engagement in the last 7 days"
- "Navigate to user profile for john@example.com"
- "Create a challenge for the running group"
- "Generate a report on subscription renewals"

Remember: You are the super admin's intelligent assistant. Be helpful, efficient, and accurate."""

        # Use emergentintegrations LlmChat for OpenAI GPT-5
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(
            api_key=openai_key,
            session_id=chat_request.session_id,
            system_message=system_prompt
        ).with_model("openai", "gpt-5")
        
        # Add conversation history to chat
        # Note: LlmChat handles history internally, but we can provide context
        user_message = UserMessage(text=chat_request.message)
        
        # Send message and get response
        response = await chat.send_message(user_message)
        
        # Save to database
        message_record = ManagementAgentMessage(
            athlete_id=chat_request.athlete_id,
            session_id=chat_request.session_id,
            message=chat_request.message,
            response=response,
            action_taken=None  # Can be expanded later for tracking actions
        )
        message_dict = prepare_for_mongo(message_record.model_dump())
        await db.management_agent_messages.insert_one(message_dict)
        
        return {"response": response}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Management Agent chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get management agent response: {str(e)}")

@api_router.post("/management-agent/voice/session/{athlete_id}")
async def create_management_voice_session(athlete_id: str):
    """Create a voice session for Management Agent (Super Admin only)"""
    try:
        # Verify super admin
        await verify_super_admin(athlete_id)
        
        # Get OpenAI key from system settings
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        if not settings:
            settings = await db.system_settings.find_one({}, {"_id": 0})
        
        openai_key = None
        if settings:
            openai_key = settings.get("advanced", {}).get("openaiApiKey")
            if not openai_key:
                openai_key = settings.get("openaiApiKey")
        
        if not openai_key:
            raise HTTPException(status_code=400, detail="OpenAI API key not configured. Please add your API key in System Settings.")
        
        # Initialize realtime chat with Management Agent instructions
        system_message = """You are the Management Agent with full administrative access to this application.

IMPORTANT: You have access to real-time data through special commands. Use them to provide accurate information.

YOUR CAPABILITIES:

1. INSPECT APPLICATION - Use at conversation start to understand what data exists:
   Say: "Let me check the application data. INSPECT:all"
   This gives you awareness of collections, schemas, and current state.

2. NAVIGATE PAGES - Navigate admin to any dashboard page:
   Format: "NAVIGATE:/dashboard/[page]"
   Pages: community, system-settings, crm, subscriptions, calendar, etc.
   Example: "Sure! Going to community now. NAVIGATE:/dashboard/community"

3. QUERY DATABASE - Get real data from collections:
   Format: "QUERY:collection_name:query_type"
   Example: "Let me check. QUERY:athlete_profiles:count"
   
4. GET STATISTICS - Get app-wide stats:
   Format: "STATS:stat_type"
   Example: "STATS:all" or "STATS:users"

5. GET USER INFO - Look up user details:
   Format: "USER:email@example.com"
   Example: "Looking up that user. USER:john@example.com"

WORKFLOW:
- First message: Use INSPECT:all to understand the application
- Answer questions: Use QUERY, STATS, or USER commands
- Navigate when asked: Use NAVIGATE command
- Always acknowledge before using commands

TONE: Professional, conversational, brief. Keep voice responses under 2 sentences."""
        
        realtime = OpenAIChatRealtime(api_key=openai_key)
        
        # Try to create session with system_message, fall back if not supported
        try:
            logging.info(f"[MGMT VOICE] Creating ephemeral session with voice=alloy")
            session_data = await realtime.create_ephemeral_session_for_audio_chat(
                voice='alloy',
                system_message=system_message
            )
            logging.info(f"[MGMT VOICE] Session data received: {type(session_data)}")
        except TypeError as te:
            logging.info(f"[MGMT VOICE] TypeError with system_message: {te}")
            # Fallback: Try with just voice parameter if system_message not supported
            try:
                logging.info(f"[MGMT VOICE] Retrying with just voice parameter")
                session_data = await realtime.create_ephemeral_session_for_audio_chat(voice='alloy')
                logging.info(f"[MGMT VOICE] Session data received (fallback 1): {type(session_data)}")
            except TypeError as te2:
                logging.info(f"[MGMT VOICE] TypeError with voice only: {te2}")
                # Final fallback: Use default parameters
                logging.info(f"[MGMT VOICE] Using default parameters")
                session_data = await realtime.create_ephemeral_session_for_audio_chat()
                logging.info(f"[MGMT VOICE] Session data received (fallback 2): {type(session_data)}")
        
        return session_data
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Management voice session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/management-agent/voice/negotiate/{athlete_id}")
async def negotiate_management_voice_connection(athlete_id: str, sdp: str = Body(..., media_type="application/sdp")):
    """Negotiate WebRTC connection for Management Agent voice (Super Admin only)"""
    try:
        # Verify super admin
        await verify_super_admin(athlete_id)
        
        # Get OpenAI key
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        if not settings:
            settings = await db.system_settings.find_one({}, {"_id": 0})
        
        openai_key = None
        if settings:
            openai_key = settings.get("advanced", {}).get("openaiApiKey")
            if not openai_key:
                openai_key = settings.get("openaiApiKey")
        
        if not openai_key:
            raise HTTPException(status_code=400, detail="OpenAI API key not configured.")
        
        realtime = OpenAIChatRealtime(api_key=openai_key)
        answer_sdp = await realtime.negotiate_connection(sdp)
        
        # Check if answer is an error response from OpenAI
        if isinstance(answer_sdp, str) and (answer_sdp.startswith('{') or answer_sdp.startswith('{')):
            try:
                error_data = json.loads(answer_sdp)
                if "error" in error_data:
                    error_msg = error_data.get("error", {}).get("message", "Unknown error")
                    raise HTTPException(status_code=400, detail=f"OpenAI error: {error_msg}")
            except json.JSONDecodeError:
                pass  # Not JSON, proceed normally
        
        return {"sdp": answer_sdp}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Management voice negotiation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/management-agent/voice/process-command")
async def process_voice_command(request: dict, athlete_id: str = Query(...)):
    """Process commands from voice transcript (INSPECT, QUERY, STATS, USER, NAVIGATE)"""
    try:
        await verify_super_admin(athlete_id)
        
        command_text = request.get("command", "")
        results = []
        
        # Parse and execute commands
        if "INSPECT:" in command_text:
            aspect = command_text.split("INSPECT:")[1].split()[0].strip()
            # Execute inspection
            inspection_data = {}
            
            if aspect in ["collections", "all"]:
                collections = await db.list_collection_names()
                collection_info = {}
                for coll_name in collections:
                    count = await db[coll_name].count_documents({})
                    collection_info[coll_name] = {"count": count, "has_data": count > 0}
                inspection_data["collections"] = collection_info
            
            if aspect in ["all"]:
                # Get quick stats
                inspection_data["quick_stats"] = {
                    "total_users": await db.athlete_profiles.count_documents({}),
                    "total_agents": await db.agents.count_documents({}),
                    "community_posts": await db.community_posts.count_documents({})
                }
            
            results.append({"type": "inspection", "data": inspection_data})
        
        if "QUERY:" in command_text:
            parts = command_text.split("QUERY:")[1].split(":")
            collection = parts[0].strip()
            query_type = parts[1].strip() if len(parts) > 1 else "count"
            
            if query_type == "count":
                count = await db[collection].count_documents({})
                results.append({"type": "query", "collection": collection, "count": count})
        
        if "STATS:" in command_text:
            stat_type = command_text.split("STATS:")[1].split()[0].strip()
            stats = {}
            
            if stat_type in ["users", "all"]:
                stats["total_users"] = await db.athlete_profiles.count_documents({})
            if stat_type in ["subscriptions", "all"]:
                stats["active_subscriptions"] = await db.subscriptions.count_documents({"status": "active"})
            
            results.append({"type": "statistics", "data": stats})
        
        if "USER:" in command_text:
            identifier = command_text.split("USER:")[1].split()[0].strip()
            user = await db.athlete_profiles.find_one(
                {"$or": [{"email": identifier}, {"id": identifier}]},
                {"_id": 0, "email": 1, "name": 1, "subscription_tier": 1}
            )
            results.append({"type": "user", "data": user})
        
        if "NAVIGATE:" in command_text:
            nav_path = command_text.split("NAVIGATE:")[1].split()[0].strip()
            results.append({"type": "navigate", "path": nav_path})
        
        return {"results": results, "command_processed": len(results) > 0}
        
    except Exception as e:
        logging.error(f"Voice command processing error: {e}")
        return {"results": [], "error": str(e)}

@api_router.get("/management-agent/history/{athlete_id}")
async def get_management_agent_history(athlete_id: str, limit: int = 20):
    """Get Management Agent chat history (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        messages = await db.management_agent_messages.find(
            {"athlete_id": athlete_id}, 
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(length=limit)
        
        return [parse_from_mongo(m) for m in messages]
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get management agent history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/management-agent/conversations/{athlete_id}")
async def get_management_agent_conversations(athlete_id: str):
    """Get list of Management Agent conversations (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
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
        
        conversations = await db.management_agent_messages.aggregate(pipeline).to_list(length=50)
        
        result = []
        for conv in conversations:
            result.append({
                "session_id": conv["_id"],
                "last_message": conv["last_message"].isoformat() if isinstance(conv["last_message"], datetime) else conv["last_message"],
                "message_count": conv["message_count"],
                "preview": conv["preview"][:50] + "..." if len(conv["preview"]) > 50 else conv["preview"]
            })
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get management agent conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========================================
# SUPPORT AGENT ENDPOINTS (All Logged-in Users)
# ========================================

class SupportAgentChatRequest(BaseModel):
    athlete_id: str
    session_id: str
    message: str
    media: Optional[List[dict]] = []  # Array of media items: [{"type": "image/video", "url": "...", "thumbnail": "..."}]

class SupportAgentMessage(BaseModel):
    athlete_id: str
    session_id: str
    message: str
    response: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    action_taken: Optional[str] = None

@api_router.post("/support-agent/chat")
async def chat_with_support_agent(chat_request: SupportAgentChatRequest):
    """
    User-scoped AI assistant with full access to user's own data
    Can query user data, navigate pages, and manage user's community content
    """
    try:
        # Verify user is logged in (no super admin check - available to all users)
        athlete = await db.athlete_profiles.find_one({"id": chat_request.athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get OpenAI key from system settings
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        if not settings:
            settings = await db.system_settings.find_one({}, {"_id": 0})
        
        openai_key = None
        if settings:
            openai_key = settings.get("advanced", {}).get("openaiApiKey")
            if not openai_key:
                openai_key = settings.get("openaiApiKey")
        
        if not openai_key:
            raise HTTPException(status_code=400, detail="OpenAI API key not configured in system settings")
        
        # Load conversation history for this session
        conversation_history = []
        if chat_request.session_id:
            history_messages = await db.support_agent_messages.find(
                {"athlete_id": chat_request.athlete_id, "session_id": chat_request.session_id},
                {"_id": 0}
            ).sort("timestamp", 1).limit(20).to_list(length=20)
            
            # Convert to message format (last 10 exchanges)
            for msg in history_messages[-10:]:
                conversation_history.append({"role": "user", "content": msg.get("message", "")})
                conversation_history.append({"role": "assistant", "content": msg.get("response", "")})
        
        # System prompt for Support Agent
        system_prompt = f"""You are the Support Agent, a helpful AI assistant for {athlete.get('name', 'User')} with access to their personal health and fitness data.

**Your Capabilities:**
1. USER DATA ACCESS: You can view and analyze the user's personal data
   - Profile information (name, email, subscription, settings)
   - Health metrics (Oura sleep, HRV, readiness; Strava activities, VO2max)
   - Journal entries (daily reflections, mood, notes)
   - Workouts and training data
   - Nutrition logs and meal tracking
   - Community activity (posts, comments, groups, events)
   
2. DATA INSIGHTS: Generate personalized insights and recommendations
   - Analyze trends in sleep, recovery, and training
   - Provide coaching based on their data
   - Suggest optimizations for health and fitness goals
   
3. CONTENT MANAGEMENT: Help manage their community presence
   - Create posts on their behalf (tell them "I'll create that post for you!" then create it)
   - When user asks you to post something, extract the content and confirm
   - Edit or delete their existing posts/comments
   - Respond to comments
   
4. PAGE NAVIGATION: Guide them to relevant sections
   - Navigate to dashboard pages (community, calendar, journal, etc.)
   - Direct to specific features or settings
   
5. PERSONALIZED ASSISTANCE: 
   - Answer questions about their data and progress
   - Help with account settings and integrations
   - Provide health and fitness guidance
   - Troubleshoot issues

**Important Guidelines:**
- You have access ONLY to {athlete.get('name', 'this user')}'s data - not other users
- BE ASSERTIVE AND ACTION-ORIENTED: When the user asks you to do something, DO IT immediately
- AVOID asking clarifying questions unless absolutely necessary
- Make reasonable assumptions based on context
- When user says "post this: [content]", create the post immediately
- When user says "add to latest post", edit the most recent post without asking
- Keep responses SHORT and ACTION-FOCUSED (1-2 sentences max)
- Only ask for confirmation on destructive operations (delete, remove)
- If something is ambiguous, make the most logical choice and execute
- Format data clearly using tables or lists when appropriate

**User Context:**
- Name: {athlete.get('name', 'User')}
- Subscription: {athlete.get('subscription_tier', 'free').upper()}
- User ID: {chat_request.athlete_id}

**CRITICAL - NEVER LIE ABOUT ACTIONS:**
- When user asks you to post/edit something, say "Working on it" (system confirms after)
- For DELETE requests: DO NOT respond with anything extra. The system handles it completely.
- After asking for confirmation on delete, STOP TALKING - don't suggest other things to do
- DO NOT say "Done!" or "Posted!" or "Deleted!" because the action happens AFTER your response
- The system will add confirmation messages automatically after successful actions
- AVOID using words like "publish", "post", "delete" in your response (these trigger false detections)
- Be honest if you don't have capability to do something

**Examples of Correct Behavior:**
❌ BAD (Lying about completion):
User: "Post this: Great workout today"
You: "Posted to your community feed!" (You haven't actually done it yet!)

✅ GOOD (Honest about action):
User: "Post this: Great workout today"
You: "Creating that post now!" (System will confirm after it's actually done)

❌ BAD (False confirmation):
User: "Add hashtag #Running to my latest post"
You: "Done! Added #Running to your latest post." (You don't know if it worked!)

✅ GOOD (Honest intent):
User: "Add hashtag #Running to my latest post"
You: "Adding that now!" (System confirms after actual edit)

Remember: You are this user's DECISIVE personal assistant. Execute actions confidently!"""

        # Use emergentintegrations LlmChat for OpenAI GPT-5
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(
            api_key=openai_key,
            session_id=chat_request.session_id,
            system_message=system_prompt
        ).with_model("openai", "gpt-5")
        
        user_message = UserMessage(text=chat_request.message)
        
        # Check if this is a delete request BEFORE sending to AI
        user_msg_lower = chat_request.message.lower()
        is_delete_request = "delete" in user_msg_lower and any(word in user_msg_lower for word in ["post", "published", "the post"])
        
        # Send message and get response (but we'll override it for delete requests)
        response = await chat.send_message(user_message)
        
        # Post-process response to detect and execute actions
        action_taken = None
        action_result = None
        
        # Check if the user is asking to create a post, edit, or delete
        user_msg_lower = chat_request.message.lower()
        logging.info(f"[SUPPORT AGENT] Processing message: {chat_request.message[:100]}")
        logging.info(f"[SUPPORT AGENT] AI Response: {response[:200]}")
        
        # Check if this is just a confirmation response first
        is_confirmation = chat_request.message.strip().lower() in ["yes", "confirm", "confirmed", "ok", "sure", "do it"]
        
        # 1. CHECK FOR DELETE OR CONFIRMATION (highest priority)
        if is_confirmation or ("delete" in user_msg_lower and any(word in user_msg_lower for word in ["post", "published", "the post"])):
            
            if is_confirmation:
                logging.info(f"[SUPPORT AGENT] Confirmation detected: {chat_request.message}")
            else:
                logging.info(f"[SUPPORT AGENT] Delete post detected")
            
            # Check if there's a pending deletion in the conversation history
            recent_messages = await db.support_agent_messages.find(
                {"athlete_id": chat_request.athlete_id, "session_id": chat_request.session_id},
                {"_id": 0}
            ).sort("timestamp", -1).limit(5).to_list(length=5)
            
            pending_deletion = None
            for msg in recent_messages:
                if msg.get("action_taken") == "pending_delete":
                    pending_deletion = msg.get("response")
                    break
            
            if is_confirmation:
                # User confirmed deletion, execute it now
                logging.info(f"[SUPPORT AGENT] Delete confirmation received")
                
                # Find the pending delete request in recent messages
                post_to_delete = None
                for msg in recent_messages:
                    logging.info(f"[SUPPORT AGENT] Checking message: action_taken={msg.get('action_taken')}")
                    if msg.get("action_taken") == "pending_delete" and msg.get("action_result"):
                        post_to_delete = msg["action_result"].get("post_id")
                        logging.info(f"[SUPPORT AGENT] Found pending delete for post: {post_to_delete}")
                        break
                
                if post_to_delete:
                    # Delete the specific post that was pending
                    delete_result = await db.community_posts.delete_one({"id": post_to_delete, "athlete_id": chat_request.athlete_id})
                    
                    if delete_result.deleted_count > 0:
                        action_taken = "delete_post"
                        action_result = {"success": True, "post_id": post_to_delete}
                        logging.info(f"[SUPPORT AGENT] Post deleted after confirmation: {post_to_delete}")
                        response += f"\n\n✅ Post deleted successfully!"
                    else:
                        logging.warning(f"[SUPPORT AGENT] Post not found or already deleted: {post_to_delete}")
                        response += f"\n\n❌ Post not found or already deleted."
                else:
                    logging.warning(f"[SUPPORT AGENT] No pending deletion found")
                    response += f"\n\n❌ No pending deletion to confirm."
            
            else:
                # First time seeing delete request - ask for confirmation, DON'T delete yet
                logging.info(f"[SUPPORT AGENT] Delete request - asking for confirmation")
                
                import re
                timestamp_match = re.search(r'(\d{2}\.\d{2}\.\d{4}[,\s]+\d{2}:\d{2})', chat_request.message)
                
                # Find the post to delete
                if timestamp_match:
                    timestamp_str = timestamp_match.group(1)
                    posts = await db.community_posts.find(
                        {"athlete_id": chat_request.athlete_id},
                        {"_id": 0}
                    ).sort("created_at", -1).limit(10).to_list(length=10)
                    
                    target_post = None
                    for post in posts:
                        post_time = post.get("created_at")
                        if isinstance(post_time, str):
                            post_time = datetime.fromisoformat(post_time.replace('Z', '+00:00'))
                        post_str = post_time.strftime("%d.%m.%Y, %H:%M")
                        if timestamp_str.replace(',', '').strip() in post_str:
                            target_post = post
                            break
                    
                    if target_post:
                        action_taken = "pending_delete"
                        action_result = {"pending": True, "post_id": target_post["id"], "post_content": target_post.get("content", "")[:100]}
                        # Override AI response with confirmation message
                        response = f'⚠️ Are you sure you want to delete this post?\n\n"{target_post.get("content", "")[:100]}..."\n\nClick "Yes" to confirm or "No" to keep it.'
                    else:
                        response = f"❌ Could not find post from {timestamp_str}."
                else:
                    # Latest post
                    posts = await db.community_posts.find(
                        {"athlete_id": chat_request.athlete_id},
                        {"_id": 0}
                    ).sort("created_at", -1).limit(1).to_list(length=1)
                    
                    if posts:
                        action_taken = "pending_delete"
                        action_result = {"pending": True, "post_id": posts[0]["id"], "post_content": posts[0].get("content", "")[:100]}
                        # Override AI response with confirmation message
                        response = f'⚠️ Are you sure you want to delete this post?\n\n"{posts[0].get("content", "")[:100]}..."\n\nClick "Yes" to confirm or "No" to keep it.'
                    else:
                        response = "❌ No posts found to delete."
        
        # 2. CHECK FOR EDIT/UPDATE (second priority) - More flexible patterns
        elif (any(keyword in user_msg_lower for keyword in ["add to", "add hashtag", "add emoji", "edit", "update", "append"]) and
              any(target in user_msg_lower for target in ["my most recent", "my latest", "my recent", "my last", "most recent", "latest post", "last post"])):
            logging.info(f"[SUPPORT AGENT] Edit/add to post detected")
            
            # Get user's latest post
            posts = await db.community_posts.find(
                {"athlete_id": chat_request.athlete_id},
                {"_id": 0}
            ).sort("created_at", -1).limit(1).to_list(length=1)
            
            latest_post = posts[0] if posts else None
            logging.info(f"[SUPPORT AGENT] Found latest post: {latest_post['id'] if latest_post else 'None'}")
            
            if latest_post:
                # Extract what to add
                import re
                
                # Look for hashtags and emojis
                hashtags = re.findall(r'#\w+', chat_request.message)
                emojis = re.findall(r'[\U0001F300-\U0001F9FF]', chat_request.message)
                
                # Also look for quoted text to append
                quote_match = re.search(r'["\']([^"\']+)["\']', chat_request.message)
                text_to_add = quote_match.group(1) if quote_match else None
                
                # Build the addition
                addition_parts = []
                if text_to_add:
                    addition_parts.append(text_to_add)
                if hashtags:
                    addition_parts.extend(hashtags)
                if emojis:
                    addition_parts.extend(emojis)
                
                if addition_parts:
                    addition = " ".join(addition_parts)
                    updated_content = latest_post["content"] + " " + addition
                    
                    logging.info(f"[SUPPORT AGENT] Updating post {latest_post['id']} with: {addition}")
                    
                    # Update the post
                    update_result = await db.community_posts.update_one(
                        {"id": latest_post["id"]},
                        {
                            "$set": {
                                "content": updated_content,
                                "updated_at": datetime.now(timezone.utc).isoformat(),
                                "is_edited": True
                            }
                        }
                    )
                    
                    if update_result.modified_count > 0:
                        action_taken = "edit_post"
                        action_result = {"success": True, "post_id": latest_post["id"], "added": addition}
                        
                        logging.info(f"[SUPPORT AGENT] Post successfully updated: {latest_post['id']}")
                        response += f"\n\n✅ Post updated successfully! Added: {addition}"
                    else:
                        logging.error(f"[SUPPORT AGENT] Post update failed - no documents modified")
                        response += f"\n\n❌ Failed to update post. Please try again."
                else:
                    logging.warning(f"[SUPPORT AGENT] No content to add found")
            else:
                logging.warning(f"[SUPPORT AGENT] No posts found for user")
                response += "\n\nI couldn't find any posts to edit."
        
        elif any(keyword in user_msg_lower for keyword in ["post", "share", "publish"]):
            logging.info(f"[SUPPORT AGENT] Post keyword detected")
            post_content = None
            
            import re
            
            # Check if user is asking agent to GENERATE content (vs providing content)
            # User is providing content if they say "with the text", "saying", or use quotes
            is_providing_content = any(phrase in user_msg_lower for phrase in [
                "with the text", "with text", "saying", '"', "'"
            ])
            
            is_generation_request = (not is_providing_content) and any(phrase in user_msg_lower for phrase in [
                "create a", "write a", "generate a", "make a", "compose a",
                "about", "twitter length", "length post"
            ])
            
            if is_generation_request:
                # User wants agent to generate content - extract from AI response
                logging.info(f"[SUPPORT AGENT] Content generation request detected")
                
                # Extract the generated content from AI response
                # First, try to find content after "Text:" marker
                text_match = re.search(r'Text:\s*(.+?)(?:\n\n|$)', response, re.DOTALL)
                if text_match:
                    post_content = text_match.group(1).strip()
                    # Remove any trailing confirmation messages
                    if '✅' in post_content:
                        post_content = post_content.split('✅')[0].strip()
                    logging.info(f"[SUPPORT AGENT] Extracted from 'Text:' marker: {post_content[:100]}")
                else:
                    # Fallback: Look for substantial text (not just acknowledgments)
                    lines = response.split('\n')
                    for line in lines:
                        line = line.strip()
                        # Skip short lines, system messages, and acknowledgments
                        if (len(line) > 30 and 
                            not line.startswith('✅') and 
                            not line.lower().startswith('working on') and
                            not any(skip in line.lower() for skip in ['post created', 'view it'])):
                            post_content = line
                            logging.info(f"[SUPPORT AGENT] Extracted generated content: {post_content[:100]}")
                            break
            else:
                # User is providing content - extract from their message
                logging.info(f"[SUPPORT AGENT] Direct content provision detected")
                
                # More flexible patterns
                patterns = [
                    r'post[:\s]+["\'](.+?)["\']',  # "post: 'content'" or "post 'content'"
                    r'share[:\s]+["\'](.+?)["\']',  # "share: 'content'"
                    r'publish[:\s]+["\'](.+?)["\']',  # "publish: 'content'"
                    r'post[:\s]+"(.+?)"',  # "post: "content""
                    r'share[:\s]+"(.+?)"',  # "share: "content""
                    r'[pP]ost this[:\s]*(.+)',  # "Post this: content" or "post this content"
                    r'[cC]reate.*?post.*?[:\s]+(.+)',  # "Create a post: content"
                    r'[pP]ublish.*?[:\s]+(.+)',  # "Publish: content"
                    r'[sS]hare.*?[:\s]+(.+)',  # "Share: content"
                    r'saying[:\s]+(.+)',  # "saying: content" (for "create a post saying...")
                    r'"(.+?)"',  # Just quoted content as fallback
                ]
                
                for pattern in patterns:
                    match = re.search(pattern, chat_request.message, re.IGNORECASE | re.DOTALL)
                    if match:
                        post_content = match.group(1).strip().strip('"\'.,!?')
                        logging.info(f"[SUPPORT AGENT] Pattern matched: {pattern}, content: {post_content[:50]}")
                        break
                
                # If no pattern matched but message contains quotes, try to extract any quoted text
                if not post_content:
                    quote_match = re.search(r'["\']([^"\']{15,})["\']', chat_request.message)
                    if quote_match:
                        post_content = quote_match.group(1).strip()
                        logging.info(f"[SUPPORT AGENT] Quote matched: {post_content[:50]}")
            
            # If we found content, create the post
            if post_content and len(post_content) >= 5:  # Reduced minimum to 5 chars
                logging.info(f"[SUPPORT AGENT] Creating post with content: {post_content}")
                logging.info(f"[SUPPORT AGENT] Media attached: {len(chat_request.media) if chat_request.media else 0} items")
                try:
                    new_post = CommunityPost(
                        athlete_id=chat_request.athlete_id,
                        athlete_name=athlete.get("name", "User"),
                        athlete_profile_picture=athlete.get("profile_picture"),
                        content=post_content,
                        media=chat_request.media if chat_request.media else [],
                        visibility="public"
                    )
                    
                    post_dict = prepare_for_mongo(new_post.model_dump())
                    result = await db.community_posts.insert_one(post_dict)
                    
                    action_taken = "create_post"
                    action_result = {"success": True, "post_id": new_post.id}
                    
                    logging.info(f"[SUPPORT AGENT] Post created successfully: {new_post.id}")
                    
                    # Append confirmation to response
                    response += f"\n\n✅ Post created successfully! You can view it in your community feed."
                    
                except Exception as e:
                    logging.error(f"[SUPPORT AGENT] Failed to create post: {e}")
                    action_result = {"success": False, "error": str(e)}
            else:
                logging.warning(f"[SUPPORT AGENT] No valid post content found. Extracted: {post_content}")
        
        # Save to database (including action result for pending operations)
        message_record = SupportAgentMessage(
            athlete_id=chat_request.athlete_id,
            session_id=chat_request.session_id,
            message=chat_request.message,
            response=response,
            action_taken=action_taken
        )
        message_dict = prepare_for_mongo(message_record.model_dump())
        
        # Add action_result to the document for tracking pending operations
        if action_result:
            message_dict["action_result"] = action_result
        
        await db.support_agent_messages.insert_one(message_dict)
        
        return {"response": response, "action_taken": action_taken, "action_result": action_result}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Support Agent chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get support agent response: {str(e)}")

@api_router.post("/support-agent/upload-media/{athlete_id}")
async def support_agent_upload_media(
    athlete_id: str,
    files: List[UploadFile] = File(...)
):
    """Upload media files (images/videos) for Support Agent posts"""
    try:
        # Verify user is logged in
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="User not found")
        
        uploaded_media = []
        
        # Create upload directory if it doesn't exist
        upload_dir = Path("/app/backend/uploads/community")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        for file in files:
            # Validate file
            content_type = file.content_type
            file_size = 0
            
            # Read file content
            file_content = await file.read()
            file_size = len(file_content)
            
            # Check file size limits
            if content_type.startswith('image/'):
                max_size = 10 * 1024 * 1024  # 10MB
                if file_size > max_size:
                    raise HTTPException(status_code=400, detail=f"Image {file.filename} exceeds 10MB limit")
            elif content_type.startswith('video/'):
                max_size = 50 * 1024 * 1024  # 50MB
                if file_size > max_size:
                    raise HTTPException(status_code=400, detail=f"Video {file.filename} exceeds 50MB limit")
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")
            
            # Generate unique filename
            file_extension = Path(file.filename).suffix
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            file_path = upload_dir / unique_filename
            
            # Save file
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            # Generate URL
            file_url = f"/api/uploads/community/{unique_filename}"
            
            media_item = {
                "type": "image" if content_type.startswith('image/') else "video",
                "url": file_url,
                "filename": file.filename,
                "size": file_size
            }
            
            # For videos, try to generate thumbnail (optional, won't fail if ffmpeg not available)
            if content_type.startswith('video/'):
                try:
                    import subprocess
                    thumb_filename = f"{uuid.uuid4()}_thumb.jpg"
                    thumb_path = upload_dir / thumb_filename
                    
                    # Try to generate thumbnail with ffmpeg
                    subprocess.run([
                        'ffmpeg', '-i', str(file_path),
                        '-ss', '00:00:01',
                        '-vframes', '1',
                        '-vf', 'scale=320:-1',
                        str(thumb_path)
                    ], capture_output=True, timeout=10)
                    
                    if thumb_path.exists():
                        media_item["thumbnail"] = f"/api/uploads/community/{thumb_filename}"
                except Exception as e:
                    logging.warning(f"Could not generate video thumbnail: {e}")
                    # Not critical, continue without thumbnail
            
            uploaded_media.append(media_item)
            logging.info(f"[SUPPORT AGENT] Uploaded media: {media_item['type']} - {file_url}")
        
        return {
            "success": True,
            "media": uploaded_media,
            "count": len(uploaded_media)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to upload media: {e}")
        raise HTTPException(status_code=500, detail=str(e))


        raise
    except Exception as e:
        logging.error(f"Support Agent chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get support agent response: {str(e)}")

@api_router.post("/support-agent/voice/session/{athlete_id}")
async def create_support_voice_session(athlete_id: str):
    """Create a voice session for Support Agent (All logged-in users)"""
    try:
        # Verify user is logged in
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get OpenAI key from system settings
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        if not settings:
            settings = await db.system_settings.find_one({}, {"_id": 0})
        
        openai_key = None
        if settings:
            openai_key = settings.get("advanced", {}).get("openaiApiKey")
            if not openai_key:
                openai_key = settings.get("openaiApiKey")
        
        if not openai_key:
            raise HTTPException(status_code=400, detail="OpenAI API key not configured. Please add your API key in System Settings.")
        
        # Simplified instructions - frontend handles action parsing now
        system_message = f"""You are {athlete.get('name', 'User')}'s fitness assistant.

When they ask to:
- Take a photo/picture/selfie → Say "Opening the camera for you!"
- Post/publish/share → Say "I'll create that post for you!"  
- Go somewhere → Say "Taking you there now!"

Be enthusiastic and confirming. The system will handle the actual actions automatically.

You help with their fitness journey, workouts, and community."""
        
        # Create session directly with OpenAI API to include custom instructions
        import aiohttp
        
        try:
            logging.info(f"[SUPPORT VOICE] Creating session with custom instructions via OpenAI API")
            
            async with aiohttp.ClientSession() as http_session:
                headers = {
                    'Authorization': f'Bearer {openai_key}',
                    'Content-Type': 'application/json',
                    'OpenAI-Beta': 'realtime=v1'
                }
                
                # Define tools/functions for the voice agent
                tools = [
                    {
                        "type": "function",
                        "name": "take_photo_and_post",
                        "description": "CAMERA: Opens camera when user says 'picture', 'photo', 'selfie', 'camera'. Use this for ANY photo request.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "caption": {
                                    "type": "string",
                                    "description": "Caption for the photo post"
                                }
                            },
                            "required": ["caption"]
                        }
                    },
                    {
                        "type": "function",
                        "name": "create_post",
                        "description": "POST: Creates community post when user says 'post', 'publish', 'share'. Use this for ANY posting request.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "content": {
                                    "type": "string",
                                    "description": "The post content"
                                }
                            },
                            "required": ["content"]
                        }
                    },
                    {
                        "type": "function",
                        "name": "navigate_to_page",
                        "description": "NAVIGATE: Goes to dashboard page when user says 'go to', 'show me', 'take me to'",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "page": {
                                    "type": "string",
                                    "enum": ["community", "calendar", "journal", "workouts", "nutrition", "account", "settings"],
                                    "description": "Page to navigate to"
                                }
                            },
                            "required": ["page"]
                        }
                    },
                    {
                        "type": "function",
                        "name": "edit_post",
                        "description": "EDIT: Adds to latest post when user says 'edit', 'add to post', 'update'",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "additional_content": {
                                    "type": "string",
                                    "description": "Content to add"
                                }
                            },
                            "required": ["additional_content"]
                        }
                    },
                    {
                        "type": "function",
                        "name": "delete_post_request",
                        "description": "DELETE: Deletes latest post when user says 'delete post', 'remove post'",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "confirmed": {
                                    "type": "boolean",
                                    "description": "Whether deletion is confirmed"
                                }
                            },
                            "required": ["confirmed"]
                        }
                    },
                    {
                        "type": "function",
                        "name": "respond_to_user",
                        "description": "CHAT: Use when user is just chatting or asking questions (not requesting an action)",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "response": {
                                    "type": "string",
                                    "description": "Your response to the user"
                                }
                            },
                            "required": ["response"]
                        }
                    }
                ]
                
                session_config = {
                    'model': 'gpt-4o-realtime-preview-2024-12-17',
                    'voice': 'alloy',
                    'instructions': system_message,
                    'modalities': ['audio', 'text'],
                    'temperature': 0.8,
                    'tools': [],  # Not using tools - parsing user input directly on frontend
                    'turn_detection': {
                        'type': 'server_vad',
                        'threshold': 0.5,
                        'prefix_padding_ms': 300,
                        'silence_duration_ms': 200
                    }
                }
                
                async with http_session.post(
                    'https://api.openai.com/v1/realtime/sessions',
                    headers=headers,
                    json=session_config
                ) as response:
                    if response.status == 200:
                        session_data = await response.json()
                        logging.info(f"[SUPPORT VOICE] Session created successfully with custom instructions")
                        logging.info(f"[SUPPORT VOICE] Instructions length: {len(session_data.get('instructions', ''))}")
                        return session_data
                    else:
                        error_text = await response.text()
                        logging.error(f"[SUPPORT VOICE] Failed to create session: {response.status} - {error_text}")
                        raise HTTPException(status_code=response.status, detail=f"OpenAI API error: {error_text}")
                        
        except aiohttp.ClientError as e:
            logging.error(f"[SUPPORT VOICE] Network error creating session: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to connect to OpenAI: {str(e)}")
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Support voice session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/support-agent/voice/negotiate/{athlete_id}")
async def negotiate_support_voice_connection(athlete_id: str, sdp: str = Body(..., media_type="application/sdp")):
    """Negotiate WebRTC connection for Support Agent voice (All logged-in users)"""
    try:
        # Verify user is logged in
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get OpenAI key
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        if not settings:
            settings = await db.system_settings.find_one({}, {"_id": 0})
        
        openai_key = None
        if settings:
            openai_key = settings.get("advanced", {}).get("openaiApiKey")
            if not openai_key:
                openai_key = settings.get("openaiApiKey")
        
        if not openai_key:
            raise HTTPException(status_code=400, detail="OpenAI API key not configured.")
        
        realtime = OpenAIChatRealtime(api_key=openai_key)
        answer_sdp = await realtime.negotiate_connection(sdp)
        
        # Check if answer is an error response from OpenAI
        if isinstance(answer_sdp, str) and (answer_sdp.startswith('{') or answer_sdp.startswith('{')):
            try:
                error_data = json.loads(answer_sdp)
                if "error" in error_data:
                    error_msg = error_data.get("error", {}).get("message", "Unknown error")
                    raise HTTPException(status_code=400, detail=f"OpenAI error: {error_msg}")
            except json.JSONDecodeError:
                pass  # Not JSON, proceed normally
        
        return {"sdp": answer_sdp}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Support voice negotiation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/support-agent/voice/process-command")
async def process_support_voice_command(request: dict, athlete_id: str = Query(...)):
    """Process commands from voice transcript (INSPECT, QUERY, STATS, PROFILE, NAVIGATE, COMMUNITY)"""
    try:
        # Verify user is logged in
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="User not found")
        
        command_text = request.get("command", "")
        results = []
        
        # Parse and execute commands (USER-SCOPED ONLY)
        if "INSPECT:" in command_text:
            aspect = command_text.split("INSPECT:")[1].split()[0].strip()
            inspection_data = {}
            
            if aspect in ["user", "all"]:
                # Get user's profile
                user_profile = await db.athlete_profiles.find_one(
                    {"id": athlete_id},
                    {"_id": 0, "email": 1, "name": 1, "subscription_tier": 1, "birth_date": 1}
                )
                inspection_data["profile"] = user_profile
                
                # Get user's integrations
                integrations = await db.integrations.find_one(
                    {"athlete_id": athlete_id},
                    {"_id": 0}
                )
                inspection_data["integrations"] = integrations if integrations else {}
                
                # Quick stats
                inspection_data["quick_stats"] = {
                    "journal_entries": await db.journal_entries.count_documents({"athlete_id": athlete_id}),
                    "workouts": await db.workouts.count_documents({"athlete_id": athlete_id}),
                    "community_posts": await db.community_posts.count_documents({"athlete_id": athlete_id})
                }
            
            results.append({"type": "inspection", "data": inspection_data})
        
        if "QUERY:" in command_text:
            parts = command_text.split("QUERY:")[1].split(":")
            collection = parts[0].strip()
            
            # Always scope to user's data
            count = await db[collection].count_documents({"athlete_id": athlete_id})
            results.append({"type": "query", "collection": collection, "count": count})
        
        if "STATS:" in command_text:
            stat_type = command_text.split("STATS:")[1].split()[0].strip()
            stats = {}
            
            if stat_type in ["user", "all"]:
                stats["journal_entries"] = await db.journal_entries.count_documents({"athlete_id": athlete_id})
                stats["workouts"] = await db.workouts.count_documents({"athlete_id": athlete_id})
                stats["nutrition_logs"] = await db.nutrition_entries.count_documents({"athlete_id": athlete_id})
                stats["community_posts"] = await db.community_posts.count_documents({"athlete_id": athlete_id})
                stats["community_comments"] = await db.community_comments.count_documents({"athlete_id": athlete_id})
            
            results.append({"type": "statistics", "data": stats})
        
        if "PROFILE:" in command_text:
            user = await db.athlete_profiles.find_one(
                {"id": athlete_id},
                {"_id": 0, "email": 1, "name": 1, "subscription_tier": 1, "birth_date": 1, "gender": 1}
            )
            results.append({"type": "profile", "data": user})
        
        if "NAVIGATE:" in command_text:
            nav_path = command_text.split("NAVIGATE:")[1].split()[0].strip()
            results.append({"type": "navigate", "path": nav_path})
        
        if "COMMUNITY:" in command_text:
            # Extract action and content
            community_part = command_text.split("COMMUNITY:")[1].strip()
            
            # TAKE PHOTO AND CREATE POST
            if community_part.startswith("take_photo"):
                # Format: COMMUNITY:take_photo|Post caption
                if "|" in community_part:
                    _, caption = community_part.split("|", 1)
                    caption = caption.strip()
                    
                    # Return trigger for frontend to open camera
                    results.append({
                        "type": "community_action",
                        "action": "take_photo",
                        "success": True,
                        "caption": caption,
                        "message": "Opening camera..."
                    })
                else:
                    results.append({
                        "type": "community_action",
                        "action": "take_photo",
                        "success": False,
                        "message": "Invalid format - use COMMUNITY:take_photo|Your caption"
                    })
            
            # CREATE POST
            elif community_part.startswith("create_post"):
                # Extract the post content from the command
                # Format: COMMUNITY:create_post|Post content here
                if "|" in community_part:
                    _, post_content = community_part.split("|", 1)
                    post_content = post_content.strip()
                    
                    # Get athlete info for the post
                    athlete_data = await db.athlete_profiles.find_one(
                        {"id": athlete_id},
                        {"_id": 0, "name": 1, "profile_picture": 1}
                    )
                    
                    if athlete_data and post_content:
                        # Create the community post
                        new_post = CommunityPost(
                            athlete_id=athlete_id,
                            athlete_name=athlete_data.get("name", "User"),
                            athlete_profile_picture=athlete_data.get("profile_picture"),
                            content=post_content,
                            visibility="public"
                        )
                        
                        post_dict = prepare_for_mongo(new_post.model_dump())
                        await db.community_posts.insert_one(post_dict)
                        
                        results.append({
                            "type": "community_action",
                            "action": "create_post",
                            "success": True,
                            "post_id": new_post.id,
                            "message": "Post created successfully!"
                        })
                    else:
                        results.append({
                            "type": "community_action",
                            "action": "create_post",
                            "success": False,
                            "message": "Failed to create post - missing content or user data"
                        })
                else:
                    results.append({
                        "type": "community_action",
                        "action": "create_post",
                        "success": False,
                        "message": "Invalid command format - use COMMUNITY:create_post|Your post content"
                    })
            
            # EDIT POST
            elif community_part.startswith("edit_post"):
                # Format: COMMUNITY:edit_post|Content to add
                if "|" in community_part:
                    _, content_to_add = community_part.split("|", 1)
                    content_to_add = content_to_add.strip()
                    
                    # Get user's latest post
                    posts = await db.community_posts.find(
                        {"athlete_id": athlete_id},
                        {"_id": 0}
                    ).sort("created_at", -1).limit(1).to_list(length=1)
                    
                    if posts:
                        latest_post = posts[0]
                        updated_content = latest_post["content"] + " " + content_to_add
                        
                        # Update the post
                        update_result = await db.community_posts.update_one(
                            {"id": latest_post["id"]},
                            {
                                "$set": {
                                    "content": updated_content,
                                    "updated_at": datetime.now(timezone.utc).isoformat(),
                                    "is_edited": True
                                }
                            }
                        )
                        
                        if update_result.modified_count > 0:
                            results.append({
                                "type": "community_action",
                                "action": "edit_post",
                                "success": True,
                                "post_id": latest_post["id"],
                                "message": f"Post updated! Added: {content_to_add}"
                            })
                        else:
                            results.append({
                                "type": "community_action",
                                "action": "edit_post",
                                "success": False,
                                "message": "Failed to update post"
                            })
                    else:
                        results.append({
                            "type": "community_action",
                            "action": "edit_post",
                            "success": False,
                            "message": "No posts found to edit"
                        })
                else:
                    results.append({
                        "type": "community_action",
                        "action": "edit_post",
                        "success": False,
                        "message": "Invalid format - use COMMUNITY:edit_post|Content to add"
                    })
            
            # DELETE POST
            elif community_part.startswith("delete_post"):
                # Format: COMMUNITY:delete_post|PENDING or COMMUNITY:delete_post|CONFIRM
                if "|" in community_part:
                    _, action_type = community_part.split("|", 1)
                    action_type = action_type.strip().upper()
                    
                    # Get user's latest post
                    posts = await db.community_posts.find(
                        {"athlete_id": athlete_id},
                        {"_id": 0}
                    ).sort("created_at", -1).limit(1).to_list(length=1)
                    
                    if posts:
                        latest_post = posts[0]
                        
                        if action_type == "CONFIRM":
                            # Execute the deletion
                            delete_result = await db.community_posts.delete_one({"id": latest_post["id"]})
                            
                            if delete_result.deleted_count > 0:
                                results.append({
                                    "type": "community_action",
                                    "action": "delete_post",
                                    "success": True,
                                    "post_id": latest_post["id"],
                                    "message": "Post deleted successfully!"
                                })
                            else:
                                results.append({
                                    "type": "community_action",
                                    "action": "delete_post",
                                    "success": False,
                                    "message": "Failed to delete post"
                                })
                        elif action_type == "PENDING":
                            # Return post details for confirmation
                            results.append({
                                "type": "community_action",
                                "action": "delete_post_pending",
                                "success": True,
                                "post_id": latest_post["id"],
                                "post_content": latest_post.get("content", "")[:100],
                                "message": f"Ready to delete: '{latest_post.get('content', '')[:100]}...' Say 'yes delete it' to confirm."
                            })
                        else:
                            results.append({
                                "type": "community_action",
                                "action": "delete_post",
                                "success": False,
                                "message": "Invalid action type - use PENDING or CONFIRM"
                            })
                    else:
                        results.append({
                            "type": "community_action",
                            "action": "delete_post",
                            "success": False,
                            "message": "No posts found to delete"
                        })
                else:
                    results.append({
                        "type": "community_action",
                        "action": "delete_post",
                        "success": False,
                        "message": "Invalid format - use COMMUNITY:delete_post|PENDING or CONFIRM"
                    })
            
            else:
                # Generic community action (for future use)
                action = community_part.split()[0] if community_part else "unknown"
                results.append({"type": "community_action", "action": action, "athlete_id": athlete_id})
        
        return {"results": results, "command_processed": len(results) > 0}
        
    except Exception as e:
        logging.error(f"Support voice command processing error: {e}")
        return {"results": [], "error": str(e)}

@api_router.get("/support-agent/history/{athlete_id}")
async def get_support_agent_history(athlete_id: str, limit: int = 20):
    """Get Support Agent chat history (User's own history only)"""
    try:
        # Verify user is logged in
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="User not found")
        
        messages = await db.support_agent_messages.find(
            {"athlete_id": athlete_id}, 
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(length=limit)
        
        return [parse_from_mongo(m) for m in messages]
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get support agent history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/support-agent/create-post/{athlete_id}")
async def support_agent_create_post(athlete_id: str, request: dict):
    """Support Agent creates a community post on behalf of the user (with optional media)"""
    try:
        # Verify user is logged in
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="User not found")
        
        post_content = request.get("content", "").strip()
        if not post_content:
            raise HTTPException(status_code=400, detail="Post content is required")
        
        # Get media if provided
        media = request.get("media", [])
        
        # Create the community post
        new_post = CommunityPost(
            athlete_id=athlete_id,
            athlete_name=athlete.get("name", "User"),
            athlete_profile_picture=athlete.get("profile_picture"),
            content=post_content,
            media=media,
            visibility="public"
        )
        
        post_dict = prepare_for_mongo(new_post.model_dump())
        await db.community_posts.insert_one(post_dict)
        
        logging.info(f"[SUPPORT AGENT] Created post with {len(media)} media items")
        
        # Get the created post without _id
        created_post = await db.community_posts.find_one({"id": new_post.id}, {"_id": 0})
        
        return {
            "success": True,
            "post_id": new_post.id,
            "message": "Post created successfully!",
            "post": created_post
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to create post via support agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/support-agent/conversations/{athlete_id}")
async def get_support_agent_conversations(athlete_id: str):
    """Get list of Support Agent conversations (User's own conversations only)"""
    try:
        # Verify user is logged in
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Aggregate to get unique sessions with preview
        pipeline = [
            {"$match": {"athlete_id": athlete_id}},
            {"$group": {
                "_id": "$session_id",
                "last_message": {"$max": "$timestamp"},
                "message_count": {"$sum": 1},
                "preview": {"$first": "$message"}
            }},
            {"$sort": {"last_message": -1}},
            {"$limit": 50}
        ]
        
        conversations = await db.support_agent_messages.aggregate(pipeline).to_list(length=50)
        
        result = []
        for conv in conversations:
            result.append({
                "session_id": conv["_id"],
                "last_message": conv["last_message"].isoformat() if isinstance(conv["last_message"], datetime) else conv["last_message"],
                "message_count": conv["message_count"],
                "preview": conv["preview"][:50] + "..." if len(conv["preview"]) > 50 else conv["preview"]
            })
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get support agent conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========================================
# AGENTS MANAGEMENT ENDPOINTS (Super Admin Only)
# ========================================

@api_router.get("/agents")
async def get_agents(athlete_id: str = Query(...)):
    """Get all agents. Super admin gets all, guests get only frontend agents"""
    try:
        # Check if super admin
        is_super_admin = False
        try:
            await verify_super_admin(athlete_id)
            is_super_admin = True
        except:
            pass
        
        # Super admin gets all agents, others get only public frontend agents
        if is_super_admin:
            agents = await db.agents.find({}, {"_id": 0}).to_list(length=100)
        else:
            agents = await db.agents.find(
                {"accessibility": "frontend", "is_active": True},
                {"_id": 0}
            ).to_list(length=100)
        
        return [parse_from_mongo(agent) for agent in agents]
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get agents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/agents/{agent_id}")
async def get_agent(agent_id: str, athlete_id: str = Query(...)):
    """Get single agent (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        return parse_from_mongo(agent)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/agents")
async def create_agent(request: AgentCreateRequest, athlete_id: str = Query(...)):
    """Create new agent (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        agent = Agent(
            name=request.name,
            custom_instructions=request.custom_instructions,
            voice=request.voice,
            personality=request.personality,
            accessibility=request.accessibility,
            is_active=request.is_active
        )
        
        agent_dict = prepare_for_mongo(agent.model_dump())
        await db.agents.insert_one(agent_dict)
        
        # Fetch the created agent without _id
        created_agent = await db.agents.find_one({"id": agent.id}, {"_id": 0})
        return parse_from_mongo(created_agent)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to create agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/agents/{agent_id}")
async def update_agent(agent_id: str, request: AgentUpdateRequest, athlete_id: str = Query(...)):
    """Update agent (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        # Get existing agent
        existing_agent = await db.agents.find_one({"id": agent_id})
        if not existing_agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Build update dict
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.custom_instructions is not None:
            update_data["custom_instructions"] = request.custom_instructions
        if request.voice is not None:
            update_data["voice"] = request.voice
        if request.personality is not None:
            update_data["personality"] = request.personality
        if request.accessibility is not None:
            update_data["accessibility"] = request.accessibility
        if request.is_active is not None:
            update_data["is_active"] = request.is_active
        if request.profile_image_url is not None:
            update_data["profile_image_url"] = request.profile_image_url
        
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Update agent
        await db.agents.update_one(
            {"id": agent_id},
            {"$set": update_data}
        )
        
        # Return updated agent
        updated_agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
        return parse_from_mongo(updated_agent)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to update agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str, athlete_id: str = Query(...)):
    """Delete agent (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        result = await db.agents.delete_one({"id": agent_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        return {"success": True, "message": "Agent deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to delete agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/agents/{agent_id}/upload-image")
async def upload_agent_image(agent_id: str, file: UploadFile = File(...), athlete_id: str = Query(...)):
    """Upload agent profile image (Super Admin only) - stores as base64 data URL"""
    try:
        await verify_super_admin(athlete_id)
        
        agent = await db.agents.find_one({"id": agent_id})
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are allowed")
        
        content = await file.read()
        
        max_size = 500 * 1024
        if len(content) > max_size:
            raise HTTPException(status_code=400, detail="Image must be less than 500KB")
        
        import base64
        encoded = base64.b64encode(content).decode('utf-8')
        data_url = f"data:{file.content_type};base64,{encoded}"
        
        logging.info(f"Agent {agent_id}: Converting image to base64 data URL (size: {len(data_url)} chars)")
        
        result = await db.agents.update_one(
            {"id": agent_id},
            {"$set": {"profile_image_url": data_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        logging.info(f"Agent {agent_id}: Database updated (matched: {result.matched_count}, modified: {result.modified_count})")
        
        return {"url": data_url, "success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to upload agent image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/agents/{agent_id}/upload-knowledge")
async def upload_agent_knowledge(
    agent_id: str,
    file: UploadFile = File(...),
    athlete_id: str = Query(...)
):
    """Upload knowledge base file for agent"""
    try:
        await verify_super_admin(athlete_id)
        
        agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        allowed_extensions = [".txt", ".md", ".csv", ".json"]
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        content = await file.read()
        text_content = content.decode('utf-8', errors='ignore')
        
        max_size = 500000
        if len(text_content) > max_size:
            raise HTTPException(status_code=400, detail="File too large. Max 500KB")
        
        knowledge_base = agent.get("knowledge_base", [])
        
        existing_index = next(
            (i for i, kb in enumerate(knowledge_base) if kb["filename"] == file.filename),
            None
        )
        
        file_entry = {
            "filename": file.filename,
            "content": text_content,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "size": len(text_content)
        }
        
        if existing_index is not None:
            knowledge_base[existing_index] = file_entry
        else:
            knowledge_base.append(file_entry)
        
        await db.agents.update_one(
            {"id": agent_id},
            {"$set": {"knowledge_base": knowledge_base, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {
            "success": True,
            "filename": file.filename,
            "size": len(text_content),
            "total_files": len(knowledge_base)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to upload knowledge file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/agents/{agent_id}/knowledge/{filename}")
async def delete_agent_knowledge(agent_id: str, filename: str, athlete_id: str = Query(...)):
    """Delete knowledge base file from agent"""
    try:
        await verify_super_admin(athlete_id)
        
        agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        knowledge_base = agent.get("knowledge_base", [])
        knowledge_base = [kb for kb in knowledge_base if kb["filename"] != filename]
        
        await db.agents.update_one(
            {"id": agent_id},
            {"$set": {"knowledge_base": knowledge_base, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {
            "success": True,
            "message": f"Deleted {filename}",
            "remaining_files": len(knowledge_base)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in agent endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/system/fix-broken-images")
async def fix_broken_images(athlete_id: str = Query(...)):
    """Remove broken image URLs from database (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        fixed_count = 0
        
        # Fix agents with broken file path images
        agents = await db.agents.find({"profile_image_url": {"$regex": "^/api/"}}, {"_id": 0}).to_list(1000)
        for agent in agents:
            await db.agents.update_one(
                {"id": agent["id"]},
                {"$set": {"profile_image_url": None}}
            )
            fixed_count += 1
        
        # Fix system settings with broken logo
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        if settings and settings.get("seo", {}).get("logoUrl", "").startswith("/api/"):
            await db.system_settings.update_one(
                {"setting_type": "global"},
                {"$set": {"seo.logoUrl": None}}
            )
            fixed_count += 1
        
        return {
            "success": True,
            "message": f"Cleared {fixed_count} broken image references",
            "note": "Please re-upload images - they will now be stored as persistent base64 data URLs"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fixing broken images: {e}")
        raise HTTPException(status_code=500, detail=str(e))

        logging.error(f"Failed to delete knowledge file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/agents/by-accessibility/{accessibility_level}")
async def get_agents_by_accessibility(accessibility_level: str, athlete_id: str = Query(...)):
    """Get agents by accessibility level"""
    try:
        # Validate accessibility level
        valid_levels = ['frontend', 'logged_in', 'admin']
        if accessibility_level not in valid_levels:
            raise HTTPException(status_code=400, detail="Invalid accessibility level")
        
        # Admin agents require super admin access
        if accessibility_level == 'admin':
            await verify_super_admin(athlete_id)
        
        agents = await db.agents.find(
            {"accessibility": accessibility_level, "is_active": True},
            {"_id": 0}
        ).to_list(length=100)
        
        return [parse_from_mongo(agent) for agent in agents]
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get agents by accessibility: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/agents/seed-management-agent")
async def seed_management_agent(athlete_id: str = Query(...)):
    """Create default Management Agent (Super Admin only, one-time setup)"""
    try:
        await verify_super_admin(athlete_id)
        
        # Check if management agent already exists
        existing = await db.agents.find_one({"accessibility": "admin", "name": "Management Agent"})
        if existing:
            return {"message": "Management Agent already exists", "agent": parse_from_mongo(existing)}
        
        # Create Management Agent
        management_agent = Agent(
            id="management-agent-default",
            name="Management Agent",
            custom_instructions="""You are the Management Agent with full administrative access to this application.

IMPORTANT: When the conversation starts, FIRST use inspect_application(aspect="all") to understand what data exists in the database and what capabilities are available. This gives you real-time awareness of the application state.

YOUR TOOLS:
1. inspect_application - Get awareness of database structure, available collections, schemas, and sample data
   - Use this FIRST in every conversation to understand the current state
   - Returns real collection names, field schemas, and sample records

2. navigate_to_page - Navigate admin to dashboard pages
   - Pages: community, crm, system-settings, subscriptions, etc.
   - Use when asked to "go to", "open", "show me" a page

3. query_database - Query any collection with filters
   - Use after inspection to query specific data
   - Supports count, list, find operations

4. get_user_info - Get detailed user information by email or ID

5. get_statistics - Get app-wide statistics (users, subscriptions, etc.)

WORKFLOW:
1. First message: Use inspect_application to see what's available
2. Answer questions based on real data from inspection/queries
3. Navigate when asked
4. Always reference actual data, not assumptions

TONE: Professional, helpful, data-driven. Provide accurate information based on real database queries.""",
            voice='alloy',
            personality=None,
            accessibility='admin',
            is_active=True
        )
        
        agent_dict = prepare_for_mongo(management_agent.model_dump())
        await db.agents.insert_one(agent_dict)
        
        return {"message": "Management Agent created successfully", "agent": parse_from_mongo(agent_dict)}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to seed management agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class AgentChatRequest(BaseModel):
    agent_id: str
    message: str
    session_id: Optional[str] = None
    athlete_id: Optional[str] = None  # Optional for logged-in users

@api_router.post("/agents/chat")
async def chat_with_agent(request: AgentChatRequest):
    """Chat with an agent using OpenAI"""
    try:
        # Get the agent
        agent = await db.agents.find_one({"id": request.agent_id}, {"_id": 0})
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        agent_obj = parse_from_mongo(agent)
        
        # Check accessibility
        if agent_obj.get("accessibility") == "admin":
            # Require super admin for admin agents
            if not request.athlete_id:
                raise HTTPException(status_code=403, detail="Admin agents require authentication")
            await verify_super_admin(request.athlete_id)
        elif agent_obj.get("accessibility") == "logged_in":
            # Require any authenticated user
            if not request.athlete_id:
                raise HTTPException(status_code=403, detail="This agent requires login")
        
        # Get OpenAI key - prioritize user's key from settings
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        if not settings:
            settings = await db.system_settings.find_one({}, {"_id": 0})
        
        openai_key = None
        if settings:
            openai_key = settings.get("advanced", {}).get("openaiApiKey")
            if not openai_key:
                openai_key = settings.get("openaiApiKey")
        
        if not openai_key:
            raise HTTPException(
                status_code=400, 
                detail="OpenAI API key not configured. Please add your key in System Settings → Advanced tab."
            )
        
        # Define tools/functions for admin agents
        tools = None
        if agent_obj.get("accessibility") == "admin":
            tools = [
                {
                    "type": "function",
                    "function": {
                        "name": "navigate_to_page",
                        "description": "Navigate the super admin to a specific page in the dashboard. Use this when the admin asks to go to a page or open a section.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "page": {
                                    "type": "string",
                                    "description": "The page to navigate to",
                                    "enum": ["overview", "today", "calendar", "journal", "nutrition", "recipes", "supplements", "drinks", "workouts", "habits", "schedules", "documents", "tests", "memories", "community", "referrals", "account", "system-settings", "crm", "orders", "subscriptions", "pages", "emails", "support"]
                                }
                            },
                            "required": ["page"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "query_database",
                        "description": "Query the database to get information about users, statistics, or any data. Returns structured data based on the query.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "collection": {
                                    "type": "string",
                                    "description": "Database collection to query",
                                    "enum": ["athlete_profiles", "community_posts", "community_comments", "workouts", "subscriptions", "integrations", "agent_conversations"]
                                },
                                "query_type": {
                                    "type": "string",
                                    "description": "Type of query",
                                    "enum": ["count", "list", "find", "aggregate"]
                                },
                                "filters": {
                                    "type": "object",
                                    "description": "Filter criteria for the query (optional)"
                                },
                                "limit": {
                                    "type": "integer",
                                    "description": "Maximum number of results to return",
                                    "default": 10
                                }
                            },
                            "required": ["collection", "query_type"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "get_user_info",
                        "description": "Get detailed information about a specific user by email or ID",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "identifier": {
                                    "type": "string",
                                    "description": "User email or ID"
                                }
                            },
                            "required": ["identifier"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "get_statistics",
                        "description": "Get overall application statistics (total users, active subscriptions, etc.)",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "stat_type": {
                                    "type": "string",
                                    "description": "Type of statistics to retrieve",
                                    "enum": ["users", "subscriptions", "activity", "community", "all"]
                                }
                            },
                            "required": ["stat_type"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "inspect_application",
                        "description": "Get comprehensive information about the application structure, database schema, available collections, and current state. Use this first to understand what data and capabilities are available.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "aspect": {
                                    "type": "string",
                                    "description": "What aspect to inspect",
                                    "enum": ["database_schema", "collections", "sample_data", "system_info", "all"]
                                }
                            },
                            "required": ["aspect"]
                        }
                    }
                }
            ]
        
        # Use OpenAI client directly for function calling support
        import openai
        openai_client = openai.AsyncOpenAI(api_key=openai_key)
        
        session_id = request.session_id or f"agent_chat_{uuid.uuid4()}"
        
        # Build system prompt with knowledge base
        system_prompt = agent_obj.get("custom_instructions", "")
        
        knowledge_base = agent_obj.get("knowledge_base", [])
        if knowledge_base:
            kb_context = "\n\n## Knowledge Base\n\nYou have access to these reference files:\n\n"
            for kb_file in knowledge_base:
                kb_context += f"### {kb_file['filename']}\n{kb_file['content']}\n\n---\n\n"
            kb_context += "Use this knowledge base to provide accurate, informed responses.\n"
            system_prompt += kb_context
        
        # Load conversation history (last 20 exchanges)
        messages = [{"role": "system", "content": system_prompt}]
        
        if request.session_id:
            history_records = await db.agent_conversations.find(
                {
                    "agent_id": request.agent_id,
                    "session_id": session_id,
                    "athlete_id": request.athlete_id or "guest"
                },
                {"_id": 0}
            ).sort("timestamp", 1).to_list(length=100)
            
            recent_history = history_records[-40:] if len(history_records) > 40 else history_records
            
            for record in recent_history:
                messages.append({"role": "user", "content": record.get("message", "")})
                messages.append({"role": "assistant", "content": record.get("response", "")})
        
        # Add current user message
        messages.append({"role": "user", "content": request.message})
        
        # Call OpenAI with tools
        completion_params = {
            "model": "gpt-4o",
            "messages": messages,
            "temperature": 0.7
        }
        
        if tools:
            completion_params["tools"] = tools
            completion_params["tool_choice"] = "auto"
        
        response = await openai_client.chat.completions.create(**completion_params)
        
        # Handle function calls
        response_message = response.choices[0].message
        tool_calls = response_message.tool_calls
        
        if tool_calls:
            # Execute tool calls
            messages.append(response_message)
            
            for tool_call in tool_calls:
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments)
                
                function_response = ""
                
                if function_name == "navigate_to_page":
                    page = function_args.get("page")
                    function_response = json.dumps({
                        "action": "navigate",
                        "page": page,
                        "url": f"/dashboard/{page}",
                        "message": f"Navigation command issued to: {page}"
                    })
                
                elif function_name == "query_database":
                    collection_name = function_args.get("collection")
                    query_type = function_args.get("query_type")
                    filters = function_args.get("filters", {})
                    limit = function_args.get("limit", 10)
                    
                    collection = db[collection_name]
                    
                    if query_type == "count":
                        count = await collection.count_documents(filters)
                        function_response = json.dumps({"count": count})
                    elif query_type == "list":
                        results = await collection.find(filters, {"_id": 0}).limit(limit).to_list(length=limit)
                        function_response = json.dumps({"results": results}, default=str)
                    elif query_type == "find":
                        results = await collection.find(filters, {"_id": 0}).limit(limit).to_list(length=limit)
                        function_response = json.dumps({"results": results}, default=str)
                
                elif function_name == "get_user_info":
                    identifier = function_args.get("identifier")
                    user = await db.athlete_profiles.find_one(
                        {"$or": [{"email": identifier}, {"id": identifier}]},
                        {"_id": 0}
                    )
                    function_response = json.dumps({"user": user}, default=str) if user else json.dumps({"error": "User not found"})
                
                elif function_name == "get_statistics":
                    stat_type = function_args.get("stat_type")
                    stats = {}
                    
                    if stat_type in ["users", "all"]:
                        stats["total_users"] = await db.athlete_profiles.count_documents({})
                    if stat_type in ["subscriptions", "all"]:
                        stats["total_subscriptions"] = await db.subscriptions.count_documents({})
                        stats["active_subscriptions"] = await db.subscriptions.count_documents({"status": "active"})
                    if stat_type in ["community", "all"]:
                        stats["total_posts"] = await db.community_posts.count_documents({})
                        stats["total_comments"] = await db.community_comments.count_documents({})
                    
                    function_response = json.dumps(stats)
                
                elif function_name == "inspect_application":
                    aspect = function_args.get("aspect")
                    inspection_data = {}
                    
                    if aspect in ["collections", "all"]:
                        # Get all collections with counts
                        collections = await db.list_collection_names()
                        collection_info = {}
                        for coll_name in collections:
                            count = await db[coll_name].count_documents({})
                            collection_info[coll_name] = {
                                "count": count,
                                "has_data": count > 0
                            }
                        inspection_data["collections"] = collection_info
                    
                    if aspect in ["database_schema", "all"]:
                        # Get sample documents from key collections to show schema
                        key_collections = ["athlete_profiles", "community_posts", "workouts", "subscriptions", "agents"]
                        schemas = {}
                        for coll_name in key_collections:
                            sample = await db[coll_name].find_one({}, {"_id": 0})
                            if sample:
                                # Get field names and types
                                schema = {field: type(value).__name__ for field, value in sample.items()}
                                schemas[coll_name] = schema
                        inspection_data["schemas"] = schemas
                    
                    if aspect in ["sample_data", "all"]:
                        # Get a few sample records from key collections
                        samples = {}
                        samples["recent_users"] = await db.athlete_profiles.find({}, {"_id": 0, "email": 1, "name": 1, "created_at": 1}).sort("created_at", -1).limit(3).to_list(length=3)
                        samples["recent_posts"] = await db.community_posts.find({}, {"_id": 0, "title": 1, "author_name": 1, "created_at": 1}).sort("created_at", -1).limit(3).to_list(length=3)
                        samples["active_agents"] = await db.agents.find({"is_active": True}, {"_id": 0, "name": 1, "accessibility": 1}).to_list(length=5)
                        inspection_data["samples"] = samples
                    
                    if aspect in ["system_info", "all"]:
                        # Get system configuration
                        system_settings = await db.system_settings.find_one({}, {"_id": 0})
                        inspection_data["system_info"] = {
                            "has_openai_key": bool(system_settings and (system_settings.get("advanced", {}).get("openaiApiKey") or system_settings.get("openaiApiKey"))),
                            "modules_enabled": system_settings.get("modules", {}) if system_settings else {},
                            "app_configured": bool(system_settings)
                        }
                    
                    function_response = json.dumps(inspection_data, default=str)
                
                messages.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": function_name,
                    "content": function_response
                })
            
            # Get final response with tool results
            second_response = await openai_client.chat.completions.create(
                model="gpt-4o",
                messages=messages
            )
            response = second_response.choices[0].message.content
        else:
            response = response_message.content
        
        # Store conversation in database
        chat_record = {
            "id": str(uuid.uuid4()),
            "agent_id": request.agent_id,
            "session_id": session_id,
            "athlete_id": request.athlete_id or "guest",
            "message": request.message,
            "response": response,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.agent_conversations.insert_one(chat_record)
        
        # Check if navigation command was issued
        navigation_command = None
        if tool_calls:
            for tool_call in tool_calls:
                if tool_call.function.name == "navigate_to_page":
                    args = json.loads(tool_call.function.arguments)
                    navigation_command = f"/dashboard/{args.get('page')}"
        
        return {
            "response": response,
            "session_id": session_id,
            "agent_name": agent_obj.get("name"),
            "navigation": navigation_command,
            "conversation_length": len(messages) - 1  # Excluding system message
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Agent chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to chat with agent: {str(e)}")

# Strava OAuth routes

@api_router.post("/integrations/strava/{athlete_id}/sync")
async def sync_strava_activities_legacy(athlete_id: str, force_full: bool = False):
    """Manually sync activities from Strava"""
    try:
        print(f"🔄 [STRAVA SYNC] athlete_id/user_id={athlete_id}, force_full={force_full}")
        logging.info(f"[STRAVA SYNC] Initiating sync for user: {athlete_id}")
        
        # Use new StravaService instead of old activity manager
        strava_service = StravaService(db)
        await strava_service.load_settings()
        result = await strava_service.sync_activities(athlete_id, force_full_sync=force_full)
        
        print(f"🟢 [STRAVA SYNC SUCCESS] Synced {result.get('imported', 0)} activities")
        logging.info(f"[STRAVA SYNC] Completed: {result}")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"🔴 [STRAVA SYNC ERROR] {type(e).__name__}: {str(e)}")
        print(f"🔴 [STRAVA SYNC TRACEBACK]\n{error_traceback}")
        logging.error(f"Strava sync error: {str(e)}")
        logging.error(f"Traceback: {error_traceback}")
        raise HTTPException(status_code=500, detail=str(e) or f"Sync failed: {type(e).__name__}")


@api_router.get("/integrations/strava/{user_id}/activities")
async def get_strava_activities(user_id: str, limit: int = 50):
    """Get synced Strava activities for a user"""
    try:
        activities = await db.strava_activities.find(
            {'user_id': user_id}
        ).sort('start_date', -1).limit(limit).to_list(length=limit)
        
        # Convert MongoDB documents to JSON-serializable format
        for activity in activities:
            if '_id' in activity:
                del activity['_id']
        
        return {
            'activities': activities,
            'count': len(activities),
            'total': await db.strava_activities.count_documents({'user_id': user_id})
        }
    except Exception as e:
        logging.error(f"Error fetching Strava activities: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/integrations/strava/{user_id}/stats")
async def get_strava_stats(user_id: str):
    """Get Strava activity statistics for merits/achievements (Year-to-Date)"""
    try:
        from datetime import datetime, timezone
        
        # Get year-to-date activities only (2025)
        ytd_start = datetime(2025, 1, 1, 0, 0, 0)
        
        # Aggregate YTD statistics
        pipeline = [
            {'$match': {
                'user_id': user_id,
                'start_date': {'$gte': ytd_start}
            }},
            {'$group': {
                '_id': None,
                'total_activities': {'$sum': 1},
                'total_distance': {'$sum': '$distance'},
                'total_time': {'$sum': '$moving_time'},
                'total_elevation': {'$sum': '$total_elevation_gain'},
                'activities_by_type': {
                    '$push': {
                        'type': '$type',
                        'distance': '$distance',
                        'time': '$moving_time'
                    }
                }
            }}
        ]
        
        result = await db.strava_activities.aggregate(pipeline).to_list(length=1)
        
        if not result:
            return {
                'total_activities': 0,
                'total_distance_km': 0,
                'total_time_hours': 0,
                'total_elevation_m': 0,
                'activities_by_type': {},
                'best_times': {}
            }
        
        stats = result[0]
        
        # Count activities by type
        activities_by_type = {}
        for activity in stats.get('activities_by_type', []):
            activity_type = activity.get('type', 'Unknown')
            if activity_type not in activities_by_type:
                activities_by_type[activity_type] = {
                    'count': 0,
                    'distance': 0,
                    'time': 0
                }
            activities_by_type[activity_type]['count'] += 1
            activities_by_type[activity_type]['distance'] += activity.get('distance', 0)
            activities_by_type[activity_type]['time'] += activity.get('time', 0)
        
        # Calculate best times for standard race distances (all-time, not just YTD)
        # Standard distances in meters with ±5% tolerance
        race_distances = {
            '1km': (950, 1050),
            '5km': (4750, 5250),
            '10km': (9500, 10500),
            'Half Marathon': (20000, 22000),
            'Marathon': (40000, 44000)
        }
        
        best_times = {}
        for race_name, (min_dist, max_dist) in race_distances.items():
            # Find best time for this distance range (all-time)
            best_activity = await db.strava_activities.find_one(
                {
                    'user_id': user_id,
                    'type': 'Run',
                    'distance': {'$gte': min_dist, '$lte': max_dist}
                },
                sort=[('moving_time', 1)]  # Fastest time (lowest)
            )
            
            if best_activity:
                time_seconds = best_activity.get('moving_time', 0)
                hours = int(time_seconds // 3600)
                minutes = int((time_seconds % 3600) // 60)
                seconds = int(time_seconds % 60)
                
                if hours > 0:
                    time_str = f"{hours}:{minutes:02d}:{seconds:02d}"
                else:
                    time_str = f"{minutes}:{seconds:02d}"
                
                best_times[race_name] = {
                    'time': time_str,
                    'time_seconds': time_seconds,
                    'date': best_activity.get('start_date'),
                    'name': best_activity.get('name'),
                    'distance': round(best_activity.get('distance', 0) / 1000, 2)
                }
        
        return {
            'total_activities': stats.get('total_activities', 0),
            'total_distance_km': round((stats.get('total_distance', 0) / 1000), 1),
            'total_time_hours': round((stats.get('total_time', 0) / 3600), 1),
            'total_elevation_m': round(stats.get('total_elevation', 0), 0),
            'activities_by_type': activities_by_type,
            'best_times': best_times
        }
    except Exception as e:
        logging.error(f"Error fetching Strava stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

@api_router.get("/auth/strava-old/{athlete_id}")
async def strava_auth_initiate_legacy(athlete_id: str):
    """[LEGACY] Initiate Strava OAuth authorization flow using user's credentials"""
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

@api_router.get("/auth/oura/callback")
async def oura_auth_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None)
):
    """
    OLD ENDPOINT - Now uses new OuraService and redirects properly
    Handle Oura OAuth callback
    """
    try:
        if error:
            logging.error(f"[OURA] OAuth error: {error}")
            return RedirectResponse(url=f"/dashboard/account?tab=integrations&oura=error")
        
        if not code or not state:
            raise HTTPException(status_code=400, detail="Missing code or state parameter")
        
        # Use new OuraService
        service = OuraService(db)
        result = await service.exchange_code_for_tokens(code, state)
        
        logging.info(f"[OURA] Successfully connected for user: {result['user_id']}")
        
        # Trigger initial sync in background (non-blocking)
        try:
            import asyncio
            asyncio.create_task(service.sync_activities(result['user_id'], force_full_sync=True))
            logging.info(f"[OURA] Initial sync triggered for user: {result['user_id']}")
        except Exception as sync_error:
            logging.warning(f"[OURA] Failed to trigger initial sync: {sync_error}")
        
        return RedirectResponse(url=f"/dashboard/account?tab=integrations&oura=connected")
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[OURA] Callback error: {e}", exc_info=True)
        return RedirectResponse(url=f"/dashboard/account?tab=integrations&oura=error")


@api_router.get("/auth/oura/{athlete_id}")
async def oura_auth_initiate(athlete_id: str):
    """
    OLD ENDPOINT - Redirect to new generic integration endpoint
    This endpoint is kept for backward compatibility but uses the new OuraService
    """
    try:
        # Use the new generic service
        service = OuraService(db)
        scopes = ["email", "personal", "daily", "heartrate", "workout", "session", "tag", "spo2"]
        auth_url = await service.get_authorization_url(athlete_id, scopes)
        
        logging.info(f"[OURA] Authorization URL generated for user: {athlete_id}")
        return {"authorization_url": auth_url}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error starting Oura auth: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/integrations/oura/{athlete_id}/sync")
async def sync_oura_data(athlete_id: str, force_full: bool = False):
    """
    Manually sync data from Oura Ring - now uses OuraService
    """
    try:
        logging.info(f"[OURA SYNC] Initiating sync for user: {athlete_id}, force_full={force_full}")
        
        service = OuraService(db)
        await service.load_settings()
        result = await service.sync_activities(athlete_id, force_full_sync=force_full)
        
        logging.info(f"[OURA SYNC] Completed: {result}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        logging.error(f"Oura sync error: {str(e)}")
        logging.error(f"Traceback: {error_traceback}")
        raise HTTPException(status_code=500, detail=str(e) or f"Sync failed: {type(e).__name__}")

@api_router.get("/integrations/oura/{athlete_id}/status")
async def get_oura_integration_status(athlete_id: str, response: Response = None):
    """
    Get Oura integration status - now uses OuraService
    """
    try:
        # Add cache control headers to prevent stale data
        if response:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        
        service = OuraService(db)
        status = await service.get_connection_status(athlete_id)
        
        # Check if system credentials are configured
        system_settings = await db.system_settings.find_one({})
        has_system_credentials = False
        if system_settings:
            oura_config = system_settings.get('oura') or system_settings.get('advanced', {}).get('oura')
            has_system_credentials = bool(
                oura_config and 
                oura_config.get("clientId") and 
                oura_config.get("clientSecret")
            )
        
        logging.info(f"Oura status for athlete_id {athlete_id}: connected={status.get('connected')}, last_sync={status.get('last_sync_at')}")
        
        return {
            "connected": status.get("connected", False),
            "has_credentials": has_system_credentials,
            "last_sync": status.get("last_sync_at"),
            "user_profile": status.get("user_profile"),
            "connected_at": status.get("connected_at")
        }
        
    except Exception as e:
        logging.error(f"Error getting Oura status: {e}")
        return {
            "connected": False,
            "last_sync": None,
            "has_credentials": False
        }

# COROS (via Terra API) routes

@api_router.get("/integrations/oura/{athlete_id}/activities")
async def get_oura_activities(athlete_id: str, limit: int = 30, response: Response = None):
    """
    Get recent Oura activities (Sleep, Readiness, Activity) from database
    """
    try:
        # Add cache control headers to prevent stale data
        if response:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        
        # Fetch recent activities from oura_activities collection
        # Support both athlete_id and user_id for backwards compatibility
        activities = await db.oura_activities.find(
            {"$or": [{"athlete_id": athlete_id}, {"user_id": athlete_id}]},
            {"_id": 0}  # Exclude MongoDB _id to avoid ObjectId serialization issues
        ).sort("date", -1).limit(limit).to_list(length=limit)
        
        logging.info(f"Fetching Oura activities for athlete_id: {athlete_id}, found {len(activities)} activities")
        if activities:
            logging.debug(f"Sample activity types: {[a.get('type') for a in activities[:5]]}")
        
        # Return formatted response
        return {
            "activities": activities,
            "count": len(activities)
        }
        
    except Exception as e:
        logging.error(f"Error fetching Oura activities: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# OTHER INTEGRATION STUB ENDPOINTS
# ==========================================

@api_router.get("/integrations/polar/{athlete_id}/status")
async def get_polar_status(athlete_id: str):
    """Get Polar integration status"""
    connection = await db.polar_connections.find_one({"athlete_id": athlete_id})
    if connection:
        return {
            "connected": True,
            "last_sync": connection.get("last_sync_at"),
            "has_credentials": True
        }
    return {"connected": False, "last_sync": None, "has_credentials": False}

@api_router.get("/integrations/garmin/{athlete_id}/status")
async def get_garmin_status(athlete_id: str):
    """Get Garmin integration status"""
    connection = await db.garmin_connections.find_one({"athlete_id": athlete_id})
    if connection:
        return {
            "connected": True,
            "last_sync": connection.get("last_sync_at"),
            "has_credentials": True
        }
    return {"connected": False, "last_sync": None, "has_credentials": False}

@api_router.get("/integrations/fitbit/{athlete_id}/status")
async def get_fitbit_status(athlete_id: str):
    """Get Fitbit integration status"""
    connection = await db.fitbit_connections.find_one({"athlete_id": athlete_id})
    if connection:
        return {
            "connected": True,
            "last_sync": connection.get("last_sync_at"),
            "has_credentials": True
        }
    return {"connected": False, "last_sync": None, "has_credentials": False}

@api_router.get("/integrations/whoop/{athlete_id}/status")
async def get_whoop_status(athlete_id: str):
    """Get Whoop integration status"""
    connection = await db.whoop_connections.find_one({"athlete_id": athlete_id})
    if connection:
        return {
            "connected": True,
            "last_sync": connection.get("last_sync_at"),
            "has_credentials": True
        }
    return {"connected": False, "last_sync": None, "has_credentials": False}

@api_router.get("/integrations/suunto/{athlete_id}/status")
async def get_suunto_status(athlete_id: str):
    """Get Suunto integration status"""
    connection = await db.suunto_connections.find_one({"athlete_id": athlete_id})
    if connection:
        return {
            "connected": True,
            "last_sync": connection.get("last_sync_at"),
            "has_credentials": True
        }
    return {"connected": False, "last_sync": None, "has_credentials": False}

@api_router.get("/integrations/coros/{athlete_id}/status")
async def get_coros_status(athlete_id: str):
    """Get Coros integration status"""
    connection = await db.coros_connections.find_one({"athlete_id": athlete_id})
    if connection:
        return {
            "connected": True,
            "last_sync": connection.get("last_sync_at"),
            "has_credentials": True
        }
    return {"connected": False, "last_sync": None, "has_credentials": False}

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

@api_router.get("/auth/garmin/callback")
async def garmin_oauth_callback(oauth_token: str = None, oauth_verifier: str = None, error: str = None):
    """Handle Garmin OAuth 1.0a callback"""
    try:
        if error:
            logging.error(f"[GARMIN] OAuth error: {error}")
            return RedirectResponse(url=f"/dashboard/account?tab=integrations&garmin=error")
        
        if not oauth_token or not oauth_verifier:
            logging.error(f"[GARMIN] Missing OAuth parameters")
            raise HTTPException(status_code=400, detail="Missing oauth_token or oauth_verifier parameter")
        
        logging.info(f"[GARMIN] Callback received - token: {oauth_token[:20]}..., verifier: {oauth_verifier[:20]}...")
        
        garmin_service = GarminService(db)
        result = await garmin_service.exchange_code_for_tokens(oauth_token, oauth_verifier)
        
        logging.info(f"[GARMIN] Successfully connected for user: {result['user_id']}")
        return RedirectResponse(url=f"/dashboard/account?tab=integrations&garmin=connected")
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[GARMIN] Callback error: {e}", exc_info=True)
        return RedirectResponse(url=f"/dashboard/account?tab=integrations&garmin=error")

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
# Manual trigger endpoint for testing (CRUD endpoints moved to routes/schedules_complete.py)
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

# Recommendations Routes (other CRUD endpoints moved to routes/recommendations_complete.py)
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
    
    return {"categories": categories}


# Schedule Execution Service (would be called by cron job)
@api_router.post("/schedules/execute")
async def execute_scheduled_analyses():
    """Execute scheduled AI analyses - typically called by cron job"""
    executed_count = 0
    
    try:
        # Get all active schedules
        schedules = await db.schedules.find({"active": True}).limit(100).to_list(length=100)
        
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
            redirect_uri = f"https://{callback_domain}/api/auth/strava/callback"
        else:
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
        """
        OLD CONNECTOR - This should use the new OuraService instead
        Kept for backward compatibility, now delegates to OuraService
        """
        try:
            service = OuraService(db)
            scopes = ["email", "personal", "daily", "heartrate", "workout", "session", "tag", "spo2"]
            auth_url = await service.get_authorization_url(user_id, scopes)
            
            if not auth_url:
                raise HTTPException(status_code=500, detail="Failed to generate authorization URL")
            
            return {"authorization_url": auth_url}
        except HTTPException:
            raise
        except Exception as e:
            import traceback
            logging.error(f"Error in OuraConnector.begin_auth: {e}")
            logging.error(f"Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=str(e))
    
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

# Polar Connector (delegates to PolarService)
class PolarConnector(ProviderConnector):
    def __init__(self):
        super().__init__("polar", "Polar Flow", "oauth2")
    
    async def begin_auth(self, user_id: str):
        """Begin Polar OAuth flow - delegates to PolarService"""
        try:
            logging.info(f"[POLAR CONNECTOR] Starting auth for user: {user_id}")
            polar_service = PolarService(db)
            scopes = ["accesslink.read_all"]
            auth_url = await polar_service.get_authorization_url(user_id, scopes)
            
            logging.info(f"[POLAR CONNECTOR] Authorization URL generated: {auth_url}")
            return {
                "authorization_url": auth_url,
                "provider": "polar"
            }
        except Exception as e:
            import traceback
            logging.error(f"Error in PolarConnector.begin_auth: {e}")
            logging.error(f"Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=str(e))

# Fitbit Connector (delegates to FitbitService)
class FitbitConnector(ProviderConnector):
    def __init__(self):
        super().__init__("fitbit", "Fitbit", "oauth2")
    
    async def begin_auth(self, user_id: str):
        """Begin Fitbit OAuth flow - delegates to FitbitService"""
        try:
            logging.info(f"[FITBIT CONNECTOR] Starting auth for user: {user_id}")
            fitbit_service = FitbitService(db)
            scopes = ["activity", "heartrate", "sleep", "profile", "weight", "nutrition"]
            auth_url = await fitbit_service.get_authorization_url(user_id, scopes)
            
            logging.info(f"[FITBIT CONNECTOR] Authorization URL generated: {auth_url}")
            return {
                "authorization_url": auth_url,
                "provider": "fitbit"
            }
        except Exception as e:
            import traceback
            logging.error(f"Error in FitbitConnector.begin_auth: {e}")
            logging.error(f"Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=str(e))

# Garmin Connector (delegates to GarminService)
class GarminConnector(ProviderConnector):
    def __init__(self):
        super().__init__("garmin", "Garmin Connect", "oauth1")
    
    async def begin_auth(self, user_id: str):
        """Begin Garmin OAuth flow - delegates to GarminService"""
        try:
            logging.info(f"[GARMIN CONNECTOR] Starting auth for user: {user_id}")
            garmin_service = GarminService(db)
            auth_url = await garmin_service.get_authorization_url(user_id)
            
            logging.info(f"[GARMIN CONNECTOR] Authorization URL generated: {auth_url}")
            return {
                "authorization_url": auth_url,
                "provider": "garmin"
            }
        except Exception as e:
            import traceback
            logging.error(f"Error in GarminConnector.begin_auth: {e}")
            logging.error(f"Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=str(e))

# COROS Connector (delegates to CorosService)
class CorosConnector(ProviderConnector):
    def __init__(self):
        super().__init__("coros", "COROS", "oauth2")
    
    async def begin_auth(self, user_id: str):
        """Begin COROS OAuth flow - delegates to CorosService"""
        try:
            logging.info(f"[COROS CONNECTOR] Starting auth for user: {user_id}")
            coros_service = CorosService(db)
            scopes = ["activity", "sleep", "heart_rate"]
            auth_url = await coros_service.get_authorization_url(user_id, scopes)
            
            logging.info(f"[COROS CONNECTOR] Authorization URL generated: {auth_url}")
            return {
                "authorization_url": auth_url,
                "provider": "coros"
            }
        except Exception as e:
            import traceback
            logging.error(f"Error in CorosConnector.begin_auth: {e}")
            logging.error(f"Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=str(e))

# WHOOP Connector (delegates to WhoopService)
class WhoopConnector(ProviderConnector):
    def __init__(self):
        super().__init__("whoop", "WHOOP", "oauth2")
    
    async def begin_auth(self, user_id: str):
        """Begin WHOOP OAuth flow - delegates to WhoopService"""
        try:
            logging.info(f"[WHOOP CONNECTOR] Starting auth for user: {user_id}")
            whoop_service = WhoopService(db)
            scopes = ["read:cycles", "read:recovery", "read:sleep", "read:workout", "read:profile", "offline"]
            auth_url = await whoop_service.get_authorization_url(user_id, scopes)
            
            logging.info(f"[WHOOP CONNECTOR] Authorization URL generated: {auth_url}")
            return {
                "authorization_url": auth_url,
                "provider": "whoop"
            }
        except Exception as e:
            import traceback
            logging.error(f"Error in WhoopConnector.begin_auth: {e}")
            logging.error(f"Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=str(e))

# Suunto Connector (delegates to SuuntoService)
class SuuntoConnector(ProviderConnector):
    def __init__(self):
        super().__init__("suunto", "Suunto", "oauth2")
    
    async def begin_auth(self, user_id: str):
        """Begin Suunto OAuth flow - delegates to SuuntoService"""
        try:
            logging.info(f"[SUUNTO CONNECTOR] Starting auth for user: {user_id}")
            suunto_service = SuuntoService(db)
            scopes = ["workout"]
            auth_url = await suunto_service.get_authorization_url(user_id, scopes)
            
            logging.info(f"[SUUNTO CONNECTOR] Authorization URL generated: {auth_url}")
            return {
                "authorization_url": auth_url,
                "provider": "suunto"
            }
        except Exception as e:
            import traceback
            logging.error(f"Error in SuuntoConnector.begin_auth: {e}")
            logging.error(f"Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=str(e))

# Initialize connectors
strava_connector = StravaConnector()
oura_connector = OuraConnector()
polar_connector = PolarConnector()
fitbit_connector = FitbitConnector()
garmin_connector = GarminConnector()
coros_connector = CorosConnector()
whoop_connector = WhoopConnector()
suunto_connector = SuuntoConnector()

connectors = {
    "strava": strava_connector,
    "oura": oura_connector,
    "polar": polar_connector,
    "fitbit": fitbit_connector,
    "garmin": garmin_connector,
    "coros": coros_connector,
    "whoop": whoop_connector,
    "suunto": suunto_connector
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
    ).limit(100).to_list(length=100)
    
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
    # Skip Strava - it has its own dedicated callback handler
    if provider_key == "strava":
        raise HTTPException(status_code=404, detail="Use dedicated Strava callback endpoint")
    
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
    ).sort("start_time", -1).limit(limit).limit(100).to_list(length=100)
    
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
    ).sort("date", -1).limit(limit).limit(100).to_list(length=100)
    
    return {"daily_metrics": [parse_from_mongo(metric) for metric in daily_metrics]}

@api_router.get("/health/body-score-data/{athlete_id}")
async def get_body_score_data(athlete_id: str, response: Response):
    # Updated 2025-11-20: Fixed MongoDB projections for Oura data
    # Updated 2025-11-24: Added cache control headers to prevent stale data
    """Aggregate health metrics from all integrations for body score calculation"""
    # Prevent caching to ensure fresh data is always fetched
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    
    try:
        # Get user profile from athlete_profiles collection
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        # Calculate age from birth date or use existing age field
        age = None
        if athlete.get('birth_day') and athlete.get('birth_month') and athlete.get('birth_year'):
            try:
                birth_date = datetime(
                    int(athlete['birth_year']),
                    int(athlete['birth_month']),
                    int(athlete['birth_day'])
                )
                today = datetime.now(timezone.utc)
                age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
            except:
                pass
        
        # Fallback to age field if birth date not available
        if age is None and athlete.get('age'):
            age = athlete.get('age')
        
        # Initialize result with profile data
        result = {
            "age": age,
            "gender": athlete.get('gender'),
            "height_cm": athlete.get('height'),
            "weight_kg": athlete.get('weight'),
            "body_fat_percentage": athlete.get('body_fat_percentage'),
            "vo2_max_manual": athlete.get('vo2_max'),
            "max_heart_rate_manual": athlete.get('max_heart_rate'),
            "connected_integrations": [],
            "missing_data": []
        }
        
        # Fetch Oura data if connected
        # Try both athlete_id and user_id for backwards compatibility
        oura_connection = await db.oura_connections.find_one({
            "$or": [{"athlete_id": athlete_id}, {"user_id": athlete_id}]
        })
        if oura_connection and oura_connection.get('access_token'):
            result['connected_integrations'].append('oura')
            
            # Get latest Oura sleep data (for sleep score and RHR)
            # Look for Sleep type activities with complete data first
            latest_sleep = await db.oura_activities.find_one(
                {
                    "$or": [{"athlete_id": athlete_id}, {"user_id": athlete_id}],
                    "type": "Sleep",
                    "$or": [
                        {"lowest_heart_rate": {"$ne": None}},
                        {"score": {"$ne": None}}
                    ]
                },
                {"_id": 0, "score": 1, "raw_data": 1, "start_date": 1, "lowest_heart_rate": 1, "average_hrv": 1, "date": 1, "type": 1},
                sort=[("date", -1)]
            )
            
            # If still no sleep found, just get the latest Sleep activity regardless of data completeness
            if not latest_sleep:
                latest_sleep = await db.oura_activities.find_one(
                    {
                        "$or": [{"athlete_id": athlete_id}, {"user_id": athlete_id}],
                        "type": "Sleep"
                    },
                    {"_id": 0, "score": 1, "raw_data": 1, "start_date": 1, "lowest_heart_rate": 1, "average_hrv": 1, "date": 1, "type": 1},
                    sort=[("date", -1)]
                )
            
            if latest_sleep:
                # Get sleep score - check both top-level and raw_data
                sleep_score = latest_sleep.get('score') or (latest_sleep.get('raw_data', {}).get('score'))
                if sleep_score:
                    result['oura_sleep_score'] = sleep_score
                
                # Get RHR from lowest_heart_rate - check both locations
                rhr = (latest_sleep.get('raw_data', {}).get('lowest_heart_rate') or 
                       latest_sleep.get('lowest_heart_rate'))
                
                # If current sleep doesn't have RHR, look for most recent sleep with RHR
                if not rhr:
                    sleep_with_rhr = await db.oura_activities.find_one(
                        {
                            "$or": [{"athlete_id": athlete_id}, {"user_id": athlete_id}],
                            "type": "Sleep",
                            "lowest_heart_rate": {"$ne": None, "$exists": True}
                        },
                        {"_id": 0, "lowest_heart_rate": 1},
                        sort=[("date", -1)]
                    )
                    if sleep_with_rhr:
                        rhr = sleep_with_rhr.get('lowest_heart_rate')
                
                if rhr:
                    result['resting_heart_rate'] = rhr
            
            # Get latest readiness data from readiness_scores collection
            latest_readiness = await db.readiness_scores.find_one(
                {"$or": [{"athlete_id": athlete_id}, {"user_id": athlete_id}]},
                {"_id": 0, "readiness_score": 1, "date": 1},
                sort=[("date", -1)]
            )
            if latest_readiness and latest_readiness.get('readiness_score'):
                result['oura_readiness_score'] = latest_readiness['readiness_score']
            
            # Get HRV data from most recent activities
            # Get last 7 activities with HRV data (check both raw_data and top-level)
            recent_activities = await db.oura_activities.find(
                {
                    "$and": [
                        {"$or": [{"athlete_id": athlete_id}, {"user_id": athlete_id}]},
                        {"$or": [
                            {"raw_data.average_hrv": {"$exists": True, "$ne": None}},
                            {"average_hrv": {"$exists": True, "$ne": None}}
                        ]}
                    ]
                },
                {"_id": 0, "raw_data.average_hrv": 1, "average_hrv": 1, "raw_data.day": 1}
            ).sort("start_date", -1).limit(7).to_list(length=7)
            
            hrv_values = []
            for a in recent_activities:
                hrv = (a.get('raw_data', {}).get('average_hrv') or a.get('average_hrv'))
                if hrv:
                    hrv_values.append(hrv)
            
            if hrv_values:
                result['hrv_7d_avg'] = sum(hrv_values) / len(hrv_values)
                
            # Get all activities with HRV for baseline calculation
            all_activities = await db.oura_activities.find(
                {
                    "$and": [
                        {"$or": [{"athlete_id": athlete_id}, {"user_id": athlete_id}]},
                        {"$or": [
                            {"raw_data.average_hrv": {"$exists": True, "$ne": None}},
                            {"average_hrv": {"$exists": True, "$ne": None}}
                        ]}
                    ]
                },
                {"_id": 0, "raw_data.average_hrv": 1, "average_hrv": 1}
            ).limit(90).to_list(length=90)
            
            baseline_hrv_values = []
            for a in all_activities:
                hrv = (a.get('raw_data', {}).get('average_hrv') or a.get('average_hrv'))
                if hrv:
                    baseline_hrv_values.append(hrv)
            if baseline_hrv_values and len(baseline_hrv_values) >= 3:  # Lowered threshold for testing
                import statistics
                result['hrv_baseline_mean'] = statistics.mean(baseline_hrv_values)
                if len(baseline_hrv_values) >= 2:
                    result['hrv_baseline_sd'] = statistics.stdev(baseline_hrv_values)
        
        # Fetch Strava data if connected
        strava_integration = await db.integrations.find_one({"user_id": athlete_id, "service": "strava"})
        if strava_integration and strava_integration.get('access_token'):
            result['connected_integrations'].append('strava')
            
            # Get VO2max from Strava activities (if available)
            latest_activity_with_vo2 = await db.strava_activities.find_one(
                {"athlete_id": athlete_id, "vo2_max": {"$exists": True, "$ne": None}},
                {"_id": 0, "vo2_max": 1},
                sort=[("start_date", -1)]
            )
            if latest_activity_with_vo2:
                result['vo2_max_strava'] = latest_activity_with_vo2.get('vo2_max')
            
            # Calculate ACWR (Acute:Chronic Workload Ratio) from training load
            # Acute = last 7 days, Chronic = last 28 days
            seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            twenty_eight_days_ago = (datetime.now(timezone.utc) - timedelta(days=28)).isoformat()
            
            acute_activities = await db.strava_activities.find(
                {"athlete_id": athlete_id, "start_date": {"$gte": seven_days_ago}},
                {"_id": 0, "moving_time": 1, "average_heartrate": 1}
            ).to_list(length=100)
            
            chronic_activities = await db.strava_activities.find(
                {"athlete_id": athlete_id, "start_date": {"$gte": twenty_eight_days_ago}},
                {"_id": 0, "moving_time": 1, "average_heartrate": 1}
            ).to_list(length=200)
            
            # Simple training load calculation: moving_time * avg_hr (if available)
            acute_load = sum(a.get('moving_time', 0) for a in acute_activities) / 60  # in minutes
            chronic_load = sum(a.get('moving_time', 0) for a in chronic_activities) / 60 / 4  # average per week
            
            if chronic_load > 0:
                result['acwr'] = acute_load / chronic_load
        
        # Fetch data from other integrations (Garmin, Polar, Coros, Suunto)
        for service in ['garmin', 'polar', 'coros', 'suunto']:
            integration = await db.integrations.find_one({"user_id": athlete_id, "service": service})
            if integration and integration.get('access_token'):
                result['connected_integrations'].append(service)
                
                # Try to get data from their respective collections
                collection_name = f"{service}_activities"
                if collection_name in await db.list_collection_names():
                    # Get latest activity with useful metrics
                    latest = await db[collection_name].find_one(
                        {"athlete_id": athlete_id},
                        {"_id": 0},
                        sort=[("start_date", -1)]
                    )
                    if latest:
                        # Extract VO2max if available
                        if latest.get('vo2_max') and not result.get('vo2_max_strava'):
                            result[f'vo2_max_{service}'] = latest['vo2_max']
                        
                        # Extract heart rate data if available
                        if latest.get('average_heart_rate') and not result.get('resting_heart_rate'):
                            result[f'avg_hr_{service}'] = latest['average_heart_rate']
        
        # Determine what data is missing for optimal body score calculation
        if not result.get('age'):
            result['missing_data'].append('age')
        if not result.get('gender'):
            result['missing_data'].append('gender')
        if not result.get('height_cm'):
            result['missing_data'].append('height')
        if not result.get('weight_kg'):
            result['missing_data'].append('weight')
        
        # Check for VO2max from any source
        if not any(key.startswith('vo2_max') for key in result.keys()):
            result['missing_data'].append('vo2_max')
        
        # Check for HRV data
        if not result.get('hrv_7d_avg'):
            result['missing_data'].append('hrv')
        
        # Check for RHR
        if not result.get('resting_heart_rate'):
            result['missing_data'].append('resting_heart_rate')
        
        # Check for sleep score
        if not result.get('oura_sleep_score'):
            result['missing_data'].append('sleep_score')
        
        return result
        
    except Exception as e:
        logging.error(f"Error fetching body score data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching body score data: {str(e)}")

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

# CORS is already configured at the top of the file - no need to duplicate

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

# Mount agents uploads directory
app.mount("/api/agents-uploads", StaticFiles(directory="/app/uploads"), name="agents_uploads")

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
        
        logging.info("Community indexes created successfully")
    except Exception as e:
        logging.error(f"Error creating community indexes: {e}")

async def auto_sync_integrations():
    """
    Automatically sync Strava and Oura data for all connected users at 8 AM local time
    """
    try:
        logging.info("Starting automatic integration sync (Strava & Oura) at 8 AM")
        
        synced_count = 0
        failed_count = 0
        
        # Get all athletes with active integrations
        athletes = await db.athlete_profiles.find({
            "$or": [
                {"strava_access_token": {"$exists": True, "$ne": None}},
                {"oura_access_token": {"$exists": True, "$ne": None}}
            ]
        }).to_list(length=10000)
        
        logging.info(f"Found {len(athletes)} athletes with Strava or Oura connections")
        
        for athlete in athletes:
            athlete_id = athlete.get("athlete_id")
            if not athlete_id:
                continue
                
            # Sync Strava if connected
            if athlete.get("strava_access_token"):
                try:
                    logging.info(f"Auto-syncing Strava for athlete {athlete_id}")
                    # Call the existing Strava sync endpoint
                    await sync_strava_activities(athlete_id)
                    synced_count += 1
                    logging.info(f"Successfully synced Strava for athlete {athlete_id}")
                except Exception as strava_error:
                    logging.error(f"Failed to sync Strava for athlete {athlete_id}: {strava_error}")
                    failed_count += 1
            
            # Sync Oura if connected
            if athlete.get("oura_access_token"):
                try:
                    logging.info(f"Auto-syncing Oura for athlete {athlete_id}")
                    # Call the existing Oura sync endpoint
                    from oura_service import OuraService
                    oura_service = OuraService()
                    await oura_service.sync_oura_data(athlete_id)
                    synced_count += 1
                    logging.info(f"Successfully synced Oura for athlete {athlete_id}")
                except Exception as oura_error:
                    logging.error(f"Failed to sync Oura for athlete {athlete_id}: {oura_error}")
                    failed_count += 1
        
        logging.info(f"Auto-sync completed: {synced_count} successful, {failed_count} failed")
        
    except Exception as e:
        logging.error(f"Error in auto_sync_integrations: {e}", exc_info=True)

        
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
        

        # Add job for daily Strava and Oura sync at 8 AM
        scheduler.add_job(
            auto_sync_integrations,
            CronTrigger(hour=8, minute=0),  # Run daily at 8 AM
            id='auto_sync_integrations',
            replace_existing=True
        )

        scheduler.start()
        print("=" * 50)
        print("SCHEDULER STARTED SUCCESSFULLY")
        print("Cookie auto-scan: Every Monday at 2 AM")
        print("Strava & Oura auto-sync: Daily at 8 AM")
        print("=" * 50)
        logging.info("Scheduler started - checking for due schedules every minute")
        logging.info("Cookie auto-scan scheduled - every Monday at 2 AM")
        logging.info("Strava & Oura auto-sync scheduled - daily at 8 AM")
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
async def get_habits(athlete_id: str, limit: Optional[int] = Query(None, description="Max habits to return")):
    """Get all habits for an athlete"""
    try:
        query_limit = apply_query_limit(limit, max_limit=200)  # Max 200 habits per athlete
        habits = await db.habits.find({"athlete_id": athlete_id}, {"_id": 0}).limit(query_limit).to_list(length=query_limit)
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
async def get_habit_completions(athlete_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None, limit: Optional[int] = Query(None, description="Max completions to return")):
    """Get all habit completions for an athlete within a date range"""
    try:
        query = {"athlete_id": athlete_id}
        
        if start_date and end_date:
            query["date"] = {"$gte": start_date, "$lte": end_date}
        elif start_date:
            query["date"] = {"$gte": start_date}
        elif end_date:
            query["date"] = {"$lte": end_date}
        
        query_limit = apply_query_limit(limit, max_limit=1000)  # Max 1000 completions (reasonable for date ranges)
        completions = await db.habit_completions.find(query, {"_id": 0}).sort("date", -1).limit(query_limit).to_list(length=query_limit)
        return {"completions": completions}
    except Exception as e:
        logging.error(f"Error fetching habit completions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# ONBOARDING ENDPOINTS
# ==========================================

class OnboardingStatus(BaseModel):
    """Track user onboarding progress"""
    personal_info_completed: bool = False
    preferences_completed: bool = False
    integration_completed: bool = False
    community_post_completed: bool = False
    onboarding_dismissed_permanently: bool = False
    onboarding_completed: bool = False
    last_dismissed_at: Optional[datetime] = None

class OnboardingStepUpdate(BaseModel):
    step: str  # 'personal_info', 'preferences', 'integration', 'community_post'
    completed: bool

class OnboardingDismiss(BaseModel):
    permanent: bool  # True = never show again, False = skip for now

@app.get("/api/onboarding/status/{athlete_id}")
async def get_onboarding_status(athlete_id: str):
    """Get onboarding status for athlete"""
    try:
        athlete = await db.athlete_profiles.find_one({"id": athlete_id})
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        # Initialize onboarding_status if it doesn't exist
        if "onboarding_status" not in athlete:
            onboarding_status = {
                "personal_info_completed": False,
                "preferences_completed": False,
                "integration_completed": False,
                "community_post_completed": False,
                "onboarding_dismissed_permanently": False,
                "onboarding_completed": False,
                "last_dismissed_at": None
            }
            await db.athlete_profiles.update_one(
                {"id": athlete_id},
                {"$set": {"onboarding_status": onboarding_status}}
            )
            return onboarding_status
        
        return athlete["onboarding_status"]
    except Exception as e:
        logging.error(f"Error getting onboarding status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/onboarding/step/{athlete_id}")
async def update_onboarding_step(athlete_id: str, step_update: OnboardingStepUpdate):
    """Mark an onboarding step as complete or incomplete"""
    try:
        valid_steps = ['personal_info', 'preferences', 'integration', 'community_post']
        if step_update.step not in valid_steps:
            raise HTTPException(status_code=400, detail=f"Invalid step. Must be one of: {valid_steps}")
        
        # Get current status
        athlete = await db.athlete_profiles.find_one({"id": athlete_id})
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        # Initialize if doesn't exist
        if "onboarding_status" not in athlete:
            onboarding_status = {
                "personal_info_completed": False,
                "preferences_completed": False,
                "integration_completed": False,
                "community_post_completed": False,
                "onboarding_dismissed_permanently": False,
                "onboarding_completed": False,
                "last_dismissed_at": None
            }
        else:
            onboarding_status = athlete["onboarding_status"]
        
        # Update the specific step
        step_key = f"{step_update.step}_completed"
        onboarding_status[step_key] = step_update.completed
        
        # Check if all steps are complete
        all_complete = (
            onboarding_status["personal_info_completed"] and
            onboarding_status["preferences_completed"] and
            onboarding_status["integration_completed"] and
            onboarding_status["community_post_completed"]
        )
        onboarding_status["onboarding_completed"] = all_complete
        
        # Update database
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": {"onboarding_status": onboarding_status}}
        )
        
        return onboarding_status
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating onboarding step: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/onboarding/dismiss/{athlete_id}")
async def dismiss_onboarding(athlete_id: str, dismiss: OnboardingDismiss):
    """Dismiss onboarding (permanent or temporary)"""
    try:
        athlete = await db.athlete_profiles.find_one({"id": athlete_id})
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        # Initialize if doesn't exist
        if "onboarding_status" not in athlete:
            onboarding_status = {
                "personal_info_completed": False,
                "preferences_completed": False,
                "integration_completed": False,
                "community_post_completed": False,
                "onboarding_dismissed_permanently": False,
                "onboarding_completed": False,
                "last_dismissed_at": None
            }
        else:
            onboarding_status = athlete["onboarding_status"]
        
        # Update dismissal status
        if dismiss.permanent:
            onboarding_status["onboarding_dismissed_permanently"] = True
        else:
            onboarding_status["last_dismissed_at"] = datetime.now(timezone.utc)
        
        # Update database
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": {"onboarding_status": onboarding_status}}
        )
        
        return onboarding_status
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error dismissing onboarding: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/onboarding/check-auto-complete/{athlete_id}")
async def check_auto_complete_steps(athlete_id: str):
    """
    Auto-check which steps are already completed based on existing data.
    This is useful when users complete fields outside the onboarding flow.
    """
    try:
        athlete = await db.athlete_profiles.find_one({"id": athlete_id})
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        # Initialize if doesn't exist
        if "onboarding_status" not in athlete:
            onboarding_status = {
                "personal_info_completed": False,
                "preferences_completed": False,
                "integration_completed": False,
                "community_post_completed": False,
                "onboarding_dismissed_permanently": False,
                "onboarding_completed": False,
                "last_dismissed_at": None
            }
        else:
            onboarding_status = athlete["onboarding_status"]
        
        # Check personal info completion
        # Required fields: date_of_birth, gender, height, weight
        personal_complete = (
            athlete.get("date_of_birth") is not None and
            athlete.get("gender") is not None and
            athlete.get("height") is not None and
            athlete.get("weight") is not None
        )
        onboarding_status["personal_info_completed"] = personal_complete
        
        # Check preferences completion
        # Required fields: language, measurement_system, timezone
        preferences_complete = (
            athlete.get("language") is not None and
            athlete.get("measurement_system") is not None and
            athlete.get("timezone") is not None
        )
        onboarding_status["preferences_completed"] = preferences_complete
        
        # Check integration completion (at least 1 connection)
        strava_connected = await db.strava_connections.find_one({"athlete_id": athlete_id})
        oura_connected = await db.oura_connections.find_one({"athlete_id": athlete_id})
        polar_connected = await db.polar_connections.find_one({"athlete_id": athlete_id})
        fitbit_connected = await db.fitbit_connections.find_one({"athlete_id": athlete_id})
        garmin_connected = await db.garmin_connections.find_one({"athlete_id": athlete_id})
        coros_connected = await db.coros_connections.find_one({"athlete_id": athlete_id})
        whoop_connected = await db.whoop_connections.find_one({"athlete_id": athlete_id})
        suunto_connected = await db.suunto_connections.find_one({"athlete_id": athlete_id})
        
        integration_complete = any([
            strava_connected, oura_connected, polar_connected, fitbit_connected,
            garmin_connected, coros_connected, whoop_connected, suunto_connected
        ])
        onboarding_status["integration_completed"] = integration_complete
        
        # Check community post completion (at least 1 post)
        post_count = await db.community_posts.count_documents({"author_id": athlete_id})
        onboarding_status["community_post_completed"] = post_count > 0
        
        # Check if all complete
        all_complete = (
            onboarding_status["personal_info_completed"] and
            onboarding_status["preferences_completed"] and
            onboarding_status["integration_completed"] and
            onboarding_status["community_post_completed"]
        )
        onboarding_status["onboarding_completed"] = all_complete
        
        # Update database
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": {"onboarding_status": onboarding_status}}
        )
        
        return onboarding_status
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error auto-checking onboarding completion: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# BODY SCORE STREAK & LEADERBOARD ENDPOINTS
# ==========================================

class BodyScoreHistory(BaseModel):
    """Track daily body score for streak calculation"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    score: float  # 0-100
    date: str  # YYYY-MM-DD format
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

@app.post("/api/body-score/save/{athlete_id}")
async def save_body_score(athlete_id: str, score: float):
    """Save today's body score for an athlete"""
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
                "id": str(uuid.uuid4()),
                "athlete_id": athlete_id,
                "score": score,
                "date": today,
                "created_at": datetime.now(timezone.utc)
            }
            await db.body_score_history.insert_one(score_entry)
        
        return {"success": True, "date": today, "score": score}
    except Exception as e:
        logging.error(f"Error saving body score: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/body-score/streak/{athlete_id}")
async def get_body_score_streak(athlete_id: str):
    """Calculate current streak of days with body score >= 85"""
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
        logging.error(f"Error calculating streak: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/body-score/leaderboard")
async def get_body_score_leaderboard(limit: int = 50):
    """Get leaderboard of all users with their body score streaks"""
    try:
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
        logging.error(f"Error getting leaderboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))




# ==========================================
# WEATHER API ENDPOINTS
# ==========================================

# In-memory cache for weather data (simple hourly caching)
weather_cache = {}

@app.get("/api/weather/current")
async def get_current_weather(lat: float = Query(..., description="Latitude"), 
                               lon: float = Query(..., description="Longitude")):
    """
    Get current weather data from MET Norway API
    Caches results for 1 hour to respect API usage limits
    """
    try:
        # Create cache key from rounded coordinates (2 decimal places = ~1km accuracy)
        cache_key = f"{round(lat, 2)}_{round(lon, 2)}"
        current_time = datetime.now(timezone.utc)
        
        # Check if we have cached data less than 1 hour old
        if cache_key in weather_cache:
            cached_data, cached_time = weather_cache[cache_key]
            if (current_time - cached_time).total_seconds() < 3600:  # 1 hour
                logging.info(f"Returning cached weather data for {cache_key}")
                return cached_data
        
        # Fetch fresh data from MET Norway API
        url = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
        headers = {
            "User-Agent": "HealthDashboard/1.0 (support@healthdash.app)"
        }
        params = {
            "lat": str(lat),
            "lon": str(lon)
        }
        
        logging.info(f"Fetching weather data from MET Norway for lat={lat}, lon={lon}")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
        
        # Parse the response to extract current weather
        timeseries = data.get("properties", {}).get("timeseries", [])
        if not timeseries:
            raise HTTPException(status_code=404, detail="No weather data available")
        
        # Get the first entry (current/nearest time)
        current = timeseries[0]
        instant_details = current.get("data", {}).get("instant", {}).get("details", {})
        next_1h = current.get("data", {}).get("next_1_hours", {})
        next_6h = current.get("data", {}).get("next_6_hours", {})
        
        # Extract weather details
        weather_data = {
            "location": {
                "lat": lat,
                "lon": lon
            },
            "current": {
                "temperature": instant_details.get("air_temperature"),
                "feels_like": instant_details.get("air_temperature"),  # MET doesn't provide feels_like, use actual temp
                "humidity": instant_details.get("relative_humidity"),
                "wind_speed": instant_details.get("wind_speed"),
                "wind_direction": instant_details.get("wind_from_direction"),
                "cloud_cover": instant_details.get("cloud_area_fraction"),
                "pressure": instant_details.get("air_pressure_at_sea_level"),
                "visibility": instant_details.get("fog_area_fraction"),  # Approximate visibility from fog
            },
            "forecast": {
                "next_1h": {
                    "symbol": next_1h.get("summary", {}).get("symbol_code"),
                    "precipitation": next_1h.get("details", {}).get("precipitation_amount", 0)
                },
                "next_6h": {
                    "symbol": next_6h.get("summary", {}).get("symbol_code"),
                    "precipitation": next_6h.get("details", {}).get("precipitation_amount", 0)
                }
            },
            "timestamp": current.get("time"),
            "cached_at": current_time.isoformat()
        }
        
        # Generate training recommendations based on weather
        recommendations = generate_training_recommendations(weather_data)
        weather_data["training_recommendations"] = recommendations
        
        # Cache the result
        weather_cache[cache_key] = (weather_data, current_time)
        
        # Clean old cache entries (keep only last 100)
        if len(weather_cache) > 100:
            oldest_key = min(weather_cache.items(), key=lambda x: x[1][1])[0]
            del weather_cache[oldest_key]
        
        return weather_data
        
    except httpx.HTTPStatusError as e:
        logging.error(f"HTTP error fetching weather: {e}")
        raise HTTPException(status_code=e.response.status_code, detail="Weather service error")
    except httpx.TimeoutException:
        logging.error("Timeout fetching weather data")
        raise HTTPException(status_code=504, detail="Weather service timeout")
    except Exception as e:
        logging.error(f"Error fetching weather: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def generate_training_recommendations(weather_data: dict) -> dict:
    """Generate training recommendations based on weather conditions"""
    current = weather_data.get("current", {})
    forecast = weather_data.get("forecast", {})
    
    temp = current.get("temperature")
    wind_speed = current.get("wind_speed", 0)
    precipitation = forecast.get("next_1h", {}).get("precipitation", 0)
    symbol = forecast.get("next_1h", {}).get("symbol", "")
    
    recommendations = {
        "overall": "good",
        "message_key": "weather.recommendations.goodConditions",
        "details_keys": []
    }
    
    # Temperature recommendations
    if temp is not None:
        if temp < 0:
            recommendations["overall"] = "caution"
            recommendations["message_key"] = "weather.recommendations.coldConditions"
            recommendations["details_keys"].append("weather.recommendations.layerUpGradually")
        elif temp < 5:
            recommendations["details_keys"].append("weather.recommendations.coolWeatherLayers")
        elif temp > 25:
            recommendations["overall"] = "caution"
            recommendations["message_key"] = "weather.recommendations.hotConditions"
            recommendations["details_keys"].append("weather.recommendations.bringWaterMorningEvening")
        elif temp > 30:
            recommendations["overall"] = "poor"
            recommendations["message_key"] = "weather.recommendations.veryHotIndoor"
            recommendations["details_keys"].append("weather.recommendations.highHeatRisk")
    
    # Wind recommendations
    if wind_speed > 15:
        recommendations["overall"] = "poor"
        recommendations["message_key"] = "weather.recommendations.highWinds"
        recommendations["details_keys"].append("weather.recommendations.strongWindsAffect")
    elif wind_speed > 10:
        recommendations["overall"] = "caution"
        recommendations["details_keys"].append("weather.recommendations.moderateWindsPacing")
    
    # Precipitation recommendations
    if precipitation > 5:
        recommendations["overall"] = "poor"
        recommendations["message_key"] = "weather.recommendations.heavyRainIndoor"
        recommendations["details_keys"].append("weather.recommendations.significantRainfall")
    elif precipitation > 1:
        recommendations["overall"] = "caution"
        recommendations["message_key"] = "weather.recommendations.rainExpectedGear"
        recommendations["details_keys"].append("weather.recommendations.lightRainForecasted")
    
    # If no warnings, set positive message
    if recommendations["overall"] == "good" and not recommendations["details_keys"]:
        recommendations["details_keys"].append("weather.recommendations.idealConditions")
    
    return recommendations





# ==========================================
# BOOKMARKS ENDPOINTS
# ==========================================

@app.post("/api/bookmarks/{athlete_id}/{post_id}")
async def bookmark_post(athlete_id: str, post_id: str):
    """Bookmark a post for an athlete"""
    try:
        bookmark = {
            "id": str(uuid.uuid4()),
            "athlete_id": athlete_id,
            "post_id": post_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Check if already bookmarked
        existing = await db.bookmarks.find_one({
            "athlete_id": athlete_id,
            "post_id": post_id
        })
        
        if existing:
            return {"message": "Post already bookmarked", "bookmark_id": existing["id"]}
        
        await db.bookmarks.insert_one(bookmark)
        
        # Get post details to find the post author
        post = await db.community_posts.find_one({"id": post_id})
        
        if post and post.get("athlete_id") != athlete_id:
            # Only notify if someone else bookmarked the post (not the author)
            # Get bookmarker's details
            bookmarker = await db.accounts.find_one({"athlete_id": athlete_id})
            
            if bookmarker:
                # Create notification for post author
                notification = {
                    "id": str(uuid.uuid4()),
                    "athlete_id": post.get("athlete_id"),
                    "type": "bookmark",
                    "message": f"{bookmarker.get('name', 'Someone')} bookmarked your post",
                    "from_athlete_id": athlete_id,
                    "from_athlete_name": bookmarker.get('name', 'Unknown'),
                    "post_id": post_id,
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                notification_for_mongo = prepare_for_mongo(notification.copy())
                await db.community_notifications.insert_one(notification_for_mongo)
        
        return {"message": "Post bookmarked successfully", "bookmark_id": bookmark["id"]}
    except Exception as e:
        logging.error(f"Error bookmarking post: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/bookmarks/{athlete_id}/{post_id}")
async def remove_bookmark(athlete_id: str, post_id: str):
    """Remove a bookmark"""
    try:
        result = await db.bookmarks.delete_one({
            "athlete_id": athlete_id,
            "post_id": post_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Bookmark not found")
        
        return {"message": "Bookmark removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error removing bookmark: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/bookmarks/{athlete_id}")
async def get_bookmarks(athlete_id: str, limit: int = 50, skip: int = 0):
    """Get all bookmarked posts for an athlete"""
    try:
        # Get bookmark records
        bookmarks = await db.bookmarks.find(
            {"athlete_id": athlete_id}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
        
        if not bookmarks:
            return {"posts": [], "total": 0}
        
        # Get the actual posts
        post_ids = [bookmark["post_id"] for bookmark in bookmarks]
        posts = await db.community_posts.find(
            {"id": {"$in": post_ids}}
        ).to_list(length=None)
        
        # Create a map for quick lookup
        posts_map = {post["id"]: post for post in posts}
        
        # Order posts by bookmark creation date
        ordered_posts = []
        for bookmark in bookmarks:
            post = posts_map.get(bookmark["post_id"])
            if post:
                # Remove MongoDB ObjectId before returning
                if "_id" in post:
                    del post["_id"]
                # Add bookmark info to post
                post["bookmarked_at"] = bookmark["created_at"]
                ordered_posts.append(post)
        
        # Get total count
        total = await db.bookmarks.count_documents({"athlete_id": athlete_id})
        
        return {
            "posts": ordered_posts,
            "total": total
        }
    except Exception as e:
        logging.error(f"Error fetching bookmarks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/bookmarks/{athlete_id}/check/{post_id}")
async def check_bookmark(athlete_id: str, post_id: str):
    """Check if a post is bookmarked by an athlete"""
    try:
        bookmark = await db.bookmarks.find_one({
            "athlete_id": athlete_id,
            "post_id": post_id
        })
        
        return {"bookmarked": bookmark is not None}
    except Exception as e:
        logging.error(f"Error checking bookmark: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# POLL ENDPOINTS
# ==========================================

@api_router.post("/community/polls/{post_id}/vote")
async def vote_on_poll(post_id: str, vote_data: dict, athlete_id: str = Query(...)):
    """Vote on a poll"""
    try:
        option_id = vote_data.get("option_id")
        if not option_id:
            raise HTTPException(status_code=400, detail="option_id is required")
        
        # Get the post
        post = await db.community_posts.find_one({"id": post_id})
        if not post:
            raise HTTPException(status_code=404, detail="Poll not found")
        
        if post.get("type") != "poll" or not post.get("poll_data"):
            raise HTTPException(status_code=400, detail="Post is not a poll")
        
        poll_data = post.get("poll_data")
        
        # Check if poll is still active
        end_date = datetime.fromisoformat(poll_data.get("end_date"))
        if datetime.now(timezone.utc) > end_date or not poll_data.get("is_active", True):
            raise HTTPException(status_code=400, detail="Poll has ended")
        
        # Check if user has already voted
        for option in poll_data.get("options", []):
            if athlete_id in option.get("voters", []):
                raise HTTPException(status_code=400, detail="You have already voted on this poll")
        
        # Find the option and add vote
        option_found = False
        for option in poll_data.get("options", []):
            if option.get("id") == option_id:
                option["votes"] = option.get("votes", 0) + 1
                if "voters" not in option:
                    option["voters"] = []
                option["voters"].append(athlete_id)
                option_found = True
                break
        
        if not option_found:
            raise HTTPException(status_code=404, detail="Option not found")
        
        # Update total votes
        poll_data["total_votes"] = poll_data.get("total_votes", 0) + 1
        
        # Update the post in database
        await db.community_posts.update_one(
            {"id": post_id},
            {"$set": {"poll_data": poll_data}}
        )
        
        # Return updated poll data
        return {
            "message": "Vote recorded successfully",
            "poll_data": poll_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error voting on poll: {e}")
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
            "type": post_data.get("type", "post"),  # 'post' or 'poll'
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
        
        # If it's a poll, add poll-specific data
        if post_data.get("type") == "poll" and post_data.get("poll_data"):
            poll_data = post_data.get("poll_data")
            end_date = datetime.now(timezone.utc) + timedelta(days=poll_data.get("duration_days", 7))
            post["poll_data"] = {
                "question": poll_data.get("question"),
                "options": [
                    {
                        "id": str(uuid.uuid4()),
                        "text": option,
                        "votes": 0,
                        "voters": []
                    }
                    for option in poll_data.get("options", [])
                ],
                "total_votes": 0,
                "end_date": end_date.isoformat(),
                "is_active": True
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


@api_router.post("/community/posts/translate")
async def translate_post_content(request: dict):
    """Translate post content to user's preferred language using OpenAI"""
    try:
        text = request.get("text", "")
        target_language = request.get("target_language", "English")
        
        if not text:
            raise HTTPException(status_code=400, detail="Text is required")
        
        # Get OpenAI API key from system settings
        coach_service = AICoachService()
        api_key = await coach_service.get_global_openai_key()
        
        if not api_key:
            raise HTTPException(status_code=503, detail="Translation service not configured. Please add OpenAI API key in System Settings.")
        
        # Use OpenAI for translation
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",  # Using mini for cost efficiency
                messages=[
                    {
                        "role": "system",
                        "content": f"You are a professional translator. Translate the following text to {target_language}. Preserve formatting, emojis, and tone. Only return the translated text, nothing else."
                    },
                    {
                        "role": "user",
                        "content": text
                    }
                ],
                temperature=0.3,
                max_tokens=1000
            )
            
            translated_text = response.choices[0].message.content.strip()
            
            return {
                "original_text": text,
                "translated_text": translated_text,
                "target_language": target_language
            }
            
        except Exception as openai_error:
            logging.error(f"OpenAI translation error: {openai_error}")
            raise HTTPException(status_code=500, detail=f"Translation failed: {str(openai_error)}")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in translation endpoint: {e}")
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
                    "nationality": {"$arrayElemAt": ["$author_info.nationality", 0]},
                    "athlete_last_active_at": {"$arrayElemAt": ["$author_info.last_active_at", 0]}
                }
            },
            projection_stage
        ]
        
        # Apply limit to aggregation pipeline (already has $limit stage, but ensure bounded)
        posts = await db.community_posts.aggregate(pipeline).to_list(length=limit + skip)
        
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
        ).limit(100).to_list(length=100)
        
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
                    "nationality": {"$arrayElemAt": ["$author_info.nationality", 0]},
                    "athlete_last_active_at": {"$arrayElemAt": ["$author_info.last_active_at", 0]}
                }
            },
            projection_stage
        ]
        
        # Apply limit to aggregation pipeline (already has $limit stage, but ensure bounded)
        posts = await db.community_posts.aggregate(pipeline).to_list(length=limit + skip)
        
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
                    "nationality": {"$arrayElemAt": ["$author_info.nationality", 0]},
                    "athlete_last_active_at": {"$arrayElemAt": ["$author_info.last_active_at", 0]}
                }
            },
            projection_stage
        ]
        
        # Apply limit to aggregation pipeline (already has $limit stage, but ensure bounded)
        posts = await db.community_posts.aggregate(pipeline).to_list(length=limit + skip)
        
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
            "created_at": datetime.now(timezone.utc).isoformat(),
            "youtube_data": comment_data.get("youtube_data"),  # YouTube video metadata
            "url_preview": comment_data.get("url_preview")  # URL preview metadata
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
        ).limit(10).limit(100).to_list(length=100)
        
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
        
        comments = await db.community_comments.aggregate(pipeline).to_list(length=200)  # Max 200 comments per post
        
        # If athlete_id provided, check which comments are liked by this user
        if athlete_id:
            comment_ids = [c["id"] for c in comments]
            liked_comments = await db.community_comment_likes.find({
                "comment_id": {"$in": comment_ids},
                "athlete_id": athlete_id
            }).limit(100).to_list(length=100)
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
        
        comments = await db.community_event_comments.aggregate(pipeline).to_list(length=200)  # Max 200 comments per event
        
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
            ).limit(100).to_list(length=100)
            challenge_ids = [p["challenge_id"] for p in participations]
            query["id"] = {"$in": challenge_ids}
        
        # Fetch challenges
        challenges = await db.community_challenges.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).limit(100).to_list(length=100)
        
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
        
        leaderboard = await db.community_challenge_participants.aggregate(leaderboard_pipeline).to_list(length=500)  # Max 500 participants
        
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
            ).limit(100).to_list(length=100)
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
            ).limit(100).to_list(length=100)
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
        
        comments = await db.community_challenge_comments.aggregate(pipeline).to_list(length=200)  # Max 200 challenge comments
        
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
        ).sort("completed_at", -1).limit(100).to_list(length=100)
        
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
        ).sort("created_at", -1).limit(50).limit(100).to_list(length=100)
        
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
    """Follow or unfollow a user (respects privacy settings)"""
    try:
        # Check target user's privacy level
        target_athlete = await db.athlete_profiles.find_one({"id": target_athlete_id}, {"_id": 0})
        if not target_athlete:
            raise HTTPException(status_code=404, detail="User not found")
        
        privacy_level = target_athlete.get("privacy_level", "public")
        
        # Check if already following
        existing_follow = await db.community_follows.find_one({
            "follower_id": athlete_id,
            "following_id": target_athlete_id
        })
        
        if existing_follow:
            # Unfollow
            await db.community_follows.delete_one({"id": existing_follow["id"]})
            following = False
            request_sent = False
        else:
            # Check privacy level
            if privacy_level == "private":
                raise HTTPException(status_code=403, detail="This user does not accept follow requests")
            
            elif privacy_level == "guarded":
                # Check if request already exists
                existing_request = await db.follow_requests.find_one({
                    "requester_id": athlete_id,
                    "target_id": target_athlete_id,
                    "status": "pending"
                })
                
                if existing_request:
                    return {
                        "success": True,
                        "following": False,
                        "request_sent": True,
                        "requires_approval": True
                    }
                
                # Create follow request
                requester = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
                request = {
                    "id": str(uuid.uuid4()),
                    "requester_id": athlete_id,
                    "target_id": target_athlete_id,
                    "status": "pending",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.follow_requests.insert_one(prepare_for_mongo(request.copy()))
                
                # Create notification
                notification = {
                    "id": str(uuid.uuid4()),
                    "athlete_id": target_athlete_id,
                    "type": "follow_request",
                    "content": f"{requester.get('name', 'Someone')} requested to follow you",
                    "from_athlete_id": athlete_id,
                    "from_athlete_name": requester.get("name", "Unknown"),
                    "from_athlete_profile_picture": requester.get("profile_picture"),
                    "action_id": request["id"],  # Link to request
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.community_notifications.insert_one(prepare_for_mongo(notification.copy()))
                
                return {
                    "success": True,
                    "following": False,
                    "request_sent": True,
                    "requires_approval": True
                }
            else:
                # Public - Follow directly
                follow = {
                    "id": str(uuid.uuid4()),
                    "follower_id": athlete_id,
                    "following_id": target_athlete_id,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.community_follows.insert_one(prepare_for_mongo(follow.copy()))
                following = True
                request_sent = False
                
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
            "following": following if 'following' in locals() else False,
            "request_sent": request_sent if 'request_sent' in locals() else False,
            "followers_count": followers_count,
            "following_count": following_count
        }
    except Exception as e:
        logging.error(f"Error toggling follow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/community/follow")
async def remove_follow(follower_id: str = Query(...), following_id: str = Query(...)):
    """Remove a follow relationship (for removing followers or unfollowing)"""
    try:
        # Find and delete the follow relationship
        result = await db.community_follows.delete_one({
            "follower_id": follower_id,
            "following_id": following_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Follow relationship not found")
        
        return {"success": True, "message": "Follow relationship removed"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error removing follow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/community/block")
async def block_user(block_data: dict):
    """Block a user from following or messaging"""
    try:
        blocker_id = block_data.get("blocker_id")
        blocked_id = block_data.get("blocked_id")
        
        if not blocker_id or not blocked_id:
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        # Check if already blocked
        existing_block = await db.user_blocks.find_one({
            "blocker_id": blocker_id,
            "blocked_id": blocked_id
        })
        
        if existing_block:
            return {"success": True, "message": "User already blocked"}
        
        # Create block record
        block = {
            "id": str(uuid.uuid4()),
            "blocker_id": blocker_id,
            "blocked_id": blocked_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_blocks.insert_one(prepare_for_mongo(block.copy()))
        
        # Remove any existing follow relationships
        await db.community_follows.delete_many({
            "$or": [
                {"follower_id": blocked_id, "following_id": blocker_id},
                {"follower_id": blocker_id, "following_id": blocked_id}
            ]
        })
        
        # Remove any pending follow requests
        await db.follow_requests.delete_many({
            "$or": [
                {"requester_id": blocked_id, "target_id": blocker_id},
                {"requester_id": blocker_id, "target_id": blocked_id}
            ]
        })
        
        # Remove any pending message requests
        await db.message_requests.delete_many({
            "$or": [
                {"requester_id": blocked_id, "target_id": blocker_id},
                {"requester_id": blocker_id, "target_id": blocked_id}
            ]
        })
        
        return {"success": True, "message": "User blocked successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error blocking user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/community/follow-request/{request_id}/accept")
async def accept_follow_request(request_id: str, athlete_id: str = Query(...)):
    """Accept a follow request"""
    try:
        # Get the request
        request = await db.follow_requests.find_one({"id": request_id, "target_id": athlete_id, "status": "pending"})
        if not request:
            # Check if already accepted
            existing_request = await db.follow_requests.find_one({"id": request_id, "target_id": athlete_id})
            if existing_request and existing_request.get("status") == "accepted":
                return {"success": True, "message": "Follow request already accepted", "already_accepted": True}
            raise HTTPException(status_code=404, detail="Request not found")
        
        # Update request status
        await db.follow_requests.update_one(
            {"id": request_id},
            {"$set": {"status": "accepted", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Create the follow relationship
        follow = {
            "id": str(uuid.uuid4()),
            "follower_id": request["requester_id"],
            "following_id": athlete_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.community_follows.insert_one(prepare_for_mongo(follow.copy()))
        
        # Update the original notification to mark it as handled
        await db.community_notifications.update_one(
            {"action_id": request_id},
            {"$set": {"read": True}}
        )
        
        # Create notification for requester
        target = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        notification = {
            "id": str(uuid.uuid4()),
            "athlete_id": request["requester_id"],
            "type": "follow_request_accepted",
            "content": f"{target.get('name', 'Someone')} accepted your follow request",
            "from_athlete_id": athlete_id,
            "from_athlete_name": target.get("name", "Unknown"),
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.community_notifications.insert_one(prepare_for_mongo(notification.copy()))
        
        return {"success": True, "message": "Follow request accepted"}
    except Exception as e:
        logging.error(f"Error accepting follow request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/community/follow-request/{request_id}/decline")
async def decline_follow_request(request_id: str, athlete_id: str = Query(...)):
    """Decline a follow request"""
    try:
        # Get the request
        request = await db.follow_requests.find_one({"id": request_id, "target_id": athlete_id, "status": "pending"})
        if not request:
            # Check if already declined or accepted
            existing_request = await db.follow_requests.find_one({"id": request_id, "target_id": athlete_id})
            if existing_request:
                status = existing_request.get("status")
                if status == "declined":
                    return {"success": True, "message": "Follow request already declined", "already_declined": True}
                elif status == "accepted":
                    return {"success": False, "message": "Cannot decline an already accepted request", "already_accepted": True}
            raise HTTPException(status_code=404, detail="Request not found")
        
        # Update request status
        await db.follow_requests.update_one(
            {"id": request_id},
            {"$set": {"status": "declined", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Update the original notification to mark it as handled
        await db.community_notifications.update_one(
            {"action_id": request_id},
            {"$set": {"read": True}}
        )
        
        return {"success": True, "message": "Follow request declined"}
    except Exception as e:
        logging.error(f"Error declining follow request: {e}")
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
        
        # Count likes received on all posts using aggregation
        likes_result = await db.community_posts.aggregate([
            {"$match": {"athlete_id": target_athlete_id}},
            {"$group": {
                "_id": None,
                "total_likes": {"$sum": "$likes_count"}
            }}
        ]).to_list(length=1)
        likes_received = likes_result[0]["total_likes"] if likes_result else 0
        
        # Get followers/following counts
        followers_count = await db.community_follows.count_documents({"following_id": target_athlete_id})
        following_count = await db.community_follows.count_documents({"follower_id": target_athlete_id})
        
        # Check if viewer is following this athlete
        is_following = await db.community_follows.find_one({
            "follower_id": viewer_athlete_id,
            "following_id": target_athlete_id
        }) is not None
        
        # Check if there's a pending follow request
        follow_request_sent = await db.follow_requests.find_one({
            "requester_id": viewer_athlete_id,
            "target_id": target_athlete_id,
            "status": "pending"
        }) is not None
        
        # Check if there's a pending message request
        message_request_sent = await db.message_requests.find_one({
            "requester_id": viewer_athlete_id,
            "target_id": target_athlete_id,
            "status": "pending"
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
            "privacy_level": athlete.get("privacy_level", "public"),
            "posts_count": posts_count,
            "likes_received": likes_received,
            "followers_count": followers_count,
            "following_count": following_count,
            "is_following": is_following,
            "follow_request_sent": follow_request_sent,
            "message_request_sent": message_request_sent,
            "is_own_profile": target_athlete_id == viewer_athlete_id,
            "last_active_at": athlete.get("last_active_at")
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
        ).limit(100).to_list(length=100)
        
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
        ).limit(100).to_list(length=100)
        
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
            {"_id": 0, "id": 1, "name": 1, "profile_picture": 1, "bio": 1, "nationality": 1, "subscription_tier": 1, "last_active_at": 1}
        ).limit(limit).limit(100).to_list(length=100)
        
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
                "is_following": is_following,
                "last_active_at": athlete.get("last_active_at")
            })
        
        return {"athletes": result}
    except Exception as e:
        logging.error(f"Error fetching athletes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/community/athletes/{athlete_id}/followers")
async def get_athlete_followers(athlete_id: str):
    """Get list of users following this athlete"""
    try:
        # Get all follow relationships where this athlete is being followed
        follows = await db.community_follows.find(
            {"following_id": athlete_id}
        ).to_list(length=None)
        
        # Get follower profiles
        follower_ids = [f["follower_id"] for f in follows]
        if not follower_ids:
            return {"followers": []}
        
        followers = await db.athlete_profiles.find(
            {"id": {"$in": follower_ids}},
            {"_id": 0, "id": 1, "name": 1, "profile_picture": 1, "bio": 1, "nationality": 1, "subscription_tier": 1, "last_active_at": 1}
        ).to_list(length=None)
        
        return {"followers": followers}
    except Exception as e:
        logging.error(f"Error fetching followers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/community/athletes/{athlete_id}/following")
async def get_athlete_following(athlete_id: str):
    """Get list of users this athlete is following"""
    try:
        # Get all follow relationships where this athlete is the follower
        follows = await db.community_follows.find(
            {"follower_id": athlete_id}
        ).to_list(length=None)
        
        # Get following profiles
        following_ids = [f["following_id"] for f in follows]
        if not following_ids:
            return {"following": []}
        
        following = await db.athlete_profiles.find(
            {"id": {"$in": following_ids}},
            {"_id": 0, "id": 1, "name": 1, "profile_picture": 1, "bio": 1, "nationality": 1, "subscription_tier": 1, "last_active_at": 1}
        ).to_list(length=None)
        
        return {"following": following}
    except Exception as e:
        logging.error(f"Error fetching following: {e}")
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
        
        groups = await db.community_groups.aggregate(pipeline).to_list(length=100)  # Max 100 groups
        
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
        
        groups = await db.community_group_memberships.aggregate(pipeline).to_list(length=100)  # Max 100 groups per user
        
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
        }, {"_id": 0}).limit(100).to_list(length=100)
        
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
            }, {"_id": 0}).limit(100).to_list(length=100)
            
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
        
        posts = await db.community_group_posts.aggregate(pipeline).to_list(length=100)  # Max 100 group posts
        
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
            }, {"_id": 0}).limit(100).to_list(length=100)
            
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
            }, {"_id": 0, "group_id": 1}).limit(100).to_list(length=100)  # Max 100 groups
            
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
        
        interested = await db.community_event_attendance.aggregate(interested_pipeline).to_list(length=100)
        going = await db.community_event_attendance.aggregate(going_pipeline).to_list(length=500)  # Max 500 attendees
        
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
    # Check both field names for backwards compatibility
    is_admin = athlete.get("is_super_admin", False) or athlete.get("role") == "super_admin"
    if not is_admin:
        raise HTTPException(status_code=403, detail="Access denied. Super admin privileges required.")
    return athlete

# System stats endpoints (stats, waitlist-integration-stats, connected-integration-stats, gender-distribution-stats) moved to routes/system_complete.py

# Email Template Routes
@api_router.get("/email-templates")
async def get_email_templates():
    """Get all email templates"""
    try:
        templates = await db.email_templates.find({}, {"_id": 0}).limit(100).to_list(length=100)
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
        try:
            await email_service.send_email(
                to_email="support@kaizenlifetracker.com",
                subject=f"Support Request: {submission.subject}",
                html_content=html_content,
                text_content=text_content
            )
            logging.info("Support email sent successfully")
            return {"success": True, "message": "Your support request has been submitted successfully"}
        except Exception as email_error:
            logging.error(f"Failed to send support email: {email_error}")
            # Still return success to user, but log the email failure
            # In production, you might want to store this in a queue for retry
            return {
                "success": True, 
                "message": "Your support request has been received. We'll get back to you soon.",
                "email_status": "pending"
            }
        
    except HTTPException:
        raise
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
        emails = await db.custom_emails.find({}, {"_id": 0}).limit(100).to_list(length=100)
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
            logging.info(f"Querying waiting_list collection for all entries")
        elif target_audience in ["free", "pro", "premium"]:
            query["subscription_tier"] = target_audience
            logging.info(f"Querying athlete_profiles with subscription_tier: {target_audience}")
        else:
            logging.info(f"Querying all athlete_profiles")
        # If "all", query remains empty (all users from athlete_profiles)
        
        # Get target users (batch processing recommended for large lists)
        # Limit to 5000 to prevent memory issues - use pagination for larger campaigns
        logging.info(f"Executing query on collection: {collection.name}, query: {query}")
        users = await collection.find(query, {"_id": 0, "email": 1, "name": 1}).limit(5000).to_list(length=5000)
        logging.info(f"Found {len(users)} users matching query")
        
        if not users:
            # Get count to debug
            total_count = await collection.count_documents({})
            logging.error(f"No users found for audience '{target_audience}'. Total docs in collection: {total_count}")
            raise HTTPException(status_code=400, detail=f"No users found for target audience: {target_audience}. Total entries in database: {total_count}")
        
        # Log warning if we hit the limit
        if len(users) >= 5000:
            logging.warning(f"Email campaign hit 5000 user limit. Consider implementing batch processing for larger campaigns.")
        
        # Send email to each user
        sent_count = 0
        failed_count = 0
        
        for user in users:
            try:
                # Replace variables in email content
                user_name = user.get("name", "User")
                user_email = user.get("email")
                
                if not user_email:
                    logging.warning(f"Skipping user with no email: {user}")
                    continue
                
                # Replace variables in subject, body, and html_body
                subject = email["subject"].replace("{{user_name}}", user_name).replace("{{user_email}}", user_email)
                body = email.get("body", "").replace("{{user_name}}", user_name).replace("{{user_email}}", user_email)
                html_body = email.get("html_body", "").replace("{{user_name}}", user_name).replace("{{user_email}}", user_email)
                
                logging.info(f"Sending email to {user_email} with name: {user_name}")
                logging.debug(f"Subject after replacement: {subject}")
                logging.debug(f"Body after replacement: {body[:100]}")
                
                # Send email
                await email_service.send_email(
                    to_email=user_email,
                    subject=subject,
                    text_content=body if body else None,
                    html_content=html_body if html_body else None
                )
                sent_count += 1
                logging.info(f"Email sent successfully to {user_email}")
                
            except Exception as e:
                error_msg = f"Failed to send email to {user.get('email')}: {str(e)}"
                logging.error(error_msg, exc_info=True)
                failed_count += 1
                # Store error details for debugging
                if not hasattr(locals(), 'error_details'):
                    error_details = []
                error_details.append({"email": user.get('email'), "error": str(e)})
                continue
        
        logging.info(f"Custom email sent: {sent_count} successful, {failed_count} failed")
        
        # Build response with error details if any failures
        response = {
            "success": True,
            "sent_count": sent_count,
            "failed_count": failed_count,
            "message": f"Email sent successfully to {sent_count} recipients!" if sent_count > 0 else f"Email sending failed for all {failed_count} recipients",
            "target_audience": target_audience,
            "total_users": len(users)
        }
        
        # Add error details if there were failures
        if failed_count > 0 and 'error_details' in locals():
            response["errors"] = error_details
            logging.error(f"Email sending errors: {error_details}")
        
        return response
        
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
        ).sort("timestamp", -1).limit(limit).limit(100).to_list(length=100)
        
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
        
        event_counts = await db.analytics_events.aggregate(pipeline).to_list(length=500)  # Max 500 event types
        
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

# System settings endpoints (settings/public, settings GET/POST, upload-seo-image, reload-email-service, subscriber-stats) moved to routes/system_complete.py

# CRM endpoints moved to routes/crm_complete.py
# CMS Pages Endpoints moved to routes/pages_complete.py

# Menu Management Endpoints
@api_router.get("/menus")
async def get_menus(athlete_id: str):
    """Get menu settings (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Get menus from system settings or return defaults
        settings = await db.system_settings.find_one({})
        
        # Define default menus structure
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
            ],
            "slideout_menu_logged_out": [
                {"id": str(uuid.uuid4()), "label": "Home", "url": "/", "order": 0, "icon": "Home"},
                {"id": str(uuid.uuid4()), "label": "Pricing", "url": "/pricing", "order": 1, "icon": "DollarSign"},
                {"id": str(uuid.uuid4()), "label": "Login", "url": "/login", "order": 2, "icon": "LogIn"}
            ]
        }
        
        if settings and "menus" in settings:
            saved_menus = settings["menus"]
            # Merge saved menus with defaults to ensure all menu types exist
            # This handles cases where old database entries don't have slideout_menu_logged_out
            result_menus = {}
            for menu_type in ["header_logged_out", "header_logged_in", "slideout_menu", "slideout_menu_logged_out"]:
                if menu_type in saved_menus and isinstance(saved_menus[menu_type], list):
                    result_menus[menu_type] = saved_menus[menu_type]
                else:
                    result_menus[menu_type] = default_menus[menu_type]
            return result_menus
        
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
        
        # Define default menus structure
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
            ],
            "slideout_menu_logged_out": [
                {"id": str(uuid.uuid4()), "label": "Home", "url": "/", "order": 0, "icon": "Home"},
                {"id": str(uuid.uuid4()), "label": "Pricing", "url": "/pricing", "order": 1, "icon": "DollarSign"},
                {"id": str(uuid.uuid4()), "label": "Login", "url": "/login", "order": 2, "icon": "LogIn"}
            ]
        }
        
        if settings and "menus" in settings:
            saved_menus = settings["menus"]
            # Merge saved menus with defaults to ensure all menu types exist
            # This handles cases where old database entries don't have slideout_menu_logged_out
            result_menus = {}
            for menu_type in ["header_logged_out", "header_logged_in", "slideout_menu", "slideout_menu_logged_out"]:
                if menu_type in saved_menus and isinstance(saved_menus[menu_type], list):
                    result_menus[menu_type] = saved_menus[menu_type]
                else:
                    result_menus[menu_type] = default_menus[menu_type]
            return result_menus
        
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
        
        # PRESERVE EXISTING TRANSLATIONS when updating menus
        # Get existing menus from database
        existing_settings = await db.system_settings.find_one({})
        if existing_settings and 'menus' in existing_settings:
            existing_menus = existing_settings['menus']
            
            # For each menu type, preserve translations
            for menu_type in ['header_logged_out', 'header_logged_in', 'slideout_menu', 'slideout_menu_logged_out']:
                if menu_type in menus_dict and menu_type in existing_menus:
                    new_items = menus_dict[menu_type]
                    old_items = existing_menus[menu_type]
                    
                    # Create a map of old items by ID for quick lookup
                    old_items_map = {item.get('id'): item for item in old_items if item.get('id')}
                    
                    # Preserve translations for matching items
                    for new_item in new_items:
                        item_id = new_item.get('id')
                        if item_id and item_id in old_items_map:
                            old_item = old_items_map[item_id]
                            # Copy translations from old item to new item
                            if 'translations' in old_item:
                                new_item['translations'] = old_item['translations']
                                logging.info(f"Preserved translations for item: {new_item.get('label', 'unknown')}")
        
        # Update or create system settings with menus
        logging.info(f"[MENU SAVE] Saving menus for {athlete_id}")
        logging.info(f"[MENU SAVE] Menu types: {list(menus_dict.keys())}")
        logging.info(f"[MENU SAVE] Total items: {sum(len(menus_dict.get(k, [])) for k in menus_dict.keys())}")
        
        result = await db.system_settings.update_one(
            {},
            {"$set": {"menus": menus_dict}},
            upsert=True
        )
        
        logging.info(f"[MENU SAVE] MongoDB result: matched={result.matched_count}, modified={result.modified_count}")
        logging.info(f"Menus updated by {athlete_id}")
        return {"message": "Menus updated successfully", "menus": menus_dict}
    except Exception as e:
        logging.error(f"Error updating menus: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update menus: {str(e)}")

@api_router.post("/system/set-language")
async def set_language(
    athlete_id: str = Query(..., description="Athlete ID for verification"),
    language: str = Query(..., description="Language code (en, no, de, sv, etc.)")
):
    """Set language preference for the current user - Works with any identifier"""
    try:
        # Get the athlete by ID, email, or any identifier
        athlete = await db.athlete_profiles.find_one({"id": athlete_id})
        if not athlete:
            # Try finding by email if ID doesn't work
            athlete = await db.athlete_profiles.find_one({"email": athlete_id})
        
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete profile not found")
        
        # Store old language for response
        old_language = athlete.get('language', 'en')
        
        # Update language
        email = athlete.get('email')
        result = await db.athlete_profiles.update_one(
            {"email": email},
            {"$set": {"language": language}}
        )
        
        # Verify update
        updated = await db.athlete_profiles.find_one({"email": email})
        
        logging.info(f"[SET LANGUAGE] Updated language for {email} from '{old_language}' to '{language}'")
        
        return {
            "success": True,
            "email": email,
            "old_language": old_language,
            "new_language": updated.get('language'),
            "message": f"Language updated to {language}"
        }
        
    except Exception as e:
        logging.error(f"[SET LANGUAGE] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/system/translate-menu-item")
async def translate_single_menu_item(
    athlete_id: str = Query(..., description="Athlete ID for super admin verification"),
    menu_type: str = Query(..., description="Menu type: header_logged_out, header_logged_in, slideout_menu, or slideout_menu_logged_out"),
    item_id: str = Query(..., description="Menu item ID to translate")
):
    """Translate a single menu item into available languages using OpenAI (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Get OpenAI key
        openai_key = os.environ.get('OPENAI_API_KEY')
        if not openai_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
        
        openai_key = openai_key.strip()
        
        # Get current menus
        settings = await db.system_settings.find_one({})
        
        if not settings or 'menus' not in settings:
            raise HTTPException(status_code=400, detail="No menus found. Please save menus first.")
        
        menus = settings['menus']
        
        # Find the specific menu item
        if menu_type not in menus:
            raise HTTPException(status_code=400, detail=f"Invalid menu type: {menu_type}")
        
        menu_items = menus[menu_type]
        target_item = None
        item_index = None
        
        for idx, item in enumerate(menu_items):
            if item.get('id') == item_id:
                target_item = item
                item_index = idx
                break
        
        if not target_item:
            raise HTTPException(status_code=404, detail=f"Menu item with ID {item_id} not found")
        
        # Skip separators
        if target_item.get('is_separator'):
            raise HTTPException(status_code=400, detail="Cannot translate separator items")
        
        label = target_item.get('label', '')
        if not label:
            raise HTTPException(status_code=400, detail="Menu item has no label to translate")
        
        # Get available languages from locale files
        locales_dir = os.path.join(os.path.dirname(__file__), '../frontend/src/locales')
        available_languages = []
        
        if os.path.exists(locales_dir):
            for filename in os.listdir(locales_dir):
                if filename.endswith('.json') and filename != 'en.json':
                    lang_code = filename.replace('.json', '')
                    available_languages.append(lang_code)
        
        if not available_languages:
            available_languages = ['no', 'sv', 'da', 'de', 'es', 'fr']
        
        logging.info(f"[TRANSLATE ITEM] Translating '{label}' to {len(available_languages)} languages")
        
        # Initialize OpenAI client
        client = openai.OpenAI(api_key=openai_key)
        
        # Translate to each language
        if 'translations' not in target_item:
            target_item['translations'] = {}
        
        for lang_code in available_languages:
            try:
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": f"You are a translator. Translate the following menu item label to {lang_code}. Return ONLY the translated text, nothing else."},
                        {"role": "user", "content": label}
                    ],
                    max_tokens=50,
                    temperature=0.3
                )
                
                translated_text = response.choices[0].message.content.strip()
                target_item['translations'][lang_code] = translated_text
                logging.info(f"Translated '{label}' to {lang_code.upper()}: '{translated_text}'")
                
            except Exception as e:
                logging.error(f"Failed to translate '{label}' to {lang_code}: {e}")
        
        # Update the menu item in the database
        menus[menu_type][item_index] = target_item
        
        await db.system_settings.update_one(
            {},
            {"$set": {"menus": menus}},
            upsert=True
        )
        
        logging.info(f"[TRANSLATE ITEM] Successfully translated menu item: {label}")
        
        return {
            "success": True,
            "item_id": item_id,
            "label": label,
            "translations": target_item['translations'],
            "languages": list(target_item['translations'].keys()),
            "message": f"Translated '{label}' to {len(target_item['translations'])} languages"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[TRANSLATE ITEM] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/system/translate-menus")
async def translate_menus(athlete_id: str = Query(..., description="Athlete ID for super admin verification")):
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
            'fr': 'French',
            'es': 'Spanish',
            'da': 'Danish',
            'it': 'Italian',
            'ja': 'Japanese',
            'zh': 'Chinese'
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
        
        # Get current menus from database
        settings = await db.system_settings.find_one({})
        
        # If no menus in database, tell user to save menus first via Menu Editor
        if not settings or 'menus' not in settings:
            raise HTTPException(
                status_code=400, 
                detail="No menus found in database. Please save your menus in the Menu Editor first, then translate them."
            )
        
        menus = settings['menus']
        logging.info(f"[TRANSLATE] Loaded menus from database")
        translated_count = 0
        
        # Initialize OpenAI client
        client = openai.OpenAI(api_key=openai_key)
        
        # Translate each menu type
        for menu_type in ['header_logged_in', 'header_logged_out', 'slideout_menu', 'slideout_menu_logged_out']:
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
    """Upload favicon or logo for SEO settings - stores as base64 data URL (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        file_content = await file.read()
        if len(file_content) > 2 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size must be less than 2MB")
        
        try:
            image = Image.open(io.BytesIO(file_content))
            
            if image.mode == 'P':
                image = image.convert('RGBA')
            elif image.mode not in ('RGB', 'RGBA'):
                image = image.convert('RGBA')
            
            if image_type == "favicon":
                image = image.resize((32, 32), Image.Resampling.LANCZOS)
            elif image_type == "logo":
                image.thumbnail((200, 200), Image.Resampling.LANCZOS)
            elif image_type == "og_image":
                image = image.resize((1200, 630), Image.Resampling.LANCZOS)
            
            output = io.BytesIO()
            image.save(output, format='PNG', optimize=True)
            output.seek(0)
            optimized_content = output.read()
            
            import base64
            encoded = base64.b64encode(optimized_content).decode('utf-8')
            data_url = f"data:image/png;base64,{encoded}"
            
            logging.info(f"SEO image {image_type}: Converted to base64 data URL (size: {len(data_url)} chars)")
            
            return {
                "success": True,
                "message": f"{image_type.title()} uploaded successfully",
                "path": data_url
            }
            
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
        athletes = await db.athlete_profiles.find(
            {},
            {"_id": 0, "created_at": 1, "subscription_tier": 1}
        ).to_list(length=1000)
        
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
        
        # Use aggregation for better performance instead of loading all posts
        total_posts = await db.community_posts.count_documents(posts_query)
        
        # Calculate engagement metrics using aggregation
        likes_result = await db.community_posts.aggregate([
            {"$match": posts_query},
            {"$group": {
                "_id": None,
                "total_likes": {"$sum": "$likes_count"},
                "total_comments": {"$sum": "$comments_count"}
            }}
        ]).to_list(length=1)
        
        total_likes = likes_result[0]["total_likes"] if likes_result else 0
        total_comments = likes_result[0]["total_comments"] if likes_result else 0
        
        # Get unique posters using aggregation
        unique_posters_result = await db.community_posts.aggregate([
            {"$match": posts_query},
            {"$group": {"_id": "$athlete_id"}},
            {"$count": "unique_count"}
        ]).to_list(length=1)
        unique_posters = unique_posters_result[0]["unique_count"] if unique_posters_result else 0
        
        # Calculate averages
        avg_likes_per_post = total_likes / max(total_posts, 1)
        avg_comments_per_post = total_comments / max(total_posts, 1)
        engagement_rate = (unique_posters / max(total_subscribers, 1)) * 100
        
        # Get top contributors (most posts) using aggregation
        top_contributors_result = await db.community_posts.aggregate([
            {"$match": posts_query},
            {"$group": {
                "_id": "$athlete_id",
                "count": {"$sum": 1}
            }},
            {"$sort": {"count": -1}},
            {"$limit": 5}
        ]).to_list(length=5)
        
        top_contributors = [(item["_id"], item["count"]) for item in top_contributors_result]
        
        # Calculate daily post distribution for time series using aggregation
        daily_posts_result = await db.community_posts.aggregate([
            {"$match": posts_query},
            {"$project": {
                "date": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": {"$toDate": "$created_at"}
                    }
                }
            }},
            {"$group": {
                "_id": "$date",
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}},
            {"$limit": 100}
        ]).to_list(length=100)
        
        # Create time series for posts
        post_time_series = []
        for item in daily_posts_result:
            post_time_series.append({
                "date": item["_id"],
                "count": item["count"]
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
        
        # Use aggregation for better performance
        total_referrals = await db.referrals.count_documents(referrals_query)
        
        # Count successful referrals using aggregation
        successful_referrals_result = await db.referrals.aggregate([
            {"$match": referrals_query},
            {"$match": {
                "$or": [
                    {"status": {"$in": ["converted", "rewarded"]}},
                    {"referred_user_id": {"$exists": True, "$ne": None}}
                ]
            }},
            {"$count": "successful_count"}
        ]).to_list(length=1)
        successful_referrals = successful_referrals_result[0]["successful_count"] if successful_referrals_result else 0
        
        # Calculate referral conversion rate
        referral_conversion_rate = (successful_referrals / max(total_referrals, 1)) * 100
        
        # Get unique referrers using aggregation
        unique_referrers_result = await db.referrals.aggregate([
            {"$match": referrals_query},
            {"$group": {"_id": "$referrer_id"}},
            {"$count": "unique_count"}
        ]).to_list(length=1)
        unique_referrers = unique_referrers_result[0]["unique_count"] if unique_referrers_result else 0
        
        # Calculate total rewards using aggregation
        total_rewards_result = await db.referrals.aggregate([
            {"$match": {**referrals_query, "status": "rewarded"}},
            {"$group": {
                "_id": None,
                "total": {"$sum": "$reward_amount"}
            }}
        ]).to_list(length=1)
        total_rewards = total_rewards_result[0]["total"] if total_rewards_result else 0
        
        # Get top referrers using aggregation
        top_referrers_result = await db.referrals.aggregate([
            {"$match": referrals_query},
            {"$group": {
                "_id": "$referrer_id",
                "count": {"$sum": 1}
            }},
            {"$sort": {"count": -1}},
            {"$limit": 5}
        ]).to_list(length=5)
        
        top_referrers = [(item["_id"], item["count"]) for item in top_referrers_result]
        top_referrers_count = len(top_referrers)
        
        # Calculate average referrals per referrer
        avg_referrals_per_user = total_referrals / max(unique_referrers, 1)
        
        # Calculate referral participation rate (users who made at least 1 referral)
        referral_participation = (unique_referrers / max(total_subscribers, 1)) * 100
        
        # Daily referral distribution using aggregation
        daily_referrals_result = await db.referrals.aggregate([
            {"$match": referrals_query},
            {"$project": {
                "date": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": {"$toDate": "$created_at"}
                    }
                }
            }},
            {"$group": {
                "_id": "$date",
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}},
            {"$limit": 100}
        ]).to_list(length=100)
        
        daily_referrals = {item["_id"]: item["count"] for item in daily_referrals_result}
        
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
# SUBSCRIPTION PLAN MANAGEMENT

# Waiting List Endpoints
@api_router.get("/platform-metrics")
async def get_platform_metrics():
    """Get platform metrics for landing page (public endpoint, no auth required)"""
    try:
        import os
        import glob
        
        # Language mappings
        language_map = {
            'en': '🇬🇧 English',
            'no': '🇳🇴 Norwegian (Norsk)',
            'sv': '🇸🇪 Swedish (Svenska)',
            'da': '🇩🇰 Danish (Dansk)',
            'de': '🇩🇪 German (Deutsch)',
            'es': '🇪🇸 Spanish (Español)',
            'fr': '🇫🇷 French (Français)',
            'it': '🇮🇹 Italian (Italiano)',
            'ja': '🇯🇵 Japanese (日本語)',
            'zh': '🇨🇳 Chinese (中文)',
            'pt': '🇵🇹 Portuguese (Português)',
            'nl': '🇳🇱 Dutch (Nederlands)',
            'pl': '🇵🇱 Polish (Polski)',
            'fi': '🇫🇮 Finnish (Suomi)',
            'ru': '🇷🇺 Russian (Русский)',
            'ko': '🇰🇷 Korean (한국어)',
            'ar': '🇸🇦 Arabic (العربية)'
        }
        
        # Get available language translations
        locale_path = os.path.join(os.path.dirname(__file__), '../frontend/src/locales')
        languages_list = []
        language_count = 0
        
        if os.path.exists(locale_path):
            language_files = glob.glob(os.path.join(locale_path, '*.json'))
            
            # Extract language codes and map to readable names
            for file_path in sorted(language_files):
                lang_code = os.path.basename(file_path).replace('.json', '')
                
                # Skip internal/test files
                if lang_code.upper() == 'EN-FULL':
                    continue
                    
                lang_name = language_map.get(lang_code, f'{lang_code.upper()}')
                languages_list.append(lang_name)
            
            language_count = len(languages_list)
        
        # AI Coach personalities with descriptions
        personalities_list = [
            {"name": "Zen Minimalist", "description": "Calm & simple approach"},
            {"name": "Science Geek", "description": "Data-driven insights"},
            {"name": "Tough Love", "description": "Direct & challenging"},
            {"name": "Cheerleader", "description": "Energetic & positive"},
            {"name": "Therapist", "description": "Empathetic & supportive"},
            {"name": "Stoic", "description": "Philosophical & disciplined"},
            {"name": "Gamified", "description": "XP & quest-based"},
            {"name": "Recovery Sage", "description": "Long-term health focus"},
            {"name": "Executive", "description": "Time-efficient workouts"},
            {"name": "Realist", "description": "Down-to-earth guidance"}
        ]
        personality_count = len(personalities_list)
        
        # Device integrations
        integrations_list = [
            "Strava - Running & Cycling",
            "Oura Ring - Sleep & Recovery",
            "Polar - Heart Rate Monitors",
            "Fitbit - Activity Tracking",
            "Garmin - GPS & Fitness",
            "Whoop - Strain & Recovery",
            "Coros - GPS & Training",
            "Suunto - Outdoor Sports"
        ]
        integration_count = len(integrations_list)
        
        return {
            "languages": language_count,
            "personalities": personality_count,
            "integrations": integration_count,
            "languagesList": languages_list,
            "personalitiesList": personalities_list,
            "integrationsList": integrations_list
        }
    except Exception as e:
        logging.error(f"Error fetching platform metrics: {e}")
        # Return fallback values
        return {
            "languages": 10,
            "personalities": 10,
            "integrations": 8,
            "languagesList": ["English", "Norwegian", "Swedish", "Danish", "German", "Spanish", "French", "Italian", "Japanese", "Chinese"],
            "personalitiesList": [
                {"name": "Zen Minimalist", "description": "Calm & simple"},
                {"name": "Science Geek", "description": "Data-driven"},
                {"name": "Tough Love", "description": "Direct & challenging"},
                {"name": "Cheerleader", "description": "Energetic"},
                {"name": "Therapist", "description": "Supportive"},
                {"name": "Stoic", "description": "Disciplined"},
                {"name": "Gamified", "description": "Quest-based"},
                {"name": "Recovery Sage", "description": "Health focus"},
                {"name": "Executive", "description": "Time-efficient"},
                {"name": "Realist", "description": "Down-to-earth"}
            ],
            "integrationsList": ["Strava", "Oura", "Polar", "Fitbit", "Garmin", "Whoop", "Coros", "Suunto"]
        }

@api_router.post("/waiting-list")
async def add_to_waiting_list(entry_data: dict):
    """Add entry to waiting list (public endpoint, no auth required)"""
    try:
        logging.info("=" * 80)
        logging.info("🔵 WAITLIST SIGNUP REQUEST RECEIVED")
        logging.info(f"📝 Request data: {entry_data}")
        logging.info("=" * 80)
        
        # Validate required fields
        if not entry_data.get("name") or not entry_data.get("email") or not entry_data.get("nationality"):
            logging.error(f"❌ VALIDATION FAILED - Missing fields. Data: {entry_data}")
            raise HTTPException(status_code=400, detail="Name, email, and nationality are required")
        
        logging.info(f"✅ STEP 1: Validation passed")
        
        # Check if email already exists
        existing = await db.waiting_list.find_one(
            {"email": entry_data["email"].lower().strip()},
            {"_id": 0}
        )
        
        if existing:
            logging.warning(f"⚠️ DUPLICATE: Email {entry_data['email']} already in waitlist")
            raise HTTPException(status_code=409, detail="Email already registered in waiting list")
        
        logging.info(f"✅ STEP 2: No duplicate found")
        
        # Create entry
        entry = WaitingListEntry(
            name=entry_data["name"].strip(),
            email=entry_data["email"].lower().strip(),
            nationality=entry_data["nationality"].strip(),
            integrations=entry_data.get("integrations", []),
            source=entry_data.get("source", "homepage"),
            notes=entry_data.get("notes")
        )
        
        logging.info(f"✅ STEP 3: Entry object created for {entry.email}")
        
        await db.waiting_list.insert_one(entry.model_dump())
        
        logging.info(f"✅ STEP 4: Entry saved to database - ID: {entry.id}")
        logging.info(f"📧 Starting auto-responder process for {entry.email}")
        
        # Debug tracking
        email_status = {
            "email_sent": False,
            "email_error": None,
            "service_enabled": False,
            "template_found": False,
            "step_reached": "4 - Entry saved"
        }
        
        # Send waitlist auto-responder email
        try:
            logging.info("🔄 STEP 5a: Getting email service...")
            # Get email service
            email_service = get_email_service()
            
            logging.info(f"📊 Email service status: enabled={email_service.enabled if email_service else 'None'}, sender={email_service.sender_email if email_service else 'None'}")
            
            if not email_service or not email_service.enabled:
                logging.error("❌ STEP 5b: Email service NOT configured or NOT enabled!")
                logging.error(f"   email_service exists: {email_service is not None}")
                logging.error(f"   email_service.enabled: {email_service.enabled if email_service else 'N/A'}")
                email_status["step_reached"] = "5b - Service not enabled"
                email_status["email_error"] = "Email service not configured or not enabled"
                return {
                    "message": "Successfully added to waiting list",
                    "id": entry.id,
                    "debug": email_status
                }
            
            email_status["service_enabled"] = True
            email_status["step_reached"] = "5b - Service enabled"
            logging.info("✅ STEP 5b: Email service is configured and enabled")
            
            # Get email template
            logging.info("🔄 STEP 6a: Fetching email template...")
            template = await db.email_templates.find_one({"template_id": "waitlist_autoresponder"})
            
            if not template:
                logging.error("❌ STEP 6b: Template NOT FOUND in database!")
                logging.error("   Queried for: {'template_id': 'waitlist_autoresponder'}")
                email_status["step_reached"] = "6b - Template not found"
                email_status["email_error"] = "Template not found in database"
                return {
                    "message": "Successfully added to waiting list",
                    "id": entry.id,
                    "debug": email_status
                }
            
            email_status["template_found"] = True
            email_status["step_reached"] = "6b - Template found"
            logging.info(f"✅ STEP 6b: Template found - Subject: {template.get('subject', 'N/A')}")
            
            # Replace variables
            subject = template.get("subject", "Thank You for Joining Our Waitlist!")
            html_body = template.get("html_body", "")
            text_body = template.get("body", "")
            
            logging.info("🔄 STEP 7: Replacing template variables...")
            
            # Replace template variables
            variables = {
                "{{user_name}}": entry.name,
                "{{user_email}}": entry.email,
                "{{preferred_language}}": entry.nationality
            }
            
            for var, value in variables.items():
                subject = subject.replace(var, value)
                html_body = html_body.replace(var, value)
                text_body = text_body.replace(var, value)
            
            email_status["step_reached"] = "7 - Variables replaced"
            logging.info(f"✅ STEP 7: Variables replaced - Final subject: {subject}")
            
            # Send email
            logging.info(f"📤 STEP 8: Sending email to {entry.email}...")
            logging.info(f"   Sender: {email_service.sender_email}")
            logging.info(f"   Recipient: {entry.email}")
            logging.info(f"   Subject: {subject}")
            
            email_status["step_reached"] = "8 - Sending email..."
            
            await email_service.send_email(
                to_email=entry.email,
                subject=subject,
                html_content=html_body,
                text_content=text_body
            )
            
            email_status["email_sent"] = True
            email_status["step_reached"] = "8 - Email sent successfully!"
            
            logging.info("=" * 80)
            logging.info(f"✅ ✅ ✅ SUCCESS! Waitlist auto-responder sent to {entry.email}")
            logging.info("=" * 80)
            
        except Exception as email_error:
            logging.error("=" * 80)
            logging.error(f"❌ ❌ ❌ ERROR sending waitlist auto-responder!")
            logging.error(f"Error type: {type(email_error).__name__}")
            logging.error(f"Error message: {str(email_error)}")
            logging.error(f"Full traceback:", exc_info=True)
            logging.error("=" * 80)
            email_status["email_error"] = f"{type(email_error).__name__}: {str(email_error)}"
            # Don't fail the whole request if email fails
        
        return {
            "message": "Successfully added to waiting list",
            "id": entry.id,
            "debug": email_status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"❌ CRITICAL ERROR adding to waiting list: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/waiting-list/test-debug")
async def test_waitlist_debug(test_email: str = "test@example.com"):
    """
    Test endpoint to trigger waitlist signup with detailed logging
    Use this to debug the auto-responder flow
    """
    test_data = {
        "name": "Debug Test User",
        "email": test_email,
        "nationality": "English",
        "integrations": ["test"],
        "source": "debug_test"
    }
    
    logging.info("🧪 TEST ENDPOINT CALLED - Starting debug test")
    
    # Call the actual waitlist endpoint
    result = await add_to_waiting_list(test_data)
    
    return {
        "test_result": "completed",
        "message": "Check logs for detailed debug output",
        "result": result
    }

@api_router.get("/waiting-list/diagnostic")
async def waitlist_diagnostic():
    """
    Diagnostic endpoint to verify waitlist auto-responder configuration
    This is a public endpoint to help verify deployment
    """
    try:
        # Check email service
        email_service = get_email_service()
        email_configured = email_service is not None and email_service.enabled
        
        # Check email template
        template = await db.email_templates.find_one({"template_id": "waitlist_autoresponder"})
        template_exists = template is not None
        
        # Build diagnostic response
        diagnostic = {
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "email_service": {
                "configured": email_configured,
                "enabled": email_service.enabled if email_service else False,
                "sender_email": email_service.sender_email if email_service else None
            },
            "waitlist_template": {
                "exists": template_exists,
                "template_id": "waitlist_autoresponder"
            },
            "code_version": "2024-11-27_fix_deployed",  # Version marker
            "checks": {
                "email_service_initialized": email_configured,
                "template_found": template_exists,
                "ready_to_send": email_configured and template_exists
            }
        }
        
        return diagnostic
        
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


@api_router.post("/system/reload-email-service")
async def reload_email_service(athlete_id: str):
    """
    Reload email service configuration from database
    Super Admin only - use after updating SendGrid settings
    """
    try:
        # Verify super admin
        await verify_super_admin(athlete_id)
        
        # Load SendGrid settings from database
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        
        if not settings or not settings.get("advanced", {}).get("sendgrid"):
            return {
                "success": False,
                "message": "SendGrid configuration not found in database"
            }
        
        sendgrid_config = settings["advanced"]["sendgrid"]
        
        if not sendgrid_config.get("apiKey") or not sendgrid_config.get("senderEmail"):
            return {
                "success": False,
                "message": "SendGrid configuration incomplete (missing API key or sender email)"
            }
        
        # Reinitialize email service
        initialize_email_service(
            api_key=sendgrid_config["apiKey"],
            sender_email=sendgrid_config["senderEmail"],
            sender_name=sendgrid_config.get("senderName", "TrainSmart")
        )
        
        logging.info(f"Email service reloaded from database: {sendgrid_config['senderEmail']}")
        
        return {
            "success": True,
            "message": "Email service reloaded successfully",
            "sender_email": sendgrid_config["senderEmail"],
            "sender_name": sendgrid_config.get("senderName", "TrainSmart")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to reload email service: {e}")
        return {
            "success": False,
            "message": f"Failed to reload email service: {str(e)}"
        }

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
        ).sort("created_at", -1).skip(skip).to_list(length=min(limit, 100))
        
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
        ).sort("created_at", -1).limit(100).to_list(length=100)
        
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
# DYNAMIC OG METADATA API - Moved to routes/pages_complete.py
# =====================================================

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
        print(f"🟢 [STRAVA AUTH START] user_id={user_id}")
        logging.info(f"[STRAVA AUTH START] Initiating OAuth for user: {user_id}")
        
        strava_service = StravaService(db)
        auth_data = await strava_service.get_authorization_url(user_id)
        
        print(f"🟢 [STRAVA AUTH START] Generated auth URL for user {user_id}")
        print(f"🟢 [STRAVA AUTH START] Callback URL will be: {auth_data['url'].split('redirect_uri=')[1].split('&')[0] if 'redirect_uri=' in auth_data['url'] else 'N/A'}")
        logging.info(f"[STRAVA AUTH START] Auth URL generated successfully")
        
        # Return the authorization URL - frontend will redirect user
        return {
            'authUrl': auth_data['url'],
            'state': auth_data['state']
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔴 [STRAVA AUTH START ERROR] {type(e).__name__}: {str(e)}")
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
        print(f"\n{'='*80}")
        print(f"🔷 [STRAVA CALLBACK HIT!] Received OAuth callback from Strava")
        print(f"🔷 [STRAVA CALLBACK] code={code[:15]}...")
        print(f"🔷 [STRAVA CALLBACK] state={state[:30]}...")
        print(f"🔷 [STRAVA CALLBACK] scope={scope}")
        print(f"{'='*80}\n")
        
        logging.info(f"[STRAVA CALLBACK] Received: code={code[:10]}..., state={state[:20]}..., scope={scope}")
        
        # Extract user_id from state or session
        strava_service = StravaService(db)
        
        print(f"🔷 [STRAVA CALLBACK] Looking up OAuth state in database...")
        # Find the OAuth state to get user_id
        oauth_state = await db.strava_oauth_state.find_one({'state': state})
        if not oauth_state:
            print(f"🔴 [STRAVA CALLBACK ERROR] OAuth state not found for state: {state}")
            logging.error(f"OAuth state not found for state: {state}")
            raise HTTPException(status_code=400, detail="Invalid OAuth state")
        
        user_id = oauth_state['user_id']
        print(f"🔷 [STRAVA CALLBACK] Found user_id: {user_id}")
        logging.info(f"Found user_id from OAuth state: {user_id}")
        
        # Exchange code for tokens
        print(f"🔷 [STRAVA CALLBACK] Exchanging authorization code for access tokens...")
        logging.info(f"Attempting to exchange code for tokens...")
        result = await strava_service.exchange_code_for_tokens(code, state, user_id)
        print(f"🟢 [STRAVA CALLBACK SUCCESS] Tokens exchanged successfully!")
        print(f"🟢 [STRAVA CALLBACK SUCCESS] Athlete: {result.get('athlete', {}).get('firstname', 'Unknown')} {result.get('athlete', {}).get('lastname', '')}")
        logging.info(f"Successfully exchanged code for tokens")
        
        # Redirect back to frontend with success
        await strava_service.load_settings()
        frontend_url = f"https://{strava_service.system_settings['callbackDomain']}/dashboard/account?tab=integrations&strava=connected"
        print(f"🟢 [STRAVA CALLBACK SUCCESS] Redirecting to: {frontend_url}")
        print(f"{'='*80}\n")
        logging.info(f"Redirecting to: {frontend_url}")
        return RedirectResponse(url=frontend_url)
        
    except HTTPException as he:
        print(f"🔴 [STRAVA CALLBACK ERROR] HTTPException: status={he.status_code}, detail={he.detail}")
        print(f"{'='*80}\n")
        logging.error(f"HTTPException in Strava callback: status={he.status_code}, detail={he.detail}", exc_info=True)
        # Redirect to frontend with error
        try:
            await strava_service.load_settings()
            frontend_url = f"https://{strava_service.system_settings['callbackDomain']}/dashboard/account?tab=integrations&strava=error"
        except:
            frontend_url = "/dashboard/account?tab=integrations&strava=error"
        return RedirectResponse(url=frontend_url)
    except Exception as e:
        print(f"🔴 [STRAVA CALLBACK ERROR] Unexpected: {type(e).__name__}: {str(e)}")
        print(f"{'='*80}\n")
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


@api_router.get("/auth/strava/status")
async def strava_connection_status(user_id: str):
    """
    Get current Strava connection status
    """
    try:
        print(f"🔍 [STRAVA STATUS CHECK] user_id={user_id}")
        strava_service = StravaService(db)
        status = await strava_service.get_connection_status(user_id)
        
        if status is None:
            print(f"🔍 [STRAVA STATUS CHECK] No connection found for user {user_id}")
            return {'connected': False}
        
        print(f"🟢 [STRAVA STATUS CHECK] Connected! User: {user_id}, Athlete: {status.get('athlete', {}).get('firstname', 'Unknown')}")
        return status
        
    except Exception as e:
        print(f"🔴 [STRAVA STATUS CHECK ERROR] {type(e).__name__}: {str(e)}")
        logging.error(f"Error checking Strava status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/strava/activities")
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


@api_router.post("/strava/sync")
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


@api_router.post("/integrations/strava/{user_id}/sync")
async def sync_strava_activities_by_user(user_id: str, force_full: bool = Query(False, description="Force full sync from epoch 0")):
    """
    Sync activities from Strava to database (frontend-compatible endpoint)
    """
    try:
        print(f"🔄 [STRAVA SYNC] user_id={user_id}, force_full={force_full}")
        logging.info(f"[STRAVA SYNC] Initiating sync for user: {user_id}, force_full={force_full}")
        
        strava_service = StravaService(db)
        result = await strava_service.sync_activities(user_id, force_full_sync=force_full)
        
        print(f"🟢 [STRAVA SYNC SUCCESS] Synced {result.get('synced_count', 0)} activities")
        logging.info(f"[STRAVA SYNC] Completed: {result}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"🔴 [STRAVA SYNC ERROR] {type(e).__name__}: {str(e)}")
        logging.error(f"Error syncing Strava activities: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# STRAVA WEBHOOKS
# ============================================================================

@api_router.get("/webhook/strava")
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


@api_router.post("/webhook/strava")
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


@api_router.post("/strava/webhook/create")
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


@api_router.get("/strava/webhook/list")
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


@api_router.delete("/strava/webhook/{subscription_id}")
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



# ============================================================================
# GENERIC INTEGRATION ENDPOINTS (Works for Oura, future integrations)
# ============================================================================

# Helper function to get service instance
def get_integration_service(provider: str):
    """Get the appropriate integration service"""
    services = {
        "strava": lambda: StravaService(db),
        "oura": lambda: OuraService(db),
        "polar": lambda: PolarService(db),
        "fitbit": lambda: FitbitService(db),
        "garmin": lambda: GarminService(db),
        "coros": lambda: CorosService(db),
        "whoop": lambda: WhoopService(db),
        "suunto": lambda: SuuntoService(db)
    }
    
    if provider not in services:
        raise HTTPException(status_code=404, detail=f"Provider '{provider}' not supported")
    
    return services[provider]()

@api_router.get("/auth/{provider}")
async def start_integration_auth(provider: str, user_id: str):
    """Generic OAuth start for any provider"""
    try:
        service = get_integration_service(provider)
        
        # Provider-specific scopes
        scopes_map = {
            "strava": ["read", "activity:read_all", "profile:read_all"],
            "oura": ["daily", "heartrate", "workout", "tag", "personal", "session"],
            "polar": ["accesslink.read_all"],
            "suunto": ["workout"]
        }
        
        scopes = scopes_map.get(provider, [])
        auth_url = await service.get_authorization_url(user_id, scopes)
        
        logging.info(f"[{provider.upper()}] Authorization URL generated for user: {user_id}")
        return {"authorization_url": auth_url}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error starting {provider} auth: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/auth/{provider}/callback")
async def integration_callback(provider: str, code: str = None, state: str = None, error: str = None):
    """Generic OAuth callback for any provider"""
    try:
        if error:
            logging.error(f"[{provider.upper()}] OAuth error: {error}")
            return RedirectResponse(url=f"/dashboard/account?tab=integrations&{provider}=error")
        
        if not code or not state:
            raise HTTPException(status_code=400, detail="Missing code or state parameter")
        
        service = get_integration_service(provider)
        result = await service.exchange_code_for_tokens(code, state)
        
        logging.info(f"[{provider.upper()}] Successfully connected for user: {result['user_id']}")
        return RedirectResponse(url=f"/dashboard/account?tab=integrations&{provider}=connected")
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[{provider.upper()}] Callback error: {e}", exc_info=True)
        return RedirectResponse(url=f"/dashboard/account?tab=integrations&{provider}=error")

@api_router.post("/auth/{provider}/disconnect")
async def disconnect_integration(provider: str, user_id: str = None, request: Request = None):
    """Generic disconnect for any provider"""
    try:
        # Get user_id from request body if not in query
        if not user_id:
            body = await request.json()
            user_id = body.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id required")
        
        service = get_integration_service(provider)
        result = await service.disconnect(user_id)
        
        logging.info(f"[{provider.upper()}] Disconnected for user: {user_id}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error disconnecting {provider}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/auth/{provider}/status")
async def get_integration_status(provider: str, user_id: str):
    """Generic status check for any provider"""
    try:
        service = get_integration_service(provider)
        status = await service.get_connection_status(user_id)
        return status
        
    except Exception as e:
        logging.error(f"Error getting {provider} status: {e}")
        return {"connected": False}

@api_router.post("/integrations/{provider}/{user_id}/sync")
async def sync_integration_data(provider: str, user_id: str, force_full: bool = Query(False, description="Force full sync from epoch 0")):
    """Generic sync for any provider"""
    try:
        logging.info(f"[{provider.upper()} SYNC] Initiating sync for user: {user_id}, force_full={force_full}")
        
        service = get_integration_service(provider)
        await service.load_settings()
        result = await service.sync_activities(user_id, force_full_sync=force_full)
        
        logging.info(f"[{provider.upper()} SYNC] Completed: {result}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        logging.error(f"{provider.title()} sync error: {str(e)}")
        logging.error(f"Traceback: {error_traceback}")
        raise HTTPException(status_code=500, detail=str(e) or f"Sync failed: {type(e).__name__}")

@api_router.get("/integrations/{provider}/{user_id}/activities")
async def get_integration_activities(provider: str, user_id: str, limit: int = 50):
    """Generic activities endpoint for any provider"""
    try:
        activities = await db[f"{provider}_activities"].find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("start_date", -1).limit(limit).to_list(length=limit)
        
        return {
            "activities": activities,
            "total": await db[f"{provider}_activities"].count_documents({"user_id": user_id})
        }
        
    except Exception as e:
        logging.error(f"Error fetching {provider} activities: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/integrations/{provider}/{user_id}/stats")
async def get_integration_stats(provider: str, user_id: str):
    """Generic stats endpoint for any provider"""
    try:
        service = get_integration_service(provider)
        
        # Check if service has a get_stats method
        if hasattr(service, 'get_stats'):
            stats = await service.get_stats(user_id)
            return stats
        else:
            # Generic stats
            count = await db[f"{provider}_activities"].count_documents({"user_id": user_id})
            return {"total_activities": count}
        
    except Exception as e:
        logging.error(f"Error fetching {provider} stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


        logging.error(f"Error fetching unread count: {e}")
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

# ============================================================================
# INCLUDE API ROUTER - Must be before catch-all route
# ============================================================================
app.include_router(api_router)

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



