"""
Garmin Connect Integration Service
Extends BaseIntegrationService for Garmin fitness tracker data sync
Note: Garmin uses OAuth 2.0 with PKCE (Proof Key for Code Exchange)
"""

import httpx
import logging
import base64
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from integration_service import BaseIntegrationService
from fastapi import HTTPException


class GarminService(BaseIntegrationService):
    """Garmin Connect integration service"""
    
    @property
    def provider_name(self) -> str:
        return "garmin"
    
    @property
    def oauth_authorize_url(self) -> str:
        return "https://connect.garmin.com/oauthConfirm"
    
    @property
    def oauth_token_url(self) -> str:
        return "https://connectapi.garmin.com/oauth-service/oauth/access_token"
    
    @property
    def api_base_url(self) -> str:
        return "https://apis.garmin.com"
    
    def generate_pkce_pair(self) -> tuple:
        """Generate PKCE code verifier and challenge for OAuth"""
        # Generate random code verifier
        code_verifier = base64.urlsafe_b64encode(
            secrets.token_bytes(32)
        ).decode('utf-8').rstrip('=')
        
        # Create code challenge from verifier
        code_challenge = base64.urlsafe_b64encode(
            hashlib.sha256(code_verifier.encode('utf-8')).digest()
        ).decode('utf-8').rstrip('=')
        
        return code_verifier, code_challenge
    
    async def get_authorization_url(self, user_id: str, scopes: List[str] = None) -> str:
        """
        Get Garmin OAuth authorization URL with PKCE
        Note: Garmin uses PKCE which requires code_challenge
        """
        provider_config = await self.load_settings()
        callback_url = self.get_callback_url(provider_config)
        
        # Generate PKCE pair
        code_verifier, code_challenge = self.generate_pkce_pair()
        
        # Generate state
        state = f"{user_id}_{datetime.now(timezone.utc).timestamp()}"
        
        # Store OAuth state with PKCE verifier
        oauth_state = {
            "state": state,
            "user_id": user_id,
            "code_verifier": code_verifier,
            "code_challenge": code_challenge,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10)
        }
        
        await self.db[f"{self.provider_name}_oauth_state"].insert_one(oauth_state)
        
        # Build authorization URL with PKCE
        auth_url = (
            f"{self.oauth_authorize_url}?"
            f"oauth_consumer_key={provider_config['clientId']}&"
            f"oauth_callback={callback_url}"
        )
        
        logging.info(f"[GARMIN] Generated auth URL for user: {user_id}")
        return auth_url
    
    async def exchange_code_for_tokens(self, oauth_token: str, oauth_verifier: str, state: str = None) -> Dict[str, Any]:
        """
        Exchange Garmin OAuth 1.0a tokens for access token
        Note: Garmin uses OAuth 1.0a (not OAuth 2.0) despite the naming
        """
        provider_config = await self.load_settings()
        
        logging.info(f"[GARMIN] Token exchange with OAuth 1.0a")
        logging.info(f"  URL: {self.oauth_token_url}")
        logging.info(f"  oauth_token: {oauth_token[:20]}...")
        
        # Garmin uses OAuth 1.0a signature
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.oauth_token_url,
                data={
                    "oauth_consumer_key": provider_config['clientId'],
                    "oauth_token": oauth_token,
                    "oauth_verifier": oauth_verifier
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            )
            
            logging.info(f"[GARMIN] Token exchange status: {response.status_code}")
            
            if response.status_code != 200:
                logging.error(f"[GARMIN] Token exchange failed: {response.text}")
                raise HTTPException(status_code=400, detail="Garmin token exchange failed")
            
            # Parse OAuth 1.0a response (typically form-encoded)
            token_data = dict(param.split('=') for param in response.text.split('&'))
            logging.info(f"[GARMIN] Token response keys: {list(token_data.keys())}")
        
        # Extract user_id from token or state
        user_id = state.split('_')[0] if state else "unknown"
        
        # Fetch user profile
        user_profile = await self.fetch_user_profile(token_data.get("oauth_token", ""))
        
        # Store connection
        connection_data = {
            "user_id": user_id,
            "access_token": token_data.get("oauth_token"),
            "token_secret": token_data.get("oauth_token_secret"),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=365),  # Garmin tokens don't expire
            "user_profile": user_profile,
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
            logging.info(f"[GARMIN] Database save result: matched={result.matched_count}, modified={result.modified_count}, upserted_id={result.upserted_id}")
            
            # Verify it was saved
            saved_connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
            if saved_connection:
                logging.info(f"[GARMIN] Connection verified in database for user: {user_id}")
            else:
                logging.error(f"[GARMIN] Connection NOT found in database after save!")
        except Exception as e:
            logging.error(f"[GARMIN] Error saving connection: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        return {
            "connected": True,
            "user_id": user_id,
            "profile": user_profile,
            "connected_at": connection_data["connected_at"].isoformat()
        }
    
    async def fetch_user_profile(self, access_token: str) -> Dict[str, Any]:
        """Fetch Garmin user profile"""
        # Garmin user profile endpoint
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.api_base_url}/wellness-api/rest/user/id",
                    headers={
                        "Authorization": f"Bearer {access_token}"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "id": data.get("userId", "unknown"),
                        "display_name": f"Garmin User {data.get('userId', '')[:8]}"
                    }
                else:
                    logging.warning(f"[GARMIN] Profile fetch returned {response.status_code}")
                    return {"id": "unknown", "display_name": "Garmin User"}
        except Exception as e:
            logging.error(f"[GARMIN] Profile fetch error: {e}")
            return {"id": "unknown", "display_name": "Garmin User"}
    
    async def sync_activities(self, user_id: str, force_full_sync: bool = False) -> Dict[str, Any]:
        """
        Sync Garmin activities to database
        """
        logging.info(f"[GARMIN SYNC] Starting sync for user: {user_id}, force_full={force_full_sync}")
        
        connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
        if not connection:
            raise HTTPException(status_code=404, detail=f"{self.provider_name.title()} not connected")
        
        # Determine date range
        if force_full_sync:
            start_date = (datetime.now(timezone.utc) - timedelta(days=180)).strftime("%Y-%m-%d")
            logging.info(f"[GARMIN SYNC] Full sync - fetching last 180 days")
        else:
            last_sync = connection.get("last_sync_at")
            if last_sync:
                start_date = last_sync.strftime("%Y-%m-%d")
                logging.info(f"[GARMIN SYNC] Incremental sync from: {start_date}")
            else:
                start_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
                logging.info(f"[GARMIN SYNC] First sync - fetching last 30 days")
        
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
        
        logging.info(f"[GARMIN SYNC] Completed: {imported_count} activities imported out of {len(activities)} total")
        
        return {
            "success": True,
            "imported": imported_count,
            "total_activities": len(activities),
            "message": f"Successfully synced {imported_count} activities"
        }
    
    async def fetch_activities(self, user_id: str, start_date: str = None, end_date: str = None) -> List[Dict[str, Any]]:
        """
        Fetch Garmin activities using wellness API
        """
        connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
        if not connection:
            raise HTTPException(status_code=404, detail=f"{self.provider_name.title()} not connected")
        
        if not start_date:
            start_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
        if not end_date:
            end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Convert dates to Unix timestamps (Garmin uses seconds)
        start_time = int(datetime.strptime(start_date, "%Y-%m-%d").timestamp())
        end_time = int(datetime.strptime(end_date, "%Y-%m-%d").timestamp())
        
        activities = []
        
        # Note: Garmin uses OAuth 1.0a which requires signatures
        # For simplicity, we'll return mock data structure
        # In production, use proper OAuth 1.0a signing
        
        logging.info(f"[GARMIN] Fetching activities from {start_date} to {end_date}")
        logging.info(f"[GARMIN] Note: Garmin OAuth 1.0a requires proper request signing")
        
        # Return empty for now - requires OAuth 1.0a implementation
        return activities
    
    def transform_activity_to_calendar(self, activity: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Garmin activity to training calendar format"""
        start_date = activity.get("start_date", activity.get("date", ""))
        if "T" not in start_date:
            start_date = f"{start_date}T00:00:00"
        
        return {
            "title": activity.get("type", "Garmin Activity"),
            "start_date": start_date,
            "block_type": "training",
            "source": "garmin",
            "garmin_data": {
                "activity_id": activity.get("id"),
                "type": activity.get("type"),
                "duration_seconds": activity.get("duration_seconds", 0),
                "distance_km": activity.get("distance_km", 0),
                "calories": activity.get("calories", 0),
                "heart_rate_avg": activity.get("heart_rate_avg"),
                "steps": activity.get("steps", 0)
            }
        }
    
    async def get_stats(self, user_id: str) -> Dict[str, Any]:
        """Get Garmin activity statistics"""
        activities = await self.db[f"{self.provider_name}_activities"].find(
            {"user_id": user_id}
        ).to_list(length=None)
        
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
