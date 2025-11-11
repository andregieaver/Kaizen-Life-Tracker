# TrainSmart Integration Guide

This guide provides step-by-step instructions for adding new third-party integrations to the TrainSmart application. Following this guide ensures consistency across all integrations and makes the process straightforward.

## Overview

TrainSmart uses a generic `BaseIntegrationService` class that standardizes OAuth flows, token management, and data synchronization across all providers. This architecture enables rapid integration of new fitness trackers and health devices.

## Architecture

```
/app/
├── backend/
│   ├── integration_service.py        # Base class for all integrations
│   ├── {provider}_service.py         # Provider-specific implementation
│   └── server.py                     # API routes and connectors
└── frontend/
    └── src/components/
        ├── SystemSettings.js         # Admin configuration UI
        ├── Account.js                # User connection UI
        └── TrainingCalendar.js       # Activity display
```

## Step-by-Step Integration Process

### Phase 1: Backend Implementation

#### 1. Create Provider Service File

Create a new file `backend/{provider}_service.py` that inherits from `BaseIntegrationService`:

```python
"""
{Provider} Integration Service
Extends BaseIntegrationService for {Provider} fitness tracker data sync
"""

import httpx
import logging
import base64  # If using Basic Auth
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from integration_service import BaseIntegrationService
from fastapi import HTTPException


class {Provider}Service(BaseIntegrationService):
    """{{Provider}} integration service"""
    
    @property
    def provider_name(self) -> str:
        return "{provider}"  # lowercase
    
    @property
    def oauth_authorize_url(self) -> str:
        return "https://api.{provider}.com/oauth/authorize"
    
    @property
    def oauth_token_url(self) -> str:
        return "https://api.{provider}.com/oauth/token"
    
    @property
    def api_base_url(self) -> str:
        return "https://api.{provider}.com"
    
    async def exchange_code_for_tokens(self, code: str, state: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access token.
        Override if provider uses non-standard OAuth (e.g., Basic Auth like Polar/Suunto)
        """
        # For standard OAuth 2.0, the base class implementation works
        # For custom implementations, see polar_service.py or suunto_service.py
        return await super().exchange_code_for_tokens(code, state)
    
    async def fetch_user_profile(self, access_token: str) -> Dict[str, Any]:
        """Fetch provider user profile"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/v1/user",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch user profile")
            
            data = response.json()
            return {
                "id": data.get("id"),
                "display_name": data.get("name", "User")
            }
    
    async def sync_activities(self, user_id: str, force_full_sync: bool = False) -> Dict[str, Any]:
        """Sync activities from provider to database"""
        logging.info(f"[{self.provider_name.upper()} SYNC] Starting sync for user: {user_id}")
        
        connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
        if not connection:
            raise HTTPException(status_code=404, detail=f"{self.provider_name.title()} not connected")
        
        # Determine sync limit
        limit = 100 if force_full_sync else 25
        
        # Fetch activities
        activities = await self.fetch_activities(user_id, limit=limit)
        
        # Store in database
        imported_count = 0
        for activity in activities:
            activity["user_id"] = user_id
            activity["synced_at"] = datetime.now(timezone.utc)
            
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
        
        return {
            "success": True,
            "imported": imported_count,
            "total_activities": len(activities),
            "message": f"Successfully synced {imported_count} activities"
        }
    
    async def fetch_activities(self, user_id: str, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """Fetch activities from provider API"""
        connection = await self.db[f"{self.provider_name}_connections"].find_one({"user_id": user_id})
        if not connection:
            raise HTTPException(status_code=404, detail=f"{self.provider_name.title()} not connected")
        
        activities = []
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/v1/activities",
                headers={"Authorization": f"Bearer {connection['access_token']}"},
                params={"limit": limit, "offset": offset}
            )
            
            if response.status_code == 200:
                data = response.json()
                activities = data.get("activities", [])
        
        return activities
    
    def transform_activity_to_calendar(self, activity: Dict[str, Any]) -> Dict[str, Any]:
        """Transform provider activity to training calendar format"""
        start_date = activity.get("start_date", activity.get("date", ""))
        if "T" not in start_date:
            start_date = f"{start_date}T00:00:00"
        
        return {
            "title": activity.get("name", f"{self.provider_name.title()} Activity"),
            "start_date": start_date,
            "block_type": "training",
            "source": self.provider_name,
            f"{self.provider_name}_data": {
                "activity_id": activity.get("id"),
                "type": activity.get("type"),
                "duration_seconds": activity.get("duration", 0),
                "distance_km": activity.get("distance", 0) / 1000,  # Convert to km
                "calories": activity.get("calories", 0),
                "heart_rate_avg": activity.get("avg_heart_rate")
            }
        }
    
    async def get_stats(self, user_id: str) -> Dict[str, Any]:
        """Get activity statistics"""
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
        
        return {
            "total_activities": total_activities,
            "total_distance_km": round(total_distance_km, 2),
            "total_calories": int(total_calories),
            "by_type": by_type
        }
```

