"""
Subscriptions routes - Extracted from server.py
Handles Stripe subscription management including checkout, status, cancellations, and invoices
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import logging
import os
import stripe

# Import shared dependencies
from database import db
from utils import prepare_for_mongo
from email_service import get_email_service

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

# ============= MODELS =============

class CheckoutRequest(BaseModel):
    plan_id: str
    origin_url: str
    athlete_id: str
    referral_code: Optional[str] = None
    coupon_code: Optional[str] = None

# ============= HELPER FUNCTIONS =============

async def get_stripe_api_key():
    """Get Stripe API key from system settings"""
    system_settings = await db.system_settings.find_one({}, {"_id": 0})
    if not system_settings:
        raise HTTPException(status_code=500, detail="System settings not found")
    
    stripe_settings = system_settings.get("advanced", {}).get("stripe", {})
    stripe_mode = stripe_settings.get("mode", "test")
    
    # Get the appropriate API key based on mode
    if stripe_mode == "live":
        stripe_secret_key = stripe_settings.get("live", {}).get("apiKey") or stripe_settings.get("live", {}).get("secretKey")
    else:
        stripe_secret_key = stripe_settings.get("sandbox", {}).get("apiKey") or stripe_settings.get("sandbox", {}).get("secretKey")
    
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail=f"Stripe API key not configured for {stripe_mode} mode")
    
    return stripe_secret_key

# ============= ROUTES =============

@router.post("/create-checkout-session")
async def create_checkout_session(request: CheckoutRequest, http_request: Request):
    """Create a Stripe Checkout session for subscription"""
    stripe.api_key = await get_stripe_api_key()
    
    # Fetch subscription plans from database to get synced Stripe price IDs
    all_plans = await db.subscription_plans.find({"enabled": True}, {"_id": 0}).limit(50).to_list(length=50)
    
    # Find the matching variation by plan_id
    plan = None
    stripe_price_id = None
    tier = None
    interval = None
    price = None
    
    for db_plan in all_plans:
        variations = db_plan.get("variations", [])
        for variation in variations:
            db_interval = variation.get("interval")
            variation_id_month = f"{db_plan.get('tier')}_{db_interval}"
            variation_id_ly = f"{db_plan.get('tier')}_{'monthly' if db_interval == 'month' else 'annual'}"
            
            if request.plan_id in [variation_id_month, variation_id_ly]:
                stripe_price_id = variation.get("stripe_price_id")
                tier = db_plan.get("tier")
                interval = db_interval
                price = variation.get("price")
                plan = {
                    "tier": tier,
                    "interval": interval,
                    "price": price,
                    "name": f"{db_plan.get('name', tier.capitalize())} {interval.capitalize()}"
                }
                break
        if plan:
            break
    
    if not plan:
        raise HTTPException(status_code=400, detail=f"Invalid plan ID: {request.plan_id}")
    
    if not stripe_price_id:
        raise HTTPException(status_code=500, detail=f"Stripe price ID not found for plan {request.plan_id}. Please run 'Sync to Stripe' first.")
    
    # Build success and cancel URLs
    origin_url = request.origin_url.rstrip('/')
    success_url = f"{origin_url}/dashboard/account?session_id={{CHECKOUT_SESSION_ID}}&success=true"
    cancel_url = f"{origin_url}/pricing?canceled=true"
    
    try:
        discounts_list = []
        
        # Handle referral code (new subscriber)
        if request.referral_code:
            referral_doc = await db.referrals.find_one({"referral_code": request.referral_code})
            
            if referral_doc:
                try:
                    coupon = stripe.Coupon.create(
                        percent_off=20,
                        duration="once",
                        name=f"Referral Discount - {request.referral_code}"
                    )
                    discounts_list.append({"coupon": coupon.id})
                    logging.info(f"Applied 20% referral discount for user {request.athlete_id}")
                    
                    # Mark referral as converted
                    await db.referrals.update_one(
                        {"referral_code": request.referral_code},
                        {"$set": {
                            "referred_user_id": request.athlete_id,
                            "status": "converted",
                            "converted_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    
                    # Create reward for referrer
                    referrer_id = referral_doc.get("referrer_id")
                    if referrer_id:
                        reward = {
                            "athlete_id": referrer_id,
                            "referral_code": request.referral_code,
                            "discount_percentage": 20,
                            "status": "pending",
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "expires_at": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
                        }
                        await db.referral_rewards.insert_one(reward)
                        logging.info(f"Created reward for referrer {referrer_id}")
                except Exception as e:
                    logging.error(f"Failed to apply referral discount: {e}")
        
        # Handle existing referral rewards (returning customers)
        if not request.referral_code:
            try:
                rewards = await db.referral_rewards.find({
                    "athlete_id": request.athlete_id,
                    "status": "pending"
                }).limit(100).to_list(length=100)
                
                if rewards:
                    total_discount = min(sum(r.get("discount_percentage", 0) for r in rewards[:5]), 100)
                    
                    if total_discount > 0:
                        coupon = stripe.Coupon.create(
                            percent_off=total_discount,
                            duration="once",
                            name=f"Referral Rewards - {total_discount}% off"
                        )
                        discounts_list.append({"coupon": coupon.id})
                        logging.info(f"Applied {total_discount}% rewards for user {request.athlete_id}")
                        
                        for reward in rewards[:5]:
                            await db.referral_rewards.update_one(
                                {"_id": reward["_id"]},
                                {"$set": {"status": "applied", "applied_at": datetime.now(timezone.utc).isoformat()}}
                            )
            except Exception as e:
                logging.error(f"Failed to apply rewards: {e}")
        
        # Handle custom coupon code
        if request.coupon_code:
            try:
                coupon_doc = await db.coupons.find_one({
                    "code": request.coupon_code.upper(),
                    "enabled": True
                }, {"_id": 0})
                
                if coupon_doc:
                    # Check expiration and usage
                    expired = False
                    if coupon_doc.get("expires_at"):
                        expiry = datetime.fromisoformat(coupon_doc["expires_at"]) if isinstance(coupon_doc["expires_at"], str) else coupon_doc["expires_at"]
                        if datetime.now(timezone.utc) > expiry:
                            expired = True
                    
                    usage_limit_reached = False
                    if coupon_doc.get("max_uses") is not None:
                        if coupon_doc.get("current_uses", 0) >= coupon_doc["max_uses"]:
                            usage_limit_reached = True
                    
                    if not expired and not usage_limit_reached:
                        applies_to = coupon_doc.get("applies_to", "all")
                        if applies_to in ["all", "subscriptions"]:
                            specific_plans = coupon_doc.get("specific_plans")
                            plan_valid = True
                            if specific_plans and request.plan_id not in specific_plans:
                                plan_valid = False
                            
                            if plan_valid:
                                stripe_coupon_params = {"name": coupon_doc.get("name", coupon_doc["code"])}
                                
                                if coupon_doc["type"] == "percentage":
                                    stripe_coupon_params["percent_off"] = coupon_doc["value"]
                                else:
                                    stripe_coupon_params["amount_off"] = int(coupon_doc["value"] * 100)
                                    stripe_coupon_params["currency"] = coupon_doc.get("currency", "usd")
                                
                                stripe_coupon_params["duration"] = "once"
                                
                                stripe_coupon = stripe.Coupon.create(**stripe_coupon_params)
                                discounts_list.append({"coupon": stripe_coupon.id})
                                logging.info(f"Applied coupon {request.coupon_code}")
                                
                                await db.coupons.update_one(
                                    {"code": request.coupon_code.upper()},
                                    {"$inc": {"current_uses": 1}}
                                )
            except Exception as e:
                logging.error(f"Failed to apply coupon: {e}")
        
        # Create Stripe Checkout Session
        session_params = {
            'mode': 'subscription',
            'line_items': [{'price': stripe_price_id, 'quantity': 1}],
            'success_url': success_url,
            'cancel_url': cancel_url,
            'metadata': {
                "plan_id": request.plan_id,
                "tier": plan["tier"],
                "interval": plan["interval"],
                "athlete_id": request.athlete_id,
                "coupon_code": request.coupon_code if request.coupon_code else ""
            }
        }
        
        if discounts_list:
            session_params['discounts'] = discounts_list
        
        checkout_session = stripe.checkout.Session.create(**session_params)
        
        # Create payment transaction record
        transaction = {
            "id": str(uuid.uuid4()),
            "session_id": checkout_session.id,
            "athlete_id": request.athlete_id,
            "plan_id": request.plan_id,
            "tier": plan["tier"],
            "interval": plan["interval"],
            "amount": plan["price"],
            "currency": "eur",
            "payment_status": "pending",
            "status": "initiated",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction)
        
        return {"url": checkout_session.url, "session_id": checkout_session.id}
    except Exception as e:
        logging.error(f"Error creating checkout session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")


@router.get("/checkout-status/{session_id}")
async def get_checkout_status(session_id: str):
    """Get the status of a checkout session"""
    stripe.api_key = await get_stripe_api_key()
    
    try:
        checkout_session = stripe.checkout.Session.retrieve(session_id)
        transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        
        if transaction and transaction.get("payment_status") != "paid":
            update_data = {
                "status": checkout_session.status,
                "payment_status": checkout_session.payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            # If payment succeeded, update athlete subscription
            if checkout_session.payment_status == "paid":
                athlete_id = transaction.get("athlete_id")
                if athlete_id:
                    subscription_id = checkout_session.subscription
                    period_days = 30 if transaction["interval"] == "month" else 365
                    period_end = datetime.now(timezone.utc) + timedelta(days=period_days)
                    
                    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
                    
                    await db.athlete_profiles.update_one(
                        {"id": athlete_id},
                        {"$set": {
                            "subscription_tier": transaction["tier"],
                            "subscription_status": "active",
                            "subscription_interval": transaction["interval"],
                            "stripe_customer_id": checkout_session.customer,
                            "stripe_subscription_id": subscription_id,
                            "subscription_current_period_end": period_end.isoformat()
                        }}
                    )
                    logging.info(f"Updated subscription for athlete {athlete_id} to {transaction['tier']}")
                    
                    # Send confirmation email
                    email_service = get_email_service()
                    if email_service.enabled and athlete:
                        try:
                            tier_name = transaction["tier"].capitalize()
                            interval_text = "monthly" if transaction["interval"] == "month" else "annual"
                            amount = checkout_session.amount_total / 100
                            currency = checkout_session.currency.upper()
                            
                            html_content = f"""
                            <html>
                                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                                        <h1 style="color: white; margin: 0;">Subscription Confirmed! 🎉</h1>
                                    </div>
                                    <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 10px 10px;">
                                        <p style="font-size: 16px; color: #333;">Hi {athlete.get('name', 'there')},</p>
                                        <p style="font-size: 16px; color: #333;">
                                            Thank you for subscribing to TrainSmart {tier_name}! Your subscription is now active.
                                        </p>
                                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                            <h2 style="color: #667eea; margin-top: 0;">Subscription Details</h2>
                                            <table style="width: 100%; font-size: 14px; color: #666;">
                                                <tr>
                                                    <td style="padding: 8px 0;"><strong>Plan:</strong></td>
                                                    <td style="padding: 8px 0;">{tier_name}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0;"><strong>Billing:</strong></td>
                                                    <td style="padding: 8px 0;">{interval_text.capitalize()}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0;"><strong>Amount:</strong></td>
                                                    <td style="padding: 8px 0;">{amount:.2f} {currency}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0;"><strong>Next billing date:</strong></td>
                                                    <td style="padding: 8px 0;">{period_end.strftime('%B %d, %Y')}</td>
                                                </tr>
                                            </table>
                                        </div>
                                        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                                        <p style="font-size: 12px; color: #999; text-align: center;">
                                            TrainSmart - Your Personal Fitness Companion
                                        </p>
                                    </div>
                                </body>
                            </html>
                            """
                            
                            email_service.send_email(
                                to_email=athlete.get('email'),
                                subject=f"Welcome to TrainSmart {tier_name}!",
                                html_content=html_content
                            )
                            logging.info(f"Subscription confirmation email sent")
                        except Exception as e:
                            logging.error(f"Failed to send confirmation email: {e}")
            
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": update_data}
            )
        
        return {
            "status": checkout_session.status,
            "payment_status": checkout_session.payment_status,
            "amount_total": checkout_session.amount_total,
            "currency": checkout_session.currency,
            "metadata": checkout_session.metadata
        }
    except Exception as e:
        logging.error(f"Error checking checkout status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to check status: {str(e)}")


@router.get("/status/{athlete_id}")
async def get_subscription_status(athlete_id: str):
    """Get athlete's subscription status"""
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    subscription_interval = athlete.get("subscription_interval")
    stripe_subscription_id = athlete.get("stripe_subscription_id")
    
    # Try to get interval from Stripe if not in DB
    if not subscription_interval and stripe_subscription_id and athlete.get("subscription_tier") != "free":
        try:
            stripe_secret_key = os.environ.get('STRIPE_SECRET_KEY')
            if stripe_secret_key:
                stripe.api_key = stripe_secret_key
                subscription = stripe.Subscription.retrieve(stripe_subscription_id)
                if subscription.get('items') and hasattr(subscription.get('items'), 'data'):
                    items_data = subscription['items'].data
                    if items_data and len(items_data) > 0:
                        price = items_data[0].get('price')
                        if price and price.get('recurring'):
                            subscription_interval = price['recurring'].get('interval')
                            await db.athlete_profiles.update_one(
                                {"id": athlete_id},
                                {"$set": {"subscription_interval": subscription_interval}}
                            )
        except Exception as e:
            logging.warning(f"Could not fetch subscription interval: {str(e)}")
    
    return {
        "subscription_tier": athlete.get("subscription_tier", "free"),
        "subscription_status": athlete.get("subscription_status", "active"),
        "stripe_customer_id": athlete.get("stripe_customer_id"),
        "stripe_subscription_id": stripe_subscription_id,
        "subscription_current_period_end": athlete.get("subscription_current_period_end"),
        "subscription_interval": subscription_interval
    }


