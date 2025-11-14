# Oura Ring Connection Guide

## 🔍 Current Issue Analysis

Based on the screenshots and database checks:

### Problem:
- **Sleep score showing "--"** in TrainSmart but shows **91** in Oura app
- **Resting HR, Sleep Time, and Avg HRV all showing "--"**
- Readiness (64) and Activity (69) showing in TrainSmart

### Root Cause:
The database query shows:
```json
{
  "activities": [],
  "total": 0
}
```

**Oura Ring is NOT connected to the TrainSmart account yet.**

The integration status returns:
```json
{
  "connected": false,
  "has_credentials": false,
  "last_sync": null
}
```

## 📋 How to Fix - Connect Oura Ring

### Step 1: Set Up Oura Credentials (Admin)
If you're the system administrator:

1. Get Oura API credentials:
   - Go to https://cloud.ouraring.com/personal-access-tokens
   - Create a Personal Access Token OR OAuth2 App
   - Get: `Client ID` and `Client Secret`

2. Add credentials to TrainSmart:
   - Navigate to **System Settings** (if admin)
   - Add Oura credentials under integrations
   - Save settings

### Step 2: Connect Your Oura Ring (User)
1. Navigate to **Dashboard → Account → Integrations**
2. Find the **Oura Ring** integration card
3. Click **Connect** button
4. Authorize TrainSmart to access your Oura data
5. Click **Sync** or **Full Sync** to import your data

### Step 3: Wait for Sync
- Initial sync may take 1-2 minutes
- Full sync fetches last 30 days of data
- Incremental sync fetches recent data only

### Step 4: Verify Data
Once connected and synced:
- Sleep score will show (e.g., 91)
- Readiness score will show (e.g., 64)
- Activity score will show (e.g., 71)
- **Last Night section will show:**
  - Resting HR (e.g., 48 bpm)
  - Sleep Time (e.g., 8h 26m)
  - Avg HRV (e.g., 65 ms)

## 🎯 What Data is Captured

### From Oura API v2:

**Sleep Data:**
- `score` - Overall sleep score (0-100)
- `total_sleep_duration` - Total sleep time in seconds
- `deep_sleep_duration` - Deep sleep duration
- `rem_sleep_duration` - REM sleep duration
- `light_sleep_duration` - Light sleep duration
- `efficiency` - Sleep efficiency percentage
- `lowest_heart_rate` - Lowest resting HR during sleep ⭐
- `average_heart_rate` - Average HR during sleep ⭐
- `average_hrv` - Average HRV during sleep ⭐

**Readiness Data:**
- `score` - Overall readiness score (0-100)
- `temperature_deviation` - Body temp deviation from baseline
- `temperature_trend_deviation` - Temperature trend

**Activity Data:**
- `score` - Overall activity score (0-100)
- `steps` - Total steps
- `active_calories` - Calories burned
- `equivalent_walking_distance` - Walking distance equivalent

## 🔧 Frontend Implementation

The OuraVitalsCard now displays:

### Layout:
```
┌─────────────────────────────────────────┐
│  🌙 Oura Ring                     🔄    │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐
│  │        ⚡ Readiness: 64            │
│  │           +0.2°C                    │
│  └─────────────────────────────────────┘
│
│  ┌──────────────────┐  ┌──────────────┐
│  │  🌙 Sleep: 91   │  │ 📊 Activity │
│  │    8h 26m        │  │     71      │
│  └──────────────────┘  └──────────────┘
│
│  Last Night
│  ┌─────────┐  ┌──────────┐  ┌────────┐
│  │Resting  │  │ Sleep    │  │ Avg    │
│  │   HR    │  │  Time    │  │  HRV   │
│  │  48 bpm │  │ 8h 26m   │  │ 65 ms  │
│  └─────────┘  └──────────┘  └────────┘
└─────────────────────────────────────────┘
```

### Data Flow:
1. User clicks refresh button (🔄)
2. Frontend calls: `POST /api/integrations/oura/{athleteId}/sync`
3. Backend fetches latest data from Oura API
4. Data stored in `oura_activities` MongoDB collection
5. Frontend fetches: `GET /api/integrations/oura/{athleteId}/activities?limit=30`
6. Card displays latest Sleep, Readiness, and Activity data

## 🐛 Troubleshooting

### Issue: Data not showing after sync
**Check:**
1. Browser console logs (F12 → Console)
2. Look for: `[OURA] Fetched activities:` log
3. Check if activities array has data

**Solution:**
- Wait 2-3 seconds after clicking refresh
- Hard refresh browser (Ctrl+Shift+R)
- Check Account → Integrations → Oura shows "Connected"

### Issue: "No recent Oura data"
**Check:**
- Is Oura Ring connected? (Check status API)
- Has sync been run? (Check last_sync timestamp)
- Does Oura app show recent data?

**Solution:**
- Connect Oura Ring first
- Run Full Sync to import historical data
- Ensure ring is charged and synced to phone

### Issue: Some metrics show "--"
**Check:**
- Which metrics are missing?
- Sleep score missing = No sleep data synced yet
- HR/HRV missing = API doesn't return these fields for old data

**Solution:**
- Wait for tonight's sleep data
- New sleep sessions will have HR/HRV data
- Oura API v2 includes these fields in recent sleep data

## 📊 Database Structure

### Collection: `oura_activities`
```javascript
{
  "_id": "...",
  "user_id": "smooth-trainer",
  "activity_id": "sleep_abc123",
  "type": "Sleep",  // or "Readiness" or "Activity"
  "start_date": ISODate("2025-11-14T00:00:00Z"),
  "duration": 30360,  // seconds
  "score": 91,
  "lowest_heart_rate": 48,
  "average_heart_rate": 52,
  "average_hrv": 65,
  "deep_sleep": 7200,
  "rem_sleep": 5400,
  "light_sleep": 17760,
  "efficiency": 92,
  "raw_data": {...}  // Full Oura API response
}
```

## ✅ Expected Behavior After Connection

Once Oura is connected and synced:
1. **Sleep Score** displays last night's sleep score (e.g., 91)
2. **Readiness Score** displays today's readiness (e.g., 64)
3. **Activity Score** displays today's activity (e.g., 71)
4. **Last Night section** displays:
   - Lowest resting heart rate from sleep
   - Total sleep time in hours and minutes
   - Average HRV from sleep session

## 🚀 Next Steps

1. **Connect Oura Ring** via Account → Integrations
2. **Run Full Sync** to import last 30 days of data
3. **Refresh dashboard** to see populated Oura card
4. **Click refresh button** anytime to fetch latest data

---

**Note:** The layout has been updated to show Readiness on top with Sleep and Activity side by side below, as requested. The "Last Night" metrics will populate once sleep data with HR/HRV is available from a recent sync.
