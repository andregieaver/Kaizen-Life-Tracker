"""
Agents routes - Extracted from server.py
Handles AI agent CRUD operations, knowledge base management, and agent chat
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import logging
import base64
import os

# Import shared dependencies
from database import db
from utils import prepare_for_mongo, parse_from_mongo

router = APIRouter(prefix="/agents", tags=["agents"])

# ============= MODELS =============

class Agent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    profile_image_url: Optional[str] = None
    custom_instructions: str
    voice: str = 'alloy'
    personality: Optional[str] = None
    accessibility: str = 'frontend'
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

# ============= HELPER FUNCTIONS =============

async def verify_super_admin(athlete_id: str):
    """Verify if athlete is super admin"""
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="User not found")
    # Check both field names for backwards compatibility
    is_admin = athlete.get("is_super_admin", False) or athlete.get("role") == "super_admin"
    if not is_admin:
        raise HTTPException(status_code=403, detail="Access denied. Super admin privileges required.")
    return athlete

# ============= ROUTES =============

@router.get("")
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
            agents = await db.agents.find({}, {"_id": 0}).limit(100).to_list(length=100)
        else:
            agents = await db.agents.find(
                {"accessibility": "frontend", "is_active": True},
                {"_id": 0}
            ).limit(100).to_list(length=100)
        
        return [parse_from_mongo(agent) for agent in agents]
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get agents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{agent_id}")
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


@router.post("")
async def create_agent(request: AgentCreateRequest, athlete_id: str = Query(...)):
    """Create new agent (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        agent = Agent(
            name=request.name,
            custom_instructions=request.custom_instructions,
            voice=request.voice,
            personality=request.personality,
            accessibility=request.accessibility,
            is_active=request.is_active
        )
        
        agent_dict = prepare_for_mongo(agent.model_dump())
        await db.agents.insert_one(agent_dict)
        
        # Fetch the created agent without _id
        created_agent = await db.agents.find_one({"id": agent.id}, {"_id": 0})
        return parse_from_mongo(created_agent)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to create agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{agent_id}")
async def update_agent(agent_id: str, request: AgentUpdateRequest, athlete_id: str = Query(...)):
    """Update agent (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        # Get existing agent
        existing_agent = await db.agents.find_one({"id": agent_id})
        if not existing_agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Build update dict
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.custom_instructions is not None:
            update_data["custom_instructions"] = request.custom_instructions
        if request.voice is not None:
            update_data["voice"] = request.voice
        if request.personality is not None:
            update_data["personality"] = request.personality
        if request.accessibility is not None:
            update_data["accessibility"] = request.accessibility
        if request.is_active is not None:
            update_data["is_active"] = request.is_active
        if request.profile_image_url is not None:
            update_data["profile_image_url"] = request.profile_image_url
        
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        # Update agent
        await db.agents.update_one(
            {"id": agent_id},
            {"$set": update_data}
        )
        
        # Return updated agent
        updated_agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
        return parse_from_mongo(updated_agent)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to update agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str, athlete_id: str = Query(...)):
    """Delete agent (Super Admin only)"""
    try:
        await verify_super_admin(athlete_id)
        
        result = await db.agents.delete_one({"id": agent_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        return {"success": True, "message": "Agent deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to delete agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{agent_id}/upload-image")
async def upload_agent_image(agent_id: str, file: UploadFile = File(...), athlete_id: str = Query(...)):
    """Upload agent profile image (Super Admin only) - stores as base64 data URL"""
    try:
        await verify_super_admin(athlete_id)
        
        agent = await db.agents.find_one({"id": agent_id})
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are allowed")
        
        content = await file.read()
        
        max_size = 500 * 1024
        if len(content) > max_size:
            raise HTTPException(status_code=400, detail="Image must be less than 500KB")
        
        encoded = base64.b64encode(content).decode('utf-8')
        data_url = f"data:{file.content_type};base64,{encoded}"
        
        logging.info(f"Agent {agent_id}: Converting image to base64 data URL (size: {len(data_url)} chars)")
        
        result = await db.agents.update_one(
            {"id": agent_id},
            {"$set": {"profile_image_url": data_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        logging.info(f"Agent {agent_id}: Database updated (matched: {result.matched_count}, modified: {result.modified_count})")
        
        return {"url": data_url, "success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to upload agent image: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{agent_id}/upload-knowledge")
async def upload_agent_knowledge(
    agent_id: str,
    file: UploadFile = File(...),
    athlete_id: str = Query(...)
):
    """Upload knowledge base file for agent"""
    try:
        await verify_super_admin(athlete_id)
        
        agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        allowed_extensions = [".txt", ".md", ".csv", ".json"]
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        content = await file.read()
        text_content = content.decode('utf-8', errors='ignore')
        
        max_size = 500000
        if len(text_content) > max_size:
            raise HTTPException(status_code=400, detail="File too large. Max 500KB")
        
        knowledge_base = agent.get("knowledge_base", [])
        
        existing_index = next(
            (i for i, kb in enumerate(knowledge_base) if kb["filename"] == file.filename),
            None
        )
        
        file_entry = {
            "filename": file.filename,
            "content": text_content,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "size": len(text_content)
        }
        
        if existing_index is not None:
            knowledge_base[existing_index] = file_entry
        else:
            knowledge_base.append(file_entry)
        
        await db.agents.update_one(
            {"id": agent_id},
            {"$set": {"knowledge_base": knowledge_base, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {
            "success": True,
            "filename": file.filename,
            "size": len(text_content),
            "total_files": len(knowledge_base)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to upload knowledge file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{agent_id}/knowledge/{filename}")
async def delete_agent_knowledge(agent_id: str, filename: str, athlete_id: str = Query(...)):
    """Delete knowledge base file from agent"""
    try:
        await verify_super_admin(athlete_id)
        
        agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        knowledge_base = agent.get("knowledge_base", [])
        knowledge_base = [kb for kb in knowledge_base if kb["filename"] != filename]
        
        await db.agents.update_one(
            {"id": agent_id},
            {"$set": {"knowledge_base": knowledge_base, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {
            "success": True,
            "message": f"Deleted {filename}",
            "remaining_files": len(knowledge_base)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting knowledge file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/by-accessibility/{accessibility_level}")
async def get_agents_by_accessibility(accessibility_level: str, athlete_id: str = Query(...)):
    """Get agents by accessibility level"""
    try:
        # Validate accessibility level
        valid_levels = ['frontend', 'logged_in', 'admin']
        if accessibility_level not in valid_levels:
            raise HTTPException(status_code=400, detail="Invalid accessibility level")
        
        # Admin agents require super admin access
        if accessibility_level == 'admin':
            await verify_super_admin(athlete_id)
        
        agents = await db.agents.find(
            {"accessibility": accessibility_level, "is_active": True},
            {"_id": 0}
        ).limit(100).to_list(length=100)
        
        return [parse_from_mongo(agent) for agent in agents]
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get agents by accessibility: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/seed-management-agent")
async def seed_management_agent(athlete_id: str = Query(...)):
    """Create default Management Agent (Super Admin only, one-time setup)"""
    try:
        await verify_super_admin(athlete_id)
        
        # Check if management agent already exists
        existing = await db.agents.find_one({"accessibility": "admin", "name": "Management Agent"})
        if existing:
            return {"message": "Management Agent already exists", "agent": parse_from_mongo(existing)}
        
        # Create Management Agent
        management_agent = Agent(
            id="management-agent-default",
            name="Management Agent",
            custom_instructions="""You are the Management Agent with full administrative access to this application.

IMPORTANT: When the conversation starts, FIRST use inspect_application(aspect="all") to understand what data exists in the database and what capabilities are available. This gives you real-time awareness of the application state.

YOUR TOOLS:
1. inspect_application - Get awareness of database structure, available collections, schemas, and sample data
   - Use this FIRST in every conversation to understand the current state
   - Returns real collection names, field schemas, and sample records

2. navigate_to_page - Navigate admin to dashboard pages
   - Pages: community, crm, system-settings, subscriptions, etc.
   - Use when asked to "go to", "open", "show me" a page

3. query_database - Query any collection with filters
   - Use after inspection to query specific data
   - Supports count, list, find operations

4. get_user_info - Get detailed user information by email or ID

5. get_statistics - Get app-wide statistics (users, subscriptions, etc.)

WORKFLOW:
1. First message: Use inspect_application to see what's available
2. Answer questions based on real data from inspection/queries
3. Navigate when asked
4. Always reference actual data, not assumptions

TONE: Professional, helpful, data-driven. Provide accurate information based on real database queries.""",
            voice='alloy',
            personality=None,
            accessibility='admin',
            is_active=True
        )
        
        agent_dict = prepare_for_mongo(management_agent.model_dump())
        await db.agents.insert_one(agent_dict)
        
        return {"message": "Management Agent created successfully", "agent": parse_from_mongo(agent_dict)}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to seed management agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# NOTE: /agents/chat endpoint is complex with OpenAI integration and tool calling
# It will remain in server.py until a separate chat service module is created
# This keeps the router focused on CRUD operations
