# Integration Framework Guide

This guide explains how to add new OAuth-based integrations (Garmin, Polar, Coros, etc.) using our streamlined framework.

## Overview

The integration framework provides a standardized approach for implementing OAuth-based wearable/fitness integrations. All common functionality (OAuth flow, token management, data sync) is handled by the `BaseIntegrationService` class.

## Quick Start: Adding a New Integration

### 1. Create a Service Class

Create a new file `{provider}_service.py` that extends `BaseIntegrationService`:

```python
from integration_service import BaseIntegrationService
from typing import Dict, Any, Optional, List
from datetime import datetime
import httpx
import logging

class GarminService(BaseIntegrationService):
    """Garmin Connect integration service"""
    
    # Required properties
    @property
    def provider_name(self) -> str:
        return "garmin"
    
    @property
    def oauth_authorize_url(self) -> str:
        return "https://connect.garmin.com/oauthConfirm"
    
    @property
    def oauth_token_url(self) -> str:
        return "https://connectapi.garmin.com/oauth-service/oauth/token"
    
    @property
    def api_base_url(self) -> str:
        return "https://apis.garmin.com/wellness-api/rest"
    
    # Required methods
    async def fetch_user_profile(self, access_token: str) -> Dict[str, Any]:
        """Fetch user profile from Garmin"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/user/profile",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "id": data.get("userId"),
                    "name": data.get("displayName")
                }
            return {"id": "unknown"}
    
    async def fetch_activities(
        self, 
        access_token: str, 
        since: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Fetch activities from Garmin"""
        activities = []
        
        # Determine date range
        start_date = since.strftime("%Y-%m-%d") if since and since.year > 1970 else "2024-01-01"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_base_url}/activities",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"startDate": start_date}
            )
            
            if response.status_code == 200:
                data = response.json()
                for activity in data.get("activities", []):
                    activities.append({
                        "activity_id": str(activity["activityId"]),
                        "type": activity.get("activityType"),
                        "start_date": datetime.fromisoformat(activity["startTime"]),
                        "distance": activity.get("distance"),
                        "duration": activity.get("duration"),
                        "calories": activity.get("calories"),
                        "raw_data": activity
                    })
        
        return activities
    
    def transform_activity_to_calendar(self, activity: Dict[str, Any]) -> Dict[str, Any]:
        """Transform Garmin activity to calendar block format"""
        start_date = activity.get("start_date")
        if isinstance(start_date, datetime):
            date_str = start_date.strftime("%Y-%m-%d")
        else:
            date_str = str(start_date)[:10]
        
        return {
            "id": f"garmin_{activity.get('activity_id')}",
            "athlete_id": activity.get("user_id"),
            "title": f"Garmin {activity.get('type', 'Activity')}",
            "description": f"From Garmin Connect",
            "block_type": "training",
            "workout_type": activity.get("type", "").lower(),
            "start_date": date_str,
            "end_date": date_str,
            "distance": round(activity.get("distance", 0) / 1000, 2) if activity.get("distance") else None,
            "duration_minutes": round(activity.get("duration", 0) / 60) if activity.get("duration") else None,
            "source": "garmin",
            "garmin_data": {
                "activity_id": activity.get("activity_id"),
                "calories": activity.get("calories")
            }
        }
```

### 2. Register the Service

Add to `server.py` imports:

```python
from garmin_service import GarminService
```

Add to `get_integration_service()` function:

```python
def get_integration_service(provider: str):
    services = {
        "strava": lambda: StravaService(db),
        "oura": lambda: OuraService(db),
        "garmin": lambda: GarminService(db)  # Add this line
    }
    # ...
```

Add scopes to `start_integration_auth()`:

```python
scopes_map = {
    "strava": ["read", "activity:read_all", "profile:read_all"],
    "oura": ["daily", "heartrate", "workout"],
    "garmin": ["activities:read", "profile:read"]  # Add this line
}
```

### 3. Configure System Settings

In your frontend System Settings, add the provider configuration:

```javascript
{
  "garmin": {
    "clientId": "YOUR_CLIENT_ID",
    "clientSecret": "YOUR_CLIENT_SECRET",
    "callbackDomain": "your-domain.com"
  }
}
```

### 4. Update Frontend

The frontend already supports generic integrations! Just add to `Account.js`:

```javascript
<IntegrationCard
  provider="garmin"
  name="Garmin"
  description="Connect your Garmin device"
  icon={<Activity className="w-8 h-8 text-blue-500" />}
  connected={integrations.garmin?.connected}
  connectionInfo={integrations.garmin}
  onConnect={() => handleSimpleConnect('garmin')}
  onDisconnect={() => handleDisconnectIntegration('garmin')}
  onSync={handleIntegrationSync}  // Generic sync handler
  t={t}
/>
```

