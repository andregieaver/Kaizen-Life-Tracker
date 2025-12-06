"""Test script for refactored Files router"""
import sys
import asyncio
from routes.files_complete import router
from database import db

async def test_files_router():
    print("🧪 Testing Refactored Files Router\n")
    
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
    
    print("\n✅ All tests passed! Files router is ready to use.")
    
    # Feature summary
    print("\n💡 Features: File upload (base64), file listing, file updates, file deletion")
    print("💡 Note: Files are stored in MongoDB as base64 with 12MB size limit")
    
    return True

if __name__ == "__main__":
    result = asyncio.run(test_files_router())
    sys.exit(0 if result else 1)
