# Refactored Backend Architecture

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Frontend)                          │
│                        React App on Port 3000                        │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 │ HTTP Requests
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         KUBERNETES INGRESS                           │
│              Routes /api/* → Backend, /* → Frontend                  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         FASTAPI APPLICATION                          │
│                         (server.py - Port 8001)                      │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    CORS Middleware                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                 │                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Custom Middleware (last_active)                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                 │                                     │
│  ┌──────────────────────────────▼──────────────────────────────┐   │
│  │                     API Router (/api)                         │   │
│  │                                                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │   │
│  │  │Auth Router  │  │Athletes     │  │Agents       │ ...      │   │
│  │  │/auth/*      │  │/athlete/*   │  │/agents/*    │          │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │   │
│  │                                                               │   │
│  │  23 Domain Routers (1 complete, 22 to be extracted)          │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
                ▼                ▼                ▼
┌────────────────────┐ ┌──────────────────┐ ┌─────────────────┐
│   Database Layer   │ │  Service Layer   │ │  Utility Layer  │
│   (database.py)    │ │  (various svcs)  │ │   (utils.py)    │
│                    │ │                  │ │                 │
│  ┌──────────────┐  │ │ • email_service  │ │ • prepare_mongo │
│  │   MongoDB    │  │ │ • image_proc     │ │ • parse_mongo   │
│  │   Client     │  │ │ • video_proc     │ │ • calc_age      │
│  │   (Motor)    │  │ │ • push_service   │ │ • query_limit   │
│  └──────────────┘  │ │ • integration    │ │                 │
│                    │ │   services       │ │                 │
└────────────────────┘ └──────────────────┘ └─────────────────┘
         │
         ▼
┌────────────────────┐
│  MongoDB Database  │
│   (External)       │
│                    │
│ Collections:       │
│ • athlete_profiles │
│ • agents           │
│ • community_posts  │
│ • subscriptions    │
│ • ... (15 more)    │
└────────────────────┘
```

## 📦 Module Structure

### Core Application (server.py)
```
server.py (Refactored - Target: <500 lines)
├── FastAPI app initialization
├── CORS middleware
├── Custom middleware
├── Router includes (23 routers)
├── Scheduler setup
├── Startup/shutdown handlers
└── Root endpoints only
```

### Router Layer (routes/)
```
routes/
├── __init__.py
├── auth_complete.py        ✅ COMPLETE
│   ├── Login
│   ├── Password Reset Flow
│   ├── Google OAuth
│   └── Email/Password Change
│
├── athletes.py             ⏳ TO DO
│   ├── Profile CRUD
│   └── Image Uploads
│
├── agents.py               ⏳ TO DO
│   ├── Agents CRUD
│   ├── Knowledge Base
│   └── Chat Endpoints
│
├── system.py               ⏳ TO DO
│   ├── Settings
│   ├── Email Config
│   └── SEO Management
│
└── ... (19 more routers)
```

### Data Layer
```
database.py
└── MongoDB connection (Motor AsyncIOMotorClient)
    └── Exports: db (database instance)

utils.py
├── prepare_for_mongo()     # Convert Python types → MongoDB
├── parse_from_mongo()      # Convert MongoDB → Python types
├── calculate_age()         # Age calculation
└── apply_query_limit()     # Safe query pagination
```

### Service Layer (Existing)
```
email_service.py            # SendGrid integration
image_processor.py          # Image processing
video_processor.py          # Video processing
strava_service.py          # Strava integration
oura_service.py            # Oura integration
polar_service.py           # Polar integration
fitbit_service.py          # Fitbit integration
garmin_service.py          # Garmin integration
coros_service.py           # Coros integration
whoop_service.py           # Whoop integration
suunto_service.py          # Suunto integration
```

## 🔄 Request Flow

### Example: POST /api/auth/login

```
1. Frontend
   │
   ├─ fetch('/api/auth/login', {body: {email, password}})
   │
   ▼
2. Kubernetes Ingress
   │
   ├─ Recognizes /api prefix
   ├─ Routes to backend:8001
   │
   ▼
3. FastAPI App (server.py)
   │
   ├─ CORS Middleware (validates origin)
   ├─ Custom Middleware (tracks last_active)
   ├─ Main API Router (/api)
   │
   ▼
4. Auth Router (/auth)
   │
   ├─ routes/auth_complete.py
   ├─ async def login_athlete(login_data: LoginRequest)
   │
   ▼
5. Database Layer
   │
   ├─ from database import db
   ├─ await db.athlete_profiles.find_one(...)
   │
   ▼
6. MongoDB
   │
   ├─ Query athlete_profiles collection
   ├─ Returns athlete document
   │
   ▼
7. Business Logic
   │
   ├─ Verify password (bcrypt)
   ├─ Update last_active_at
   ├─ Return athlete data
   │
   ▼
8. Response
   │
   ├─ JSON: {athlete_id, name, email, role}
   ├─ HTTP 200 OK
   │
   ▼
9. Frontend
   │
   └─ Receives response, updates state, redirects to dashboard
```

## 📂 File Organization

### Before Refactoring
```
/app/backend/
├── server.py (23,605 lines) ❌ MONOLITHIC
├── email_service.py
├── image_processor.py
├── video_processor.py
└── *_service.py (various)
```

### After Refactoring (Target)
```
/app/backend/
├── server.py (~500 lines) ✅ CLEAN
├── database.py ✅ NEW
├── utils.py ✅ NEW
│
├── routes/ ✅ NEW
│   ├── __init__.py
│   ├── auth_complete.py (456 lines) ✅ DONE
│   ├── athletes.py (~200 lines) ⏳
│   ├── agents.py (~400 lines) ⏳
│   ├── system.py (~400 lines) ⏳
│   ├── subscriptions.py (~600 lines) ⏳
│   ├── community.py (~2000 lines) ⏳
│   ├── workouts.py (~400 lines) ⏳
│   ├── nutrition.py (~800 lines) ⏳
│   └── ... (15 more)
│
└── services/ (existing)
    ├── email_service.py
    ├── image_processor.py
    └── *_service.py
```

## 🎯 Design Principles

### 1. Separation of Concerns
- **Routers**: Handle HTTP requests/responses
- **Services**: Business logic and external integrations
- **Database**: Data access layer
- **Utils**: Shared utility functions

### 2. Single Responsibility
- Each router handles ONE domain
- Each service handles ONE integration/feature
- Clear, focused modules

### 3. Dependency Injection
```python
# From router
from database import db              # Import singleton
from utils import prepare_for_mongo  # Import utility
from email_service import get_email_service  # Import service

# Use in endpoint
@router.post("/example")
async def example():
    email_service = get_email_service()
    await db.collection.insert_one(...)
```

### 4. Consistency
- All routers follow same structure
- Same import patterns
- Same error handling
- Same logging patterns

## 🔐 Security Architecture

```
┌─────────────────────────────────────────┐
│          Frontend (React)               │
│  - Stores athlete_id in state/cookies  │
└─────────────────────┬───────────────────┘
                      │
                      │ Include athlete_id in requests
                      ▼
┌─────────────────────────────────────────┐
│          Backend (FastAPI)              │
│  - No JWT/sessions (trusts athlete_id) │
│  - Password hashing (bcrypt)           │
│  - CORS protection                     │
│  - Input validation (Pydantic)         │
└─────────────────────┬───────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│          Database (MongoDB)             │
│  - Password hashes only                │
│  - No sensitive data in logs           │
└─────────────────────────────────────────┘
```

## 📊 Performance Considerations

### Database Connections
- **Motor (async)**: Non-blocking I/O
- **Connection pooling**: Automatic
- **Query limits**: Applied via utils.apply_query_limit()

### Caching Strategy
- **Not implemented**: Currently none
- **Future**: Redis for session data, frequently accessed data

### Async/Await
- All database operations use `await`
- Non-blocking request handling
- Supports concurrent requests

## 🧪 Testing Architecture

```
┌─────────────────────────────────────────┐
│          Unit Tests                     │
│  - Test individual router endpoints    │
│  - Mock database calls                 │
│  - Verify business logic               │
└─────────────────────┬───────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│       Integration Tests                 │
│  - Test full request/response cycle    │
│  - Use test database                   │
│  - Verify end-to-end flows             │
└─────────────────────┬───────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│          Manual Testing                 │
│  - Use curl for API testing            │
│  - Use frontend for E2E testing        │
│  - Check logs for errors               │
└─────────────────────────────────────────┘
```

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────┐
│       Kubernetes Cluster                │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │   Frontend Pod (React)            │  │
│  │   - Port 3000                     │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │   Backend Pod (FastAPI)           │  │
│  │   - Port 8001                     │  │
│  │   - Hot reload enabled            │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │   Ingress Controller              │  │
│  │   - Routes /api/* → Backend       │  │
│  │   - Routes /* → Frontend          │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
                      │
                      │ External connection
                      ▼
┌─────────────────────────────────────────┐
│      MongoDB (External Service)         │
│      - Connection via MONGO_URL env     │
└─────────────────────────────────────────┘
```

## 📝 Configuration Management

### Environment Variables
```bash
# Backend (.env)
MONGO_URL=mongodb://...          # Database connection
DB_NAME=production               # Database name
OPENAI_API_KEY=sk-...           # OpenAI API
STRIPE_SECRET_KEY=sk_...        # Stripe API
SENDGRID_API_KEY=SG...          # SendGrid API
VAPID_PRIVATE_KEY=...           # Push notifications

# Frontend (.env)
REACT_APP_BACKEND_URL=https://... # Backend URL (with /api)
```

### Configuration Flow
```
.env file → load_dotenv() → os.environ → Application Code
```

## 🎓 Key Takeaways

1. **Modular Structure**: Each domain is self-contained
2. **Clear Dependencies**: database.py, utils.py, services
3. **Consistent Patterns**: All routers follow same structure
4. **Easy to Test**: Each module can be tested independently
5. **Scalable**: Easy to add new domains/features

## 📖 Further Reading

- **REFACTORING_PLAN.md**: Detailed refactoring strategy
- **REFACTORING_GUIDE.md**: Step-by-step developer guide
- **MIGRATION_SCRIPT.md**: How to migrate to new structure
- **REFACTORING_SUMMARY.md**: Current status and progress
