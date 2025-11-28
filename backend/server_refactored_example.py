"""
REFACTORED SERVER.PY - DEMONSTRATION
This is an example of how server.py should look after complete refactoring.
Currently includes only Auth routes as a demonstration.

To complete the refactoring:
1. Extract remaining route domains into separate router files (see REFACTORING_PLAN.md)
2. Import and include each router here
3. Keep only core app logic, middleware, and startup/shutdown handlers here
"""

from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

# Import shared dependencies
from database import db
from email_service import initialize_email_service, get_email_service

# Import routers
from routes.auth_complete import router as auth_router

# =============================================================================
# APPLICATION INITIALIZATION
# =============================================================================

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create the main app
app = FastAPI()

# =============================================================================
# MIDDLEWARE CONFIGURATION
# =============================================================================

# Configure CORS middleware for production deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for flexibility
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware to update last_active_at for authenticated requests
@app.middleware("http")
async def update_last_active(request: Request, call_next):
    response = await call_next(request)
    
    # Update last_active_at for authenticated API calls
    if request.url.path.startswith("/api/") and response.status_code < 400:
        # Try to get athlete_id from query params
        athlete_id = request.query_params.get("athlete_id") or request.query_params.get("viewer_athlete_id")
        
        if athlete_id:
            try:
                from datetime import datetime, timezone
                await db.athlete_profiles.update_one(
                    {"id": athlete_id},
                    {"$set": {"last_active_at": datetime.now(timezone.utc).isoformat()}},
                    upsert=False
                )
            except Exception:
                # Silently fail - don't break the request
                pass
    
    return response

# =============================================================================
# ROUTER CONFIGURATION
# =============================================================================

# Create a main API router with /api prefix
api_router = APIRouter(prefix="/api")

# Include domain routers
api_router.include_router(auth_router)

# TODO: Include remaining routers as they are extracted
# api_router.include_router(athletes_router)
# api_router.include_router(agents_router)
# api_router.include_router(system_router)
# api_router.include_router(community_router)
# api_router.include_router(subscriptions_router)
# api_router.include_router(waitlist_router)
# api_router.include_router(voice_router)
# api_router.include_router(coach_router)
# api_router.include_router(workouts_router)
# api_router.include_router(nutrition_router)
# api_router.include_router(journal_router)
# api_router.include_router(integrations_router)
# api_router.include_router(schedules_router)
# api_router.include_router(training_router)
# api_router.include_router(recipes_router)
# api_router.include_router(documents_router)
# api_router.include_router(analytics_router)
# api_router.include_router(webhooks_router)
# api_router.include_router(crm_router)
# api_router.include_router(coupons_router)
# api_router.include_router(pages_router)
# api_router.include_router(messaging_router)

# Mount the API router
app.include_router(api_router)

# =============================================================================
# SCHEDULER INITIALIZATION
# =============================================================================

# Initialize scheduler
scheduler = AsyncIOScheduler()

async def check_and_execute_schedules():
    """Check for due schedules and execute them"""
    # TODO: Extract this logic to a separate scheduler service
    logging.info("[SCHEDULER] Checking schedules...")

# =============================================================================
# STARTUP & SHUTDOWN HANDLERS
# =============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logging.info("🚀 Application starting up...")
    
    # Initialize email service
    try:
        initialize_email_service()
        email_service = get_email_service()
        if email_service.enabled:
            logging.info("✅ Email service initialized successfully")
        else:
            logging.warning("⚠️ Email service is disabled")
    except Exception as e:
        logging.error(f"❌ Failed to initialize email service: {e}")
    
    # Start scheduler
    try:
        scheduler.add_job(
            check_and_execute_schedules,
            CronTrigger(minute='*/15'),  # Every 15 minutes
            id='schedule_checker',
            replace_existing=True
        )
        scheduler.start()
        logging.info("✅ Scheduler started successfully")
    except Exception as e:
        logging.error(f"❌ Failed to start scheduler: {e}")
    
    logging.info("✅ Application startup complete")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logging.info("🔴 Application shutting down...")
    if scheduler.running:
        scheduler.shutdown()
        logging.info("✅ Scheduler shut down")

# =============================================================================
# ROOT ROUTES
# =============================================================================

@app.get("/")
async def root():
    """Root endpoint"""
    return {"status": "ok", "message": "API is running"}

@api_router.get("/")
async def api_root():
    """API root endpoint"""
    return {"status": "ok", "message": "API is running"}

# =============================================================================
# STATIC FILES (if needed)
# =============================================================================

# Mount static files directory if it exists
uploads_dir = ROOT_DIR / "uploads"
if uploads_dir.exists():
    app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")
    logging.info(f"✅ Static files mounted from {uploads_dir}")

# =============================================================================
# APPLICATION METADATA
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
