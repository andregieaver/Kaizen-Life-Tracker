"""
Coupons Routes
Handles coupon management for discounts (super admin only for CRUD, public for validation).
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
import logging
import uuid
from datetime import datetime, timezone, date, time
from database import db

router = APIRouter(prefix="/coupons", tags=["coupons"])


# Models
class Coupon(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str  # Coupon code (uppercase, unique)
    name: str  # Display name for admin
    type: str  # 'percentage' or 'fixed'
    value: float  # Percentage (0-100) or fixed amount
    currency: str = "usd"  # Currency for fixed amount coupons
    max_uses: Optional[int] = None  # None = unlimited
    current_uses: int = 0
    enabled: bool = True
    expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str  # Admin athlete_id
    applies_to: str = "all"  # 'subscriptions', 'one_time', or 'all'
    specific_plans: Optional[list] = None  # List of plan IDs
    min_purchase_amount: Optional[float] = None


class CouponUsage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    coupon_id: str
    coupon_code: str
    athlete_id: Optional[str] = None
    session_id: str
    discount_amount: float
    original_amount: float
    final_amount: float
    used_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


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
@router.post("")
async def create_coupon(coupon_data: dict, athlete_id: str):
    """Create a new coupon (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Normalize code to uppercase
        code = coupon_data.get("code", "").upper().strip()
        
        if not code:
            raise HTTPException(status_code=400, detail="Coupon code is required")
        
        # Check if coupon code already exists
        existing = await db.coupons.find_one({"code": code}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Coupon code already exists")
        
        # Validate required fields
        if not coupon_data.get("name"):
            raise HTTPException(status_code=400, detail="Coupon name is required")
        
        if not coupon_data.get("type") or coupon_data["type"] not in ["percentage", "fixed"]:
            raise HTTPException(status_code=400, detail="Invalid coupon type")
        
        value = coupon_data.get("value")
        if value is None:
            raise HTTPException(status_code=400, detail="Coupon value is required")
        
        # Validate coupon data
        if coupon_data["type"] == "percentage" and (value < 0 or value > 100):
            raise HTTPException(status_code=400, detail="Percentage must be between 0 and 100")
        
        if coupon_data["type"] == "fixed" and value <= 0:
            raise HTTPException(status_code=400, detail="Fixed amount must be greater than 0")
        
        # Create coupon object
        coupon = Coupon(
            code=code,
            name=coupon_data["name"],
            type=coupon_data["type"],
            value=value,
            currency=coupon_data.get("currency", "usd"),
            max_uses=coupon_data.get("max_uses"),
            enabled=coupon_data.get("enabled", True),
            expires_at=coupon_data.get("expires_at"),
            created_by=athlete_id,
            applies_to=coupon_data.get("applies_to", "all"),
            min_purchase_amount=coupon_data.get("min_purchase_amount")
        )
        
        # Insert coupon
        await db.coupons.insert_one(coupon.model_dump())
        
        logging.info(f"Coupon created: {coupon.code} by {athlete_id}")
        return {"message": "Coupon created successfully", "coupon": coupon.model_dump()}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating coupon: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_coupons(athlete_id: str, include_disabled: bool = False):
    """List all coupons (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        query = {} if include_disabled else {"enabled": True}
        coupons = await db.coupons.find(query, {"_id": 0}).limit(100).to_list(length=100)
        
        # Sort by created_at desc
        coupons.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return {"coupons": coupons}
    except Exception as e:
        logging.error(f"Error listing coupons: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{code}")
async def update_coupon(code: str, updates: dict, athlete_id: str):
    """Update a coupon (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        code = code.upper().strip()
        
        # Don't allow changing the code itself
        if "code" in updates:
            del updates["code"]
        
        # Validate updates
        if "value" in updates:
            if updates.get("type", "") == "percentage" and (updates["value"] < 0 or updates["value"] > 100):
                raise HTTPException(status_code=400, detail="Percentage must be between 0 and 100")
            if updates.get("type", "") == "fixed" and updates["value"] <= 0:
                raise HTTPException(status_code=400, detail="Fixed amount must be greater than 0")
        
        result = await db.coupons.update_one(
            {"code": code},
            {"$set": updates}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Coupon not found")
        
        logging.info(f"Coupon updated: {code} by {athlete_id}")
        return {"message": "Coupon updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating coupon: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{code}")
async def delete_coupon(code: str, athlete_id: str):
    """Delete a coupon (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        code = code.upper().strip()
        
        result = await db.coupons.delete_one({"code": code})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Coupon not found")
        
        logging.info(f"Coupon deleted: {code} by {athlete_id}")
        return {"message": "Coupon deleted successfully"}
    except Exception as e:
        logging.error(f"Error deleting coupon: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate")
async def validate_coupon(code: str, amount: float, purchase_type: str = "all", plan_id: str = None):
    """Validate a coupon code and return discount details (public endpoint)"""
    try:
        code = code.upper().strip()
        
        # Find coupon
        coupon = await db.coupons.find_one({"code": code}, {"_id": 0})
        
        if not coupon:
            raise HTTPException(status_code=404, detail="Invalid coupon code")
        
        # Check if enabled
        if not coupon.get("enabled", False):
            raise HTTPException(status_code=400, detail="This coupon is no longer valid")
        
        # Check expiration
        if coupon.get("expires_at"):
            expiry = datetime.fromisoformat(coupon["expires_at"]) if isinstance(coupon["expires_at"], str) else coupon["expires_at"]
            if datetime.now(timezone.utc) > expiry:
                raise HTTPException(status_code=400, detail="This coupon has expired")
        
        # Check usage limit
        if coupon.get("max_uses") is not None:
            if coupon.get("current_uses", 0) >= coupon["max_uses"]:
                raise HTTPException(status_code=400, detail="This coupon has reached its usage limit")
        
        # Check minimum purchase amount
        if coupon.get("min_purchase_amount") and amount < coupon["min_purchase_amount"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Minimum purchase amount of ${coupon['min_purchase_amount']:.2f} required"
            )
        
        # Check applies_to
        applies_to = coupon.get("applies_to", "all")
        if applies_to != "all" and applies_to != purchase_type:
            raise HTTPException(
                status_code=400, 
                detail=f"This coupon is only valid for {applies_to}"
            )
        
        # Check specific plans
        specific_plans = coupon.get("specific_plans")
        if specific_plans and plan_id:
            if plan_id not in specific_plans:
                raise HTTPException(
                    status_code=400,
                    detail=f"This coupon is not valid for the selected plan"
                )
        
        # Calculate discount
        if coupon["type"] == "percentage":
            discount_amount = (amount * coupon["value"]) / 100
        else:  # fixed
            discount_amount = min(coupon["value"], amount)
        
        final_amount = max(0, amount - discount_amount)
        
        return {
            "valid": True,
            "coupon": {
                "code": coupon["code"],
                "name": coupon.get("name", ""),
                "type": coupon["type"],
                "value": coupon["value"],
                "specific_plans": coupon.get("specific_plans")
            },
            "original_amount": amount,
            "discount_amount": round(discount_amount, 2),
            "final_amount": round(final_amount, 2)
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error validating coupon: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{code}/usage")
async def get_coupon_usage(code: str, athlete_id: str):
    """Get usage statistics for a specific coupon (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        code = code.upper().strip()
        
        # Get coupon
        coupon = await db.coupons.find_one({"code": code}, {"_id": 0})
        if not coupon:
            raise HTTPException(status_code=404, detail="Coupon not found")
        
        # Get usage records
        usage_records = await db.coupon_usage.find(
            {"coupon_code": code}, 
            {"_id": 0}
        ).limit(100).to_list(length=100)
        
        # Calculate stats
        total_uses = len(usage_records)
        total_discount_given = sum(r.get("discount_amount", 0) for r in usage_records)
        total_revenue = sum(r.get("final_amount", 0) for r in usage_records)
        
        return {
            "coupon": coupon,
            "usage": {
                "total_uses": total_uses,
                "max_uses": coupon.get("max_uses"),
                "total_discount_given": round(total_discount_given, 2),
                "total_revenue": round(total_revenue, 2)
            },
            "recent_usage": usage_records[:10]
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching coupon usage: {e}")
        raise HTTPException(status_code=500, detail=str(e))
