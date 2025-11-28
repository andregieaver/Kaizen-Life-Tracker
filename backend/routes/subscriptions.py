from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid
import os
import stripe

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

# Initialize Stripe
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

# Models
class CheckoutRequest(BaseModel):
    plan_id: str
    origin_url: str
    athlete_id: str
    referral_code: Optional[str] = None
    coupon_code: Optional[str] = None

# Subscription routes will be added here
# This is a placeholder - routes will be migrated from server.py
