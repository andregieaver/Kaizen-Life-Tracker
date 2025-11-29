"""
Waiting List Routes - Complete
Handles waiting list management for pre-launch signups:
- Public signup endpoint (no auth required)
- Admin management endpoints (super admin only)
- Email notification integration
- Export functionality for CRM
"""

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging
import os
import csv
import io

# Import email service and shared utilities
import sys
sys.path.append('/app/backend')
from email_service import get_email_service
from utils import verify_super_admin, get_db

# Initialize router
router = APIRouter(prefix="/api", tags=["waitinglist"])

# MongoDB connection
db = get_db()

# ========================================
# WAITING LIST ENDPOINTS
# ========================================

@router.post("/waiting-list")
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
            logging.warning(f"⚠️ STEP 2: Email already exists: {entry_data['email']}")
            return {
                "message": "You're already on the waiting list!",
                "status": "already_exists"
            }
        
        logging.info(f"✅ STEP 2: Email is new, proceeding with signup")
        
        # Create waiting list entry
        entry = {
            "id": str(uuid.uuid4()),
            "name": entry_data["name"].strip(),
            "email": entry_data["email"].lower().strip(),
            "nationality": entry_data["nationality"],
            "source": entry_data.get("source", "website"),
            "referral_code": entry_data.get("referral_code"),
            "joined_at": datetime.now(timezone.utc).isoformat(),
            "status": "pending",
            "notified": False
        }
        
        logging.info(f"✅ STEP 3: Entry object created with ID: {entry['id']}")
        
        # Insert into database
        await db.waiting_list.insert_one(entry)
        logging.info(f"✅ STEP 4: Entry saved to database")
        
        # Send welcome email
        email_service = get_email_service()
        if email_service:
            logging.info(f"📧 STEP 5: Attempting to send welcome email to {entry['email']}")
            
            # Get email template
            template = await db.email_templates.find_one(
                {"template_id": "waitlist_welcome"},
                {"_id": 0}
            )
            
            if template:
                # Personalize email
                email_body = template['body'].replace("{{name}}", entry['name'])
                email_html = template.get('html_body', '').replace("{{name}}", entry['name'])
                
                success = await email_service.send_email(
                    to_email=entry['email'],
                    subject=template['subject'],
                    text_content=email_body,
                    html_content=email_html if email_html else email_body
                )
                
                if success:
                    logging.info(f"✅ STEP 6: Welcome email sent successfully")
                    await db.waiting_list.update_one(
                        {"id": entry['id']},
                        {"$set": {"notified": True}}
                    )
                else:
                    logging.warning(f"⚠️ STEP 6: Failed to send welcome email")
            else:
                logging.warning(f"⚠️ STEP 5: No waitlist_welcome template found")
        else:
            logging.warning(f"⚠️ STEP 5: Email service not configured")
        
        logging.info("=" * 80)
        logging.info(f"🎉 WAITLIST SIGNUP COMPLETED SUCCESSFULLY for {entry['email']}")
        logging.info("=" * 80)
        
        return {
            "message": "Successfully added to waiting list!",
            "status": "success",
            "entry_id": entry['id']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"❌ CRITICAL ERROR in waiting list signup: {e}")
        logging.error(f"Error type: {type(e).__name__}")
        logging.error(f"Error details: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/waiting-list/test-debug")
async def test_waiting_list_debug():
    """Test endpoint for debugging waiting list"""
    try:
        # Test database connection
        count = await db.waiting_list.count_documents({})
        
        # Get last entry
        last_entry = await db.waiting_list.find_one(
            {},
            {"_id": 0},
            sort=[("joined_at", -1)]
        )
        
        return {
            "status": "ok",
            "database": "connected",
            "total_entries": count,
            "last_entry": last_entry
        }
    except Exception as e:
        logging.error(f"Debug test error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/waiting-list/diagnostic")
async def waiting_list_diagnostic():
    """Diagnostic endpoint to check waiting list system"""
    try:
        # Check database connection
        count = await db.waiting_list.count_documents({})
        
        # Check email service
        email_service = get_email_service()
        email_status = "configured" if email_service else "not_configured"
        
        # Check template
        template = await db.email_templates.find_one({"template_id": "waitlist_welcome"})
        template_status = "exists" if template else "missing"
        
        # Get recent entries
        recent = await db.waiting_list.find(
            {},
            {"_id": 0}
        ).sort("joined_at", -1).limit(5).to_list(length=5)
        
        return {
            "status": "ok",
            "database_connection": "ok",
            "total_entries": count,
            "email_service": email_status,
            "welcome_template": template_status,
            "recent_entries": recent
        }
    except Exception as e:
        logging.error(f"Diagnostic error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/waiting-list")
async def get_waiting_list(athlete_id: str):
    """Get all waiting list entries (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        entries = await db.waiting_list.find(
            {},
            {"_id": 0}
        ).sort("joined_at", -1).limit(1000).to_list(length=1000)
        
        return {
            "entries": entries,
            "total": len(entries)
        }
    except Exception as e:
        logging.error(f"Error getting waiting list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/waiting-list/export")
async def export_waiting_list(athlete_id: str):
    """Export waiting list to CSV (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        entries = await db.waiting_list.find(
            {},
            {"_id": 0}
        ).sort("joined_at", -1).to_list(length=10000)
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(["ID", "Name", "Email", "Nationality", "Source", "Joined At", "Status"])
        
        # Write data
        for entry in entries:
            writer.writerow([
                entry.get("id", ""),
                entry.get("name", ""),
                entry.get("email", ""),
                entry.get("nationality", ""),
                entry.get("source", ""),
                entry.get("joined_at", ""),
                entry.get("status", "")
            ])
        
        csv_content = output.getvalue()
        output.close()
        
        # Return CSV as download
        from fastapi.responses import Response
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=waitinglist_{datetime.now().strftime('%Y%m%d')}.csv"
            }
        )
        
    except Exception as e:
        logging.error(f"Error exporting waiting list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/waiting-list/{entry_id}")
async def update_waiting_list_entry(entry_id: str, update_data: dict, athlete_id: str):
    """Update waiting list entry (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Check if entry exists
        existing = await db.waiting_list.find_one({"id": entry_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        # Update entry
        update_fields = {}
        if "status" in update_data:
            update_fields["status"] = update_data["status"]
        if "notes" in update_data:
            update_fields["notes"] = update_data["notes"]
        
        if update_fields:
            update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.waiting_list.update_one(
                {"id": entry_id},
                {"$set": update_fields}
            )
        
        logging.info(f"Waiting list entry updated: {entry_id} by {athlete_id}")
        return {"message": "Entry updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating waiting list entry: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/waiting-list/{entry_id}")
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
