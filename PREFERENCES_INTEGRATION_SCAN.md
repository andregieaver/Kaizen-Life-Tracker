# Preferences Integration Scan Report

## Overview
This document outlines all locations in the application where user preferences (set in Account settings) should control the display format and values.

## Preferences Available
From `/app/backend/server.py` AthleteProfile model:
- **distance_unit**: 'miles' or 'km' (default: 'miles')
- **measurement_system**: 'imperial' or 'metric' (default: 'imperial')  
- **week_starts_on**: 'sunday' or 'monday' (default: 'monday')
- **timezone**: Timezone string (default: 'UTC')
- **time_format**: '12h' or '24h' (default: '12h')
- **language**: Language code (default: 'en') - **Already handled by i18n**

## Status: Account Settings Implementation ✅
### Completed
- ✅ Backend models updated with all preference fields
- ✅ Frontend Account.js has Personal Information form with height, weight, VO2Max
- ✅ Frontend Account.js has Preferences tab with all selectors
- ✅ `handleSavePersonalInfo` function implemented (saves to backend)
- ✅ `handleSavePreferences` function implemented (saves to backend)
- ✅ Language selector moved to Preferences tab

---

## Areas Requiring Preference Integration

### 1. Training Calendar Component 
**File**: `/app/frontend/src/components/TrainingCalendar.js`

#### Distance Unit (miles/km)
**Current Status**: Hardcoded to 'miles'
**Lines to Update**:
- Line 159: `${week.totalDistance.toFixed(1)} mi` → Should use user's `distance_unit`
- Line 193: `{Math.round(week.totalDuration / week.totalDistance)}:00/mi` → Should use user's unit for pace
- Line 208: `{block.distance}mi` → Should use user's `distance_unit`
- Line 419: Checks `unit_system` from block data but should also respect user preference
- Line 465: `{weeklySummary.total_distance} miles` → Should use user's `distance_unit`
- Line 602-613: Distance input form - should show unit based on preference
- Line 648-670: Interval distance input - should show unit based on preference

**Implementation Strategy**:
1. Pass athlete preferences to TrainingCalendar component from Dashboard
2. Create helper function: `formatDistance(value, unit)` that converts and formats
3. Update all hardcoded distance displays to use the helper
4. Update form labels to show current unit system

#### Week Start Day
**Current Status**: Uses react-big-calendar default
**Lines to Update**:
- Calendar component configuration needs `localizer` with custom week start
- Line 696-704: Calendar component props should include week start preference

**Implementation Strategy**:
1. Configure moment localizer with user's week start preference
2. Pass to Calendar component's `culture` and `formats` props

#### Time Format (12h/24h)
**Current Status**: Not explicitly shown but could affect time displays
**Potential Impact**: 
- Time inputs in forms
- Time displays in workout details

---

### 2. Workout History Component
**File**: `/app/frontend/src/components/WorkoutHistory.js`

#### Distance Unit (miles/km)
**Current Status**: Hardcoded to 'miles'
**Lines to Update**:
- Line 142: `{workout.distance_miles} mi` → Should use user's `distance_unit`
- Line 145: `{Math.round(workout.duration_minutes / workout.distance_miles * 10) / 10} min/mi avg` → Should use user's unit for pace
- Line 155: `{workout.duration_minutes} min` → OK (duration is universal)

**Implementation Strategy**:
1. Pass athlete preferences to WorkoutHistory component
2. Create helper function: `convertDistance(distanceMiles, targetUnit)` 
3. Create helper function: `formatPace(duration, distance, unit)`
4. Update all distance and pace displays

---

### 3. Dashboard Overview/Statistics
**File**: `/app/frontend/src/components/Dashboard.js`

#### Current Status
**Needs Investigation**: Check if Dashboard displays any distance/time statistics

---

### 4. Data Logging (DataLogTabs)
**File**: `/app/frontend/src/components/DataLogTabs.js`

#### Distance Unit
**Lines to Update**:
- Distance inputs for workout logging should use user preference
- Need to scan for any hardcoded distance units

---

### 5. Readiness Card
**File**: `/app/frontend/src/components/ReadinessCard.js`

#### Current Status
**Needs Investigation**: Check if it displays distance-based metrics

---

### 6. Date/Time Formatting Throughout App
**Files with Date/Time displays**:
- `/app/frontend/src/components/Nutrition.js` (Line 138-140)
- `/app/frontend/src/components/Journal.js` (Line 126-128)
- `/app/frontend/src/components/Account.js` (Line 61-69, 1290, 1332, 1645, 2086, 2158, 2230)
- `/app/frontend/src/components/Connections.js` (Multiple lines)
- `/app/frontend/src/components/Recommendations.js` (Line 74-75, 140)

#### Current Status
Uses `toLocaleDateString()` and `toLocaleString()` which partially respects browser locale but not user's timezone/format preferences.

**Implementation Strategy**:
1. Create centralized date/time formatting utility: `/app/frontend/src/utils/dateFormatter.js`
2. Functions needed:
   - `formatDate(date, athletePrefs)` - formats date with user's timezone
   - `formatTime(date, athletePrefs)` - formats time with 12h/24h preference
   - `formatDateTime(date, athletePrefs)` - formats both
   - `formatRelativeTime(date)` - "X hours/days ago"
