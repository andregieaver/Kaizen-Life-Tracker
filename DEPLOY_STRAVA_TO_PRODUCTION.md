# Deploy Strava Integration to Production

## Current Status
✅ Development implementation complete
❌ Production deployment pending

## Error You're Seeing
```
GET /api/auth/strava/status 404 (Not Found)
GET /api/auth/strava 400 (Bad Request)
```

**Cause:** Production backend doesn't have the new Strava endpoints yet.

## Deployment Steps

### Option 1: Native Emergent Deployment (Recommended)

1. **Use Emergent's "Deploy" Feature**
   - Click the "Deploy" button in the Emergent interface
   - This will push all changes to production
   - Wait for deployment to complete

2. **Verify Deployment**
   ```bash
   curl https://trainsmart-cms.emergent.host/api/auth/strava/status?user_id=test
   ```
   Should return: `{"connected": false}` instead of 404

3. **Test OAuth Flow**
   - Go to https://kaizenlifetracker.com/dashboard/account
   - Click "Connect Strava"
   - Should redirect to Strava (not get 400 error)

### Option 2: Manual Git Push (If Native Deploy Unavailable)

1. **Commit Changes**
   ```bash
   cd /app
   git add .
   git commit -m "Add Strava OAuth integration with webhooks"
   ```

2. **Push to Production**
   ```bash
   git push origin main
   ```

3. **Restart Services**
   - Use your deployment platform's restart mechanism
   - Or SSH and run: `sudo supervisorctl restart backend`

## Files That Need to Be Deployed

### New Files
- `/app/backend/strava_service.py` - OAuth service (417 lines)

### Modified Files
- `/app/backend/server.py` - Added 12 Strava endpoints
- `/app/frontend/src/components/SystemSettings.js` - Strava settings UI
- `/app/frontend/src/components/Account.js` - Connect/disconnect UI

## Post-Deployment Checklist

### 1. Verify Backend Endpoints
```bash
# Status endpoint
curl "https://trainsmart-cms.emergent.host/api/auth/strava/status?user_id=test-user"
# Expected: {"connected": false}

# OAuth start endpoint  
curl "https://trainsmart-cms.emergent.host/api/auth/strava?user_id=test-user"
# Expected: {"authUrl": "https://www.strava.com/oauth/authorize?...", "state": "..."}
```

### 2. Check System Settings
- Go to: https://kaizenlifetracker.com/dashboard/system-settings
- Navigate to "Advanced" tab
- Scroll to "Strava API Integration"
- Verify credentials are saved:
  - Client ID: 57985
  - Client Secret: (hidden)
  - Callback Domain: kaizenlifetracker.com
  - Webhook Verify Token: (your random string)

### 3. Test OAuth Flow
1. Go to: https://kaizenlifetracker.com/dashboard/account
2. Click "Integrations" tab
3. Find Strava section
4. Click "Connect Strava"
5. Should redirect to Strava authorization page
6. Click "Authorize" on Strava
7. Should redirect back to Account with success message

### 4. Create Webhook Subscription
```bash
curl -X POST https://trainsmart-cms.emergent.host/api/strava/webhook/create
```

Expected response:
```json
{
  "id": 123456,
  "resource_state": 2,
  "application_id": 57985,
  "callback_url": "https://kaizenlifetracker.com/api/webhook/strava",
  "created_at": "2025-01-07T12:00:00Z"
}
```

### 5. Verify Webhook
```bash
curl https://trainsmart-cms.emergent.host/api/strava/webhook/list
```

Expected response:
```json
{
  "subscriptions": [
    {
      "id": 123456,
      "callback_url": "https://kaizenlifetracker.com/api/webhook/strava",
      ...
    }
  ]
}
```

## Troubleshooting

### Still Getting 404 After Deployment?

**Check Backend Logs:**
```bash
# Via SSH or deployment platform logs
tail -f /var/log/supervisor/backend.err.log
```

