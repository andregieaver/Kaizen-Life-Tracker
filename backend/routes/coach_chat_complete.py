"""
AI Coach Chat Routes
Handles text-based AI coaching conversations, history, and memory management
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import logging
import asyncio

from database import db

# Create router
router = APIRouter(prefix="/api", tags=["coach_chat"])

# Logger
logger = logging.getLogger(__name__)


# ==================== Pydantic Models ====================

class CoachChat(BaseModel):
    athlete_id: str
    message: str
    session_id: str


class ChatMessage(BaseModel):
    athlete_id: str
    session_id: str
    message: str
    response: str
    timestamp: datetime = datetime.now(timezone.utc)
    archived: bool = False


class AthleteMemory(BaseModel):
    athlete_id: str
    category: str
    content: str
    confidence: float = 1.0
    source: str = "manual"


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


async def get_ai_coach():
    """Get or create AI coach instance"""
    # Import here to avoid circular dependencies
    from ai_coach_service import AICoachService
    
    # Get OpenAI API key from system settings
    system_settings = await db.system_settings.find_one({}, {"_id": 0})
    if not system_settings:
        raise HTTPException(status_code=500, detail="System settings not found")
    
    openai_api_key = system_settings.get('advanced', {}).get('openaiApiKey')
    if not openai_api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    
    return AICoachService(openai_api_key)


# ==================== AI Coach Chat Endpoints ====================

@router.post("/coach/chat")
async def chat_with_ai_coach(chat_request: CoachChat):
    """Send a message to the AI coach and get a response"""
    try:
        ai_coach = await get_ai_coach()
        
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


@router.get("/coach/test-search")
async def test_search(query: str = "benefits of Zone 2 training"):
    """Test endpoint to verify Tavily search is working"""
    try:
        ai_coach = await get_ai_coach()
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
            "tavily_configured": False
        }


@router.get("/coach/history/{athlete_id}")
async def get_chat_history(athlete_id: str, limit: int = 20):
    """Get recent chat history for an athlete"""
    messages = await db.chat_messages.find(
        {"athlete_id": athlete_id}, 
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(length=100)
    return [parse_from_mongo(m) for m in messages]


@router.get("/coach/conversations/{athlete_id}")
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


@router.get("/coach/conversation/{athlete_id}/{session_id}")
async def get_conversation(athlete_id: str, session_id: str):
    """Get all messages from a specific conversation"""
    messages = await db.chat_messages.find(
        {"athlete_id": athlete_id, "session_id": session_id}, 
        {"_id": 0}
    ).sort("timestamp", 1).to_list(length=100)
    return [parse_from_mongo(m) for m in messages]


@router.delete("/coach/{athlete_id}/{session_id}")
async def delete_conversation(athlete_id: str, session_id: str):
    """Delete all messages from a specific conversation"""
    result = await db.chat_messages.delete_many(
        {"athlete_id": athlete_id, "session_id": session_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {"success": True, "deleted_count": result.deleted_count}


@router.put("/coach/{athlete_id}/{session_id}/archive")
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


# ==================== Memory Management Endpoints ====================

@router.get("/memory/{athlete_id}")
async def get_athlete_memories(athlete_id: str):
    """Get all memories for an athlete, organized by category"""
    try:
        ai_coach = await get_ai_coach()
        memories = await ai_coach.get_memories(athlete_id)
        return memories
    except Exception as e:
        logging.error(f"Error fetching memories: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch memories")


@router.post("/memory/{athlete_id}")
async def create_memory(athlete_id: str, memory: AthleteMemory):
    """Manually create a memory"""
    try:
        ai_coach = await get_ai_coach()
        await ai_coach.save_memory(
            athlete_id,
            memory.category,
            memory.content,
            memory.confidence,
            memory.source
        )
        return {"success": True, "message": "Memory created successfully"}
    except Exception as e:
        logging.error(f"Error creating memory: {e}")
        raise HTTPException(status_code=500, detail="Failed to create memory")


@router.delete("/memory/{athlete_id}/{memory_id}")
async def delete_memory(athlete_id: str, memory_id: str):
    """Delete a specific memory"""
    result = await db.athlete_memories.delete_one({
        "athlete_id": athlete_id,
        "id": memory_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    return {"message": "Memory deleted successfully"}
