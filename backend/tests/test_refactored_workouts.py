"""
Test script to verify the refactored workouts router works correctly
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from routes.workouts_complete import router
from database import db

async def test_workouts_router():
    """Test that the workouts router is properly configured"""
    print("🧪 Testing Refactored Workouts Router\n")
    
    # Test 1: Router has correct tags
    print(f"✅ Router tags: {router.tags}")
    assert "workouts" in router.tags
    
    # Test 2: Count routes
    route_count = len(router.routes)
    print(f"✅ Number of routes: {route_count}")
    assert route_count >= 6, f"Expected at least 6 routes, got {route_count}"
    
    # Test 3: List all routes
    print("\n📋 Available routes:")
    for route in router.routes:
        methods = ", ".join(route.methods) if hasattr(route, 'methods') else "N/A"
        print(f"   {methods:6} {route.path}")
    
    # Test 4: Database connection
    try:
        collections = await db.list_collection_names()
        print(f"\n✅ Database connected. Collections: {len(collections)}")
        if "workouts" in collections:
            count = await db.workouts.count_documents({})
            print(f"   - workouts: {count} documents")
        if "sleep_data" in collections:
            count = await db.sleep_data.count_documents({})
            print(f"   - sleep_data: {count} documents")
    except Exception as e:
        print(f"\n❌ Database connection failed: {e}")
        return False
    
    print("\n✅ All tests passed! Workouts router is ready to use.")
    print("\n💡 Features: Workout logging, sleep tracking, readiness scores, personal records")
    return True

if __name__ == "__main__":
    result = asyncio.run(test_workouts_router())
    sys.exit(0 if result else 1)
