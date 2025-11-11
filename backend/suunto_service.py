"""
Suunto Integration Service
Extends BaseIntegrationService for Suunto fitness tracker data sync
"""

import httpx
import logging
import base64
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from integration_service import BaseIntegrationService
from fastapi import HTTPException


class SuuntoService(BaseIntegrationService):
    """Suunto integration service"""
    
    @property
    def provider_name(self) -> str:
        return "suunto"
    
    @property
    def oauth_authorize_url(self) -> str:
        return "https://cloudapi-oauth.suunto.com/oauth/authorize"
    
    @property
    def oauth_token_url(self) -> str:
        return "https://cloudapi-oauth.suunto.com/oauth/token"
    
    @property
    def api_base_url(self) -> str:
        return "https://cloudapi.suunto.com"
    
    async def exchange_code_for_tokens(self, code: str, state: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access token
        Suunto uses OAuth2 with Basic Auth for token exchange
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
        
        logging.info(f"[SUUNTO] Token exchange with Basic Auth")
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
            
            logging.info(f"[SUUNTO] Token exchange status: {response.status_code}")
            
            if response.status_code != 200:
                logging.error(f"[SUUNTO] Token exchange failed: {response.text}")
                raise HTTPException(status_code=400, detail="Suunto token exchange failed")
            
            token_data = response.json()
            logging.info(f"[SUUNTO] Token response keys: {list(token_data.keys())}")
        
        # Fetch user profile
        user_profile = await self.fetch_user_profile(token_data["access_token"])
        
        # Suunto tokens typically expire after 24 hours
        expires_in = token_data.get("expires_in", 86400)
        
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
            logging.info(f"[SUUNTO] Database save result: matched={result.matched_count}, modified={result.modified_count}, upserted_id={result.upserted_id}")
            
            # Verify it was saved
            saved_connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
            if saved_connection:
                logging.info(f"[SUUNTO] Connection verified in database for user: {user_id}")
            else:
                logging.error(f"[SUUNTO] Connection NOT found in database after save!")
        except Exception as e:
            logging.error(f"[SUUNTO] Error saving connection: {e}")
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
        """Fetch Suunto user profile - returns basic info"""
        # Suunto doesn't have a specific profile endpoint in public API
        # User ID is extracted from JWT token
        try:
            import jwt
            decoded = jwt.decode(access_token, options={"verify_signature": False})
            return {
                "id": decoded.get("user", "unknown"),
                "display_name": f"Suunto User {decoded.get('user', '')[:8]}"
            }
        except Exception as e:
            logging.error(f"[SUUNTO] Profile decode error: {e}")
            return {"id": "unknown", "display_name": "Suunto User"}
    
    async def sync_activities(self, user_id: str, force_full_sync: bool = False) -> Dict[str, Any]:
        """
        Sync Suunto workouts to database
        """
        logging.info(f"[SUUNTO SYNC] Starting sync for user: {user_id}, force_full={force_full_sync}")
        
        connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
        if not connection:
            raise HTTPException(status_code=404, detail=f"{self.provider_name.title()} not connected")
        
        # Determine how many workouts to fetch
        if force_full_sync:
            limit = 100
            logging.info(f"[SUUNTO SYNC] Full sync - fetching up to {limit} workouts")
        else:
            limit = 25
            logging.info(f"[SUUNTO SYNC] Incremental sync - fetching last {limit} workouts")
        
        # Fetch workouts
        workouts = await self.fetch_activities(user_id, limit=limit)
        
        # Store in database
        imported_count = 0
        for workout in workouts:
            workout["user_id"] = user_id
            workout["synced_at"] = datetime.now(timezone.utc)
            
            # Upsert to avoid duplicates
            result = await self.db[f"{self.provider_name}_activities"].update_one(
                {"user_id": user_id, "id": workout["id"]},
                {"$set": workout},
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
        
        logging.info(f"[SUUNTO SYNC] Completed: {imported_count} workouts imported out of {len(workouts)} total")
        
        return {
            "success": True,
            "imported": imported_count,
            "total_activities": len(workouts),
            "message": f"Successfully synced {imported_count} workouts"
        }
    
    async def fetch_activities(self, user_id: str, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Fetch Suunto workouts using API
        """
        connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
        if not connection:
            raise HTTPException(status_code=404, detail=f"{self.provider_name.title()} not connected")
        
        workouts = []
        
        # Note: Suunto API requires subscription key in addition to access token
        # For now, return empty list - requires proper API key setup
        logging.info(f"[SUUNTO] Fetching workouts (limit={limit}, offset={offset})")
        
        # In production, this would make actual API calls:
        # async with httpx.AsyncClient() as client:
        #     response = await client.get(
        #         f"{self.api_base_url}/v2/workouts",
        #         headers={
        #             "Authorization": f"Bearer {connection['access_token']}",
        #             "Ocp-Apim-Subscription-Key": subscription_key,
        #         },
        #         params={"limit": limit, "offset": offset}
        #     )
        
        return workouts
    
    def transform_activity_to_calendar(self, activity: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Suunto workout to training calendar format"""
        start_date = activity.get("start_date", activity.get("date", ""))
        if "T" not in start_date:
            start_date = f"{start_date}T00:00:00"
        
        return {
            "title": activity.get("type", "Suunto Workout"),
            "start_date": start_date,
            "block_type": "training",
            "source": "suunto",
            "suunto_data": {
                "activity_id": activity.get("id"),
                "type": activity.get("type"),
                "duration_seconds": activity.get("duration_seconds", 0),
                "distance_km": activity.get("distance_km", 0),
                "calories": activity.get("calories", 0),
                "heart_rate_avg": activity.get("heart_rate_avg"),
                "ascent": activity.get("ascent", 0)
            }
        }
    
    async def get_stats(self, user_id: str) -> Dict[str, Any]:
        """Get Suunto activity statistics"""
        activities = await self.db[f"{self.provider_name}_activities"].find(
            {"user_id": user_id}
        ).to_list(length=None)
        
        total_activities = len(activities)
        total_distance_km = sum(a.get("distance_km", 0) for a in activities)
        total_calories = sum(a.get("calories", 0) for a in activities)
        
        # Group by type
        by_type = {}
        for activity in activities:
            activity_type = activity.get("type", "Unknown")
            if activity_type not in by_type:
                by_type[activity_type] = {
                    "count": 0,
                    "total_distance_km": 0,
                    "total_calories": 0
                }
            by_type[activity_type]["count"] += 1
            by_type[activity_type]["total_distance_km"] += activity.get("distance_km", 0)
            by_type[activity_type]["total_calories"] += activity.get("calories", 0)
        
        stats = {
            "total_activities": total_activities,
            "total_distance_km": round(total_distance_km, 2),
            "total_calories": int(total_calories),
            "by_type": by_type
        }
        
        return stats
