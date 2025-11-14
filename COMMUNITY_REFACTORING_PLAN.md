# Community.js Refactoring Plan

## Current State Analysis

**File**: `/app/frontend/src/components/Community.js`  
**Total Lines**: 7,893 lines  
**Primary Issues**:
1. Single monolithic component managing all community functionality
2. 100+ state variables in one component
3. Multiple responsibilities (posts, groups, events, challenges, notifications, profiles)
4. Poor code reusability
5. Difficult to maintain and test
6. Performance issues due to massive re-renders

---

## Identified Components & Sections

### Main Community Component (Lines 20-4316)
**State Management** (approx. 100+ state variables):
- Posts state (lines 39-60)
- Notifications state (lines 74-78)
- Profile state (lines 84-87)
- Modals state (lines 90-120)
- Filters state (lines 122-125)
- Groups state (lines 137-165)
- Events state (lines 168-198)
- Challenges state (lines 200-236)
- UI state (scrolling, touch, etc.)

**Handler Functions** (approx. 150+ functions):
- Post handlers (load, create, edit, delete, like, share, comment)
- Group handlers (load, create, edit, delete, join, leave)
- Event handlers (load, create, edit, delete, RSVP)
- Challenge handlers (load, create, edit, delete, join, leave)
- Notification handlers
- Media upload handlers
- Mention handlers
- Navigation handlers

### Sub-Components Already Defined (Lines 4317-7893)
1. **PostsList** (line 4317) - Renders list of posts
2. **GroupCard** (line 4680) - Individual group card
3. **CreateGroupModal** (line 4774) - Modal for creating groups
4. **EditGroupModal** (line 4940) - Modal for editing groups
5. **AthleteProfileModal** (line 5103) - User profile modal
6. **GroupDetailView** (line 5438) - Detailed group view
7. **AthletesModal** (line 5817) - Find athletes modal
8. **GroupRulesModal** (line 5967) - Group rules acceptance
9. **ChallengeCard** (line 6056) - Individual challenge card
10. **EventCard** (line 6226) - Individual event card
11. **CreateChallengeModal** (line 6336) - Modal for creating challenges
12. **ChallengeDetailModal** (line 6598) - Detailed challenge view
13. **EditChallengeModal** (line 6887) - Modal for editing challenges
14. **CreateEventModal** (line 7024) - Modal for creating events
15. **EditEventModal** (line 7203) - Modal for editing events
16. **EventDetailModal** (line 7369) - Detailed event view
17. **CommentsModal** (line 7638) - Comments modal for posts/events

---

## Refactoring Strategy

### Phase 1: Extract Existing Sub-Components (PRIORITY 1)
**Goal**: Move all sub-components into separate files

**Files to Create**:
```
/app/frontend/src/components/community/
├── cards/
│   ├── PostCard.js              (Extract from inline rendering)
│   ├── GroupCard.js             (Line 4680)
│   ├── EventCard.js             (Line 6226)
│   └── ChallengeCard.js         (Line 6056)
├── modals/
│   ├── CommentsModal.js         (Line 7638)
│   ├── AthleteProfileModal.js   (Line 5103)
│   ├── CreateGroupModal.js      (Line 4774)
│   ├── EditGroupModal.js        (Line 4940)
│   ├── GroupRulesModal.js       (Line 5967)
│   ├── CreateEventModal.js      (Line 7024)
│   ├── EditEventModal.js        (Line 7203)
│   ├── EventDetailModal.js      (Line 7369)
│   ├── CreateChallengeModal.js  (Line 6336)
│   ├── EditChallengeModal.js    (Line 6887)
│   ├── ChallengeDetailModal.js  (Line 6598)
│   ├── WritePostModal.js        (Extract from main component)
│   ├── SharePostModal.js        (Extract from main component)
│   ├── AthletesModal.js         (Line 5817)
│   └── NotificationsModal.js    (Extract from main component)
├── views/
│   ├── GroupDetailView.js       (Line 5438)
│   └── PostsList.js             (Line 4317)
└── index.js                     (Export all components)
```

**Benefits**:
- Immediate reduction of main file size by ~3,500 lines
- Each modal becomes independently testable
- Easier to maintain individual components
- Better code organization

