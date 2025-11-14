# SystemSettings.js Refactoring Plan

**File**: `/app/frontend/src/components/SystemSettings.js`  
**Current Size**: 5,493 lines  
**Target Size**: ~500 lines (orchestrator)  
**Expected Reduction**: ~91% (5,000 lines)

---

## 📋 Current Structure Analysis

### Tabs Identified (7 total):
1. **Modules** - Enable/disable system modules (Affiliate Program)
2. **Plans** - Subscription plan configuration
3. **Coupons** - Coupon management (create, edit, disable)
4. **Waiting List** - Manage waiting list entries
5. **Statistics** - Subscription analytics and charts
6. **Cookies** - Cookie consent management
7. **Advanced** - Advanced settings (Stripe, SEO, etc.)

### State Variables (~30+):
- Tab state
- Module settings
- Plan settings
- Coupon data
- Waiting list data
- Statistics data
- Cookie settings
- Advanced settings (Stripe, SEO)
- Loading states for each section
- UI states (modals, filters, etc.)

### Handler Functions (~40+):
- Tab navigation
- SEO settings handlers
- Module toggle handlers
- Plan CRUD handlers
- Coupon CRUD handlers
- Statistics handlers
- Cookie settings handlers
- Advanced settings handlers

---

## 🎯 Refactoring Strategy

### Phase 1: Create Custom Hooks (Similar to Community.js)

**Estimated**: 8-10 hours  
**Goal**: Extract business logic into reusable hooks

#### Hooks to Create:

1. **useModuleSettings.js** (~150 lines)
   - Load/save module settings
   - Toggle module enabled/disabled
   - State: moduleSettings, isLoading

2. **usePlanSettings.js** (~200 lines)
   - Plan CRUD operations
   - Feature management (add, remove, reorder)
   - Drag-and-drop feature reordering
   - State: planSettings, subscriptionPlans, isLoading

3. **useCouponManagement.js** (~150 lines)
   - Coupon CRUD operations
   - Load coupons
   - Enable/disable coupons
   - Filter coupons
   - State: coupons, isLoading, filters

4. **useWaitingList.js** (~100 lines)
   - Load waiting list entries
   - Filter entries
   - Export functionality
   - State: waitingListEntries, isLoading, filters

5. **useSubscriptionStats.js** (~180 lines)
   - Load subscription statistics
   - Period selection
   - Compare periods
   - Chart data preparation
   - State: subscriberStats, selectedPeriod, compareEnabled, isLoading

6. **useCookieSettings.js** (~150 lines)
   - Load/save cookie settings
   - Scan cookies
   - Manage cookie categories
   - State: cookieSettings, isLoading, scanningCookies

7. **useAdvancedSettings.js** (~200 lines)
   - Advanced settings CRUD
   - Stripe configuration
   - SEO settings
   - Favicon upload
   - State: advancedSettings, seoSettings, isLoading

**Total Hook Lines**: ~1,130 lines

---

### Phase 2: Extract Tab Components

**Estimated**: 10-12 hours  
**Goal**: Create tab component for each settings section

#### Tab Components to Create:

1. **ModulesTab.js** (~200 lines)
   - Module toggles
   - Module descriptions
   - Uses: useModuleSettings()

2. **PlansTab.js** (~300 lines)
   - Plan list
   - Plan editing interface
   - Feature management UI
   - Drag-and-drop features
   - Create/edit modals
   - Uses: usePlanSettings()

3. **CouponsTab.js** (~250 lines)
   - Coupon list table
   - Create coupon form
   - Filter controls
   - Uses: useCouponManagement()

4. **WaitingListTab.js** (~150 lines)
   - Waiting list table
   - Filter controls
   - Export functionality
   - Uses: useWaitingList()

5. **StatisticsTab.js** (~300 lines)
   - Statistics charts (Chart.js)
   - Period selector
   - Compare toggle
   - Metrics cards
   - Uses: useSubscriptionStats()

6. **CookiesTab.js** (~200 lines)
   - Cookie category management
   - Scan cookies button
   - Cookie list
   - Uses: useCookieSettings()

7. **AdvancedTab.js** (~400 lines)
   - Stripe settings
   - SEO settings
   - Favicon upload
   - Multiple subsections
   - Uses: useAdvancedSettings()

**Total Tab Lines**: ~1,800 lines

---

### Phase 3: Refactor Main Component

**Estimated**: 2-3 hours  
**Goal**: Reduce SystemSettings.js to orchestrator

