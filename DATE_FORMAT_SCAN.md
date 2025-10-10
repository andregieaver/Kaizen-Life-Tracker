# Date Format Integration Scan Report

## Overview
This document identifies all locations in the application where date formatting is hardcoded and needs to be updated to respect user's `date_format` preference.

## Date Format Preference Added ✅
- **Backend Model**: Added `date_format` field to `AthleteProfile` and `AthleteUpdate`
- **Frontend Account Settings**: Added date format selector with 5 options:
  - `MM/DD/YYYY` (12/31/2024) - US format
  - `DD/MM/YYYY` (31/12/2024) - European format
  - `YYYY-MM-DD` (2024-12-31) - ISO format
  - `MMM DD, YYYY` (Dec 31, 2024) - Month name short
  - `DD MMM YYYY` (31 Dec 2024) - Day first with month name

## Updated Formatter Utility ✅
- **File**: `/app/frontend/src/utils/formatters.js`
- **Function**: `formatDate(dateString, preferences)`
- **Features**:
  - Respects timezone preference
  - Applies user's selected date format
  - Handles all 5 format options
  - Fallback to browser locale if error

---

## Locations Requiring Date Format Integration

### 🔴 HIGH PRIORITY - User-Facing Dates

#### 1. Nutrition Component
**File**: `/app/frontend/src/components/Nutrition.js`
**Line 140**: `date.toLocaleDateString('en-US', {...})`
```javascript
// Current
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Should be
import { formatDate } from '../utils/formatters';
// Use formatDate(dateString, athletePreferences)
```
**Impact**: Nutrition entry dates

---

#### 2. Journal Component
**File**: `/app/frontend/src/components/Journal.js`
**Line 128**: `date.toLocaleDateString('en-US', {...})`
```javascript
// Current
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Should be
import { formatDate } from '../utils/formatters';
// Use formatDate(dateString, athletePreferences)
```
**Impact**: Journal entry dates

---

#### 3. Workout History Component
**File**: `/app/frontend/src/components/WorkoutHistory.js`
**Lines 133, 220**: Hardcoded date formatting
```javascript
// Current (Line 133)
{new Date(workout.date).toLocaleDateString('en-US', {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric'
})}

// Current (Line 220)
{new Date(sleep.date).toLocaleDateString('en-US', {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric'
})}

// Should be
import { formatDate } from '../utils/formatters';
{formatDate(workout.date, athletePreferences)}
{formatDate(sleep.date, athletePreferences)}
```
**Impact**: Workout and sleep data dates

---

#### 4. Dashboard Component
**File**: `/app/frontend/src/components/Dashboard.js`
**Line 354**: Recent workout dates
```javascript
// Current
{new Date(workout.date).toLocaleDateString()}

// Should be
{formatDate(workout.date, athlete)}
```
**Impact**: Recent workouts display on dashboard overview

---

#### 5. ReadinessCard Component
**File**: `/app/frontend/src/components/ReadinessCard.js`
**Line 67**: Readiness date display
```javascript
// Current
{new Date(readiness.date).toLocaleDateString(undefined, { 
  // options
})}

// Should be
{formatDate(readiness.date, athletePreferences)}
```
**Impact**: Readiness score date

---

### 🟡 MEDIUM PRIORITY - Integration/Sync Dates

#### 6. Account Component - Integration Last Sync
**File**: `/app/frontend/src/components/Account.js`
**Lines 69, 2131, 2203, 2275**: Integration sync dates
```javascript
// Line 69 - formatLastSync function
return syncDate.toLocaleDateString();

// Lines 2131, 2203, 2275 - Integration last sync displays
new Date(integrations.strava.last_sync).toLocaleString()
new Date(integrations.oura.last_sync).toLocaleString()
new Date(integrations.coros.last_sync).toLocaleString()

// Should use
import { formatDateTime } from '../utils/formatters';
formatDateTime(lastSync, athletePreferences)
```
**Impact**: Shows when integrations last synced data

---

#### 7. Connections Component
**File**: `/app/frontend/src/components/Connections.js`
**Line 160**: Connection last sync
```javascript
// Current
return syncDate.toLocaleDateString();

// Should be
return formatDate(syncDate, athletePreferences);
```
**Impact**: Provider connection sync status

---

#### 8. Status Component
**File**: `/app/frontend/src/components/Status.js`
**Lines 264-265, 317**: Activity and sync dates
```javascript
// Lines 264-265
new Date(connection.last_sync_at).toLocaleDateString() + ' ' + 
new Date(connection.last_sync_at).toLocaleTimeString()

// Line 317
{activity.start_time ? new Date(activity.start_time).toLocaleDateString() : 'Unknown date'}

// Should use
import { formatDateTime, formatDate } from '../utils/formatters';
formatDateTime(connection.last_sync_at, preferences)
formatDate(activity.start_time, preferences)
```
**Impact**: Integration status page displays

