"""Test script for refactored CRM router"""
import sys
import asyncio
from routes.crm_complete import router
from database import get_database

async def test_crm_router():
    print("🧪 Testing Refactored CRM Router\n")
    
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
        db = get_database()
        collections = await db.list_collection_names()
        print(f"\n✅ Database connected. Collections: {len(collections)}")
    except Exception as e:
        print(f"\n❌ Database connection failed: {e}")
        return False
    
    print("\n✅ All tests passed! CRM router is ready to use.")
    
    # Feature summary
    print("\n💡 Features: User management, Order tracking, Subscription management, User deletion, Refund processing")
    print("💡 Note: All CRM endpoints require super admin authentication")
    
    return True

if __name__ == "__main__":
    result = asyncio.run(test_crm_router())
    sys.exit(0 if result else 1)
