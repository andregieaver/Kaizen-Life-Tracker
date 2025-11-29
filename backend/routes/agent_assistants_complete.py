"""
Agent Assistants Routes - Complete
Handles Management Agent (super admin) and Support Agent (all users) endpoints:
- Chat interfaces for both agents
- Voice session creation and management
- Voice command processing
- Conversation history and management
"""

from fastapi import APIRouter, HTTPException, Query, Body
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import logging
import os
import json

# Initialize router
router = APIRouter(prefix="/api", tags=["agent_assistants"])

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Helper functions
def prepare_for_mongo(data):
    """Prepare data for MongoDB storage by converting datetime objects to ISO strings"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data

def parse_from_mongo(item):
    """Parse data from MongoDB"""
    return item

async def verify_super_admin(athlete_id: str):
    """Verify if athlete is super admin"""
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="User not found")
    is_admin = athlete.get("is_super_admin", False) or athlete.get("role") == "super_admin"
    if not is_admin:
        raise HTTPException(status_code=403, detail="Access denied. Super admin privileges required.")
    return athlete

# Pydantic Models
class ManagementAgentMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str  # Always super admin
    session_id: str
    message: str
    response: str
    action_taken: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ManagementAgentChatRequest(BaseModel):
    athlete_id: str
    message: str
    session_id: str

class SupportAgentChatRequest(BaseModel):
    athlete_id: str
    session_id: str
    message: str
    media: Optional[List[dict]] = []

class SupportAgentMessage(BaseModel):
    athlete_id: str
    session_id: str
    message: str
    response: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    action_taken: Optional[str] = None

# OpenAI Realtime integration - import when needed
def get_openai_realtime(api_key: str):
    from emergentintegrations.llm.openai import OpenAIChatRealtime
    return OpenAIChatRealtime(api_key=api_key)

# ========================================
# MANAGEMENT AGENT ENDPOINTS (Super Admin Only)
# ========================================

@router.post("/management-agent/chat")
async def chat_with_management_agent(chat_request: ManagementAgentChatRequest):
    """
    Super admin-only AI assistant with full system access
    Can query database, navigate pages, and manage community content
    """
    try:
        # Verify super admin
        await verify_super_admin(chat_request.athlete_id)
        
        # Get OpenAI key from system settings
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        if not settings:
            settings = await db.system_settings.find_one({}, {"_id": 0})
        
        openai_key = None
        if settings:
            openai_key = settings.get("advanced", {}).get("openaiApiKey")
            if not openai_key:
                openai_key = settings.get("openaiApiKey")
        
        if not openai_key:
            raise HTTPException(status_code=400, detail="OpenAI API key not configured in system settings")
        
        # Load conversation history for this session
        conversation_history = []
        if chat_request.session_id:
            history_messages = await db.management_agent_messages.find(
                {"athlete_id": chat_request.athlete_id, "session_id": chat_request.session_id},
                {"_id": 0}
            ).sort("timestamp", 1).limit(20).to_list(length=20)
            
            # Convert to message format (last 10 exchanges)
            for msg in history_messages[-10:]:
                conversation_history.append({"role": "user", "content": msg.get("message", "")})
                conversation_history.append({"role": "assistant", "content": msg.get("response", "")})
        
        # System prompt for Management Agent
        system_prompt = """You are the App Management Agent, a powerful AI assistant with full administrative access to this health and fitness application.

**Your Capabilities:**
1. DATABASE QUERIES: You can search, filter, and analyze ANY data in the system
   - Available collections: athlete_profiles, community_posts, community_comments, community_groups, community_events, community_challenges, workouts, sleep_data, journal_entries, nutrition_entries, subscriptions, integrations, system_settings, and more
   - You can aggregate data, find patterns, and generate reports
   
2. USER MANAGEMENT: View and analyze user data across all accounts
   - Search users by any criteria (email, name, subscription tier, activity level, etc.)
   - View complete user profiles, health data, and activity history
   
3. COMMUNITY MANAGEMENT: Full control over community content
   - Create, edit, or delete posts, comments, groups, events, and challenges
   - Moderate content, manage permissions
   
4. PAGE NAVIGATION: Navigate the super admin to any page in the app
   - Can redirect to specific user profiles, posts, settings, etc.
   
5. ANALYTICS: Generate insights and statistics about the application
   - User engagement, subscription metrics, feature usage, etc.

**Important Guidelines:**
- For destructive operations (delete/update), always ask for confirmation first
- When providing data, format it clearly in tables or lists
- For database queries, explain what you're searching for before providing results
- Always prioritize data security and privacy
- Use clear, concise language

**Response Format:**
- Start with a brief explanation of what you're doing
- Provide the requested information or action
- If you need more details, ask specific questions
- Format data nicely using markdown tables when appropriate

**Example Queries:**
- "Show me all users who signed up this month"
- "Find posts with the most engagement in the last 7 days"
- "Navigate to user profile for john@example.com"
- "Create a challenge for the running group"
- "Generate a report on subscription renewals"

