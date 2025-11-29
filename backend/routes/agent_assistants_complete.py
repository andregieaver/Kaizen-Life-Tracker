"""
Agent Assistants Routes - Complete
Handles Management Agent (super admin) and Support Agent (all users) endpoints:
- Chat interfaces for both agents
- Voice session creation and management
- Voice command processing
- Conversation history and management
"""

from fastapi import APIRouter, HTTPException, Query, Body, UploadFile, File
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import logging
import os
import json
import re
import aiohttp
import subprocess

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

@router.post("/support-agent/chat")
async def chat_with_support_agent(chat_request: SupportAgentChatRequest):
    """
    User-scoped AI assistant with full access to user's own data
    Can query user data, navigate pages, and manage user's community content
    """
    try:
        # Verify user is logged in (no super admin check - available to all users)
        athlete = await db.athlete_profiles.find_one({"id": chat_request.athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="User not found")
        
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
            history_messages = await db.support_agent_messages.find(
                {"athlete_id": chat_request.athlete_id, "session_id": chat_request.session_id},
                {"_id": 0}
            ).sort("timestamp", 1).limit(20).to_list(length=20)
            
            # Convert to message format (last 10 exchanges)
            for msg in history_messages[-10:]:
                conversation_history.append({"role": "user", "content": msg.get("message", "")})
                conversation_history.append({"role": "assistant", "content": msg.get("response", "")})
        
        # System prompt for Support Agent
        system_prompt = f"""You are the Support Agent, a helpful AI assistant for {athlete.get('name', 'User')} with access to their personal health and fitness data.

**Your Capabilities:**
1. USER DATA ACCESS: You can view and analyze the user's personal data
   - Profile information (name, email, subscription, settings)
   - Health metrics (Oura sleep, HRV, readiness; Strava activities, VO2max)
   - Journal entries (daily reflections, mood, notes)
   - Workouts and training data
   - Nutrition logs and meal tracking
   - Community activity (posts, comments, groups, events)
   
2. DATA INSIGHTS: Generate personalized insights and recommendations
   - Analyze trends in sleep, recovery, and training
   - Provide coaching based on their data
   - Suggest optimizations for health and fitness goals
   
3. CONTENT MANAGEMENT: Help manage their community presence
   - Create posts on their behalf (tell them "I'll create that post for you!" then create it)
   - When user asks you to post something, extract the content and confirm
   - Edit or delete their existing posts/comments
   - Respond to comments
   
4. PAGE NAVIGATION: Guide them to relevant sections
   - Navigate to dashboard pages (community, calendar, journal, etc.)
   - Direct to specific features or settings
   
5. PERSONALIZED ASSISTANCE: 
   - Answer questions about their data and progress
   - Help with account settings and integrations
   - Provide health and fitness guidance
   - Troubleshoot issues

**Important Guidelines:**
- You have access ONLY to {athlete.get('name', 'this user')}'s data - not other users
- BE ASSERTIVE AND ACTION-ORIENTED: When the user asks you to do something, DO IT immediately
- AVOID asking clarifying questions unless absolutely necessary
- Make reasonable assumptions based on context
- When user says "post this: [content]", create the post immediately
- When user says "add to latest post", edit the most recent post without asking
- Keep responses SHORT and ACTION-FOCUSED (1-2 sentences max)
- Only ask for confirmation on destructive operations (delete, remove)
- If something is ambiguous, make the most logical choice and execute
- Format data clearly using tables or lists when appropriate

**User Context:**
- Name: {athlete.get('name', 'User')}
- Subscription: {athlete.get('subscription_tier', 'free').upper()}
- User ID: {chat_request.athlete_id}

**CRITICAL - NEVER LIE ABOUT ACTIONS:**
- When user asks you to post/edit something, say "Working on it" (system confirms after)
- For DELETE requests: DO NOT respond with anything extra. The system handles it completely.
- After asking for confirmation on delete, STOP TALKING - don't suggest other things to do
- DO NOT say "Done!" or "Posted!" or "Deleted!" because the action happens AFTER your response
- The system will add confirmation messages automatically after successful actions
- AVOID using words like "publish", "post", "delete" in your response (these trigger false detections)
- Be honest if you don't have capability to do something

**Examples of Correct Behavior:**
❌ BAD (Lying about completion):
User: "Post this: Great workout today"
You: "Posted to your community feed!" (You haven't actually done it yet!)

✅ GOOD (Honest about action):
User: "Post this: Great workout today"
You: "Creating that post now!" (System will confirm after it's actually done)

❌ BAD (False confirmation):
User: "Add hashtag #Running to my latest post"
You: "Done! Added #Running to your latest post." (You don't know if it worked!)

✅ GOOD (Honest intent):
User: "Add hashtag #Running to my latest post"
You: "Adding that now!" (System confirms after actual edit)

Remember: You are this user's DECISIVE personal assistant. Execute actions confidently!"""

        # Use emergentintegrations LlmChat for OpenAI GPT-5
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(
            api_key=openai_key,
            session_id=chat_request.session_id,
            system_message=system_prompt
        ).with_model("openai", "gpt-5")
        
        user_message = UserMessage(text=chat_request.message)
        
        # Check if this is a delete request BEFORE sending to AI
        user_msg_lower = chat_request.message.lower()
        is_delete_request = "delete" in user_msg_lower and any(word in user_msg_lower for word in ["post", "published", "the post"])
        
        # Send message and get response (but we'll override it for delete requests)
        response = await chat.send_message(user_message)
        
        # Post-process response to detect and execute actions
        action_taken = None
        action_result = None
        
        # Check if the user is asking to create a post, edit, or delete
        user_msg_lower = chat_request.message.lower()
        logging.info(f"[SUPPORT AGENT] Processing message: {chat_request.message[:100]}")
        logging.info(f"[SUPPORT AGENT] AI Response: {response[:200]}")
        
        # Check if this is just a confirmation response first
        is_confirmation = chat_request.message.strip().lower() in ["yes", "confirm", "confirmed", "ok", "sure", "do it"]
        
        # 1. CHECK FOR DELETE OR CONFIRMATION (highest priority)
        if is_confirmation or ("delete" in user_msg_lower and any(word in user_msg_lower for word in ["post", "published", "the post"])):
            
            if is_confirmation:
                logging.info(f"[SUPPORT AGENT] Confirmation detected: {chat_request.message}")
            else:
                logging.info(f"[SUPPORT AGENT] Delete post detected")
            
            # Check if there's a pending deletion in the conversation history
            recent_messages = await db.support_agent_messages.find(
                {"athlete_id": chat_request.athlete_id, "session_id": chat_request.session_id},
                {"_id": 0}
            ).sort("timestamp", -1).limit(5).to_list(length=5)
            
            pending_deletion = None
            for msg in recent_messages:
                if msg.get("action_taken") == "pending_delete":
                    pending_deletion = msg.get("response")
                    break
            
            if is_confirmation:
                # User confirmed deletion, execute it now
                logging.info(f"[SUPPORT AGENT] Delete confirmation received")
                
                # Find the pending delete request in recent messages
                post_to_delete = None
                for msg in recent_messages:
                    logging.info(f"[SUPPORT AGENT] Checking message: action_taken={msg.get('action_taken')}")
                    if msg.get("action_taken") == "pending_delete" and msg.get("action_result"):
                        post_to_delete = msg["action_result"].get("post_id")
                        logging.info(f"[SUPPORT AGENT] Found pending delete for post: {post_to_delete}")
                        break
                
                if post_to_delete:
                    # Delete the specific post that was pending
                    delete_result = await db.community_posts.delete_one({"id": post_to_delete, "athlete_id": chat_request.athlete_id})
                    
                    if delete_result.deleted_count > 0:
                        action_taken = "delete_post"
                        action_result = {"success": True, "post_id": post_to_delete}
                        logging.info(f"[SUPPORT AGENT] Post deleted after confirmation: {post_to_delete}")
                        response += f"\n\n✅ Post deleted successfully!"
                    else:
                        logging.warning(f"[SUPPORT AGENT] Post not found or already deleted: {post_to_delete}")
                        response += f"\n\n❌ Post not found or already deleted."
                else:
                    logging.warning(f"[SUPPORT AGENT] No pending deletion found")
                    response += f"\n\n❌ No pending deletion to confirm."
            
            else:
                # First time seeing delete request - ask for confirmation, DON'T delete yet
                logging.info(f"[SUPPORT AGENT] Delete request - asking for confirmation")
                
                import re
                timestamp_match = re.search(r'(\d{2}\.\d{2}\.\d{4}[,\s]+\d{2}:\d{2})', chat_request.message)
                
                # Find the post to delete
                if timestamp_match:
                    timestamp_str = timestamp_match.group(1)
                    posts = await db.community_posts.find(
                        {"athlete_id": chat_request.athlete_id},
                        {"_id": 0}
                    ).sort("created_at", -1).limit(10).to_list(length=10)
                    
                    target_post = None
                    for post in posts:
                        post_time = post.get("created_at")
                        if isinstance(post_time, str):
                            post_time = datetime.fromisoformat(post_time.replace('Z', '+00:00'))
                        post_str = post_time.strftime("%d.%m.%Y, %H:%M")
                        if timestamp_str.replace(',', '').strip() in post_str:
                            target_post = post
                            break
                    
                    if target_post:
                        action_taken = "pending_delete"
                        action_result = {"pending": True, "post_id": target_post["id"], "post_content": target_post.get("content", "")[:100]}
                        # Override AI response with confirmation message
                        response = f'⚠️ Are you sure you want to delete this post?\n\n"{target_post.get("content", "")[:100]}..."\n\nClick "Yes" to confirm or "No" to keep it.'
                    else:
                        response = f"❌ Could not find post from {timestamp_str}."
                else:
                    # Latest post
                    posts = await db.community_posts.find(
                        {"athlete_id": chat_request.athlete_id},
                        {"_id": 0}
                    ).sort("created_at", -1).limit(1).to_list(length=1)
                    
                    if posts:
                        action_taken = "pending_delete"
                        action_result = {"pending": True, "post_id": posts[0]["id"], "post_content": posts[0].get("content", "")[:100]}
                        # Override AI response with confirmation message
                        response = f'⚠️ Are you sure you want to delete this post?\n\n"{posts[0].get("content", "")[:100]}..."\n\nClick "Yes" to confirm or "No" to keep it.'
                    else:
                        response = "❌ No posts found to delete."
        
        # 2. CHECK FOR EDIT/UPDATE (second priority) - More flexible patterns
        elif (any(keyword in user_msg_lower for keyword in ["add to", "add hashtag", "add emoji", "edit", "update", "append"]) and
              any(target in user_msg_lower for target in ["my most recent", "my latest", "my recent", "my last", "most recent", "latest post", "last post"])):
            logging.info(f"[SUPPORT AGENT] Edit/add to post detected")
            
            # Get user's latest post
            posts = await db.community_posts.find(
                {"athlete_id": chat_request.athlete_id},
                {"_id": 0}
            ).sort("created_at", -1).limit(1).to_list(length=1)
            
            latest_post = posts[0] if posts else None
            logging.info(f"[SUPPORT AGENT] Found latest post: {latest_post['id'] if latest_post else 'None'}")
            
            if latest_post:
                # Extract what to add
                import re
                
                # Look for hashtags and emojis
                hashtags = re.findall(r'#\w+', chat_request.message)
                emojis = re.findall(r'[\U0001F300-\U0001F9FF]', chat_request.message)
                
                # Also look for quoted text to append
                quote_match = re.search(r'["\']([^"\']+)["\']', chat_request.message)
                text_to_add = quote_match.group(1) if quote_match else None
                
                # Build the addition
                addition_parts = []
                if text_to_add:
                    addition_parts.append(text_to_add)
                if hashtags:
                    addition_parts.extend(hashtags)
                if emojis:
                    addition_parts.extend(emojis)
                
                if addition_parts:
                    addition = " ".join(addition_parts)
                    updated_content = latest_post["content"] + " " + addition
                    
                    logging.info(f"[SUPPORT AGENT] Updating post {latest_post['id']} with: {addition}")
                    
                    # Update the post
                    update_result = await db.community_posts.update_one(
                        {"id": latest_post["id"]},
                        {
                            "$set": {
                                "content": updated_content,
                                "updated_at": datetime.now(timezone.utc).isoformat(),
                                "is_edited": True
                            }
                        }
                    )
                    
                    if update_result.modified_count > 0:
                        action_taken = "edit_post"
                        action_result = {"success": True, "post_id": latest_post["id"], "added": addition}
                        
                        logging.info(f"[SUPPORT AGENT] Post successfully updated: {latest_post['id']}")
                        response += f"\n\n✅ Post updated successfully! Added: {addition}"
                    else:
                        logging.error(f"[SUPPORT AGENT] Post update failed - no documents modified")
                        response += f"\n\n❌ Failed to update post. Please try again."
                else:
                    logging.warning(f"[SUPPORT AGENT] No content to add found")
            else:
                logging.warning(f"[SUPPORT AGENT] No posts found for user")
                response += "\n\nI couldn't find any posts to edit."
        
        elif any(keyword in user_msg_lower for keyword in ["post", "share", "publish"]):
            logging.info(f"[SUPPORT AGENT] Post keyword detected")
            post_content = None
            
            import re
            
            # Check if user is asking agent to GENERATE content (vs providing content)
            # User is providing content if they say "with the text", "saying", or use quotes
            is_providing_content = any(phrase in user_msg_lower for phrase in [
                "with the text", "with text", "saying", '"', "'"
            ])
            
            is_generation_request = (not is_providing_content) and any(phrase in user_msg_lower for phrase in [
                "create a", "write a", "generate a", "make a", "compose a",
                "about", "twitter length", "length post"
            ])
            
            if is_generation_request:
                # User wants agent to generate content - extract from AI response
                logging.info(f"[SUPPORT AGENT] Content generation request detected")
                
                # Extract the generated content from AI response
                # First, try to find content after "Text:" marker
                text_match = re.search(r'Text:\s*(.+?)(?:\n\n|$)', response, re.DOTALL)
                if text_match:
                    post_content = text_match.group(1).strip()
                    # Remove any trailing confirmation messages
                    if '✅' in post_content:
                        post_content = post_content.split('✅')[0].strip()
                    logging.info(f"[SUPPORT AGENT] Extracted from 'Text:' marker: {post_content[:100]}")
                else:
                    # Fallback: Look for substantial text (not just acknowledgments)
                    lines = response.split('\n')
                    for line in lines:
                        line = line.strip()
                        # Skip short lines, system messages, and acknowledgments
                        if (len(line) > 30 and 
                            not line.startswith('✅') and 
                            not line.lower().startswith('working on') and
                            not any(skip in line.lower() for skip in ['post created', 'view it'])):
                            post_content = line
                            logging.info(f"[SUPPORT AGENT] Extracted generated content: {post_content[:100]}")
                            break
            else:
                # User is providing content - extract from their message
                logging.info(f"[SUPPORT AGENT] Direct content provision detected")
                
                # More flexible patterns
                patterns = [
                    r'post[:\s]+["\'](.+?)["\']',  # "post: 'content'" or "post 'content'"
                    r'share[:\s]+["\'](.+?)["\']',  # "share: 'content'"
                    r'publish[:\s]+["\'](.+?)["\']',  # "publish: 'content'"
                    r'post[:\s]+"(.+?)"',  # "post: "content""
                    r'share[:\s]+"(.+?)"',  # "share: "content""
                    r'[pP]ost this[:\s]*(.+)',  # "Post this: content" or "post this content"
                    r'[cC]reate.*?post.*?[:\s]+(.+)',  # "Create a post: content"
                    r'[pP]ublish.*?[:\s]+(.+)',  # "Publish: content"
                    r'[sS]hare.*?[:\s]+(.+)',  # "Share: content"
                    r'saying[:\s]+(.+)',  # "saying: content" (for "create a post saying...")
                    r'"(.+?)"',  # Just quoted content as fallback
                ]
                
                for pattern in patterns:
                    match = re.search(pattern, chat_request.message, re.IGNORECASE | re.DOTALL)
                    if match:
                        post_content = match.group(1).strip().strip('"\'.,!?')
                        logging.info(f"[SUPPORT AGENT] Pattern matched: {pattern}, content: {post_content[:50]}")
                        break
                
                # If no pattern matched but message contains quotes, try to extract any quoted text
                if not post_content:
                    quote_match = re.search(r'["\']([^"\']{15,})["\']', chat_request.message)
                    if quote_match:
                        post_content = quote_match.group(1).strip()
                        logging.info(f"[SUPPORT AGENT] Quote matched: {post_content[:50]}")
            
            # If we found content, create the post
            if post_content and len(post_content) >= 5:  # Reduced minimum to 5 chars
                logging.info(f"[SUPPORT AGENT] Creating post with content: {post_content}")
                logging.info(f"[SUPPORT AGENT] Media attached: {len(chat_request.media) if chat_request.media else 0} items")
                try:
                    new_post = CommunityPost(
                        athlete_id=chat_request.athlete_id,
                        athlete_name=athlete.get("name", "User"),
                        athlete_profile_picture=athlete.get("profile_picture"),
                        content=post_content,
                        media=chat_request.media if chat_request.media else [],
                        visibility="public"
                    )
                    
                    post_dict = prepare_for_mongo(new_post.model_dump())
                    result = await db.community_posts.insert_one(post_dict)
                    
                    action_taken = "create_post"
                    action_result = {"success": True, "post_id": new_post.id}
                    
                    logging.info(f"[SUPPORT AGENT] Post created successfully: {new_post.id}")
                    
                    # Append confirmation to response
                    response += f"\n\n✅ Post created successfully! You can view it in your community feed."
                    
                except Exception as e:
                    logging.error(f"[SUPPORT AGENT] Failed to create post: {e}")
                    action_result = {"success": False, "error": str(e)}
            else:
                logging.warning(f"[SUPPORT AGENT] No valid post content found. Extracted: {post_content}")
        
        # Save to database (including action result for pending operations)
        message_record = SupportAgentMessage(
            athlete_id=chat_request.athlete_id,
            session_id=chat_request.session_id,
            message=chat_request.message,
            response=response,
            action_taken=action_taken
        )
        message_dict = prepare_for_mongo(message_record.model_dump())
        
        # Add action_result to the document for tracking pending operations
        if action_result:
            message_dict["action_result"] = action_result
        
        await db.support_agent_messages.insert_one(message_dict)
        
        return {"response": response, "action_taken": action_taken, "action_result": action_result}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Support Agent chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get support agent response: {str(e)}")

@router.post("/support-agent/upload-media/{athlete_id}")
async def support_agent_upload_media(
    athlete_id: str,
    files: List[UploadFile] = File(...)
):
    """Upload media files (images/videos) for Support Agent posts"""
    try:
        # Verify user is logged in
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="User not found")
        
        uploaded_media = []
        
        # Create upload directory if it doesn't exist
        upload_dir = Path("/app/backend/uploads/community")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        for file in files:
            # Validate file
            content_type = file.content_type
            file_size = 0
            
            # Read file content
            file_content = await file.read()
            file_size = len(file_content)
            
            # Check file size limits
            if content_type.startswith('image/'):
                max_size = 10 * 1024 * 1024  # 10MB
                if file_size > max_size:
                    raise HTTPException(status_code=400, detail=f"Image {file.filename} exceeds 10MB limit")
            elif content_type.startswith('video/'):
                max_size = 50 * 1024 * 1024  # 50MB
                if file_size > max_size:
                    raise HTTPException(status_code=400, detail=f"Video {file.filename} exceeds 50MB limit")
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")
            
            # Generate unique filename
            file_extension = Path(file.filename).suffix
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            file_path = upload_dir / unique_filename
            
            # Save file
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            # Generate URL
            file_url = f"/api/uploads/community/{unique_filename}"
            
            media_item = {
                "type": "image" if content_type.startswith('image/') else "video",
                "url": file_url,
                "filename": file.filename,
                "size": file_size
            }
            
            # For videos, try to generate thumbnail (optional, won't fail if ffmpeg not available)
            if content_type.startswith('video/'):
                try:
                    import subprocess
                    thumb_filename = f"{uuid.uuid4()}_thumb.jpg"
                    thumb_path = upload_dir / thumb_filename
                    
                    # Try to generate thumbnail with ffmpeg
                    subprocess.run([
                        'ffmpeg', '-i', str(file_path),
                        '-ss', '00:00:01',
                        '-vframes', '1',
                        '-vf', 'scale=320:-1',
                        str(thumb_path)
                    ], capture_output=True, timeout=10)
                    
                    if thumb_path.exists():
                        media_item["thumbnail"] = f"/api/uploads/community/{thumb_filename}"
                except Exception as e:
                    logging.warning(f"Could not generate video thumbnail: {e}")
                    # Not critical, continue without thumbnail
            
            uploaded_media.append(media_item)
            logging.info(f"[SUPPORT AGENT] Uploaded media: {media_item['type']} - {file_url}")
        
        return {
            "success": True,
            "media": uploaded_media,
            "count": len(uploaded_media)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to upload media: {e}")
        raise HTTPException(status_code=500, detail=str(e))


        raise
    except Exception as e:
        logging.error(f"Support Agent chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get support agent response: {str(e)}")

@router.post("/support-agent/voice/session/{athlete_id}")
async def create_support_voice_session(athlete_id: str):
    """Create a voice session for Support Agent (All logged-in users)"""
    try:
        # Verify user is logged in
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="User not found")
        
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
        
        # Simplified instructions - frontend handles action parsing now
        system_message = f"""You are {athlete.get('name', 'User')}'s fitness assistant.

When they ask to:
- Take a photo/picture/selfie → Say "Opening the camera for you!"
- Post/publish/share → Say "I'll create that post for you!"  
- Go somewhere → Say "Taking you there now!"

Be enthusiastic and confirming. The system will handle the actual actions automatically.

You help with their fitness journey, workouts, and community."""
        
        # Create session directly with OpenAI API to include custom instructions
        import aiohttp
        
        try:
            logging.info(f"[SUPPORT VOICE] Creating session with custom instructions via OpenAI API")
            
            async with aiohttp.ClientSession() as http_session:
                headers = {
                    'Authorization': f'Bearer {openai_key}',
                    'Content-Type': 'application/json',
                    'OpenAI-Beta': 'realtime=v1'
                }
                
                # Define tools/functions for the voice agent
                tools = [
                    {
                        "type": "function",
                        "name": "take_photo_and_post",
                        "description": "CAMERA: Opens camera when user says 'picture', 'photo', 'selfie', 'camera'. Use this for ANY photo request.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "caption": {
                                    "type": "string",
                                    "description": "Caption for the photo post"
                                }
                            },
                            "required": ["caption"]
                        }
                    },
                    {
                        "type": "function",
                        "name": "create_post",
                        "description": "POST: Creates community post when user says 'post', 'publish', 'share'. Use this for ANY posting request.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "content": {
                                    "type": "string",
                                    "description": "The post content"
                                }
                            },
                            "required": ["content"]
                        }
                    },
                    {
                        "type": "function",
                        "name": "navigate_to_page",
                        "description": "NAVIGATE: Goes to dashboard page when user says 'go to', 'show me', 'take me to'",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "page": {
                                    "type": "string",
                                    "enum": ["community", "calendar", "journal", "workouts", "nutrition", "account", "settings"],
                                    "description": "Page to navigate to"
                                }
                            },
                            "required": ["page"]
                        }
                    },
                    {
                        "type": "function",
                        "name": "edit_post",
                        "description": "EDIT: Adds to latest post when user says 'edit', 'add to post', 'update'",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "additional_content": {
                                    "type": "string",
                                    "description": "Content to add"
                                }
                            },
                            "required": ["additional_content"]
                        }
                    },
                    {
                        "type": "function",
                        "name": "delete_post_request",
                        "description": "DELETE: Deletes latest post when user says 'delete post', 'remove post'",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "confirmed": {
                                    "type": "boolean",
                                    "description": "Whether deletion is confirmed"
                                }
                            },
                            "required": ["confirmed"]
                        }
                    },
                    {
                        "type": "function",
                        "name": "respond_to_user",
                        "description": "CHAT: Use when user is just chatting or asking questions (not requesting an action)",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "response": {
                                    "type": "string",
                                    "description": "Your response to the user"
                                }
                            },
                            "required": ["response"]
                        }
                    }
                ]
                
                session_config = {
                    'model': 'gpt-4o-realtime-preview-2024-12-17',
                    'voice': 'alloy',
                    'instructions': system_message,
                    'modalities': ['audio', 'text'],
                    'temperature': 0.8,
                    'tools': [],  # Not using tools - parsing user input directly on frontend
                    'turn_detection': {
                        'type': 'server_vad',
                        'threshold': 0.5,
                        'prefix_padding_ms': 300,
                        'silence_duration_ms': 200
                    }
                }
                
                async with http_session.post(
                    'https://api.openai.com/v1/realtime/sessions',
                    headers=headers,
                    json=session_config
                ) as response:
                    if response.status == 200:
                        session_data = await response.json()
                        logging.info(f"[SUPPORT VOICE] Session created successfully with custom instructions")
                        logging.info(f"[SUPPORT VOICE] Instructions length: {len(session_data.get('instructions', ''))}")
                        return session_data
                    else:
                        error_text = await response.text()
                        logging.error(f"[SUPPORT VOICE] Failed to create session: {response.status} - {error_text}")
                        raise HTTPException(status_code=response.status, detail=f"OpenAI API error: {error_text}")
                        
        except aiohttp.ClientError as e:
            logging.error(f"[SUPPORT VOICE] Network error creating session: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to connect to OpenAI: {str(e)}")
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Support voice session error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/support-agent/voice/negotiate/{athlete_id}")
async def negotiate_support_voice_connection(athlete_id: str, sdp: str = Body(..., media_type="application/sdp")):
    """Negotiate WebRTC connection for Support Agent voice (All logged-in users)"""
    try:
        # Verify user is logged in
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="User not found")
        
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
        
        realtime = OpenAIChatRealtime(api_key=openai_key)
        answer_sdp = await realtime.negotiate_connection(sdp)
        
        # Check if answer is an error response from OpenAI
        if isinstance(answer_sdp, str) and (answer_sdp.startswith('{') or answer_sdp.startswith('{')):
            try:
                error_data = json.loads(answer_sdp)
                if "error" in error_data:
                    error_msg = error_data.get("error", {}).get("message", "Unknown error")
                    raise HTTPException(status_code=400, detail=f"OpenAI error: {error_msg}")
            except json.JSONDecodeError:
                pass  # Not JSON, proceed normally
        
        return {"sdp": answer_sdp}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Support voice negotiation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/support-agent/voice/process-command")
