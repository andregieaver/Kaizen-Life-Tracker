"""
Files Routes
Handles file entries for athletes (documents, images, files stored as base64).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
import logging
import uuid
from datetime import datetime, timezone, date, time
from database import db
from pymongo.errors import DocumentTooLarge

router = APIRouter(prefix="/files", tags=["files"])


# Models
class FileEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    file_type: str  # document, image, file
    description: str
    file_data: str  # base64 encoded file
    file_name: str
    entry_date: str  # YYYY-MM-DD
    entry_time: str  # HH:MM
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


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
@api_router.post("/{athlete_id}")
async def create_file_entry(athlete_id: str, file_entry: FileEntry):
    """Create a new file entry"""
    try:
        # Validate file size
        if file_entry.file_data:
            base64_data = file_entry.file_data
            if ',' in base64_data:
                base64_data = base64_data.split(',')[1]
            
            estimated_size = len(base64_data) * 0.75
            max_size = 12 * 1024 * 1024
            
            if estimated_size > max_size:
                raise HTTPException(
                    status_code=400,
                    detail=f"File size too large. Maximum size is 12MB."
                )
        
        file_entry_dict = prepare_for_mongo(file_entry.model_dump())
        await db.file_entries.insert_one(file_entry_dict)
        return {"success": True, "id": file_entry.id}
        
    except HTTPException:
        raise
    except DocumentTooLarge as e:
        raise HTTPException(
            status_code=400,
            detail="File size exceeds MongoDB limit (16MB)."
        )
    except Exception as e:
        logging.error(f"Error creating file entry: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload file: {str(e)}"
        )


@api_router.get("/{athlete_id}")
async def get_file_entries(athlete_id: str):
    """Get all file entries for an athlete"""
    entries = await db.file_entries.find(
        {"athlete_id": athlete_id}, 
        {"_id": 0}
    ).sort("entry_date", -1).limit(100).to_list(length=100)
    
    # Parse dates
    for entry in entries:
        entry = parse_from_mongo(entry)
    
    return {"entries": entries}


@api_router.put("/{entry_id}")
async def update_file_entry(entry_id: str, file_entry: FileEntry):
    """Update a file entry"""
    file_entry_dict = prepare_for_mongo(file_entry.model_dump())
    result = await db.file_entries.update_one(
        {"id": entry_id},
        {"$set": file_entry_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="File entry not found")
    
    return {"success": True}


@api_router.delete("/{entry_id}")
async def delete_file_entry(entry_id: str):
    """Delete a file entry"""
    result = await db.file_entries.delete_one({"id": entry_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="File entry not found")
    
    return {"success": True}