@router.post("/create-portal-session")
async def create_portal_session(request: dict):
    """Create a Stripe Customer Portal session"""
    athlete_id = request.get("athlete_id")
    return_url = request.get("return_url")
    
    if not athlete_id or not return_url:
        raise HTTPException(status_code=400, detail="athlete_id and return_url are required")
    
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    stripe_customer_id = athlete.get("stripe_customer_id")
    if not stripe_customer_id:
        raise HTTPException(status_code=400, detail="No active subscription found")
    
    stripe_secret_key = os.environ.get('STRIPE_SECRET_KEY')
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = stripe_secret_key
    
    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=stripe_customer_id,
            return_url=return_url,
        )
        return {"url": portal_session.url}
    except Exception as e:
        logging.error(f"Error creating portal session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create portal session: {str(e)}")


@router.get("/invoices/{athlete_id}")
async def get_invoices(athlete_id: str):
    """Get list of invoices for an athlete"""
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    stripe_customer_id = athlete.get("stripe_customer_id")
    if not stripe_customer_id:
        return {"invoices": []}
    
    stripe_secret_key = os.environ.get('STRIPE_SECRET_KEY')
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = stripe_secret_key
    
    try:
        invoices = stripe.Invoice.list(customer=stripe_customer_id, limit=10)
        
        invoice_list = []
        for invoice in invoices.data:
            invoice_list.append({
                "id": invoice.id,
                "amount": invoice.amount_paid / 100,
                "currency": invoice.currency.upper(),
                "status": invoice.status,
                "created": invoice.created,
                "invoice_pdf": invoice.invoice_pdf,
                "hosted_invoice_url": invoice.hosted_invoice_url,
                "period_start": invoice.period_start,
                "period_end": invoice.period_end
            })
        
        return {"invoices": invoice_list}
    except Exception as e:
        logging.error(f"Error fetching invoices: {str(e)}")
        return {"invoices": []}