#### 2. Wire Service into Backend (server.py)

Add the following changes to `backend/server.py`:

**a) Import the service:**
```python
from {provider}_service import {Provider}Service
```

**b) Add to training calendar endpoint:**
```python
# Get {Provider} activities
{provider}_activities = await db.{provider}_activities.find(
    {"user_id": athlete_id},
    {"_id": 0}
).sort("start_date", 1).to_list(length=None)

# Convert {Provider} activities to training block format
{provider}_service = {Provider}Service(db)
for activity in {provider}_activities:
    {provider}_block = {provider}_service.transform_activity_to_calendar(activity)
    {provider}_block["athlete_id"] = athlete_id
    parsed_blocks.append({provider}_block)
```

**c) Add to AI Coach context:**
```python
# Get {Provider} activities (last 30 days)
{provider}_activities = await db.{provider}_activities.find(
    {"user_id": athlete_id},
    {"_id": 0}
).sort("start_date", -1).limit(50).to_list(length=None)
```

And in the return statement:
```python
"{provider}_activities": {provider}_activities,
```

**d) Create connector class:**
```python
class {Provider}Connector(ProviderConnector):
    def __init__(self):
        super().__init__("{provider}", "{Provider}", "oauth2")
    
    async def begin_auth(self, user_id: str):
        """Begin {Provider} OAuth flow"""
        try:
            logging.info(f"[{PROVIDER} CONNECTOR] Starting auth for user: {user_id}")
            {provider}_service = {Provider}Service(db)
            scopes = ["activity", "profile"]  # Provider-specific scopes
            auth_url = await {provider}_service.get_authorization_url(user_id, scopes)
            
            return {
                "authorization_url": auth_url,
                "provider": "{provider}"
            }
        except Exception as e:
            logging.error(f"Error in {Provider}Connector.begin_auth: {e}")
            raise HTTPException(status_code=500, detail=str(e))
```

**e) Initialize and register connector:**
```python
{provider}_connector = {Provider}Connector()

connectors = {
    # ... existing connectors ...
    "{provider}": {provider}_connector
}
```

**f) Add to integration service mapping:**
```python
def get_integration_service(provider: str):
    services = {
        # ... existing services ...
        "{provider}": lambda: {Provider}Service(db)
    }
    return services[provider]()
```

**g) Add scopes to scopes_map:**
```python
scopes_map = {
    # ... existing scopes ...
    "{provider}": ["activity", "profile", "read"]
}
```

### Phase 2: Frontend Implementation

#### 3. Add System Settings Configuration

In `frontend/src/components/SystemSettings.js`:

**a) Add to state initialization:**
```javascript
{provider}: {
  clientId: response.data.advanced.{provider}?.clientId || '',
  clientSecret: response.data.advanced.{provider}?.clientSecret || '',
  callbackDomain: response.data.advanced.{provider}?.callbackDomain || ''
},
// ...
show{Provider}Secret: false
```

**b) Add to save logic:**
```javascript
{provider}: {
  clientId: advancedSettings.{provider}.clientId,
  clientSecret: advancedSettings.{provider}.clientSecret,
  callbackDomain: advancedSettings.{provider}.callbackDomain
}
```

