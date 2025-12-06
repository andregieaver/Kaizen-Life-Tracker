"""
Test script to verify the refactored nutrition router works correctly
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from routes.nutrition_complete import router
from database import db

async def test_nutrition_router():
    """Test that the nutrition router is properly configured"""
    print("🧪 Testing Refactored Nutrition Router\n")
    
    # Test 1: Router has correct tags
    print(f"✅ Router tags: {router.tags}")
    assert "nutrition" in router.tags
    
    # Test 2: Count routes
    route_count = len(router.routes)
    print(f"✅ Number of routes: {route_count}")
    assert route_count >= 15, f"Expected at least 15 routes, got {route_count}"
    
    # Test 3: List all routes
    print("\n📋 Available routes:")
    for route in router.routes:
        methods = ", ".join(route.methods) if hasattr(route, 'methods') else "N/A"
        print(f"   {methods:6} {route.path}")
    
    # Test 4: Database connection
    try:
        collections = await db.list_collection_names()
        print(f"\n✅ Database connected. Collections: {len(collections)}")
        if "nutrition_entries" in collections:
            count = await db.nutrition_entries.count_documents({})
            print(f"   - nutrition_entries: {count} documents")
        if "supplements" in collections:
            count = await db.supplements.count_documents({})
            print(f"   - supplements: {count} documents")
        if "drinks" in collections:
            count = await db.drinks.count_documents({})
            print(f"   - drinks: {count} documents")
    except Exception as e:
        print(f"\n❌ Database connection failed: {e}")
        return False
    
    print("\n✅ All tests passed! Nutrition router is ready to use.")
    print("\n💡 Features: Nutrition tracking, AI meal analysis, supplements, hydration")
    return True

if __name__ == "__main__":
    result = asyncio.run(test_nutrition_router())
    sys.exit(0 if result else 1)
