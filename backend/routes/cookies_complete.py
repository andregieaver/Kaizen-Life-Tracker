"""
Cookies Routes
Handles cookie consent management and GDPR compliance (super admin only).
"""

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
import logging
import uuid
from datetime import datetime, timezone
from database import db

router = APIRouter(tags=["cookies"])


# Models
class DetectedCookie(BaseModel):
    """Model for detected cookies"""
    model_config = ConfigDict(protected_namespaces=())
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    domain: str
    category: str  # necessary, analytics, marketing, functional
    description: str = ""
    expiry: str = ""  # Cookie expiration info
    source: str  # frontend, backend, third-party
    detected_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CookieConsentTexts(BaseModel):
    """Customizable texts for cookie consent banner"""
    model_config = ConfigDict(protected_namespaces=())
    
    banner_title: str = "We value your privacy"
    banner_description: str = "We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking 'Accept All', you consent to our use of cookies."
    accept_all_button: str = "Accept All"
    reject_all_button: str = "Reject All"  
    customize_button: str = "Customize"
    save_preferences_button: str = "Save Preferences"
    cookie_policy_link: str = "/cookie-policy"
    cookie_policy_text: str = "Cookie Policy"
    necessary_title: str = "Necessary Cookies"
    necessary_description: str = "These cookies are essential for the website to function properly."
    analytics_title: str = "Analytics Cookies"
    analytics_description: str = "These cookies help us understand how visitors interact with our website."
    marketing_title: str = "Marketing Cookies"
    marketing_description: str = "These cookies are used to track visitors across websites for advertising purposes."
    functional_title: str = "Functional Cookies"
    functional_description: str = "These cookies enable enhanced functionality and personalization."


# Helper functions
async def verify_super_admin(athlete_id: str):
    """Verify if athlete is super admin"""
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="User not found")
    is_admin = athlete.get("is_super_admin", False) or athlete.get("role") == "super_admin"
    if not is_admin:
        raise HTTPException(status_code=403, detail="Access denied. Super admin privileges required.")
    return athlete


