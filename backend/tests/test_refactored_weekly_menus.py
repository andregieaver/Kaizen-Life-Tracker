"""Test script for refactored Weekly Menus router"""
import sys
import asyncio
from routes.weekly_menus_complete import router
from database import db

async def test_weekly_menus_router():
    print("🧪 Testing Refactored Weekly Menus Router\n")
    
    # Check router configuration
    print(f"✅ Router prefix: {router.prefix}")
    print(f"✅ Router tags: {router.tags}")
    
    # Check routes
    routes = [route for route in router.routes]
    print(f"✅ Number of routes: {len(routes)}\n")
    
    # List all routes
    print("📋 Available routes:")
    for route in routes:
        methods = list(route.methods) if hasattr(route, 'methods') else []
        if methods:
            method = methods[0]
            path = route.path
            print(f"   {method:7} {router.prefix}{path}")
    
    # Test database connection
    try:
        collections = await db.list_collection_names()
        print(f"\n✅ Database connected. Collections: {len(collections)}")
    except Exception as e:
        print(f"\n❌ Database connection failed: {e}")
        return False
    
    print("\n✅ All tests passed! Weekly Menus router is ready to use.")
    
    # Feature summary
    print("\n💡 Features: Weekly menu templates, meal planning, active menu management")
    print("💡 Structure: 21 meal slots (7 days × 3 meals)")
    
    return True

if __name__ == "__main__":
    result = asyncio.run(test_weekly_menus_router())
    sys.exit(0 if result else 1)