**c) Add UI section (choose a unique color):**
```jsx
{/* {Provider} Integration */}
<div className="space-y-4">
  <div className="flex items-center space-x-3 pb-3 border-b border-gray-700">
    <div className="w-10 h-10 bg-{color}-900/30 rounded-lg flex items-center justify-center">
      <Activity className="w-6 h-6 text-{color}-500" />
    </div>
    <div>
      <h3 className="text-lg font-semibold text-white">{Provider} Integration</h3>
      <p className="text-sm text-gray-400">Connect {Provider} devices for comprehensive tracking</p>
    </div>
  </div>

  <div className="space-y-4">
    {/* Client ID */}
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Client ID
      </label>
      <input
        type="text"
        placeholder="Enter your {Provider} Client ID"
        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-{color}-600 focus:border-transparent"
        value={advancedSettings.{provider}.clientId}
        onChange={(e) => setAdvancedSettings(prev => ({
          ...prev,
          {provider}: { ...prev.{provider}, clientId: e.target.value }
        }))}
      />
    </div>

    {/* Callback Domain */}
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Authorization Callback Domain
      </label>
      <input
        type="text"
        placeholder="e.g., kaizenlifetracker.com"
        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-{color}-600 focus:border-transparent"
        value={advancedSettings.{provider}.callbackDomain}
        onChange={(e) => setAdvancedSettings(prev => ({
          ...prev,
          {provider}: { ...prev.{provider}, callbackDomain: e.target.value }
        }))}
      />
      <p className="text-xs text-gray-400 mt-1">
        Enter only the domain without https:// or paths
      </p>
    </div>

    {/* Client Secret */}
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Client Secret
      </label>
      <div className="relative">
        <input
          type={advancedSettings.show{Provider}Secret ? 'text' : 'password'}
          placeholder="Enter your {Provider} Client Secret"
          className="w-full px-3 py-2 pr-10 bg-gray-900 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-{color}-600 focus:border-transparent"
          value={advancedSettings.{provider}.clientSecret}
          onChange={(e) => setAdvancedSettings(prev => ({
            ...prev,
            {provider}: { ...prev.{provider}, clientSecret: e.target.value }
          }))}
        />
        <button
          type="button"
          onClick={() => setAdvancedSettings(prev => ({
            ...prev,
            show{Provider}Secret: !prev.show{Provider}Secret
          }))}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
        >
          {advancedSettings.show{Provider}Secret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  </div>

  <div className="p-3 bg-{color}-900/20 border border-{color}-700/50 rounded-lg">
    <p className="text-xs text-{color}-200">
      <strong>Setup Instructions:</strong>
    </p>
    <ol className="text-xs text-{color}-200 mt-2 space-y-1 ml-4 list-decimal">
      <li>Go to <a href="https://developer.{provider}.com/" target="_blank" rel="noopener noreferrer" className="text-{color}-400 hover:underline">{Provider} Developer Portal</a></li>
      <li>Create a new application or use an existing one</li>
      <li>Set the Redirect URI to: <code className="bg-{color}-900/40 px-1 py-0.5 rounded">https://[YOUR-DOMAIN]/api/auth/{provider}/callback</code></li>
      <li>Copy your Client ID and Client Secret</li>
      <li>Enter them below and Save</li>
      <li>Athletes can now connect their {Provider} device from Account Settings</li>
    </ol>
  </div>
</div>
```

#### 4. Add Account Page Integration Card

In `frontend/src/components/Account.js`:

**a) Add to state initialization:**
```javascript
{provider}: { connected: false, last_sync: null }
```

**b) Add OAuth callback handling:**
```javascript
// Handle {Provider} OAuth callback
const {provider}Status = urlParams.get('{provider}');
if ({provider}Status === 'connected') {
  setSaveStatus({ 
    type: 'success', 
    message: '{Provider} connected successfully! Your data will now sync automatically.' 
  });
  setTimeout(() => {
    setSaveStatus({ type: '', message: '' });
    window.history.replaceState({}, '', window.location.pathname);
  }, 5000);
  if (athleteId) {
    loadAccountData();
  }
} else if ({provider}Status === 'error') {
  setSaveStatus({ 
    type: 'error', 
    message: 'Failed to connect {Provider}. Please try again or check System Settings.' 
  });
  setTimeout(() => {
    setSaveStatus({ type: '', message: '' });
    window.history.replaceState({}, '', window.location.pathname);
  }, 5000);
}
```

