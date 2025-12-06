"""
Test script to verify the refactored schedules router works correctly
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from routes.schedules_complete import router
from database import db

async def test_schedules_router():
    """Test that the schedules router is properly configured"""
    print("🧪 Testing Refactored Schedules Router\n")
    
    # Test 1: Router has correct prefix
    print(f"✅ Router prefix: {router.prefix}")
    assert router.prefix == "/schedules", f"Expected /schedules, got {router.prefix}"
    
    # Test 2: Router has correct tags
    print(f"✅ Router tags: {router.tags}")
    assert "schedules" in router.tags
    
    # Test 3: Count routes
    route_count = len(router.routes)
    print(f"✅ Number of routes: {route_count}")
    assert route_count >= 4, f"Expected at least 4 routes, got {route_count}"
    
    # Test 4: List all routes
    print("\n📋 Available routes:")
    for route in router.routes:
        methods = ", ".join(route.methods) if hasattr(route, 'methods') else "N/A"
        print(f"   {methods:6} {route.path}")
    
    # Test 5: Database connection
    try:
        collections = await db.list_collection_names()
        print(f"\n✅ Database connected. Collections: {len(collections)}")
        if "schedules" in collections:
            count = await db.schedules.count_documents({})
            print(f"   - schedules: {count} documents")
        if "recommendations" in collections:
            count = await db.recommendations.count_documents({})
            print(f"   - recommendations: {count} documents")
    except Exception as e:
        print(f"\n❌ Database connection failed: {e}")
        return False
    
    print("\n✅ All tests passed! Schedules router is ready to use.")
    print("\n💡 Features: Schedule CRUD, subscription tier limits")
    print("💡 Note: Execution & recommendations endpoints remain in server.py (ai_coach dependency)")
    return True

if __name__ == "__main__":
    result = asyncio.run(test_schedules_router())
    sys.exit(0 if result else 1)
