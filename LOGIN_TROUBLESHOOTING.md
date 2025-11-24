# Login Error 401 - Troubleshooting Guide

## Error Details
```
Request failed with status code 401
```

This means: **Authentication failed** - credentials not recognized

---

## Most Likely Causes

### 1. Database Was Reset (Fresh Start)
If you deployed with a fresh `trainsmart_db`, user accounts don't exist yet.

**Solution**: Create a new account
- Click "Sign Up" / "Register"
- Create new account with your email
- Login with new credentials

---

### 2. User Data in Old Database (Need Migration)
Your user account exists in the old production database but not in `trainsmart_db`.

**Check which database has users:**
```bash
# On production server
mongosh --eval "
  ['TrainSmartDB', 'trainsmart', 'healthtracker', 'test_database', 'trainsmart_db'].forEach(dbName => {
    let count = db.getSiblingDB(dbName).athletes.countDocuments();
    if (count > 0) print(dbName + ': ' + count + ' users');
  })
"
```

**If users found in old database:**
```bash
# Migrate from old_db to trainsmart_db
mongosh << 'MIGRATION'
use OLD_DB_NAME;
db.athletes.aggregate([
  { $match: {} },
  { $out: { db: "trainsmart_db", coll: "athletes" }}
]);
print("✅ Users migrated");
MIGRATION
```

---

### 3. Wrong Database Name in Production .env
Backend might be using wrong database.

**Check production .env:**
```bash
grep "DB_NAME" /app/backend/.env
```

Should show: `DB_NAME="trainsmart_db"`

**If wrong, fix it:**
```bash
nano /app/backend/.env
# Change to: DB_NAME="trainsmart_db"
sudo supervisorctl restart backend
```

---

### 4. Backend Not Running or Crashing
**Check backend status:**
```bash
sudo supervisorctl status backend
tail -50 /var/log/supervisor/backend*.log | grep -i error
```

**If not running:**
```bash
sudo supervisorctl restart backend
```

---

## Quick Fix Options

### Option A: Create New Account (Fastest - 2 minutes)
1. Go to signup page
2. Create account with andre@humanweb.no
3. Login with new account
4. Reconnect all integrations (Oura, Strava, etc.)

**Pros**: Fast, guaranteed to work
**Cons**: Lose old data, need to reconnect integrations

---

### Option B: Migrate Old User Data (10 minutes)
1. SSH to production server
2. Find which database has users (see commands above)
3. Migrate users to trainsmart_db
4. Migrate other collections (oura_activities, etc.)
5. Try login again

**Pros**: Keep all existing data
**Cons**: Requires server access, more steps

---

## Step-by-Step: Create New Account

1. On kaizenlifetracker.com, click "Sign Up" or "Register"
2. Enter:
   - Email: andre@humanweb.no
   - Password: (choose new password)
   - Name: Andre
3. Submit registration
4. Login with new credentials
5. Reconnect Oura from Account Settings
6. Sync Oura data

**Done!** All features should work now.

---

## Verification After Fix

Once logged in successfully:
- [ ] Dashboard loads
- [ ] Can navigate to Account Settings
- [ ] Can connect Oura Ring
- [ ] Can sync Oura data
- [ ] Oura card shows data on dashboard
- [ ] Body Score shows 7-9 components

---

## Still Getting 401?

### Check backend logs:
```bash
tail -100 /var/log/supervisor/backend*.log | grep -i "401\|auth\|login"
```

### Verify database connection:
```bash
mongosh trainsmart_db --eval "
  print('Athletes:', db.athletes.countDocuments());
  print('Collections:', db.getCollectionNames().length);
"
```

### Check backend can reach database:
```bash
# In backend logs, look for:
# - "MongoDB connected" or similar
# - Any database connection errors
tail -50 /var/log/supervisor/backend*.log | head -30
```

---

## Production vs Preview

**Note**: Preview environment and production have separate databases.
- Preview: Clean fresh install
- Production: May have old data in different database

This is why migration might be needed for production.

---

## Contact Support

If none of these work:
1. Provide backend logs
2. Show database list output
3. Show .env DB_NAME value
4. Confirm backend is running

---

## Quick Decision Tree

```
Can't login (401 error)?
│
├─ Want to keep old data?
│  ├─ YES → Option B: Migrate user data
│  └─ NO  → Option A: Create new account ⭐ FASTEST
│
└─ Database wrong in .env?
   └─ Fix DB_NAME in .env, restart backend
```

---

**Recommended**: Start with **Option A** (create new account) to verify everything works, then optionally migrate old data later if needed.
