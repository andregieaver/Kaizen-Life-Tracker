"""
Onboarding routes - Extracted from server.py
Handles user onboarding progress tracking and auto-completion
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import logging

# Import shared dependencies
from database import db

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

# ============= MODELS =============

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

# ============= ROUTES =============

@router.get("/status/{athlete_id}")
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

@router.put("/step/{athlete_id}")
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

@router.post("/dismiss/{athlete_id}")
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

@router.post("/check-auto-complete/{athlete_id}")
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
