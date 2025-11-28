"""
Drinks/Hydration Routes
Handles drink/hydration logging for athletes.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
import logging
import uuid
from datetime import datetime, timezone, date, time
from database import db

router = APIRouter(tags=["drinks"])


# Models
class DrinkLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    drink_type: str  # 'water', 'coffee', 'tea', 'juice', 'sports_drink', 'milk', 'smoothie', 'other'
    amount_ml: int  # Amount in milliliters
    log_date: date  # Date when drink was consumed
    log_time: time  # Time when drink was consumed
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None


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


def parse_from_mongo(item):
    """Parse data from MongoDB, keeping dates as strings for JSON serialization"""
    if isinstance(item.get('time'), str):
        try:
            item['time'] = datetime.strptime(item['time'], '%H:%M:%S').time()
        except:
            pass
    return item


# Routes
@router.get("/drinks/{athlete_id}")
async def get_drink_logs(athlete_id: str, date: Optional[str] = None):
    """Get drink logs for an athlete, optionally filtered by date"""
    query = {"athlete_id": athlete_id}
    
    if date:
        # Parse date and query for that specific date
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
            query["log_date"] = target_date.isoformat()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Limit drink logs to reasonable daily max (100 drinks per day is more than enough)
    drinks = await db.drink_logs.find(query, {"_id": 0}).sort("log_time", -1).limit(100).to_list(length=100)
    
    # Parse drinks from MongoDB format
    parsed_drinks = [parse_from_mongo(drink) for drink in drinks]
    
    return {"drinks": parsed_drinks}


@router.post("/drinks/{athlete_id}")
async def create_drink_log(athlete_id: str, drink_data: dict):
    """Create a new drink log entry"""
    # Create drink log with athlete_id
    drink_log = DrinkLog(
        athlete_id=athlete_id,
        drink_type=drink_data.get("drink_type", "water"),
        amount_ml=drink_data.get("amount_ml", 250),
        log_date=datetime.strptime(drink_data.get("log_date"), "%Y-%m-%d").date(),
        log_time=datetime.strptime(drink_data.get("log_time"), "%H:%M").time(),
        notes=drink_data.get("notes", "")
    )
    
    # Prepare for MongoDB
    drink_dict = drink_log.model_dump()
    drink_dict = prepare_for_mongo(drink_dict)
    
    # Insert into database
    await db.drink_logs.insert_one(drink_dict)
    
    return {"success": True, "drink": drink_log}


@router.put("/drinks/{athlete_id}/{drink_id}")
async def update_drink_log(athlete_id: str, drink_id: str, drink_data: dict):
    """Update a drink log entry"""
    # Prepare update data
    update_data = {}
    
    if "drink_type" in drink_data:
        update_data["drink_type"] = drink_data["drink_type"]
    if "amount_ml" in drink_data:
        update_data["amount_ml"] = drink_data["amount_ml"]
    if "log_date" in drink_data:
        update_data["log_date"] = datetime.strptime(drink_data["log_date"], "%Y-%m-%d").date().isoformat()
    if "log_time" in drink_data:
        update_data["log_time"] = datetime.strptime(drink_data["log_time"], "%H:%M").time().strftime("%H:%M:%S")
    if "notes" in drink_data:
        update_data["notes"] = drink_data["notes"]
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Update in database
    result = await db.drink_logs.update_one(
        {"id": drink_id, "athlete_id": athlete_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Drink log not found")
    
    return {"success": True}


@router.delete("/{athlete_id}/{drink_id}")
async def delete_drink_log(athlete_id: str, drink_id: str):
    """Delete a drink log entry"""
    result = await db.drink_logs.delete_one({"id": drink_id, "athlete_id": athlete_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Drink log not found")
    
    return {"success": True}
