from fastapi import APIRouter, HTTPException, WebSocket
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/voice", tags=["voice"])

# Models
class VoiceConversation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    athlete_id: str
    session_id: str
    transcript: list
    duration_seconds: Optional[int] = None

# Voice routes will be added here
# This is a placeholder - routes will be migrated from server.py
