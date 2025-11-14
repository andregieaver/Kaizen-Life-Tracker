# Community.js - Phase 2 Refactoring Plan

## 🎯 Objective
Reduce Community.js from **4,368 lines** to **~500 lines** by extracting custom hooks and feature tab components.

**Expected Reduction**: ~3,800 lines (87% reduction from current state)

---

## 📊 Current State (After Phase 1)

**File**: `/app/frontend/src/components/Community.js`  
**Size**: 4,373 lines  
**Status**: ✅ 17 sub-components already extracted (modals, cards, views)

**What Remains**:
1. ~100 state variables
2. ~70+ handler functions
3. Tab navigation and rendering
4. API integration logic
5. Business logic for posts, groups, events, challenges

---

## 🔧 Phase 2A: Extract Custom Hooks

**Goal**: Extract reusable business logic into custom hooks  
**Estimated Lines**: ~1,500 lines  
**Risk Level**: Medium

### Hooks Directory Structure
```
/app/frontend/src/hooks/community/
├── index.js                    (barrel export)
├── usePostActions.js           (~200 lines)
├── useComments.js              (~150 lines)
├── useMediaUpload.js           (~200 lines)
├── useMentions.js              (~150 lines)
├── useNotifications.js         (~100 lines)
├── useGroupActions.js          (~200 lines)
├── useEventActions.js          (~200 lines)
├── useChallengeActions.js      (~200 lines)
└── useAthleteProfile.js        (~100 lines)
```

---

### Hook 1: `useMediaUpload.js` (~200 lines)

**Purpose**: Handle image/video upload, compression, drag-and-drop

**Functions to Extract** (from Community.js):
- `handleImageSelect` (line 665)
- `handleMediaSelect` (line 681)
- `handleRemoveMedia` (line 766)
- `handleDragStart` (line 773)
- `handleDragOver` (line 778)
- `handleDrop` (line 783)
- `handleDragEnd` (line 795)
- `handleEditMediaSelect` (line 800)
- `handleRemoveEditMedia` (line 875)
- `handleEditMediaDragEnd` (line 879)

**State to Extract**:
- Media upload arrays
- Preview URLs
- Drag state

**API Usage**:
```javascript
const {
  media,
  mediaPreview,
  handleImageSelect,
  handleMediaSelect,
  handleRemoveMedia,
  dragHandlers,
  clearMedia
} = useMediaUpload();
```

---

### Hook 2: `useMentions.js` (~150 lines)

**Purpose**: Handle @mentions in posts and comments

**Functions to Extract**:
- `handleSelectMention` (line 931)
- `handleSelectCommentMention` (line 977)
- Mention search/filtering logic
- Mention formatting

**State to Extract**:
- Mention search results
- Selected mentions
- Mention position/cursor

**API Usage**:
```javascript
const {
  searchMentions,
  selectMention,
  mentionResults,
  formatMentions
} = useMentions();
```

---

### Hook 3: `usePostActions.js` (~200 lines)

**Purpose**: Post CRUD operations (create, edit, delete, like, share)

**Functions to Extract**:
- `handleSubmitPost`
- `handleEditPost`
- `handleDeletePost`
- `handleToggleLike`
- `handleSharePost` / `submitSharePost`

**State to Extract**:
- Post submission state
- Like/share counts
- Loading states

**API Calls**:
- `POST /api/community/posts`
- `PUT /api/community/posts/{id}`
- `DELETE /api/community/posts/{id}`
- `POST /api/community/posts/{id}/like`
- `POST /api/community/posts/{id}/share`

**API Usage**:
```javascript
const {
  createPost,
  updatePost,
  deletePost,
  toggleLike,
  sharePost,
  isLoading
} = usePostActions(athleteId);
```

---

### Hook 4: `useComments.js` (~150 lines)

**Purpose**: Comment CRUD operations

**Functions to Extract**:
- `handleAddComment`
- `handleDeleteComment`
- `toggleComments`
- `loadComments`

**State to Extract**:
- Comment content
- Comment lists
- Loading states

