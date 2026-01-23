"""
Garmin Connect Integration Service
Implements OAuth 1.0a authentication for Garmin Connect API
Note: Garmin uses OAuth 1.0a (NOT OAuth 2.0) with HMAC-SHA1 signatures
"""

import httpx
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from integration_service import BaseIntegrationService
from fastapi import HTTPException
from requests_oauthlib import OAuth1Session
from fastapi.concurrency import run_in_threadpool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GarminService(BaseIntegrationService):
    """Garmin Connect integration service using OAuth 1.0a"""
    
    @property
    def provider_name(self) -> str:
        return "garmin"
    
    @property
    def oauth_authorize_url(self) -> str:
        return "https://connect.garmin.com/oauthConfirm"
    
    @property
    def oauth_token_url(self) -> str:
        # For OAuth 1.0a, we need both request token and access token URLs
        return "https://connectapi.garmin.com/oauth-service/oauth/access_token"
    
    @property
    def oauth_request_token_url(self) -> str:
        return "https://connectapi.garmin.com/oauth-service/oauth/request_token"
    
    @property
    def api_base_url(self) -> str:
        return "https://apis.garmin.com"
    
    async def get_authorization_url(self, user_id: str, scopes: List[str] = None) -> str:
        """
        Get Garmin OAuth 1.0a authorization URL
        Step 1: Fetch request token
        Step 2: Generate authorization URL
        """
        provider_config = await self.load_settings()
        callback_url = self.get_callback_url(provider_config)
        
        logger.info(f"[GARMIN] Starting OAuth 1.0a flow for user: {user_id}")
        logger.info(f"[GARMIN] Consumer key: {provider_config['clientId'][:10]}...")
        logger.info(f"[GARMIN] Callback URL: {callback_url}")
        
        def _get_request_token():
            """Synchronous function to fetch request token using OAuth1Session"""
            oauth = OAuth1Session(
                client_key=provider_config['clientId'],
                client_secret=provider_config['clientSecret'],
                callback_uri=callback_url
            )
            
            try:
                # Fetch request token
                request_token_data = oauth.fetch_request_token(self.oauth_request_token_url)
                logger.info(f"[GARMIN] Request token obtained: {request_token_data.get('oauth_token')[:20]}...")
                
                # Generate authorization URL
                authorization_url = oauth.authorization_url(self.oauth_authorize_url)
                logger.info(f"[GARMIN] Authorization URL: {authorization_url}")
                
                return {
                    'request_token': request_token_data.get('oauth_token'),
                    'request_token_secret': request_token_data.get('oauth_token_secret'),
                    'authorization_url': authorization_url
                }
            except Exception as e:
                logger.error(f"[GARMIN] Failed to fetch request token: {str(e)}")
                raise
        
        # Run synchronous OAuth1Session in thread pool
        auth_data = await run_in_threadpool(_get_request_token)
        
        # Store request token data for callback
        state = f"{user_id}_{datetime.now(timezone.utc).timestamp()}"
        oauth_state = {
            "state": state,
            "user_id": user_id,
            "request_token": auth_data['request_token'],
            "request_token_secret": auth_data['request_token_secret'],
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10)
        }
        
        await self.db[f"{self.provider_name}_oauth_state"].insert_one(oauth_state)
        logger.info(f"[GARMIN] Stored OAuth state for user: {user_id}")
        
        return auth_data['authorization_url']
    
    async def exchange_code_for_tokens(self, oauth_token: str, oauth_verifier: str) -> Dict[str, Any]:
        """
        Exchange Garmin OAuth 1.0a request token + verifier for access token
        Step 3: Exchange authorized request token for access token
        
        Args:
            oauth_token: The request token from the callback
            oauth_verifier: The verifier from the callback
        """
        logger.info(f"[GARMIN] Token exchange - oauth_token: {oauth_token[:20]}...")
        logger.info(f"[GARMIN] Token exchange - oauth_verifier: {oauth_verifier[:20]}...")
        
        # Retrieve stored OAuth state
        oauth_state = await self.db[f"{self.provider_name}_oauth_state"].find_one({
            "request_token": oauth_token
        })
        
        if not oauth_state:
            logger.error(f"[GARMIN] OAuth state not found for token: {oauth_token[:20]}...")
            raise HTTPException(status_code=400, detail="Invalid OAuth state - request token not found")
        
        user_id = oauth_state["user_id"]
        request_token_secret = oauth_state["request_token_secret"]
        
        logger.info(f"[GARMIN] Found OAuth state for user: {user_id}")
        
        # Load provider configuration
        provider_config = await self.load_settings()
        
        def _exchange_token():
            """Synchronous function to exchange tokens using OAuth1Session"""
            oauth = OAuth1Session(
                client_key=provider_config['clientId'],
                client_secret=provider_config['clientSecret'],
                resource_owner_key=oauth_token,
                resource_owner_secret=request_token_secret,
                verifier=oauth_verifier
            )
            
            try:
                # Fetch access token
                access_token_data = oauth.fetch_access_token(self.oauth_token_url)
                logger.info(f"[GARMIN] Access token obtained: {access_token_data.get('oauth_token')[:20]}...")
                
                return {
                    'oauth_token': access_token_data.get('oauth_token'),
                    'oauth_token_secret': access_token_data.get('oauth_token_secret')
                }
            except Exception as e:
                logger.error(f"[GARMIN] Token exchange failed: {str(e)}")
                raise
        
        # Run synchronous OAuth1Session in thread pool
        token_data = await run_in_threadpool(_exchange_token)
        
        # Fetch user profile
        user_profile = await self.fetch_user_profile(
            token_data['oauth_token'],
            token_data['oauth_token_secret']
        )
        
        # Store connection (Garmin tokens don't expire)
        connection_data = {
            "user_id": user_id,
            "access_token": token_data['oauth_token'],
            "token_secret": token_data['oauth_token_secret'],
            "expires_at": datetime.now(timezone.utc) + timedelta(days=3650),  # 10 years (effectively never)
            "user_profile": user_profile,
            "connected_at": datetime.now(timezone.utc),
            "last_sync_at": None,
            "sync_status": "pending"
        }
        
        try:
            logger.info(f"[GARMIN] Saving connection to database for user: {user_id}")
            result = await self.db[f"{self.provider_name}_connections"].update_one(
                {"user_id": user_id},
                {"$set": connection_data},
                upsert=True
            )
            logger.info(f"[GARMIN] Database save result: matched={result.matched_count}, modified={result.modified_count}")
            
            # Verify save
            saved_connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
            if saved_connection:
                logger.info(f"[GARMIN] Connection verified in database")
            else:
                logger.error(f"[GARMIN] Connection NOT found after save!")
        except Exception as e:
            logger.error(f"[GARMIN] Error saving connection: {e}")
            raise
        
        # Clean up OAuth state
        await self.db[f"{self.provider_name}_oauth_state"].delete_one({"_id": oauth_state["_id"]})
        logger.info(f"[GARMIN] Cleaned up OAuth state")
        
        return {
            "connected": True,
            "user_id": user_id,
            "profile": user_profile,
            "connected_at": connection_data["connected_at"].isoformat()
        }
    
    async def fetch_user_profile(self, access_token: str, token_secret: str) -> Dict[str, Any]:
        """Fetch Garmin user profile with OAuth 1.0a signed request"""
        provider_config = await self.load_settings()
        
        def _fetch_profile():
            """Synchronous function to fetch profile with OAuth1Session"""
            oauth = OAuth1Session(
                client_key=provider_config['clientId'],
                client_secret=provider_config['clientSecret'],
                resource_owner_key=access_token,
                resource_owner_secret=token_secret
            )
            
            try:
                # Garmin user profile endpoint
                response = oauth.get(f"{self.api_base_url}/wellness-api/rest/user/id")
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "id": str(data.get("userId", "unknown")),
                        "display_name": f"Garmin User {str(data.get('userId', ''))[:8]}"
                    }
                else:
                    logger.warning(f"[GARMIN] Profile fetch returned {response.status_code}: {response.text}")
                    return {"id": "unknown", "display_name": "Garmin User"}
            except Exception as e:
                logger.error(f"[GARMIN] Profile fetch error: {e}")
                return {"id": "unknown", "display_name": "Garmin User"}
        
        # Run in thread pool
        return await run_in_threadpool(_fetch_profile)
    
    async def sync_activities(self, user_id: str, force_full_sync: bool = False) -> Dict[str, Any]:
        """
        Sync Garmin activities to database with OAuth 1.0a signed requests
        """
        logger.info(f"[GARMIN SYNC] Starting sync for user: {user_id}, force_full={force_full_sync}")
        
        connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
        if not connection:
            raise HTTPException(status_code=404, detail=f"{self.provider_name.title()} not connected")
        
        # Determine date range
        if force_full_sync:
            start_date = (datetime.now(timezone.utc) - timedelta(days=180)).strftime("%Y-%m-%d")
            logger.info(f"[GARMIN SYNC] Full sync - fetching last 180 days")
        else:
            last_sync = connection.get("last_sync_at")
            if last_sync:
                start_date = last_sync.strftime("%Y-%m-%d")
                logger.info(f"[GARMIN SYNC] Incremental sync from: {start_date}")
            else:
                start_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
                logger.info(f"[GARMIN SYNC] First sync - fetching last 30 days")
        
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        # Fetch activities
        activities = await self.fetch_activities(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date
        )
        
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
        
        logger.info(f"[GARMIN SYNC] Completed: {imported_count} activities imported out of {len(activities)} total")
        
        return {
            "success": True,
            "imported": imported_count,
            "total_activities": len(activities),
            "message": f"Successfully synced {imported_count} activities"
        }
    
    async def fetch_activities(self, user_id: str, start_date: str = None, end_date: str = None) -> List[Dict[str, Any]]:
        """Fetch activities from Garmin API with OAuth 1.0a signed requests"""
        connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
        if not connection:
            raise HTTPException(status_code=404, detail=f"{self.provider_name.title()} not connected")
        
        provider_config = await self.load_settings()
        
        def _fetch_activities():
            """Synchronous function to fetch activities with OAuth1Session"""
            oauth = OAuth1Session(
                client_key=provider_config['clientId'],
                client_secret=provider_config['clientSecret'],
                resource_owner_key=connection['access_token'],
                resource_owner_secret=connection['token_secret']
            )
            
            try:
                # Garmin wellness API endpoint
                url = f"{self.api_base_url}/wellness-api/rest/activities"
                params = {}
                if start_date:
                    params['uploadStartTimeInSeconds'] = int(datetime.fromisoformat(start_date).timestamp())
                if end_date:
                    params['uploadEndTimeInSeconds'] = int(datetime.fromisoformat(end_date).timestamp())
                
                response = oauth.get(url, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    activities = []
                    for activity in data:
                        # Transform Garmin activity format to our format
                        activities.append({
                            "id": str(activity.get("activityId")),
                            "name": activity.get("activityName", "Garmin Activity"),
                            "type": activity.get("activityType", {}).get("typeKey", "unknown"),
                            "start_date": activity.get("startTimeLocal"),
                            "duration": activity.get("duration"),
                            "distance_km": activity.get("distance", 0) / 1000 if activity.get("distance") else 0,
                            "calories": activity.get("calories", 0),
                            "avg_heart_rate": activity.get("averageHR"),
                            "max_heart_rate": activity.get("maxHR"),
                            "elevation_gain": activity.get("elevationGain"),
                            "raw_data": activity
                        })
                    return activities
                else:
                    logger.warning(f"[GARMIN] Activities fetch returned {response.status_code}: {response.text}")
                    return []
            except Exception as e:
                logger.error(f"[GARMIN] Activities fetch error: {e}")
                return []
        
        # Run in thread pool
        return await run_in_threadpool(_fetch_activities)
    
    def transform_activity_to_calendar(self, activity: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Garmin activity to training calendar format"""
        start_date = activity.get("start_date", activity.get("date", ""))
        if "T" not in start_date:
            start_date = f"{start_date}T00:00:00"
        
        return {
            "title": activity.get("name", "Garmin Activity"),
            "start_date": start_date,
            "block_type": "training",
            "source": "garmin",
            "garmin_data": {
                "activity_id": activity.get("id"),
                "type": activity.get("type"),
                "duration_seconds": activity.get("duration", 0),
                "distance_km": activity.get("distance_km", 0),
                "calories": activity.get("calories", 0),
                "heart_rate_avg": activity.get("avg_heart_rate"),
                "heart_rate_max": activity.get("max_heart_rate"),
                "elevation_gain": activity.get("elevation_gain", 0)
            }
        }
    
    async def get_stats(self, user_id: str) -> Dict[str, Any]:
        """Get Garmin activity statistics"""
        # Limit to 10000 most recent activities to prevent memory issues
        activities = await self.db[f"{self.provider_name}_activities"].find(
            {"user_id": user_id}
        ).sort("date", -1).limit(10000).to_list(length=10000)
        
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
        
        return {
            "total_activities": total_activities,
            "total_distance_km": round(total_distance_km, 2),
            "total_calories": int(total_calories),
            "by_type": by_type
        }
