"""
Messages Routes
Handles direct messaging between users with privacy controls and conversation management.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
import logging
import uuid
from datetime import datetime, timezone, date, time
from database import db

router = APIRouter(prefix="/messages", tags=["messages"])


# Models
class SendMessageRequest(BaseModel):
    sender_id: str
    receiver_id: str
    content: str
    youtube_data: Optional[dict] = None
    url_preview: Optional[dict] = None


class MessageRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    requester_id: str  # ID of user requesting to message
    target_id: str  # ID of user being messaged
    status: str = "pending"  # 'pending', 'accepted', 'declined'
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


# Routes
@router.post("/request")
async def request_message_permission(requester_id: str = Query(...), target_id: str = Query(...)):
    """Request permission to message a guarded user"""
    try:
        # Check target user's privacy level
        target = await db.athlete_profiles.find_one({"id": target_id}, {"_id": 0})
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        
        privacy_level = target.get("privacy_level", "public")
        if privacy_level != "guarded":
            return {"success": True, "message": "No request needed"}
        
        # Check if request already exists
        existing_request = await db.message_requests.find_one({
            "requester_id": requester_id,
            "target_id": target_id,
            "status": "pending"
        })
        
        if existing_request:
            return {"success": True, "request_sent": True, "message": "Request already sent"}
        
        # Create message request
        requester = await db.athlete_profiles.find_one({"id": requester_id}, {"_id": 0})
        request = {
            "id": str(uuid.uuid4()),
            "requester_id": requester_id,
            "target_id": target_id,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.message_requests.insert_one(prepare_for_mongo(request.copy()))
        
        # Create notification
        notification = {
            "id": str(uuid.uuid4()),
            "athlete_id": target_id,
            "type": "message_request",
            "content": f"{requester.get('name', 'Someone')} requested to message you",
            "from_athlete_id": requester_id,
            "from_athlete_name": requester.get("name", "Unknown"),
            "from_athlete_profile_picture": requester.get("profile_picture"),
            "action_id": request["id"],
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.community_notifications.insert_one(prepare_for_mongo(notification.copy()))
        
        return {"success": True, "request_sent": True}
    except Exception as e:
        logging.error(f"Error requesting message permission: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/request/{request_id}/accept")
async def accept_message_request(request_id: str, athlete_id: str = Query(...)):
    """Accept a message request"""
    try:
        # Get the request
        request = await db.message_requests.find_one({"id": request_id, "target_id": athlete_id, "status": "pending"})
        if not request:
            # Check if already accepted
            existing_request = await db.message_requests.find_one({"id": request_id, "target_id": athlete_id})
            if existing_request and existing_request.get("status") == "accepted":
                return {"success": True, "message": "Message request already accepted", "already_accepted": True}
            raise HTTPException(status_code=404, detail="Request not found")
        
        # Update request status
        await db.message_requests.update_one(
            {"id": request_id},
            {"$set": {"status": "accepted", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Update the original notification
        await db.community_notifications.update_one(
            {"action_id": request_id},
            {"$set": {"read": True}}
        )
        
        # Create notification for requester
        target = await db.athlete_profiles.find_one({"id": athlete_id}, {"_id": 0})
        notification = {
            "id": str(uuid.uuid4()),
            "athlete_id": request["requester_id"],
            "type": "message_request_accepted",
            "content": f"{target.get('name', 'Someone')} accepted your message request",
            "from_athlete_id": athlete_id,
            "from_athlete_name": target.get("name", "Unknown"),
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.community_notifications.insert_one(prepare_for_mongo(notification.copy()))
        
        return {"success": True, "message": "Message request accepted"}
    except Exception as e:
        logging.error(f"Error accepting message request: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/request/{request_id}/decline")
async def decline_message_request(request_id: str, athlete_id: str = Query(...)):
    """Decline a message request"""
    try:
        # Get the request
        request = await db.message_requests.find_one({"id": request_id, "target_id": athlete_id, "status": "pending"})
        if not request:
            # Check if already declined or accepted
            existing_request = await db.message_requests.find_one({"id": request_id, "target_id": athlete_id})
            if existing_request:
                status = existing_request.get("status")
                if status == "declined":
                    return {"success": True, "message": "Message request already declined", "already_declined": True}
                elif status == "accepted":
                    return {"success": False, "message": "Cannot decline an already accepted request", "already_accepted": True}
            raise HTTPException(status_code=404, detail="Request not found")
        
        # Update request status
        await db.message_requests.update_one(
            {"id": request_id},
            {"$set": {"status": "declined", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Update the original notification
        await db.community_notifications.update_one(
            {"action_id": request_id},
            {"$set": {"read": True}}
        )
        
        return {"success": True, "message": "Message request declined"}
    except Exception as e:
        logging.error(f"Error declining message request: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send")
async def send_message(message_data: SendMessageRequest):
    """Send a direct message to another user (respects privacy settings)"""
    try:
        # Check receiver's privacy level
        receiver = await db.athlete_profiles.find_one({"id": message_data.receiver_id}, {"_id": 0})
        if not receiver:
            raise HTTPException(status_code=404, detail="User not found")
        
        privacy_level = receiver.get("privacy_level", "public")
        
        # Check if messaging is allowed
        if privacy_level == "private":
            raise HTTPException(status_code=403, detail="This user does not accept messages")
        
        elif privacy_level == "guarded":
            # Check if there's an accepted message request
            approved_request = await db.message_requests.find_one({
                "requester_id": message_data.sender_id,
                "target_id": message_data.receiver_id,
                "status": "accepted"
            })
            
            if not approved_request:
                raise HTTPException(status_code=403, detail="Message request required and not yet approved")
        
        # Proceed with sending message
        # Find or create conversation
        conversation = await db.conversations.find_one({
            "$or": [
                {"participant_1_id": message_data.sender_id, "participant_2_id": message_data.receiver_id},
                {"participant_1_id": message_data.receiver_id, "participant_2_id": message_data.sender_id}
            ]
        })
        
        if not conversation:
            # Create new conversation
            conversation_id = str(uuid.uuid4())
            conversation = {
                "id": conversation_id,
                "participant_1_id": message_data.sender_id,
                "participant_2_id": message_data.receiver_id,
                "participant_1_deleted": False,
                "participant_2_deleted": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "last_message_at": datetime.now(timezone.utc).isoformat(),
                "last_message_preview": message_data.content[:50],
                "unread_count_1": 0,
                "unread_count_2": 1
            }
            await db.conversations.insert_one(conversation)
        else:
            conversation_id = conversation["id"]
            # Update conversation
            is_participant_1 = conversation["participant_1_id"] == message_data.sender_id
            update_fields = {
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "last_message_at": datetime.now(timezone.utc).isoformat(),
                "last_message_preview": message_data.content[:50]
            }
            
            # Increment unread count for receiver
            if is_participant_1:
                update_fields["unread_count_2"] = conversation.get("unread_count_2", 0) + 1
                # Restore conversation for both if deleted
                if conversation.get("participant_1_deleted") or conversation.get("participant_2_deleted"):
                    update_fields["participant_1_deleted"] = False
                    update_fields["participant_2_deleted"] = False
            else:
                update_fields["unread_count_1"] = conversation.get("unread_count_1", 0) + 1
                if conversation.get("participant_1_deleted") or conversation.get("participant_2_deleted"):
                    update_fields["participant_1_deleted"] = False
                    update_fields["participant_2_deleted"] = False
            
            await db.conversations.update_one(
                {"id": conversation_id},
                {"$set": update_fields}
            )
        
        # Create message
        message_id = str(uuid.uuid4())
        message = {
            "id": message_id,
            "conversation_id": conversation_id,
            "sender_id": message_data.sender_id,
            "receiver_id": message_data.receiver_id,
            "content": message_data.content,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by_sender": False,
            "deleted_by_receiver": False,
            "youtube_data": message_data.youtube_data if hasattr(message_data, 'youtube_data') else None,
            "url_preview": message_data.url_preview if hasattr(message_data, 'url_preview') else None
        }
        await db.messages.insert_one(message)
        
        return {
            "success": True,
            "message_id": message_id,
            "conversation_id": conversation_id
        }
        
    except Exception as e:
        logging.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations")
async def get_conversations(athlete_id: str = Query(...)):
    """Get all conversations for a user"""
    try:
        conversations = await db.conversations.find({
            "$or": [
                {"participant_1_id": athlete_id, "participant_1_deleted": False},
                {"participant_2_id": athlete_id, "participant_2_deleted": False}
            ]
        }).sort("last_message_at", -1).to_list(length=100)
        
        # Enrich with participant info
        result = []
        for conv in conversations:
            # Determine other participant
            other_id = conv["participant_2_id"] if conv["participant_1_id"] == athlete_id else conv["participant_1_id"]
            
            # Get other participant info
            other_user = await db.athlete_profiles.find_one(
                {"id": other_id},
                {"_id": 0, "id": 1, "name": 1, "profile_picture": 1, "last_active_at": 1}
            )
            
            if other_user:
                # Get unread count for current user
                is_participant_1 = conv["participant_1_id"] == athlete_id
                unread_count = conv.get("unread_count_1" if is_participant_1 else "unread_count_2", 0)
                
                result.append({
                    "id": conv["id"],
                    "other_user": other_user,
                    "last_message_preview": conv.get("last_message_preview", ""),
                    "last_message_at": conv.get("last_message_at"),
                    "unread_count": unread_count,
                    "created_at": conv.get("created_at")
                })
        
        return {"conversations": result}
        
    except Exception as e:
        logging.error(f"Error fetching conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversation/{conversation_id}")
async def get_conversation_messages(conversation_id: str, athlete_id: str = Query(...), limit: int = Query(50)):
    """Get messages in a conversation"""
    try:
        # Verify user is participant
        conversation = await db.conversations.find_one({"id": conversation_id})
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        if athlete_id not in [conversation["participant_1_id"], conversation["participant_2_id"]]:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Get messages
        messages_raw = await db.messages.find({
            "conversation_id": conversation_id,
            "$or": [
                {"sender_id": athlete_id, "deleted_by_sender": False},
                {"receiver_id": athlete_id, "deleted_by_receiver": False}
            ]
        }).sort("created_at", 1).limit(limit).to_list(length=limit)
        
        # Remove _id field from messages to avoid ObjectId serialization issues
        messages = []
        for msg in messages_raw:
            if '_id' in msg:
                del msg['_id']
            messages.append(msg)
        
        # Mark messages as read
        await db.messages.update_many(
            {
                "conversation_id": conversation_id,
                "receiver_id": athlete_id,
                "read": False
            },
            {"$set": {"read": True}}
        )
        
        # Reset unread count for this user
        is_participant_1 = conversation["participant_1_id"] == athlete_id
        await db.conversations.update_one(
            {"id": conversation_id},
            {"$set": {"unread_count_1" if is_participant_1 else "unread_count_2": 0}}
        )
        
        return {
            "messages": messages,
            "conversation_id": conversation_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching conversation messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversation/start")
async def start_conversation(sender_id: str = Query(...), receiver_id: str = Query(...)):
    """Start a new conversation or get existing one"""
    try:
        # Check if conversation exists
        conversation = await db.conversations.find_one({
            "$or": [
                {"participant_1_id": sender_id, "participant_2_id": receiver_id},
                {"participant_1_id": receiver_id, "participant_2_id": sender_id}
            ]
        })
        
        if conversation:
            # Restore if deleted
            is_participant_1 = conversation["participant_1_id"] == sender_id
            if conversation.get("participant_1_deleted" if is_participant_1 else "participant_2_deleted"):
                await db.conversations.update_one(
                    {"id": conversation["id"]},
                    {"$set": {
                        "participant_1_deleted" if is_participant_1 else "participant_2_deleted": False
                    }}
                )
            
            return {"conversation_id": conversation["id"], "existing": True}
        
        # Create new conversation
        conversation_id = str(uuid.uuid4())
        conversation = {
            "id": conversation_id,
            "participant_1_id": sender_id,
            "participant_2_id": receiver_id,
            "participant_1_deleted": False,
            "participant_2_deleted": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "last_message_at": datetime.now(timezone.utc).isoformat(),
            "last_message_preview": "",
            "unread_count_1": 0,
            "unread_count_2": 0
        }
        await db.conversations.insert_one(conversation)
        
        return {"conversation_id": conversation_id, "existing": False}
        
    except Exception as e:
        logging.error(f"Error starting conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/conversation/{conversation_id}")
async def delete_conversation(conversation_id: str, athlete_id: str = Query(...)):
    """Soft delete a conversation for the current user"""
    try:
        conversation = await db.conversations.find_one({"id": conversation_id})
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        if athlete_id not in [conversation["participant_1_id"], conversation["participant_2_id"]]:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Soft delete
        is_participant_1 = conversation["participant_1_id"] == athlete_id
        await db.conversations.update_one(
            {"id": conversation_id},
            {"$set": {"participant_1_deleted" if is_participant_1 else "participant_2_deleted": True}}
        )
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unread-count")
async def get_unread_count(athlete_id: str = Query(...)):
    """Get total unread message count for a user"""
    try:
        conversations = await db.conversations.find({
            "$or": [
                {"participant_1_id": athlete_id, "participant_1_deleted": False},
                {"participant_2_id": athlete_id, "participant_2_deleted": False}
            ]
        }).to_list(length=100)
        
        total_unread = 0
        for conv in conversations:
            is_participant_1 = conv["participant_1_id"] == athlete_id
            total_unread += conv.get("unread_count_1" if is_participant_1 else "unread_count_2", 0)
        
        return {"unread_count": total_unread}
        
    except Exception as e:
        logging.error(f"Error fetching unread count: {e}")
        raise HTTPException(status_code=500, detail=str(e))