**API Calls**:
- `GET /api/community/posts/{id}/comments`
- `POST /api/community/posts/{id}/comments`
- `DELETE /api/community/comments/{id}`

**API Usage**:
```javascript
const {
  comments,
  addComment,
  deleteComment,
  loadComments,
  isLoading
} = useComments(postId);
```

---

### Hook 5: `useGroupActions.js` (~200 lines)

**Purpose**: Group CRUD operations and membership

**Functions to Extract**:
- `loadAllGroups` (line 535)
- `loadMyGroups` (line 548)
- `handleCreateGroup`
- `handleEditGroup`
- `handleJoinGroup`
- `handleLeaveGroup`
- `handleDeleteGroup`

**State to Extract**:
- Groups list
- My groups list
- Group form data
- Loading states

**API Calls**:
- `GET /api/community/groups`
- `GET /api/community/mygroups`
- `POST /api/community/groups`
- `PUT /api/community/groups/{id}`
- `DELETE /api/community/groups/{id}`
- `POST /api/community/groups/{id}/join`
- `POST /api/community/groups/{id}/leave`

**API Usage**:
```javascript
const {
  groups,
  myGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  isLoading
} = useGroupActions(athleteId);
```

---

### Hook 6: `useEventActions.js` (~200 lines)

**Purpose**: Event CRUD operations and RSVP

**Functions to Extract**:
- `loadEvents`
- `handleCreateEvent`
- `handleEditEvent`
- `handleDeleteEvent`
- `handleRSVP`

**State to Extract**:
- Events list
- Event form data
- RSVP states
- Loading states

**API Calls**:
- `GET /api/community/events`
- `POST /api/community/events`
- `PUT /api/community/events/{id}`
- `DELETE /api/community/events/{id}`
- `POST /api/community/events/{id}/rsvp`

**API Usage**:
```javascript
const {
  events,
  createEvent,
  updateEvent,
  deleteEvent,
  handleRSVP,
  isLoading
} = useEventActions(athleteId);
```

---

### Hook 7: `useChallengeActions.js` (~200 lines)

**Purpose**: Challenge CRUD operations and participation

**Functions to Extract**:
- `loadChallenges`
- `handleCreateChallenge`
- `handleEditChallenge`
- `handleDeleteChallenge`
- `handleJoinChallenge`
- `handleLeaveChallenge`

**State to Extract**:
- Challenges list
- Challenge form data
- Participation states
- Loading states

**API Calls**:
- `GET /api/community/challenges`
- `POST /api/community/challenges`
- `PUT /api/community/challenges/{id}`
- `DELETE /api/community/challenges/{id}`
- `POST /api/community/challenges/{id}/join`
- `POST /api/community/challenges/{id}/leave`

**API Usage**:
```javascript
const {
  challenges,
  createChallenge,
  updateChallenge,
  deleteChallenge,
  joinChallenge,
  leaveChallenge,
  isLoading
} = useChallengeActions(athleteId);
```

---

### Hook 8: `useNotifications.js` (~100 lines)

**Purpose**: Notification management

**Functions to Extract**:
- `loadNotifications` (line 561)
- `markNotificationRead`
- `handleNotificationClick`

**State to Extract**:
- Notifications list
- Unread count
- Loading states

**API Calls**:
- `GET /api/community/notifications`
- `PUT /api/community/notifications/{id}/read`

**API Usage**:
```javascript
const {
  notifications,
  unreadCount,
  markAsRead,
  loadNotifications,
  isLoading
} = useNotifications(athleteId);
```

---

### Hook 9: `useAthleteProfile.js` (~100 lines)

**Purpose**: Athlete profile loading and follow/unfollow

**Functions to Extract**:
- `loadAthleteProfile` (line 599)
- `handleFollowToggle` (line 613)
- `loadAthletes` (line 627)
- `handleAthletesFollowToggle` (line 639)

**State to Extract**:
- Profile data
- Follow status
- Athletes list
- Loading states

