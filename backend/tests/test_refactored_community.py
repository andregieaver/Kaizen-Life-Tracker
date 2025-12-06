"""
Test script to verify the refactored community router works correctly
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from routes.community_complete import router
from database import db

async def test_community_router():
    """Test that the community router is properly configured"""
    print("🧪 Testing Refactored Community Router\n")
    
    # Test 1: Router has correct prefix
    print(f"✅ Router prefix: {router.prefix}")
    assert router.prefix == "/community", f"Expected /community, got {router.prefix}"
    
    # Test 2: Router has correct tags
    print(f"✅ Router tags: {router.tags}")
    assert "community" in router.tags
    
    # Test 3: Count routes
    route_count = len(router.routes)
    print(f"✅ Number of routes: {route_count}")
    print(f"   Note: Extracted {route_count}/64 core community routes")
    assert route_count >= 19, f"Expected at least 19 routes, got {route_count}"
    
    # Test 4: List all routes
    print("\n📋 Available routes:")
    for route in router.routes:
        methods = ", ".join(route.methods) if hasattr(route, 'methods') else "N/A"
        print(f"   {methods:6} {route.path}")
    
    # Test 5: Database connection
    try:
        collections = await db.list_collection_names()
        print(f"\n✅ Database connected. Collections: {len(collections)}")
        if "community_posts" in collections:
            count = await db.community_posts.count_documents({})
            print(f"   - community_posts: {count} documents")
        if "community_comments" in collections:
            count = await db.community_comments.count_documents({})
            print(f"   - community_comments: {count} documents")
    except Exception as e:
        print(f"\n❌ Database connection failed: {e}")
        return False
    
    print("\n✅ All tests passed! Community router is ready to use.")
    print("\n💡 Features: Posts, comments, likes, feed, following/followers")
    print("💡 Note: Events, challenges, groups remain in server.py for future extraction")
    return True

if __name__ == "__main__":
    result = asyncio.run(test_community_router())
    sys.exit(0 if result else 1)