# Routes
@router.post("/cookies/scan")
async def scan_cookies(athlete_id: str, request: Request):
    """Scan for cookies - frontend, backend, and third-party"""
    try:
        # Verify super admin
        await verify_super_admin(athlete_id)
        
        logging.info(f"=== COOKIE SCAN INITIATED by {athlete_id} ===")
        
        detected_cookies = []
        
        # 1. Scan Backend Cookies (from response headers)
        backend_cookies = [
            {
                "name": "session_token",
                "domain": request.headers.get("host", "app.domain.com"),
                "category": "necessary",
                "description": "Session authentication token",
                "expiry": "Session",
                "source": "backend"
            }
        ]
        
        # 2. Detect Third-Party Cookies from System Settings
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        
        if settings:
            # Google Tag Manager cookies
            if settings.get("advanced", {}).get("googleTagManager", {}).get("headCode"):
                detected_cookies.extend([
                    {
                        "name": "_ga",
                        "domain": ".domain.com",
                        "category": "analytics",
                        "description": "Google Analytics - Used to distinguish users",
                        "expiry": "2 years",
                        "source": "third-party"
                    },
                    {
                        "name": "_ga_*",
                        "domain": ".domain.com",
                        "category": "analytics",
                        "description": "Google Analytics - Used to persist session state",
                        "expiry": "2 years",
                        "source": "third-party"
                    },
                    {
                        "name": "_gid",
                        "domain": ".domain.com",
                        "category": "analytics",
                        "description": "Google Analytics - Used to distinguish users",
                        "expiry": "24 hours",
                        "source": "third-party"
                    },
                    {
                        "name": "_gat",
                        "domain": ".domain.com",
                        "category": "analytics",
                        "description": "Google Analytics - Used to throttle request rate",
                        "expiry": "1 minute",
                        "source": "third-party"
                    }
                ])
            
            # Microsoft Clarity cookies
            if settings.get("advanced", {}).get("microsoftClarity", {}).get("scriptCode"):
                detected_cookies.extend([
                    {
                        "name": "_clck",
                        "domain": ".domain.com",
                        "category": "analytics",
                        "description": "Microsoft Clarity - Persists the Clarity User ID",
                        "expiry": "1 year",
                        "source": "third-party"
                    },
                    {
                        "name": "_clsk",
                        "domain": ".domain.com",
                        "category": "analytics",
                        "description": "Microsoft Clarity - Connects multiple page views",
                        "expiry": "1 day",
                        "source": "third-party"
                    },
                    {
                        "name": "CLID",
                        "domain": ".clarity.ms",
                        "category": "analytics",
                        "description": "Microsoft Clarity - Identifies the first-time visitor",
                        "expiry": "1 year",
                        "source": "third-party"
                    }
                ])
            
            # Stripe cookies (if enabled)
            if settings.get("advanced", {}).get("stripe", {}).get("live", {}).get("apiKey"):
                detected_cookies.extend([
                    {
                        "name": "__stripe_mid",
                        "domain": ".stripe.com",
                        "category": "functional",
                        "description": "Stripe - Fraud prevention and detection",
                        "expiry": "1 year",
                        "source": "third-party"
                    },
                    {
                        "name": "__stripe_sid",
                        "domain": ".stripe.com",
                        "category": "functional",
                        "description": "Stripe - Fraud prevention and detection",
                        "expiry": "30 minutes",
                        "source": "third-party"
                    }
                ])
        
        # 3. Add common frontend cookies
        frontend_cookies = [
            {
                "name": "cookie_consent",
                "domain": request.headers.get("host", "app.domain.com"),
                "category": "necessary",
                "description": "Stores user's cookie consent preferences",
                "expiry": "1 year",
                "source": "frontend"
            },
            {
                "name": "auth_token",
                "domain": request.headers.get("host", "app.domain.com"),
                "category": "necessary",
                "description": "User authentication token",
                "expiry": "Session or 30 days",
                "source": "frontend"
            },
            {
                "name": "user_preferences",
                "domain": request.headers.get("host", "app.domain.com"),
                "category": "functional",
                "description": "Stores user interface preferences",
                "expiry": "1 year",
                "source": "frontend"
            }
        ]
        
        detected_cookies.extend(backend_cookies)
        detected_cookies.extend(frontend_cookies)
        
        # Convert to DetectedCookie models
        cookie_objects = []
        for cookie_data in detected_cookies:
            cookie_obj = DetectedCookie(**cookie_data)
            cookie_objects.append(cookie_obj.model_dump())
        
        # Store scan results in database
        scan_result = {
            "scan_id": str(uuid.uuid4()),
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "scanned_by": athlete_id,
            "cookies": cookie_objects,
            "total_count": len(cookie_objects)
        }
        
        await db.cookie_scans.insert_one(scan_result)
        
        # Update system settings with latest scan
        await db.system_settings.update_one(
            {"setting_type": "global"},
            {
                "$set": {
                    "cookies.last_scan": scan_result,
                    "cookies.updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        logging.info(f"Cookie scan completed: {len(cookie_objects)} cookies detected")
        
        return {
            "success": True,
            "scan_id": scan_result["scan_id"],
            "cookies": cookie_objects,
            "total_count": len(cookie_objects),
            "scanned_at": scan_result["scanned_at"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error scanning cookies: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to scan cookies: {str(e)}")


@router.get("/cookies/settings")
async def get_cookie_settings(athlete_id: str):
    """Get cookie management settings"""
    try:
        # Verify super admin
        await verify_super_admin(athlete_id)
        
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        
        if not settings or "cookies" not in settings:
            # Return default cookie settings
            default_texts = CookieConsentTexts()
            return {
                "enabled": False,
                "consent_mode": "gtm",  # gtm or gtag
                "auto_scan_enabled": True,
                "auto_scan_frequency": "weekly",  # weekly, monthly
                "last_scan": None,
                "detected_cookies": [],
                "consent_texts": default_texts.model_dump(),
                "gtm_integration": {
                    "enabled": True,
                    "container_id": ""
                }
            }
        
        cookie_settings = settings.get("cookies", {})
        
        # Ensure consent_texts has all fields
        if "consent_texts" not in cookie_settings:
            default_texts = CookieConsentTexts()
            cookie_settings["consent_texts"] = default_texts.model_dump()
        
        # Remove _id from last_scan if present (MongoDB ObjectId serialization issue)
        if "last_scan" in cookie_settings and cookie_settings["last_scan"]:
            if "_id" in cookie_settings["last_scan"]:
                del cookie_settings["last_scan"]["_id"]
        
        return cookie_settings
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting cookie settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get cookie settings: {str(e)}")


@router.post("/settings")
async def save_cookie_settings(athlete_id: str, settings: dict):
    """Save cookie management settings"""
    try:
        # Verify super admin
        await verify_super_admin(athlete_id)
        
        logging.info(f"Saving cookie settings by {athlete_id}")
        
        # Update system settings
        result = await db.system_settings.update_one(
            {"setting_type": "global"},
            {
                "$set": {
                    "cookies": {
                        **settings,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "updated_by": athlete_id
                    }
                }
            },
            upsert=True
        )
        
        logging.info("Cookie settings saved successfully")
        
        return {
            "success": True,
            "message": "Cookie settings saved successfully",
            "modified": result.modified_count > 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error saving cookie settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to save cookie settings: {str(e)}")


@router.get("/consent/public")
async def get_public_cookie_consent():
    """Get public cookie consent settings (no auth required)"""
    try:
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        
        if not settings or "cookies" not in settings:
            default_texts = CookieConsentTexts()
            return {
                "enabled": False,
                "consent_texts": default_texts.model_dump(),
                "detected_cookies": []
            }
        
        cookie_settings = settings.get("cookies", {})
        
        # Return only necessary info for frontend banner
        return {
            "enabled": cookie_settings.get("enabled", False),
            "consent_texts": cookie_settings.get("consent_texts", CookieConsentTexts().model_dump()),
            "detected_cookies": cookie_settings.get("last_scan", {}).get("cookies", [])
        }
        
    except Exception as e:
        logging.error(f"Error getting public cookie consent: {e}", exc_info=True)
        # Return defaults on error so frontend doesn't break
        default_texts = CookieConsentTexts()
        return {
            "enabled": False,
            "consent_texts": default_texts.model_dump(),
            "detected_cookies": []
        }
