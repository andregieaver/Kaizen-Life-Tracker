"""
Training Calendar Routes
Handles training blocks/calendar with integration from fitness trackers (Strava, Oura, Polar, etc.).
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
import logging
import uuid
from datetime import datetime, timezone, date, time, timedelta
import calendar as cal_module
from database import db

router = APIRouter(prefix="/training-calendar", tags=["training-calendar"])


# Models
class TrainingBlock(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    title: str
    description: Optional[str] = None
    block_type: str  # 'training' or 'recovery'
    start_date: str  # ISO date string
    end_date: str  # ISO date string
    start_time: Optional[str] = None  # HH:MM format
    end_time: Optional[str] = None
    workout_type: Optional[str] = None  # 'run', 'intervals', 'tempo', 'recovery', 'cross_training'
    distance: Optional[float] = None
    duration_minutes: Optional[int] = None
    pace_per_unit: Optional[str] = None
    intervals: Optional[int] = None
    interval_distance: Optional[float] = None
    interval_pace: Optional[str] = None
    rest_duration: Optional[int] = None
    unit_system: str = "miles"  # 'miles' or 'km'
    created_by: str = "user"
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
@router.get("/{athlete_id}")
async def get_training_blocks(athlete_id: str):
    """Get all training blocks for an athlete, including fitness tracker activities"""
    # Get manual training blocks
    blocks = await db.training_blocks.find(
        {"athlete_id": athlete_id},
        {"_id": 0}
    ).sort("start_date", 1).limit(100).to_list(length=100)
    
    parsed_blocks = [parse_from_mongo(block) for block in blocks]
    
    # Get Strava activities and convert them to training blocks
    strava_activities = await db.strava_activities.find(
        {"user_id": athlete_id},
        {"_id": 0}
    ).sort("start_date", 1).limit(100).to_list(length=100)
    
    # Convert Strava activities to training block format
    for activity in strava_activities:
        strava_block = {
            "id": f"strava_{activity.get('activity_id')}",
            "athlete_id": athlete_id,
            "title": activity.get('name', 'Strava Activity'),
            "description": f"Type: {activity.get('type')}\nFrom Strava",
            "block_type": "training",
            "workout_type": activity.get('type', '').lower(),
            "start_date": activity.get('start_date').strftime('%Y-%m-%d') if isinstance(activity.get('start_date'), datetime) else str(activity.get('start_date', ''))[:10],
            "end_date": activity.get('start_date').strftime('%Y-%m-%d') if isinstance(activity.get('start_date'), datetime) else str(activity.get('start_date', ''))[:10],
            "distance": round(activity.get('distance', 0) / 1000, 2) if activity.get('distance') else None,
            "duration_minutes": round(activity.get('moving_time', 0) / 60) if activity.get('moving_time') else None,
            "pace_per_unit": None,
            "unit_system": "km",
            "source": "strava",
            "strava_data": {
                "activity_id": activity.get('activity_id'),
                "average_heartrate": activity.get('average_heartrate'),
                "max_heartrate": activity.get('max_heartrate'),
                "total_elevation_gain": activity.get('total_elevation_gain'),
                "kudos_count": activity.get('kudos_count', 0)
            }
        }
        parsed_blocks.append(strava_block)
    
    # Get activities from other trackers (Oura, Polar, Fitbit, Garmin, COROS, WHOOP, Suunto)
    # Note: These require service classes that are instantiated in server.py
    # For simplicity, we'll fetch and convert them using basic logic here
    
    tracker_collections = [
        ("oura_activities", "oura"),
        ("polar_activities", "polar"),
        ("fitbit_activities", "fitbit"),
        ("garmin_activities", "garmin"),
        ("coros_activities", "coros"),
        ("whoop_activities", "whoop"),
        ("suunto_activities", "suunto")
    ]
    
    for collection_name, source in tracker_collections:
        try:
            activities = await db[collection_name].find(
                {"user_id": athlete_id},
                {"_id": 0}
            ).sort("start_date", 1).limit(100).to_list(length=100)
            
            for activity in activities:
                # Basic transformation
                block = {
                    "id": f"{source}_{activity.get('activity_id', activity.get('id', str(uuid.uuid4())))}",
                    "athlete_id": athlete_id,
                    "title": activity.get('name', f'{source.capitalize()} Activity'),
                    "description": f"From {source.capitalize()}",
                    "block_type": "training",
                    "workout_type": activity.get('type', 'workout').lower(),
                    "start_date": str(activity.get('start_date', ''))[:10] if activity.get('start_date') else None,
                    "end_date": str(activity.get('start_date', ''))[:10] if activity.get('start_date') else None,
                    "distance": activity.get('distance'),
                    "duration_minutes": activity.get('duration_minutes'),
                    "source": source
                }
                parsed_blocks.append(block)
        except Exception as e:
            logging.warning(f"Error fetching {source} activities: {e}")
            continue
    
    # Sort all blocks by start_date
    parsed_blocks.sort(key=lambda x: x.get('start_date', ''))
    
    return {"blocks": parsed_blocks}


@router.post("")
async def create_training_block(block: TrainingBlock):
    """Create a new training block"""
    # Get athlete's unit preference and set unit_system accordingly
    athlete = await db.athlete_profiles.find_one({"id": block.athlete_id}, {"_id": 0})
    unit_system = athlete.get("distance_unit", "miles") if athlete else "miles"
    
    # Override the unit_system with athlete's preference
    block.unit_system = unit_system
    
    block_dict = prepare_for_mongo(block.model_dump())
    await db.training_blocks.insert_one(block_dict)
    return {"success": True, "id": block.id}


@router.put("/{block_id}")
async def update_training_block(block_id: str, data: dict):
    """Update a training block"""
    # Get the existing training block to find the athlete_id
    existing_block = await db.training_blocks.find_one({"id": block_id}, {"_id": 0})
    if not existing_block:
        raise HTTPException(status_code=404, detail="Training block not found")
    
    athlete_id = existing_block.get("athlete_id")
    
    # Get athlete's unit preference if distance-related fields are being updated
    unit_system = data.get("unit_system")
    if not unit_system and any(key in data for key in ["distance", "interval_distance", "pace_per_unit", "interval_pace"]):
        athlete = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        unit_system = athlete.get("distance_unit", "miles") if athlete else "miles"
    
    update_data = {
        "title": data.get("title"),
        "description": data.get("description"),
        "block_type": data.get("block_type"),
        "start_date": data.get("start_date"),
        "end_date": data.get("end_date"),
        "workout_type": data.get("workout_type"),
        "distance": data.get("distance"),
        "duration_minutes": data.get("duration_minutes"),
        "pace_per_unit": data.get("pace_per_unit"),
        "intervals": data.get("intervals"),
        "interval_distance": data.get("interval_distance"),
        "interval_pace": data.get("interval_pace"),
        "rest_duration": data.get("rest_duration"),
        "unit_system": unit_system or existing_block.get("unit_system", "miles"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Remove None values
    update_data = {k: v for k, v in update_data.items() if v is not None}
    
    result = await db.training_blocks.update_one(
        {"id": block_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Training block not found")
    
    return {"success": True}


@router.get("/{athlete_id}/weekly-summary")
async def get_weekly_summary(athlete_id: str, year: int = Query(2025), month: int = Query(1)):
    """Get weekly training summaries for a given month"""
    # Get all days in the month
    _, num_days = cal_module.monthrange(year, month)
    month_start = datetime(year, month, 1)
    month_end = datetime(year, month, num_days)
    
    # Query all training blocks for this month
    blocks = await db.training_blocks.find(
        {
            "athlete_id": athlete_id,
            "$or": [
                {
                    "start_date": {
                        "$gte": month_start.strftime("%Y-%m-%d"),
                        "$lte": month_end.strftime("%Y-%m-%d")
                    }
                },
                {
                    "end_date": {
                        "$gte": month_start.strftime("%Y-%m-%d"),
                        "$lte": month_end.strftime("%Y-%m-%d")
                    }
                }
            ]
        },
        {"_id": 0}
    ).limit(100).to_list(length=100)
    
    # Group blocks by week
    weeks = {}
    for block in blocks:
        start_date_str = block.get("start_date")
        if not start_date_str or start_date_str == "None":
            continue
            
        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
            # Get the Monday of the week this date is in
            week_start = start_date - timedelta(days=start_date.weekday())
            week_key = week_start.strftime("%Y-%m-%d")
            
            if week_key not in weeks:
                weeks[week_key] = {
                    "week_start": week_start.strftime("%Y-%m-%d"),
                    "week_end": (week_start + timedelta(days=6)).strftime("%Y-%m-%d"),
                    "total_distance": 0,
                    "total_duration": 0,
                    "workout_count": 0,
                    "blocks": []
                }
            
            weeks[week_key]["blocks"].append(parse_from_mongo(block))
            weeks[week_key]["total_distance"] += block.get("distance", 0) or 0
            weeks[week_key]["total_duration"] += block.get("duration_minutes", 0) or 0
            if block.get("workout_type"):
                weeks[week_key]["workout_count"] += 1
        except ValueError:
            continue
    
    # Return sorted weeks
    return sorted(weeks.values(), key=lambda x: x["week_start"])


@router.delete("/{block_id}")
async def delete_training_block(block_id: str):
    """Delete a training block"""
    result = await db.training_blocks.delete_one({"id": block_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Training block not found")
    
    return {"success": True}
