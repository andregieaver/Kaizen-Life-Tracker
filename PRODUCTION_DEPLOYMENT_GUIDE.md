# Production Deployment Guide - Database Consolidation

## Overview
This deployment consolidates all data into ONE standard database: `trainsmart_db`

## What This Fixes
- ✅ Oura data not displaying (wrong database issue)
- ✅ Body Score showing only 4/9 components
- ✅ Stale cached data issues
- ✅ Database fragmentation and confusion

---

## Pre-Deployment: Check Your Production Database

### Step 1: Identify Your Current Production Database
SSH into your production server and run:
```bash
mongosh --eval "show dbs"
```

Look for the database with actual user data (usually the largest one).

### Step 2: Check Which Database Has Your Data
```bash
# Check each database for user data
for db in TrainSmartDB trainsmart trainsmart_db healthtracker; do
  echo "=== Checking $db ==="
  mongosh "$db" --eval "db.athletes.countDocuments({})"
done
```

The database with users is your current production database.

---

## Deployment Steps

### Option A: Fresh Start (Recommended if you're okay losing current data)

**Perfect for:**
- Testing/development environments
- If you want a clean slate
- If you can re-sync all Oura data

**Steps:**
1. Deploy the code (Save to GitHub → Deploy)
2. The `.env` is already configured with `DB_NAME="trainsmart_db"`
3. All new data will go to `trainsmart_db`
4. Users will need to reconnect integrations (Oura, Strava, etc.)

---

### Option B: Migrate Existing Production Data (If you want to keep data)

**Perfect for:**
- Production with real user data
- Want to preserve existing Oura syncs, user profiles, etc.

**Steps:**

#### 1. Backup Your Current Database (CRITICAL!)
```bash
# Replace 'old_db_name' with your actual database name
mongodump --db=old_db_name --out=/backup/mongodb_backup_$(date +%Y%m%d)
```

#### 2. Identify Your Current Database Name
```bash
# Find which database has data
mongosh --eval "
  ['TrainSmartDB', 'trainsmart', 'healthtracker', 'healthcoachdb', 'test_database'].forEach(dbName => {
    let count = db.getSiblingDB(dbName).athletes.countDocuments();
    if (count > 0) print(dbName + ': ' + count + ' users');
  })
"
```

#### 3. Migrate Data to trainsmart_db
```bash
# Replace 'OLD_DB_NAME' with the database that has your data
mongosh << 'EOF'
use OLD_DB_NAME;
let collections = db.getCollectionNames();
collections.forEach(collName => {
  print('Copying ' + collName + '...');
  db[collName].aggregate([{ $match: {} }, { $out: { db: "trainsmart_db", coll: collName }}]);
});
print('✅ Migration complete!');
EOF
```

#### 4. Verify Migration
```bash
mongosh trainsmart_db --eval "
  print('Athletes:', db.athletes.countDocuments());
  print('Oura activities:', db.oura_activities.countDocuments());
  print('Oura connections:', db.oura_connections.countDocuments());
"
```

#### 5. Deploy Code
1. Save to GitHub
2. Deploy to production
3. Backend will automatically use `trainsmart_db`

#### 6. Clean Up Old Databases (After Verifying Everything Works)
```bash
# ONLY after confirming production works!
mongosh --eval "use OLD_DB_NAME; db.dropDatabase();"
```

---

## Post-Deployment Verification

### 1. Check Database Connection
```bash
# On production server
tail -f /var/log/your-app/backend.log | grep -i mongo
```

### 2. Test Oura Data
- Navigate to Dashboard home page
- Oura card should show recent data (not "No recent Oura data available")
- Navigate to Today page → Body Score
- Should show 7-9 components (not 4)

### 3. Verify No Caching Issues
- Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
- Check Network tab → Response headers should show:
  ```
  Cache-Control: no-cache, no-store, must-revalidate
  ```

### 4. Check Backend Logs
```bash
tail -50 /var/log/your-app/backend.log | grep -i oura
```

Should see logs like:
```
INFO:root:Fetching Oura activities for athlete_id: xxx, found 10 activities
INFO:root:Oura status for athlete_id xxx: connected=True
```

---

## Rollback Plan (If Something Goes Wrong)

### If you backed up your database:
```bash
# Restore from backup
mongorestore --db=trainsmart_db /backup/mongodb_backup_YYYYMMDD/old_db_name
```

### If you didn't migrate yet:
```bash
# Just change .env back to old database name
DB_NAME="old_database_name"
# Restart backend
sudo supervisorctl restart backend
```

---

## Summary of Changes

### Code Changes:
- ✅ Oura queries support both `athlete_id` and `user_id` field names
- ✅ Cache-control headers prevent stale data
- ✅ Enhanced logging for debugging
- ✅ All endpoints return fresh data

### Configuration Changes:
- ✅ `.env` updated: `DB_NAME="trainsmart_db"`
- ✅ Preview environment: cleaned up all old databases
- ✅ ONE canonical database going forward

### Files Modified:
- `/app/backend/.env` - Database name standardized
- `/app/backend/server.py` - Oura endpoints with cache headers
- `/app/backend/integration_service.py` - Field name compatibility

---

## Need Help?

If you encounter issues:
1. Check backend logs for Oura-related errors
2. Verify database name with `mongosh --eval "db.getName()"`
3. Check Oura connection status in app settings
4. Try re-syncing Oura data manually

---

**Important**: After deployment, users may need to re-sync their Oura data if the database was changed. This is a one-time operation and will repopulate all historical data.
