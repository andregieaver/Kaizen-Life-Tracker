"""
Cleanup script for test environment
Deletes all users except andre@humanweb.no and removes all active subscriptions
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DATABASE_NAME = os.environ.get('DB_NAME', 'test_database')

async def cleanup_test_data():
    """Clean up test data while preserving andre@humanweb.no"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]
    
    print("🔍 Starting cleanup process...")
    
    # Step 1: Find the user to preserve
    preserve_user = await db.athlete_profiles.find_one(
        {"email": "andre@humanweb.no"},
        {"_id": 0, "id": 1, "name": 1, "email": 1}
    )
    
    if not preserve_user:
        print("❌ Error: User andre@humanweb.no not found!")
        return
    
    preserve_user_id = preserve_user.get("id")
    print(f"✅ Found user to preserve: {preserve_user.get('name')} ({preserve_user.get('email')})")
    print(f"   User ID: {preserve_user_id}")
    
    # Step 2: Count users to be deleted
    total_users = await db.athlete_profiles.count_documents({})
    users_to_delete = await db.athlete_profiles.count_documents({"id": {"$ne": preserve_user_id}})
    
    print(f"\n📊 Current database state:")
    print(f"   Total users: {total_users}")
    print(f"   Users to delete: {users_to_delete}")
    print(f"   Users to preserve: 1 (andre@humanweb.no)")
    
    if users_to_delete == 0:
        print("\n✅ No users to delete. Database is already clean.")
    else:
        # Confirm deletion
        print(f"\n⚠️  WARNING: About to delete {users_to_delete} users!")
        confirmation = input("Type 'DELETE' to confirm: ")
        
        if confirmation != "DELETE":
            print("❌ Cleanup cancelled.")
            return
        
        print("\n🗑️  Deleting users...")
        
        # Get list of user IDs to delete
        users_to_remove = await db.athlete_profiles.find(
            {"id": {"$ne": preserve_user_id}},
            {"_id": 0, "id": 1}
        ).to_list(length=None)
        
        user_ids_to_delete = [u.get("id") for u in users_to_remove]
        
        # Step 3: Delete related data for users being removed
        print("   Deleting payment transactions...")
        payment_result = await db.payment_transactions.delete_many({
            "athlete_id": {"$in": user_ids_to_delete}
        })
        print(f"   ✓ Deleted {payment_result.deleted_count} payment transactions")
        
        print("   Deleting community posts...")
        posts_result = await db.community_posts.delete_many({
            "athlete_id": {"$in": user_ids_to_delete}
        })
        print(f"   ✓ Deleted {posts_result.deleted_count} community posts")
        
        print("   Deleting community comments...")
        comments_result = await db.community_comments.delete_many({
            "athlete_id": {"$in": user_ids_to_delete}
        })
        print(f"   ✓ Deleted {comments_result.deleted_count} community comments")
        
        print("   Deleting community events...")
        events_result = await db.community_events.delete_many({
            "creator_id": {"$in": user_ids_to_delete}
        })
        print(f"   ✓ Deleted {events_result.deleted_count} community events")
        
        print("   Deleting referrals...")
        referrals_result = await db.referrals.delete_many({
            "$or": [
                {"referrer_athlete_id": {"$in": user_ids_to_delete}},
                {"referred_athlete_id": {"$in": user_ids_to_delete}}
            ]
        })
        print(f"   ✓ Deleted {referrals_result.deleted_count} referrals")
        
        # Delete user profiles (except preserved user)
        print("   Deleting user profiles...")
        profiles_result = await db.athlete_profiles.delete_many({
            "id": {"$ne": preserve_user_id}
        })
        print(f"   ✓ Deleted {profiles_result.deleted_count} user profiles")
    
    # Step 4: Remove all active subscriptions (including the preserved user)
    print("\n🔄 Resetting all subscriptions...")
    
    # Count subscriptions to reset
    active_subs = await db.athlete_profiles.count_documents({
        "subscription_tier": {"$ne": "free"}
    })
    
    print(f"   Found {active_subs} active subscriptions")
    
    if active_subs > 0:
        # Reset all users to free tier
        reset_result = await db.athlete_profiles.update_many(
            {},
            {
                "$set": {
                    "subscription_tier": "free",
                    "subscription_status": "inactive",
                    "subscription_interval": None,
                    "subscription_current_period_start": None,
                    "subscription_current_period_end": None,
                    "subscription_cancel_at": None,
                    "stripe_subscription_id": None
                }
            }
        )
        print(f"   ✓ Reset {reset_result.modified_count} subscriptions to free tier")
    else:
        print("   ✓ No active subscriptions found")
    
    # Final summary
    print("\n" + "="*60)
    print("✅ CLEANUP COMPLETE!")
    print("="*60)
    
    # Show final state
    final_user_count = await db.athlete_profiles.count_documents({})
    final_preserved_user = await db.athlete_profiles.find_one(
        {"email": "andre@humanweb.no"},
        {"_id": 0, "name": 1, "email": 1, "subscription_tier": 1}
    )
    
    print(f"\n📊 Final database state:")
    print(f"   Total users: {final_user_count}")
    print(f"   Preserved user: {final_preserved_user.get('name')} ({final_preserved_user.get('email')})")
    print(f"   Subscription tier: {final_preserved_user.get('subscription_tier', 'free')}")
    
    # Close connection
    client.close()
    print("\n✨ Database connection closed.")

if __name__ == "__main__":
    print("=" * 60)
    print("TEST ENVIRONMENT CLEANUP SCRIPT")
    print("=" * 60)
    print("\nThis script will:")
    print("1. Delete all users EXCEPT andre@humanweb.no")
    print("2. Delete all related data (transactions, posts, comments, etc.)")
    print("3. Reset ALL subscriptions to free tier (including preserved user)")
    print("\n" + "=" * 60 + "\n")
    
    asyncio.run(cleanup_test_data())
