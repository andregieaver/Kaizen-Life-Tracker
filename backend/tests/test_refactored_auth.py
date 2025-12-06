"""
Test script to verify the refactored auth router works correctly
Run this after switching to the refactored server structure
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from routes.auth_complete import router, LoginRequest
from database import db

async def test_auth_router():
    """Test that the auth router is properly configured"""
    print("🧪 Testing Refactored Auth Router\n")
    
    # Test 1: Router has correct prefix
    print(f"✅ Router prefix: {router.prefix}")
    assert router.prefix == "/auth", f"Expected /auth, got {router.prefix}"
    
    # Test 2: Router has correct tags
    print(f"✅ Router tags: {router.tags}")
    assert "authentication" in router.tags
    
    # Test 3: Count routes
    route_count = len(router.routes)
    print(f"✅ Number of routes: {route_count}")
    assert route_count >= 7, f"Expected at least 7 routes, got {route_count}"
    
    # Test 4: List all routes
    print("\n📋 Available routes:")
    for route in router.routes:
        methods = ", ".join(route.methods) if hasattr(route, 'methods') else "N/A"
        print(f"   {methods:6} {route.path}")
    
    # Test 5: Database connection
    try:
        collections = await db.list_collection_names()
        print(f"\n✅ Database connected. Collections: {len(collections)}")
        if "athlete_profiles" in collections:
            count = await db.athlete_profiles.count_documents({})
            print(f"   - athlete_profiles: {count} documents")
    except Exception as e:
        print(f"\n❌ Database connection failed: {e}")
        return False
    
    print("\n✅ All tests passed! Auth router is ready to use.")
    return True

if __name__ == "__main__":
    result = asyncio.run(test_auth_router())
    sys.exit(0 if result else 1)
