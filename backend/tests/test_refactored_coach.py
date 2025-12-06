"""
Test script to verify the refactored coach router works correctly
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from routes.coach_complete import router
from database import db

async def test_coach_router():
    """Test that the coach router is properly configured"""
    print("🧪 Testing Refactored Coach Router\n")
    
    # Test 1: Router has correct prefix
    print(f"✅ Router prefix: {router.prefix}")
    assert router.prefix == "/coach", f"Expected /coach, got {router.prefix}"
    
    # Test 2: Router has correct tags
    print(f"✅ Router tags: {router.tags}")
    assert "coach" in router.tags
    
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
        if "chat_messages" in collections:
            count = await db.chat_messages.count_documents({})
            print(f"   - chat_messages: {count} documents")
        if "athlete_memories" in collections:
            count = await db.athlete_memories.count_documents({})
            print(f"   - athlete_memories: {count} documents")
    except Exception as e:
        print(f"\n❌ Database connection failed: {e}")
        return False
    
    print("\n✅ All tests passed! Coach router is ready to use.")
    print("\n💡 Features: Conversation management, chat history, memory CRUD")
    print("💡 Note: Chat endpoint and voice routes remain in server.py (AI service dependencies)")
    return True

if __name__ == "__main__":
    result = asyncio.run(test_coach_router())
    sys.exit(0 if result else 1)
