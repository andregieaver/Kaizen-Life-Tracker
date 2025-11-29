"""
Analytics & System Routes - Complete
Handles analytics tracking, statistics, menu management, and system utilities:
- First-party analytics tracking (ad-block resilient)
- Analytics event storage and reporting
- Menu management for frontend navigation
- System utilities (language, translations)
"""

from fastapi import APIRouter, HTTPException, Request, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import logging
import os

# Import shared utilities
import sys
sys.path.append('/app/backend')
from utils import verify_super_admin, get_db

# Initialize router
router = APIRouter(prefix="/api", tags=["analytics_system"])

# Pydantic Models
class MenuItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    url: str
    order: int = 0
    is_separator: bool = False  # Only for slideout menu
    icon: Optional[str] = None  # Icon name (Lucide icon)
    highlighted: bool = False  # Highlight menu item with accent color
    highlight_color: Optional[str] = None  # Custom highlight color (hex)

class MenuSettings(BaseModel):
    header_logged_out: List[MenuItem] = []
    header_logged_in: List[MenuItem] = []
    slideout_menu: List[MenuItem] = []
    slideout_menu_logged_out: List[MenuItem] = []

# MongoDB connection
db = get_db()

# ========================================
# ANALYTICS ENDPOINTS
# ========================================

