"""
Email & CRM Routes - Complete
Handles email template management, custom email campaigns, and support form submissions:
- Email template CRUD operations
- Template testing functionality
- Support form submission handling
- Custom email campaign management
"""

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import logging
import os

# Import email service and shared utilities
import sys
sys.path.append('/app/backend')
from email_service import get_email_service
from utils import prepare_for_mongo, get_db

# Initialize router
router = APIRouter(prefix="/api", tags=["email_crm"])

# MongoDB connection
db = get_db()

# Pydantic Models
class EmailTemplateUpdate(BaseModel):
    template_id: str
    subject: str
    body: str
    html_body: str

class SupportFormSubmission(BaseModel):
    """Model for support form submission"""
    name: str
    email: str
    subject: str
    message: str

class CustomEmail(BaseModel):
    """Model for custom email campaign"""
    name: str
    subject: str
    body: str
    html_body: Optional[str] = ""
    target_audience: str  # all, waitlist, free, pro, premium

# ========================================
# EMAIL TEMPLATE ENDPOINTS
# ========================================

@router.get("/email-templates")
async def get_email_templates():
    """Get all email templates"""
    try:
        templates = await db.email_templates.find({}, {"_id": 0}).limit(100).to_list(length=100)
        return templates
    except Exception as e:
        logging.error(f"Error getting email templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/email-templates")
