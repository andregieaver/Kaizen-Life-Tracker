"""
Test script to verify the refactored system router works correctly
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from routes.system_complete import router
from database import db

async def test_system_router():
    """Test that the system router is properly configured"""
    print("🧪 Testing Refactored System Router\n")
    
    # Test 1: Router has correct prefix
    print(f"✅ Router prefix: {router.prefix}")
    assert router.prefix == "/system", f"Expected /system, got {router.prefix}"
    
    # Test 2: Router has correct tags
    print(f"✅ Router tags: {router.tags}")
    assert "system" in router.tags
    
    # Test 3: Count routes
    route_count = len(router.routes)
    print(f"✅ Number of routes: {route_count}")
    assert route_count >= 10, f"Expected at least 10 routes, got {route_count}"
    
    # Test 4: List all routes
    print("\n📋 Available routes:")
    for route in router.routes:
        methods = ", ".join(route.methods) if hasattr(route, 'methods') else "N/A"
        print(f"   {methods:6} {route.path}")
    
    # Test 5: Database connection
    try:
        collections = await db.list_collection_names()
        print(f"\n✅ Database connected. Collections: {len(collections)}")
        if "system_settings" in collections:
            count = await db.system_settings.count_documents({})
            print(f"   - system_settings: {count} documents")
    except Exception as e:
        print(f"\n❌ Database connection failed: {e}")
        return False
    
    print("\n✅ All tests passed! System router is ready to use.")
    print("\n💡 Note: Translation endpoints remain in server.py for future extraction")
    return True

if __name__ == "__main__":
    result = asyncio.run(test_system_router())
    sys.exit(0 if result else 1)
