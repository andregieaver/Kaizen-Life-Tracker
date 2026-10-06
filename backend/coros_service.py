"""
COROS Integration Service
Extends BaseIntegrationService for COROS fitness tracker data sync
"""

import httpx
import logging
import base64
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from integration_service import BaseIntegrationService
from fastapi import HTTPException


class CorosService(BaseIntegrationService):
    """COROS integration service"""
    
    @property
    def provider_name(self) -> str:
        return "coros"
    
    @property
    def oauth_authorize_url(self) -> str:
        return "https://open.coros.com/oauth2/authorize"
    
    @property
    def oauth_token_url(self) -> str:
        return "https://open.coros.com/oauth2/accesstoken"
    
    @property
    def api_base_url(self) -> str:
        return "https://open.coros.com/v1"
    
    async def exchange_code_for_tokens(self, code: str, state: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access token
        COROS uses standard OAuth2 with Basic Authentication
        """
        # Verify state
        oauth_state = await self.db[f"{self.provider_name}_oauth_state"].find_one({"state": state})
        if not oauth_state:
            raise HTTPException(status_code=400, detail="Invalid OAuth state")
        
        user_id = oauth_state["user_id"]
        
        # Load settings
        provider_config = await self.load_settings()
        callback_url = self.get_callback_url(provider_config)
        
        # Create Basic Auth header
        credentials = f"{provider_config['clientId']}:{provider_config['clientSecret']}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        logging.info(f"[COROS] Token exchange with Basic Auth")
        logging.info(f"  URL: {self.oauth_token_url}")
        logging.info(f"  client_id: {provider_config['clientId']}")
        
        # Exchange code for token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.oauth_token_url,
                headers={
                    "Authorization": f"Basic {encoded_credentials}",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": callback_url
                }
            )
            
            logging.info(f"[COROS] Token exchange status: {response.status_code}")
            
            if response.status_code != 200:
                logging.error(f"[COROS] Token exchange failed: {response.text}")
                raise HTTPException(status_code=400, detail="COROS token exchange failed")
            
            token_data = response.json()
            logging.info(f"[COROS] Token response keys: {list(token_data.keys())}")
        
        # Fetch user profile
        user_profile = await self.fetch_user_profile(token_data["access_token"])
        
        # COROS tokens typically expire after 60 days
        expires_in = token_data.get("expires_in", 5184000)  # 60 days default
        
        # Store connection
        connection_data = {
            "user_id": user_id,
            "access_token": token_data["access_token"],
            "refresh_token": token_data.get("refresh_token"),
            "expires_at": datetime.now(timezone.utc) + timedelta(seconds=expires_in),
            "user_profile": user_profile,
            "scopes": token_data.get("scope", "").split(),
            "connected_at": datetime.now(timezone.utc),
            "last_sync_at": None,
            "sync_status": "pending"
        }
        
        try:
            logging.info(f"Saving {self.provider_name} connection to database for user: {user_id}")
            result = await self.db[f"{self.provider_name}_connections"].update_one(
                {"user_id": user_id},
                {"$set": connection_data},
                upsert=True
            )
            logging.info(f"[COROS] Database save result: matched={result.matched_count}, modified={result.modified_count}, upserted_id={result.upserted_id}")
            
            # Verify it was saved
            saved_connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
            if saved_connection:
                logging.info(f"[COROS] Connection verified in database for user: {user_id}")
            else:
                logging.error(f"[COROS] Connection NOT found in database after save!")
        except Exception as e:
            logging.error(f"[COROS] Error saving connection: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        # Clean up OAuth state
        await self.db[f"{self.provider_name}_oauth_state"].delete_one({"_id": oauth_state["_id"]})
        
        return {
            "connected": True,
            "user_id": user_id,
            "profile": user_profile,
            "connected_at": connection_data["connected_at"].isoformat()
        }
    
    async def fetch_user_profile(self, access_token: str) -> Dict[str, Any]:
        """Fetch COROS user profile"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.api_base_url}/user",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Accept": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "id": data.get("userId", "unknown"),
                        "display_name": data.get("userName", "COROS User"),
                        "email": data.get("email", "")
                    }
                else:
                    logging.warning(f"[COROS] Profile fetch returned {response.status_code}")
                    return {"id": "unknown", "display_name": "COROS User"}
                    
            except Exception as e:
                logging.error(f"[COROS] Profile fetch error: {e}")
                return {"id": "unknown", "display_name": "COROS User"}
    
    async def sync_activities(self, user_id: str, force_full_sync: bool = False) -> Dict[str, Any]:
        """
        Sync COROS activities to database
        """
        logging.info(f"[COROS SYNC] Starting sync for user: {user_id}, force_full={force_full_sync}")
        
        connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
        if not connection:
            raise HTTPException(status_code=404, detail=f"{self.provider_name.title()} not connected")
        
        # Determine date range
        if force_full_sync:
            start_date = (datetime.now(timezone.utc) - timedelta(days=180)).strftime("%Y-%m-%d")
            logging.info(f"[COROS SYNC] Full sync - fetching last 180 days")
        else:
            last_sync = connection.get("last_sync_at")
            if last_sync:
                start_date = last_sync.strftime("%Y-%m-%d")
                logging.info(f"[COROS SYNC] Incremental sync from: {start_date}")
            else:
                start_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
                logging.info(f"[COROS SYNC] First sync - fetching last 30 days")
        
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Fetch activities
        activities = await self.fetch_activities(user_id, start_date, end_date)
        
        # Store in database
        imported_count = 0
        for activity in activities:
            activity["user_id"] = user_id
            activity["synced_at"] = datetime.now(timezone.utc)
            
            # Upsert to avoid duplicates
            result = await self.db[f"{self.provider_name}_activities"].update_one(
                {"user_id": user_id, "id": activity["id"]},
                {"$set": activity},
                upsert=True
            )
            
            if result.upserted_id or result.modified_count > 0:
                imported_count += 1
        
        # Update last sync time
        await self.db[f"{self.provider_name}_connections"].update_one(
            {"user_id": user_id},
            {"$set": {
                "last_sync_at": datetime.now(timezone.utc),
                "sync_status": "completed"
            }}
        )
        
        logging.info(f"[COROS SYNC] Completed: {imported_count} activities imported out of {len(activities)} total")
        
        return {
            "success": True,
            "imported": imported_count,
            "total_activities": len(activities),
            "message": f"Successfully synced {imported_count} activities"
        }
    
    async def fetch_activities(self, user_id: str, start_date: str = None, end_date: str = None) -> List[Dict[str, Any]]:
        """
        Fetch COROS activities using open API
        """
        connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
        if not connection:
            raise HTTPException(status_code=404, detail=f"{self.provider_name.title()} not connected")
        
        if not start_date:
            start_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
        if not end_date:
            end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        activities = []
        
        async with httpx.AsyncClient() as client:
            try:
                # Fetch activities from COROS API
                response = await client.get(
                    f"{self.api_base_url}/activity/list",
                    headers={
                        "Authorization": f"Bearer {connection['access_token']}",
                        "Accept": "application/json"
                    },
                    params={
                        "startDate": start_date,
                        "endDate": end_date,
                        "limit": 100
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Process activities
                    for activity in data.get("data", []):
                        activities.append({
                            "id": str(activity.get("labelId")),
                            "date": activity.get("startDate"),
                            "start_date": activity.get("startDate"),
                            "type": activity.get("mode", "Unknown"),
                            "duration_seconds": activity.get("duration", 0),
                            "distance_km": activity.get("distance", 0) / 1000,  # Convert m to km
                            "calories": activity.get("calories", 0),
                            "heart_rate_avg": activity.get("avgHeartRate"),
                            "steps": activity.get("totalSteps", 0),
                            "training_load": activity.get("trainingLoad")
                        })
                
                logging.info(f"[COROS] Fetched {len(activities)} activities for user {user_id}")
                return activities
                
            except Exception as e:
                logging.error(f"[COROS] Activity fetch error: {e}")
                return []
    
    def transform_activity_to_calendar(self, activity: Dict[str, Any]) -> Dict[str, Any]:
        """Transform COROS activity to training calendar format"""
        start_date = activity.get("start_date", activity.get("date", ""))
        if "T" not in start_date:
            start_date = f"{start_date}T00:00:00"
        
        return {
            "title": activity.get("type", "COROS Activity"),
            "start_date": start_date,
            "block_type": "training",
            "source": "coros",
            "coros_data": {
                "activity_id": activity.get("id"),
                "type": activity.get("type"),
                "duration_seconds": activity.get("duration_seconds", 0),
                "distance_km": activity.get("distance_km", 0),
                "calories": activity.get("calories", 0),
                "heart_rate_avg": activity.get("heart_rate_avg"),
                "steps": activity.get("steps", 0),
                "training_load": activity.get("training_load")
            }
        }
    
    async def get_stats(self, user_id: str) -> Dict[str, Any]:
        """Get COROS activity statistics"""
        # Limit to 10000 most recent activities to prevent memory issues
        activities = await self.db[f"{self.provider_name}_activities"].find(
            {"user_id": user_id}
        ).sort("date", -1).limit(10000).to_list(length=10000)
        
        total_activities = len(activities)
        total_distance_km = sum(a.get("distance_km", 0) for a in activities)
        total_calories = sum(a.get("calories", 0) for a in activities)
        total_steps = sum(a.get("steps", 0) for a in activities)
        
        # Group by type
        by_type = {}
        for activity in activities:
            activity_type = activity.get("type", "Unknown")
            if activity_type not in by_type:
                by_type[activity_type] = {
                    "count": 0,
                    "total_distance_km": 0,
                    "total_calories": 0,
                    "total_steps": 0
                }
            by_type[activity_type]["count"] += 1
            by_type[activity_type]["total_distance_km"] += activity.get("distance_km", 0)
            by_type[activity_type]["total_calories"] += activity.get("calories", 0)
            by_type[activity_type]["total_steps"] += activity.get("steps", 0)
        
        stats = {
            "total_activities": total_activities,
            "total_distance_km": round(total_distance_km, 2),
            "total_calories": int(total_calories),
            "total_steps": int(total_steps),
            "by_type": by_type
        }
        
        return stats
