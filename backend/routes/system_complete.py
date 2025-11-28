"""
System routes - Extracted from server.py
Handles system settings, statistics, SEO configuration, and email service management
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import logging
import base64
import io
from PIL import Image

# Import shared dependencies
from database import db
from utils import prepare_for_mongo
from email_service import initialize_email_service, get_email_service

router = APIRouter(prefix="/system", tags=["system"])

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

@router.get("/stats")
async def get_system_stats(athlete_id: str):
    """Get system statistics (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Count total users
        total_users = await db.athlete_profiles.count_documents({})
        
        # Count active sessions (placeholder)
        active_sessions = 0  # TODO: Implement session counting
        
        # Get database size (approximate)
        stats_result = await db.command("dbStats")
        db_size_bytes = stats_result.get("dataSize", 0)
        db_size_mb = round(db_size_bytes / (1024 * 1024), 2)
        db_size = f"{db_size_mb} MB"
        
        # System health check (basic)
        health = "Good"
        
        return {
            "total_users": total_users,
            "active_sessions": active_sessions,
            "db_size": db_size,
            "health": health
        }
    except Exception as e:
        logging.error(f"Error getting system stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve system stats: {str(e)}")


@router.get("/waitlist-integration-stats")
async def get_waitlist_integration_stats(athlete_id: str):
    """Get distribution of desired integrations from waitlist (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Get all waitlist entries with integrations
        entries = await db.waiting_list.find(
            {"integrations": {"$exists": True, "$ne": []}},
            {"integrations": 1}
        ).to_list(length=None)
        
        # Count integration occurrences
        integration_counts = {}
        total_entries = 0
        
        for entry in entries:
            integrations = entry.get('integrations', [])
            if integrations:
                total_entries += 1
                for integration in integrations:
                    integration = integration.strip()
                    if integration:
                        integration_counts[integration] = integration_counts.get(integration, 0) + 1
        
        # Convert to list of objects sorted by count
        distribution = [
            {"name": name, "count": count}
            for name, count in sorted(integration_counts.items(), key=lambda x: x[1], reverse=True)
        ]
        
        return {
            "distribution": distribution,
            "total_entries": total_entries,
            "unique_integrations": len(integration_counts)
        }
    except Exception as e:
        logging.error(f"Error getting waitlist integration stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve waitlist integration stats: {str(e)}")


@router.get("/connected-integration-stats")
async def get_connected_integration_stats(athlete_id: str):
    """Get distribution of connected integrations from users (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Get all integrations from the integrations collection
        integrations = await db.integrations.find(
            {},
            {"provider": 1, "user_id": 1}
        ).to_list(length=None)
        
        # Count integration occurrences by provider
        provider_counts = {}
        unique_users = set()
        
        for integration in integrations:
            provider = integration.get('provider', 'Unknown')
            user_id = integration.get('user_id')
            
            if user_id:
                unique_users.add(user_id)
            
            provider_counts[provider] = provider_counts.get(provider, 0) + 1
        
        # Convert to list of objects sorted by count
        distribution = [
            {"name": name, "count": count}
            for name, count in sorted(provider_counts.items(), key=lambda x: x[1], reverse=True)
        ]
        
        return {
            "distribution": distribution,
            "total_connections": len(integrations),
            "unique_users": len(unique_users),
            "unique_providers": len(provider_counts)
        }
    except Exception as e:
        logging.error(f"Error getting connected integration stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve connected integration stats: {str(e)}")


@router.get("/gender-distribution-stats")
async def get_gender_distribution_stats(athlete_id: str):
    """Get gender distribution of users (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Get all athlete profiles with gender field
        athletes = await db.athlete_profiles.find(
            {},
            {"gender": 1}
        ).to_list(length=None)
        
        # Count gender occurrences
        gender_counts = {
            "male": 0,
            "female": 0,
            "other": 0,
            "prefer_not_to_say": 0,
            "not_specified": 0
        }
        
        for athlete in athletes:
            gender = athlete.get('gender')
            if gender in gender_counts:
                gender_counts[gender] += 1
            elif gender is None or gender == "":
                gender_counts["not_specified"] += 1
            else:
                gender_counts["other"] += 1
        
        # Convert to list of objects with friendly names
        distribution = [
            {"name": "Male", "value": "male", "count": gender_counts["male"]},
            {"name": "Female", "value": "female", "count": gender_counts["female"]},
            {"name": "Other", "value": "other", "count": gender_counts["other"]},
            {"name": "Prefer not to say", "value": "prefer_not_to_say", "count": gender_counts["prefer_not_to_say"]},
            {"name": "Not specified", "value": "not_specified", "count": gender_counts["not_specified"]}
        ]
        
        # Filter out zero counts
        distribution = [d for d in distribution if d["count"] > 0]
        
        return {
            "distribution": distribution,
            "total_users": len(athletes)
        }
    except Exception as e:
        logging.error(f"Error getting gender distribution stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve gender distribution stats: {str(e)}")


@router.get("/subscriber-stats")
async def get_subscriber_stats(
    athlete_id: str, 
    period: str = "90d",
    compare: bool = False
):
    """Get subscriber statistics over time (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Define period ranges
        period_days = {
            "7d": 7,
            "30d": 30,
            "90d": 90,
            "1y": 365,
            "all": None
        }
        
        days = period_days.get(period, 90)
        
        # Get all athletes
        athletes = await db.athlete_profiles.find(
            {},
            {"_id": 0, "created_at": 1, "subscription_tier": 1}
        ).to_list(length=1000)
        
        # Calculate date ranges
        now = datetime.now()
        if days:
            current_period_start = now - timedelta(days=days)
        else:
            # For "all", use earliest subscriber date
            dates = [datetime.fromisoformat(a["created_at"].replace('Z', '+00:00')) 
                    for a in athletes if a.get("created_at")]
            if dates:
                current_period_start = min(dates)
                days = (now - current_period_start).days
            else:
                current_period_start = now - timedelta(days=90)
                days = 90
        
        # Count by subscription tier
        tier_counts = {"free": 0, "pro": 0, "premium": 0}
        
        for athlete in athletes:
            tier = athlete.get("subscription_tier", "free")
            if tier in tier_counts:
                tier_counts[tier] += 1
        
        return {
            "total": len(athletes),
            "by_tier": tier_counts,
            "period": period,
            "days": days
        }
        
    except Exception as e:
        logging.error(f"Error getting subscriber stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings/public")
async def get_public_system_settings():
    """Get public system settings (no auth required)"""
    try:
        # Get settings from database
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        
        # Return only SEO settings and GTM codes for public access
        if settings:
            return {
                "seo": settings.get("advanced", {}).get("seo", {
                    "siteTitle": "TrainSmart",
                    "metaDescription": "",
                    "faviconUrl": None,
                    "logoUrl": None,
                    "ogImage": None
                }),
                "googleTagManager": settings.get("advanced", {}).get("googleTagManager", {
                    "headCode": "",
                    "bodyCode": ""
                }),
                "microsoftClarity": settings.get("advanced", {}).get("microsoftClarity", {
                    "scriptCode": ""
                }),
                "plans": settings.get("plans", {})
            }
        
        # Return defaults if none exist
        return {
            "seo": {
                "siteTitle": "TrainSmart",
                "metaDescription": "",
                "faviconUrl": None,
                "logoUrl": None,
                "ogImage": None
            },
            "googleTagManager": {"headCode": "", "bodyCode": ""},
            "microsoftClarity": {"scriptCode": ""},
            "plans": {}
        }
        
    except Exception as e:
        logging.error(f"Error getting public settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings")
async def get_system_settings(athlete_id: str):
    """Get system settings (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Get settings from database
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        
        # Return default settings if none exist
        if not settings:
            return {
                "modules": {
                    "affiliateProgram": {"enabled": True, "expanded": True},
                    "community": {"enabled": True, "expanded": True}
                },
                "seo": {
                    "siteTitle": "",
                    "metaTitle": "",
                    "metaDescription": "",
                    "focusKeyword": "",
                    "faviconUrl": None
                },
                "plans": {},
                "advanced": {
                    "openaiApiKey": "",
                    "stripe": {
                        "live": {"apiKey": "", "webhookSecret": ""},
                        "sandbox": {"apiKey": "", "webhookSecret": ""}
                    }
                }
            }
        
        return settings
    except Exception as e:
        logging.error(f"Error getting system settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve system settings: {str(e)}")


@router.post("/settings")
async def save_system_settings(athlete_id: str, settings: dict):
    """Save system settings (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Update or insert settings
        result = await db.system_settings.update_one(
            {"setting_type": "global"},
            {
                "$set": {
                    **settings,
                    "setting_type": "global",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "updated_by": athlete_id
                }
            },
            upsert=True
        )
        
        # Initialize SendGrid email service if credentials provided
        if settings.get("advanced", {}).get("sendgrid"):
            sendgrid_config = settings["advanced"]["sendgrid"]
            if sendgrid_config.get("apiKey") and sendgrid_config.get("senderEmail"):
                try:
                    initialize_email_service(
                        api_key=sendgrid_config["apiKey"],
                        sender_email=sendgrid_config["senderEmail"],
                        sender_name=sendgrid_config.get("senderName", "TrainSmart")
                    )
                    logging.info("SendGrid email service initialized successfully")
                except Exception as email_error:
                    logging.error(f"Failed to initialize email service: {email_error}")
        
        logging.info(f"System settings saved by {athlete_id}")
        return {"message": "Settings saved successfully", "modified": result.modified_count > 0}
    except Exception as e:
        logging.error(f"Error saving system settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save system settings: {str(e)}")


@router.post("/upload-seo-image")
async def upload_seo_image(athlete_id: str, image_type: str, file: UploadFile = File(...)):
    """Upload favicon, logo, or OG image for SEO settings - stores as base64 (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        file_content = await file.read()
        if len(file_content) > 2 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size must be less than 2MB")
        
        try:
            image = Image.open(io.BytesIO(file_content))
            
            if image.mode == 'P':
                image = image.convert('RGBA')
            elif image.mode not in ('RGB', 'RGBA'):
                image = image.convert('RGBA')
            
            if image_type == "favicon":
                image = image.resize((32, 32), Image.Resampling.LANCZOS)
            elif image_type == "logo":
                image.thumbnail((200, 200), Image.Resampling.LANCZOS)
            elif image_type == "og_image":
                image = image.resize((1200, 630), Image.Resampling.LANCZOS)
            
            output = io.BytesIO()
            image.save(output, format='PNG', optimize=True)
            output.seek(0)
            optimized_content = output.read()
            
            encoded = base64.b64encode(optimized_content).decode('utf-8')
            data_url = f"data:image/png;base64,{encoded}"
            
            logging.info(f"SEO image {image_type}: Converted to base64 data URL (size: {len(data_url)} chars)")
            
            return {
                "success": True,
                "message": f"{image_type.title()} uploaded successfully",
                "path": data_url
            }
            
        except Exception as e:
            logging.error(f"Error processing SEO image: {e}")
            raise HTTPException(status_code=400, detail="Invalid image file")
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading SEO image: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")


@router.post("/reload-email-service")
async def reload_email_service(athlete_id: str):
    """
    Reload email service configuration from database
    Super Admin only - use after updating SendGrid settings
    """
    try:
        await verify_super_admin(athlete_id)
        
        # Load SendGrid settings from database
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        
        if not settings or not settings.get("advanced", {}).get("sendgrid"):
            return {
                "success": False,
                "message": "SendGrid configuration not found in database"
            }
        
        sendgrid_config = settings["advanced"]["sendgrid"]
        
        if not sendgrid_config.get("apiKey") or not sendgrid_config.get("senderEmail"):
            return {
                "success": False,
                "message": "SendGrid configuration incomplete (missing API key or sender email)"
            }
        
        # Reinitialize email service
        initialize_email_service(
            api_key=sendgrid_config["apiKey"],
            sender_email=sendgrid_config["senderEmail"],
            sender_name=sendgrid_config.get("senderName", "TrainSmart")
        )
        
        # Test if service is working
        email_service = get_email_service()
        
        return {
            "success": True,
            "message": "Email service reloaded successfully",
            "status": "enabled" if email_service.enabled else "disabled"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error reloading email service: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# NOTE: Translation endpoints (/translate-menu-item, /translate-menus, /set-language)
# and advanced features like cookie scanning remain in server.py
# These can be extracted in a future iteration