Remember: You are the super admin's intelligent assistant. Be helpful, efficient, and accurate."""

        # Use emergentintegrations LlmChat for OpenAI GPT-5
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(
            api_key=openai_key,
            session_id=chat_request.session_id,
            system_message=system_prompt
        ).with_model("openai", "gpt-5")
        
        user_message = UserMessage(text=chat_request.message)
        response = await chat.send_message(user_message)
        
        # Save to database
        message_record = ManagementAgentMessage(
            athlete_id=chat_request.athlete_id,
            session_id=chat_request.session_id,
            message=chat_request.message,
            response=response,
            action_taken=None
        )
        message_dict = prepare_for_mongo(message_record.model_dump())
        await db.management_agent_messages.insert_one(message_dict)
        
        return {"response": response}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Management Agent chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get management agent response: {str(e)}")

@router.post("/management-agent/voice/session/{athlete_id}")
async def create_management_voice_session(athlete_id: str):
    """Create a voice session for Management Agent (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        # Get OpenAI key from system settings
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        if not settings:
            settings = await db.system_settings.find_one({}, {"_id": 0})
        
        openai_key = None
        if settings:
            openai_key = settings.get("advanced", {}).get("openaiApiKey")
            if not openai_key:
                openai_key = settings.get("openaiApiKey")
        
        if not openai_key:
            raise HTTPException(status_code=400, detail="OpenAI API key not configured. Please add your API key in System Settings.")
        
        # System message for voice mode
        system_message = """You are the Management Agent with full administrative access to this application.

IMPORTANT: You have access to real-time data through special commands. Use them to provide accurate information.

YOUR CAPABILITIES:

1. INSPECT APPLICATION - Use at conversation start to understand what data exists:
   Say: "Let me check the application data. INSPECT:all"
   This gives you awareness of collections, schemas, and current state.

2. NAVIGATE PAGES - Navigate admin to any dashboard page:
   Format: "NAVIGATE:/dashboard/[page]"
   Pages: community, system-settings, crm, subscriptions, calendar, etc.
   Example: "Sure! Going to community now. NAVIGATE:/dashboard/community"

3. QUERY DATABASE - Get real data from collections:
   Format: "QUERY:collection_name:query_type"
   Example: "Let me check. QUERY:athlete_profiles:count"
   
4. GET STATISTICS - Get app-wide stats:
   Format: "STATS:stat_type"
   Example: "STATS:all" or "STATS:users"

5. GET USER INFO - Look up user details:
   Format: "USER:email@example.com"
   Example: "Looking up that user. USER:john@example.com"

WORKFLOW:
- First message: Use INSPECT:all to understand the application
- Answer questions: Use QUERY, STATS, or USER commands
- Navigate when asked: Use NAVIGATE command
- Always acknowledge before using commands

