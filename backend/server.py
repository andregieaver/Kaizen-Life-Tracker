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
from routes.challenges_complete import router as challenges_router
from routes.events_complete import router as events_router
from routes.groups_complete import router as groups_router
from routes.community_misc_complete import router as community_misc_router
from routes.integrations_basic import router as integrations_basic_router
from routes.integrations_strava import router as integrations_strava_router
from routes.integrations_oura import router as integrations_oura_router
from routes.integrations_other import router as integrations_other_router
from routes.weather_complete import router as weather_router
from routes.voice_realtime_complete import router as voice_realtime_router
from routes.health_metrics_complete import router as health_metrics_router
from routes.bookmarks_complete import router as bookmarks_router
from routes.ai_coach_chat_complete import router as ai_coach_chat_router, set_ai_coach_service
from routes.agent_assistants_complete import router as agent_assistants_router
from routes.agents_crud_complete import router as agents_crud_router
from routes.email_crm_complete import router as email_crm_router
from routes.waitinglist_complete import router as waitinglist_router
from routes.analytics_system_complete import router as analytics_system_router
from routes.habits_complete import router as habits_router
from routes.onboarding_complete import router as onboarding_router

# Include refactored routers (these routes are now extracted)
app.include_router(habits_router, prefix="/api")
app.include_router(onboarding_router, prefix="/api")
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
api_router.include_router(challenges_router)
api_router.include_router(events_router)
api_router.include_router(groups_router)
api_router.include_router(community_misc_router)
api_router.include_router(integrations_basic_router)
api_router.include_router(integrations_strava_router)
api_router.include_router(integrations_oura_router)
api_router.include_router(integrations_other_router)
app.include_router(weather_router)
app.include_router(voice_realtime_router)
app.include_router(health_metrics_router)
app.include_router(bookmarks_router)
app.include_router(ai_coach_chat_router)
app.include_router(agent_assistants_router)
app.include_router(agents_crud_router)
app.include_router(email_crm_router)
app.include_router(waitinglist_router)
app.include_router(analytics_system_router)
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
# Event, EventAttendance models moved to routes/events_complete.py
# Challenge, ChallengeParticipation, ChallengeComment, ChallengeAchievement models moved to routes/challenges_complete.py
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
set_ai_coach_service(ai_coach)  # Set AI coach service for router
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

# Athlete Profile routes - MOVED to routes/athletes_complete.py

# Subscription routes - MOVED to routes/subscriptions_complete.py


# Journal routes - MOVED to routes/journal_complete.py


# Nutrition routes - MOVED to routes/nutrition_complete.py


# Workout routes - MOVED to routes/workouts_complete.py


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

# AI Coach chat routes - MOVED to routes/ai_coach_chat_complete.py

# Memory Management routes - MOVED to routes/ai_coach_chat_complete.py

# OpenAI Realtime Voice API routes - MOVED to routes/voice_realtime_complete.py

# Management Agent endpoints - MOVED to routes/agent_assistants_complete.py


# Support Agent endpoints - MOVED to routes/agent_assistants_complete.py

# Agents CRUD endpoints - MOVED to routes/agents_crud_complete.py


# ============================================================================
# OURA INTEGRATION ENDPOINTS - Moved to routes/integrations_oura.py
# ============================================================================

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
        
        # Fetch Oura data if connected or if data exists
        # Try both athlete_id and user_id for backwards compatibility
        oura_connection = await db.oura_connections.find_one({
            "$or": [{"athlete_id": athlete_id}, {"user_id": athlete_id}]
        })
        
        # Check if Oura data exists even without connection
        has_oura_data = await db.readiness_scores.count_documents({
            "$or": [{"athlete_id": athlete_id}, {"user_id": athlete_id}]
        }, limit=1) > 0
        
        if (oura_connection and oura_connection.get('access_token')) or has_oura_data:
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
        # TODO: Re-enable when auto_scan_cookies function is properly defined in cookies router
        # scheduler.add_job(
        #     auto_scan_cookies,
        #     CronTrigger(day_of_week='mon', hour=2, minute=0),
        #     id='auto_cookie_scan',
        #     replace_existing=True
        # )
        

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
        print("Strava & Oura auto-sync: Daily at 8 AM")
        print("=" * 50)
        logging.info("Scheduler started - checking for due schedules every minute")
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

# ==========================================
# HABITS ENDPOINTS - EXTRACTED TO routes/habits_complete.py
# ==========================================

# All habit endpoints have been moved to routes/habits_complete.py
# Endpoints: POST /, GET /{athlete_id}, PUT /{habit_id}, DELETE /{habit_id},
#            POST /{habit_id}/complete, POST /{habit_id}/uncomplete, GET /{athlete_id}/completions


# ==========================================
# ONBOARDING ENDPOINTS - EXTRACTED TO routes/onboarding_complete.py
# ==========================================

# All onboarding endpoints have been moved to routes/onboarding_complete.py
# Endpoints: GET /status/{athlete_id}, PUT /step/{athlete_id}, POST /dismiss/{athlete_id},
#            POST /check-auto-complete/{athlete_id}

# ==========================================
# BODY SCORE STREAK & LEADERBOARD ENDPOINTS - EXTRACTED TO routes/health_metrics_complete.py
# ==========================================
# All body score endpoints have been moved to routes/health_metrics_complete.py
# Endpoints: POST /body-score/save/{athlete_id}, GET /body-score/streak/{athlete_id}, GET /body-score/leaderboard

"""
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
# WEATHER API ENDPOINTS - MOVED to routes/weather_complete.py
# ==========================================
# BOOKMARKS ENDPOINTS - MOVED to routes/bookmarks_complete.py
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



# ============================================================================
# COMMUNITY, CHALLENGES, GROUPS, EVENTS ENDPOINTS
# All moved to respective router files:
# - routes/community_complete.py (posts, comments, likes, follows)
# - routes/challenges_complete.py
# - routes/groups_complete.py
# - routes/events_complete.py
# - routes/community_misc_complete.py (notifications, polls, utilities)
# ============================================================================
# Include the router in the main app (after all endpoints are defined)
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

# Duplicate system settings (GET/POST /system/settings, GET /system/subscriber-stats, POST /system/upload-seo-image) moved to routes/system_complete.py

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
# STRAVA INTEGRATION ENDPOINTS - Moved to routes/integrations_strava.py
# ============================================================================

# ============================================================================
# OURA INTEGRATION ENDPOINTS - Moved to routes/integrations_oura.py
# ============================================================================

# ============================================================================
# OTHER INTEGRATION ENDPOINTS - Moved to routes/integrations_other.py
# Includes: COROS, Garmin, Polar, Fitbit, Whoop, Suunto status stubs
# Plus: Generic provider endpoints for all integrations
# ============================================================================

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



