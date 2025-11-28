# Server.py Refactoring Guide

## 🎯 Objective
Refactor the monolithic `server.py` (23,605 lines, 400+ endpoints) into a modular, maintainable structure using FastAPI routers.

## ✅ What's Been Completed

### Phase 1: Foundation (COMPLETE)
1. **Created `database.py`**: Centralized MongoDB connection
2. **Created `utils.py`**: Common utility functions (prepare_for_mongo, parse_from_mongo, calculate_age, apply_query_limit)
3. **Created placeholder router files**: auth.py, agents.py, athletes.py, system.py, community.py, subscriptions.py, waitlist.py, voice.py

### Phase 2: Example Implementation (COMPLETE)
1. **Created `routes/auth_complete.py`**: Full authentication router with 8 endpoints
   - POST /auth/login
   - POST /auth/forgot-password
   - POST /auth/verify-reset-token
   - POST /auth/reset-password
   - POST /auth/google-login
   - POST /auth/change-password
   - POST /auth/change-email
   - TODO: Add OAuth provider routes (Strava, Oura, Garmin, Coros)

2. **Created `server_refactored_example.py`**: Demonstrates the target structure
   - Clean separation of concerns
   - Proper middleware configuration
   - Router inclusion pattern
   - Startup/shutdown handlers

## 🚀 How to Continue Refactoring

### Step-by-Step Process

#### For Each Domain:

1. **Identify Routes**
   ```bash
   # List all routes for a domain (e.g., agents)
   grep -n "^@api_router.*\/agents\/" /app/backend/server.py
   ```

2. **View Route Implementation**
   ```bash
   # View the route code
   # Use the line numbers from step 1
   # View in ranges: [start_line, end_line]
   ```

3. **Extract to Router File**
   - Copy the route function to the appropriate router file
   - Update imports (use `from database import db` instead of global `db`)
   - Update any dependencies
   - Keep the same route path (without /api prefix, handled by main router)

4. **Test the Route**
   - Restart the backend
   - Test the specific endpoint with curl or frontend
   - Verify functionality is unchanged

5. **Delete from server.py**
   - Once verified, remove the route from server.py
   - Add a comment tracking progress

### Domain Extraction Order (Recommended)

#### High Priority (Core Functionality)
1. ✅ **Auth** (DONE - Example complete)
2. **Athletes** (~5 endpoints)
   - Profile CRUD
   - Image uploads (profile, coach avatar, background)
3. **Agents** (~10 endpoints)
   - Agents CRUD
   - Knowledge base
   - Chat endpoints
4. **System** (~10 endpoints)
   - Settings
   - Email service
   - SEO uploads

#### Medium Priority (Business Logic)
5. **Subscriptions** (~15 endpoints)
   - Stripe integration
   - Webhooks
   - Subscription management
6. **Waitlist** (~5 endpoints)
7. **Community** (~50+ endpoints)
   - Posts, comments, likes
   - Groups, events, challenges
   - Social interactions

#### Lower Priority (Can be done incrementally)
8. **Voice** (~6 endpoints)
9. **Coach** (~8 endpoints)
10. **Workouts** (~10 endpoints)
11. **Nutrition** (~20 endpoints)
12. **Journal** (~10 endpoints)
13. **Integrations** (~30 endpoints)
14. **Schedules** (~8 endpoints)
15. **Training** (~8 endpoints)
16. **Recipes** (~5 endpoints)
17. **Documents** (~5 endpoints)
18. **Analytics** (~5 endpoints)
19. **Webhooks** (~5 endpoints)
20. **CRM** (~10 endpoints)
21. **Coupons** (~5 endpoints)
22. **Pages** (~10 endpoints)
23. **Messaging** (~10 endpoints)

## 📋 Template for New Router File

