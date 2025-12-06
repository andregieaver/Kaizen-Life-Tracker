"""
Database Index Creation Script
Creates essential indexes for production performance
Run this script once during deployment or migration
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

async def create_indexes():
    """Create all essential database indexes"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    indexes_created = 0
    
    try:
        # ============= ATHLETE PROFILES =============
        logger.info("Creating indexes for athlete_profiles...")
        
        # Email (unique) - for login
        await db.athlete_profiles.create_index([("email", 1)], unique=True, background=True)
        indexes_created += 1
        
        # ID (unique) - primary key
        await db.athlete_profiles.create_index([("id", 1)], unique=True, background=True)
        indexes_created += 1
        
        # Last active - for activity monitoring
        await db.athlete_profiles.create_index([("last_active_at", -1)], background=True)
        indexes_created += 1
        
        # ============= ACTIVITIES =============
        logger.info("Creating indexes for normalized_activities...")
        
        # User activities - most common query
        await db.normalized_activities.create_index([("user_id", 1), ("start_time", -1)], background=True)
        indexes_created += 1
        
        # Activity type filtering
        await db.normalized_activities.create_index([("user_id", 1), ("activity_type", 1), ("start_time", -1)], background=True)
        indexes_created += 1
        
        # Date range queries
        await db.normalized_activities.create_index([("date", -1)], background=True)
        indexes_created += 1
        
        # ============= DAILY METRICS =============
        logger.info("Creating indexes for normalized_daily...")
        
        # User daily metrics
        await db.normalized_daily.create_index([("user_id", 1), ("date", -1)], background=True)
        indexes_created += 1
        
        # ============= INTEGRATIONS =============
        logger.info("Creating indexes for integration connections...")
        
        # Strava connections
        await db.strava_connections.create_index([("athlete_id", 1)], background=True)
        indexes_created += 1
        
        # Oura connections
        await db.oura_connections.create_index([("athlete_id", 1)], background=True)
        indexes_created += 1
        
        # ============= HABITS =============
        logger.info("Creating indexes for habits...")
        
        # User habits
        await db.habits.create_index([("athlete_id", 1)], background=True)
        indexes_created += 1
        
        # Habit completions by user and date
        await db.habit_completions.create_index([("athlete_id", 1), ("date", -1)], background=True)
        indexes_created += 1
        
        # Habit completions by habit_id
        await db.habit_completions.create_index([("habit_id", 1), ("date", -1)], background=True)
        indexes_created += 1
        
        # ============= JOURNAL ENTRIES =============
        logger.info("Creating indexes for journal_entries...")
        
        # User journal entries
        await db.journal_entries.create_index([("athlete_id", 1), ("entry_date", -1)], background=True)
        indexes_created += 1
        
        # Entry type filtering
        await db.journal_entries.create_index([("athlete_id", 1), ("entry_type", 1), ("entry_date", -1)], background=True)
        indexes_created += 1
        
        # ============= NUTRITION =============
        logger.info("Creating indexes for nutrition_log...")
        
        # User nutrition entries
        await db.nutrition_log.create_index([("athlete_id", 1), ("date", -1)], background=True)
        indexes_created += 1
        
        # Meal type filtering
        await db.nutrition_log.create_index([("athlete_id", 1), ("meal_type", 1), ("date", -1)], background=True)
        indexes_created += 1
        
        # ============= COMMUNITY =============
        logger.info("Creating indexes for community_posts...")
        
        # Author posts
        await db.community_posts.create_index([("author_id", 1), ("created_at", -1)], background=True)
        indexes_created += 1
        
        # Feed chronological order
        await db.community_posts.create_index([("created_at", -1)], background=True)
        indexes_created += 1
        
        # Post interactions
        await db.post_interactions.create_index([("post_id", 1), ("athlete_id", 1)], background=True)
        indexes_created += 1
        
        # ============= TRAINING =============
        logger.info("Creating indexes for training_events...")
        
        # User training calendar
        await db.training_events.create_index([("athlete_id", 1), ("date", -1)], background=True)
        indexes_created += 1
        
        # Event type filtering
        await db.training_events.create_index([("athlete_id", 1), ("event_type", 1), ("date", -1)], background=True)
        indexes_created += 1
        
        # ============= BODY SCORE =============
        logger.info("Creating indexes for body_score_history...")
        
        # User body score history
        await db.body_score_history.create_index([("athlete_id", 1), ("date", -1)], unique=True, background=True)
        indexes_created += 1
        
        # ============= READINESS SCORES =============
        logger.info("Creating indexes for readiness_scores...")
        
        # User readiness scores
        await db.readiness_scores.create_index([("athlete_id", 1), ("date", -1)], background=True)
        indexes_created += 1
        
        # ============= AUTH TOKENS =============
        logger.info("Creating indexes for password reset tokens...")
        
        # Reset token lookup
        await db.athlete_profiles.create_index([("reset_token", 1)], sparse=True, background=True)
        indexes_created += 1
        
        # Token expiration (for cleanup)
        await db.athlete_profiles.create_index([("reset_token_expires", 1)], sparse=True, background=True)
        indexes_created += 1
        
        logger.info(f"✅ Successfully created {indexes_created} indexes")
        
        # Verify indexes
        logger.info("\nVerifying indexes...")
        collections = [
            'athlete_profiles', 'normalized_activities', 'normalized_daily',
            'habits', 'habit_completions', 'journal_entries', 'nutrition_log',
            'community_posts', 'training_events', 'body_score_history'
        ]
        
        for collection_name in collections:
            collection = db[collection_name]
            indexes = await collection.index_information()
            logger.info(f"  {collection_name}: {len(indexes)} indexes")
        
        return indexes_created
        
    except Exception as e:
        logger.error(f"Error creating indexes: {e}")
        raise
    finally:
        client.close()

if __name__ == "__main__":
    result = asyncio.run(create_indexes())
    print(f"\n🎉 Index creation complete! Created {result} indexes.")
    print("⚠️  Note: Background index creation may still be in progress.")
    print("📊 Check index status with: db.collection.getIndexes() in MongoDB shell")
