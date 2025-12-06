"""
Strava Integration Routes
Handles Strava OAuth, activity syncing, webhooks, and data management
"""

from fastapi import APIRouter, HTTPException, Request, Query, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import logging
import httpx
import secrets
from urllib.parse import urlencode

from database import db
from strava_service import StravaService

# Create router
router = APIRouter(prefix="", tags=["integrations_strava"])

# Logger
logger = logging.getLogger(__name__)


# ==================== Pydantic Models ====================

class StravaCredentials(BaseModel):
    client_id: str
    client_secret: str
    access_token: str
    refresh_token: str


# ==================== Helper Functions ====================

def prepare_for_mongo(data):
    """Prepare data for MongoDB storage by converting datetime objects to ISO strings"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data


# ==================== LEGACY STRAVA ENDPOINTS ====================

@router.post("/integrations/strava/{athlete_id}/sync")
async def sync_strava_activities_legacy(athlete_id: str, force_full: bool = False):
    """Manually sync activities from Strava (Legacy endpoint)"""
    try:
        logger.info(f"[STRAVA SYNC] athlete_id/user_id={athlete_id}, force_full={force_full}")
        logging.info(f"[STRAVA SYNC] Initiating sync for user: {athlete_id}")
        
        # Use new StravaService instead of old activity manager
        strava_service = StravaService(db)
        await strava_service.load_settings()
        result = await strava_service.sync_activities(athlete_id, force_full_sync=force_full)
        
        logger.info(f"[STRAVA SYNC SUCCESS] Synced {result.get('imported', 0)} activities")
        logging.info(f"[STRAVA SYNC] Completed: {result}")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(f"[STRAVA SYNC ERROR] {type(e).__name__}: {str(e)}")
        logger.error(f"[STRAVA SYNC TRACEBACK]\n{error_traceback}")
        logging.error(f"Strava sync error: {str(e)}")
        logging.error(f"Traceback: {error_traceback}")
        raise HTTPException(status_code=500, detail=str(e) or f"Sync failed: {type(e).__name__}")


@router.get("/integrations/strava/{user_id}/activities")
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


@router.get("/integrations/strava/{user_id}/stats")
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


@router.get("/integrations/strava/{athlete_id}/status")
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


@router.post("/integrations/strava/{athlete_id}/credentials")
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
        logger.error(f"Error saving Strava credentials: {e}")
        raise HTTPException(status_code=500, detail="Failed to save Strava credentials")


@router.get("/auth/strava-old/{athlete_id}")
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


# ==================== MAIN STRAVA INTEGRATION ENDPOINTS ====================

@router.get("/auth/strava")
async def strava_auth_start(user_id: str):
    """
    Initiate Strava OAuth flow
    Returns authorization URL for user to visit
    """
    try:
        logger.info(f"[STRAVA AUTH START] user_id={user_id}")
        logging.info(f"[STRAVA AUTH START] Initiating OAuth for user: {user_id}")
        
        strava_service = StravaService(db)
        auth_data = await strava_service.get_authorization_url(user_id)
        
        logger.info(f"[STRAVA AUTH START] Generated auth URL for user {user_id}")
        logger.info(f"[STRAVA AUTH START] Callback URL will be: {auth_data['url'].split('redirect_uri=')[1].split('&')[0] if 'redirect_uri=' in auth_data['url'] else 'N/A'}")
        logging.info(f"[STRAVA AUTH START] Auth URL generated successfully")
        
        # Return the authorization URL - frontend will redirect user
        return {
            'authUrl': auth_data['url'],
            'state': auth_data['state']
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[STRAVA AUTH START ERROR] {type(e).__name__}: {str(e)}")
        logging.error(f"Error starting Strava auth: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/auth/strava/callback")
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
        logger.debug("=" * 80)
        logger.debug(f"[STRAVA CALLBACK HIT!] Received OAuth callback from Strava")
        logger.debug(f"[STRAVA CALLBACK] code={code[:15]}...")
        logger.debug(f"[STRAVA CALLBACK] state={state[:30]}...")
        logger.debug(f"[STRAVA CALLBACK] scope={scope}")
        logger.debug("=" * 80)
        
        logging.info(f"[STRAVA CALLBACK] Received: code={code[:10]}..., state={state[:20]}..., scope={scope}")
        
        # Extract user_id from state or session
        strava_service = StravaService(db)
        
        logger.debug(f"[STRAVA CALLBACK] Looking up OAuth state in database...")
        # Find the OAuth state to get user_id
        oauth_state = await db.strava_oauth_state.find_one({'state': state})
        if not oauth_state:
            logger.error(f"[STRAVA CALLBACK ERROR] OAuth state not found for state: {state}")
            logging.error(f"OAuth state not found for state: {state}")
            raise HTTPException(status_code=400, detail="Invalid OAuth state")
        
        user_id = oauth_state['user_id']
        logger.debug(f"[STRAVA CALLBACK] Found user_id: {user_id}")
        logging.info(f"Found user_id from OAuth state: {user_id}")
        
        # Exchange code for tokens
        logger.debug(f"[STRAVA CALLBACK] Exchanging authorization code for access tokens...")
        logging.info(f"Attempting to exchange code for tokens...")
        result = await strava_service.exchange_code_for_tokens(code, state, user_id)
        logger.info(f"[STRAVA CALLBACK SUCCESS] Tokens exchanged successfully!")
        logger.info(f"[STRAVA CALLBACK SUCCESS] Athlete: {result.get('athlete', {}).get('firstname', 'Unknown')} {result.get('athlete', {}).get('lastname', '')}")
        logging.info(f"Successfully exchanged code for tokens")
        
        # Redirect back to frontend with success
        await strava_service.load_settings()
        frontend_url = f"https://{strava_service.system_settings['callbackDomain']}/dashboard/account?tab=integrations&strava=connected"
        logger.info(f"[STRAVA CALLBACK SUCCESS] Redirecting to: {frontend_url}")
        logger.debug('=' * 80)\n")
        logging.info(f"Redirecting to: {frontend_url}")
        return RedirectResponse(url=frontend_url)
        
    except HTTPException as he:
        logger.error(f"[STRAVA CALLBACK ERROR] HTTPException: status={he.status_code}, detail={he.detail}")
        logger.debug('=' * 80)\n")
        logging.error(f"HTTPException in Strava callback: status={he.status_code}, detail={he.detail}", exc_info=True)
        # Redirect to frontend with error
        try:
            await strava_service.load_settings()
            frontend_url = f"https://{strava_service.system_settings['callbackDomain']}/dashboard/account?tab=integrations&strava=error"
        except Exception:
            frontend_url = "/dashboard/account?tab=integrations&strava=error"
        return RedirectResponse(url=frontend_url)
    except Exception as e:
        logger.error(f"[STRAVA CALLBACK ERROR] Unexpected: {type(e).__name__}: {str(e)}")
        logger.debug('=' * 80)\n")
        logging.error(f"Unexpected error in Strava callback: {type(e).__name__}: {str(e)}", exc_info=True)
        # Redirect to frontend with error - try to get callback domain
        try:
            settings_doc = await db.system_settings.find_one({"setting_type": "global"})
            if settings_doc and "advanced" in settings_doc and "strava" in settings_doc["advanced"]:
                callback_domain = settings_doc["advanced"]["strava"].get("callbackDomain", "trainsmart-ui.preview.emergentagent.com")
                frontend_url = f"https://{callback_domain}/dashboard/account?tab=integrations&strava=error"
                return RedirectResponse(url=frontend_url)
        except Exception:
            pass
        return RedirectResponse(url="/dashboard/account?tab=integrations&strava=error")


@router.post("/auth/strava/disconnect")
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


@router.get("/auth/strava/status")
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
        
        logger.info(f"[STRAVA STATUS CHECK] Connected! User: {user_id}, Athlete: {status.get('athlete', {}).get('firstname', 'Unknown')}")
        return status
        
    except Exception as e:
        logger.error(f"[STRAVA STATUS CHECK ERROR] {type(e).__name__}: {str(e)}")
        logging.error(f"Error checking Strava status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/strava/activities")
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


@router.post("/strava/sync")
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


@router.post("/integrations/strava/{user_id}/sync")
async def sync_strava_activities_by_user(user_id: str, force_full: bool = Query(False, description="Force full sync from epoch 0")):
    """
    Sync activities from Strava to database (frontend-compatible endpoint)
    """
    try:
        logger.info(f"[STRAVA SYNC] user_id={user_id}, force_full={force_full}")
        logging.info(f"[STRAVA SYNC] Initiating sync for user: {user_id}, force_full={force_full}")
        
        strava_service = StravaService(db)
        result = await strava_service.sync_activities(user_id, force_full_sync=force_full)
        
        logger.info(f"[STRAVA SYNC SUCCESS] Synced {result.get('synced_count', 0)} activities")
        logging.info(f"[STRAVA SYNC] Completed: {result}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[STRAVA SYNC ERROR] {type(e).__name__}: {str(e)}")
        logging.error(f"Error syncing Strava activities: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ==================== STRAVA WEBHOOKS ====================

@router.get("/webhook/strava")
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


@router.post("/webhook/strava")
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


@router.post("/strava/webhook/create")
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


@router.get("/strava/webhook/list")
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


@router.delete("/strava/webhook/{subscription_id}")
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
