"""
CRM (Customer Relationship Management) Routes
Handles admin operations for managing users, orders, subscriptions, and refunds.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List
import logging
from datetime import datetime, timezone
from database import db
import stripe

router = APIRouter(prefix="/crm", tags=["crm"])


async def verify_super_admin(athlete_id: str):
    """Verify if athlete is super admin"""
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="User not found")
    # Check both field names for backwards compatibility
    is_admin = athlete.get("is_super_admin", False) or athlete.get("role") == "super_admin"
    if not is_admin:
        raise HTTPException(status_code=403, detail="Access denied. Super admin privileges required.")
    return athlete


@router.get("/users")
async def get_all_users(athlete_id: str):
    """Get all users for CRM (Super Admin only)"""
    # Verify super admin
    await verify_super_admin(athlete_id)
    
    try:
        # Fetch all athlete profiles with required data
        users = await db.athlete_profiles.find(
            {},
            {
                "_id": 0,
                "id": 1,
                "name": 1,
                "email": 1,
                "profile_picture": 1,
                "subscription_tier": 1,
                "subscription_interval": 1,
                "nationality": 1,
                "created_at": 1,
                "date_of_birth": 1,
                "gender": 1
            }
        ).limit(100).to_list(length=100)
        
        # Format the data for CRM
        formatted_users = []
        for user in users:
            formatted_users.append({
                "id": user.get("id", ""),
                "name": user.get("name", "Unknown"),
                "email": user.get("email", ""),
                "profile_picture": user.get("profile_picture", ""),
                "subscription_tier": user.get("subscription_tier", "free"),
                "subscription_interval": user.get("subscription_interval", ""),
                "nationality": user.get("nationality", ""),
                "created_at": user.get("created_at", ""),
                "date_of_birth": user.get("date_of_birth", ""),
                "gender": user.get("gender", "")
            })
        
        return {"users": formatted_users, "total": len(formatted_users)}
    except Exception as e:
        logging.error(f"Error fetching CRM users: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")


@router.get("/users/{user_id}")
async def get_user_profile(user_id: str, athlete_id: str):
    """Get detailed user profile for CRM (Super Admin only)"""
    # Verify super admin
    await verify_super_admin(athlete_id)
    
    try:
        # 1. Fetch user profile
        user = await db.athlete_profiles.find_one(
            {"id": user_id},
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # 2. Calculate lifetime value from payment transactions
        transactions = await db.payment_transactions.find(
            {"athlete_id": user_id, "payment_status": "paid"},
            {"_id": 0, "amount": 1}
        ).limit(100).to_list(length=100)
        
        lifetime_value = sum([t.get("amount", 0) for t in transactions])
        
        # 3. Get community stats
        posts_count = await db.community_posts.count_documents({"athlete_id": user_id})
        comments_count = await db.community_comments.count_documents({"athlete_id": user_id})
        events_count = await db.community_events.count_documents({"creator_id": user_id})
        # Challenges - check if collection exists, default to 0 for now
        try:
            challenges_count = await db.challenges.count_documents({"athlete_id": user_id})
        except:
            challenges_count = 0
        
        # 4. Get referral stats
        # Count referrals where this user is the referrer
        referrals = await db.referrals.find(
            {"referrer_athlete_id": user_id},
            {"_id": 0, "referred_athlete_id": 1}
        ).limit(100).to_list(length=100)
        
        referrals_count = len(referrals)
        
        # Calculate kickback and generated revenue
        kickback = 0
        generated_revenue = 0
        
        for referral in referrals:
            referred_user_id = referral.get("referred_athlete_id")
            if referred_user_id:
                # Get all payments made by referred user
                referred_payments = await db.payment_transactions.find(
                    {"athlete_id": referred_user_id, "payment_status": "paid"},
                    {"_id": 0, "amount": 1}
                ).limit(100).to_list(length=100)
                
                referred_total = sum([p.get("amount", 0) for p in referred_payments])
                generated_revenue += referred_total
                
                # Calculate kickback (assuming 20% kickback rate)
                kickback += referred_total * 0.20
        
        # 5. Get interaction timeline (placeholder for now)
        interactions = []
        
        # Add payment transactions as interactions
        payment_interactions = await db.payment_transactions.find(
            {"athlete_id": user_id, "payment_status": "paid"},
            {"_id": 0, "tier": 1, "interval": 1, "created_at": 1, "updated_at": 1}
        ).limit(100).to_list(length=100)
        
        for payment in payment_interactions:
            interactions.append({
                "type": "subscription_payment",
                "description": f"Subscribed to {payment.get('tier', 'plan').capitalize()} ({payment.get('interval', 'monthly')})",
                "timestamp": payment.get("updated_at") or payment.get("created_at", "")
            })
        
        # Sort interactions by timestamp (newest first)
        interactions.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        # 6. Format response
        profile_data = {
            "id": user.get("id", ""),
            "name": user.get("name", "Unknown"),
            "email": user.get("email", ""),
            "profile_picture": user.get("profile_picture", ""),
            "nationality": user.get("nationality", ""),
            "subscription_tier": user.get("subscription_tier", "free"),
            "subscription_interval": user.get("subscription_interval", ""),
            "subscription_current_period_end": user.get("subscription_current_period_end", ""),
            "created_at": user.get("created_at", ""),
            "lifetime_value": lifetime_value,
            "community_stats": {
                "posts_added": posts_count,
                "comments_created": comments_count,
                "events_created": events_count,
                "challenges_done": challenges_count
            },
            "referral_stats": {
                "referrals_count": referrals_count,
                "kickback": kickback,
                "generated_revenue": generated_revenue
            },
            "interactions": interactions[:20]  # Limit to 20 most recent interactions
        }
        
        return profile_data
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching user profile: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch user profile: {str(e)}")


@router.get("/orders")
async def get_all_orders(athlete_id: str):
    """Get all Stripe orders/transactions (Super Admin only)"""
    # Verify super admin
    await verify_super_admin(athlete_id)
    
    try:
        # Fetch all transactions from the database, only where payment_status is "paid"
        transactions = await db.payment_transactions.find(
            {"payment_status": "paid"},
            {
                "_id": 0,
                "id": 1,
                "session_id": 1,
                "athlete_id": 1,
                "tier": 1,
                "interval": 1,
                "amount": 1,
                "currency": 1,
                "payment_status": 1,
                "status": 1,
                "created_at": 1,
                "updated_at": 1
            }
        ).limit(100).to_list(length=100)
        
        # Get athlete names for each transaction and determine if renewal
        formatted_orders = []
        for transaction in transactions:
            athlete_id_val = transaction.get("athlete_id", "")
            
            # Fetch athlete name and profile
            athlete = await db.athlete_profiles.find_one(
                {"id": athlete_id_val},
                {"_id": 0, "name": 1, "email": 1, "created_at": 1}
            )
            
            # Determine if this is a renewal based on subscription history
            # Check if athlete has other completed transactions before this one
            athlete_transactions = await db.payment_transactions.count_documents({
                "athlete_id": athlete_id_val,
                "payment_status": "paid",
                "tier": transaction.get("tier"),
                "created_at": {"$lt": transaction.get("created_at", "")}
            })
            
            is_renewal = athlete_transactions > 0
            
            # Use created_at or updated_at for order date
            order_date = transaction.get("updated_at") or transaction.get("created_at", "")
            
            formatted_orders.append({
                "order_id": transaction.get("id", ""),
                "stripe_session_id": transaction.get("session_id", ""),
                "athlete_id": athlete_id_val,
                "athlete_name": athlete.get("name", "Unknown") if athlete else "Unknown",
                "athlete_email": athlete.get("email", "") if athlete else "",
                "plan": transaction.get("tier", ""),
                "interval": transaction.get("interval", ""),
                "amount": transaction.get("amount", 0),  # Keep amount as is (already in correct format)
                "currency": transaction.get("currency", "EUR").upper(),
                "payment_status": transaction.get("payment_status", ""),
                "status": transaction.get("status", ""),
                "order_date": order_date,
                "is_renewal": is_renewal
            })
        
        # Sort by date, newest first
        formatted_orders.sort(key=lambda x: x.get("order_date", ""), reverse=True)
        
        return {"orders": formatted_orders, "total": len(formatted_orders)}
    except Exception as e:
        logging.error(f"Error fetching orders: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch orders: {str(e)}")


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, athlete_id: str = Query(...)):
    """Delete a user and all their data (Super Admin only)"""
    try:
        # Verify super admin
        await verify_super_admin(athlete_id)
        
        # Check if user exists
        user = await db.athlete_profiles.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Delete all user data across collections
        
        # 1. Delete athlete profile
        await db.athlete_profiles.delete_one({"id": user_id})
        
        # 2. Delete community posts
        await db.community_posts.delete_many({"athlete_id": user_id})
        
        # 3. Delete community comments
        await db.community_comments.delete_many({"athlete_id": user_id})
        
        # 4. Delete likes
        await db.community_likes.delete_many({"athlete_id": user_id})
        
        # 5. Delete shares
        await db.community_shares.delete_many({"athlete_id": user_id})
        
        # 6. Delete follows (as follower and following)
        await db.community_follows.delete_many({"follower_id": user_id})
        await db.community_follows.delete_many({"following_id": user_id})
        
        # 7. Delete notifications
        await db.community_notifications.delete_many({"athlete_id": user_id})
        await db.community_notifications.delete_many({"from_athlete_id": user_id})
        
        # 8. Delete group memberships
        await db.community_group_memberships.delete_many({"athlete_id": user_id})
        
        # 9. Delete groups created by user
        await db.community_groups.delete_many({"creator_id": user_id})
        
        # 10. Delete group posts
        await db.community_group_posts.delete_many({"athlete_id": user_id})
        
        # 11. Delete events
        await db.community_events.delete_many({"creator_id": user_id})
        await db.community_event_attendance.delete_many({"athlete_id": user_id})
        await db.community_event_comments.delete_many({"athlete_id": user_id})
        
        # 12. Delete challenges
        await db.community_challenges.delete_many({"creator_id": user_id})
        await db.community_challenge_participants.delete_many({"athlete_id": user_id})
        await db.community_challenge_comments.delete_many({"athlete_id": user_id})
        
        # 13. Delete journal entries
        await db.journal_entries.delete_many({"athlete_id": user_id})
        
        # 14. Delete workouts
        await db.workouts.delete_many({"athlete_id": user_id})
        
        # 15. Delete nutrition logs
        await db.nutrition_logs.delete_many({"athlete_id": user_id})
        
        # 16. Delete supplement logs
        await db.supplement_logs.delete_many({"athlete_id": user_id})
        
        # 17. Delete drink logs
        await db.drink_logs.delete_many({"athlete_id": user_id})
        
        # 18. Delete habits
        await db.habits.delete_many({"athlete_id": user_id})
        
        # 19. Delete payment transactions
        await db.payment_transactions.delete_many({"athlete_id": user_id})
        
        # 20. Delete referrals
        await db.referrals.delete_many({"referrer_id": user_id})
        await db.referrals.delete_many({"referred_id": user_id})
        
        return {"success": True, "message": "User deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orders/{order_id}")
async def get_order_details(order_id: str, athlete_id: str):
    """Get detailed information for a specific order (Super Admin only)"""
    # Verify super admin
    await verify_super_admin(athlete_id)
    
    try:
        # Fetch the specific order
        transaction = await db.payment_transactions.find_one(
            {"id": order_id},
            {"_id": 0}
        )
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Order not found")
        
        athlete_id_val = transaction.get("athlete_id", "")
        
        # Fetch athlete information
        athlete = await db.athlete_profiles.find_one(
            {"id": athlete_id_val},
            {"_id": 0, "name": 1, "email": 1}
        )
        
        # Check if renewal
        athlete_transactions_before = await db.payment_transactions.count_documents({
            "athlete_id": athlete_id_val,
            "payment_status": "paid",
            "tier": transaction.get("tier"),
            "created_at": {"$lt": transaction.get("created_at", "")}
        })
        
        is_renewal = athlete_transactions_before > 0
        
        # Fetch all orders for this customer
        customer_orders = await db.payment_transactions.find(
            {"athlete_id": athlete_id_val},
            {"_id": 0, "id": 1, "tier": 1, "interval": 1, "amount": 1, "currency": 1, "payment_status": 1, "created_at": 1, "updated_at": 1}
        ).sort("created_at", -1).limit(100).to_list(length=100)
        
        # Format order history
        order_history = []
        for order in customer_orders:
            # Check if this order is a renewal
            prev_orders = await db.payment_transactions.count_documents({
                "athlete_id": athlete_id_val,
                "payment_status": "paid",
                "tier": order.get("tier"),
                "created_at": {"$lt": order.get("created_at", "")}
            })
            
            order_history.append({
                "order_id": order.get("id", ""),
                "plan": order.get("tier", ""),
                "interval": order.get("interval", ""),
                "amount": order.get("amount", 0),
                "currency": order.get("currency", "EUR").upper(),
                "payment_status": order.get("payment_status", ""),
                "order_date": order.get("updated_at") or order.get("created_at", ""),
                "is_renewal": prev_orders > 0
            })
        
        # Format order details
        order_data = {
            "order_id": transaction.get("id", ""),
            "stripe_session_id": transaction.get("session_id", ""),
            "athlete_id": athlete_id_val,
            "athlete_name": athlete.get("name", "Unknown") if athlete else "Unknown",
            "athlete_email": athlete.get("email", "") if athlete else "",
            "plan": transaction.get("tier", ""),
            "interval": transaction.get("interval", ""),
            "amount": transaction.get("amount", 0),
            "currency": transaction.get("currency", "EUR").upper(),
            "payment_status": transaction.get("payment_status", ""),
            "status": transaction.get("status", ""),
            "order_date": transaction.get("updated_at") or transaction.get("created_at", ""),
            "is_renewal": is_renewal
        }
        
        return {
            "order": order_data,
            "order_history": order_history
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching order details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch order details: {str(e)}")


@router.post("/orders/{order_id}/refund")
async def refund_order(order_id: str, athlete_id: str, amount: float, type: str):
    """Process a refund for an order (Super Admin only)"""
    # Verify super admin
    await verify_super_admin(athlete_id)
    
    try:
        # Fetch the order
        transaction = await db.payment_transactions.find_one({"id": order_id})
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Order not found")
        
        if transaction.get("payment_status") != "paid":
            raise HTTPException(status_code=400, detail="Only paid orders can be refunded")
        
        # Validate refund amount
        order_amount = transaction.get("amount", 0)
        if amount > order_amount:
            raise HTTPException(status_code=400, detail="Refund amount cannot exceed order amount")
        
        # Get Stripe settings
        system_settings = await db.system_settings.find_one({}, {"_id": 0})
        stripe_settings = system_settings.get("stripe", {}).get("live", {}) if system_settings else {}
        stripe_api_key = stripe_settings.get("secretKey")
        
        if not stripe_api_key:
            raise HTTPException(status_code=500, detail="Stripe API key not configured")
        
        stripe.api_key = stripe_api_key
        
        # Process the refund through Stripe
        session_id = transaction.get("session_id")
        if not session_id:
            raise HTTPException(status_code=400, detail="No Stripe session ID found for this order")
        
        # Get the payment intent from the session
        session = stripe.checkout.Session.retrieve(session_id)
        payment_intent_id = session.payment_intent
        
        if not payment_intent_id:
            raise HTTPException(status_code=400, detail="No payment intent found for this order")
        
        # Create the refund
        refund_amount_cents = int(amount * 100)  # Convert to cents
        refund = stripe.Refund.create(
            payment_intent=payment_intent_id,
            amount=refund_amount_cents if type == 'partial' else None  # None means full refund
        )
        
        # Update the transaction in database
        new_status = "refunded" if type == 'full' or amount == order_amount else "partially_refunded"
        await db.payment_transactions.update_one(
            {"id": order_id},
            {
                "$set": {
                    "payment_status": new_status,
                    "refund_id": refund.id,
                    "refund_amount": amount,
                    "refund_type": type,
                    "refunded_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "message": f"Refund of {amount} {transaction.get('currency', 'EUR')} processed successfully",
            "refund_id": refund.id,
            "new_status": new_status
        }
    except stripe.error.StripeError as e:
        logging.error(f"Stripe refund error: {e}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error processing refund: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process refund: {str(e)}")


@router.get("/subscriptions")
async def get_all_subscriptions(athlete_id: str):
    """Get all active subscriptions (Super Admin only)"""
    # Verify super admin
    await verify_super_admin(athlete_id)
    
    try:
        # Fetch all users with subscription information
        users = await db.athlete_profiles.find(
            {},
            {
                "_id": 0,
                "id": 1,
                "name": 1,
                "email": 1,
                "subscription_tier": 1,
                "subscription_interval": 1,
                "subscription_status": 1,
                "subscription_current_period_start": 1,
                "subscription_current_period_end": 1,
                "subscription_cancel_at": 1,
                "created_at": 1,
                "stripe_customer_id": 1,
                "stripe_subscription_id": 1
            }
        ).limit(100).to_list(length=100)
        
        subscriptions = []
        for user in users:
            user_id = user.get("id", "")
            
            # Calculate lifetime value from all paid transactions
            transactions = await db.payment_transactions.find(
                {"athlete_id": user_id, "payment_status": "paid"},
                {"_id": 0, "amount": 1}
            ).limit(100).to_list(length=100)
            
            lifetime_value = sum([t.get("amount", 0) for t in transactions])
            
            # Determine subscription status
            subscription_tier = user.get("subscription_tier", "free")
            subscription_status = user.get("subscription_status", "inactive")
            
            # Skip users with no active subscription (free tier)
            if subscription_tier == "free" and subscription_status == "inactive":
                continue
            
            # Calculate next renewal date
            current_period_end = user.get("subscription_current_period_end", "")
            cancel_at = user.get("subscription_cancel_at", "")
            
            # Determine if subscription is ongoing or will be cancelled
            end_date = cancel_at if cancel_at else current_period_end
            next_renewal = current_period_end if subscription_status == "active" and not cancel_at else None
            
            subscriptions.append({
                "user_id": user_id,
                "customer_name": user.get("name", "Unknown"),
                "customer_email": user.get("email", ""),
                "plan": subscription_tier,
                "interval": user.get("subscription_interval", ""),
                "status": subscription_status,
                "start_date": user.get("subscription_current_period_start", "") or user.get("created_at", ""),
                "end_date": end_date,
                "next_renewal": next_renewal,
                "lifetime_value": lifetime_value,
                "is_cancelled": bool(cancel_at),
                "stripe_customer_id": user.get("stripe_customer_id", ""),
                "stripe_subscription_id": user.get("stripe_subscription_id", "")
            })
        
        # Sort by start date, newest first
        subscriptions.sort(key=lambda x: x.get("start_date", ""), reverse=True)
        
        return {"subscriptions": subscriptions, "total": len(subscriptions)}
    except Exception as e:
        logging.error(f"Error fetching subscriptions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch subscriptions: {str(e)}")
