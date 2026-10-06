"""
Referrals Routes
Handles referral system for athletes - code generation, tracking, conversion, and rewards.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
import logging
import os
import uuid
from datetime import datetime, timezone, timedelta
from database import db

router = APIRouter(prefix="/referrals", tags=["referrals"])


# Models
class Referral(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    referrer_id: str  # User who created the referral
    referral_code: str  # Unique referral code (e.g., TRAIN3E4EE10D)
    referred_user_id: Optional[str] = None  # User who signed up (null until conversion)
    referred_user_email: Optional[str] = None  # Email of referred user
    status: str = "pending"  # pending, converted, rewarded
    click_count: int = 0  # Number of times link was clicked
    ip_addresses: List[str] = []  # Track IPs for fraud detection
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    converted_at: Optional[datetime] = None  # When referred user signed up
    rewarded_at: Optional[datetime] = None  # When referrer received reward


class ReferralReward(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str  # User receiving the reward
    referral_id: str  # Which referral earned this reward
    discount_percentage: int = 20  # Percentage discount
    stripe_coupon_id: Optional[str] = None  # Stripe coupon ID
    stripe_promotion_code: Optional[str] = None  # User-facing code
    status: str = "pending"  # pending, applied, expired
    expires_at: Optional[datetime] = None  # When reward expires
    applied_at: Optional[datetime] = None  # When reward was used
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Routes
@router.post("/generate")
async def generate_referral_code(athlete_id: str = Query(...)):
    """Generate or retrieve referral code for an athlete"""
    try:
        # Check if athlete already has a referral code
        existing = await db.referrals.find_one({"referrer_id": athlete_id, "referred_user_id": None})
        
        if existing:
            return {
                "referral_code": existing["referral_code"],
                "referral_link": f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/?ref={existing['referral_code']}"
            }
        
        # Generate new code
        code = f"TRAIN{athlete_id[:8].upper()}"
        
        # Create referral record
        referral = Referral(
            referrer_id=athlete_id,
            referral_code=code
        )
        
        await db.referrals.insert_one(referral.dict())
        
        return {
            "referral_code": code,
            "referral_link": f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/?ref={code}"
        }
    except Exception as e:
        logging.error(f"Error generating referral code: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/track-click")
async def track_referral_click(referral_code: str = Query(...), ip_address: Optional[str] = Query(None)):
    """Track when someone clicks a referral link"""
    try:
        # Find referral by code
        referral = await db.referrals.find_one({"referral_code": referral_code, "referred_user_id": None})
        
        if not referral:
            return {"success": False, "message": "Referral code not found"}
        
        # Update click count and add IP
        update_data = {"$inc": {"click_count": 1}}
        if ip_address:
            update_data["$addToSet"] = {"ip_addresses": ip_address}
        
        await db.referrals.update_one(
            {"referral_code": referral_code, "referred_user_id": None},
            update_data
        )
        
        return {"success": True, "message": "Click tracked"}
    except Exception as e:
        logging.error(f"Error tracking click: {e}")
        return {"success": False, "message": str(e)}


@router.post("/convert")
async def convert_referral(athlete_id: str = Query(...), referral_code: Optional[str] = Query(None)):
    """Mark referral as converted when new user signs up and creates Stripe subscription"""
    try:
        if not referral_code:
            return {"success": False, "message": "No referral code provided"}
        
        # Find the referral
        referral = await db.referrals.find_one({
            "referral_code": referral_code,
            "referred_user_id": None  # Not yet converted
        })
        
        if not referral:
            return {"success": False, "message": "Referral not found or already used"}
        
        # Get athlete email
        athlete = await db.athletes.find_one({"id": athlete_id})
        if not athlete:
            return {"success": False, "message": "Athlete not found"}
        
        # Check for self-referral (fraud prevention)
        if referral["referrer_id"] == athlete_id:
            return {"success": False, "message": "Cannot refer yourself"}
        
        # Mark referral as converted
        await db.referrals.update_one(
            {"id": referral["id"]},
            {
                "$set": {
                    "referred_user_id": athlete_id,
                    "referred_user_email": athlete.get("email"),
                    "status": "converted",
                    "converted_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Create reward for referrer (20% discount)
        reward = ReferralReward(
            athlete_id=referral["referrer_id"],
            referral_id=referral["id"],
            discount_percentage=20,
            expires_at=(datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
        )
        
        await db.referral_rewards.insert_one(reward.dict())
        
        return {
            "success": True,
            "message": "Referral converted successfully",
            "reward_issued": True
        }
    except Exception as e:
        logging.error(f"Error converting referral: {e}")
        return {"success": False, "message": str(e)}


@router.get("/stats/{athlete_id}")
async def get_referral_stats(athlete_id: str):
    """Get referral statistics for an athlete"""
    try:
        # Get referrals by this athlete (limited to reasonable max)
        referrals = await db.referrals.find({"referrer_id": athlete_id}).limit(500).to_list(length=500)
        
        # Calculate stats
        total_clicks = sum(r.get("click_count", 0) for r in referrals)
        converted_referrals = [r for r in referrals if r.get("status") == "converted"]
        total_conversions = len(converted_referrals)
        conversion_rate = (total_conversions / total_clicks * 100) if total_clicks > 0 else 0
        
        # Get rewards (limited to reasonable max)
        rewards = await db.referral_rewards.find({
            "athlete_id": athlete_id,
            "status": "pending"
        }).limit(100).to_list(length=100)
        
        # Calculate total discount available (cap at 100%)
        total_discount = min(sum(r.get("discount_percentage", 0) for r in rewards), 100)
        
        # Get referral code
        referral_code = referrals[0].get("referral_code") if referrals else f"TRAIN{athlete_id[:8].upper()}"
        
        return {
            "referral_code": referral_code,
            "total_clicks": total_clicks,
            "total_conversions": total_conversions,
            "conversion_rate": round(conversion_rate, 1),
            "pending_referrals": len([r for r in referrals if r.get("status") == "pending"]),
            "total_discount_available": total_discount,
            "rewards": [
                {
                    "discount_percentage": r.get("discount_percentage", 0),
                    "expires_at": r.get("expires_at", ""),
                    "created_at": r.get("created_at", ""),
                    "status": r.get("status", "pending")
                }
                for r in rewards
            ]
        }
    except Exception as e:
        logging.error(f"Error fetching referral stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/discount/{athlete_id}")
async def get_available_discount(athlete_id: str):
    """Get total available discount for an athlete (capped at 100%)"""
    try:
        # Get all pending rewards
        rewards = await db.referral_rewards.find({
            "athlete_id": athlete_id,
            "status": "pending"
        }).limit(100).to_list(length=100)
        
        # Calculate total discount (cap at 100%)
        total_discount = min(sum(r.get("discount_percentage", 0) for r in rewards), 100)
        
        # Calculate how many rewards to apply (max 5 for 100%)
        rewards_to_apply = min(len(rewards), 5)
        
        return {
            "total_discount": total_discount,
            "rewards_count": len(rewards),
            "rewards_to_apply": rewards_to_apply,
            "capped": len(rewards) > 5
        }
    except Exception as e:
        logging.error(f"Error fetching discount: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/apply-discount")
async def apply_referral_discount(athlete_id: str = Query(...)):
    """Apply accumulated referral discounts to athlete's next payment"""
    try:
        # Get pending rewards (max 5 for 100%)
        rewards = await db.referral_rewards.find({
            "athlete_id": athlete_id,
            "status": "pending"
        }).sort("created_at", 1).limit(5).limit(100).to_list(length=100)
        
        if not rewards:
            return {"success": False, "message": "No rewards available"}
        
        # Calculate total discount (cap at 100%)
        total_discount = min(sum(r.get("discount_percentage", 0) for r in rewards), 100)
        
        # Mark rewards as applied
        reward_ids = [r["id"] for r in rewards]
        await db.referral_rewards.update_many(
            {"id": {"$in": reward_ids}},
            {
                "$set": {
                    "status": "applied",
                    "applied_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "discount_applied": total_discount,
            "rewards_used": len(rewards)
        }
    except Exception as e:
        logging.error(f"Error applying discount: {e}")
        raise HTTPException(status_code=500, detail=str(e))
