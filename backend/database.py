"""Database connection singleton for MongoDB"""
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection with connection pooling
mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    raise ValueError("MONGO_URL environment variable is required")

# Connection pool configuration
# These settings are optimized for production use
pool_config = {
    'maxPoolSize': int(os.getenv('MONGO_MAX_POOL_SIZE', '50')),  # Max connections in pool
    'minPoolSize': int(os.getenv('MONGO_MIN_POOL_SIZE', '10')),  # Min connections to maintain
    'maxIdleTimeMS': int(os.getenv('MONGO_MAX_IDLE_TIME_MS', '30000')),  # 30 seconds
    'waitQueueTimeoutMS': int(os.getenv('MONGO_WAIT_QUEUE_TIMEOUT_MS', '10000')),  # 10 seconds
    'serverSelectionTimeoutMS': int(os.getenv('MONGO_SERVER_SELECTION_TIMEOUT_MS', '5000')),  # 5 seconds
    'connectTimeoutMS': int(os.getenv('MONGO_CONNECT_TIMEOUT_MS', '10000')),  # 10 seconds
    'socketTimeoutMS': int(os.getenv('MONGO_SOCKET_TIMEOUT_MS', '60000')),  # 60 seconds
}

logger.info(f"Initializing MongoDB connection with pool config: {pool_config}")

client = AsyncIOMotorClient(mongo_url, **pool_config)
db_name = os.environ.get('DB_NAME')
if not db_name:
    raise ValueError("DB_NAME environment variable is required")
db = client[db_name]

# Connection verification on startup
async def verify_connection():
    """Verify MongoDB connection on startup"""
    try:
        await client.admin.command('ping')
        logger.info("MongoDB connection successful")
        return True
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        return False
