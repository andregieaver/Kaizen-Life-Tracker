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
        
        async with httpx.AsyncClient() as client:
            # Fetch daily sleep data (includes sleep score)
            try:
                sleep_response = await client.get(
                    f"{self.api_base_url}/daily_sleep",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={"start_date": start_date, "end_date": end_date}
                )
                
                if sleep_response.status_code == 200:
                    sleep_data = sleep_response.json()
                    for sleep in sleep_data.get("data", []):
                        # Debug logging to see what fields Oura API returns
                        logging.info(f"[OURA] Sleep data fields for {sleep.get('day')}: score={sleep.get('score')}, lowest_hr={sleep.get('lowest_heart_rate')}, avg_hrv={sleep.get('average_hrv')}")
                        
                        # daily_sleep endpoint has timestamp instead of bedtime_start
                        timestamp_str = sleep.get("timestamp") or sleep.get("day")
                        if timestamp_str:
                            # Parse the timestamp or use day as date
                            try:
                                start_date_parsed = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                            except:
                                # Fallback to day field
                                start_date_parsed = datetime.fromisoformat(sleep["day"] + "T00:00:00+00:00")
                        else:
                            start_date_parsed = datetime.now()
                        
                        activities.append({
                            "activity_id": f"sleep_{sleep['id']}",
                            "type": "Sleep",
                            "start_date": start_date_parsed,
                            "duration": sleep.get("total_sleep_duration"),
                            "score": sleep.get("score"),  # daily_sleep has score!
                            "deep_sleep": sleep.get("deep_sleep_duration"),
                            "rem_sleep": sleep.get("rem_sleep_duration"),
                            "light_sleep": sleep.get("light_sleep_duration"),
                            "efficiency": sleep.get("efficiency"),
                            "lowest_heart_rate": sleep.get("lowest_heart_rate"),
                            "average_heart_rate": sleep.get("average_heart_rate"),
                            "average_hrv": sleep.get("average_hrv"),
                            "raw_data": sleep
                        })
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