**API Calls**:
- `GET /api/community/profile/{id}`
- `POST /api/community/follow/{id}`
- `POST /api/community/unfollow/{id}`
- `GET /api/athletes`

**API Usage**:
```javascript
const {
  profile,
  athletes,
  loadProfile,
  toggleFollow,
  searchAthletes,
  isLoading
} = useAthleteProfile(athleteId);
```

---

## 🎴 Phase 2B: Extract Feature Tab Components

**Goal**: Split main component into feature-based tab components  
**Estimated Lines**: ~1,500 lines  
**Risk Level**: High (affects main component structure)

### Tab Components Directory Structure
```
/app/frontend/src/components/community/tabs/
├── index.js                    (barrel export)
├── CommunityFeed.js            (~300 lines)
├── CommunityFollowing.js       (~250 lines)
├── CommunityGroups.js          (~250 lines)
├── CommunityMyGroups.js        (~250 lines)
├── CommunityEvents.js          (~250 lines)
└── CommunityChallenges.js      (~250 lines)
```

---

### Tab 1: `CommunityFeed.js` (~300 lines)

**Purpose**: Main community feed with all public posts

**Responsibilities**:
- Load and display community feed posts
- Handle post interactions (like, comment, share)
- Show write post modal
- Handle nationality filter
- Infinite scroll/pagination

**Props Received**:
```javascript
{
  athleteId,
  athlete,
  onOpenProfile,
  onRefresh
}
```

**Hooks Used**:
- `usePostActions()`
- `useComments()`
- `useMediaUpload()`
- `useMentions()`

**Components Rendered**:
- `PostsList`
- Write post FAB
- Nationality filter dropdown

---

### Tab 2: `CommunityFollowing.js` (~250 lines)

**Purpose**: Feed of posts from followed athletes

**Responsibilities**:
- Load and display following feed posts
- Handle post interactions
- Show write post modal

**Props Received**:
```javascript
{
  athleteId,
  athlete,
  onOpenProfile,
  onRefresh
}
```

**Hooks Used**:
- `usePostActions()`
- `useComments()`
- `useMentions()`

**Components Rendered**:
- `PostsList`
- Empty state if not following anyone

---

### Tab 3: `CommunityGroups.js` (~250 lines)

**Purpose**: Browse and join public/private groups

**Responsibilities**:
- Load and display all available groups
- Handle group joining
- Show group rules modal
- Search/filter groups

**Props Received**:
```javascript
{
  athleteId,
  athlete
}
```

**Hooks Used**:
- `useGroupActions()`

**Components Rendered**:
- `GroupCard` (from phase 1)
- Create group button
- Group rules modal

---

### Tab 4: `CommunityMyGroups.js` (~250 lines)

**Purpose**: Display groups user is a member of

**Responsibilities**:
- Load and display user's groups
- Handle group leaving
- Navigate to group detail view

**Props Received**:
```javascript
{
  athleteId,
  athlete,
  onSelectGroup
}
```

**Hooks Used**:
- `useGroupActions()`

**Components Rendered**:
- `GroupCard` (from phase 1)
- Empty state if no groups joined

---

### Tab 5: `CommunityEvents.js` (~250 lines)

**Purpose**: Browse and RSVP to community events

**Responsibilities**:
- Load and display upcoming/past events
- Handle event RSVP (going/interested)
- Show event creation modal
- Filter events (upcoming/past/my events)

**Props Received**:
```javascript
{
  athleteId,
  athlete
}
```

**Hooks Used**:
- `useEventActions()`

**Components Rendered**:
- `EventCard` (from phase 1)
- Create event button
- Event filters

---

### Tab 6: `CommunityChallenges.js` (~250 lines)

**Purpose**: Browse and join fitness challenges

**Responsibilities**:
- Load and display active/past challenges
- Handle challenge joining
- Show challenge creation modal
- Filter challenges (active/completed/my challenges)

**Props Received**:
```javascript
{
  athleteId,
  athlete
}
```

**Hooks Used**:
- `useChallengeActions()`