**c) Add status check in loadAccountData:**
```javascript
const [{provider}StatusRes] = await Promise.all([
  // ... existing status checks ...
  axios.get(`${API}/auth/{provider}/status`, { params: { user_id: athleteId } }).catch(() => ({ data: { connected: false } }))
]);

const {provider}Status = {provider}StatusRes.data;

// In integrationsState:
{provider}: { 
  connected: {provider}Status.connected,
  last_sync: {provider}Status.last_sync_at
}

// In connectionsData.forEach:
else if (connection.provider_key === '{provider}') {
  integrationsState.{provider} = {
    connected: connection.status === 'active',
    last_sync: connection.last_sync_at || integrationsState.{provider}.last_sync
  };
}
```

**d) Add IntegrationCard:**
```jsx
{/* {Provider} */}
<IntegrationCard
  provider="{provider}"
  name="{Provider}"
  description="Connect your {Provider} device to sync activity and health data"
  icon={<Activity className="w-8 h-8 text-{color}-500" />}
  connected={integrations.{provider}?.connected || false}
  connectionInfo={integrations.{provider}}
  onConnect={() => handleSimpleConnect('{provider}')}
  onDisconnect={() => handleDisconnectIntegration('{provider}')}
  onSync={(fullSync) => handleGenericSync('{provider}', fullSync)}
  t={t}
/>
```

**e) Update sync button conditions:**
```javascript
// Add {provider} to the sync conditions
{onSync && (provider === 'strava' || ... || provider === '{provider}') && (

// And in the else condition:
{onSync && provider !== 'strava' && ... && provider !== '{provider}' && (
```

#### 5. Add Training Calendar Activity Rendering

In `frontend/src/components/TrainingCalendar.js`:

**a) Add detection:**
```javascript
const is{Provider} = block.source === '{provider}';
```

**b) Add color:**
```javascript
else if (is{Provider}) bgColor = 'bg-{color}-500';
```

**c) Add icon:**
```javascript
else if (is{Provider}) sourceIcon = '{emoji}';
```

**d) Add heart rate display:**
```javascript
{is{Provider} && block.{provider}_data?.heart_rate_avg && (
  <div className="flex items-center gap-1">
    <Heart className="w-3 h-3" />
    <span>{Math.round(block.{provider}_data.heart_rate_avg)}</span>
  </div>
)}
```

### Phase 3: Testing

#### Backend Testing
```bash
# Test authorization URL
curl "http://localhost:8001/api/auth/{provider}?user_id=test-user"

# Test connection status
curl "http://localhost:8001/api/auth/{provider}/status?user_id=test-user"

# Test activities endpoint
curl "http://localhost:8001/api/integrations/{provider}/test-user/activities"

# Test stats endpoint
curl "http://localhost:8001/api/integrations/{provider}/test-user/stats"
```

#### Frontend Testing
1. Navigate to System Settings → Advanced tab
2. Enter {Provider} credentials and save
3. Navigate to Account → Integrations tab
4. Click Connect on {Provider} card
5. Complete OAuth flow
6. Test sync functionality
7. Verify activities appear in Training Calendar

### Phase 4: Update Test Documentation

Update `/app/test_result.md` with:
```yaml
backend:
  - task: "{Provider} Integration - Backend Implementation"
    implemented: true
    working: "NA"
    file: "/app/backend/{provider}_service.py, /app/backend/server.py"
    needs_retesting: true

frontend:
  - task: "{Provider} Integration - Frontend UI"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/SystemSettings.js, Account.js, TrainingCalendar.js"
    needs_retesting: true
```

## Color Theme Reference

Choose a unique color for each integration:

