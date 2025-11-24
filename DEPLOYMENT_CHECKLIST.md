# Production Deployment Checklist

## Pre-Deployment

- [ ] Read PRODUCTION_DEPLOYMENT_GUIDE.md completely
- [ ] Decide: Fresh Start (Option A) or Migrate Data (Option B)
- [ ] **If Option B**: Backup current production database
  ```bash
  mongodump --db=<current_db> --out=/backup/mongodb_$(date +%Y%m%d)
  ```

---

## Deployment

- [ ] Save code to GitHub
- [ ] Deploy to production (kaizenlifetracker.com)
- [ ] **If Option B**: Run migration script (see guide)
- [ ] Verify backend starts successfully
  ```bash
  sudo supervisorctl status backend
  tail -50 /var/log/supervisor/backend*.log
  ```

---

## Post-Deployment Testing

### Database Verification
- [ ] Check database name
  ```bash
  mongosh --eval "db.getName()"
  # Should show: trainsmart_db
  ```

- [ ] Check collections exist
  ```bash
  mongosh trainsmart_db --eval "db.getCollectionNames()"
  ```

### Application Testing
- [ ] Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
- [ ] Login to application
- [ ] Navigate to Account Settings
- [ ] Check Oura connection status
- [ ] **If disconnected**: Reconnect Oura Ring
- [ ] Trigger manual sync
- [ ] Navigate to Dashboard home
- [ ] **Verify**: Oura card shows data (not "No recent Oura data available")
- [ ] Navigate to Today page
- [ ] **Verify**: Body Score shows 7-9 components (not 4)

### Backend Logs Check
- [ ] Check Oura activity logs
  ```bash
  tail -100 /var/log/supervisor/backend*.log | grep -i "oura"
  ```
  Should see:
  - "Fetching Oura activities for athlete_id: xxx, found N activities"
  - "Oura status for athlete_id xxx: connected=True"

### API Response Check
- [ ] Check cache headers (Browser DevTools → Network)
  - Select any Oura endpoint
  - Response Headers should show:
    ```
    Cache-Control: no-cache, no-store, must-revalidate
    ```

---

## If Issues Occur

### Oura Data Still Not Showing
1. Check backend logs for errors
2. Verify database name is correct
3. Check Oura connection status in app
4. Try manual sync from Account Settings
5. Check if data exists in database:
   ```bash
   mongosh trainsmart_db --eval "db.oura_activities.countDocuments({})"
   ```

### Wrong Database Being Used
1. Check .env file: `grep DB_NAME /app/backend/.env`
2. Restart backend: `sudo supervisorctl restart backend`
3. Verify connection: `mongosh --eval "db.getName()"`

### Need to Rollback
1. Stop backend: `sudo supervisorctl stop backend`
2. Restore from backup (if you made one)
3. Update .env to old database name
4. Restart: `sudo supervisorctl start backend`

---

## Success Criteria

✅ Database name is `trainsmart_db`
✅ Backend logs show Oura data being fetched
✅ Dashboard Oura card displays data
✅ Body Score shows 7-9 components
✅ No "No recent Oura data available" messages
✅ Cache-Control headers present in API responses
✅ All user integrations working (Oura, Strava, etc.)

---

## Timeline

- **Deployment**: 5-10 minutes
- **Data Migration** (if Option B): 10-30 minutes (depends on data size)
- **Testing**: 10-15 minutes
- **Total**: 30-60 minutes

---

## Support

If you encounter issues not covered here:
1. Check `/app/PRODUCTION_DEPLOYMENT_GUIDE.md` for detailed troubleshooting
2. Review backend logs for specific error messages
3. Verify MongoDB connection and database name
4. Ensure all environment variables are correctly set

---

**Remember**: After deployment, users may need to reconnect Oura if you chose Option A (Fresh Start). This is normal and expected.