@router.post("/cancel")
async def cancel_subscription(request: dict):
    """Cancel a user's subscription"""
    athlete_id = request.get("athlete_id")
    if not athlete_id:
        raise HTTPException(status_code=400, detail="athlete_id is required")
    
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    stripe_subscription_id = athlete.get("stripe_subscription_id")
    if not stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription found")
    
    stripe_secret_key = os.environ.get('STRIPE_SECRET_KEY')
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = stripe_secret_key
    
    try:
        subscription = stripe.Subscription.modify(
            stripe_subscription_id,
            cancel_at_period_end=True
        )
        
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": {
                "subscription_status": "canceling",
                "subscription_cancel_at": subscription.cancel_at
            }}
        )
        
        return {
            "success": True,
            "message": "Subscription will be canceled at the end of the current billing period",
            "cancel_at": subscription.cancel_at
        }
    except Exception as e:
        logging.error(f"Error canceling subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel subscription: {str(e)}")


@router.post("/update-plan")
async def update_subscription_plan(request: dict):
    """Update (upgrade/downgrade) subscription plan"""
    athlete_id = request.get("athlete_id")
    new_plan_id = request.get("new_plan_id")
    
    if not athlete_id or not new_plan_id:
        raise HTTPException(status_code=400, detail="athlete_id and new_plan_id are required")
    
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    stripe_subscription_id = athlete.get("stripe_subscription_id")
    if not stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription found")
    
    stripe.api_key = await get_stripe_api_key()
    
    # Find new plan
    all_plans = await db.subscription_plans.find({"enabled": True}, {"_id": 0}).limit(50).to_list(length=50)
    
    new_plan = None
    new_price_id = None
    
    for db_plan in all_plans:
        variations = db_plan.get("variations", [])
        for variation in variations:
            db_interval = variation.get("interval")
            variation_id_month = f"{db_plan.get('tier')}_{db_interval}"
            variation_id_ly = f"{db_plan.get('tier')}_{'monthly' if db_interval == 'month' else 'annual'}"
            
            if new_plan_id in [variation_id_month, variation_id_ly]:
                new_price_id = variation.get("stripe_price_id")
                new_plan = {
                    "tier": db_plan.get("tier"),
                    "interval": db_interval,
                    "price": variation.get("price")
                }
                break
        if new_plan:
            break
    
    if not new_plan:
        raise HTTPException(status_code=400, detail=f"Invalid plan ID: {new_plan_id}")
    
    if not new_price_id:
        raise HTTPException(status_code=500, detail=f"Stripe price ID not found for plan {new_plan_id}")
    
    try:
        subscription = stripe.Subscription.retrieve(stripe_subscription_id)
        
        updated_subscription = stripe.Subscription.modify(
            stripe_subscription_id,
            items=[{
                'id': subscription['items']['data'][0].id,
                'price': new_price_id,
            }],
            proration_behavior='create_prorations'
        )
        
        actual_period_end = datetime.fromtimestamp(updated_subscription.current_period_end, timezone.utc)
        
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": {
                "subscription_tier": new_plan["tier"],
                "subscription_status": "active",
                "subscription_interval": new_plan["interval"],
                "subscription_current_period_end": actual_period_end.isoformat()
            }}
        )
        
        return {
            "success": True,
            "message": f"Subscription updated to {new_plan['tier']} plan",
            "new_tier": new_plan["tier"]
        }
    except Exception as e:
        logging.error(f"Error updating subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update subscription: {str(e)}")


