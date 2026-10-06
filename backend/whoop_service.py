"""
WHOOP Integration Service
Extends BaseIntegrationService for WHOOP fitness tracker data sync
"""

import httpx
import logging
import base64
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from integration_service import BaseIntegrationService
from fastapi import HTTPException


class WhoopService(BaseIntegrationService):
    """WHOOP integration service"""
    
    @property
    def provider_name(self) -> str:
        return "whoop"
    
    @property
    def oauth_authorize_url(self) -> str:
        return "https://api.prod.whoop.com/oauth/oauth2/auth"
    
    @property
    def oauth_token_url(self) -> str:
        return "https://api.prod.whoop.com/oauth/oauth2/token"
    
    @property
    def api_base_url(self) -> str:
        return "https://api.prod.whoop.com/developer/v2"
    
    async def exchange_code_for_tokens(self, code: str, state: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access token
        WHOOP uses standard OAuth2
        """
        # Verify state
        oauth_state = await self.db[f"{self.provider_name}_oauth_state"].find_one({"state": state})
        if not oauth_state:
            raise HTTPException(status_code=400, detail="Invalid OAuth state")
        
        user_id = oauth_state["user_id"]
        
        # Load settings
        provider_config = await self.load_settings()
        callback_url = self.get_callback_url(provider_config)
        
        logging.info(f"[WHOOP] Token exchange")
        logging.info(f"  URL: {self.oauth_token_url}")
        logging.info(f"  client_id: {provider_config['clientId']}")
        
        # Exchange code for token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.oauth_token_url,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": provider_config['clientId'],
                    "client_secret": provider_config['clientSecret'],
                    "redirect_uri": callback_url
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            )
            
            logging.info(f"[WHOOP] Token exchange status: {response.status_code}")
            
            if response.status_code != 200:
                logging.error(f"[WHOOP] Token exchange failed: {response.text}")
                raise HTTPException(status_code=400, detail="WHOOP token exchange failed")
            
            token_data = response.json()
            logging.info(f"[WHOOP] Token response keys: {list(token_data.keys())}")
        
        # Fetch user profile
        user_profile = await self.fetch_user_profile(token_data["access_token"])
        
        # WHOOP tokens typically expire after 3600 seconds (1 hour)
        expires_in = token_data.get("expires_in", 3600)
        
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
            logging.info(f"[WHOOP] Database save result: matched={result.matched_count}, modified={result.modified_count}, upserted_id={result.upserted_id}")
            
            # Verify it was saved
            saved_connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
            if saved_connection:
                logging.info(f"[WHOOP] Connection verified in database for user: {user_id}")
            else:
                logging.error(f"[WHOOP] Connection NOT found in database after save!")
        except Exception as e:
            logging.error(f"[WHOOP] Error saving connection: {e}")
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
        """Fetch WHOOP user profile"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.api_base_url}/user/profile/basic",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Accept": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "id": str(data.get("user_id", "unknown")),
                        "display_name": f"{data.get('first_name', '')} {data.get('last_name', '')}".strip() or "WHOOP User",
                        "email": data.get("email", "")
                    }
                else:
                    logging.warning(f"[WHOOP] Profile fetch returned {response.status_code}")
                    return {"id": "unknown", "display_name": "WHOOP User"}
                    
            except Exception as e:
                logging.error(f"[WHOOP] Profile fetch error: {e}")
                return {"id": "unknown", "display_name": "WHOOP User"}
    
    async def sync_activities(self, user_id: str, force_full_sync: bool = False) -> Dict[str, Any]:
        """
        Sync WHOOP data to database (cycles, recovery, sleep, workouts)
        """
        logging.info(f"[WHOOP SYNC] Starting sync for user: {user_id}, force_full={force_full_sync}")
        
        connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
        if not connection:
            raise HTTPException(status_code=404, detail=f"{self.provider_name.title()} not connected")
        
        # Determine date range
        if force_full_sync:
            start_date = (datetime.now(timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
            logging.info(f"[WHOOP SYNC] Full sync - fetching last 90 days")
        else:
            last_sync = connection.get("last_sync_at")
            if last_sync:
                start_date = last_sync.strftime("%Y-%m-%dT%H:%M:%S.000Z")
                logging.info(f"[WHOOP SYNC] Incremental sync from: {start_date}")
            else:
                start_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
                logging.info(f"[WHOOP SYNC] First sync - fetching last 30 days")
        
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        
        # Fetch cycles and workouts
        cycles = await self.fetch_cycles(user_id, start_date, end_date)
        workouts = await self.fetch_workouts(user_id, start_date, end_date)
        
        # Store in database
        imported_count = 0
        
        # Store cycles
        for cycle in cycles:
            cycle["user_id"] = user_id
            cycle["synced_at"] = datetime.now(timezone.utc)
            
            result = await self.db[f"{self.provider_name}_cycles"].update_one(
                {"user_id": user_id, "id": cycle["id"]},
                {"$set": cycle},
                upsert=True
            )
            if result.upserted_id or result.modified_count > 0:
                imported_count += 1
        
        # Store workouts
        for workout in workouts:
            workout["user_id"] = user_id
            workout["synced_at"] = datetime.now(timezone.utc)
            
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
        
        logging.info(f"[WHOOP SYNC] Completed: {imported_count} items imported")
        
        return {
            "success": True,
            "imported": imported_count,
            "total_items": len(cycles) + len(workouts),
            "message": f"Successfully synced {imported_count} items"
        }
    
    async def fetch_cycles(self, user_id: str, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        """Fetch WHOOP physiological cycles"""
        connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
        if not connection:
            return []
        
        cycles = []
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.api_base_url}/cycle",
                    headers={
                        "Authorization": f"Bearer {connection['access_token']}",
                        "Accept": "application/json"
                    },
                    params={
                        "start": start_date,
                        "end": end_date,
                        "limit": 25
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    for record in data.get("records", []):
                        cycles.append({
                            "id": str(record.get("id")),
                            "start": record.get("start"),
                            "end": record.get("end"),
                            "strain": record.get("score", {}).get("strain", 0),
                            "recovery_score": record.get("score", {}).get("recovery", 0),
                            "avg_heart_rate": record.get("score", {}).get("average_heart_rate", 0)
                        })
                
                logging.info(f"[WHOOP] Fetched {len(cycles)} cycles for user {user_id}")
                return cycles
                
            except Exception as e:
                logging.error(f"[WHOOP] Cycle fetch error: {e}")
                return []
    
    async def fetch_workouts(self, user_id: str, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        """Fetch WHOOP workout activities"""
        connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
        if not connection:
            return []
        
        workouts = []
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.api_base_url}/activity/workout",
                    headers={
                        "Authorization": f"Bearer {connection['access_token']}",
                        "Accept": "application/json"
                    },
                    params={
                        "start": start_date,
                        "end": end_date,
                        "limit": 25
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    for record in data.get("records", []):
                        workouts.append({
                            "id": str(record.get("id")),
                            "date": record.get("start"),
                            "start_date": record.get("start"),
                            "type": record.get("sport_name", "Workout"),
                            "strain": record.get("score", {}).get("strain", 0),
                            "calories": record.get("score", {}).get("kilojoule", 0),
                            "heart_rate_avg": record.get("score", {}).get("average_heart_rate", 0),
                            "heart_rate_max": record.get("score", {}).get("max_heart_rate", 0)
                        })
                
                logging.info(f"[WHOOP] Fetched {len(workouts)} workouts for user {user_id}")
                return workouts
                
            except Exception as e:
                logging.error(f"[WHOOP] Workout fetch error: {e}")
                return []
    
    async def fetch_activities(self, user_id: str, start_date: str = None, end_date: str = None) -> List[Dict[str, Any]]:
        """Fetch all WHOOP activities (wrapper for workouts)"""
        if not start_date:
            start_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        if not end_date:
            end_date = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        
        return await self.fetch_workouts(user_id, start_date, end_date)
    
    def transform_activity_to_calendar(self, activity: Dict[str, Any]) -> Dict[str, Any]:
        """Transform WHOOP activity to training calendar format"""
        start_date = activity.get("start_date", activity.get("date", ""))
        
        return {
            "title": activity.get("type", "WHOOP Activity"),
            "start_date": start_date,
            "block_type": "training",
            "source": "whoop",
            "whoop_data": {
                "activity_id": activity.get("id"),
                "type": activity.get("type"),
                "strain": activity.get("strain", 0),
                "calories": activity.get("calories", 0),
                "heart_rate_avg": activity.get("heart_rate_avg"),
                "heart_rate_max": activity.get("heart_rate_max")
            }
        }
    
    async def get_stats(self, user_id: str) -> Dict[str, Any]:
        """Get WHOOP activity statistics"""
        activities = await self.db[f"{self.provider_name}_activities"].find(
            {"user_id": user_id}
        ).to_list(length=None)
        
        total_activities = len(activities)
        total_strain = sum(a.get("strain", 0) for a in activities)
        total_calories = sum(a.get("calories", 0) for a in activities)
        
        # Group by type
        by_type = {}
        for activity in activities:
            activity_type = activity.get("type", "Unknown")
            if activity_type not in by_type:
                by_type[activity_type] = {
                    "count": 0,
                    "total_strain": 0,
                    "total_calories": 0
                }
            by_type[activity_type]["count"] += 1
            by_type[activity_type]["total_strain"] += activity.get("strain", 0)
            by_type[activity_type]["total_calories"] += activity.get("calories", 0)
        
        stats = {
            "total_activities": total_activities,
            "total_strain": round(total_strain, 2),
            "total_calories": int(total_calories),
            "by_type": by_type
        }
        
        return stats
