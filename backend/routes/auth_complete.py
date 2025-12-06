"""
Authentication routes - Complete example of refactored router
Extracted from server.py as part of the refactoring effort
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
from passlib.context import CryptContext
import secrets
import logging
import os
from slowapi import Limiter
from slowapi.util import get_remote_address

# Import shared dependencies
from database import db
from utils import prepare_for_mongo, parse_from_mongo
from email_service import get_email_service

router = APIRouter(prefix="/auth", tags=["authentication"])

# Initialize rate limiter for auth routes
limiter = Limiter(key_func=get_remote_address)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ============= MODELS =============

class LoginRequest(BaseModel):
    email: str
    password: str

class GoogleLoginRequest(BaseModel):
    google_id: str
    email: str
    name: str
    picture: Optional[str] = None
    session_token: str

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    email: str
    reset_token: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    athlete_id: str
    current_password: str
    new_password: str

class ChangeEmailRequest(BaseModel):
    athlete_id: str
    new_email: str
    password: str

# ============= ROUTES =============

@router.post("/login")
@limiter.limit("5/minute")  # Strict rate limit for auth
async def login_athlete(request: Request, login_data: LoginRequest):
    """Login athlete by email and password - Rate limited to 5 attempts/minute"""
    # Debug logging
    logging.info(f"[LOGIN] Attempt for email: {login_data.email}")
    logging.info(f"[LOGIN] Password length: {len(login_data.password)}, first 3 chars: {login_data.password[:3] if len(login_data.password) >= 3 else login_data.password}")
    
    # Try athlete_profiles first (new collection)
    athlete = await db.athlete_profiles.find_one(
        {"email": login_data.email.lower().strip()}, 
        {"_id": 0}
    )
    
    # Fallback to athletes collection (legacy)
    if not athlete:
        athlete = await db.athletes.find_one(
            {"email": login_data.email.lower().strip()}, 
            {"_id": 0}
        )
    
    if not athlete:
        logging.warning(f"[LOGIN] User not found: {login_data.email}")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    logging.info(f"[LOGIN] Stored password hash starts with: {athlete['password'][:20]}")
    password_valid = pwd_context.verify(login_data.password, athlete["password"])
    logging.info(f"[LOGIN] Password verification result: {password_valid}")
    
    if not password_valid:
        logging.warning(f"[LOGIN] Invalid password for: {login_data.email}")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Use id if it exists, otherwise use email as identifier
    athlete_identifier = athlete.get("id") or athlete.get("email")
    
    # Update last_active_at
    await db.athlete_profiles.update_one(
        {"id": athlete_identifier},
        {"$set": {"last_active_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "athlete_id": athlete_identifier,
        "name": athlete["name"],
        "email": athlete["email"],
        "role": athlete.get("role", "user")
    }


@router.post("/forgot-password")
@limiter.limit("3/minute")  # Strict limit to prevent abuse
async def forgot_password(http_request: Request, request: dict):
    """Generate password reset token and send email - Rate limited to 3/minute"""
    email = request.get("email", "").lower().strip()
    
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    # Find user
    athlete = await db.athlete_profiles.find_one(
        {"email": email},
        {"_id": 0, "id": 1, "name": 1, "email": 1}
    )
    
    # Always return success to prevent email enumeration
    if not athlete:
        logging.info(f"[FORGOT PASSWORD] Email not found: {email}")
        return {"message": "If that email exists, a password reset link has been sent"}
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Store token in database
    await db.athlete_profiles.update_one(
        {"id": athlete["id"]},
        {"$set": {
            "reset_token": reset_token,
            "reset_token_expires": reset_token_expires.isoformat()
        }}
    )
    
    # Send reset email
    try:
        email_service = get_email_service()
        if email_service and email_service.enabled:
            # Get frontend URL from environment
            frontend_url = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:3000').replace('/api', '').replace(':8001', ':3000')
            reset_link = f"{frontend_url}/reset-password?token={reset_token}"
            
            # Email content
            subject = "Password Reset Request"
            text_content = f"""
Hello {athlete.get('name', 'there')},

You requested to reset your password. Click the link below to reset it:

{reset_link}

This link will expire in 1 hour.

If you didn't request this, please ignore this email.

Best regards,
My Health Tracker Team
"""
            
            html_content = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #32D3FF;">Password Reset Request</h2>
        <p>Hello {athlete.get('name', 'there')},</p>
        <p>You requested to reset your password. Click the button below to reset it:</p>
        <div style="margin: 30px 0; text-align: center;">
            <a href="{reset_link}" style="background-color: #32D3FF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #32D3FF;">{reset_link}</p>
        <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">Best regards,<br>My Health Tracker Team</p>
    </div>
</body>
</html>
"""
            
            await email_service.send_email(
                to_email=email,
                subject=subject,
                text_content=text_content,
                html_content=html_content
            )
            
            logging.info(f"[FORGOT PASSWORD] Reset email sent to: {email}")
        else:
            logging.warning("[FORGOT PASSWORD] Email service not configured, token generated but not sent")
    
    except Exception as e:
        logging.error(f"[FORGOT PASSWORD] Failed to send email: {str(e)}")
    
    return {"message": "If that email exists, a password reset link has been sent"}


