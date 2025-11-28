"""
Coach routes - Extracted from server.py
Handles AI coach chat, conversation history, and memory management
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import logging
import asyncio

# Import shared dependencies
from database import db
from utils import prepare_for_mongo, parse_from_mongo

router = APIRouter(prefix="/coach", tags=["coach"])

# ============= MODELS =============

class CoachChat(BaseModel):
    athlete_id: str
    message: str
    session_id: str

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    session_id: str
    message: str
    response: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    archived: Optional[bool] = False

class AthleteMemory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    category: str
    content: str
    importance: int = 5
    source_session: Optional[str] = None
    embedding: Optional[List[float]] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= ROUTES =============

# NOTE: POST /coach/chat remains in server.py due to dependency on ai_coach service
# This router focuses on conversation management and memory CRUD

@router.get("/history/{athlete_id}")
async def get_chat_history(athlete_id: str, limit: int = 20):
    """Get chat history for an athlete"""
    messages = await db.chat_messages.find(
        {"athlete_id": athlete_id}, 
        {"_id": 0}
    ).sort("timestamp", -1).limit(min(limit, 100)).to_list(length=100)
    return [parse_from_mongo(m) for m in messages]


@router.get("/conversations/{athlete_id}")
async def get_conversations(athlete_id: str, archived: Optional[bool] = None):
    """Get list of conversations grouped by session"""
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
    
    # Filter by archived status
    result = []
    for conv in conversations:
        is_archived = conv.get("archived") or False
        
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
            result.append({
                "session_id": conv["_id"],
                "last_message": conv["last_message"].isoformat() if isinstance(conv["last_message"], datetime) else conv["last_message"],
                "message_count": conv["message_count"],
                "preview": conv["preview"][:50] + "..." if len(conv["preview"]) > 50 else conv["preview"],
                "archived": is_archived
            })
    
    return result


@router.get("/conversation/{athlete_id}/{session_id}")
async def get_conversation(athlete_id: str, session_id: str):
    """Get all messages from a specific conversation"""
    messages = await db.chat_messages.find(
        {"athlete_id": athlete_id, "session_id": session_id}, 
        {"_id": 0}
    ).sort("timestamp", 1).limit(100).to_list(length=100)
    return [parse_from_mongo(m) for m in messages]


@router.delete("/{athlete_id}/{session_id}")
async def delete_conversation(athlete_id: str, session_id: str):
    """Delete all messages from a specific conversation"""
    result = await db.chat_messages.delete_many(
        {"athlete_id": athlete_id, "session_id": session_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {"success": True, "deleted_count": result.deleted_count}


@router.put("/{athlete_id}/{session_id}/archive")
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


# ============= MEMORY MANAGEMENT ROUTES =============

@router.get("/memory/{athlete_id}")
async def get_athlete_memories(athlete_id: str):
    """Get all memories for an athlete, organized by category"""
    # NOTE: This uses ai_coach.get_memories() in original code
    # For now, return raw memories from database
    memories = await db.athlete_memories.find(
        {"athlete_id": athlete_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(length=100)
    
    # Organize by category
    organized = {}
    for memory in memories:
        category = memory.get("category", "other")
        if category not in organized:
            organized[category] = []
        organized[category].append(parse_from_mongo(memory))
    
    return organized


@router.post("/memory/{athlete_id}")
async def create_memory(athlete_id: str, memory: AthleteMemory):
    """Manually create a memory"""
    memory.athlete_id = athlete_id
    memory_dict = prepare_for_mongo(memory.model_dump())
    await db.athlete_memories.insert_one(memory_dict)
    return {"message": "Memory created successfully", "memory_id": memory.id}


@router.delete("/memory/{memory_id}")
async def delete_memory(memory_id: str):
    """Delete a specific memory"""
    result = await db.athlete_memories.delete_one({"id": memory_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"message": "Memory deleted successfully"}


# NOTE: Voice session routes (/coach/voice/*) remain in server.py
# They require OpenAI Realtime API integration and ai_coach service
# Test search endpoint also remains in server.py (uses Tavily integration)
