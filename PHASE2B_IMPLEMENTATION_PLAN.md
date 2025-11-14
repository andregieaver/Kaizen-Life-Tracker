# Phase 2B Implementation Plan - Tab Components Extraction

## Strategy

Given the complexity and size of the tab rendering code, we'll take a **phased approach**:

### Phase 2B.1: Create Tab Component Structure (Quick Win)
**Time**: 2-3 hours  
**Goal**: Create 6 tab component files with basic structure and props

1. Create empty tab component files
2. Define prop interfaces for each
3. Set up basic rendering structure
4. Import hooks they'll need

### Phase 2B.2: Move Tab Logic Gradually (Incremental)
**Time**: 6-8 hours  
**Goal**: Move tab-specific logic one tab at a time

**Order** (easiest to hardest):
1. **CommunityEvents** - Simplest, mostly uses EventCard
2. **CommunityChallenges** - Similar to Events, uses ChallengeCard  
3. **CommunityGroups** - Uses GroupCard, straightforward
4. **CommunityMyGroups** - Similar to Groups
5. **CommunityFollowing** - Similar to Feed but simpler
6. **CommunityFeed** - Most complex, has nationality filter and mixed content

### Phase 2B.3: Refactor Main Community.js
**Time**: 2-3 hours  
**Goal**: Reduce to orchestrator (~500 lines)

1. Remove tab-specific rendering
2. Keep only tab navigation
3. Render appropriate tab component based on activeTab
4. Pass necessary props to each tab

---

## Detailed Plan for Each Tab

### 1. CommunityEvents.js

**Props Needed**:
```javascript
{
  athleteId,
  athlete,
  isSuperAdmin,
  onOpenEventDetail,
  onOpenEditEvent
}
```

**Hooks to Use**:
- `useEventActions(athleteId)`
- State for modals (create/edit event)

**Functionality**:
- Load and display events
- Filter events (upcoming/past/my events)
- Create event button
- Event RSVP
- Edit/delete events (owner only)

**Approximate Lines**: ~250

---

### 2. CommunityChallenges.js

**Props Needed**:
```javascript
{
  athleteId,
  athlete,
  isSuperAdmin,
  onOpenChallengeDetail
}
```

**Hooks to Use**:
- `useChallengeActions(athleteId)`
- State for modals (create/edit challenge)

**Functionality**:
- Load and display challenges
- Filter challenges (all/active/completed/my)
- Create challenge button
- Join/leave challenges
- Edit/delete challenges (owner only)

**Approximate Lines**: ~250

---

### 3. CommunityGroups.js

**Props Needed**:
```javascript
{
  athleteId,
  athlete,
  onJoinGroup,
  onOpenCreateGroup
}
```

**Hooks to Use**:
- `useGroupActions(athleteId)`
- State for group rules modal

**Functionality**:
- Load and display all groups
- Join group (with rules modal if needed)
- Create group button
- Search/filter groups

**Approximate Lines**: ~250

---

### 4. CommunityMyGroups.js

**Props Needed**:
```javascript
{
  athleteId,
  athlete,
  onSelectGroup,
  onLeaveGroup,
  onOpenEditGroup
}
```

**Hooks to Use**:
- `useGroupActions(athleteId)`

**Functionality**:
- Load and display user's groups
- Leave group
- Edit group (if admin)
- Navigate to group detail view

**Approximate Lines**: ~250

---

### 5. CommunityFollowing.js

**Props Needed**:
```javascript
{
  athleteId,
  athlete,
  onOpenProfile,
  onOpenComments,
  onOpenShareModal
}
```

**Hooks to Use**:
- `usePostActions(athleteId)`
- `useComments(athleteId)`
- `useMentions()`
- `useMediaUpload()`

**Functionality**:
- Load following feed
- Display posts from followed athletes
- Like/comment/share posts
- Empty state if not following anyone

**Approximate Lines**: ~300

---

### 6. CommunityFeed.js (Most Complex)

**Props Needed**:
```javascript
{
  athleteId,
  athlete,
  onOpenProfile,
  onOpenComments,
  onOpenShareModal,
  onOpenEventDetail
}
```

**Hooks to Use**:
- `usePostActions(athleteId)`
- `useComments(athleteId)`
- `useMentions()`
- `useMediaUpload()`
- `useEventActions(athleteId)`

**Functionality**:
- Load community feed (posts + events)
- Nationality filter
- Display mixed content (posts and events)
- Like/comment/share posts
- Event RSVP
- Create post FAB

**Approximate Lines**: ~350

---

## Implementation Steps

### Step 1: Create Directory and Files
```bash
mkdir -p /app/frontend/src/components/community/tabs
```

Create 7 files:
1. `index.js` (barrel export)
2. `CommunityEvents.js`
3. `CommunityChallenges.js`
4. `CommunityGroups.js`
5. `CommunityMyGroups.js`
6. `CommunityFollowing.js`
7. `CommunityFeed.js`

### Step 2: Start with Simplest Tab (Events)
- Extract event tab JSX from Community.js
- Move to CommunityEvents.js
- Test compilation
- Verify rendering

### Step 3: Repeat for Other Tabs
- Follow the order: Challenges → Groups → MyGroups → Following → Feed
- Test after each extraction

### Step 4: Refactor Main Component
- Import all tab components
- Create renderTabContent() function
- Remove old tab rendering code
- Keep only navigation and modal orchestration

---

## Expected File Sizes After Phase 2B

| File | Current | After 2B | Reduction |
|------|---------|----------|-----------|
| Community.js | 4,236 lines | ~500 lines | -3,736 lines (88%) |
| Tab Components | 0 | ~1,550 lines | (extracted) |

---

## Success Criteria

1. ✅ All 6 tab components created and working
2. ✅ Community.js reduced to < 600 lines
3. ✅ No functionality lost
4. ✅ Frontend compiles successfully
5. ✅ All tests pass (manual verification)

---

## Risk Mitigation

1. **Test after each tab extraction** - Don't do all at once
2. **Keep git commits atomic** - One tab per commit
3. **Preserve all functionality** - Don't simplify or change behavior
4. **Maintain prop drilling** - Can optimize later with Context if needed

---

**Ready to Start**: Phase 2B.1 - Create tab component structure