async def process_support_voice_command(request: dict, athlete_id: str = Query(...)):
    """Process commands from voice transcript (INSPECT, QUERY, STATS, PROFILE, NAVIGATE, COMMUNITY)"""
    try:
        # Verify user is logged in
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="User not found")
        
        command_text = request.get("command", "")
        results = []
        
        # Parse and execute commands (USER-SCOPED ONLY)
        if "INSPECT:" in command_text:
            aspect = command_text.split("INSPECT:")[1].split()[0].strip()
            inspection_data = {}
            
            if aspect in ["user", "all"]:
                # Get user's profile
                user_profile = await db.athlete_profiles.find_one(
                    {"id": athlete_id},
                    {"_id": 0, "email": 1, "name": 1, "subscription_tier": 1, "birth_date": 1}
                )
                inspection_data["profile"] = user_profile
                
                # Get user's integrations
                integrations = await db.integrations.find_one(
                    {"athlete_id": athlete_id},
                    {"_id": 0}
                )
                inspection_data["integrations"] = integrations if integrations else {}
                
                # Quick stats
                inspection_data["quick_stats"] = {
                    "journal_entries": await db.journal_entries.count_documents({"athlete_id": athlete_id}),
                    "workouts": await db.workouts.count_documents({"athlete_id": athlete_id}),
                    "community_posts": await db.community_posts.count_documents({"athlete_id": athlete_id})
                }
            
            results.append({"type": "inspection", "data": inspection_data})
        
        if "QUERY:" in command_text:
            parts = command_text.split("QUERY:")[1].split(":")
            collection = parts[0].strip()
            
            # Always scope to user's data
            count = await db[collection].count_documents({"athlete_id": athlete_id})
            results.append({"type": "query", "collection": collection, "count": count})
        
        if "STATS:" in command_text:
            stat_type = command_text.split("STATS:")[1].split()[0].strip()
            stats = {}
            
            if stat_type in ["user", "all"]:
                stats["journal_entries"] = await db.journal_entries.count_documents({"athlete_id": athlete_id})
                stats["workouts"] = await db.workouts.count_documents({"athlete_id": athlete_id})
                stats["nutrition_logs"] = await db.nutrition_entries.count_documents({"athlete_id": athlete_id})
                stats["community_posts"] = await db.community_posts.count_documents({"athlete_id": athlete_id})
                stats["community_comments"] = await db.community_comments.count_documents({"athlete_id": athlete_id})
            
            results.append({"type": "statistics", "data": stats})
        
        if "PROFILE:" in command_text:
            user = await db.athlete_profiles.find_one(
                {"id": athlete_id},
                {"_id": 0, "email": 1, "name": 1, "subscription_tier": 1, "birth_date": 1, "gender": 1}
            )
            results.append({"type": "profile", "data": user})
        
        if "NAVIGATE:" in command_text:
            nav_path = command_text.split("NAVIGATE:")[1].split()[0].strip()
            results.append({"type": "navigate", "path": nav_path})
        
        if "COMMUNITY:" in command_text:
            # Extract action and content
            community_part = command_text.split("COMMUNITY:")[1].strip()
            
            # TAKE PHOTO AND CREATE POST
            if community_part.startswith("take_photo"):
                # Format: COMMUNITY:take_photo|Post caption
                if "|" in community_part:
                    _, caption = community_part.split("|", 1)
                    caption = caption.strip()
                    
                    # Return trigger for frontend to open camera
                    results.append({
                        "type": "community_action",
                        "action": "take_photo",
                        "success": True,
                        "caption": caption,
                        "message": "Opening camera..."
                    })
                else:
                    results.append({
                        "type": "community_action",
                        "action": "take_photo",
                        "success": False,
                        "message": "Invalid format - use COMMUNITY:take_photo|Your caption"
                    })
            
            # CREATE POST
            elif community_part.startswith("create_post"):
                # Extract the post content from the command
                # Format: COMMUNITY:create_post|Post content here
                if "|" in community_part:
                    _, post_content = community_part.split("|", 1)
                    post_content = post_content.strip()
                    
                    # Get athlete info for the post
                    athlete_data = await db.athlete_profiles.find_one(
                        {"id": athlete_id},
                        {"_id": 0, "name": 1, "profile_picture": 1}
                    )
                    
                    if athlete_data and post_content:
                        # Create the community post
                        new_post = CommunityPost(
                            athlete_id=athlete_id,
                            athlete_name=athlete_data.get("name", "User"),
                            athlete_profile_picture=athlete_data.get("profile_picture"),
                            content=post_content,
                            visibility="public"
                        )
                        
                        post_dict = prepare_for_mongo(new_post.model_dump())
                        await db.community_posts.insert_one(post_dict)
                        
                        results.append({
                            "type": "community_action",
                            "action": "create_post",
                            "success": True,
                            "post_id": new_post.id,
                            "message": "Post created successfully!"
                        })
                    else:
                        results.append({
                            "type": "community_action",
                            "action": "create_post",
                            "success": False,
                            "message": "Failed to create post - missing content or user data"
                        })
                else:
                    results.append({
                        "type": "community_action",
                        "action": "create_post",
                        "success": False,
                        "message": "Invalid command format - use COMMUNITY:create_post|Your post content"
                    })
            
            # EDIT POST
            elif community_part.startswith("edit_post"):
                # Format: COMMUNITY:edit_post|Content to add
                if "|" in community_part:
                    _, content_to_add = community_part.split("|", 1)
                    content_to_add = content_to_add.strip()
                    
                    # Get user's latest post
                    posts = await db.community_posts.find(
                        {"athlete_id": athlete_id},
                        {"_id": 0}
                    ).sort("created_at", -1).limit(1).to_list(length=1)
                    
                    if posts:
                        latest_post = posts[0]
                        updated_content = latest_post["content"] + " " + content_to_add
                        
                        # Update the post
                        update_result = await db.community_posts.update_one(
                            {"id": latest_post["id"]},
                            {
                                "$set": {
                                    "content": updated_content,
                                    "updated_at": datetime.now(timezone.utc).isoformat(),
                                    "is_edited": True
                                }
                            }
                        )
                        
                        if update_result.modified_count > 0:
                            results.append({
                                "type": "community_action",
                                "action": "edit_post",
                                "success": True,
                                "post_id": latest_post["id"],
                                "message": f"Post updated! Added: {content_to_add}"
                            })
                        else:
                            results.append({
                                "type": "community_action",
                                "action": "edit_post",
                                "success": False,
                                "message": "Failed to update post"
                            })
                    else:
                        results.append({
                            "type": "community_action",
                            "action": "edit_post",
                            "success": False,
                            "message": "No posts found to edit"
                        })
                else:
                    results.append({
                        "type": "community_action",
                        "action": "edit_post",
                        "success": False,
                        "message": "Invalid format - use COMMUNITY:edit_post|Content to add"
                    })
            
            # DELETE POST
            elif community_part.startswith("delete_post"):
                # Format: COMMUNITY:delete_post|PENDING or COMMUNITY:delete_post|CONFIRM
                if "|" in community_part:
                    _, action_type = community_part.split("|", 1)
                    action_type = action_type.strip().upper()
                    
                    # Get user's latest post
                    posts = await db.community_posts.find(
                        {"athlete_id": athlete_id},
                        {"_id": 0}
                    ).sort("created_at", -1).limit(1).to_list(length=1)
                    
                    if posts:
                        latest_post = posts[0]
                        
                        if action_type == "CONFIRM":
                            # Execute the deletion
                            delete_result = await db.community_posts.delete_one({"id": latest_post["id"]})
                            
                            if delete_result.deleted_count > 0:
                                results.append({
                                    "type": "community_action",
                                    "action": "delete_post",
                                    "success": True,
                                    "post_id": latest_post["id"],
                                    "message": "Post deleted successfully!"
                                })
                            else:
                                results.append({
                                    "type": "community_action",
                                    "action": "delete_post",
                                    "success": False,
                                    "message": "Failed to delete post"
                                })
                        elif action_type == "PENDING":
                            # Return post details for confirmation
                            results.append({
                                "type": "community_action",
                                "action": "delete_post_pending",
                                "success": True,
                                "post_id": latest_post["id"],
                                "post_content": latest_post.get("content", "")[:100],
                                "message": f"Ready to delete: '{latest_post.get('content', '')[:100]}...' Say 'yes delete it' to confirm."
                            })
                        else:
                            results.append({
                                "type": "community_action",
                                "action": "delete_post",
                                "success": False,
                                "message": "Invalid action type - use PENDING or CONFIRM"
                            })
                    else:
                        results.append({
                            "type": "community_action",
                            "action": "delete_post",
                            "success": False,
                            "message": "No posts found to delete"
                        })
                else:
                    results.append({
                        "type": "community_action",
                        "action": "delete_post",
                        "success": False,
                        "message": "Invalid format - use COMMUNITY:delete_post|PENDING or CONFIRM"
                    })
            
            else:
                # Generic community action (for future use)
                action = community_part.split()[0] if community_part else "unknown"
                results.append({"type": "community_action", "action": action, "athlete_id": athlete_id})
        
        return {"results": results, "command_processed": len(results) > 0}
        
    except Exception as e:
        logging.error(f"Support voice command processing error: {e}")
        return {"results": [], "error": str(e)}

