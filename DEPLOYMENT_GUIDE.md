# Deployment Guide - Body Score Health Tracker

## Overview
This guide covers deploying the Body Score Health Tracker application with the working database setup.

## Super-Admin Account

**IMPORTANT**: The following account MUST always remain super-admin:

- **Email**: andre@humanweb.no
- **Password**: Pernilla666!
- **Athlete ID**: 77e6ef02-0c9e-4ede-a428-213b83eed1fe
- **Role**: super_admin
- **Permissions**: ALL

### Verifying Super-Admin Status

After any deployment, run the verification script:

```bash
cd /app/backend
python3 ensure_super_admin.py
```

This script will:
- Check if andre@humanweb.no exists
- Verify super-admin privileges
- Update privileges if needed
- Confirm password is set correctly

## Database Configuration

### Current Setup
- **Database Name**: test_database (from DB_NAME env var)
- **MongoDB URL**: mongodb://localhost:27017 (from MONGO_URL env var)
- **Collections**:
  - athlete_profiles (user accounts)
  - oura_activities (Oura Ring data)
  - oura_connections (OAuth tokens)
  - readiness_scores (deprecated, use oura_activities)
  - strava_activities (Strava workout data)

### Key Data
The database contains working Oura integration data:
- Sleep scores
- Resting heart rate
- HRV measurements
- Readiness scores

## Pre-Deployment Checklist

### ✅ Health Check Passed
- [x] No compilation errors
- [x] All environment variables parameterized
- [x] No hardcoded URLs or database names
- [x] Dependencies up to date
- [x] bcrypt==4.0.1 pinned for compatibility
- [x] Super-admin status verified

### ✅ Recent Fixes Included
1. **Body Score Data Retrieval**:
   - MongoDB projections fixed (lines 9854, 9866 in server.py)
   - HRV queries enhanced with dual field checks
   - Now correctly fetches Oura sleep score and RHR

2. **Password Reset Feature**:
   - POST /api/auth/forgot-password
   - POST /api/auth/verify-reset-token
   - POST /api/auth/reset-password

3. **Frontend Improvements**:
   - "Forgot Password" link enabled on login page
   - Oura callback URL field added to System Settings
   - ResetPassword component updated

4. **Authentication Fixes**:
   - bcrypt version downgraded to 4.0.1 for passlib compatibility
   - Password verification working correctly

## Deployment Steps

### Step 1: Final Verification
```bash
# Verify super-admin status
cd /app/backend
python3 ensure_super_admin.py

# Check backend is running
sudo supervisorctl status backend

# Check frontend is running
sudo supervisorctl status frontend
```

### Step 2: Deploy to Production

1. **In Emergent Interface**:
   - Click the "Deploy" button
   - Select "Create New Deployment" or choose existing deployment for kaizenlifetracker.com
   - Wait ~10 minutes for deployment to complete

2. **Monitor Deployment**:
   - Watch deployment logs for any errors
   - Verify services start successfully
   - Check database connection established

### Step 3: Post-Deployment Verification

1. **Test Login**:
```bash
curl -X POST "https://[YOUR-DOMAIN]/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"andre@humanweb.no","password":"Pernilla666!"}'
```

Expected response:
```json
{
  "athlete_id": "77e6ef02-0c9e-4ede-a428-213b83eed1fe",
  "name": "André Giæver",
  "email": "andre@humanweb.no"
}
```

2. **Test Body Score Data**:
```bash
curl "https://[YOUR-DOMAIN]/api/health/body-score-data/77e6ef02-0c9e-4ede-a428-213b83eed1fe"
```

Expected fields:
- oura_sleep_score: 63
- resting_heart_rate: 59
- hrv_7d_avg: 34.0
- missing_data: [] (empty array)

3. **Test Frontend**:
   - Navigate to https://[YOUR-DOMAIN]
   - Login with andre@humanweb.no / Pernilla666!
   - Verify Body Score card shows 7/9 components
   - Check "Forgot Password" link is visible

## Expected Production Results

After successful deployment:

### Body Score Feature
- ✅ Display **7/9 components** (was 4/9)
- ✅ Show Oura Sleep Score (63/100)
- ✅ Show Resting Heart Rate (59 bpm)
- ✅ Show Heart Rate Reserve (calculated)
- ✅ Show HRV metrics
- ✅ Show VO2 Max
- ✅ Show Body Composition

### Missing Components (Expected)
- ❌ Load Balance (ACWR) - requires Strava integration with 28+ days data
- ❌ Body Age Delta - not available from Oura API v2

### Authentication
- ✅ Login working
- ✅ Forgot Password link visible
- ✅ Password reset flow functional
- ✅ Super-admin privileges active

### System Settings
- ✅ Oura integration has callback URL field
- ✅ All OAuth integrations properly configured

## Troubleshooting

### Issue: Body Score shows 4/9 instead of 7/9
**Solution**: Verify the deployment completed successfully. The old code doesn't have the MongoDB projection fixes.

### Issue: Login fails with 401
**Solutions**:
1. Run super-admin verification script: `python3 ensure_super_admin.py`
2. Check bcrypt version: Should be 4.0.1
3. Verify password in database matches "Pernilla666!"

### Issue: Missing Oura data
**Solutions**:
1. Check Oura connection in database: `oura_connections` collection
2. Trigger manual sync from dashboard
3. Verify OAuth tokens are valid

### Issue: Database connection fails
**Solutions**:
1. Check MONGO_URL environment variable
2. Check DB_NAME environment variable (should be "test_database")
3. Verify MongoDB service is running

## Environment Variables

The following environment variables will be automatically configured by Emergent:

### Backend
- `MONGO_URL` - MongoDB connection string
- `DB_NAME` - Database name (test_database)
- `CORS_ORIGINS` - Allowed CORS origins (defaults to *)

### Frontend
- `REACT_APP_BACKEND_URL` - Backend API URL (auto-configured)

## Database Persistence

The database (test_database) will be:
- ✅ Preserved across deployments
- ✅ Managed by Emergent
- ✅ Backed up automatically
- ✅ Accessible from all deployments in the same project

## Support

For deployment issues or questions:
1. Check deployment logs in Emergent interface
2. Run health check: `python3 ensure_super_admin.py`
3. Contact Emergent support

## Deployment History

### Latest Deployment (Ready)
- **Date**: November 20, 2025
- **Status**: Ready for production
- **Changes**:
  - Body Score MongoDB projection fixes
  - Password reset feature added
  - Oura callback URL field added
  - bcrypt compatibility fixed
  - Super-admin status ensured

---

**Important**: Always verify super-admin status after deployment by running `python3 ensure_super_admin.py`
