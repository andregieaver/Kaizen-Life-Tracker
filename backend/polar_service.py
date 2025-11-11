"""
Polar Flow Integration Service
Extends BaseIntegrationService for Polar fitness tracker data sync
"""

import httpx
import logging
import base64
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from integration_service import BaseIntegrationService
from fastapi import HTTPException


class PolarService(BaseIntegrationService):
    """Polar Flow integration service"""
    
    @property
    def provider_name(self) -> str:
        return "polar"
    
    @property
    def oauth_authorize_url(self) -> str:
        return "https://flow.polar.com/oauth2/authorization"
    
    @property
    def oauth_token_url(self) -> str:
        return "https://polarremote.com/v2/oauth2/token"
    
    @property
    def api_base_url(self) -> str:
        return "https://www.polaraccesslink.com/v3"
    
    async def exchange_code_for_tokens(self, code: str, state: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access token
        Polar requires Basic Authentication (not body credentials)
        """
        # Verify state
        oauth_state = await self.db[f"{self.provider_name}_oauth_state"].find_one({"state": state})
        if not oauth_state:
            raise HTTPException(status_code=400, detail="Invalid OAuth state")
        
        user_id = oauth_state["user_id"]
        
        # Load settings
        provider_config = await self.load_settings()
        callback_url = self.get_callback_url(provider_config)
        
        # Create Basic Auth header (Polar requirement)
        credentials = f"{provider_config['clientId']}:{provider_config['clientSecret']}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        logging.info(f"[POLAR] Token exchange with Basic Auth")
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
                    "Accept": "application/json;charset=UTF-8"
                },
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": callback_url
                }
            )
            
            logging.info(f"[POLAR] Token exchange status: {response.status_code}")
            
            if response.status_code != 200:
                logging.error(f"[POLAR] Token exchange failed: {response.text}")
                logging.error(f"[POLAR] Response headers: {response.headers}")
                raise HTTPException(status_code=400, detail="Polar token exchange failed")
            
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
    
    async def fetch_user_profile(self, access_token: str) -> Dict[str, Any]:
        """Fetch Polar user profile"""
        async with httpx.AsyncClient() as client:
            try:
                # Register user if not already registered
                response = await client.post(
                    f"{self.api_base_url}/users",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                
                if response.status_code in [200, 409]:  # 200 = registered, 409 = already exists
                    # Get user info
                    user_response = await client.get(
                        f"{self.api_base_url}/users",
                        headers={"Authorization": f"Bearer {access_token}"}
                    )
                    
                    if user_response.status_code == 200:
                        data = user_response.json()
                        return {
                            "id": data.get("polar-user-id"),
                            "registered": data.get("registration-date")
                        }
                
                logging.warning(f"Failed to fetch Polar profile: {response.status_code}")
                return {"id": "unknown"}
                
            except Exception as e:
                logging.error(f"Error fetching Polar profile: {e}")
                return {"id": "unknown"}
    
    async def fetch_activities(
        self, 
        access_token: str, 
        since: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Fetch training sessions (exercises) from Polar"""
        activities = []
        
        async with httpx.AsyncClient() as client:
            try:
                # Step 1: Create transaction to get exercise data
                transaction_response = await client.post(
                    f"{self.api_base_url}/exercises",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                
                if transaction_response.status_code != 201:
                    logging.warning(f"Failed to create Polar transaction: {transaction_response.status_code}")
                    return activities
                
                transaction_data = transaction_response.json()
                transaction_id = transaction_data.get("transaction-id")
                
                if not transaction_id:
                    return activities
                
                # Step 2: Get list of available exercises
                exercises_url = transaction_data.get("resource-uri")
                if not exercises_url:
                    return activities
                
                exercises_response = await client.get(
                    exercises_url,
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                
                if exercises_response.status_code != 200:
                    logging.warning(f"Failed to get Polar exercises: {exercises_response.status_code}")
                    return activities
                
                exercises_list = exercises_response.json()
                exercise_urls = exercises_list.get("exercises", [])
                
                # Step 3: Fetch each exercise detail
                for exercise_url in exercise_urls[:50]:  # Limit to 50 most recent
                    try:
                        exercise_response = await client.get(
                            exercise_url,
                            headers={"Authorization": f"Bearer {access_token}"}
                        )
                        
                        if exercise_response.status_code == 200:
                            exercise = exercise_response.json()
                            
                            # Parse start time
                            start_time_str = exercise.get("start-time")
                            if start_time_str:
                                start_date = datetime.fromisoformat(start_time_str.replace("Z", "+00:00"))
                            else:
                                start_date = datetime.now(timezone.utc)
                            
                            # Filter by date if needed
                            if since and since.year > 1970:
                                if start_date < since:
                                    continue
                            
                            activities.append({
                                "activity_id": exercise.get("id"),
                                "type": exercise.get("sport", "Unknown"),
                                "start_date": start_date,
                                "duration": exercise.get("duration"),  # in format like "PT1H30M45S"
                                "distance": exercise.get("distance"),  # in meters
                                "calories": exercise.get("calories"),
                                "heart_rate_avg": exercise.get("heart-rate", {}).get("average"),
                                "heart_rate_max": exercise.get("heart-rate", {}).get("maximum"),
                                "training_load": exercise.get("training-load"),
                                "raw_data": exercise
                            })
                            
                    except Exception as e:
                        logging.error(f"Error fetching Polar exercise detail: {e}")
                        continue
                
                # Step 4: Commit transaction
                commit_response = await client.put(
                    f"{self.api_base_url}/exercises/{transaction_id}",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                
                if commit_response.status_code != 204:
                    logging.warning(f"Failed to commit Polar transaction: {commit_response.status_code}")
                
            except Exception as e:
                logging.error(f"Error fetching Polar activities: {e}")
        
        logging.info(f"[POLAR] Fetched {len(activities)} activities")
        return activities
    
    def transform_activity_to_calendar(self, activity: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Polar activity to calendar block format"""
        start_date = activity.get("start_date")
        
        if isinstance(start_date, datetime):
            date_str = start_date.strftime("%Y-%m-%d")
        else:
            date_str = str(start_date)[:10]
        
        # Parse duration (ISO 8601 format like "PT1H30M45S")
        duration_str = activity.get("duration", "")
        duration_minutes = 0
        if duration_str:
            import re
            hours = re.search(r'(\d+)H', duration_str)
            minutes = re.search(r'(\d+)M', duration_str)
            seconds = re.search(r'(\d+)S', duration_str)
            
            duration_minutes = (
                (int(hours.group(1)) * 60 if hours else 0) +
                (int(minutes.group(1)) if minutes else 0) +
                (int(seconds.group(1)) / 60 if seconds else 0)
            )
        
        block = {
            "id": f"polar_{activity.get('activity_id')}",
            "athlete_id": activity.get("user_id"),
            "title": f"Polar {activity.get('type', 'Workout')}",
            "description": f"From Polar Flow",
            "block_type": "training",
            "workout_type": activity.get("type", "").lower(),
            "start_date": date_str,
            "end_date": date_str,
            "distance": round(activity.get("distance", 0) / 1000, 2) if activity.get("distance") else None,
            "duration_minutes": round(duration_minutes) if duration_minutes else None,
            "source": "polar",
            "polar_data": {
                "activity_id": activity.get("activity_id"),
                "calories": activity.get("calories"),
                "heart_rate_avg": activity.get("heart_rate_avg"),
                "heart_rate_max": activity.get("heart_rate_max"),
                "training_load": activity.get("training_load")
            }
        }
        
        return block
    
    async def get_stats(self, user_id: str) -> Dict[str, Any]:
        """Get Polar statistics (Year to Date 2025)"""
        ytd_start = datetime(2025, 1, 1, 0, 0, 0)
        
        pipeline = [
            {"$match": {
                "user_id": user_id,
                "start_date": {"$gte": ytd_start}
            }},
            {"$group": {
                "_id": "$type",
                "count": {"$sum": 1},
                "total_distance": {"$sum": "$distance"},
                "total_calories": {"$sum": "$calories"}
            }}
        ]
        
        result = await self.db.polar_activities.aggregate(pipeline).to_list(length=100)
        
        total_activities = sum(r["count"] for r in result)
        total_distance_km = sum(r.get("total_distance", 0) for r in result) / 1000
        total_calories = sum(r.get("total_calories", 0) for r in result)
        
        stats = {
            "total_activities": total_activities,
            "total_distance_km": round(total_distance_km, 1),
            "total_calories": int(total_calories),
            "by_type": {}
        }
        
        for item in result:
            activity_type = item["_id"]
            stats["by_type"][activity_type] = {
                "count": item["count"],
                "distance_km": round(item.get("total_distance", 0) / 1000, 1),
                "calories": int(item.get("total_calories", 0))
            }
        
        return stats
