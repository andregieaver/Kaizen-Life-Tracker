"""
Push Notification Routes
Handles web push notification subscriptions and sending.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import Dict
import logging
import os
import json
import uuid
from datetime import datetime, timezone, date, time
from database import db
from pywebpush import webpush, WebPushException

router = APIRouter(prefix="/push", tags=["push"])


# Models
class PushSubscription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    endpoint: str
    keys: dict  # Contains 'p256dh' and 'auth' keys
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Helper functions
def prepare_for_mongo(data):
    """Prepare data for MongoDB storage by converting datetime objects to ISO strings"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
            elif isinstance(value, date):
                data[key] = value.isoformat()
            elif isinstance(value, time):
                data[key] = value.strftime('%H:%M:%S')
    return data


async def send_push_notification(athlete_id: str, title: str, body: str, url: str = "/dashboard/reports"):
    """Send push notification to all subscribed devices for an athlete"""
    try:
        # Get all push subscriptions for this athlete
        subscriptions = await db.push_subscriptions.find(
            {"athlete_id": athlete_id},
            {"_id": 0}
        ).limit(100).to_list(length=100)
        
        if not subscriptions:
            logging.info(f"No push subscriptions found for athlete {athlete_id}")
            return
        
        # Get VAPID keys from environment
        vapid_private_key = os.environ.get('VAPID_PRIVATE_KEY')
        vapid_claim_email = os.environ.get('VAPID_CLAIM_EMAIL', 'mailto:admin@trainsmart.app')
        
        if not vapid_private_key:
            logging.error("VAPID_PRIVATE_KEY not found in environment")
            return
        
        # Prepare notification data
        notification_data = {
            "title": title,
            "body": body,
            "icon": "/logo192.png",
            "badge": "/logo192.png",
            "url": url
        }
        
        # Send notification to each subscription
        for subscription in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": subscription["endpoint"],
                        "keys": subscription["keys"]
                    },
                    data=json.dumps(notification_data),
                    vapid_private_key=vapid_private_key,
                    vapid_claims={"sub": vapid_claim_email}
                )
                logging.info(f"Push notification sent successfully to subscription {subscription['id']}")
            except WebPushException as e:
                logging.error(f"Failed to send push notification to subscription {subscription['id']}: {e}")
                # If subscription is expired/invalid, remove it
                if e.response and e.response.status_code in [404, 410]:
                    await db.push_subscriptions.delete_one({"id": subscription['id']})
                    logging.info(f"Removed expired subscription {subscription['id']}")
            except Exception as e:
                logging.error(f"Unexpected error sending push notification: {e}")
    except Exception as e:
        logging.error(f"Error in send_push_notification: {e}")


# Routes
@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Get VAPID public key for push notification subscription"""
    public_key = os.environ.get('VAPID_PUBLIC_KEY')
    if not public_key:
        raise HTTPException(status_code=500, detail="VAPID public key not configured")
    return {"publicKey": public_key}


@router.post("/subscribe")
async def subscribe_to_push(subscription: PushSubscription):
    """Subscribe to push notifications"""
    try:
        # Check if subscription already exists
        existing = await db.push_subscriptions.find_one({
            "athlete_id": subscription.athlete_id,
            "endpoint": subscription.endpoint
        })
        
        if existing:
            # Update existing subscription
            await db.push_subscriptions.update_one(
                {"id": existing['id']},
                {"$set": {
                    "keys": subscription.keys,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            return {"message": "Push subscription updated successfully"}
        else:
            # Create new subscription
            subscription_dict = prepare_for_mongo(subscription.model_dump())
            await db.push_subscriptions.insert_one(subscription_dict)
            return {"message": "Push subscription created successfully", "id": subscription.id}
            
    except Exception as e:
        logging.error(f"Error subscribing to push: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to subscribe: {str(e)}")


@router.delete("/unsubscribe/{athlete_id}")
async def unsubscribe_from_push(athlete_id: str, endpoint: str = Query(...)):
    """Unsubscribe from push notifications"""
    try:
        result = await db.push_subscriptions.delete_one({
            "athlete_id": athlete_id,
            "endpoint": endpoint
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Subscription not found")
            
        return {"message": "Push subscription removed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error unsubscribing from push: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to unsubscribe: {str(e)}")


@router.get("/subscriptions/{athlete_id}")
async def get_push_subscriptions(athlete_id: str):
    """Get all push subscriptions for an athlete"""
    subscriptions = await db.push_subscriptions.find(
        {"athlete_id": athlete_id},
        {"_id": 0}
    ).limit(100).to_list(length=100)
    return {"subscriptions": subscriptions}


@router.post("/test/{athlete_id}")
async def test_push_notification(athlete_id: str):
    """Test push notification (for development/testing)"""
    await send_push_notification(
        athlete_id=athlete_id,
        title="Test Notification",
        body="This is a test push notification from TrainSmart!",
        url="/dashboard"
    )
    return {"message": "Test push notification sent"}
