# 🚀 Quick Start - Production Deployment

## TL;DR - What You Need to Know

**Problem**: Oura data not showing, multiple databases, missing translations
**Solution**: Database consolidation + field name compatibility fixes
**Status**: ✅ All fixes applied, ready to deploy

---

## 🎯 Deployment in 3 Steps

### Step 1: Save & Deploy (5 minutes)
```
1. Click "Save to GitHub" in Emergent interface
2. Deploy to production (kaizenlifetracker.com)
3. Wait for deployment to complete
```

### Step 2: Choose Your Path (Pick ONE)

**🟢 Option A: Fresh Start** (Simplest - 5 minutes)
- Let users reconnect their Oura Rings
- All data syncs from scratch
- Clean database setup
- **Recommended for**: Testing or if okay losing old data

**🔵 Option B: Migrate Data** (30 minutes)
- Keep existing user data and Oura syncs
- Requires SSH access to production
- Follow detailed guide in `/app/PRODUCTION_DEPLOYMENT_GUIDE.md`
- **Recommended for**: Production with real users

### Step 3: Verify (5 minutes)
```
1. Login to kaizenlifetracker.com
2. Check Dashboard → Oura card shows data
3. Check Today page → Body Score shows 7-9 components
4. Done! 🎉
```

---

## 📱 Testing Checklist

After deployment, verify these:

- [ ] ✅ Logo displays on header
- [ ] ✅ Dashboard Oura card shows recent data
- [ ] ✅ Body Score shows 7-9 components (not 4)
- [ ] ✅ Weather text appears in correct language
- [ ] ✅ No "No recent Oura data available" error

---

## 🆘 Quick Troubleshooting

### Oura data still not showing?
```bash
# On production server:
1. Check database: mongosh --eval "db.getName()"
   Should show: trainsmart_db

2. Check logs: tail -50 /var/log/supervisor/backend*.log

3. Try manual sync from Account Settings

4. Check if data exists:
   mongosh trainsmart_db --eval "db.oura_activities.countDocuments({})"
```

### Database name wrong?
```bash
# Fix .env file:
nano /app/backend/.env
# Change DB_NAME to "trainsmart_db"
sudo supervisorctl restart backend
```

---

## 📚 Detailed Guides Available

- **Full Guide**: `/app/PRODUCTION_DEPLOYMENT_GUIDE.md`
- **Checklist**: `/app/DEPLOYMENT_CHECKLIST.md`
- **All Changes**: `/app/SESSION_CHANGES_SUMMARY.md`

---

## 🔧 What Was Fixed

1. **Database Consolidation** - 6 databases → 1 (`trainsmart_db`)
2. **Field Compatibility** - Supports both `athlete_id` and `user_id`
3. **Cache Prevention** - Fresh data on every request
4. **Logo Fix** - Works on custom domains
5. **Translations** - All 11 languages complete

---

## ⏱️ Time Estimates

- **Option A (Fresh)**: 15-20 minutes total
- **Option B (Migrate)**: 45-60 minutes total

---

## 🎯 Success Criteria

After deployment, you should see:
- ✅ Oura sleep, readiness, activity scores
- ✅ Body Score with 7-9 components
- ✅ Logo on custom domain
- ✅ All translations working
- ✅ Fresh data (no stale cache)

---

## 🚨 Important Notes

1. **Database Name**: Must be `trainsmart_db` in production
2. **Cache**: Clear browser cache after deployment (Ctrl+Shift+R)
3. **Oura**: Users may need to reconnect if using Option A
4. **Backup**: Always backup before migration (Option B)

---

## 💬 Need Help?

1. Check backend logs for errors
2. Review `/app/PRODUCTION_DEPLOYMENT_GUIDE.md`
3. Verify database name is correct
4. Ensure Oura is connected in app settings

---

**Ready to deploy?** Follow Step 1 above! 👆

**Questions?** Read the detailed guides in `/app/` folder.

**Everything working?** You're all set! 🎉
