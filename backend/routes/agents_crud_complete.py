"""
Agents CRUD Routes - Complete
Handles all agent management operations:
- CRUD operations for agents (create, read, update, delete)
- Agent image and knowledge base uploads
- Agent chat functionality with OpenAI integration
- Public agent listing for frontend
"""

from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import logging
import os
import json
import aiofiles

# Import image processor
import sys
sys.path.append('/app/backend')
from image_processor import process_and_save_image

# Initialize router
router = APIRouter(prefix="/api", tags=["agents"])

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
class Agent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    profile_image_url: Optional[str] = None
    custom_instructions: str
    voice: str = 'alloy'
    personality: Optional[str] = None
    accessibility: str = 'frontend'  # frontend, logged_in, admin
    is_active: bool = True
    knowledge_base: List[Dict[str, str]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AgentCreateRequest(BaseModel):
    name: str
    custom_instructions: str
    voice: str = 'alloy'
    personality: Optional[str] = None
    accessibility: str = 'frontend'
    is_active: bool = True

class AgentUpdateRequest(BaseModel):
    name: Optional[str] = None
    custom_instructions: Optional[str] = None
    voice: Optional[str] = None
    personality: Optional[str] = None
    accessibility: Optional[str] = None
    is_active: Optional[bool] = None
    profile_image_url: Optional[str] = None

class AgentChatRequest(BaseModel):
    agent_id: str
    message: str
    session_id: Optional[str] = None
    athlete_id: Optional[str] = None

# ========================================
# AGENTS CRUD ENDPOINTS
# ========================================

@router.get("/agents")
async def get_agents(athlete_id: str = Query(...)):
    """Get all agents. Super admin gets all, guests get only frontend agents"""
    try:
        # Check if super admin
        is_super_admin = False
        try:
            await verify_super_admin(athlete_id)
            is_super_admin = True
        except Exception:
            pass
        
        # Super admin gets all agents, others get only public frontend agents
        if is_super_admin:
            agents = await db.agents.find({}, {"_id": 0}).to_list(length=100)
        else:
            agents = await db.agents.find(
                {"accessibility": "frontend", "is_active": True},
                {"_id": 0}
            ).to_list(length=100)
        
        return [parse_from_mongo(agent) for agent in agents]
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get agents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/agents/{agent_id}")
async def get_agent(agent_id: str, athlete_id: str = Query(...)):
    """Get single agent (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        return parse_from_mongo(agent)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/agents")
async def create_agent(agent_request: AgentCreateRequest, athlete_id: str = Query(...)):
    """Create a new agent (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        agent = Agent(
            name=agent_request.name,
            custom_instructions=agent_request.custom_instructions,
            voice=agent_request.voice,
            personality=agent_request.personality,
            accessibility=agent_request.accessibility,
            is_active=agent_request.is_active
        )
        
        agent_dict = prepare_for_mongo(agent.model_dump())
        await db.agents.insert_one(agent_dict)
        
        return {"message": "Agent created successfully", "agent_id": agent.id}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to create agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/agents/{agent_id}")
async def update_agent(agent_id: str, agent_update: AgentUpdateRequest, athlete_id: str = Query(...)):
    """Update an agent (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        # Check if agent exists
        agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Build update dict
        update_data = {}
        if agent_update.name is not None:
            update_data["name"] = agent_update.name
        if agent_update.custom_instructions is not None:
            update_data["custom_instructions"] = agent_update.custom_instructions
        if agent_update.voice is not None:
            update_data["voice"] = agent_update.voice
        if agent_update.personality is not None:
            update_data["personality"] = agent_update.personality
        if agent_update.accessibility is not None:
            update_data["accessibility"] = agent_update.accessibility
        if agent_update.is_active is not None:
            update_data["is_active"] = agent_update.is_active
        if agent_update.profile_image_url is not None:
            update_data["profile_image_url"] = agent_update.profile_image_url
        
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.agents.update_one(
            {"id": agent_id},
            {"$set": update_data}
        )
        
        return {"message": "Agent updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to update agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str, athlete_id: str = Query(...)):
    """Delete an agent (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        result = await db.agents.delete_one({"id": agent_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        return {"message": "Agent deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to delete agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/agents/{agent_id}/upload-image")
async def upload_agent_image(agent_id: str, file: UploadFile = File(...), athlete_id: str = Query(...)):
    """Upload profile image for an agent (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        # Check if agent exists
        agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Process and save image
        image_url = await process_and_save_image(file, f"agent_{agent_id}")
        
        # Update agent with image URL
        await db.agents.update_one(
            {"id": agent_id},
            {"$set": {"profile_image_url": image_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"message": "Image uploaded successfully", "image_url": image_url}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to upload agent image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/agents/{agent_id}/upload-knowledge")
async def upload_agent_knowledge(
    agent_id: str,
    file: UploadFile = File(...),
    athlete_id: str = Query(...)
):
    """Upload knowledge base file for an agent (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        # Check if agent exists
        agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Save knowledge file
        knowledge_dir = f"/app/backend/knowledge_base/{agent_id}"
        os.makedirs(knowledge_dir, exist_ok=True)
        
        file_path = f"{knowledge_dir}/{file.filename}"
        
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Read file content
        file_content = content.decode('utf-8')
        
        # Update agent's knowledge base
        knowledge_entry = {
            "filename": file.filename,
            "content": file_content[:10000],  # Limit to 10k chars
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.agents.update_one(
            {"id": agent_id},
            {
                "$push": {"knowledge_base": knowledge_entry},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        
        return {"message": "Knowledge file uploaded successfully", "filename": file.filename}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to upload knowledge file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/agents/{agent_id}/knowledge/{filename}")
async def delete_agent_knowledge(
    agent_id: str,
    filename: str,
    athlete_id: str = Query(...)
):
    """Delete knowledge base file from an agent (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        # Check if agent exists
        agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Remove from knowledge base array
        await db.agents.update_one(
            {"id": agent_id},
            {
                "$pull": {"knowledge_base": {"filename": filename}},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        
        # Delete physical file if exists
        file_path = f"/app/backend/knowledge_base/{agent_id}/{filename}"
        if os.path.exists(file_path):
            os.remove(file_path)
        
        return {"message": "Knowledge file deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to delete knowledge file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/agents/by-accessibility/{accessibility_level}")
async def get_agents_by_accessibility(accessibility_level: str):
    """Get agents by accessibility level (public endpoint)"""
    try:
        agents = await db.agents.find(
            {"accessibility": accessibility_level, "is_active": True},
            {"_id": 0}
        ).to_list(length=100)
        
        return [parse_from_mongo(agent) for agent in agents]
        
    except Exception as e:
        logging.error(f"Failed to get agents by accessibility: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/agents/seed-management-agent")
async def seed_management_agent(athlete_id: str = Query(...)):
    """Seed the Management Agent if it doesn't exist (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        # Check if Management Agent already exists
        existing = await db.agents.find_one({"name": "Management Agent"}, {"_id": 0})
        if existing:
            return {"message": "Management Agent already exists", "agent_id": existing["id"]}
        
        # Create Management Agent
        agent = Agent(
            name="Management Agent",
            custom_instructions="""You are the Management Agent, a powerful AI assistant with full administrative access to this health and fitness application.

**Your Capabilities:**
1. DATABASE QUERIES: Search, filter, and analyze ANY data in the system
2. USER MANAGEMENT: View and analyze user data across all accounts
3. COMMUNITY MANAGEMENT: Manage community content, moderate posts
4. PAGE NAVIGATION: Navigate super admin to any page in the app
5. ANALYTICS: Generate insights and statistics

**Guidelines:**
- For destructive operations, always ask for confirmation
- Format data clearly in tables or lists
- Explain what you're searching for before providing results
- Prioritize data security and privacy
- Use clear, concise language""",
            voice='alloy',
            personality='professional',
            accessibility='admin',
            is_active=True
        )
        
        agent_dict = prepare_for_mongo(agent.model_dump())
        await db.agents.insert_one(agent_dict)
        
        return {"message": "Management Agent created successfully", "agent_id": agent.id}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to seed Management Agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))
@router.post("/agents/chat")
async def chat_with_agent(request: AgentChatRequest):
    """Chat with an agent using OpenAI"""
    try:
        # Get the agent
        agent = await db.agents.find_one({"id": request.agent_id}, {"_id": 0})
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        agent_obj = parse_from_mongo(agent)
        
        # Check accessibility
        if agent_obj.get("accessibility") == "admin":
            # Require super admin for admin agents
            if not request.athlete_id:
                raise HTTPException(status_code=403, detail="Admin agents require authentication")
            await verify_super_admin(request.athlete_id)
        elif agent_obj.get("accessibility") == "logged_in":
            # Require any authenticated user
            if not request.athlete_id:
                raise HTTPException(status_code=403, detail="This agent requires login")
        
        # Get OpenAI key - prioritize user's key from settings
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        if not settings:
            settings = await db.system_settings.find_one({}, {"_id": 0})
        
        openai_key = None
        if settings:
            openai_key = settings.get("advanced", {}).get("openaiApiKey")
            if not openai_key:
                openai_key = settings.get("openaiApiKey")
        
        if not openai_key:
            raise HTTPException(
                status_code=400, 
                detail="OpenAI API key not configured. Please add your key in System Settings → Advanced tab."
            )
        
        # Define tools/functions for admin agents
        tools = None
        if agent_obj.get("accessibility") == "admin":
            tools = [
                {
                    "type": "function",
                    "function": {
                        "name": "navigate_to_page",
                        "description": "Navigate the super admin to a specific page in the dashboard. Use this when the admin asks to go to a page or open a section.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "page": {
                                    "type": "string",
                                    "description": "The page to navigate to",
                                    "enum": ["overview", "today", "calendar", "journal", "nutrition", "recipes", "supplements", "drinks", "workouts", "habits", "schedules", "documents", "tests", "memories", "community", "referrals", "account", "system-settings", "crm", "orders", "subscriptions", "pages", "emails", "support"]
                                }
                            },
                            "required": ["page"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "query_database",
                        "description": "Query the database to get information about users, statistics, or any data. Returns structured data based on the query.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "collection": {
                                    "type": "string",
                                    "description": "Database collection to query",
                                    "enum": ["athlete_profiles", "community_posts", "community_comments", "workouts", "subscriptions", "integrations", "agent_conversations"]
                                },
                                "query_type": {
                                    "type": "string",
                                    "description": "Type of query",
                                    "enum": ["count", "list", "find", "aggregate"]
                                },
                                "filters": {
                                    "type": "object",
                                    "description": "Filter criteria for the query (optional)"
                                },
                                "limit": {
                                    "type": "integer",
                                    "description": "Maximum number of results to return",
                                    "default": 10
                                }
                            },
                            "required": ["collection", "query_type"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "get_user_info",
                        "description": "Get detailed information about a specific user by email or ID",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "identifier": {
                                    "type": "string",
                                    "description": "User email or ID"
                                }
                            },
                            "required": ["identifier"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "get_statistics",
                        "description": "Get overall application statistics (total users, active subscriptions, etc.)",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "stat_type": {
                                    "type": "string",
                                    "description": "Type of statistics to retrieve",
                                    "enum": ["users", "subscriptions", "activity", "community", "all"]
                                }
                            },
                            "required": ["stat_type"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "inspect_application",
                        "description": "Get comprehensive information about the application structure, database schema, available collections, and current state. Use this first to understand what data and capabilities are available.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "aspect": {
                                    "type": "string",
                                    "description": "What aspect to inspect",
                                    "enum": ["database_schema", "collections", "sample_data", "system_info", "all"]
                                }
                            },
                            "required": ["aspect"]
                        }
                    }
                }
            ]
        
        # Use OpenAI client directly for function calling support
        import openai
        openai_client = openai.AsyncOpenAI(api_key=openai_key)
        
        session_id = request.session_id or f"agent_chat_{uuid.uuid4()}"
        
        # Build system prompt with knowledge base
        system_prompt = agent_obj.get("custom_instructions", "")
        
        knowledge_base = agent_obj.get("knowledge_base", [])
        if knowledge_base:
            kb_context = "\n\n## Knowledge Base\n\nYou have access to these reference files:\n\n"
            for kb_file in knowledge_base:
                kb_context += f"### {kb_file['filename']}\n{kb_file['content']}\n\n---\n\n"
            kb_context += "Use this knowledge base to provide accurate, informed responses.\n"
            system_prompt += kb_context
        
        # Load conversation history (last 20 exchanges)
        messages = [{"role": "system", "content": system_prompt}]
        
        if request.session_id:
            history_records = await db.agent_conversations.find(
                {
                    "agent_id": request.agent_id,
                    "session_id": session_id,
                    "athlete_id": request.athlete_id or "guest"
                },
                {"_id": 0}
            ).sort("timestamp", 1).to_list(length=100)
            
            recent_history = history_records[-40:] if len(history_records) > 40 else history_records
            
            for record in recent_history:
                messages.append({"role": "user", "content": record.get("message", "")})
                messages.append({"role": "assistant", "content": record.get("response", "")})
        
        # Add current user message
        messages.append({"role": "user", "content": request.message})
        
        # Call OpenAI with tools
        completion_params = {
            "model": "gpt-4o",
            "messages": messages,
            "temperature": 0.7
        }
        
        if tools:
            completion_params["tools"] = tools
            completion_params["tool_choice"] = "auto"
        
        response = await openai_client.chat.completions.create(**completion_params)
        
        # Handle function calls
        response_message = response.choices[0].message
        tool_calls = response_message.tool_calls
        
        if tool_calls:
            # Execute tool calls
            messages.append(response_message)
            
            for tool_call in tool_calls:
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments)
                
                function_response = ""
                
                if function_name == "navigate_to_page":
                    page = function_args.get("page")
                    function_response = json.dumps({
                        "action": "navigate",
                        "page": page,
                        "url": f"/dashboard/{page}",
                        "message": f"Navigation command issued to: {page}"
                    })
                
                elif function_name == "query_database":
                    collection_name = function_args.get("collection")
                    query_type = function_args.get("query_type")
                    filters = function_args.get("filters", {})
                    limit = function_args.get("limit", 10)
                    
                    collection = db[collection_name]
                    
                    if query_type == "count":
                        count = await collection.count_documents(filters)
                        function_response = json.dumps({"count": count})
                    elif query_type == "list":
                        results = await collection.find(filters, {"_id": 0}).limit(limit).to_list(length=limit)
                        function_response = json.dumps({"results": results}, default=str)
                    elif query_type == "find":
                        results = await collection.find(filters, {"_id": 0}).limit(limit).to_list(length=limit)
                        function_response = json.dumps({"results": results}, default=str)
                
                elif function_name == "get_user_info":
                    identifier = function_args.get("identifier")
                    user = await db.athlete_profiles.find_one(
                        {"$or": [{"email": identifier}, {"id": identifier}]},
                        {"_id": 0}
                    )
                    function_response = json.dumps({"user": user}, default=str) if user else json.dumps({"error": "User not found"})
                
                elif function_name == "get_statistics":
                    stat_type = function_args.get("stat_type")
                    stats = {}
                    
                    if stat_type in ["users", "all"]:
                        stats["total_users"] = await db.athlete_profiles.count_documents({})
                    if stat_type in ["subscriptions", "all"]:
                        stats["total_subscriptions"] = await db.subscriptions.count_documents({})
                        stats["active_subscriptions"] = await db.subscriptions.count_documents({"status": "active"})
                    if stat_type in ["community", "all"]:
                        stats["total_posts"] = await db.community_posts.count_documents({})
                        stats["total_comments"] = await db.community_comments.count_documents({})
                    
                    function_response = json.dumps(stats)
                
                elif function_name == "inspect_application":
                    aspect = function_args.get("aspect")
                    inspection_data = {}
                    
                    if aspect in ["collections", "all"]:
                        # Get all collections with counts
                        collections = await db.list_collection_names()
                        collection_info = {}
                        for coll_name in collections:
                            count = await db[coll_name].count_documents({})
                            collection_info[coll_name] = {
                                "count": count,
                                "has_data": count > 0
                            }
                        inspection_data["collections"] = collection_info
                    
                    if aspect in ["database_schema", "all"]:
                        # Get sample documents from key collections to show schema
                        key_collections = ["athlete_profiles", "community_posts", "workouts", "subscriptions", "agents"]
                        schemas = {}
                        for coll_name in key_collections:
                            sample = await db[coll_name].find_one({}, {"_id": 0})
                            if sample:
                                # Get field names and types
                                schema = {field: type(value).__name__ for field, value in sample.items()}
                                schemas[coll_name] = schema
                        inspection_data["schemas"] = schemas
                    
                    if aspect in ["sample_data", "all"]:
                        # Get a few sample records from key collections
                        samples = {}
                        samples["recent_users"] = await db.athlete_profiles.find({}, {"_id": 0, "email": 1, "name": 1, "created_at": 1}).sort("created_at", -1).limit(3).to_list(length=3)
                        samples["recent_posts"] = await db.community_posts.find({}, {"_id": 0, "title": 1, "author_name": 1, "created_at": 1}).sort("created_at", -1).limit(3).to_list(length=3)
                        samples["active_agents"] = await db.agents.find({"is_active": True}, {"_id": 0, "name": 1, "accessibility": 1}).to_list(length=5)
                        inspection_data["samples"] = samples
                    
                    if aspect in ["system_info", "all"]:
                        # Get system configuration
                        system_settings = await db.system_settings.find_one({}, {"_id": 0})
                        inspection_data["system_info"] = {
                            "has_openai_key": bool(system_settings and (system_settings.get("advanced", {}).get("openaiApiKey") or system_settings.get("openaiApiKey"))),
                            "modules_enabled": system_settings.get("modules", {}) if system_settings else {},
                            "app_configured": bool(system_settings)
                        }
                    
                    function_response = json.dumps(inspection_data, default=str)
                
                messages.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": function_name,
                    "content": function_response
                })
            
            # Get final response with tool results
            second_response = await openai_client.chat.completions.create(
                model="gpt-4o",
                messages=messages
            )
            response = second_response.choices[0].message.content
        else:
            response = response_message.content
        
        # Store conversation in database
        chat_record = {
            "id": str(uuid.uuid4()),
            "agent_id": request.agent_id,
            "session_id": session_id,
            "athlete_id": request.athlete_id or "guest",
            "message": request.message,
            "response": response,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.agent_conversations.insert_one(chat_record)
        
        # Check if navigation command was issued
        navigation_command = None
        if tool_calls:
            for tool_call in tool_calls:
                if tool_call.function.name == "navigate_to_page":
                    args = json.loads(tool_call.function.arguments)
                    navigation_command = f"/dashboard/{args.get('page')}"
        
        return {
            "response": response,
            "session_id": session_id,
            "agent_name": agent_obj.get("name"),
            "navigation": navigation_command,
            "conversation_length": len(messages) - 1  # Excluding system message
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Agent chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to chat with agent: {str(e)}")