---

### Phase 2: Create Custom Hooks for Shared Logic (PRIORITY 2)
**Goal**: Extract reusable business logic into custom hooks

**Hooks to Create**:
```
/app/frontend/src/hooks/community/
├── usePostActions.js
│   - handleToggleLike
│   - handleSharePost
│   - handleDeletePost
│   - handleEditPost
│   - handleCreatePost
│
├── useComments.js
│   - handleAddComment
│   - handleDeleteComment
│   - toggleComments
│   - loadComments
│
├── useMediaUpload.js
│   - handleImageSelect
│   - handleMediaSelect
│   - handleRemoveMedia
│   - compressMedia
│   - uploadMedia
│
├── useMentions.js
│   - searchAthletes
│   - handleMentionTrigger
│   - handleSelectMention
│   - formatMentions
│
├── useNotifications.js
│   - loadNotifications
│   - markNotificationRead
│   - handleNotificationClick
│
├── useGroupActions.js
│   - loadGroups
│   - createGroup
│   - editGroup
│   - deleteGroup
│   - joinGroup
│   - leaveGroup
│
├── useEventActions.js
│   - loadEvents
│   - createEvent
│   - editEvent
│   - deleteEvent
│   - handleRSVP
│
├── useChallengeActions.js
│   - loadChallenges
│   - createChallenge
│   - editChallenge
│   - deleteChallenge
│   - joinChallenge
│   - leaveChallenge
│
└── useAthleteProfile.js
    - loadAthleteProfile
    - handleFollowToggle
    - loadAthletes
```

**Benefits**:
- Reusable logic across components
- Easier testing of business logic
- Cleaner component code
- Better separation of concerns

---

### Phase 3: Break Down Main Component by Feature (PRIORITY 3)
**Goal**: Split main Community component into feature-based components

**Feature Components to Create**:
```
/app/frontend/src/components/community/
├── tabs/
│   ├── CommunityFeed.js         (Feed tab - lines 2335-2728)
│   ├── CommunityFollowing.js    (Following tab - lines 2730-3088)
│   ├── CommunityGroups.js       (Groups tab - lines 3090-3435)
│   ├── CommunityMyGroups.js     (My Groups tab - lines 3437-3782)
│   ├── CommunityEvents.js       (Events tab - lines 3784-4060)
│   └── CommunityChallenges.js   (Challenges tab - lines 4062-4200)
│
├── navigation/
│   └── CommunityNavigation.js   (Tab navigation - lines 2222-2332)
│
└── Community.js                  (Main orchestrator - minimal state)
```

**Main Community Component Responsibilities** (After Refactoring):
- Tab state management
- Route between feature components
- Pass shared props (athleteId, athlete)
- Manage global modals (if any)

**Benefits**:
- Each tab becomes independently testable
- Lazy loading opportunities (code splitting)
- Clearer responsibility boundaries
- Easier to add new features

---

### Phase 4: Create Context Provider (If Needed) (PRIORITY 4)
**Goal**: Share common state across community components

**Context to Create** (if needed):
```
/app/frontend/src/contexts/
└── CommunityContext.js
    - Current athlete data
    - Notification state
    - Modal state coordination
    - Shared filter preferences
```

**Note**: Only create if multiple components need the same state. Start without context and add only if necessary.

---

## Implementation Order

### Step 1: Extract Modal Components (Easiest, High Impact)
**Estimated Reduction**: ~3,500 lines
**Risk Level**: Low
**Dependencies**: None

**Components to Extract First**:
1. CommentsModal (line 7638) - 255 lines
2. EventDetailModal (line 7369) - 269 lines
3. ChallengeDetailModal (line 6598) - 289 lines
4. AthleteProfileModal (line 5103) - 335 lines
5. CreateEventModal (line 7024) - 179 lines
6. EditEventModal (line 7203) - 166 lines
7. CreateChallengeModal (line 6336) - 262 lines
8. EditChallengeModal (line 6887) - 137 lines
9. CreateGroupModal (line 4774) - 166 lines
10. EditGroupModal (line 4940) - 163 lines
11. GroupRulesModal (line 5967) - 89 lines
12. AthletesModal (line 5817) - 150 lines

