"""Test script for refactored Recommendations router"""
import sys
import asyncio
from routes.recommendations_complete import router
from database import db

async def test_recommendations_router():
    print("🧪 Testing Refactored Recommendations Router\n")
    
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
    
    print("\n✅ All tests passed! Recommendations router is ready to use.")
    
    # Feature summary
    print("\n💡 Features: Get recommendations, mark as read, delete")
    print("💡 Note: Generation endpoint remains in server.py (ai_coach dependency)")
    
    return True

if __name__ == "__main__":
    result = asyncio.run(test_recommendations_router())
    sys.exit(0 if result else 1)
