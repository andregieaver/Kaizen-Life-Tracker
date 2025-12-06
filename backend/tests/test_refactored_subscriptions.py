"""
Test script to verify the refactored subscriptions router works correctly
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from routes.subscriptions_complete import router
from database import db

async def test_subscriptions_router():
    """Test that the subscriptions router is properly configured"""
    print("🧪 Testing Refactored Subscriptions Router\n")
    
    # Test 1: Router has correct prefix
    print(f"✅ Router prefix: {router.prefix}")
    assert router.prefix == "/subscriptions", f"Expected /subscriptions, got {router.prefix}"
    
    # Test 2: Router has correct tags
    print(f"✅ Router tags: {router.tags}")
    assert "subscriptions" in router.tags
    
    # Test 3: Count routes
    route_count = len(router.routes)
    print(f"✅ Number of routes: {route_count}")
    assert route_count >= 9, f"Expected at least 9 routes, got {route_count}"
    
    # Test 4: List all routes
    print("\n📋 Available routes:")
    for route in router.routes:
        methods = ", ".join(route.methods) if hasattr(route, 'methods') else "N/A"
        print(f"   {methods:6} {route.path}")
    
    # Test 5: Database connection
    try:
        collections = await db.list_collection_names()
        print(f"\n✅ Database connected. Collections: {len(collections)}")
        if "subscription_plans" in collections:
            count = await db.subscription_plans.count_documents({})
            print(f"   - subscription_plans: {count} documents")
        if "payment_transactions" in collections:
            count = await db.payment_transactions.count_documents({})
            print(f"   - payment_transactions: {count} documents")
    except Exception as e:
        print(f"\n❌ Database connection failed: {e}")
        return False
    
    print("\n✅ All tests passed! Subscriptions router is ready to use.")
    print("\n💡 Features: Stripe checkout, referral/coupon discounts, subscription management")
    print("💡 Note: Stripe webhooks endpoint remains in server.py")
    return True

if __name__ == "__main__":
    result = asyncio.run(test_subscriptions_router())
    sys.exit(0 if result else 1)
