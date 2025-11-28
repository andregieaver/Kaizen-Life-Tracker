"""
Waitlist routes - Extracted from server.py
Handles waitlist management, auto-responder emails, and admin operations
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging

# Import shared dependencies
from database import db
from utils import prepare_for_mongo
from email_service import get_email_service

router = APIRouter(prefix="/waiting-list", tags=["waitlist"])

# ============= MODELS =============

class WaitingListEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    nationality: str
    integrations: List[str] = []
    status: str = "pending"
    source: str = "homepage"
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= HELPER FUNCTIONS =============

async def verify_super_admin(athlete_id: str):
    """Verify if athlete is super admin"""
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="User not found")
    is_admin = athlete.get("is_super_admin", False) or athlete.get("role") == "super_admin"
    if not is_admin:
        raise HTTPException(status_code=403, detail="Access denied. Super admin privileges required.")
    return athlete

# ============= ROUTES =============

@router.post("")
async def add_to_waiting_list(entry_data: dict):
    """Add entry to waiting list (public endpoint, no auth required)"""
    try:
        logging.info("=" * 80)
        logging.info("🔵 WAITLIST SIGNUP REQUEST RECEIVED")
        logging.info(f"📝 Request data: {entry_data}")
        logging.info("=" * 80)
        
        # Validate required fields
        if not entry_data.get("name") or not entry_data.get("email") or not entry_data.get("nationality"):
            logging.error(f"❌ VALIDATION FAILED - Missing fields. Data: {entry_data}")
            raise HTTPException(status_code=400, detail="Name, email, and nationality are required")
        
        logging.info(f"✅ STEP 1: Validation passed")
        
        # Check if email already exists
        existing = await db.waiting_list.find_one(
            {"email": entry_data["email"].lower().strip()},
            {"_id": 0}
        )
        
        if existing:
            logging.warning(f"⚠️ DUPLICATE: Email {entry_data['email']} already in waitlist")
            raise HTTPException(status_code=409, detail="Email already registered in waiting list")
        
        logging.info(f"✅ STEP 2: No duplicate found")
        
        # Create entry
        entry = WaitingListEntry(
            name=entry_data["name"].strip(),
            email=entry_data["email"].lower().strip(),
            nationality=entry_data["nationality"].strip(),
            integrations=entry_data.get("integrations", []),
            source=entry_data.get("source", "homepage"),
            notes=entry_data.get("notes")
        )
        
        logging.info(f"✅ STEP 3: Entry object created for {entry.email}")
        
        await db.waiting_list.insert_one(entry.model_dump())
        
        logging.info(f"✅ STEP 4: Entry saved to database - ID: {entry.id}")
        logging.info(f"📧 Starting auto-responder process for {entry.email}")
        
        # Debug tracking
        email_status = {
            "email_sent": False,
            "email_error": None,
            "service_enabled": False,
            "template_found": False,
            "step_reached": "4 - Entry saved"
        }
        
        # Send waitlist auto-responder email
        try:
            logging.info("🔄 STEP 5a: Getting email service...")
            email_service = get_email_service()
            
            logging.info(f"📊 Email service status: enabled={email_service.enabled if email_service else 'None'}, sender={email_service.sender_email if email_service else 'None'}")
            
            if not email_service or not email_service.enabled:
                logging.error("❌ STEP 5b: Email service NOT configured or NOT enabled!")
                logging.error(f"   email_service exists: {email_service is not None}")
                logging.error(f"   email_service.enabled: {email_service.enabled if email_service else 'N/A'}")
                email_status["step_reached"] = "5b - Service not enabled"
                email_status["email_error"] = "Email service not configured or not enabled"
                return {
                    "message": "Successfully added to waiting list",
                    "id": entry.id,
                    "debug": email_status
                }
            
            email_status["service_enabled"] = True
            email_status["step_reached"] = "5b - Service enabled"
            logging.info("✅ STEP 5b: Email service is configured and enabled")
            
            # Get email template
            logging.info("🔄 STEP 6a: Fetching email template...")
            template = await db.email_templates.find_one({"template_id": "waitlist_autoresponder"})
            
            if not template:
                logging.error("❌ STEP 6b: Template NOT FOUND in database!")
                logging.error("   Queried for: {'template_id': 'waitlist_autoresponder'}")
                email_status["step_reached"] = "6b - Template not found"
                email_status["email_error"] = "Template not found in database"
                return {
                    "message": "Successfully added to waiting list",
                    "id": entry.id,
                    "debug": email_status
                }
            
            email_status["template_found"] = True
            email_status["step_reached"] = "6b - Template found"
            logging.info(f"✅ STEP 6b: Template found - Subject: {template.get('subject', 'N/A')}")
            
            # Replace variables
            subject = template.get("subject", "Thank You for Joining Our Waitlist!")
            html_body = template.get("html_body", "")
            text_body = template.get("body", "")
            
            logging.info("🔄 STEP 7: Replacing template variables...")
            
            # Replace template variables
            variables = {
                "{{user_name}}": entry.name,
                "{{user_email}}": entry.email,
                "{{preferred_language}}": entry.nationality
            }
            
            for var, value in variables.items():
                subject = subject.replace(var, value)
                html_body = html_body.replace(var, value)
                text_body = text_body.replace(var, value)
            
            email_status["step_reached"] = "7 - Variables replaced"
            logging.info(f"✅ STEP 7: Variables replaced - Final subject: {subject}")
            
            # Send email
            logging.info(f"📤 STEP 8: Sending email to {entry.email}...")
            logging.info(f"   Sender: {email_service.sender_email}")
            logging.info(f"   Recipient: {entry.email}")
            logging.info(f"   Subject: {subject}")
            
            email_status["step_reached"] = "8 - Sending email..."
            
            await email_service.send_email(
                to_email=entry.email,
                subject=subject,
                html_content=html_body,
                text_content=text_body
            )
            
            email_status["email_sent"] = True
            email_status["step_reached"] = "8 - Email sent successfully!"
            
            logging.info("=" * 80)
            logging.info(f"✅ ✅ ✅ SUCCESS! Waitlist auto-responder sent to {entry.email}")
            logging.info("=" * 80)
            
        except Exception as email_error:
            logging.error("=" * 80)
            logging.error(f"❌ ❌ ❌ ERROR sending waitlist auto-responder!")
            logging.error(f"Error type: {type(email_error).__name__}")
            logging.error(f"Error message: {str(email_error)}")
            logging.error(f"Full traceback:", exc_info=True)
            logging.error("=" * 80)
            email_status["email_error"] = f"{type(email_error).__name__}: {str(email_error)}"
            # Don't fail the whole request if email fails
        
        return {
            "message": "Successfully added to waiting list",
            "id": entry.id,
            "debug": email_status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"❌ CRITICAL ERROR adding to waiting list: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test-debug")
async def test_waitlist_debug(test_email: str = "test@example.com"):
    """
    Test endpoint to trigger waitlist signup with detailed logging
    Use this to debug the auto-responder flow
    """
    test_data = {
        "name": "Debug Test User",
        "email": test_email,
        "nationality": "English",
        "integrations": ["test"],
        "source": "debug_test"
    }
    
    logging.info("🧪 TEST ENDPOINT CALLED - Starting debug test")
    
    # Call the actual waitlist endpoint
    result = await add_to_waiting_list(test_data)
    
    return {
        "test_result": "completed",
        "message": "Check logs for detailed debug output",
        "result": result
    }


@router.get("/diagnostic")
async def waitlist_diagnostic():
    """
    Diagnostic endpoint to verify waitlist auto-responder configuration
    This is a public endpoint to help verify deployment
    """
    try:
        # Check email service
        email_service = get_email_service()
        email_configured = email_service is not None and email_service.enabled
        
        # Check email template
        template = await db.email_templates.find_one({"template_id": "waitlist_autoresponder"})
        template_exists = template is not None
        
        # Build diagnostic response
        diagnostic = {
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "email_service": {
                "configured": email_configured,
                "enabled": email_service.enabled if email_service else False,
                "sender_email": email_service.sender_email if email_service else None
            },
            "waitlist_template": {
                "exists": template_exists,
                "template_id": "waitlist_autoresponder"
            },
            "code_version": "2024-11-27_fix_deployed",
            "checks": {
                "email_service_initialized": email_configured,
                "template_found": template_exists,
                "ready_to_send": email_configured and template_exists
            }
        }
        
        return diagnostic
        
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


@router.get("")
async def get_waiting_list(
    athlete_id: str,
    status: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    """Get waiting list entries (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Build query
        query = {}
        if status:
            query["status"] = status
        
        # Get entries
        entries = await db.waiting_list.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).to_list(length=min(limit, 100))
        
        # Get total count
        total_count = await db.waiting_list.count_documents(query)
        
        return {
            "entries": entries,
            "total": total_count,
            "limit": limit,
            "skip": skip
        }
        
    except Exception as e:
        logging.error(f"Error getting waiting list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export")