@router.post("/downgrade-to-free")
async def downgrade_to_free(request: dict):
    """Downgrade subscription to free plan"""
    athlete_id = request.get("athlete_id")
    if not athlete_id:
        raise HTTPException(status_code=400, detail="athlete_id is required")
    
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    stripe_subscription_id = athlete.get("stripe_subscription_id")
    if not stripe_subscription_id:
        return {"success": True, "message": "Already on free plan"}
    
    stripe_secret_key = os.environ.get('STRIPE_SECRET_KEY')
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = stripe_secret_key
    
    try:
        subscription = stripe.Subscription.modify(
            stripe_subscription_id,
            cancel_at_period_end=True
        )
        
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": {"subscription_status": "canceling"}}
        )
        
        return {
            "success": True,
            "message": "You will be downgraded to free plan at the end of your current billing period",
            "downgrade_at": subscription.cancel_at
        }
    except Exception as e:
        logging.error(f"Error downgrading to free: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to downgrade: {str(e)}")


@router.post("/reactivate")
async def reactivate_subscription(request: dict):
    """Reactivate a canceled subscription"""
    athlete_id = request.get("athlete_id")
    if not athlete_id:
        raise HTTPException(status_code=400, detail="athlete_id is required")
    
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    stripe_subscription_id = athlete.get("stripe_subscription_id")
    if not stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No subscription found")
    
    stripe_secret_key = os.environ.get('STRIPE_SECRET_KEY')
    if not stripe_secret_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = stripe_secret_key
    
    try:
        subscription = stripe.Subscription.modify(
            stripe_subscription_id,
            cancel_at_period_end=False
        )
        
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": {"subscription_status": "active"}}
        )
        
        return {
            "success": True,
            "message": "Subscription reactivated successfully!"
        }
    except Exception as e:
        logging.error(f"Error reactivating subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reactivate subscription: {str(e)}")


# NOTE: Stripe webhooks endpoint remains in server.py
# Webhook handling requires special configuration and is typically kept separate
