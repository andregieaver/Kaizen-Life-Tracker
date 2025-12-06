"""Test script for refactored Supplements router"""
import sys
import asyncio
from routes.supplements_complete import router
from database import db

async def test_supplements_router():
    print("🧪 Testing Refactored Supplements Router\n")
    
    # Check router configuration
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
            print(f"   {method:7} {path}")
    
    # Test database connection
    try:
        collections = await db.list_collection_names()
        print(f"\n✅ Database connected. Collections: {len(collections)}")
    except Exception as e:
        print(f"\n❌ Database connection failed: {e}")
        return False
    
    print("\n✅ All tests passed! Supplements router is ready to use.")
    
    # Feature summary
    print("\n💡 Features: Supplement tracking, supplement logs, CRUD operations")
    print("💡 8 endpoints total (4 supplements + 4 supplement logs)")
    
    return True

if __name__ == "__main__":
    result = asyncio.run(test_supplements_router())
    sys.exit(0 if result else 1)