### 5. Add Calendar Styling (Optional)

Update `TrainingCalendar.js` EventComponent to add provider-specific styling:

```javascript
const isGarmin = block.source === 'garmin';
let bgColor = 'bg-blue-500';
if (isStrava) bgColor = 'bg-orange-500';
else if (isOura) bgColor = 'bg-purple-500';
else if (isGarmin) bgColor = 'bg-blue-600';  // Add this

let sourceIcon = null;
if (isStrava) sourceIcon = '🏃';
else if (isOura && block.oura_data?.type === 'Sleep') sourceIcon = '😴';
else if (isGarmin) sourceIcon = '⌚';  // Add this
```

## That's It!

You now have a fully functional integration with:
- ✅ OAuth flow (connect/disconnect)
- ✅ Token management (automatic refresh)
- ✅ Data sync (incremental + full)
- ✅ Calendar display
- ✅ Activity stats
- ✅ Connection status

## Available Endpoints (Automatically Created)

All endpoints are automatically available for your integration:

- `GET /api/auth/{provider}` - Start OAuth
- `GET /api/auth/{provider}/callback` - OAuth callback
- `POST /api/auth/{provider}/disconnect` - Disconnect
- `GET /api/auth/{provider}/status` - Connection status
- `POST /api/integrations/{provider}/{user_id}/sync` - Sync data
- `GET /api/integrations/{provider}/{user_id}/activities` - Get activities
- `GET /api/integrations/{provider}/{user_id}/stats` - Get stats

## Database Collections (Automatically Created)

- `{provider}_connections` - OAuth tokens and connection info
- `{provider}_activities` - Synced activity data
- `{provider}_oauth_state` - Temporary OAuth state (auto-cleaned)

## Testing Your Integration

1. **Connect**: Navigate to Account → Integrations → Click "Connect Garmin"
2. **Authorize**: Complete OAuth flow
3. **Sync**: Click "Sync" button (incremental) or "Full" button (full history)
4. **View**: Check Calendar tab to see activities
5. **Stats**: Check Merits tab for statistics (if `get_stats()` implemented)

## Advanced: Custom Stats

To add custom statistics, implement `get_stats()` in your service:

```python
async def get_stats(self, user_id: str) -> Dict[str, Any]:
    """Get Garmin statistics"""
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": "$type",
            "count": {"$sum": 1},
            "total_distance": {"$sum": "$distance"}
        }}
    ]
    
    result = await self.db.garmin_activities.aggregate(pipeline).to_list(length=100)
    
    # Format and return stats
    return {
        "total_activities": sum(r["count"] for r in result),
        "by_type": {r["_id"]: r for r in result}
    }
```

## Common OAuth Providers

### Provider Configuration Examples

**Garmin Connect**
- Authorize URL: `https://connect.garmin.com/oauthConfirm`
- Token URL: `https://connectapi.garmin.com/oauth-service/oauth/token`
- API Base: `https://apis.garmin.com/wellness-api/rest`

**Polar Flow**
- Authorize URL: `https://flow.polar.com/oauth2/authorization`
- Token URL: `https://polarremote.com/v2/oauth2/token`
- API Base: `https://www.polaraccesslink.com/v3`

**Coros**
- Authorize URL: `https://open.coros.com/oauth2/authorize`
- Token URL: `https://open.coros.com/oauth2/accesstoken`
- API Base: `https://open.coros.com/api/v1`

**Wahoo**
- Authorize URL: `https://api.wahooligan.com/oauth/authorize`
- Token URL: `https://api.wahooligan.com/oauth/token`
- API Base: `https://api.wahooligan.com/v1`

## Best Practices

1. **Error Handling**: Use try-except blocks in fetch methods
2. **Logging**: Add logging for debugging (see examples)
3. **Rate Limiting**: Respect provider rate limits
4. **Data Validation**: Validate data before storing
5. **Timezones**: Always use timezone-aware datetimes
6. **Testing**: Test OAuth flow, sync, and disconnect thoroughly

## Troubleshooting

**Issue**: OAuth fails with "Invalid redirect URI"
- **Solution**: Check `callbackDomain` in system settings matches your actual domain

**Issue**: Token refresh fails
- **Solution**: Verify `refresh_token` is being saved correctly and provider supports refresh

**Issue**: No activities synced
- **Solution**: Check `fetch_activities()` implementation and API response format

**Issue**: Activities not showing in calendar
- **Solution**: Verify `transform_activity_to_calendar()` returns correct format

## Support

For questions or issues with the integration framework:
1. Check existing implementations (Strava, Oura) for examples
2. Review provider's API documentation
3. Check backend logs for detailed error messages
4. Test endpoints using curl or Postman before frontend integration