Look for:
- "Application startup complete" - Backend started successfully
- Any import errors related to strava_service
- Any route registration errors

**Verify File Deployed:**
```bash
ls -la /app/backend/strava_service.py
```
Should exist and be ~417 lines.

### Getting "Strava API credentials not configured"?

**Solution:**
1. Go to System Settings → Advanced
2. Enter all Strava credentials
3. Click "Save"
4. Try connecting again

### OAuth Redirect Not Working?

**Check Strava API Settings:**
1. Go to: https://www.strava.com/settings/api
2. Find your application
3. Verify "Authorization Callback Domain" is set to: `kaizenlifetracker.com`
4. Should NOT have `https://` prefix
5. Should NOT have `/api/auth/strava/callback` path

### Webhook Creation Fails?

**Common Issues:**
- Callback domain not configured
- Verify token not set
- Strava API credentials incorrect
- Webhook already exists (delete first)

**Delete Existing Webhook:**
```bash
# List webhooks to get ID
curl https://trainsmart-cms.emergent.host/api/strava/webhook/list

# Delete by ID
curl -X DELETE https://trainsmart-cms.emergent.host/api/strava/webhook/{subscription_id}

# Create new one
curl -X POST https://trainsmart-cms.emergent.host/api/strava/webhook/create
```

## Dependencies Already Installed
✅ httpx - HTTP client
✅ cryptography - Token encryption
✅ python-dotenv - Environment variables
✅ motor - MongoDB async driver
✅ fastapi - Web framework

No additional `pip install` needed!

## Environment Variables
All configuration is in **System Settings**, not environment variables:
- No `.env` changes needed
- No server restarts needed (except after initial deployment)
- All dynamic per-environment

## Quick Test Script

After deployment, run this to test everything:

```bash
#!/bin/bash

echo "Testing Strava Integration..."

# 1. Test status endpoint
echo "\n1. Testing status endpoint..."
STATUS=$(curl -s "https://trainsmart-cms.emergent.host/api/auth/strava/status?user_id=test")
echo "Status: $STATUS"

# 2. Test OAuth start
echo "\n2. Testing OAuth start..."
OAUTH=$(curl -s "https://trainsmart-cms.emergent.host/api/auth/strava?user_id=test")
echo "OAuth: $OAUTH"

# 3. Test webhook list
echo "\n3. Testing webhook list..."
WEBHOOKS=$(curl -s "https://trainsmart-cms.emergent.host/api/strava/webhook/list")
echo "Webhooks: $WEBHOOKS"

echo "\n✅ All tests complete!"
```

Save as `test_strava.sh`, make executable: `chmod +x test_strava.sh`, run: `./test_strava.sh`

## Success Indicators

After successful deployment, you should see:

1. ✅ Status endpoint returns `{"connected": false}` instead of 404
2. ✅ OAuth endpoint returns `{"authUrl": "...", "state": "..."}` instead of 400
3. ✅ System Settings saves credentials without errors
4. ✅ Account Settings shows "Connect Strava" button
5. ✅ Clicking "Connect" redirects to Strava
6. ✅ Webhook creation succeeds
7. ✅ After authorizing on Strava, redirects back with success message

## Next Steps After Deployment

1. **Connect Your Strava Account**
   - Test the full OAuth flow
   - Verify activities sync

2. **Create Webhook**
   - One-time API call
   - Enables real-time updates

3. **Monitor Logs**
   - Watch for incoming webhook events
   - Verify activities auto-sync

4. **Build Activity UI**
   - Display synced activities
   - Show charts and analytics

## Need Help?

If deployment fails or endpoints still return 404:
1. Check backend logs for errors
2. Verify all files deployed correctly
3. Ensure backend service restarted
4. Check System Settings credentials saved
5. Test endpoints via curl before testing UI

---

**Current State:** Code ready in development
**Action Needed:** Deploy to production
**Estimated Time:** 5-10 minutes (including verification)