- **Strava**: Orange (bg-orange-500)
- **Oura**: Purple (bg-purple-500)
- **Polar**: Red (bg-red-500)
- **Fitbit**: Teal (bg-teal-500)
- **Garmin**: Blue (bg-blue-600)
- **COROS**: Yellow (bg-yellow-500)
- **WHOOP**: Purple Dark (bg-purple-600)
- **Suunto**: Cyan (bg-cyan-500)

Available colors: Indigo, Pink, Lime, Amber, Rose, Sky, Emerald, Fuchsia

## Emoji Icon Reference

Choose a unique emoji for each integration:

- **Strava**: 🏃 (runner)
- **Polar**: ❄️ (snowflake)
- **Fitbit**: 📊 (chart)
- **Garmin**: ⌚ (watch)
- **COROS**: 🏔️ (mountain)
- **WHOOP**: 💪 (muscle)
- **Suunto**: 🧭 (compass)
- **Oura**: 😴 (sleep) / ⚡ (energy) / 💪 (strength)

Available emojis: 🚴 (cycling), 🏊 (swimming), ⛷️ (skiing), 🏋️ (lifting), 🧘 (yoga), 🎯 (target), 📱 (phone), 💓 (heartbeat)

## Special Cases

### OAuth 1.0a (Garmin)
If your provider uses OAuth 1.0a instead of OAuth 2.0:
- See `garmin_service.py` for reference implementation
- Use `requests-oauthlib` library for request signing
- Override `get_authorization_url()` and `exchange_code_for_tokens()` methods

### Basic Authentication for Token Exchange (Polar, Suunto)
If your provider requires Basic Auth for token exchange:
- See `polar_service.py` or `suunto_service.py` for reference
- Override `exchange_code_for_tokens()` to add Basic Auth header
- Use base64 encoding for credentials

### Custom API Requirements
Some providers may have:
- Rate limiting: Implement backoff and retry logic
- Pagination: Handle paginated responses in `fetch_activities()`
- Webhooks: Add webhook endpoints in `server.py`
- Refresh tokens: Implement token refresh logic in base service

## Checklist

Use this checklist when adding a new integration:

### Backend
- [ ] Created `{provider}_service.py` with all required methods
- [ ] Imported service in `server.py`
- [ ] Added to training calendar endpoint
- [ ] Added to AI Coach context
- [ ] Created connector class
- [ ] Registered connector in connectors dict
- [ ] Added to `get_integration_service()` mapping
- [ ] Added scopes to `scopes_map`
- [ ] Tested all backend endpoints with curl

### Frontend
- [ ] Added credentials to SystemSettings.js state
- [ ] Added save logic in SystemSettings.js
- [ ] Added configuration UI section
- [ ] Added to Account.js integrations state
- [ ] Added OAuth callback handling
- [ ] Added status check in loadAccountData
- [ ] Added IntegrationCard
- [ ] Updated sync button conditions
- [ ] Added activity detection in TrainingCalendar.js
- [ ] Added color and icon
- [ ] Added heart rate display

### Testing
- [ ] Backend endpoints return correct responses
- [ ] System Settings can save credentials
- [ ] OAuth flow connects successfully
- [ ] Activities sync correctly
- [ ] Activities display in calendar
- [ ] Disconnect works properly
- [ ] No console errors

### Documentation
- [ ] Updated test_result.md
- [ ] Added provider to this guide's color reference
- [ ] Added provider to this guide's emoji reference

## Support

If you encounter issues:
1. Check backend logs: `tail -n 100 /var/log/supervisor/backend.err.log`
2. Check frontend logs in browser console
3. Verify provider API documentation for changes
4. Review existing integrations (Suunto, WHOOP, COROS) for reference
5. Test endpoints with curl before frontend testing

## Next Steps

After completing an integration:
1. Test thoroughly with real user accounts
2. Monitor error rates in production
3. Implement webhooks if supported by provider
4. Add provider-specific features (zones, training plans, etc.)
5. Update user documentation

---

**Last Updated**: November 2024
**Maintained By**: TrainSmart Development Team