```python
"""
[DOMAIN] routes - Extracted from server.py
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

# Import shared dependencies
from database import db
from utils import prepare_for_mongo, parse_from_mongo, calculate_age

router = APIRouter(prefix="/[domain]", tags=["[domain]"])

# ============= MODELS =============

class ExampleModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # ... fields

# ============= ROUTES =============

@router.get("/")
async def list_items():
    """List all items"""
    items = await db.collection_name.find({}, {"_id": 0}).to_list(100)
    return items

@router.post("/")
async def create_item(item: ExampleModel):
    """Create new item"""
    item_dict = prepare_for_mongo(item.model_dump())
    await db.collection_name.insert_one(item_dict)
    return item_dict

# ... more routes
```

## 🧪 Testing After Each Extraction

### 1. Backend Restart
```bash
sudo supervisorctl restart backend
```

### 2. Check Logs
```bash
tail -f /var/log/supervisor/backend.*.log
```

### 3. Test Endpoint
```bash
# Example: Test login
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### 4. Frontend Integration
- Test the feature through the UI
- Verify no console errors
- Check Network tab in DevTools

## ⚠️ Important Notes

### DO NOT:
- ❌ Change endpoint paths
- ❌ Modify route logic during extraction
- ❌ Break existing functionality
- ❌ Remove middleware or startup logic prematurely

### DO:
- ✅ Test after each domain extraction
- ✅ Keep endpoint behavior identical
- ✅ Update imports correctly
- ✅ Document any issues found
- ✅ Commit after each successful domain migration

## 📊 Progress Tracking

Create a file `REFACTORING_PROGRESS.md` to track:

```markdown
# Refactoring Progress

## Completed Domains
- [x] Auth (8/8 core routes)

## In Progress
- [ ] Athletes (0/5 routes)

## Not Started
- [ ] Agents (0/10 routes)
- [ ] System (0/10 routes)
... etc
```

## 🎯 Final Goals

### server.py Final Structure (~300-500 lines)
```python
# Imports
# Database connection import
# Middleware setup
# Router includes
# Scheduler setup
# Startup/shutdown handlers
# Root endpoints only
```

### Benefits Achieved
1. ✅ Easier debugging and maintenance
2. ✅ Clear separation of concerns
3. ✅ Reduced risk of code corruption
4. ✅ Better testability
5. ✅ Team collaboration friendly
6. ✅ Faster development iterations

## 🆘 Troubleshooting

### Issue: Import Errors
**Solution**: Ensure `database.py` and `utils.py` are in the correct location and properly imported.

### Issue: Routes Not Found (404)
**Solution**: 
1. Check router is included in `server.py`
2. Verify route prefix is correct
3. Restart backend service

### Issue: Database Not Accessible
**Solution**: Ensure `database.py` is imported and `db` is used correctly

### Issue: Circular Imports
**Solution**: Keep models in separate file or within router file, avoid cross-router imports

## 📝 Example Extraction Session

```bash
# 1. Find agent routes
grep -n "^@api_router.*\/agents\/" /app/backend/server.py

# 2. View first route (e.g., line 10500-10550)
# Use mcp_view_file tool

# 3. Copy to routes/agents.py
# Update imports
# Keep endpoint path

# 4. Update server.py to include router
# from routes.agents import router as agents_router
# api_router.include_router(agents_router)

# 5. Restart and test
sudo supervisorctl restart backend
curl http://localhost:8001/api/agents

# 6. Verify, commit, continue
```

## 🎓 Key Learnings

1. **Incremental is Better**: Refactor one domain at a time
2. **Test Continuously**: Don't accumulate untested changes
3. **Document Issues**: Track any bugs found during extraction
4. **Keep Backups**: Use git commits frequently
5. **Measure Progress**: Track completed vs remaining endpoints

## 📞 Need Help?

If you encounter issues:
1. Check the logs: `tail -f /var/log/supervisor/backend.*.log`
2. Verify database connection: Check `database.py` imports
3. Test in isolation: Use curl to test specific endpoints
4. Review `server_refactored_example.py` for pattern reference
