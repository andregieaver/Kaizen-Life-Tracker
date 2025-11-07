"""
Strava OAuth and API Integration Service
Handles authentication, token management, and activity syncing
"""

import os
import secrets
import hashlib
import base64
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import httpx
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

# Strava API URLs
STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize"
STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token"
STRAVA_DEAUTH_URL = "https://www.strava.com/oauth/deauthorize"
STRAVA_API_BASE = "https://www.strava.com/api/v3"


class StravaService:
    """Service for managing Strava OAuth and API interactions"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.system_settings = None
    
    async def load_settings(self):
        """Load Strava credentials from system settings"""
        settings_doc = await self.db.system_settings.find_one({})
        if not settings_doc or 'advanced' not in settings_doc or 'strava' not in settings_doc['advanced']:
            raise HTTPException(
                status_code=400,
                detail="Strava API credentials not configured in System Settings"
            )
        
        self.system_settings = settings_doc['advanced']['strava']
        
        # Validate required fields
        required = ['clientId', 'clientSecret', 'callbackDomain']
        missing = [field for field in required if not self.system_settings.get(field)]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Missing Strava configuration: {', '.join(missing)}"
            )
        
        return self.system_settings
    
    def generate_pkce_pair(self) -> Dict[str, str]:
        """Generate PKCE code_verifier and code_challenge"""
        code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')
        code_challenge = base64.urlsafe_b64encode(
            hashlib.sha256(code_verifier.encode('utf-8')).digest()
        ).decode('utf-8').rstrip('=')
        
        return {
            'code_verifier': code_verifier,
            'code_challenge': code_challenge
        }
    
    async def get_authorization_url(self, user_id: str, state: Optional[str] = None) -> Dict[str, str]:
        """
        Generate Strava authorization URL with PKCE
        Returns: { url, state, code_verifier }
        """
        await self.load_settings()
        
        # Generate PKCE pair
        pkce = self.generate_pkce_pair()
        
        # Generate state for CSRF protection
        if not state:
            state = secrets.token_urlsafe(32)
        
        # Store PKCE verifier and state temporarily (expires in 10 minutes)
        await self.db.strava_oauth_state.update_one(
            {'user_id': user_id},
            {
                '$set': {
                    'user_id': user_id,
                    'state': state,
                    'code_verifier': pkce['code_verifier'],
                    'created_at': datetime.now(timezone.utc),
                    'expires_at': datetime.now(timezone.utc) + timedelta(minutes=10)
                }
            },
            upsert=True
        )
        
        # Build authorization URL
        callback_url = f"https://{self.system_settings['callbackDomain']}/api/auth/strava/callback"
        
        params = {
            'client_id': self.system_settings['clientId'],
            'redirect_uri': callback_url,
            'response_type': 'code',
            'scope': 'read,activity:read,activity:read_all,profile:read_all',
            'state': state,
            'approval_prompt': 'auto'
        }
        
        # Build query string
        query = '&'.join(f"{k}={v}" for k, v in params.items())
        auth_url = f"{STRAVA_AUTHORIZE_URL}?{query}"
        
        return {
            'url': auth_url,
            'state': state,
            'code_verifier': pkce['code_verifier']
        }
    
    async def exchange_code_for_tokens(
        self, 
        code: str, 
        state: str, 
        user_id: str
    ) -> Dict[str, Any]:
        """
        Exchange authorization code for access and refresh tokens
        """
        await self.load_settings()
        
        # Verify state and retrieve code_verifier
        oauth_state = await self.db.strava_oauth_state.find_one({
            'user_id': user_id,
            'state': state
        })
        
        if not oauth_state:
            raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
        
        # Check expiration
        if datetime.now(timezone.utc) > oauth_state['expires_at']:
            await self.db.strava_oauth_state.delete_one({'_id': oauth_state['_id']})
            raise HTTPException(status_code=400, detail="OAuth state expired")
        
        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            response = await client.post(
                STRAVA_TOKEN_URL,
                json={
                    'client_id': self.system_settings['clientId'],
                    'client_secret': self.system_settings['clientSecret'],
                    'code': code,
                    'grant_type': 'authorization_code'
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Strava token exchange failed: {response.text}"
                )
            
            token_data = response.json()
        
        # Store connection in database
        connection_data = {
            'user_id': user_id,
            'athlete_id': token_data['athlete']['id'],
            'access_token': token_data['access_token'],
            'refresh_token': token_data['refresh_token'],
            'expires_at': datetime.fromtimestamp(token_data['expires_at'], tz=timezone.utc),
            'athlete': token_data['athlete'],
            'scopes': token_data.get('scope', '').split(','),
            'connected_at': datetime.now(timezone.utc),
            'last_sync_at': None,
            'sync_status': 'pending'
        }
        
        await self.db.strava_connections.update_one(
            {'user_id': user_id},
            {'$set': connection_data},
            upsert=True
        )
        
        # Clean up OAuth state
        await self.db.strava_oauth_state.delete_one({'_id': oauth_state['_id']})
        
        return {
            'success': True,
            'athlete': token_data['athlete'],
            'connected_at': connection_data['connected_at'].isoformat()
        }
    
    async def refresh_access_token(self, user_id: str) -> Dict[str, Any]:
        """Refresh expired access token"""
        await self.load_settings()
        
        connection = await self.db.strava_connections.find_one({'user_id': user_id})
        if not connection:
            raise HTTPException(status_code=404, detail="Strava connection not found")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                STRAVA_TOKEN_URL,
                json={
                    'client_id': self.system_settings['clientId'],
                    'client_secret': self.system_settings['clientSecret'],
                    'refresh_token': connection['refresh_token'],
                    'grant_type': 'refresh_token'
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Token refresh failed: {response.text}"
                )
            
            token_data = response.json()
        
        # Update tokens
        await self.db.strava_connections.update_one(
            {'user_id': user_id},
            {
                '$set': {
                    'access_token': token_data['access_token'],
                    'refresh_token': token_data['refresh_token'],
                    'expires_at': datetime.fromtimestamp(token_data['expires_at'], tz=timezone.utc)
                }
            }
        )
        
        return token_data
    
    async def get_valid_token(self, user_id: str) -> str:
        """Get a valid access token, refreshing if necessary"""
        connection = await self.db.strava_connections.find_one({'user_id': user_id})
        if not connection:
            raise HTTPException(status_code=404, detail="Strava not connected")
        
        # Check if token needs refresh (refresh 5 minutes before expiry)
        if datetime.now(timezone.utc) >= connection['expires_at'] - timedelta(minutes=5):
            token_data = await self.refresh_access_token(user_id)
            return token_data['access_token']
        
        return connection['access_token']
    
    async def disconnect(self, user_id: str) -> Dict[str, bool]:
        """Disconnect Strava and revoke tokens"""
        await self.load_settings()
        
        connection = await self.db.strava_connections.find_one({'user_id': user_id})
        if not connection:
            raise HTTPException(status_code=404, detail="Strava connection not found")
        
        # Revoke access token
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    STRAVA_DEAUTH_URL,
                    json={'access_token': connection['access_token']}
                )
        except Exception as e:
            print(f"Error revoking Strava token: {e}")
            # Continue with local cleanup even if revocation fails
        
        # Remove connection from database
        await self.db.strava_connections.delete_one({'user_id': user_id})
        
        return {'success': True}
    
    async def get_connection_status(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get current Strava connection status"""
        connection = await self.db.strava_connections.find_one({'user_id': user_id})
        if not connection:
            return None
        
        return {
            'connected': True,
            'athlete': connection['athlete'],
            'connected_at': connection['connected_at'].isoformat(),
            'last_sync_at': connection['last_sync_at'].isoformat() if connection['last_sync_at'] else None,
            'sync_status': connection['sync_status']
        }
    
    async def fetch_athlete_activities(
        self, 
        user_id: str, 
        page: int = 1, 
        per_page: int = 30
    ) -> list:
        """Fetch activities from Strava"""
        token = await self.get_valid_token(user_id)
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{STRAVA_API_BASE}/athlete/activities",
                headers={'Authorization': f'Bearer {token}'},
                params={'page': page, 'per_page': per_page}
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to fetch activities: {response.text}"
                )
            
            return response.json()
