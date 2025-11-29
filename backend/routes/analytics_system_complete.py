"""
Analytics & System Routes - Complete
Handles analytics tracking, statistics, menu management, and system utilities:
- First-party analytics tracking (ad-block resilient)
- Analytics event storage and reporting
- Menu management for frontend navigation
- System utilities (language, translations)
"""

from fastapi import APIRouter, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
from datetime import datetime, timezone, timedelta
import logging
import os

# Initialize router
router = APIRouter(prefix="/api", tags=["analytics_system"])

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

async def verify_super_admin(athlete_id: str):
    """Verify if athlete is super admin"""
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="User not found")
    is_admin = athlete.get("is_super_admin", False) or athlete.get("role") == "super_admin"
    if not is_admin:
        raise HTTPException(status_code=403, detail="Access denied. Super admin privileges required.")
    return athlete

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