3. Replace all `toLocaleDateString()` and `toLocaleString()` calls with utility functions
4. Pass athlete preferences through context or props

---

### 7. Height/Weight Display (Personal Information)
**File**: `/app/frontend/src/components/Account.js`

#### Current Status
**Lines 954-996**: Form inputs show unit based on `measurement_system` preference ✅

**Additional Consideration**:
- When displaying height/weight elsewhere in the app, ensure it respects preference
- Consider if weight/height are displayed in Dashboard or other components

---

### 8. Charts and Data Visualization
**File**: `/app/frontend/src/components/ChartRenderer.js`

#### Current Status
**Needs Investigation**: Check if charts display distance metrics that need unit conversion

---

## Implementation Priority

### Phase 1: High Priority (User-Facing Data) 🔴
1. **Training Calendar** - Most visible, workout tracking core feature
2. **Workout History** - Historical data display
3. **Date/Time Formatting Utility** - Create centralized utility for consistent formatting

### Phase 2: Medium Priority 🟡
4. **DataLogTabs** - Workout entry forms
5. **Dashboard Statistics** - If any distance metrics shown
6. **Week Start Day** - Calendar configuration

### Phase 3: Low Priority (Edge Cases) 🟢
7. **Charts** - If displaying distance data
8. **Other Components** - Any remaining edge cases

---

## Recommended Implementation Approach

### Step 1: Create Utility Functions
Create `/app/frontend/src/utils/formatters.js`:
```javascript
// Distance conversion and formatting
export const convertDistance = (distanceMiles, targetUnit) => {
  if (targetUnit === 'km') {
    return distanceMiles * 1.60934;
  }
  return distanceMiles;
};

export const formatDistance = (distanceMiles, unit) => {
  const distance = convertDistance(distanceMiles, unit);
  return `${distance.toFixed(1)} ${unit}`;
};

// Pace conversion and formatting
export const formatPace = (durationMinutes, distanceMiles, unit) => {
  const distance = convertDistance(distanceMiles, unit);
  const pace = durationMinutes / distance;
  const minutes = Math.floor(pace);
  const seconds = Math.round((pace - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/${unit}`;
};

// Date/Time formatting with timezone support
export const formatDate = (dateString, athletePrefs) => {
  const { timezone, language } = athletePrefs;
  // Use Intl.DateTimeFormat with timezone
  return new Intl.DateTimeFormat(language || 'en-US', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date(dateString));
};

export const formatTime = (dateString, athletePrefs) => {
  const { timezone, time_format, language } = athletePrefs;
  return new Intl.DateTimeFormat(language || 'en-US', {
    timeZone: timezone || 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hour12: time_format === '12h'
  }).format(new Date(dateString));
};

export const formatDateTime = (dateString, athletePrefs) => {
  return `${formatDate(dateString, athletePrefs)} ${formatTime(dateString, athletePrefs)}`;
};
```

### Step 2: Pass Athlete Preferences via Context
Create `/app/frontend/src/contexts/AthleteContext.js`:
```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';

const AthleteContext = createContext();

export const useAthlete = () => useContext(AthleteContext);

export const AthleteProvider = ({ children, athleteId }) => {
  const [athlete, setAthlete] = useState(null);
  const [preferences, setPreferences] = useState({
    distance_unit: 'miles',
    measurement_system: 'imperial',
    week_starts_on: 'monday',
    timezone: 'UTC',
    time_format: '12h',
    language: 'en'
  });

  // Load athlete data and preferences
  useEffect(() => {
    // Fetch from API
  }, [athleteId]);

  return (
    <AthleteContext.Provider value={{ athlete, preferences, setPreferences }}>
      {children}
    </AthleteContext.Provider>
  );
};
```

### Step 3: Update Components Systematically
- Import utility functions
- Use `useAthlete()` hook to get preferences
- Replace hardcoded values with preference-based formatting
- Test each component after changes

---

## Testing Checklist

### Distance Unit Testing
- [ ] Create workout with distance in miles, switch to km, verify conversion
- [ ] Check Training Calendar weekly summary
- [ ] Check Workout History displays
- [ ] Check pace calculations update correctly

### Time Format Testing
- [ ] Switch between 12h and 24h format
- [ ] Verify all time displays update
- [ ] Check form inputs respect format

### Week Start Day Testing
- [ ] Switch between Sunday and Monday start
- [ ] Verify Training Calendar updates
- [ ] Check week groupings in summaries

### Timezone Testing
- [ ] Change timezone setting
- [ ] Verify all timestamps adjust correctly
- [ ] Check workout times display in correct timezone

### Measurement System Testing
- [ ] Switch between imperial and metric
- [ ] Verify height/weight displays update
- [ ] Check forms show correct units

---

## Notes
- Language preference is already handled by the i18n system ✅
- Backend models are ready to store all preferences ✅
- Frontend Account settings can save preferences ✅
- Next step is to apply preferences throughout the app for consistent UX