@router.get("/support-agent/history/{athlete_id}")
async def get_support_agent_history(athlete_id: str, limit: int = 20):
    """Get Support Agent chat history (User's own history only)"""
    try:
        # Verify user is logged in
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="User not found")
        
        messages = await db.support_agent_messages.find(
            {"athlete_id": athlete_id}, 
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(length=limit)
        
        return [parse_from_mongo(m) for m in messages]
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get support agent history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/support-agent/create-post/{athlete_id}")
async def support_agent_create_post(athlete_id: str, request: dict):
    """Support Agent creates a community post on behalf of the user (with optional media)"""
    try:
        # Verify user is logged in
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="User not found")
        
        post_content = request.get("content", "").strip()
        if not post_content:
            raise HTTPException(status_code=400, detail="Post content is required")
        
        # Get media if provided
        media = request.get("media", [])
        
        # Create the community post
        new_post = CommunityPost(
            athlete_id=athlete_id,
            athlete_name=athlete.get("name", "User"),
            athlete_profile_picture=athlete.get("profile_picture"),
            content=post_content,
            media=media,
            visibility="public"
        )
        
        post_dict = prepare_for_mongo(new_post.model_dump())
        await db.community_posts.insert_one(post_dict)
        
        logging.info(f"[SUPPORT AGENT] Created post with {len(media)} media items")
        
        # Get the created post without _id
        created_post = await db.community_posts.find_one({"id": new_post.id}, {"_id": 0})
        
        return {
            "success": True,
            "post_id": new_post.id,
            "message": "Post created successfully!",
            "post": created_post
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to create post via support agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/support-agent/conversations/{athlete_id}")
async def get_support_agent_conversations(athlete_id: str):
    """Get list of Support Agent conversations (User's own conversations only)"""
    try:
        # Verify user is logged in
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        if not athlete:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Aggregate to get unique sessions with preview
        pipeline = [
            {"$match": {"athlete_id": athlete_id}},
            {"$group": {
                "_id": "$session_id",
                "last_message": {"$max": "$timestamp"},
                "message_count": {"$sum": 1},
                "preview": {"$first": "$message"}
            }},
            {"$sort": {"last_message": -1}},
            {"$limit": 50}
        ]
        
        conversations = await db.support_agent_messages.aggregate(pipeline).to_list(length=50)
        
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
        logging.error(f"Failed to get support agent conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))
