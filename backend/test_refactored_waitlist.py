"""
Test script to verify the refactored waitlist router works correctly
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from routes.waitlist_complete import router
from database import db

async def test_waitlist_router():
    """Test that the waitlist router is properly configured"""
    print("🧪 Testing Refactored Waitlist Router\n")
    
    # Test 1: Router has correct prefix
    print(f"✅ Router prefix: {router.prefix}")
    assert router.prefix == "/waiting-list", f"Expected /waiting-list, got {router.prefix}"
    
    # Test 2: Router has correct tags
    print(f"✅ Router tags: {router.tags}")
    assert "waitlist" in router.tags
    
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
        if "waiting_list" in collections:
            count = await db.waiting_list.count_documents({})
            print(f"   - waiting_list: {count} documents")
        if "email_templates" in collections:
            count = await db.email_templates.count_documents({})
            print(f"   - email_templates: {count} documents")
    except Exception as e:
        print(f"\n❌ Database connection failed: {e}")
        return False
    
    print("\n✅ All tests passed! Waitlist router is ready to use.")
    print("\n💡 Features: Auto-responder email, CSV export, admin management")
    return True

if __name__ == "__main__":
    result = asyncio.run(test_waitlist_router())
    sys.exit(0 if result else 1)