**Components Rendered**:
- `ChallengeCard` (from phase 1)
- Create challenge button
- Challenge filters

---

## 🏗️ Final Main Component Structure (~500 lines)

After Phase 2, `Community.js` will become a lightweight orchestrator:

```javascript
// /app/frontend/src/components/Community.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Tab components
import {
  CommunityFeed,
  CommunityFollowing,
  CommunityGroups,
  CommunityMyGroups,
  CommunityEvents,
  CommunityChallenges
} from './community/tabs';

// Modal components (already extracted in Phase 1)
import {
  CommentsModal,
  AthleteProfileModal,
  EventDetailModal,
  ChallengeDetailModal,
  GroupRulesModal,
  AthletesModal,
  CreateGroupModal,
  EditGroupModal,
  CreateEventModal,
  EditEventModal,
  CreateChallengeModal,
  EditChallengeModal
} from './community/modals';

// View components (already extracted in Phase 1)
import { GroupDetailView } from './community/views';

// Hooks
import { useNotifications, useAthleteProfile } from '../hooks/community';

const Community = ({ athleteId, athlete }) => {
  const navigate = useNavigate();
  const { view } = useParams();
  
  // Tab state
  const [activeTab, setActiveTab] = useState(view || 'feed');
  
  // Modal orchestration state
  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState(null);
  
  const [showGroupDetail, setShowGroupDetail] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  
  // Hooks
  const { notifications, unreadCount, loadNotifications } = useNotifications(athleteId);
  const { loadProfile } = useAthleteProfile(athleteId);
  
  // Tab navigation
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    navigate(`/dashboard/community/${tab}`);
  };
  
  // Modal handlers
  const handleOpenProfile = async (targetAthleteId) => {
    const profile = await loadProfile(targetAthleteId);
    setProfileData(profile);
    setShowProfile(true);
  };
  
  const handleSelectGroup = (group) => {
    setSelectedGroup(group);
    setShowGroupDetail(true);
  };
  
  // Global refresh
  const handleRefresh = () => {
    loadNotifications();
    // Trigger refresh on active tab
  };
  
  // Tab content rendering
  const renderTabContent = () => {
    switch (activeTab) {
      case 'feed':
        return (
          <CommunityFeed
            athleteId={athleteId}
            athlete={athlete}
            onOpenProfile={handleOpenProfile}
            onRefresh={handleRefresh}
          />
        );
      
      case 'following':
        return (
          <CommunityFollowing
            athleteId={athleteId}
            athlete={athlete}
            onOpenProfile={handleOpenProfile}
            onRefresh={handleRefresh}
          />
        );
      
      case 'groups':
        return (
          <CommunityGroups
            athleteId={athleteId}
            athlete={athlete}
          />
        );
      
      case 'mygroups':
        return (
          <CommunityMyGroups
            athleteId={athleteId}
            athlete={athlete}
            onSelectGroup={handleSelectGroup}
          />
        );
      
      case 'events':
        return (
          <CommunityEvents
            athleteId={athleteId}
            athlete={athlete}
          />
        );
      
      case 'challenges':
        return (
          <CommunityChallenges
            athleteId={athleteId}
            athlete={athlete}
          />
        );
      
      default:
        return null;
    }
  };
  
  return (
    <div className="community-container">
      {/* Tab Navigation */}
      <div className="community-tabs">
        {/* Tab buttons */}
      </div>
      
      {/* Tab Content */}
      <div className="community-content">
        {renderTabContent()}
      </div>
      
      {/* Global Modals */}
      {showProfile && (
        <AthleteProfileModal
          profileData={profileData}
          onClose={() => setShowProfile(false)}
        />
      )}
      
      {showGroupDetail && (
        <GroupDetailView
          group={selectedGroup}
          onClose={() => setShowGroupDetail(false)}
        />
      )}
      
      {/* Other modals as needed */}
    </div>
  );
};

export default Community;
```

**Final Line Count**: ~500-600 lines

---

## 📋 Implementation Order

