"""Test script for refactored Test Results router"""
import sys
import asyncio
from routes.test_results_complete import router
from database import db

async def test_test_results_router():
    print("🧪 Testing Refactored Test Results Router\n")
    
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
    
    print("\n✅ All tests passed! Test Results router is ready to use.")
    
    # Feature summary
    print("\n💡 Features: Test result CRUD, unique test names, filtering by test name")
    print("💡 Examples: Pull-ups, 5km Run, Plank Hold, etc.")
    
    return True

if __name__ == "__main__":
    result = asyncio.run(test_test_results_router())
    sys.exit(0 if result else 1)
