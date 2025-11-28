"""
Documents Routes
Handles document uploads and management for athletes (medical records, test results, etc.).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
import logging
import uuid
from datetime import datetime, timezone, date, time
from database import db

router = APIRouter(tags=["documents"])


# Models
class Document(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    athlete_id: str
    title: str
    category: str  # 'medical', 'test_results', 'training_plan', 'research', 'other'
    description: Optional[str] = None
    file_data: str  # Base64 encoded document
    file_name: str
    file_type: str  # MIME type
    file_size: int  # Size in bytes
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
        except ValueError:
            pass
    return item


# Routes
@router.get("/documents/{athlete_id}")
async def get_documents(athlete_id: str, category: Optional[str] = None):
    """Get all documents for an athlete, optionally filtered by category"""
    query = {"athlete_id": athlete_id}
    if category:
        query["category"] = category
    
    documents = await db.documents.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(length=100)
    
    return {"documents": [parse_from_mongo(doc) for doc in documents]}


@router.post("/documents")
async def create_document(document: Document):
    """Create a new document"""
    try:
        # Validate file size - MongoDB has 16MB BSON limit
        # Base64 encoding increases size by ~33%, so limit original to ~12MB
        if document.file_data:
            # Estimate original file size from base64
            base64_data = document.file_data
            if ',' in base64_data:
                base64_data = base64_data.split(',')[1]
            
            # Base64 length * 0.75 = approximate original size
            estimated_size = len(base64_data) * 0.75
            max_size = 12 * 1024 * 1024  # 12MB
            
            if estimated_size > max_size:
                raise HTTPException(
                    status_code=400,
                    detail=f"File size too large. Maximum size is 12MB. Current size: {estimated_size / (1024*1024):.1f}MB"
                )
        
        document_dict = prepare_for_mongo(document.model_dump())
        await db.documents.insert_one(document_dict)
        return {"success": True, "id": document.id}
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Handle MongoDB size errors and other database errors
        error_msg = str(e)
        if 'document is too large' in error_msg.lower() or 'bson' in error_msg.lower():
            raise HTTPException(
                status_code=400,
                detail="Document size exceeds MongoDB limit (16MB). Please upload a smaller file or compress images further."
            )
        else:
            logging.error(f"Error creating document: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload document: {str(e)}"
            )


@router.put("/{document_id}")
async def update_document(document_id: str, data: dict):
    """Update a document"""
    update_data = {
        "title": data.get("title"),
        "category": data.get("category"),
        "description": data.get("description"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Remove None values
    update_data = {k: v for k, v in update_data.items() if v is not None}
    
    result = await db.documents.update_one(
        {"id": document_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"success": True}


@router.delete("/{document_id}")
async def delete_document(document_id: str):
    """Delete a document"""
    result = await db.documents.delete_one({"id": document_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"success": True}