---

### 🟢 LOW PRIORITY - Subscription/Admin Dates

#### 9. Account Component - Subscription Dates
**File**: `/app/frontend/src/components/Account.js`
**Lines 1335, 1377, 1690**: Subscription billing and invoice dates
```javascript
// Line 1335 - Next billing date
new Date(subscriptionStatus.current_period_end).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})

// Line 1377 - Current period end
new Date(subscriptionStatus.current_period_end).toLocaleDateString()

// Line 1690 - Invoice dates
new Date(invoice.created * 1000).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})

// Should use formatDate
```
**Impact**: Subscription and billing information

---

#### 10. AccountSimplified Component
**File**: `/app/frontend/src/components/AccountSimplified.js`
**Lines 152, 222**: Account created date and billing date
```javascript
// Line 152
new Date(athlete.created_at).toLocaleDateString()

// Line 222
new Date(subscriptionData.next_billing_date).toLocaleDateString()

// Should use formatDate
```
**Impact**: Simplified account view

---

### ⚠️ SPECIAL CASE - TrainingCalendar (Moment.js)

**File**: `/app/frontend/src/components/TrainingCalendar.js`
**Lines 42, 43, 77-94, etc.**: Uses moment.js for calendar functionality

**Note**: TrainingCalendar uses `moment.js` for calendar operations (week calculations, month views, etc.). These are for **calendar logic**, not display formatting.

**Action Needed**: 
- ✅ Calendar logic uses moment.js (keep as is)
- 🔄 Date **labels** should use user's format preference
- **Line 82**: `weekStart.format('MMM D')` - Label should respect user format

```javascript
// Current (Line 82)
label: i === 0 ? 'This Week' : weekStart.format('MMM D'),

// Should check date_format and format accordingly
// This is a week label, may keep as is for consistency with calendar library
```

---

## Implementation Strategy

### Phase 1: Pass Preferences to Components
Update parent components to pass `athletePreferences` to child components:

1. **Dashboard** → Pass to:
   - WorkoutHistory
   - ReadinessCard
   - (Already passes to TrainingCalendar ✅)

2. **Dashboard** → Pass to:
   - Journal
   - Nutrition

3. **Account** → Already has athlete data ✅

### Phase 2: Update Components Systematically
Priority order:
1. Journal & Nutrition (user creates content)
2. WorkoutHistory & ReadinessCard (main data displays)
3. Dashboard recent workouts
4. Integration sync dates
5. Subscription/billing dates

### Phase 3: Import and Use Formatters
For each component:
```javascript
import { formatDate, formatDateTime } from '../utils/formatters';

// Replace hardcoded formatting
// OLD: new Date(date).toLocaleDateString()
// NEW: formatDate(date, athletePreferences)

// OLD: new Date(date).toLocaleString()
// NEW: formatDateTime(date, athletePreferences)
```

---

## Summary Statistics

| Priority | Component | Lines to Update | Type |
|----------|-----------|-----------------|------|
| 🔴 High | Nutrition | 1 | formatDate function |
| 🔴 High | Journal | 1 | formatDate function |
| 🔴 High | WorkoutHistory | 2 | Date displays |
| 🔴 High | Dashboard | 1 | Recent workouts |
| 🔴 High | ReadinessCard | 1 | Score date |
| 🟡 Medium | Account (integrations) | 4 | Sync dates |
| 🟡 Medium | Connections | 1 | Sync date |
| 🟡 Medium | Status | 3 | Activity dates |
| 🟢 Low | Account (subscription) | 3 | Billing dates |
| 🟢 Low | AccountSimplified | 2 | Admin dates |

**Total**: ~19 locations across 10 components

---

## Testing Checklist

After implementation, verify:

- [ ] Change date format in Account → Preferences
- [ ] Check Nutrition entry dates update
- [ ] Check Journal entry dates update
- [ ] Check Workout History dates update
- [ ] Check Dashboard recent workout dates
- [ ] Check Readiness card date
- [ ] Check integration last sync dates
- [ ] Check subscription billing dates
- [ ] Verify all 5 date format options work correctly
- [ ] Verify timezone is respected in date displays

---

## Next Steps

**Recommended Order:**
1. Update Dashboard to pass preferences to child components
2. Start with Journal & Nutrition (Phase 1 - High Priority)
3. Continue with WorkoutHistory & ReadinessCard
4. Move to integration sync dates
5. Finish with subscription/billing dates

**Files to Update:**
- Dashboard.js (pass preferences)
- Nutrition.js
- Journal.js  
- WorkoutHistory.js
- ReadinessCard.js
- Account.js (integration sections)
- Connections.js
- Status.js
- AccountSimplified.js (if used)