### Step 2: Extract Card Components
**Estimated Reduction**: ~1,000 lines
**Risk Level**: Low
**Dependencies**: May need some hooks from Step 3

**Components**:
1. GroupCard (line 4680) - 94 lines
2. EventCard (line 6226) - 110 lines
3. ChallengeCard (line 6056) - 170 lines
4. PostCard (extract from inline rendering) - ~200 lines

### Step 3: Extract View Components
**Estimated Reduction**: ~600 lines
**Risk Level**: Medium
**Dependencies**: May need props from parent

**Components**:
1. GroupDetailView (line 5438) - 379 lines
2. PostsList (line 4317) - 363 lines

### Step 4: Create Custom Hooks
**Estimated Reduction**: ~2,000 lines (moved to hooks)
**Risk Level**: Medium
**Dependencies**: May affect multiple components

**Priority Order**:
1. useMediaUpload (standalone logic)
2. useMentions (standalone logic)
3. usePostActions (depends on media/mentions)
4. useComments (depends on mentions)
5. useNotifications (standalone)
6. useAthleteProfile (standalone)
7. useGroupActions (standalone)
8. useEventActions (standalone)
9. useChallengeActions (standalone)

### Step 5: Split Feature Tabs
**Estimated Reduction**: Main component to ~500 lines
**Risk Level**: High
**Dependencies**: All above steps completed

**Order**:
1. CommunityNavigation (simple)
2. CommunityFeed (most complex - do last)
3. CommunityFollowing (similar to Feed)
4. CommunityChallenges (moderate)
5. CommunityEvents (moderate)
6. CommunityGroups (moderate)
7. CommunityMyGroups (similar to Groups)

---

## Testing Strategy

### After Each Extraction
1. **Visual Testing**: Verify UI renders correctly
2. **Functional Testing**: Verify all interactions work
3. **Props Testing**: Verify all props are passed correctly
4. **State Testing**: Verify state updates correctly

### Test Cases to Cover
- Create/Edit/Delete posts
- Like/Comment/Share functionality
- Group creation and management
- Event creation and RSVP
- Challenge creation and participation
- Notification interactions
- Profile viewing and following
- Media upload (images/videos)
- Mentions in posts/comments

---

## File Size Reduction Estimates

| Phase | Current Size | After Refactoring | Reduction |
|-------|-------------|-------------------|-----------|
| Main Community.js | 7,893 lines | ~500 lines | -7,393 lines (93%) |
| Modals (17 files) | 0 | ~2,960 lines | (extracted) |
| Cards (4 files) | 0 | ~574 lines | (extracted) |
| Views (2 files) | 0 | ~742 lines | (extracted) |
| Hooks (10 files) | 0 | ~2,000 lines | (extracted) |
| Tabs (6 files) | 0 | ~1,500 lines | (extracted) |

**Total New Files**: ~40 files  
**Largest Component After Refactoring**: CommunityFeed (~300 lines)

---

## Success Criteria

1. ✅ Main Community.js reduced to < 600 lines
2. ✅ No component exceeds 400 lines
3. ✅ All existing functionality preserved
4. ✅ All tests pass (backend and frontend)
5. ✅ No visual regressions
6. ✅ Performance improvements (faster initial load, smaller bundles)

---

## Rollback Strategy

- Each extraction is a separate commit
- If any step breaks functionality, revert that commit
- Continue with other extractions
- Fix and re-apply broken extraction

---

## Timeline Estimate

| Phase | Estimated Time | Risk |
|-------|---------------|------|
| Phase 1 (Modals) | 3-4 hours | Low |
| Phase 2 (Cards) | 1 hour | Low |
| Phase 3 (Views) | 1 hour | Medium |
| Phase 4 (Hooks) | 2-3 hours | Medium |
| Phase 5 (Tabs) | 2-3 hours | High |
| Testing | 2 hours | - |
| **TOTAL** | **11-14 hours** | - |

---

## Next Steps

1. ✅ Get user approval for this plan
2. Start with Phase 1, Step 1: Extract CommentsModal
3. Test after each extraction
4. Continue with remaining modals
5. Move to Phase 2 after Phase 1 complete

