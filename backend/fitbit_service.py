"""
Fitbit Integration Service
Extends BaseIntegrationService for Fitbit fitness tracker data sync
"""

import httpx
import logging
import base64
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from integration_service import BaseIntegrationService
from fastapi import HTTPException


class FitbitService(BaseIntegrationService):
    """Fitbit integration service"""
    
    @property
    def provider_name(self) -> str:
        return "fitbit"
    
    @property
    def oauth_authorize_url(self) -> str:
        return "https://www.fitbit.com/oauth2/authorize"
    
    @property
    def oauth_token_url(self) -> str:
        return "https://api.fitbit.com/oauth2/token"
    
    @property
    def api_base_url(self) -> str:
        return "https://api.fitbit.com/1"
    
    async def exchange_code_for_tokens(self, code: str, state: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access token
        Fitbit requires Basic Authentication (not body credentials)
        """
        # Verify state
        oauth_state = await self.db[f"{self.provider_name}_oauth_state"].find_one({"state": state})
        if not oauth_state:
            raise HTTPException(status_code=400, detail="Invalid OAuth state")
        
        user_id = oauth_state["user_id"]
        
        # Load settings
        provider_config = await self.load_settings()
        callback_url = self.get_callback_url(provider_config)
        
        # Create Basic Auth header (Fitbit requirement)
        credentials = f"{provider_config['clientId']}:{provider_config['clientSecret']}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        logging.info(f"[FITBIT] Token exchange with Basic Auth")
        logging.info(f"  URL: {self.oauth_token_url}")
        logging.info(f"  client_id: {provider_config['clientId']}")
        logging.info(f"  redirect_uri: {callback_url}")
        
        # Exchange code for token with Basic Auth
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.oauth_token_url,
                headers={
                    "Authorization": f"Basic {encoded_credentials}",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json"
                },
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": callback_url
                }
            )
            
            logging.info(f"[FITBIT] Token exchange status: {response.status_code}")
            
            if response.status_code != 200:
                logging.error(f"[FITBIT] Token exchange failed: {response.text}")
                logging.error(f"[FITBIT] Response headers: {response.headers}")
                raise HTTPException(status_code=400, detail="Fitbit token exchange failed")
            
            token_data = response.json()
            logging.info(f"[FITBIT] Token response keys: {list(token_data.keys())}")
        
        # Fetch user profile
        user_profile = await self.fetch_user_profile(token_data["access_token"])
        
        # Calculate token expiration (Fitbit tokens expire after 8 hours)
        expires_in = token_data.get("expires_in", 28800)  # Default 8 hours
        
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
            logging.info(f"[FITBIT] Database save result: matched={result.matched_count}, modified={result.modified_count}, upserted_id={result.upserted_id}")
            
            # Verify it was saved
            saved_connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
            if saved_connection:
                logging.info(f"[FITBIT] Connection verified in database for user: {user_id}")
            else:
                logging.error(f"[FITBIT] Connection NOT found in database after save!")
        except Exception as e:
            logging.error(f"[FITBIT] Error saving connection: {e}")
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
        """Fetch Fitbit user profile"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.api_base_url}/user/-/profile.json",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Accept": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    user_data = data.get("user", {})
                    return {
                        "id": user_data.get("encodedId", "unknown"),
                        "display_name": user_data.get("displayName", "Fitbit User"),
                        "full_name": user_data.get("fullName", ""),
                        "avatar": user_data.get("avatar", "")
                    }
                else:
                    logging.warning(f"[FITBIT] Profile fetch returned {response.status_code}")
                    return {"id": "unknown", "display_name": "Fitbit User"}
                    
            except Exception as e:
                logging.error(f"[FITBIT] Profile fetch error: {e}")
                return {"id": "unknown", "display_name": "Fitbit User"}
    
    async def fetch_activities(self, user_id: str, start_date: str = None, end_date: str = None) -> List[Dict[str, Any]]:
        """
        Fetch Fitbit activities (step counts, workouts, etc.)
        Uses time series endpoint for efficient data retrieval
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
                # Fetch daily activity summaries
                response = await client.get(
                    f"{self.api_base_url}/user/-/activities/date/{start_date}/{end_date}.json",
                    headers={
                        "Authorization": f"Bearer {connection['access_token']}",
                        "Accept": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Process activities
                    for activity in data.get("activities", []):
                        activities.append({
                            "id": activity.get("logId"),
                            "date": activity.get("startDate"),
                            "start_date": activity.get("startTime"),
                            "type": activity.get("activityName"),
                            "duration_ms": activity.get("duration"),
                            "distance_km": activity.get("distance", 0),
                            "calories": activity.get("calories", 0),
                            "heart_rate_avg": activity.get("averageHeartRate"),
                            "steps": activity.get("steps", 0)
                        })
                    
                    # Also get daily summaries
                    response = await client.get(
                        f"{self.api_base_url}/user/-/activities/steps/date/{start_date}/{end_date}.json",
                        headers={
                            "Authorization": f"Bearer {connection['access_token']}",
                            "Accept": "application/json"
                        }
                    )
                    
                    if response.status_code == 200:
                        steps_data = response.json()
                        for day in steps_data.get("activities-steps", []):
                            if int(day.get("value", 0)) > 0:
                                activities.append({
                                    "id": f"daily_{day['dateTime']}",
                                    "date": day["dateTime"],
                                    "start_date": day["dateTime"],
                                    "type": "Daily Activity",
                                    "steps": int(day["value"]),
                                    "duration_ms": 0,
                                    "distance_km": 0,
                                    "calories": 0
                                })
                
                logging.info(f"[FITBIT] Fetched {len(activities)} activities for user {user_id}")
                return activities
                
            except Exception as e:
                logging.error(f"[FITBIT] Activity fetch error: {e}")
                return []
    
    def transform_activity_to_calendar(self, activity: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Fitbit activity to training calendar format"""
        start_date = activity.get("start_date", activity.get("date", ""))
        if "T" not in start_date:
            start_date = f"{start_date}T00:00:00"
        
        return {
            "title": activity.get("type", "Fitbit Activity"),
            "start_date": start_date,
            "block_type": "training",
            "source": "fitbit",
            "fitbit_data": {
                "activity_id": activity.get("id"),
                "type": activity.get("type"),
                "duration_ms": activity.get("duration_ms", 0),
                "distance_km": activity.get("distance_km", 0),
                "calories": activity.get("calories", 0),
                "heart_rate_avg": activity.get("heart_rate_avg"),
                "steps": activity.get("steps", 0)
            }
        }
    
    async def get_stats(self, user_id: str) -> Dict[str, Any]:
        """Get Fitbit activity statistics"""
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
