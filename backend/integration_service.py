"""
Base Integration Service Framework
Provides a standardized approach for implementing OAuth-based integrations
(Strava, Oura, Garmin, Polar, Coros, etc.)
"""

import httpx
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from abc import ABC, abstractmethod
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase


class BaseIntegrationService(ABC):
    """
    Base class for all integration services.
    Handles common OAuth flow, token management, and data sync patterns.
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.system_settings = None
    
    # ==================== Abstract Methods (Must be implemented) ====================
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Provider name (e.g., 'strava', 'oura', 'garmin')"""
        pass
    
    @property
    @abstractmethod
    def oauth_authorize_url(self) -> str:
        """OAuth authorization URL"""
        pass
    
    @property
    @abstractmethod
    def oauth_token_url(self) -> str:
        """OAuth token exchange URL"""
        pass
    
    @property
    @abstractmethod
    def api_base_url(self) -> str:
        """API base URL for data fetching"""
        pass
    
    @abstractmethod
    async def fetch_user_profile(self, access_token: str) -> Dict[str, Any]:
        """Fetch user profile from the provider"""
        pass
    
    @abstractmethod
    async def fetch_activities(
        self, 
        access_token: str, 
        since: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Fetch activities/data from the provider"""
        pass
    
    @abstractmethod
    def transform_activity_to_calendar(self, activity: Dict[str, Any]) -> Dict[str, Any]:
        """Transform provider activity to calendar block format"""
        pass
    
    # ==================== Common OAuth Flow ====================
    
    async def load_settings(self):
        """Load system settings and provider credentials"""
        settings_doc = await self.db.system_settings.find_one({})
        if not settings_doc:
            raise HTTPException(
                status_code=404, 
                detail=f"{self.provider_name.title()} credentials not configured in System Settings"
            )
        
        self.system_settings = settings_doc
        
        # Check both top level and under 'advanced' key for backward compatibility
        provider_config = settings_doc.get(self.provider_name.lower())
        if not provider_config and 'advanced' in settings_doc:
            provider_config = settings_doc['advanced'].get(self.provider_name.lower())
        
        if not provider_config or not provider_config.get("clientId") or not provider_config.get("clientSecret"):
            raise HTTPException(
                status_code=404,
                detail=f"{self.provider_name.title()} Client ID or Secret missing in System Settings"
            )
        
        return provider_config
    
    def get_callback_url(self, provider_config: Dict[str, Any]) -> str:
        """Get the OAuth callback URL"""
        callback_domain = provider_config.get("callbackDomain", "localhost:3000")
        # Use https for production domains, http for localhost
        protocol = "http" if "localhost" in callback_domain else "https"
        return f"{protocol}://{callback_domain}/api/auth/{self.provider_name}/callback"
    
    async def get_authorization_url(self, user_id: str, scopes: List[str]) -> str:
        """Generate OAuth authorization URL"""
        provider_config = await self.load_settings()
        
        # Store OAuth state
        state = f"{user_id}_{datetime.now(timezone.utc).timestamp()}"
        await self.db[f"{self.provider_name}_oauth_state"].insert_one({
            "state": state,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc)
        })
        
        callback_url = self.get_callback_url(provider_config)
        
        params = {
            "client_id": provider_config["clientId"],
            "redirect_uri": callback_url,
            "response_type": "code",
            "scope": " ".join(scopes),
            "state": state
        }
        
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{self.oauth_authorize_url}?{query_string}"
    
    async def exchange_code_for_tokens(self, code: str, state: str) -> Dict[str, Any]:
        """Exchange authorization code for access token"""
        # Verify state
        oauth_state = await self.db[f"{self.provider_name}_oauth_state"].find_one({"state": state})
        if not oauth_state:
            raise HTTPException(status_code=400, detail="Invalid OAuth state")
        
        user_id = oauth_state["user_id"]
        
        # Load settings
        provider_config = await self.load_settings()
        callback_url = self.get_callback_url(provider_config)
        
        # Exchange code for token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.oauth_token_url,
                data={
                    "client_id": provider_config["clientId"],
                    "client_secret": provider_config["clientSecret"],
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": callback_url
                }
            )
            
            logging.info(f"[{self.provider_name.upper()}] Token exchange status: {response.status_code}")
            
            if response.status_code != 200:
                logging.error(f"[{self.provider_name.upper()}] Token exchange failed: {response.text}")
                raise HTTPException(status_code=400, detail=f"{self.provider_name.title()} token exchange failed")
            
            token_data = response.json()
        
        # Fetch user profile
        user_profile = await self.fetch_user_profile(token_data["access_token"])
        
        # Store connection
        connection_data = {
            "user_id": user_id,
            "access_token": token_data["access_token"],
            "refresh_token": token_data.get("refresh_token"),
            "expires_at": datetime.fromtimestamp(
                token_data["expires_at"] if "expires_at" in token_data else 
                (datetime.now(timezone.utc).timestamp() + token_data.get("expires_in", 3600)),
                tz=timezone.utc
            ),
            "user_profile": user_profile,
            "scopes": token_data.get("scope", "").split(),
            "connected_at": datetime.now(timezone.utc),
            "last_sync_at": None,
            "sync_status": "pending"
        }
        
        logging.info(f"Saving {self.provider_name} connection to database for user: {user_id}")
        result = await self.db[f"{self.provider_name}_connections"].update_one(
            {"user_id": user_id},
            {"$set": connection_data},
            upsert=True
        )
        logging.info(f"Database save result: matched={result.matched_count}, modified={result.modified_count}")
        
        # Clean up OAuth state
        await self.db[f"{self.provider_name}_oauth_state"].delete_one({"_id": oauth_state["_id"]})
        
        return {
            "connected": True,
            "user_id": user_id,
            "profile": user_profile,
            "connected_at": connection_data["connected_at"].isoformat()
        }
    
    async def get_valid_token(self, user_id: str) -> str:
        """Get a valid access token, refreshing if necessary"""
        connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
        if not connection:
            raise HTTPException(status_code=404, detail=f"{self.provider_name.title()} not connected")
        
        expires_at = connection.get("expires_at")
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        # Check if token is expired
        if expires_at and datetime.now(timezone.utc) >= expires_at:
            # Refresh token
            return await self.refresh_token(user_id)
        
        return connection["access_token"]
    
    async def refresh_token(self, user_id: str) -> str:
        """Refresh the access token"""
        connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
        if not connection or not connection.get("refresh_token"):
            raise HTTPException(status_code=404, detail="Cannot refresh token")
        
        await self.load_settings()
        provider_config = self.system_settings.get(self.provider_name.lower())
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.oauth_token_url,
                data={
                    "client_id": provider_config["clientId"],
                    "client_secret": provider_config["clientSecret"],
                    "grant_type": "refresh_token",
                    "refresh_token": connection["refresh_token"]
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Token refresh failed")
            
            token_data = response.json()
        
        # Update connection with new tokens
        await self.db[f"{self.provider_name}_connections"].update_one(
            {"user_id": user_id},
            {"$set": {
                "access_token": token_data["access_token"],
                "expires_at": datetime.fromtimestamp(
                    token_data["expires_at"] if "expires_at" in token_data else 
                    (datetime.now(timezone.utc).timestamp() + token_data.get("expires_in", 3600)),
                    tz=timezone.utc
                ),
                "refresh_token": token_data.get("refresh_token", connection["refresh_token"])
            }}
        )
        
        return token_data["access_token"]
    
    async def sync_activities(
        self, 
        user_id: str, 
        since: Optional[datetime] = None, 
        force_full_sync: bool = False
    ) -> Dict[str, Any]:
        """Sync activities from provider to database"""
        logging.info(f"[{self.provider_name.upper()} SYNC] user_id={user_id}, force_full_sync={force_full_sync}")
        
        connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
        if not connection:
            raise HTTPException(status_code=404, detail=f"{self.provider_name.title()} not connected")
        
        # Determine starting point
        if since is None:
            if force_full_sync:
                since = datetime.fromtimestamp(0, tz=timezone.utc)
                logging.info(f"[{self.provider_name.upper()} SYNC] FULL SYNC MODE: Fetching ALL historical data")
            else:
                since = connection.get("last_sync_at") or connection["connected_at"]
            
            if since and not since.tzinfo:
                since = since.replace(tzinfo=timezone.utc)
        
        logging.info(f"[{self.provider_name.upper()} SYNC] Fetching data since: {since}")
        
        # Get valid token
        token = await self.get_valid_token(user_id)
        
        # Fetch activities
        activities = await self.fetch_activities(token, since)
        logging.info(f"[{self.provider_name.upper()} SYNC] Fetched {len(activities)} activities")
        
        # Store activities
        imported_count = 0
        for activity in activities:
            activity["user_id"] = user_id
            await self.db[f"{self.provider_name}_activities"].update_one(
                {"user_id": user_id, "activity_id": activity.get("activity_id")},
                {"$set": activity},
                upsert=True
            )
            imported_count += 1
        
        # Update last sync time
        await self.db[f"{self.provider_name}_connections"].update_one(
            {"user_id": user_id},
            {"$set": {
                "last_sync_at": datetime.now(timezone.utc),
                "sync_status": "completed"
            }}
        )
        
        return {
            "imported": imported_count,
            "total_activities": len(activities)
        }
    
    async def get_connection_status(self, user_id: str) -> Dict[str, Any]:
        """Get connection status"""
        connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
        if not connection:
            return {"connected": False}
        
        return {
            "connected": True,
            "user_profile": connection.get("user_profile"),
            "connected_at": connection.get("connected_at"),
            "last_sync_at": connection.get("last_sync_at")
        }
    
    async def disconnect(self, user_id: str) -> Dict[str, Any]:
        """Disconnect integration"""
        await self.db[f"{self.provider_name}_connections"].delete_one({"user_id": user_id})
        return {"success": True, "message": f"{self.provider_name.title()} disconnected"}