@router.post("/analytics/track")
async def track_analytics_event(event_data: dict, request: Request):
    """
    First-party analytics endpoint
    - Validates consent from cookie
    - Stores events (optional)
    - Forwards to GA4 Measurement Protocol (optional)
    - Ad-block resilient
    """
    try:
        logging.info(f"=== ANALYTICS EVENT RECEIVED ===")
        logging.info(f"Event: {event_data.get('event')}")
        
        # Check if analytics consent is granted
        # This can be done via cookie or header
        # For now, we'll accept all events and let GTM handle consent
        
        # Validate event data
        event = event_data.get('event')
        if not event:
            raise HTTPException(status_code=400, detail="Event name is required")
        
        # Extract key fields
        analytics_event = {
            "event": event,
            "timestamp": event_data.get('timestamp', datetime.now(timezone.utc).isoformat()),
            "anon_id": event_data.get('anon_id'),
            "user_id": event_data.get('user_id'),
            "page_location": event_data.get('page_location'),
            "page_path": event_data.get('page_path'),
            "page_title": event_data.get('page_title'),
            "page_referrer": event_data.get('page_referrer'),
            "utm_source": event_data.get('utm_source'),
            "utm_medium": event_data.get('utm_medium'),
            "utm_campaign": event_data.get('utm_campaign'),
            "utm_term": event_data.get('utm_term'),
            "utm_content": event_data.get('utm_content'),
            "properties": {k: v for k, v in event_data.items() if k not in [
                'event', 'timestamp', 'anon_id', 'user_id', 'page_location',
                'page_path', 'page_title', 'page_referrer', 'utm_source',
                'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'
            ]},
            "user_agent": request.headers.get("user-agent", ""),
            "ip_address": request.client.host if request.client else None,
            "received_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Store in database (optional - for data warehouse)
        try:
            await db.analytics_events.insert_one(analytics_event)
            logging.info(f"Analytics event stored: {event}")
        except Exception as db_error:
            logging.warning(f"Failed to store analytics event: {db_error}")
            # Continue even if storage fails
        
        # TODO: Forward to GA4 Measurement Protocol if needed
        # This would require GA4 API Secret and Measurement ID
        # For now, GTM handles the forwarding via client-side dataLayer
        
        return {
            "success": True,
            "message": "Event tracked successfully",
            "event": event
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error tracking analytics event: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to track event: {str(e)}")

@router.get("/analytics/events")
async def get_analytics_events(
    athlete_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = 100
):
    """
    Get analytics events (Super Admin only)
    Useful for debugging and data verification
    """
    try:
        # Verify super admin
        await verify_super_admin(athlete_id)
        
        # Build query
        query = {}
        
        if start_date:
            query["timestamp"] = {"$gte": start_date}
        
        if end_date:
            if "timestamp" in query:
                query["timestamp"]["$lte"] = end_date
            else:
                query["timestamp"] = {"$lte": end_date}
        
        if event_type:
            query["event"] = event_type
        
        # Fetch events
        events = await db.analytics_events.find(
            query,
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(length=100)
        
        return {
            "success": True,
            "count": len(events),
            "events": events
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching analytics events: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch events: {str(e)}")

@router.get("/analytics/stats")
async def get_analytics_stats(athlete_id: str, days: int = 30):
    """
    Get analytics statistics (Super Admin only)
    Provides overview of tracked events
    """
    try:
        # Verify super admin
        await verify_super_admin(athlete_id)
        
        # Calculate date range
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days)
        
        # Aggregate events by type
        pipeline = [
            {
                "$match": {
                    "timestamp": {
                        "$gte": start_date.isoformat(),
                        "$lte": end_date.isoformat()
                    }
                }
            },
            {
                "$group": {
                    "_id": "$event",
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"count": -1}
            }
        ]
        
        event_counts = await db.analytics_events.aggregate(pipeline).to_list(length=500)
        
        # Get total events
        total_events = sum(item["count"] for item in event_counts)
        
        # Get unique users
        unique_users = await db.analytics_events.distinct(
            "anon_id",
            {
                "timestamp": {
                    "$gte": start_date.isoformat(),
                    "$lte": end_date.isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "period_days": days,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_events": total_events,
            "unique_users": len(unique_users),
            "events_by_type": [
                {
                    "event": item["_id"],
                    "count": item["count"],
                    "percentage": round((item["count"] / total_events * 100), 2) if total_events > 0 else 0
                }
                for item in event_counts
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching analytics stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")
@router.get("/menus")
async def get_menus(athlete_id: str):
    """Get menu settings (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Get menus from system settings or return defaults
        settings = await db.system_settings.find_one({})
        
        # Define default menus structure
        default_menus = {
            "header_logged_out": [
                {"id": str(uuid.uuid4()), "label": "Home", "url": "/", "order": 0},
                {"id": str(uuid.uuid4()), "label": "Pricing", "url": "/pricing", "order": 1},
                {"id": str(uuid.uuid4()), "label": "Login", "url": "/login", "order": 2}
            ],
            "header_logged_in": [
                {"id": str(uuid.uuid4()), "label": "Dashboard", "url": "/dashboard", "order": 0},
                {"id": str(uuid.uuid4()), "label": "Account", "url": "/dashboard/account", "order": 1}
            ],
            "slideout_menu": [
                {"id": str(uuid.uuid4()), "label": "Home", "url": "/dashboard/home", "order": 0, "icon": "Home"},
                {"id": str(uuid.uuid4()), "label": "Coach Chat", "url": "/dashboard/coach", "order": 1, "icon": "MessageSquare"},
                {"id": str(uuid.uuid4()), "label": "", "url": "", "order": 2, "is_separator": True},
                {"id": str(uuid.uuid4()), "label": "Account", "url": "/dashboard/account", "order": 3, "icon": "User"}
            ],
            "slideout_menu_logged_out": [
                {"id": str(uuid.uuid4()), "label": "Home", "url": "/", "order": 0, "icon": "Home"},
                {"id": str(uuid.uuid4()), "label": "Pricing", "url": "/pricing", "order": 1, "icon": "DollarSign"},
                {"id": str(uuid.uuid4()), "label": "Login", "url": "/login", "order": 2, "icon": "LogIn"}
            ]
        }
        
        if settings and "menus" in settings:
            saved_menus = settings["menus"]
            # Merge saved menus with defaults to ensure all menu types exist
            # This handles cases where old database entries don't have slideout_menu_logged_out
            result_menus = {}
            for menu_type in ["header_logged_out", "header_logged_in", "slideout_menu", "slideout_menu_logged_out"]:
                if menu_type in saved_menus and isinstance(saved_menus[menu_type], list):
                    result_menus[menu_type] = saved_menus[menu_type]
                else:
                    result_menus[menu_type] = default_menus[menu_type]
            return result_menus
        
        return default_menus
    except Exception as e:
        logging.error(f"Error fetching menus: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch menus: {str(e)}")

@router.get("/menus/public")
async def get_menus_public():
    """Get menu settings (public endpoint)"""
    try:
        # Get menus from system settings or return defaults
        settings = await db.system_settings.find_one({})
        
        # Define default menus structure
        default_menus = {
            "header_logged_out": [
                {"id": str(uuid.uuid4()), "label": "Home", "url": "/", "order": 0},
                {"id": str(uuid.uuid4()), "label": "Pricing", "url": "/pricing", "order": 1},
                {"id": str(uuid.uuid4()), "label": "Login", "url": "/login", "order": 2}
            ],
            "header_logged_in": [
                {"id": str(uuid.uuid4()), "label": "Dashboard", "url": "/dashboard", "order": 0},
                {"id": str(uuid.uuid4()), "label": "Account", "url": "/dashboard/account", "order": 1}
            ],
            "slideout_menu": [
                {"id": str(uuid.uuid4()), "label": "Home", "url": "/dashboard/home", "order": 0, "icon": "Home"},
                {"id": str(uuid.uuid4()), "label": "Coach Chat", "url": "/dashboard/coach", "order": 1, "icon": "MessageSquare"},
                {"id": str(uuid.uuid4()), "label": "", "url": "", "order": 2, "is_separator": True},
                {"id": str(uuid.uuid4()), "label": "Account", "url": "/dashboard/account", "order": 3, "icon": "User"}
            ],
            "slideout_menu_logged_out": [
                {"id": str(uuid.uuid4()), "label": "Home", "url": "/", "order": 0, "icon": "Home"},
                {"id": str(uuid.uuid4()), "label": "Pricing", "url": "/pricing", "order": 1, "icon": "DollarSign"},
                {"id": str(uuid.uuid4()), "label": "Login", "url": "/login", "order": 2, "icon": "LogIn"}
            ]
        }
        
        if settings and "menus" in settings:
            saved_menus = settings["menus"]
            # Merge saved menus with defaults to ensure all menu types exist
            # This handles cases where old database entries don't have slideout_menu_logged_out
            result_menus = {}
            for menu_type in ["header_logged_out", "header_logged_in", "slideout_menu", "slideout_menu_logged_out"]:
                if menu_type in saved_menus and isinstance(saved_menus[menu_type], list):
                    result_menus[menu_type] = saved_menus[menu_type]
                else:
                    result_menus[menu_type] = default_menus[menu_type]
            return result_menus
        
        return default_menus
    except Exception as e:
        logging.error(f"Error fetching menus: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch menus: {str(e)}")

@router.put("/menus")
async def update_menus(athlete_id: str, menu_data: MenuSettings):
    """Update menu settings (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Convert Pydantic models to dict
        menus_dict = menu_data.model_dump()
        
        # PRESERVE EXISTING TRANSLATIONS when updating menus
        # Get existing menus from database
        existing_settings = await db.system_settings.find_one({})
        if existing_settings and 'menus' in existing_settings:
            existing_menus = existing_settings['menus']
            
            # For each menu type, preserve translations
            for menu_type in ['header_logged_out', 'header_logged_in', 'slideout_menu', 'slideout_menu_logged_out']:
                if menu_type in menus_dict and menu_type in existing_menus:
                    new_items = menus_dict[menu_type]
                    old_items = existing_menus[menu_type]
                    
                    # Create a map of old items by ID for quick lookup
                    old_items_map = {item.get('id'): item for item in old_items if item.get('id')}
                    
                    # Preserve translations for matching items
                    for new_item in new_items:
                        item_id = new_item.get('id')
                        if item_id and item_id in old_items_map:
                            old_item = old_items_map[item_id]
                            # Copy translations from old item to new item
                            if 'translations' in old_item:
                                new_item['translations'] = old_item['translations']
                                logging.info(f"Preserved translations for item: {new_item.get('label', 'unknown')}")
        
        # Update or create system settings with menus
        logging.info(f"[MENU SAVE] Saving menus for {athlete_id}")
        logging.info(f"[MENU SAVE] Menu types: {list(menus_dict.keys())}")
        logging.info(f"[MENU SAVE] Total items: {sum(len(menus_dict.get(k, [])) for k in menus_dict.keys())}")
        
        result = await db.system_settings.update_one(
            {},
            {"$set": {"menus": menus_dict}},
            upsert=True
        )
        
        logging.info(f"[MENU SAVE] MongoDB result: matched={result.matched_count}, modified={result.modified_count}")
        logging.info(f"Menus updated by {athlete_id}")
        return {"message": "Menus updated successfully", "menus": menus_dict}
    except Exception as e:
        logging.error(f"Error updating menus: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update menus: {str(e)}")

@router.post("/system/set-language")
async def set_language(
    athlete_id: str = Query(..., description="Athlete ID for verification"),
    language: str = Query(..., description="Language code (en, no, de, sv, etc.)")
):
    """Set language preference for the current user - Works with any identifier"""
    try:
        # Get the athlete by ID, email, or any identifier
        athlete = await db.athlete_profiles.find_one({"id": athlete_id})
        if not athlete:
            # Try finding by email if ID doesn't work
            athlete = await db.athlete_profiles.find_one({"email": athlete_id})
        
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete profile not found")
        
        # Store old language for response
        old_language = athlete.get('language', 'en')
        
        # Update language
        email = athlete.get('email')
        result = await db.athlete_profiles.update_one(
            {"email": email},
            {"$set": {"language": language}}
        )
        
        # Verify update
        updated = await db.athlete_profiles.find_one({"email": email})
        
        logging.info(f"[SET LANGUAGE] Updated language for {email} from '{old_language}' to '{language}'")
        
        return {
            "success": True,
            "email": email,
            "old_language": old_language,
            "new_language": updated.get('language'),
            "message": f"Language updated to {language}"
        }
        
    except Exception as e:
        logging.error(f"[SET LANGUAGE] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/system/translate-menu-item")
async def translate_single_menu_item(
    athlete_id: str = Query(..., description="Athlete ID for super admin verification"),
    menu_type: str = Query(..., description="Menu type: header_logged_out, header_logged_in, slideout_menu, or slideout_menu_logged_out"),
    item_id: str = Query(..., description="Menu item ID to translate")
):
    """Translate a single menu item into available languages using OpenAI (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Get OpenAI key
        openai_key = os.environ.get('OPENAI_API_KEY')
        if not openai_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
        
        openai_key = openai_key.strip()
        
        # Get current menus
        settings = await db.system_settings.find_one({})
        
        if not settings or 'menus' not in settings:
            raise HTTPException(status_code=400, detail="No menus found. Please save menus first.")
        
        menus = settings['menus']
        
        # Find the specific menu item
        if menu_type not in menus:
            raise HTTPException(status_code=400, detail=f"Invalid menu type: {menu_type}")
        
        menu_items = menus[menu_type]
        target_item = None
        item_index = None
        
        for idx, item in enumerate(menu_items):
            if item.get('id') == item_id:
                target_item = item
                item_index = idx
                break
        
        if not target_item:
            raise HTTPException(status_code=404, detail=f"Menu item with ID {item_id} not found")
        
        # Skip separators
        if target_item.get('is_separator'):
            raise HTTPException(status_code=400, detail="Cannot translate separator items")
        
        label = target_item.get('label', '')
        if not label:
            raise HTTPException(status_code=400, detail="Menu item has no label to translate")
        
        # Get available languages from locale files
        locales_dir = os.path.join(os.path.dirname(__file__), '../frontend/src/locales')
        available_languages = []
        
        if os.path.exists(locales_dir):
            for filename in os.listdir(locales_dir):
                if filename.endswith('.json') and filename != 'en.json':
                    lang_code = filename.replace('.json', '')
                    available_languages.append(lang_code)
        
        if not available_languages:
            available_languages = ['no', 'sv', 'da', 'de', 'es', 'fr']
        
        logging.info(f"[TRANSLATE ITEM] Translating '{label}' to {len(available_languages)} languages")
        
        # Initialize OpenAI client
        client = openai.OpenAI(api_key=openai_key)
        
        # Translate to each language
        if 'translations' not in target_item:
            target_item['translations'] = {}
        
        for lang_code in available_languages:
            try:
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": f"You are a translator. Translate the following menu item label to {lang_code}. Return ONLY the translated text, nothing else."},
                        {"role": "user", "content": label}
                    ],
                    max_tokens=50,
                    temperature=0.3
                )
                
                translated_text = response.choices[0].message.content.strip()
                target_item['translations'][lang_code] = translated_text
                logging.info(f"Translated '{label}' to {lang_code.upper()}: '{translated_text}'")
                
            except Exception as e:
                logging.error(f"Failed to translate '{label}' to {lang_code}: {e}")
        
        # Update the menu item in the database
        menus[menu_type][item_index] = target_item
        
        await db.system_settings.update_one(
            {},
            {"$set": {"menus": menus}},
            upsert=True
        )
        
        logging.info(f"[TRANSLATE ITEM] Successfully translated menu item: {label}")
        
        return {
            "success": True,
            "item_id": item_id,
            "label": label,
            "translations": target_item['translations'],
            "languages": list(target_item['translations'].keys()),
            "message": f"Translated '{label}' to {len(target_item['translations'])} languages"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[TRANSLATE ITEM] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/system/translate-menus")
async def translate_menus(athlete_id: str = Query(..., description="Athlete ID for super admin verification")):
    """Translate all menu items into available languages using OpenAI (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Get OpenAI API key from system settings (same logic as get_global_openai_key)
        settings = await db.system_settings.find_one({"setting_type": "global"}, {"_id": 0})
        
        if not settings:
            raise HTTPException(status_code=400, detail="System settings not found")
        
        # Check for key in advanced settings (new location)
        openai_key = settings.get("advanced", {}).get("openaiApiKey")
        
        # Fallback to old location for backwards compatibility
        if not openai_key:
            openai_key = settings.get("openaiApiKey")
        
        if not openai_key or not openai_key.strip():
            raise HTTPException(status_code=400, detail="OpenAI API key not configured in System Settings")
        
        openai_key = openai_key.strip()
        
        # Detect available languages from frontend locales folder
        locales_path = Path(__file__).parent.parent / "frontend" / "src" / "locales"
        available_languages = []
        language_names = {
            'no': 'Norwegian',
            'sv': 'Swedish', 
            'de': 'German',
            'fr': 'French',
            'es': 'Spanish',
            'da': 'Danish',
            'it': 'Italian',
            'ja': 'Japanese',
            'zh': 'Chinese'
        }
        
        if locales_path.exists():
            for file in locales_path.glob("*.json"):
                lang_code = file.stem
                if lang_code != 'en':  # Skip English (source language)
                    available_languages.append({
                        'code': lang_code,
                        'name': language_names.get(lang_code, lang_code.upper())
                    })
        
        if not available_languages:
            raise HTTPException(status_code=400, detail="No translation languages found")
        
        logging.info(f"Detected languages for translation: {[l['name'] for l in available_languages]}")
        
        # Get current menus from database
        settings = await db.system_settings.find_one({})
        
        # If no menus in database, tell user to save menus first via Menu Editor
        if not settings or 'menus' not in settings:
            raise HTTPException(
                status_code=400, 
                detail="No menus found in database. Please save your menus in the Menu Editor first, then translate them."
            )
        
        menus = settings['menus']
        logging.info(f"[TRANSLATE] Loaded menus from database")
        translated_count = 0
        
        # Initialize OpenAI client
        client = openai.OpenAI(api_key=openai_key)
        
        # Translate each menu type
        for menu_type in ['header_logged_in', 'header_logged_out', 'slideout_menu', 'slideout_menu_logged_out']:
            if menu_type not in menus:
                continue
                
            menu_items = menus[menu_type]
            
            for item in menu_items:
                # Skip if item has no label
                if 'label' not in item or not item['label']:
                    continue
                
                english_label = item['label']
                
                # Initialize translations dict if not exists
                if 'translations' not in item:
                    item['translations'] = {}
                
                # Translate to each language
                for lang in available_languages:
                    lang_code = lang['code']
                    lang_name = lang['name']
                    
                    try:
                        # Use OpenAI to translate
                        response = client.chat.completions.create(
                            model="gpt-4o-mini",
                            messages=[
                                {
                                    "role": "system",
                                    "content": f"You are a professional translator. Translate the given navigation menu item from English to {lang_name}. Return ONLY the translated text, nothing else. Keep it concise and appropriate for a navigation menu."
                                },
                                {
                                    "role": "user",
                                    "content": english_label
                                }
                            ],
                            temperature=0.3,
                            max_tokens=50
                        )
                        
                        translated_text = response.choices[0].message.content.strip()
                        item['translations'][lang_code] = translated_text
                        translated_count += 1
                        
                        logging.info(f"Translated '{english_label}' to {lang_name}: '{translated_text}'")
                        
                    except Exception as e:
                        logging.error(f"Error translating '{english_label}' to {lang_name}: {e}")
                        # Continue with other translations even if one fails
                        continue
        
        # Save updated menus back to database
        await db.system_settings.update_one(
            {},
            {"$set": {"menus": menus}},
            upsert=True
        )
        
        logging.info(f"Successfully translated {translated_count} menu items")
        
        return {
            "message": f"Successfully translated {translated_count} menu items",
            "languages": [l['name'] for l in available_languages],
            "translated_count": translated_count,
            "menus": menus
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error translating menus: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to translate menus: {str(e)}")

# Duplicate system settings (GET/POST /system/settings, GET /system/subscriber-stats, POST /system/upload-seo-image) moved to routes/system_complete.py
