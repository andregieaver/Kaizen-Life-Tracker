"""
Athletes routes - Extracted from server.py
Handles athlete profile management including CRUD operations and image uploads
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging
import base64
import io
from PIL import Image
from passlib.context import CryptContext

# Import shared dependencies
from database import db
from utils import prepare_for_mongo, parse_from_mongo, calculate_age
from email_service import get_email_service

router = APIRouter(prefix="/athlete", tags=["athletes"])

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ============= MODELS =============

class AthleteProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    password: str
    profile_picture: Optional[str] = None
    age: Optional[int] = None
    date_of_birth: Optional[str] = None
    weekly_mileage: float = Field(default=0.0)
    recent_race_time: Optional[str] = None
    running_goals: str = Field(default="General fitness")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    nationality: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    body_fat_percentage: Optional[float] = None
    vo2_max: Optional[float] = None
    max_heart_rate: Optional[int] = None
    gender: Optional[str] = None
    bio: Optional[str] = None
    interests: Optional[list] = Field(default_factory=list)
    share_bio: bool = Field(default=True)
    share_goals: bool = Field(default=True)
    share_interests: bool = Field(default=True)
    privacy_level: str = Field(default="public")
    estimated_calorie_need: Optional[int] = None
    weight_goal: Optional[str] = None
    health_goals: Optional[list] = Field(default_factory=list)
    allergies: Optional[list] = Field(default_factory=list)
    dietary_preferences: Optional[list] = Field(default_factory=list)
    distance_unit: str = Field(default="miles")
    measurement_system: str = Field(default="imperial")
    week_starts_on: str = Field(default="monday")
    is_super_admin: bool = Field(default=False)
    timezone: str = Field(default="UTC")
    time_format: str = Field(default="12h")
    date_format: str = Field(default="MM/DD/YYYY")
    weight_unit: str = Field(default="lbs")
    fluid_unit: str = Field(default="fl oz")
    language: str = Field(default="en")
    coach_language: str = Field(default="en")
    coach_personality: Optional[str] = Field(default=None)
    voice_preference: str = Field(default="alloy")
    coach_name: str = Field(default="Coach")
    coach_avatar: Optional[str] = None
    subscription_tier: str = Field(default="free")
    subscription_status: str = Field(default="active")
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    subscription_current_period_end: Optional[datetime] = None

class AthleteUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    profile_picture: Optional[str] = None
    age: Optional[int] = None
    date_of_birth: Optional[str] = None
    weekly_mileage: Optional[float] = None
    recent_race_time: Optional[str] = None
    running_goals: Optional[str] = None
    nationality: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    body_fat_percentage: Optional[float] = None
    vo2_max: Optional[float] = None
    max_heart_rate: Optional[int] = None
    gender: Optional[str] = None
    bio: Optional[str] = None
    interests: Optional[list] = None
    share_bio: Optional[bool] = None
    share_goals: Optional[bool] = None
    share_interests: Optional[bool] = None
    privacy_level: Optional[str] = None
    estimated_calorie_need: Optional[int] = None
    weight_goal: Optional[str] = None
    health_goals: Optional[list] = None
    allergies: Optional[list] = None
    dietary_preferences: Optional[list] = None
    distance_unit: Optional[str] = None
    measurement_system: Optional[str] = None
    week_starts_on: Optional[str] = None
    timezone: Optional[str] = None
    time_format: Optional[str] = None
    date_format: Optional[str] = None
    weight_unit: Optional[str] = None
    fluid_unit: Optional[str] = None
    language: Optional[str] = None
    coach_language: Optional[str] = None
    coach_personality: Optional[str] = None
    voice_preference: Optional[str] = None

# ============= HELPER FUNCTIONS =============

async def cascade_profile_picture_update(athlete_id: str, new_profile_picture: str):
    """Update profile picture across all posts, comments, and other user content"""
    try:
        # Update community posts
        posts_result = await db.community_posts.update_many(
            {"athlete_id": athlete_id},
            {"$set": {"athlete_profile_picture": new_profile_picture}}
        )
        logging.info(f"[CASCADE] Updated profile picture in {posts_result.modified_count} community posts for athlete {athlete_id}")
        
        # Update community comments
        comments_result = await db.community_comments.update_many(
            {"athlete_id": athlete_id},
            {"$set": {"athlete_profile_picture": new_profile_picture}}
        )
        logging.info(f"[CASCADE] Updated profile picture in {comments_result.modified_count} community comments for athlete {athlete_id}")
        
        # Update group posts
        group_posts_result = await db.community_group_posts.update_many(
            {"athlete_id": athlete_id},
            {"$set": {"athlete_profile_picture": new_profile_picture}}
        )
        logging.info(f"[CASCADE] Updated profile picture in {group_posts_result.modified_count} group posts for athlete {athlete_id}")
        
        # Update challenge participations
        challenge_participations_result = await db.community_challenge_participations.update_many(
            {"athlete_id": athlete_id},
            {"$set": {"athlete_profile_picture": new_profile_picture}}
        )
        logging.info(f"[CASCADE] Updated profile picture in {challenge_participations_result.modified_count} challenge participations for athlete {athlete_id}")
        
        # Update challenge comments
        challenge_comments_result = await db.community_challenge_comments.update_many(
            {"athlete_id": athlete_id},
            {"$set": {"athlete_profile_picture": new_profile_picture}}
        )
        logging.info(f"[CASCADE] Updated profile picture in {challenge_comments_result.modified_count} challenge comments for athlete {athlete_id}")
        
        # Update challenges where user is creator
        challenges_result = await db.community_challenges.update_many(
            {"creator_id": athlete_id},
            {"$set": {"creator_profile_picture": new_profile_picture}}
        )
        logging.info(f"[CASCADE] Updated profile picture in {challenges_result.modified_count} challenges as creator for athlete {athlete_id}")
        
        total_updated = (
            posts_result.modified_count + 
            comments_result.modified_count + 
            group_posts_result.modified_count +
            challenge_participations_result.modified_count +
            challenge_comments_result.modified_count +
            challenges_result.modified_count
        )
        
        logging.info(f"[CASCADE] TOTAL: Updated profile picture in {total_updated} records across all collections for athlete {athlete_id}")
        
        return {
            "community_posts": posts_result.modified_count,
            "community_comments": comments_result.modified_count,
            "community_group_posts": group_posts_result.modified_count,
            "community_challenge_participations": challenge_participations_result.modified_count,
            "community_challenge_comments": challenge_comments_result.modified_count,
            "community_challenges": challenges_result.modified_count,
            "total": total_updated
        }
    except Exception as e:
        logging.error(f"[CASCADE] Error cascading profile picture update: {e}")
        return None

# ============= ROUTES =============

@router.post("", response_model=AthleteProfile)
async def create_athlete_profile(profile: AthleteProfile):
    """Create new athlete profile (registration)"""
    # Check if email already exists
    existing = await db.athlete_profiles.find_one({"email": profile.email.lower().strip()})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    
    # Hash the password before storing
    hashed_password = pwd_context.hash(profile.password)
    profile_dict = prepare_for_mongo(profile.model_dump())
    profile_dict["password"] = hashed_password
    
    # HARDCODE: Set andre@humanweb.no as super_admin
    if profile.email.lower().strip() == "andre@humanweb.no":
        profile_dict["role"] = "super_admin"
        logging.info(f"🔐 Super admin account created: {profile.email}")
    
    await db.athlete_profiles.insert_one(profile_dict)
    
    # Send welcome email
    email_service = get_email_service()
    if email_service.enabled:
        try:
            email_service.send_welcome_email(
                to_email=profile.email,
                user_name=profile.name
            )
            logging.info(f"Welcome email sent to {profile.email}")
        except Exception as e:
            logging.error(f"Failed to send welcome email: {e}")
            # Don't fail signup if email sending fails
    
    # Retrieve the created profile and return it properly parsed
    created_profile = await db.athlete_profiles.find_one({"id": profile.id}, {"_id": 0})
    return parse_from_mongo(created_profile)


@router.get("/{athlete_id}")
async def get_athlete_profile(athlete_id: str):
    """Get athlete profile by ID"""
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    return parse_from_mongo(athlete)


@router.put("/{athlete_id}", response_model=AthleteProfile)
async def update_athlete_profile(athlete_id: str, updates: AthleteUpdate):
    """Update athlete profile with partial data"""
    # Get current athlete - try by id first, then by email as fallback
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    if not athlete:
        # Fallback: treat athlete_id as email if id field doesn't exist
        athlete = await db.athlete_profiles.find_one({"email": athlete_id}, {"_id": 0})
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")
    
    # Log incoming data for debugging
    logging.info(f"[ATHLETE UPDATE] Updating athlete {athlete_id}")
    logging.info(f"[ATHLETE UPDATE] Raw updates: {updates.model_dump()}")
    logging.info(f"[ATHLETE UPDATE] Allergies: {updates.allergies}")
    logging.info(f"[ATHLETE UPDATE] Dietary preferences: {updates.dietary_preferences}")
    
    # Update only provided fields (include empty lists, exclude None)
    update_data = {}
    for k, v in updates.model_dump(exclude_unset=True).items():
        if v is not None or k in ['allergies', 'dietary_preferences', 'health_goals']:
            update_data[k] = v if v is not None else []
    
    logging.info(f"[ATHLETE UPDATE] Final update_data: {update_data}")
    
    # If date_of_birth is being updated, calculate and set age
    if 'date_of_birth' in update_data and update_data['date_of_birth']:
        calculated_age = calculate_age(update_data['date_of_birth'])
        if calculated_age is not None:
            update_data['age'] = calculated_age
    
    # Convert date objects to ISO strings for MongoDB storage
    if update_data:
        prepared_data = prepare_for_mongo(update_data)
        logging.info(f"[ATHLETE UPDATE] Prepared data for MongoDB: {prepared_data}")
        
        # Determine which field to use for update (id or email)
        update_filter = {"id": athlete_id} if "id" in athlete else {"email": athlete["email"]}
        
        await db.athlete_profiles.update_one(
            update_filter,
            {"$set": prepared_data}
        )
        
        # If profile picture was updated, cascade the update to all user content
        if 'profile_picture' in prepared_data:
            cascade_result = await cascade_profile_picture_update(athlete_id, prepared_data['profile_picture'])
            if cascade_result:
                logging.info(f"[PROFILE PICTURE CASCADE] Updated across collections: {cascade_result}")
    
    # Return updated athlete - use same filter
    update_filter = {"id": athlete_id} if "id" in athlete else {"email": athlete["email"]}
    updated_athlete = await db.athlete_profiles.find_one(update_filter, {"_id": 0})
    logging.info(f"[ATHLETE UPDATE] Updated allergies: {updated_athlete.get('allergies')}")
    logging.info(f"[ATHLETE UPDATE] Updated dietary_preferences: {updated_athlete.get('dietary_preferences')}")
    return parse_from_mongo(updated_athlete)


@router.post("/{athlete_id}/profile-picture")
async def upload_profile_picture(athlete_id: str, file: UploadFile = File(...)):
    """Upload and update athlete profile picture"""
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Check file size (limit to 5MB)
        file_content = await file.read()
        if len(file_content) > 5 * 1024 * 1024:  # 5MB
            raise HTTPException(status_code=400, detail="File size must be less than 5MB")
        
        # Verify athlete exists
        athlete = await db.athlete_profiles.find_one({"id": athlete_id})
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        # Process image - resize and convert to base64
        try:
            image = Image.open(io.BytesIO(file_content))
            
            # Convert to RGB if needed (for RGBA or other modes)
            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = background
            
            # Resize image to 200x200 maintaining aspect ratio
            image.thumbnail((200, 200), Image.Resampling.LANCZOS)
            
            # Create a square canvas
            canvas = Image.new('RGB', (200, 200), (255, 255, 255))
            # Center the image on the canvas
            x = (200 - image.width) // 2
            y = (200 - image.height) // 2
            canvas.paste(image, (x, y))
            
            # Convert to base64
            buffer = io.BytesIO()
            canvas.save(buffer, format='JPEG', quality=85)
            image_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
            profile_picture = f"data:image/jpeg;base64,{image_data}"
            
        except Exception as e:
            logging.error(f"Error processing image: {e}")
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Update athlete profile with new picture
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": {"profile_picture": profile_picture}}
        )
        
        # Cascade the profile picture update to all user content
        cascade_result = await cascade_profile_picture_update(athlete_id, profile_picture)
        if cascade_result:
            logging.info(f"[PROFILE PICTURE CASCADE] Updated across collections: {cascade_result}")
        
        return {"success": True, "message": "Profile picture updated successfully", "profile_picture": profile_picture}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading profile picture: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload profile picture")


@router.post("/{athlete_id}/coach-avatar")
async def upload_coach_avatar(athlete_id: str, file: UploadFile = File(...)):
    """Upload and update AI coach avatar"""
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Check file size (limit to 5MB)
        file_content = await file.read()
        if len(file_content) > 5 * 1024 * 1024:  # 5MB
            raise HTTPException(status_code=400, detail="File size must be less than 5MB")
        
        # Verify athlete exists
        athlete = await db.athlete_profiles.find_one({"id": athlete_id})
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        # Process image - resize and convert to base64
        try:
            image = Image.open(io.BytesIO(file_content))
            
            # Convert to RGB if needed
            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = background
            
            # Resize image to 200x200 maintaining aspect ratio
            image.thumbnail((200, 200), Image.Resampling.LANCZOS)
            
            # Create a square canvas
            canvas = Image.new('RGB', (200, 200), (255, 255, 255))
            x = (200 - image.width) // 2
            y = (200 - image.height) // 2
            canvas.paste(image, (x, y))
            
            # Convert to base64
            buffer = io.BytesIO()
            canvas.save(buffer, format='JPEG', quality=85)
            image_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
            coach_avatar = f"data:image/jpeg;base64,{image_data}"
            
        except Exception as e:
            logging.error(f"Error processing coach avatar: {e}")
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Update athlete profile with new coach avatar
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": {"coach_avatar": coach_avatar}}
        )
        
        return {"success": True, "message": "Coach avatar updated successfully", "coach_avatar": coach_avatar}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading coach avatar: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload coach avatar")


@router.post("/{athlete_id}/background-image")
async def upload_background_image(athlete_id: str, file: UploadFile = File(...)):
    """Upload and update custom background image"""
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Check file size (limit to 5MB)
        file_content = await file.read()
        if len(file_content) > 5 * 1024 * 1024:  # 5MB
            raise HTTPException(status_code=400, detail="File size must be less than 5MB")
        
        # Verify athlete exists
        athlete = await db.athlete_profiles.find_one({"id": athlete_id})
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
        
        # Process image - resize and convert to base64
        try:
            image = Image.open(io.BytesIO(file_content))
            
            # Convert to RGB if needed
            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = background
            
            # Resize to 1920px width (standard desktop size), maintaining aspect ratio
            max_width = 1920
            if image.width > max_width:
                ratio = max_width / image.width
                new_height = int(image.height * ratio)
                image = image.resize((max_width, new_height), Image.Resampling.LANCZOS)
            
            # Convert to base64
            buffer = io.BytesIO()
            image.save(buffer, format='JPEG', quality=85)
            image_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
            background_image = f"data:image/jpeg;base64,{image_data}"
            
        except Exception as e:
            logging.error(f"Error processing background image: {e}")
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Update athlete profile with new background image
        await db.athlete_profiles.update_one(
            {"id": athlete_id},
            {"$set": {"background_image": background_image}}
        )
        
        return {"success": True, "message": "Background image updated successfully", "background_image": background_image}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading background image: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload background image")
