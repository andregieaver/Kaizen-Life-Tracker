"""
Miscellaneous Utilities Routes - Complete
Handles various utility endpoints:
- Merits/Personal records tracking
- Schedule execution and management
- Recommendations generation
- Health endpoints
- Community polls voting
- File uploads (images and videos)
- Platform metrics
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging
import os
import glob

# Import image processor
import sys
sys.path.append('/app/backend')
from image_processor import process_and_save_image

# Initialize router
router = APIRouter(prefix="/api", tags=["misc_utilities"])

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Helper functions
async def verify_super_admin(athlete_id: str):
    """Verify if athlete is super admin"""
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="User not found")
    is_admin = athlete.get("is_super_admin", False) or athlete.get("role") == "super_admin"
    if not is_admin:
        raise HTTPException(status_code=403, detail="Access denied. Super admin privileges required.")
    return athlete

# ========================================
# MERITS / PERSONAL RECORDS ENDPOINTS
# ========================================

@router.get("/merits/{athlete_id}")
async def get_personal_records(athlete_id: str):
    """Get personal records for different distances"""
    
    # Define distance mappings (in meters)
    distance_map = {
        '1km': 1000,
        '1mile': 1609,  # 1 mile = 1609 meters
        '5km': 5000,
        '10km': 10000,
        'half_marathon': 21097,
        'marathon': 42195,
        '50km': 50000,
        '100km': 100000
    }
    
    merits = {}
    
    try:
        # Get all workouts for the athlete that are runs with distance and duration
        workouts = await db.workouts.find(
            {
                "athlete_id": athlete_id,
                "activity_type": "run",
                "distance_miles": {"$exists": True, "$gt": 0},
                "duration_minutes": {"$exists": True, "$gt": 0}
            },
            {"_id": 0, "distance_miles": 1, "duration_minutes": 1, "date": 1}
        ).to_list(length=10000)
        
        # Calculate pace for each workout and find PRs
        for distance_key, distance_meters in distance_map.items():
            distance_miles = distance_meters / 1609.34
            tolerance = 0.1  # 10% tolerance
            
            best_workout = None
            best_pace = float('inf')
            
            for workout in workouts:
                workout_distance = workout.get('distance_miles', 0)
                
                # Check if workout distance matches target (with tolerance)
                if abs(workout_distance - distance_miles) / distance_miles <= tolerance:
                    duration_minutes = workout.get('duration_minutes', 0)
                    if duration_minutes > 0:
                        pace = duration_minutes / workout_distance  # min/mile
                        
                        if pace < best_pace:
                            best_pace = pace
                            best_workout = workout
            
            if best_workout:
                duration_minutes = best_workout['duration_minutes']
                hours = int(duration_minutes // 60)
                minutes = int(duration_minutes % 60)
                seconds = int((duration_minutes % 1) * 60)
                
                # Format time
                if hours > 0:
                    time_str = f"{hours}h {minutes}m {seconds}s"
                else:
                    time_str = f"{minutes}m {seconds}s"
                
                # Calculate pace (min/mile)
                pace_decimal = best_pace
                pace_minutes = int(pace_decimal)
                pace_seconds = int((pace_decimal % 1) * 60)
                
                merits[distance_key] = {
                    "time": time_str,
                    "duration_minutes": duration_minutes,
                    "pace": f"{pace_minutes}:{pace_seconds:02d}",
                    "date": best_workout.get('date'),
                    "distance_miles": best_workout.get('distance_miles')
                }
        
        return merits
        
    except Exception as e:
        logging.error(f"Error fetching personal records: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ========================================
# PLATFORM METRICS ENDPOINT
# ========================================

@router.get("/platform-metrics")
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
            'zh': '🇨🇳 Chinese (中文)'
        }
        
        # Count actual translation files
        locale_path = "/app/frontend/src/locales"
        locale_files = glob.glob(f"{locale_path}/*.json")
        language_count = len([f for f in locale_files if os.path.basename(f) != 'en.json'])
        
        # Get actual language list
        languages_list = []
        for file in locale_files:
            lang_code = os.path.basename(file).replace('.json', '')
            if lang_code in language_map:
                languages_list.append(language_map[lang_code])
        
        # Get personality count from database
        personalities = await db.agents.find(
            {"accessibility": "frontend", "is_active": True},
            {"_id": 0, "name": 1, "personality": 1}
        ).to_list(length=100)
        
        personalities_list = [
            {
                "name": p.get("name", ""),
                "description": p.get("personality", "")[:50] if p.get("personality") else ""
            }
            for p in personalities
        ]
        
        # Get integrations count
        integrations = await db.system_settings.find_one(
            {"setting_type": "integrations"},
            {"_id": 0}
        )
        
        integrations_list = []
        if integrations:
            for key, value in integrations.items():
                if key != "setting_type" and isinstance(value, dict):
                    if value.get("enabled"):
                        integrations_list.append(key.replace("_", " ").title())
        
        # If no integrations in settings, use defaults
        if not integrations_list:
            integrations_list = ["Strava", "Oura", "Polar", "Fitbit", "Garmin", "Whoop", "Coros", "Suunto"]
        
        return {
            "languages": len(languages_list),
            "personalities": len(personalities_list),
            "integrations": len(integrations_list),
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
@router.post("/schedules/execute-now/{schedule_id}")
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
@router.post("/recommendations/{athlete_id}/generate")
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
@router.post("/schedules/execute")
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
@router.get("/providers")
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

@router.get("/me/connections")
async def get_user_connections(user_id: str = Query(...)):
    """Get all provider connections for a user"""
    connections = await db.user_connections.find(
        {"user_id": user_id},
        {"_id": 0, "access_token": 0, "refresh_token": 0}  # Don't return sensitive tokens
    ).limit(100).to_list(length=100)
    
    return {"connections": [parse_from_mongo(conn) for conn in connections]}

@router.post("/me/connections/{provider_key}/disconnect")
async def disconnect_provider(provider_key: str, user_id: str = Query(...)):
    """Disconnect a provider"""
    result = await db.user_connections.update_one(
        {"user_id": user_id, "provider_key": provider_key},
        {"$set": {"status": "disconnected", "updated_at": datetime.now(timezone.utc)}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    return {"message": f"{provider_key.capitalize()} disconnected successfully"}

@router.get("/auth/{provider_key}")
async def begin_provider_auth(provider_key: str, user_id: str = Query(...)):
    """Begin OAuth flow for a provider"""
    if provider_key not in connectors:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    connector = connectors[provider_key]
    auth_data = await connector.begin_auth(user_id)
    
    return auth_data

@router.post("/auth/{provider_key}/callback")
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

@router.post("/webhook/{provider_key}")
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

@router.get("/me/activities")
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

@router.get("/me/daily")
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

@router.get("/health/body-score-data/{athlete_id}")
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
--
@router.get("/health")
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
--
@router.post("/community/polls/{post_id}/vote")
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

@router.post("/upload/images")
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


@router.post("/upload/video")
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
@router.get("/platform-metrics")
async def get_platform_metrics():
