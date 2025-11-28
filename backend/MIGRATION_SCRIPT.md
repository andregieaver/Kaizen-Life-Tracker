# Migration Script - Switching to Refactored Structure

## ⚠️ IMPORTANT: Read Before Proceeding

This guide will help you migrate from the monolithic `server.py` to the refactored router structure.

**Current Status**: Only the **Auth** domain has been fully extracted as a working example.

**Options**:
1. **Continue Incrementally**: Extract more domains before switching
2. **Switch Now**: Use the example as a template and continue extracting afterward

## 🎯 Option 1: Continue Extracting (Recommended)

Extract all or most domains before switching to minimize disruption.

### Progress Checklist
- [x] Auth (7/7 routes) - ✅ COMPLETE
- [ ] Athletes (~5 routes)
- [ ] Agents (~10 routes)
- [ ] System (~10 routes)
- [ ] Subscriptions (~15 routes)
- [ ] Waitlist (~5 routes)
- [ ] Voice (~6 routes)
- [ ] Coach (~8 routes)
- [ ] Community (~50+ routes)
- [ ] Workouts (~10 routes)
- [ ] Nutrition (~20 routes)
- [ ] Journal (~10 routes)
- [ ] Integrations (~30 routes)
- [ ] Schedules (~8 routes)
- [ ] Training (~8 routes)
- [ ] Recipes (~5 routes)
- [ ] Documents (~5 routes)
- [ ] Analytics (~5 routes)
- [ ] Webhooks (~5 routes)
- [ ] CRM (~10 routes)
- [ ] Coupons (~5 routes)
- [ ] Pages (~10 routes)
- [ ] Messaging (~10 routes)

### Extraction Workflow

For each domain:

```bash
# 1. Find routes
grep -n "^@api_router.*\/DOMAIN\/" /app/backend/server.py

# 2. Create/update router file
# - Copy route functions
# - Update imports
# - Test individually

# 3. Update router includes in server.py
# Add to api_router.include_router(...) section

# 4. Test
sudo supervisorctl restart backend
# Run manual tests

# 5. Remove from old server.py once verified
```

## 🎯 Option 2: Switch to Refactored Structure Now

Switch to the refactored structure with only Auth extracted. Continue extracting from there.

### Prerequisites
- ✅ `database.py` created
- ✅ `utils.py` created
- ✅ `routes/auth_complete.py` created and tested
- ✅ `server_refactored_example.py` created

### Migration Steps

#### Step 1: Backup Current server.py
```bash
cp /app/backend/server.py /app/backend/server.py.backup
```

#### Step 2: Create Hybrid Server (Gradual Migration)

Option A: Include auth router in current server.py
```python
# Add to server.py (after imports)
from routes.auth_complete import router as auth_router

# Add after api_router creation
api_router.include_router(auth_router)

# Then remove the old auth route definitions
```

Option B: Switch completely to new structure
```bash
# Rename files
mv /app/backend/server.py /app/backend/server_old.py
mv /app/backend/server_refactored_example.py /app/backend/server.py

# Update server.py to include ALL routes still in server_old.py
# This creates a hybrid: new structure + old routes inline
```

#### Step 3: Test Auth Routes
```bash
# Restart backend
sudo supervisorctl restart backend

# Test login
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"andre@humanweb.no","password":"Pernilla666!"}'

# Expected: 200 OK with athlete data
```

#### Step 4: Gradually Extract Remaining Domains

Continue extracting domains one by one using the pattern established with Auth.

## 📊 Hybrid Approach (Best of Both Worlds)

Keep both structures running side-by-side:

```python
# In server.py (current monolithic file)

# Add at the top
from routes.auth_complete import router as auth_router_new

# Include the new router
api_router.include_router(auth_router_new)

# Comment out old auth routes
# @api_router.post("/auth/login")  # <- Moved to routes/auth_complete.py
# async def login_athlete(...):
#     ...
```

This allows:
1. Testing new routers alongside old ones
2. Rolling back easily if issues arise
3. Incremental migration without disruption

## 🧪 Testing Strategy

### Automated Tests
```bash
# Test refactored routers
python /app/backend/test_refactored_auth.py

# Add more test files as you extract domains
```

### Manual Testing
1. **Auth Routes**
   - Login: Test with valid/invalid credentials
   - Password Reset: Request → Verify Token → Reset
   - Email Change: Test with valid credentials

2. **For Each New Domain**
   - List/Get operations
   - Create operations
   - Update operations
   - Delete operations

### Integration Testing
Use the frontend to test complete user flows:
1. Registration → Login
2. Password reset flow
3. Profile updates
4. Feature-specific workflows

## 🔄 Rollback Plan

If issues arise:

```bash
# Restore original server.py
cp /app/backend/server.py.backup /app/backend/server.py

# Restart backend
sudo supervisorctl restart backend
```

## 📈 Benefits Timeline

### Immediate (Auth only extracted)
- ✅ Pattern established
- ✅ Foundation laid
- ✅ Database/utils separated

### Short-term (3-5 domains extracted)
- ✅ Reduced server.py size
- ✅ Easier to navigate
- ✅ Clearer organization

### Long-term (All domains extracted)
- ✅ server.py < 500 lines
- ✅ Each domain self-contained
- ✅ Easy to test and maintain
- ✅ Team-friendly structure
- ✅ Reduced corruption risk

## 💡 Tips for Success

1. **One Domain at a Time**: Don't try to extract everything at once
2. **Test Immediately**: Don't accumulate untested changes
3. **Keep Notes**: Document any issues or peculiarities
4. **Use Git**: Commit after each successful domain extraction
5. **Monitor Logs**: Watch backend logs during testing
6. **Ask for Help**: Use troubleshoot_agent if stuck

## 🎓 Learning from Auth Extraction

The Auth extraction demonstrates:
- ✅ How to structure a router file
- ✅ How to import shared dependencies
- ✅ How to maintain endpoint paths
- ✅ How to handle models
- ✅ How to test the extraction

Use `routes/auth_complete.py` as a template for all future extractions.

## 📞 Next Steps

Choose your approach:
1. **Conservative**: Continue extracting domains until 50%+ complete
2. **Balanced**: Extract 3-5 critical domains, then switch
3. **Aggressive**: Switch now, extract as you go

Recommended: **Balanced approach**
- Extract: Athletes, Agents, System (core functionality)
- Switch to refactored structure
- Continue extracting remaining domains

## ✅ Success Criteria

- [ ] Backend starts without errors
- [ ] All tested routes return expected responses
- [ ] Frontend functionality unchanged
- [ ] No increase in error logs
- [ ] All tests pass
