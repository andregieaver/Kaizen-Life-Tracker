"""Utility functions for the application"""
from datetime import datetime, date, time, timezone
from typing import Any, Dict
import logging


def prepare_for_mongo(data: Dict[str, Any]) -> Dict[str, Any]:
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


def parse_from_mongo(item: Dict[str, Any]) -> Dict[str, Any]:
    """Parse data from MongoDB"""
    # Keep date fields as strings for JSON serialization
    if isinstance(item.get('time'), str):
        item['time'] = datetime.strptime(item['time'], '%H:%M:%S').time()
    # Handle date_of_birth conversion - keep as string for API serialization
    if isinstance(item.get('date_of_birth'), str):
        # Validate the date format but keep as string
        try:
            datetime.fromisoformat(item['date_of_birth']).date()
        except ValueError:
            # If invalid date format, remove it
            item.pop('date_of_birth', None)
    return item


def calculate_age(date_of_birth: Any) -> int | None:
    """Calculate age from date of birth (accepts string or date object)"""
    if not date_of_birth:
        return None
    
    # Convert string to date object if needed
    if isinstance(date_of_birth, str):
        try:
            date_of_birth = datetime.fromisoformat(date_of_birth).date()
        except ValueError:
            return None
    
    today = date.today()
    age = today.year - date_of_birth.year
    
    # Check if birthday has occurred this year
    # Handle leap year edge case (Feb 29 birthday in non-leap year)
    try:
        birthday_this_year = date(today.year, date_of_birth.month, date_of_birth.day)
        if today < birthday_this_year:
            age -= 1
    except ValueError:
        # This handles Feb 29 birthday in non-leap years
        # For Feb 29 birthdays, consider the birthday as Feb 28 in non-leap years
        if date_of_birth.month == 2 and date_of_birth.day == 29:
            birthday_this_year = date(today.year, 2, 28)
            if today < birthday_this_year:
                age -= 1
        else:
            # For other invalid dates, just return the calculated age
            pass
        
    return age


def apply_query_limit(limit: int | None = None, max_limit: int = 1000) -> int:
    """
    Apply safe query limits to prevent unbounded queries.
    
    Args:
        limit: Requested limit (None means use default)
        max_limit: Maximum allowed limit
    
    Returns:
        Safe limit value between 100 and max_limit
    """
    DEFAULT_QUERY_LIMIT = 100
    if limit is None:
        return DEFAULT_QUERY_LIMIT
    return min(max(1, limit), max_limit)

# Database-related utilities
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
import os

# MongoDB connection (shared across all routers)
_mongo_url = os.environ.get('MONGO_URL')
_client = None
_db = None

def get_db():
    """
    Get database connection (lazy initialization)
    
    Returns:
        MongoDB database instance
    """
    global _client, _db
    if _db is None:
        _client = AsyncIOMotorClient(_mongo_url)
        db_name = os.environ.get('DB_NAME')
        if not db_name:
            raise ValueError("DB_NAME environment variable is required")
        _db = _client[db_name]
    return _db


def get_db_client():
    """
    Get MongoDB client
    
    Returns:
        MongoDB client instance
    """
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(_mongo_url)
    return _client


async def verify_super_admin(athlete_id: str):
    """
    Verify if an athlete is a super admin
    
    Args:
        athlete_id: The ID of the athlete to verify
        
    Returns:
        The athlete profile dictionary if verified
        
    Raises:
        HTTPException: 404 if user not found, 403 if not super admin
    """
    db = get_db()
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    
    if not athlete:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check both field names for backwards compatibility
    is_admin = athlete.get("is_super_admin", False) or athlete.get("role") == "super_admin"
    
    if not is_admin:
        raise HTTPException(
            status_code=403, 
            detail="Access denied. Super admin privileges required."
        )
    
    return athlete


async def verify_athlete(athlete_id: str):
    """
    Verify if an athlete exists
    
    Args:
        athlete_id: The ID of the athlete to verify
        
    Returns:
        The athlete profile dictionary if found
        
    Raises:
        HTTPException: 404 if user not found
    """
    db = get_db()
    athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
    
    if not athlete:
        raise HTTPException(status_code=404, detail="User not found")

    return athlete


def handle_error(
    error: Exception,
    logger: logging.Logger,
    context: str,
    status_code: int = 500,
    sanitized_message: str = "An error occurred while processing your request"
) -> HTTPException:
    """
    Handle exceptions properly by logging full details and returning sanitized error to client.

    Args:
        error: The exception that was caught
        logger: Logger instance to use for logging
        context: Description of what operation failed (e.g., "saving workout data")
        status_code: HTTP status code to return (default 500)
        sanitized_message: Safe message to return to client (default generic message)

    Returns:
        HTTPException with sanitized error message

    Example:
        try:
            # some operation
        except Exception as e:
            raise handle_error(e, logger, "saving workout data", 500, "Failed to save workout")
    """
    # Log full error details for debugging (includes stack trace)
    logger.error(f"Error {context}: {str(error)}", exc_info=True)

    # Return sanitized error to client (no internal details exposed)
    return HTTPException(status_code=status_code, detail=sanitized_message)
