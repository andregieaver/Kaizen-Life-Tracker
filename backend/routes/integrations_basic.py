"""
Basic Integration Management Routes
Handles OpenAI API key management and generic integration CRUD operations
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any, List
from datetime import datetime, timezone
import logging
import uuid

from database import db

# Create router
router = APIRouter(prefix="", tags=["integrations_basic"])

# Logger
logger = logging.getLogger(__name__)


# ==================== Pydantic Models ====================

class APIKeyRequest(BaseModel):
    api_key: str


class Integration(BaseModel):
    id: str
    athlete_id: str
    integration_type: str  # 'openai', 'strava', 'oura'
    credentials: Dict[str, Any]  # Encrypted storage for tokens/keys
    settings: Dict[str, Any] | None = None
    last_sync: datetime | None = None
    is_active: bool = True
    created_at: datetime


# ==================== Helper Functions ====================

def prepare_for_mongo(data):
    """Prepare data for MongoDB storage by converting datetime objects to ISO strings"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data


def parse_from_mongo(item):
    """Parse MongoDB document for API response"""
    return item


# ==================== OpenAI Integration Routes ====================

@router.post("/integrations/openai/{athlete_id}")
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
        integration_data = {
            "id": str(uuid.uuid4()),
            "athlete_id": athlete_id,
            "integration_type": "openai",
            "credentials": {"api_key": key_request.api_key},  # Should be encrypted in production
            "settings": {"model": "gpt-4", "max_tokens": 2000},
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_sync": None
        }
        
        # Upsert integration
        await _db.integrations.update_one(
            {"athlete_id": athlete_id, "integration_type": "openai"},
            {"$set": integration_data},
            upsert=True
        )
        
        logger.info(f"OpenAI API key saved successfully for athlete: {athlete_id}")
        return {"message": "OpenAI API key saved successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving OpenAI API key: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save API key: {str(e)}")


# ==================== Generic Integration Routes ====================

@router.get("/integrations/{athlete_id}")
async def get_athlete_integrations(athlete_id: str):
    """Get all integrations for an athlete"""
    integrations = await _db.integrations.find(
        {"athlete_id": athlete_id, "is_active": True},
        {"_id": 0, "credentials": 0}  # Don't return sensitive credentials
    ).limit(100).to_list(length=100)
    
    return {"integrations": [parse_from_mongo(i) for i in integrations]}


@router.delete("/integrations/{athlete_id}/{integration_type}")
async def disconnect_integration(athlete_id: str, integration_type: str):
    """Disconnect/deactivate an integration"""
    result = await _db.integrations.update_one(
        {"athlete_id": athlete_id, "integration_type": integration_type},
        {"$set": {"is_active": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    return {"message": f"{integration_type.capitalize()} integration disconnected"}
