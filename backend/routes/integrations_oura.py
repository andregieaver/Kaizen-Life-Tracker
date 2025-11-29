"""
Oura Integration Routes
Handles Oura Ring OAuth, activity syncing, and data management
"""

from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import logging
import asyncio

from database import db
from oura_service import OuraService

# Create router
router = APIRouter(prefix="", tags=["integrations_oura"])

# Logger
logger = logging.getLogger(__name__)


# ==================== Pydantic Models ====================

class OuraCredentials(BaseModel):
    client_id: str
    client_secret: str


# ==================== OURA INTEGRATION ENDPOINTS ====================

@router.post("/integrations/oura/{athlete_id}/credentials")
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


@router.get("/auth/oura/callback")
async def oura_auth_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None)
):
    """
    Handle Oura OAuth callback
    Now uses OuraService and redirects properly
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


@router.get("/auth/oura/{athlete_id}")
async def oura_auth_initiate(athlete_id: str):
    """
    Initiate Oura OAuth authorization flow
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


@router.post("/integrations/oura/{athlete_id}/sync")
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


@router.get("/integrations/oura/{athlete_id}/status")
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


@router.get("/integrations/oura/{athlete_id}/activities")
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
