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
        except:
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