async def save_email_template(template: EmailTemplateUpdate):
    """Save or update an email template"""
    try:
        # Check if template exists
        existing = await db.email_templates.find_one({"template_id": template.template_id})
        
        template_data = {
            "template_id": template.template_id,
            "subject": template.subject,
            "body": template.body,
            "html_body": template.html_body,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if existing:
            # Update existing template
            await db.email_templates.update_one(
                {"template_id": template.template_id},
                {"$set": template_data}
            )
            return {"message": "Template updated successfully"}
        else:
            # Create new template
            template_data["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.email_templates.insert_one(template_data)
            return {"message": "Template created successfully"}
            
    except Exception as e:
        logging.error(f"Error saving email template: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/email-templates/{template_id}")
async def delete_email_template(template_id: str):
    """Delete an email template"""
    try:
        result = await db.email_templates.delete_one({"template_id": template_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Template not found")
            
        return {"message": "Template deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting email template: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/email-templates/send-test")
async def send_test_email(data: dict):
    """Send a test email using a template"""
    try:
        template_id = data.get("template_id")
        test_email = data.get("test_email")
        
        if not template_id or not test_email:
            raise HTTPException(status_code=400, detail="template_id and test_email are required")
        
        # Get template
        template = await db.email_templates.find_one({"template_id": template_id}, {"_id": 0})
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Get email service
        email_service = get_email_service()
        if not email_service:
            raise HTTPException(status_code=503, detail="Email service not configured")
        
        # Send test email
        success = await email_service.send_email(
            to_email=test_email,
            subject=f"[TEST] {template['subject']}",
            text_content=template['body'],
            html_content=template.get('html_body', template['body'])
        )
        
        if success:
            return {"message": "Test email sent successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send test email")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending test email: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ========================================
# SUPPORT FORM ENDPOINTS
# ========================================

@router.post("/support/submit")
async def submit_support_form(submission: SupportFormSubmission):
    """
    Handle support form submission and send email to support@kaizenlifetracker.com
    """
    try:
        logging.info(f"=== SUPPORT FORM SUBMISSION RECEIVED ===")
        logging.info(f"From: {submission.name} ({submission.email})")
        logging.info(f"Subject: {submission.subject}")
        logging.info(f"Message preview: {submission.message[:100]}...")
        
        # Store submission in database
        submission_data = {
            "id": str(uuid.uuid4()),
            "name": submission.name,
            "email": submission.email,
            "subject": submission.subject,
            "message": submission.message,
            "status": "new",
            "submitted_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.support_submissions.insert_one(submission_data)
        logging.info(f"Submission saved to database with ID: {submission_data['id']}")
        
        # Send email notification
        email_service = get_email_service()
        if email_service:
            email_body = f"""
New support form submission received:

Name: {submission.name}
Email: {submission.email}
Subject: {submission.subject}

Message:
{submission.message}

---
Submitted at: {submission_data['submitted_at']}
Submission ID: {submission_data['id']}
            """
            
            html_body = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h2 style="color: #0066cc;">New Support Form Submission</h2>
    
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Name:</strong> {submission.name}</p>
        <p><strong>Email:</strong> <a href="mailto:{submission.email}">{submission.email}</a></p>
        <p><strong>Subject:</strong> {submission.subject}</p>
    </div>
    
    <div style="margin: 20px 0;">
        <strong>Message:</strong>
        <p style="white-space: pre-wrap; background-color: #ffffff; padding: 15px; border-left: 3px solid #0066cc;">
{submission.message}
        </p>
    </div>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="font-size: 12px; color: #666;">
        <strong>Submitted at:</strong> {submission_data['submitted_at']}<br>
        <strong>Submission ID:</strong> {submission_data['id']}
    </p>
</body>
</html>
            """
            
            success = await email_service.send_email(
                to_email="support@kaizenlifetracker.com",
                subject=f"Support Form: {submission.subject}",
                text_content=email_body,
                html_content=html_body,
                reply_to=submission.email
            )
            
            if success:
                logging.info("Support notification email sent successfully")
            else:
                logging.error("Failed to send support notification email")
        else:
            logging.warning("Email service not available - submission saved but notification not sent")
        
        return {
            "message": "Thank you for your message. We'll get back to you soon!",
            "submission_id": submission_data['id']
        }
        
    except Exception as e:
        logging.error(f"Error processing support form submission: {e}")
        logging.error(f"Error details: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process support form: {str(e)}"
        )

# ========================================
# CUSTOM EMAIL CAMPAIGN ENDPOINTS
# ========================================

@router.get("/custom-emails")
async def get_custom_emails():
    """Get all custom email campaigns"""
    try:
        emails = await db.custom_emails.find({}, {"_id": 0}).limit(100).to_list(length=100)
        return {"emails": emails}
    except Exception as e:
        logging.error(f"Error getting custom emails: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/custom-emails")
async def create_custom_email(email: CustomEmail):
    """Create a new custom email campaign"""
    try:
        email_data = {
            "id": str(uuid.uuid4()),
            "name": email.name,
            "subject": email.subject,
            "body": email.body,
            "html_body": email.html_body,
            "target_audience": email.target_audience,
            "status": "draft",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "sent_count": 0
        }
        
        await db.custom_emails.insert_one(email_data)
        
        return {
            "message": "Custom email created successfully",
            "email_id": email_data['id']
        }
        
    except Exception as e:
        logging.error(f"Error creating custom email: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/custom-emails/{email_id}")
async def update_custom_email(email_id: str, email: CustomEmail):
    """Update a custom email campaign"""
    try:
        # Check if email exists
        existing = await db.custom_emails.find_one({"id": email_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Email campaign not found")
        
        update_data = {
            "name": email.name,
            "subject": email.subject,
            "body": email.body,
            "html_body": email.html_body,
            "target_audience": email.target_audience,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.custom_emails.update_one(
            {"id": email_id},
            {"$set": update_data}
        )
        
        return {"message": "Custom email updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating custom email: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/custom-emails/{email_id}")
async def delete_custom_email(email_id: str):
    """Delete a custom email campaign"""
    try:
        result = await db.custom_emails.delete_one({"id": email_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Email campaign not found")
        
        return {"message": "Custom email deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting custom email: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/custom-emails/{email_id}/send")
async def send_custom_email(email_id: str):
    """Send a custom email campaign to target audience"""
    try:
        # Get email campaign
        email = await db.custom_emails.find_one({"id": email_id}, {"_id": 0})
        if not email:
            raise HTTPException(status_code=404, detail="Email campaign not found")
        
        # Get email service
        email_service = get_email_service()
        if not email_service:
            raise HTTPException(status_code=503, detail="Email service not configured")
        
        # Determine target audience
        target_audience = email['target_audience']
        recipients = []
        
        if target_audience == "all":
            # Get all users with emails
            users = await db.athlete_profiles.find(
                {"email": {"$exists": True, "$ne": ""}},
                {"_id": 0, "email": 1}
            ).to_list(length=10000)
            recipients = [u['email'] for u in users]
            
        elif target_audience == "waitlist":
            # Get waitlist emails
            waitlist = await db.waiting_list.find(
                {"email": {"$exists": True, "$ne": ""}},
                {"_id": 0, "email": 1}
            ).to_list(length=10000)
            recipients = [w['email'] for w in waitlist]
            
        else:
            # Get users by subscription tier
            users = await db.athlete_profiles.find(
                {
                    "email": {"$exists": True, "$ne": ""},
                    "subscription_tier": target_audience
                },
                {"_id": 0, "email": 1}
            ).to_list(length=10000)
            recipients = [u['email'] for u in users]
        
        if not recipients:
            return {"message": "No recipients found for target audience", "sent_count": 0}
        
        # Send emails (in batches to avoid overwhelming the service)
        sent_count = 0
        failed_count = 0
        
        for recipient in recipients:
            try:
                success = await email_service.send_email(
                    to_email=recipient,
                    subject=email['subject'],
                    text_content=email['body'],
                    html_content=email.get('html_body', email['body'])
                )
                
                if success:
                    sent_count += 1
                else:
                    failed_count += 1
                    
            except Exception as e:
                logging.error(f"Failed to send email to {recipient}: {e}")
                failed_count += 1
        
        # Update email campaign status
        await db.custom_emails.update_one(
            {"id": email_id},
            {
                "$set": {
                    "status": "sent",
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                    "sent_count": sent_count,
                    "failed_count": failed_count
                }
            }
        )
        
        return {
            "message": f"Email campaign sent to {sent_count} recipients",
            "sent_count": sent_count,
            "failed_count": failed_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending custom email: {e}")
        raise HTTPException(status_code=500, detail=str(e))
