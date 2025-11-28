"""
Subscription Plans Routes
Handles subscription plan management with Stripe integration (admin only).
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
import logging
import os
import uuid
from datetime import datetime, timezone
from database import db
import stripe

router = APIRouter(prefix="/subscription-plans", tags=["subscription-plans"])


# Models
class SubscriptionPlanVariation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    plan_id: str  # e.g., 'pro_monthly', 'premium_annual'
    name: str  # e.g., 'Pro Monthly'
    price: float
    interval: str  # 'month' or 'year'
    interval_count: int = 1
    stripe_price_id: Optional[str] = None
    enabled: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SubscriptionPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tier: str  # 'free', 'pro', 'premium', etc.
    name: str  # Display name
    description: Optional[str] = None
    features: list = []
    stripe_product_id: Optional[str] = None
    enabled: bool = True
    sort_order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


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
@router.get("-public")
async def get_subscription_plans_public():
    """Get all active subscription plans with their variations (public endpoint)"""
    try:
        # Get all enabled plans
        plans = await db.subscription_plans.find(
            {"enabled": {"$ne": False}},
            {"_id": 0}
        ).sort("sort_order", 1).limit(100).to_list(length=100)
        
        return {"plans": plans}
    except Exception as e:
        logging.error(f"Error getting public subscription plans: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def get_subscription_plans(athlete_id: str = None):
    """Get all subscription plans and their variations"""
    try:
        # Get plans from database
        plans = await db.subscription_plans.find({"enabled": True}, {"_id": 0}).limit(50).to_list(length=50)
        
        # Sort by sort_order
        plans.sort(key=lambda x: x.get("sort_order", 0))
        
        return {"plans": plans}
    except Exception as e:
        logging.error(f"Error getting subscription plans: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quick-setup")
async def quick_setup_plans(athlete_id: str):
    """Quick setup: Create standard 3-tier plan structure with Stripe (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Initialize Stripe
        stripe_api_key = os.environ.get("STRIPE_API_KEY")
        if not stripe_api_key:
            raise HTTPException(status_code=500, detail="Stripe API key not configured")
        
        stripe.api_key = stripe_api_key
        
        # Define standard 3-tier structure
        standard_plans = [
            {
                "tier": "free",
                "name": "Free",
                "description": "Get started with basic features",
                "features": [
                    "Basic training plans",
                    "30-day history",
                    "Community access",
                    "Basic analytics"
                ],
                "sort_order": 0,
                "variations": []
            },
            {
                "tier": "pro",
                "name": "Pro",
                "description": "Advanced features for serious athletes",
                "features": [
                    "Everything in Free",
                    "Unlimited history",
                    "AI coach chat",
                    "Advanced analytics",
                    "Custom training plans",
                    "Priority support"
                ],
                "sort_order": 1,
                "variations": [
                    {"plan_id": "pro_monthly", "name": "Pro Monthly", "price": 29.99, "interval": "month"},
                    {"plan_id": "pro_annual", "name": "Pro Annual", "price": 299.99, "interval": "year"}
                ]
            },
            {
                "tier": "premium",
                "name": "Premium",
                "description": "Complete coaching experience",
                "features": [
                    "Everything in Pro",
                    "Personalized nutrition plans",
                    "1-on-1 coaching sessions",
                    "Race strategy planning",
                    "Injury prevention programs",
                    "VIP community access"
                ],
                "sort_order": 2,
                "variations": [
                    {"plan_id": "premium_monthly", "name": "Premium Monthly", "price": 99.99, "interval": "month"},
                    {"plan_id": "premium_annual", "name": "Premium Annual", "price": 999.99, "interval": "year"}
                ]
            }
        ]
        
        created_plans = []
        created_variations = []
        
        for plan_template in standard_plans:
            # Check if plan already exists
            existing = await db.subscription_plans.find_one({"tier": plan_template["tier"]}, {"_id": 0})
            
            if existing:
                logging.info(f"Plan {plan_template['tier']} already exists, skipping")
                continue
            
            # Create Stripe product
            stripe_product = stripe.Product.create(
                name=plan_template["name"],
                description=plan_template["description"],
                metadata={"tier": plan_template["tier"]}
            )
            
            # Create plan in database
            plan = SubscriptionPlan(
                tier=plan_template["tier"],
                name=plan_template["name"],
                description=plan_template["description"],
                features=plan_template["features"],
                stripe_product_id=stripe_product.id,
                sort_order=plan_template["sort_order"]
            )
            
            await db.subscription_plans.insert_one(plan.model_dump())
            created_plans.append(plan_template["tier"])
            
            # Create variations if any
            for var_template in plan_template["variations"]:
                # Create Stripe price
                stripe_price = stripe.Price.create(
                    product=stripe_product.id,
                    unit_amount=int(var_template["price"] * 100),
                    currency="usd",
                    recurring={
                        "interval": var_template["interval"],
                        "interval_count": 1
                    }
                )
                
                # Create variation in database
                variation = SubscriptionPlanVariation(
                    plan_id=var_template["plan_id"],
                    name=var_template["name"],
                    price=var_template["price"],
                    interval=var_template["interval"],
                    interval_count=1,
                    stripe_price_id=stripe_price.id
                )
                
                await db.subscription_plan_variations.insert_one(variation.model_dump())
                created_variations.append(var_template["plan_id"])
        
        logging.info(f"Quick setup completed by {athlete_id}: {len(created_plans)} plans, {len(created_variations)} variations")
        return {
            "message": "Quick setup completed",
            "created_plans": created_plans,
            "created_variations": created_variations
        }
        
    except Exception as e:
        logging.error(f"Error in quick setup: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_subscription_plan(plan_data: dict, athlete_id: str):
    """Create a new subscription plan with Stripe integration (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Initialize Stripe
        stripe_api_key = os.environ.get("STRIPE_API_KEY")
        if not stripe_api_key:
            raise HTTPException(status_code=500, detail="Stripe API key not configured")
        
        stripe.api_key = stripe_api_key
        
        # Create Stripe product
        stripe_product = stripe.Product.create(
            name=plan_data["name"],
            description=plan_data.get("description", ""),
            metadata={"tier": plan_data["tier"]}
        )
        
        # Create plan in database
        plan = SubscriptionPlan(
            tier=plan_data["tier"],
            name=plan_data["name"],
            description=plan_data.get("description"),
            features=plan_data.get("features", []),
            stripe_product_id=stripe_product.id,
            sort_order=plan_data.get("sort_order", 0)
        )
        
        await db.subscription_plans.insert_one(plan.model_dump())
        
        logging.info(f"Subscription plan created: {plan.tier} by {athlete_id}")
        return {"message": "Plan created successfully", "plan": plan.model_dump()}
        
    except Exception as e:
        logging.error(f"Error creating subscription plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{tier}")
async def update_subscription_plan(tier: str, updates: dict, athlete_id: str):
    """Update a subscription plan (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Don't allow changing tier or stripe_product_id
        if "tier" in updates:
            del updates["tier"]
        if "stripe_product_id" in updates:
            del updates["stripe_product_id"]
        
        updates["updated_at"] = datetime.now(timezone.utc)
        
        result = await db.subscription_plans.update_one(
            {"tier": tier},
            {"$set": updates}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        # If name or description updated, update in Stripe
        if any(k in updates for k in ["name", "description"]):
            plan = await db.subscription_plans.find_one({"tier": tier}, {"_id": 0})
            if plan and plan.get("stripe_product_id"):
                stripe_api_key = os.environ.get("STRIPE_API_KEY")
                if stripe_api_key:
                    stripe.api_key = stripe_api_key
                    stripe_update = {}
                    if "name" in updates:
                        stripe_update["name"] = updates["name"]
                    if "description" in updates:
                        stripe_update["description"] = updates["description"]
                    if stripe_update:
                        stripe.Product.modify(plan["stripe_product_id"], **stripe_update)
        
        logging.info(f"Subscription plan updated: {tier} by {athlete_id}")
        return {"message": "Plan updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating subscription plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{tier}")
async def delete_subscription_plan(tier: str, athlete_id: str):
    """Delete/disable a subscription plan (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Soft delete by disabling
        result = await db.subscription_plans.update_one(
            {"tier": tier},
            {"$set": {"enabled": False, "updated_at": datetime.now(timezone.utc)}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        # Also disable all variations
        await db.subscription_plan_variations.update_many(
            {"plan_id": {"$regex": f"^{tier}_"}},
            {"$set": {"enabled": False}}
        )
        
        logging.info(f"Subscription plan disabled: {tier} by {athlete_id}")
        return {"message": "Plan disabled successfully"}
        
    except Exception as e:
        logging.error(f"Error deleting subscription plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{tier}/variations")
async def create_plan_variation(tier: str, variation_data: dict, athlete_id: str):
    """Add a new pricing variation to a plan (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Get the plan
        plan = await db.subscription_plans.find_one({"tier": tier}, {"_id": 0})
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        # Initialize Stripe
        stripe_api_key = os.environ.get("STRIPE_API_KEY")
        if not stripe_api_key:
            raise HTTPException(status_code=500, detail="Stripe API key not configured")
        
        stripe.api_key = stripe_api_key
        
        # Create Stripe price
        stripe_price = stripe.Price.create(
            product=plan["stripe_product_id"],
            unit_amount=int(variation_data["price"] * 100),
            currency="usd",
            recurring={
                "interval": variation_data["interval"],
                "interval_count": variation_data.get("interval_count", 1)
            }
        )
        
        # Create variation in database
        variation = SubscriptionPlanVariation(
            plan_id=variation_data["plan_id"],
            name=variation_data["name"],
            price=variation_data["price"],
            interval=variation_data["interval"],
            interval_count=variation_data.get("interval_count", 1),
            stripe_price_id=stripe_price.id
        )
        
        await db.subscription_plan_variations.insert_one(variation.model_dump())
        
        logging.info(f"Variation created for {tier}: {variation.plan_id} by {athlete_id}")
        return {"message": "Variation created successfully", "variation": variation.model_dump()}
        
    except Exception as e:
        logging.error(f"Error creating variation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/variations/{variation_id}")
async def update_plan_variation(variation_id: str, updates: dict, athlete_id: str):
    """Update a pricing variation (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Don't allow changing stripe_price_id, price, or interval (create new variation instead)
        restricted_fields = ["stripe_price_id", "price", "interval", "interval_count"]
        for field in restricted_fields:
            if field in updates:
                del updates[field]
        
        updates["updated_at"] = datetime.now(timezone.utc)
        
        result = await db.subscription_plan_variations.update_one(
            {"id": variation_id},
            {"$set": updates}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Variation not found")
        
        logging.info(f"Variation updated: {variation_id} by {athlete_id}")
        return {"message": "Variation updated successfully"}
        
    except Exception as e:
        logging.error(f"Error updating variation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/variations/{variation_id}")
async def delete_plan_variation(variation_id: str, athlete_id: str):
    """Delete/disable a pricing variation (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        # Soft delete by disabling
        result = await db.subscription_plan_variations.update_one(
            {"id": variation_id},
            {"$set": {"enabled": False, "updated_at": datetime.now(timezone.utc)}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Variation not found")
        
        logging.info(f"Variation disabled: {variation_id} by {athlete_id}")
        return {"message": "Variation disabled successfully"}
        
    except Exception as e:
        logging.error(f"Error deleting variation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync-stripe")
async def sync_plans_from_stripe(athlete_id: str):
    """Sync plans and variations from Stripe to database (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        stripe_api_key = os.environ.get("STRIPE_API_KEY")
        if not stripe_api_key:
            raise HTTPException(status_code=500, detail="Stripe API key not configured")
        
        stripe.api_key = stripe_api_key
        
        # Fetch all products from Stripe
        products = stripe.Product.list(limit=100)
        synced_count = 0
        
        for product in products.data:
            tier = product.metadata.get("tier")
            if not tier:
                continue
            
            # Check if plan exists
            existing_plan = await db.subscription_plans.find_one({"tier": tier}, {"_id": 0})
            
            if not existing_plan:
                # Create plan
                plan = SubscriptionPlan(
                    tier=tier,
                    name=product.name,
                    description=product.description or "",
                    stripe_product_id=product.id
                )
                await db.subscription_plans.insert_one(plan.model_dump())
                synced_count += 1
        
        logging.info(f"Synced {synced_count} plans from Stripe by {athlete_id}")
        return {"message": f"Synced {synced_count} plans from Stripe"}
        
    except Exception as e:
        logging.error(f"Error syncing from Stripe: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/push-to-stripe")
async def push_plans_to_stripe(athlete_id: str):
    """Push all local plans to Stripe (Super Admin only)"""
    await verify_super_admin(athlete_id)
    
    try:
        stripe_api_key = os.environ.get("STRIPE_API_KEY")
        if not stripe_api_key:
            raise HTTPException(status_code=500, detail="Stripe API key not configured")
        
        stripe.api_key = stripe_api_key
        
        # Get all plans without Stripe IDs
        plans = await db.subscription_plans.find(
            {"stripe_product_id": {"$exists": False}},
            {"_id": 0}
        ).limit(100).to_list(length=100)
        
        pushed_count = 0
        for plan in plans:
            # Create product in Stripe
            stripe_product = stripe.Product.create(
                name=plan["name"],
                description=plan.get("description", ""),
                metadata={"tier": plan["tier"]}
            )
            
            # Update local plan
            await db.subscription_plans.update_one(
                {"tier": plan["tier"]},
                {"$set": {"stripe_product_id": stripe_product.id}}
            )
            pushed_count += 1
        
        logging.info(f"Pushed {pushed_count} plans to Stripe by {athlete_id}")
        return {"message": f"Pushed {pushed_count} plans to Stripe"}
        
    except Exception as e:
        logging.error(f"Error pushing to Stripe: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset-stripe-ids")
async def reset_stripe_ids(athlete_id: str, confirm: bool = False):
    """Reset all Stripe IDs (for development/testing only - Super Admin)"""
    await verify_super_admin(athlete_id)
    
    if not confirm:
        raise HTTPException(status_code=400, detail="Must confirm this destructive action")
    
    try:
        # Remove Stripe IDs from all plans
        await db.subscription_plans.update_many(
            {},
            {"$unset": {"stripe_product_id": ""}}
        )
        
        # Remove Stripe IDs from all variations
        await db.subscription_plan_variations.update_many(
            {},
            {"$unset": {"stripe_price_id": ""}}
        )
        
        logging.warning(f"Stripe IDs reset by {athlete_id}")
        return {"message": "Stripe IDs reset successfully"}
        
    except Exception as e:
        logging.error(f"Error resetting Stripe IDs: {e}")
        raise HTTPException(status_code=500, detail=str(e))