**Final Structure**:
```javascript
const SystemSettings = ({ athleteId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  // Tab state
  const [activeTab, setActiveTab] = useState('modules');
  
  // Hooks (minimal state, mostly passed to tab components)
  const moduleSettings = useModuleSettings(athleteId);
  const planSettings = usePlanSettings(athleteId);
  const couponManagement = useCouponManagement(athleteId);
  const waitingList = useWaitingList(athleteId);
  const subscriptionStats = useSubscriptionStats(athleteId);
  const cookieSettings = useCookieSettings(athleteId);
  const advancedSettings = useAdvancedSettings(athleteId);
  
  // Tab change handler
  const handleTabChange = (value) => {
    setActiveTab(value);
    localStorage.setItem('systemSettings_activeTab', value);
    window.location.hash = value;
  };
  
  return (
    <div>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="waitinglist">Waiting List</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          <TabsTrigger value="cookies">Cookies</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        
        <TabsContent value="modules">
          <ModulesTab {...moduleSettings} />
        </TabsContent>
        
        <TabsContent value="plans">
          <PlansTab {...planSettings} />
        </TabsContent>
        
        <TabsContent value="coupons">
          <CouponsTab {...couponManagement} />
        </TabsContent>
        
        <TabsContent value="waitinglist">
          <WaitingListTab {...waitingList} />
        </TabsContent>
        
        <TabsContent value="statistics">
          <StatisticsTab {...subscriptionStats} />
        </TabsContent>
        
        <TabsContent value="cookies">
          <CookiesTab {...cookieSettings} />
        </TabsContent>
        
        <TabsContent value="advanced">
          <AdvancedTab {...advancedSettings} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
```

**Final Size**: ~500 lines

---

## 📊 Expected Results

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| SystemSettings.js | 5,493 lines | ~500 lines | -4,993 (-91%) |
| Hooks Created | 0 | 7 | +1,130 lines |
| Tab Components | 0 | 7 | +1,800 lines |
| Total Extracted | 0 | 14 files | +2,930 lines |

**Net Result**: Code is more organized, maintainable, and testable

---

## 🚀 Implementation Order

### Phase 1: Hooks (Priority Order)

**Batch 1** (Simple, No Dependencies):
1. useModuleSettings
2. useWaitingList
3. useCookieSettings

**Batch 2** (Medium Complexity):
4. useCouponManagement
5. useSubscriptionStats

**Batch 3** (Complex):
6. usePlanSettings (drag-and-drop, nested state)
7. useAdvancedSettings (multiple subsections)

### Phase 2: Tab Components (Same Order)

**Batch 1** (Simple):
1. ModulesTab
2. WaitingListTab
3. CookiesTab

**Batch 2** (Medium):
4. CouponsTab
5. StatisticsTab

**Batch 3** (Complex):
6. PlansTab
7. AdvancedTab

### Phase 3: Main Component Refactoring

---

## ⏱️ Time Estimates

| Phase | Task | Hours |
|-------|------|-------|
| **Phase 1** | Extract 7 Hooks | 8-10 |
| **Phase 2** | Extract 7 Tabs | 10-12 |
| **Phase 3** | Refactor Main | 2-3 |
| **Testing** | Manual Testing | 2-3 |
| **Total** | | **22-28 hours** |

---

## 🎯 Success Criteria

1. ✅ All 7 hooks created and tested
2. ✅ All 7 tab components created and tested
3. ✅ SystemSettings.js < 600 lines
4. ✅ No functionality lost
5. ✅ Frontend compiles successfully
6. ✅ All tabs working correctly

---

## 🔄 Comparison with Community.js

| Aspect | Community.js | SystemSettings.js |
|--------|--------------|-------------------|
| Starting Size | 7,893 lines | 5,493 lines |
| Tabs/Sections | 6 tabs | 7 tabs |
| Hooks Needed | 9 hooks | 7 hooks |
| Complexity | High (posts, events, groups) | Medium (forms, settings) |
| Expected Reduction | 47% (Phase 1+2A) | 91% (Full) |
| Estimated Time | 32-48 hours | 22-28 hours |

**SystemSettings should be easier** because:
- Less interdependent state
- Simpler UI (mostly forms and tables)
- No real-time interactions
- Clear tab boundaries

---

## 📋 Prerequisites

Before starting:
1. ✅ Community.js refactoring patterns established
2. ✅ Hook extraction process validated
3. ✅ Tab component patterns proven
4. ✅ Testing methodology in place

---

## 🎓 Lessons from Community.js to Apply

1. **Start with simple components** - Build confidence
2. **Test after each extraction** - Catch issues early
3. **Keep commits atomic** - Easy rollback
4. **Document as you go** - Track progress
5. **Use barrel exports** - Clean imports

---

**Ready to Start**: Phase 1, Batch 1 - Extract simple hooks
**Estimated Completion**: 22-28 hours of focused work
**Expected Outcome**: 91% reduction in file size with improved code quality
