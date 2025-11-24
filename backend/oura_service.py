"""
Oura Integration Service
Extends BaseIntegrationService for Oura Ring data sync
"""

import httpx
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from integration_service import BaseIntegrationService


class OuraService(BaseIntegrationService):
    """Oura Ring integration service"""
    
    @property
    def provider_name(self) -> str:
        return "oura"
    
    @property
    def oauth_authorize_url(self) -> str:
        return "https://cloud.ouraring.com/oauth/authorize"
    
    @property
    def oauth_token_url(self) -> str:
        return "https://api.ouraring.com/oauth/token"
    
    @property
    def api_base_url(self) -> str:
        return "https://api.ouraring.com/v2/usercollection"
    
    async def fetch_user_profile(self, access_token: str) -> Dict[str, Any]:
        """Fetch Oura user profile"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/personal_info",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "id": data.get("id"),
                    "age": data.get("age"),
                    "email": data.get("email")
                }
            else:
                logging.warning(f"Failed to fetch Oura profile: {response.status_code}")
                return {"id": "unknown"}
    
    async def fetch_activities(
        self, 
        access_token: str, 
        since: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Fetch sleep and readiness data from Oura"""
        activities = []
        
        # Determine date range
        if since and since.year > 1970:  # Not epoch
            start_date = since.strftime("%Y-%m-%d")
        else:
            # For full sync, get last 30 days
            start_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
        
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        logging.info(f"[OURA] Syncing date range: {start_date} to {end_date}")
        
        async with httpx.AsyncClient() as client:
            # First, fetch detailed sleep sessions (has HRV, RHR, duration) - Gen 3 and Gen 4 compatible
            sleep_sessions = {}
            try:
                # The /sleep endpoint requires end_date to be +1 day to include the last day
                sleep_end_date = (datetime.fromisoformat(end_date) + timedelta(days=1)).strftime("%Y-%m-%d")
                sleep_session_response = await client.get(
                    f"{self.api_base_url}/sleep",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={"start_date": start_date, "end_date": sleep_end_date}
                )
                
                if sleep_session_response.status_code == 200:
                    session_data = sleep_session_response.json()
                    logging.info(f"[OURA] /sleep endpoint returned {len(session_data.get('data', []))} sessions")
                    # Build a map of date -> session data for quick lookup
                    for session in session_data.get("data", []):
                        session_day = session.get("day")
                        if session_day:
                            # Store first (primary) session for each day
                            if session_day not in sleep_sessions:
                                sleep_sessions[session_day] = {
                                    "duration": session.get("total_sleep_duration"),
                                    "lowest_heart_rate": session.get("lowest_heart_rate"),
                                    "average_hrv": session.get("average_hrv"),
                                    "average_heart_rate": session.get("average_heart_rate"),
                                    "deep_sleep": session.get("deep_sleep_duration"),
                                    "rem_sleep": session.get("rem_sleep_duration"),
                                    "light_sleep": session.get("light_sleep_duration"),
                                    "efficiency": session.get("efficiency")
                                }
                                logging.info(f"[OURA] Sleep session for {session_day}: RHR={session.get('lowest_heart_rate')}, HRV={session.get('average_hrv')}, Duration={session.get('total_sleep_duration')}")
                else:
                    logging.warning(f"Failed to fetch Oura sleep sessions: {sleep_session_response.status_code}")
            except Exception as e:
                logging.error(f"Error fetching Oura sleep session data: {e}")
            
            # Now fetch daily sleep data (has sleep score)
            try:
                sleep_response = await client.get(
                    f"{self.api_base_url}/daily_sleep",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={"start_date": start_date, "end_date": end_date}
                )
                
                if sleep_response.status_code == 200:
                    sleep_data = sleep_response.json()
                    for sleep in sleep_data.get("data", []):
                        day = sleep.get('day')
                        
                        # Merge session data with daily score data
                        session_metrics = sleep_sessions.get(day, {})
                        
                        # daily_sleep endpoint has timestamp instead of bedtime_start
                        timestamp_str = sleep.get("timestamp") or day
                        if timestamp_str:
                            try:
                                start_date_parsed = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                            except:
                                start_date_parsed = datetime.fromisoformat(day + "T00:00:00+00:00")
                        else:
                            start_date_parsed = datetime.now()
                        
                        # Use session data if available, fallback to daily_sleep data
                        activities.append({
                            "activity_id": f"sleep_{sleep['id']}",
                            "type": "Sleep",
                            "start_date": start_date_parsed,
                            "duration": session_metrics.get("duration") or sleep.get("total_sleep_duration"),
                            "score": sleep.get("score"),
                            "deep_sleep": session_metrics.get("deep_sleep") or sleep.get("deep_sleep_duration"),
                            "rem_sleep": session_metrics.get("rem_sleep") or sleep.get("rem_sleep_duration"),
                            "light_sleep": session_metrics.get("light_sleep") or sleep.get("light_sleep_duration"),
                            "efficiency": session_metrics.get("efficiency") or sleep.get("efficiency"),
                            "lowest_heart_rate": session_metrics.get("lowest_heart_rate"),
                            "average_heart_rate": session_metrics.get("average_heart_rate"),
                            "average_hrv": session_metrics.get("average_hrv"),
                            "raw_data": sleep
                        })
                        
                        logging.info(f"[OURA] Merged sleep for {day}: score={sleep.get('score')}, RHR={session_metrics.get('lowest_heart_rate')}, HRV={session_metrics.get('average_hrv')}")
                else:
                    logging.warning(f"Failed to fetch Oura daily_sleep: {sleep_response.status_code}")
            except Exception as e:
                logging.error(f"Error fetching Oura daily_sleep data: {e}")
            
            # Fetch readiness data
            try:
                readiness_response = await client.get(
                    f"{self.api_base_url}/daily_readiness",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={"start_date": start_date, "end_date": end_date}
                )
                
                if readiness_response.status_code == 200:
                    readiness_data = readiness_response.json()
                    for readiness in readiness_data.get("data", []):
                        activities.append({
                            "activity_id": f"readiness_{readiness['id']}",
                            "type": "Readiness",
                            "start_date": datetime.fromisoformat(readiness["day"] + "T00:00:00+00:00"),
                            "score": readiness.get("score"),
                            "temperature_deviation": readiness.get("temperature_deviation"),
                            "temperature_trend_deviation": readiness.get("temperature_trend_deviation"),
                            "raw_data": readiness
                        })
                else:
                    logging.warning(f"Failed to fetch Oura readiness: {readiness_response.status_code}")
            except Exception as e:
                logging.error(f"Error fetching Oura readiness data: {e}")
            
            # Fetch activity data
            try:
                activity_response = await client.get(
                    f"{self.api_base_url}/daily_activity",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={"start_date": start_date, "end_date": end_date}
                )
                
                if activity_response.status_code == 200:
                    activity_data = activity_response.json()
                    for activity in activity_data.get("data", []):
                        activities.append({
                            "activity_id": f"activity_{activity['id']}",
                            "type": "Activity",
                            "start_date": datetime.fromisoformat(activity["day"] + "T00:00:00+00:00"),
                            "score": activity.get("score"),
                            "active_calories": activity.get("active_calories"),
                            "steps": activity.get("steps"),
                            "equivalent_walking_distance": activity.get("equivalent_walking_distance"),
                            "high_activity_time": activity.get("high_activity_time"),
                            "medium_activity_time": activity.get("medium_activity_time"),
                            "low_activity_time": activity.get("low_activity_time"),
                            "raw_data": activity
                        })
                else:
                    logging.warning(f"Failed to fetch Oura activity: {activity_response.status_code}")
            except Exception as e:
                logging.error(f"Error fetching Oura activity data: {e}")
        
        logging.info(f"[OURA] Fetched {len(activities)} total data points")
        return activities
    
    def transform_activity_to_calendar(self, activity: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Oura data to calendar block format"""
        activity_type = activity.get("type", "Activity")
        start_date = activity.get("start_date")
        
        if isinstance(start_date, datetime):
            date_str = start_date.strftime("%Y-%m-%d")
        else:
            date_str = str(start_date)[:10]
        
        block = {
            "id": f"oura_{activity.get('activity_id')}",
            "athlete_id": activity.get("user_id"),
            "title": f"Oura {activity_type}",
            "description": f"Score: {activity.get('score', 'N/A')}\nFrom Oura Ring",
            "block_type": "health",
            "workout_type": activity_type.lower(),
            "start_date": date_str,
            "end_date": date_str,
            "source": "oura",
            "oura_data": {
                "activity_id": activity.get("activity_id"),
                "type": activity_type,
                "score": activity.get("score"),
                "duration": activity.get("duration"),
                "steps": activity.get("steps"),
                "sleep_score": activity.get("score") if activity_type == "Sleep" else None,
                "readiness_score": activity.get("score") if activity_type == "Readiness" else None
            }
        }
        
        # Add type-specific data
        if activity_type == "Sleep":
            block["duration_minutes"] = round(activity.get("duration", 0) / 60) if activity.get("duration") else None
            block["oura_data"]["deep_sleep"] = activity.get("deep_sleep")
            block["oura_data"]["rem_sleep"] = activity.get("rem_sleep")
            block["oura_data"]["efficiency"] = activity.get("efficiency")
        elif activity_type == "Activity":
            block["oura_data"]["active_calories"] = activity.get("active_calories")
            block["oura_data"]["steps"] = activity.get("steps")
        
        return block
    
    async def exchange_code_for_tokens(self, code: str, state: str) -> Dict[str, Any]:
        """Override to save connection with athlete_id field"""
        # Verify and get OAuth state
        oauth_state = await self.db.oura_oauth_state.find_one({"state": state})
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
            
            if response.status_code != 200:
                logging.error(f"[OURA] Token exchange failed: {response.text}")
                raise HTTPException(status_code=400, detail="Oura token exchange failed")
            
            token_data = response.json()
        
        # Fetch user profile
        user_profile = await self.fetch_user_profile(token_data["access_token"])
        
        # Store connection with athlete_id (not user_id)
        connection_data = {
            "athlete_id": user_id,  # PRIMARY FIELD
            "user_id": user_id,     # COMPATIBILITY
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
        
        logging.info(f"[OURA] Saving connection with athlete_id: {user_id}")
        result = await self.db.oura_connections.update_one(
            {"athlete_id": user_id},  # Match on athlete_id
            {"$set": connection_data},
            upsert=True
        )
        logging.info(f"[OURA] Database save result: matched={result.matched_count}, modified={result.modified_count}")
        
        # Clean up OAuth state
        await self.db.oura_oauth_state.delete_one({"_id": oauth_state["_id"]})
        
        return {
            "connected": True,
            "user_id": user_id,
            "profile": user_profile,
            "connected_at": connection_data["connected_at"].isoformat()
        }
    
    async def get_valid_token(self, user_id: str) -> str:
        """Get a valid access token, using athlete_id field"""
        connection = await self.db.oura_connections.find_one({"athlete_id": user_id})
        if not connection:
            raise HTTPException(status_code=404, detail="Oura not connected")
        
        expires_at = connection.get("expires_at")
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        # Check if token is expired
        if expires_at and datetime.now(timezone.utc) >= expires_at:
            # Refresh token
            return await self.refresh_token(user_id)
        
        return connection["access_token"]
    
    async def refresh_token(self, user_id: str) -> str:
        """Refresh the access token, using athlete_id field"""
        connection = await self.db.oura_connections.find_one({"athlete_id": user_id})
        if not connection or not connection.get("refresh_token"):
            raise HTTPException(status_code=404, detail="Cannot refresh token")
        
        provider_config = await self.load_settings()
        
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
        await self.db.oura_connections.update_one(
            {"athlete_id": user_id},
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
        """Override to handle both user_id and athlete_id"""
        logging.info(f"[OURA SYNC] user_id={user_id}, force_full_sync={force_full_sync}")
        
        # Check connection with athlete_id (our field name)
        connection = await self.db.oura_connections.find_one({"athlete_id": user_id})
        if not connection:
            raise HTTPException(status_code=404, detail="Oura not connected")
        
        # Determine starting point
        if since is None:
            if force_full_sync:
                since = datetime.fromtimestamp(0, tz=timezone.utc)
                logging.info(f"[OURA SYNC] FULL SYNC MODE: Fetching ALL historical data")
            else:
                since = connection.get("last_sync_at") or connection["connected_at"]
            
            if since and not since.tzinfo:
                since = since.replace(tzinfo=timezone.utc)
        
        logging.info(f"[OURA SYNC] Fetching data since: {since}")
        
        # Get valid token
        token = await self.get_valid_token(user_id)
        
        # Fetch activities
        activities = await self.fetch_activities(token, since)
        logging.info(f"[OURA SYNC] Fetched {len(activities)} activities")
        
        # Store activities with athlete_id
        imported_count = 0
        for activity in activities:
            activity["athlete_id"] = user_id  # Use athlete_id instead of user_id
            activity["user_id"] = user_id  # Also store user_id for compatibility
            
            # Convert datetime to string for MongoDB
            if isinstance(activity.get("start_date"), datetime):
                activity["date"] = activity["start_date"].strftime("%Y-%m-%d")
            
            await self.db.oura_activities.update_one(
                {"athlete_id": user_id, "activity_id": activity.get("activity_id")},
                {"$set": activity},
                upsert=True
            )
            imported_count += 1
        
        # Update last sync time
        await self.db.oura_connections.update_one(
            {"athlete_id": user_id},
            {"$set": {
                "last_sync_at": datetime.now(timezone.utc),
                "sync_status": "completed"
            }}
        )
        
        return {
            "imported": imported_count,
            "total_activities": len(activities)
        }
    
    async def get_stats(self, user_id: str) -> Dict[str, Any]:
        """Get Oura statistics (last 30 days)"""
        ytd_start = datetime(2025, 1, 1, 0, 0, 0)
        
        pipeline = [
            {"$match": {
                "user_id": user_id,
                "start_date": {"$gte": ytd_start}
            }},
            {"$group": {
                "_id": "$type",
                "count": {"$sum": 1},
                "avg_score": {"$avg": "$score"}
            }}
        ]
        
        result = await self.db.oura_activities.aggregate(pipeline).to_list(length=100)
        
        stats = {
            "total_entries": 0,
            "sleep": {"count": 0, "avg_score": 0},
            "readiness": {"count": 0, "avg_score": 0},
            "activity": {"count": 0, "avg_score": 0}
        }
        
        for item in result:
            activity_type = item["_id"].lower()
            count = item["count"]
            avg_score = round(item.get("avg_score", 0))
            
            stats["total_entries"] += count
            stats[activity_type] = {
                "count": count,
                "avg_score": avg_score
            }
        
        return stats
