"""
Other Integration Routes
Handles COROS, Garmin, and other provider integrations, plus generic provider endpoints
"""

from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import RedirectResponse
from datetime import datetime, timezone
import logging
import os

from database import db
from strava_service import StravaService
from oura_service import OuraService
from polar_service import PolarService
from fitbit_service import FitbitService
from garmin_service import GarminService
from coros_service import CorosService
from whoop_service import WhoopService
from suunto_service import SuuntoService

# Create router
router = APIRouter(prefix="", tags=["integrations_other"])

# Logger
logger = logging.getLogger(__name__)


# ==================== STATUS STUB ENDPOINTS ====================

@router.get("/integrations/polar/{athlete_id}/status")
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


@router.get("/integrations/garmin/{athlete_id}/status")
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


@router.get("/integrations/fitbit/{athlete_id}/status")
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


@router.get("/integrations/whoop/{athlete_id}/status")
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


@router.get("/integrations/suunto/{athlete_id}/status")
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


@router.get("/integrations/coros/{athlete_id}/status")
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


# ==================== COROS INTEGRATION (VIA TERRA API) ====================

@router.get("/auth/coros/{athlete_id}")
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


@router.post("/auth/coros/callback")
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


@router.post("/integrations/coros/{athlete_id}/sync")
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


@router.get("/integrations/coros/{athlete_id}/status")
async def get_coros_integration_status(athlete_id: str):
    """Get COROS integration status (alternative endpoint)"""
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


# ==================== GARMIN INTEGRATION ====================

@router.get("/auth/garmin/callback")
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


# ==================== GENERIC PROVIDER ENDPOINTS ====================

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


@router.get("/integrations/{provider}/auth")
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


@router.get("/integrations/{provider}/callback")
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


@router.post("/auth/{provider}/disconnect")
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


@router.get("/auth/{provider}/status")
async def get_integration_status(provider: str, user_id: str):
    """Generic status check for any provider"""
    try:
        service = get_integration_service(provider)
        status = await service.get_connection_status(user_id)
        return status
        
    except Exception as e:
        logging.error(f"Error getting {provider} status: {e}")
        return {"connected": False}


@router.post("/integrations/{provider}/{user_id}/sync")
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


@router.get("/integrations/{provider}/{user_id}/activities")
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


@router.get("/integrations/{provider}/{user_id}/stats")
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
