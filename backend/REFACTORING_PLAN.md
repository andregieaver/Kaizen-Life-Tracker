# Server.py Refactoring Plan

## Current State
- **File Size**: 23,605 lines
- **Route Count**: ~400+ endpoints
- **Structure**: Monolithic single file

## Issues
1. Code corruption risk (historical incidents)
2. Duplicate middleware configurations
3. Difficulty in maintenance and debugging
4. No clear separation of concerns

## Target Architecture

### Router Structure
```
/app/backend/
├── server.py               # Main app with middleware & startup logic only
├── models.py               # All Pydantic models
├── utils.py                # Helper functions (datetime, age calc, etc.)
├── services/              # Business logic services
│   ├── email_service.py    # Already exists
│   ├── image_processor.py  # Already exists
│   ├── video_processor.py  # Already exists
│   ├── *_service.py        # Integration services (already exist)
│   └── push_service.py     # Push notifications
├── routes/
│   ├── __init__.py
│   ├── auth.py            # All authentication endpoints
│   ├── athletes.py        # Athlete profile management
│   ├── agents.py          # AI agents CRUD + chat
│   ├── system.py          # System settings, email config
│   ├── community.py       # Posts, comments, likes, groups, events
│   ├── subscriptions.py   # Stripe integration, subscriptions
│   ├── waitlist.py        # Waitlist management
│   ├── voice.py           # Voice chat endpoints
│   ├── coach.py           # AI Coach endpoints
│   ├── workouts.py        # Workouts, sleep, readiness
│   ├── nutrition.py       # Nutrition entries, supplements, drinks
│   ├── journal.py         # Journal entries
│   ├── integrations.py    # 3rd party integrations (Strava, Oura, etc.)
│   ├── schedules.py       # Scheduled tasks & recommendations
│   ├── training.py        # Training calendar, blocks
│   ├── recipes.py         # Recipe management
│   ├── documents.py       # Document storage
│   ├── analytics.py       # Analytics tracking
│   ├── webhooks.py        # Webhook endpoints
│   ├── crm.py             # CRM management
│   ├── coupons.py         # Coupon management
│   ├── pages.py           # Page management
│   └── messaging.py       # Direct messaging
└── database.py            # MongoDB connection singleton

```

## Migration Strategy

### Phase 1: Extract Models & Utils
1. Create `models.py` with all Pydantic models
2. Create `utils.py` with helper functions
3. Create `database.py` for MongoDB connection

### Phase 2: Create Router Files
1. Create empty router files with placeholder structures
2. Define route imports in each router

### Phase 3: Migrate Routes (Domain by Domain)
1. **Auth routes** (~10 endpoints)
   - /auth/login, /auth/register, /auth/forgot-password, etc.
2. **Athlete routes** (~5 endpoints)
   - Profile CRUD, image uploads
3. **Agent routes** (~10 endpoints)
   - Agents CRUD, knowledge base, chat
4. **System routes** (~10 endpoints)
   - Settings, email service, SEO, diagnostics
5. **Community routes** (~50+ endpoints)
   - Posts, comments, likes, groups, events, challenges
6. **Subscriptions** (~15 endpoints)
   - Stripe checkout, webhooks, portal
7. **Waitlist** (~5 endpoints)
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

### Phase 4: Update server.py
1. Remove all route definitions
2. Keep only:
   - FastAPI app initialization
   - CORS middleware
   - Custom middleware
   - Scheduler initialization
   - Router includes
   - Startup/shutdown events

### Phase 5: Testing
1. Restart backend service
2. Run smoke tests on critical endpoints
3. Full integration testing

## Dependencies to Inject

Each router will need:
- MongoDB `db` instance (via dependency injection or import)
- Shared services (email_service, image_processor, etc.)
- OpenAI client (where needed)
- Stripe client (where needed)

## Implementation Notes

1. **Database Access**: Pass `db` as a parameter to router functions via dependency injection or import from `database.py`
2. **Service Access**: Import services where needed
3. **Models**: Import from `models.py`
4. **Utils**: Import from `utils.py`
5. **No Breaking Changes**: All endpoints keep their current paths and behavior

## Success Criteria

1. ✅ All routes functional after refactoring
2. ✅ server.py reduced to <500 lines
3. ✅ Each router file <1000 lines
4. ✅ Clear separation of concerns
5. ✅ No duplicate code
6. ✅ All tests pass
