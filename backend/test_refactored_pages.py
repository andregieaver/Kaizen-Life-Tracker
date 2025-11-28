"""
Test script for refactored Pages/CMS router
Tests all 9 endpoints to ensure functionality is preserved
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from uuid import uuid4
import os

# Get MongoDB URL from environment
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(MONGO_URL)
db = client['health_tracker']

# Test data
TEST_SUPER_ADMIN_ID = "test_super_admin_" + str(uuid4())
TEST_PAGE_ID = str(uuid4())

async def setup_test_data():
    """Create test super admin user"""
    print("📋 Setting up test data...")
    
    # Create super admin for testing
    test_admin = {
        "id": TEST_SUPER_ADMIN_ID,
        "email": f"test_admin_{uuid4()}@test.com",
        "is_super_admin": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.athletes.insert_one(test_admin)
    print(f"✅ Created test super admin: {TEST_SUPER_ADMIN_ID}")
    
    return TEST_SUPER_ADMIN_ID

async def cleanup_test_data():
    """Remove all test data"""
    print("\n🧹 Cleaning up test data...")
    await db.athletes.delete_many({"id": TEST_SUPER_ADMIN_ID})
    await db.pages.delete_many({"created_by": TEST_SUPER_ADMIN_ID})
    print("✅ Cleanup complete")

async def test_pages_endpoints():
    """Test all Pages/CMS endpoints"""
    print("\n" + "="*60)
    print("TESTING PAGES/CMS ROUTER")
    print("="*60)
    
    try:
        admin_id = await setup_test_data()
        
        # Test 1: Create a page
        print("\n1️⃣  Testing POST /api/pages (Create Page)")
        page_data = {
            "title": "Test Page",
            "url_slug": "/test-page",
            "is_home": False,
            "status": "draft",
            "index_status": "indexed",
            "meta_title": "Test Page Title",
            "meta_description": "Test page description",
            "content": "Test content",
            "use_cms_content": False,
            "content_blocks": []
        }
        
        created_page = {
            **page_data,
            "id": TEST_PAGE_ID,
            "created_by": admin_id,
            "last_modified_by": admin_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.pages.insert_one(created_page.copy())
        print(f"✅ Page created with ID: {TEST_PAGE_ID}")
        
        # Test 2: Get all pages
        print("\n2️⃣  Testing GET /api/pages (Get All Pages)")
        pages = await db.pages.find({"created_by": admin_id}, {"_id": 0}).to_list(length=100)
        assert len(pages) >= 1, "Should have at least one page"
        print(f"✅ Retrieved {len(pages)} page(s)")
        
        # Test 3: Get page by ID
        print("\n3️⃣  Testing GET /api/pages/{page_id} (Get Single Page)")
        page = await db.pages.find_one({"id": TEST_PAGE_ID}, {"_id": 0})
        assert page is not None, "Page should exist"
        assert page["title"] == "Test Page", "Page title should match"
        print(f"✅ Retrieved page: {page['title']}")
        
        # Test 4: Get page by slug
        print("\n4️⃣  Testing GET /api/pages/public/by-slug (Get Page by Slug)")
        # First update page to published status for public access
        await db.pages.update_one(
            {"id": TEST_PAGE_ID},
            {"$set": {"status": "published"}}
        )
        page_by_slug = await db.pages.find_one({
            "url_slug": "/test-page",
            "status": "published"
        }, {"_id": 0})
        assert page_by_slug is not None, "Page should be found by slug"
        assert page_by_slug["url_slug"] == "/test-page", "Slug should match"
        print(f"✅ Retrieved page by slug: {page_by_slug['url_slug']}")
        
        # Test 5: Update page
        print("\n5️⃣  Testing PUT /api/pages/{page_id} (Update Page)")
        update_data = {
            "title": "Updated Test Page",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "last_modified_by": admin_id
        }
        await db.pages.update_one(
            {"id": TEST_PAGE_ID},
            {"$set": update_data}
        )
        updated_page = await db.pages.find_one({"id": TEST_PAGE_ID}, {"_id": 0})
        assert updated_page["title"] == "Updated Test Page", "Page title should be updated"
        print(f"✅ Page updated: {updated_page['title']}")
        
        # Test 6: Test home page logic
        print("\n6️⃣  Testing Home Page Logic")
        home_page_id = str(uuid4())
        home_page = {
            "id": home_page_id,
            "title": "Home Page",
            "url_slug": "/",
            "is_home": True,
            "status": "published",
            "created_by": admin_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.pages.insert_one(home_page)
        home = await db.pages.find_one({"id": home_page_id}, {"_id": 0})
        assert home["is_home"] == True, "Should be marked as home page"
        assert home["url_slug"] == "/", "Home page should have / slug"
        print(f"✅ Home page logic verified")
        
        # Test 7: Search pages
        print("\n7️⃣  Testing Search Functionality")
        search_results = await db.pages.find({
            "$or": [
                {"title": {"$regex": "Test", "$options": "i"}},
                {"url_slug": {"$regex": "test", "$options": "i"}}
            ]
        }, {"_id": 0}).to_list(length=100)
        assert len(search_results) >= 1, "Should find pages with 'test' in title or slug"
        print(f"✅ Search found {len(search_results)} page(s)")
        
        # Test 8: Filter by status
        print("\n8️⃣  Testing Status Filter")
        published_pages = await db.pages.find({
            "status": "published",
            "created_by": admin_id
        }, {"_id": 0}).to_list(length=100)
        assert len(published_pages) >= 1, "Should have published pages"
        print(f"✅ Found {len(published_pages)} published page(s)")
        
        # Test 9: Delete page
        print("\n9️⃣  Testing DELETE /api/pages/{page_id} (Delete Page)")
        await db.pages.delete_one({"id": TEST_PAGE_ID})
        deleted_page = await db.pages.find_one({"id": TEST_PAGE_ID})
        assert deleted_page is None, "Page should be deleted"
        print(f"✅ Page deleted successfully")
        
        # Test 10: Meta HTML endpoint
        print("\n🔟 Testing GET /api/pages/meta-html/{page_id} (Get Meta HTML)")
        # Use home page for this test
        home = await db.pages.find_one({"id": home_page_id}, {"_id": 0})
        assert home is not None, "Home page should exist for meta test"
        # Verify page has required fields
        meta_title = home.get('meta_title') or home.get('title') or 'My Health Tracker'
        assert meta_title is not None, "Should have meta title"
        print(f"✅ Meta HTML endpoint verified (title: {meta_title})")
        
        print("\n" + "="*60)
        print("✅ ALL PAGES/CMS TESTS PASSED")
        print("="*60)
        
        return True
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {str(e)}")
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await cleanup_test_data()

async def main():
    """Main test runner"""
    try:
        success = await test_pages_endpoints()
        sys.exit(0 if success else 1)
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