TONE: Professional, conversational, brief. Keep voice responses under 2 sentences."""
        
        realtime = get_openai_realtime(openai_key)
        
        # Try to create session with system_message, fall back if not supported
        try:
            logging.info(f"[MGMT VOICE] Creating ephemeral session with voice=alloy")
            session_data = await realtime.create_ephemeral_session_for_audio_chat(
                voice='alloy',
                system_message=system_message
            )
            logging.info(f"[MGMT VOICE] Session data received: {type(session_data)}")
        except TypeError as te:
            logging.info(f"[MGMT VOICE] TypeError with system_message: {te}")
            try:
                logging.info(f"[MGMT VOICE] Retrying with just voice parameter")
                session_data = await realtime.create_ephemeral_session_for_audio_chat(voice='alloy')
                logging.info(f"[MGMT VOICE] Session data received (fallback 1): {type(session_data)}")
            except TypeError as te2:
                logging.info(f"[MGMT VOICE] TypeError with voice only: {te2}")
                logging.info(f"[MGMT VOICE] Using default parameters")
                session_data = await realtime.create_ephemeral_session_for_audio_chat()
                logging.info(f"[MGMT VOICE] Session data received (fallback 2): {type(session_data)}")
        
        return session_data
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Management voice session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/management-agent/voice/negotiate/{athlete_id}")
async def negotiate_management_voice_connection(athlete_id: str, sdp: str = Body(..., media_type="application/sdp")):
    """Negotiate WebRTC connection for Management Agent voice (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        # Get OpenAI key
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        if not settings:
            settings = await db.system_settings.find_one({}, {"_id": 0})
        
        openai_key = None
        if settings:
            openai_key = settings.get("advanced", {}).get("openaiApiKey")
            if not openai_key:
                openai_key = settings.get("openaiApiKey")
        
        if not openai_key:
            raise HTTPException(status_code=400, detail="OpenAI API key not configured.")
        
        realtime = get_openai_realtime(openai_key)
        answer_sdp = await realtime.negotiate_connection(sdp)
        
        # Check if answer is an error response from OpenAI
        if isinstance(answer_sdp, str) and (answer_sdp.startswith('{') or answer_sdp.startswith('{')):
            try:
                error_data = json.loads(answer_sdp)
                if "error" in error_data:
                    error_msg = error_data.get("error", {}).get("message", "Unknown error")
                    raise HTTPException(status_code=400, detail=f"OpenAI error: {error_msg}")
            except json.JSONDecodeError:
                pass
        
        return {"sdp": answer_sdp}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Management voice negotiation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/management-agent/voice/process-command")
async def process_voice_command(request: dict, athlete_id: str = Query(...)):
    """Process commands from voice transcript (INSPECT, QUERY, STATS, USER, NAVIGATE)"""
    try:
        await verify_super_admin(athlete_id)
        
        command_text = request.get("command", "")
        results = []
        
        # Parse and execute commands
        if "INSPECT:" in command_text:
            aspect = command_text.split("INSPECT:")[1].split()[0].strip()
            inspection_data = {}
            
            if aspect in ["collections", "all"]:
                collections = await db.list_collection_names()
                collection_info = {}
                for coll_name in collections:
                    count = await db[coll_name].count_documents({})
                    collection_info[coll_name] = {"count": count, "has_data": count > 0}
                inspection_data["collections"] = collection_info
            
            if aspect in ["all"]:
                inspection_data["quick_stats"] = {
                    "total_users": await db.athlete_profiles.count_documents({}),
                    "total_agents": await db.agents.count_documents({}),
                    "community_posts": await db.community_posts.count_documents({})
                }
            
            results.append({"type": "inspection", "data": inspection_data})
        
        if "QUERY:" in command_text:
            parts = command_text.split("QUERY:")[1].split(":")
            collection = parts[0].strip()
            query_type = parts[1].strip() if len(parts) > 1 else "count"
            
            if query_type == "count":
                count = await db[collection].count_documents({})
                results.append({"type": "query", "collection": collection, "count": count})
        
        if "STATS:" in command_text:
            stat_type = command_text.split("STATS:")[1].split()[0].strip()
            stats = {}
            
            if stat_type in ["users", "all"]:
                stats["total_users"] = await db.athlete_profiles.count_documents({})
            if stat_type in ["subscriptions", "all"]:
                stats["active_subscriptions"] = await db.subscriptions.count_documents({"status": "active"})
            
            results.append({"type": "statistics", "data": stats})
        
        if "USER:" in command_text:
            identifier = command_text.split("USER:")[1].split()[0].strip()
            user = await db.athlete_profiles.find_one(
                {"$or": [{"email": identifier}, {"id": identifier}]},
                {"_id": 0, "email": 1, "name": 1, "subscription_tier": 1}
            )
            results.append({"type": "user", "data": user})
        
        if "NAVIGATE:" in command_text:
            nav_path = command_text.split("NAVIGATE:")[1].split()[0].strip()
            results.append({"type": "navigate", "path": nav_path})
        
        return {"results": results, "command_processed": len(results) > 0}
        
    except Exception as e:
        logging.error(f"Voice command processing error: {e}")
        return {"results": [], "error": str(e)}

@router.get("/management-agent/history/{athlete_id}")
async def get_management_agent_history(athlete_id: str, limit: int = 20):
    """Get Management Agent chat history (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        messages = await db.management_agent_messages.find(
            {"athlete_id": athlete_id}, 
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(length=limit)
        
        return [parse_from_mongo(m) for m in messages]
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get management agent history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/management-agent/conversations/{athlete_id}")
async def get_management_agent_conversations(athlete_id: str):
    """Get list of Management Agent conversations (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        pipeline = [
            {"$match": {"athlete_id": athlete_id}},
            {"$sort": {"timestamp": -1}},
            {"$group": {
                "_id": "$session_id",
                "last_message": {"$first": "$timestamp"},
                "message_count": {"$sum": 1},
                "preview": {"$first": "$message"}
            }},
            {"$sort": {"last_message": -1}},
            {"$limit": 50}
        ]
        
        conversations = await db.management_agent_messages.aggregate(pipeline).to_list(length=50)
        
        result = []
        for conv in conversations:
            result.append({
                "session_id": conv["_id"],
                "last_message": conv["last_message"].isoformat() if isinstance(conv["last_message"], datetime) else conv["last_message"],
                "message_count": conv["message_count"],
                "preview": conv["preview"][:50] + "..." if len(conv["preview"]) > 50 else conv["preview"]
            })
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get management agent conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ========================================
# SUPPORT AGENT ENDPOINTS (All Logged-in Users)
# ========================================

# CommunityPost model for Support Agent post creation
class CommunityPost(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    athlete_name: str
    athlete_profile_picture: Optional[str] = None
    content: str
    image_urls: Optional[List[str]] = []
    media: Optional[List[dict]] = []
    visibility: str = "public"
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_edited: bool = False
    shared_post_id: Optional[str] = None
    shared_post_data: Optional[dict] = None
    youtube_data: Optional[dict] = None
    url_preview: Optional[dict] = None