### Step 1: Extract Standalone Hooks (Low Risk)
**Order**: Media → Mentions → Notifications → Athlete Profile  
**Estimated Time**: 4-6 hours  
**Why First**: These have minimal dependencies

### Step 2: Extract Action Hooks (Medium Risk)
**Order**: Posts → Comments → Groups → Events → Challenges  
**Estimated Time**: 8-12 hours  
**Why Second**: These depend on media/mentions hooks

### Step 3: Extract Tab Components (High Risk)
**Order**: Challenges → Events → Groups → MyGroups → Following → Feed  
**Estimated Time**: 10-14 hours  
**Why Last**: Most complex, affects main structure

### Step 4: Refactor Main Component (High Risk)
**Estimated Time**: 4-6 hours  
**Why Last**: Final orchestration layer

---

## 🧪 Testing Strategy

### After Each Hook Extraction:
1. ✅ Verify hook exports correctly
2. ✅ Test hook in isolation (if possible)
3. ✅ Update component to use hook
4. ✅ Test component functionality
5. ✅ Check for console errors

### After Each Tab Extraction:
1. ✅ Verify tab component renders
2. ✅ Test all interactions in tab
3. ✅ Verify props passed correctly
4. ✅ Check navigation between tabs
5. ✅ Visual regression testing

### Final Integration Testing:
1. ✅ Test all tabs
2. ✅ Test modal interactions
3. ✅ Test cross-tab state (if any)
4. ✅ Performance testing (load times)
5. ✅ Mobile responsive testing

---

## 📊 Success Metrics

### File Size Targets:
- ✅ Main Community.js: 4,368 lines → ~500 lines (89% reduction)
- ✅ Largest hook: <250 lines
- ✅ Largest tab component: <350 lines
- ✅ Average component size: <200 lines

### Code Quality:
- ✅ All hooks have single responsibility
- ✅ All components are independently testable
- ✅ No circular dependencies
- ✅ Proper prop types/TypeScript (if applicable)

### Functionality:
- ✅ 100% feature parity maintained
- ✅ No visual regressions
- ✅ No performance regressions
- ✅ All tests passing

---

## ⚠️ Risks & Mitigation

### Risk 1: State Management Complexity
**Issue**: Passing state between hooks and components can get messy  
**Mitigation**: 
- Keep hooks independent
- Use callback props for cross-hook communication
- Consider Context only if absolutely needed

### Risk 2: Breaking Existing Functionality
**Issue**: Moving code can break dependencies  
**Mitigation**:
- Test thoroughly after each extraction
- Keep git commits small and atomic
- Have rollback plan ready

### Risk 3: Over-Abstraction
**Issue**: Too many hooks can make code harder to follow  
**Mitigation**:
- Only extract truly reusable logic
- Keep hook interfaces simple
- Document hook usage clearly

---

## 🎯 Timeline Estimate

| Phase | Task | Hours | Total |
|-------|------|-------|-------|
| 2A.1 | Extract Standalone Hooks | 4-6 | 4-6h |
| 2A.2 | Extract Action Hooks | 8-12 | 12-18h |
| 2A.3 | Test & Fix Hooks | 2-4 | 14-22h |
| 2B.1 | Extract Tab Components | 10-14 | 24-36h |
| 2B.2 | Refactor Main Component | 4-6 | 28-42h |
| 2B.3 | Integration Testing | 4-6 | 32-48h |

**Total Estimated Time**: 32-48 hours (4-6 full workdays)

---

## ✅ Success Criteria

Phase 2 will be considered complete when:

1. ✅ Main Community.js is < 600 lines
2. ✅ All 9 custom hooks created and tested
3. ✅ All 6 tab components created and tested
4. ✅ No functionality lost
5. ✅ No console errors
6. ✅ Frontend compiles successfully
7. ✅ Visual testing passes
8. ✅ Performance is same or better

---

**Plan Created**: 2025-11-14  
**Target Completion**: 4-6 workdays  
**Owner**: AI Development Agent