@router.post("/verify-reset-token")
async def verify_reset_token(request: dict):
    """Verify if a reset token is valid"""
    token = request.get("token", "")
    
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")
    
    # Find athlete with this token
    athlete = await db.athlete_profiles.find_one(
        {"reset_token": token},
        {"_id": 0, "id": 1, "reset_token_expires": 1}
    )
    
    if not athlete:
        return {"valid": False, "message": "Invalid token"}
    
    # Check if token is expired
    expires_at = datetime.fromisoformat(athlete["reset_token_expires"])
    if datetime.now(timezone.utc) > expires_at:
        return {"valid": False, "message": "Token has expired"}
    
    return {"valid": True, "athlete_id": athlete["id"]}


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, data: PasswordResetConfirm):
    """Reset password using token - Rate limited to 5/minute"""
    # Find athlete with this token
    athlete = await db.athlete_profiles.find_one(
        {"email": data.email.lower().strip(), "reset_token": data.reset_token},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "reset_token_expires": 1}
    )
    
    if not athlete:
        raise HTTPException(status_code=400, detail="Invalid token or email")
    
    # Check if token is expired
    expires_at = datetime.fromisoformat(athlete["reset_token_expires"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Token has expired. Please request a new password reset")
    
    # Hash new password
    hashed_password = pwd_context.hash(data.new_password)
    
    # Update password and clear reset token
    await db.athlete_profiles.update_one(
        {"id": athlete["id"]},
        {"$set": {
            "password": hashed_password
        }, "$unset": {
            "reset_token": "",
            "reset_token_expires": ""
        }}
    )
    
    logging.info(f"[RESET PASSWORD] Password reset successful for: {data.email}")
    
    # Send confirmation email
    try:
        email_service = get_email_service()
        if email_service and email_service.enabled:
            await email_service.send_password_changed_email(
                to_email=athlete["email"],
                user_name=athlete["name"]
            )
    except Exception as e:
        logging.error(f"[RESET PASSWORD] Failed to send confirmation email: {str(e)}")
    
    return {"message": "Password has been reset successfully"}


@router.post("/google-login")
@limiter.limit("10/minute")
async def google_login(request: Request, data: GoogleLoginRequest):
    """Login or register athlete using Google OAuth - Rate limited to 10/minute"""
    email = data.email.lower().strip()
    
    # Check if athlete exists
    athlete = await db.athlete_profiles.find_one({"email": email}, {"_id": 0})
    
    if athlete:
        # Update last_active_at
        await db.athlete_profiles.update_one(
            {"id": athlete["id"]},
            {"$set": {"last_active_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {
            "athlete_id": athlete["id"],
            "name": athlete["name"],
            "email": athlete["email"],
            "role": athlete.get("role", "user"),
            "existing_user": True
        }
    else:
        # Create new athlete profile
        new_athlete = {
            "id": str(uuid.uuid4()),
            "name": data.name,
            "email": email,
            "password": pwd_context.hash(data.session_token),  # Use session token as password
            "profile_picture": data.picture,
            "google_id": data.google_id,
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_active_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.athlete_profiles.insert_one(new_athlete)
        
        logging.info(f"[GOOGLE LOGIN] New athlete created: {email}")
        
        return {
            "athlete_id": new_athlete["id"],
            "name": new_athlete["name"],
            "email": new_athlete["email"],
            "role": "user",
            "existing_user": False
        }


@router.post("/change-password")
async def change_password(data: ChangePasswordRequest):
    """Change athlete password"""
    athlete = await db.athlete_profiles.find_one(
        {"id": data.athlete_id},
        {"_id": 0, "password": 1, "email": 1, "name": 1}
    )
    
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    # Verify current password
    if not pwd_context.verify(data.current_password, athlete["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Hash and update new password
    hashed_password = pwd_context.hash(data.new_password)
    await db.athlete_profiles.update_one(
        {"id": data.athlete_id},
        {"$set": {"password": hashed_password}}
    )
    
    logging.info(f"[CHANGE PASSWORD] Password changed for athlete: {data.athlete_id}")
    
    # Send confirmation email
    try:
        email_service = get_email_service()
        if email_service and email_service.enabled:
            await email_service.send_password_changed_email(
                to_email=athlete["email"],
                user_name=athlete["name"]
            )
    except Exception as e:
        logging.error(f"[CHANGE PASSWORD] Failed to send confirmation email: {str(e)}")
    
    return {"message": "Password changed successfully"}


@router.post("/change-email")
async def change_email(data: ChangeEmailRequest):
    """Change athlete email address"""
    # Verify athlete exists and password is correct
    athlete = await db.athlete_profiles.find_one(
        {"id": data.athlete_id},
        {"_id": 0, "password": 1, "email": 1, "name": 1}
    )
    
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    if not pwd_context.verify(data.password, athlete["password"]):
        raise HTTPException(status_code=400, detail="Password is incorrect")
    
    # Check if new email is already in use
    existing = await db.athlete_profiles.find_one(
        {"email": data.new_email.lower().strip()},
        {"_id": 0, "id": 1}
    )
    
    if existing and existing["id"] != data.athlete_id:
        raise HTTPException(status_code=400, detail="Email is already in use")
    
    old_email = athlete["email"]
    new_email = data.new_email.lower().strip()
    
    # Update email
    await db.athlete_profiles.update_one(
        {"id": data.athlete_id},
        {"$set": {"email": new_email}}
    )
    
    logging.info(f"[CHANGE EMAIL] Email changed from {old_email} to {new_email}")
    
    # Send confirmation emails to both old and new addresses
    try:
        email_service = get_email_service()
        if email_service and email_service.enabled:
            await email_service.send_email_changed_notification(
                old_email=old_email,
                new_email=new_email,
                user_name=athlete["name"]
            )
    except Exception as e:
        logging.error(f"[CHANGE EMAIL] Failed to send confirmation emails: {str(e)}")
    
    return {"message": "Email changed successfully", "new_email": new_email}