async def export_waiting_list_csv(athlete_id: str, status: Optional[str] = None):
    """Export waiting list to CSV (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Build query
        query = {}
        if status:
            query["status"] = status
        
        # Get all entries
        entries = await db.waiting_list.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).limit(100).to_list(length=100)
        
        # Create CSV content
        csv_lines = []
        csv_lines.append("Name,Email,Nationality,Status,Source,Created At,Notes")
        
        for entry in entries:
            name = entry.get("name", "").replace(",", ";")
            email = entry.get("email", "")
            nationality = entry.get("nationality", "").replace(",", ";")
            status = entry.get("status", "pending")
            source = entry.get("source", "homepage")
            created_at = entry.get("created_at", "")
            if isinstance(created_at, datetime):
                created_at = created_at.isoformat()
            notes = entry.get("notes", "").replace(",", ";") if entry.get("notes") else ""
            
            csv_lines.append(f"{name},{email},{nationality},{status},{source},{created_at},{notes}")
        
        csv_content = "\n".join(csv_lines)
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=waiting-list-{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
            }
        )
        
    except Exception as e:
        logging.error(f"Error exporting waiting list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{entry_id}")
async def update_waiting_list_entry(entry_id: str, updates: dict, athlete_id: str):
    """Update waiting list entry (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Check if entry exists
        entry = await db.waiting_list.find_one({"id": entry_id}, {"_id": 0})
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        # Update entry
        update_data = {}
        if "status" in updates:
            update_data["status"] = updates["status"]
        if "notes" in updates:
            update_data["notes"] = updates["notes"]
        
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        await db.waiting_list.update_one(
            {"id": entry_id},
            {"$set": update_data}
        )
        
        logging.info(f"Waiting list entry updated: {entry_id} by {athlete_id}")
        return {"message": "Entry updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating waiting list entry: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{entry_id}")
async def delete_waiting_list_entry(entry_id: str, athlete_id: str):
    """Delete waiting list entry (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        result = await db.waiting_list.delete_one({"id": entry_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        logging.info(f"Waiting list entry deleted: {entry_id} by {athlete_id}")
        return {"message": "Entry deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting waiting list entry: {e}")
        raise HTTPException(status_code=500, detail=str(e))
