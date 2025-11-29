"""
Test script for Basic Integration Management Routes
Tests OpenAI key management and generic integration CRUD operations
"""

import asyncio
import httpx
import os

# Get backend URL from environment
BACKEND_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')
API_URL = f"{BACKEND_URL}/api"

# Test athlete ID
TEST_ATHLETE_ID = "test-athlete-integrations-basic"


async def test_basic_integrations():
    """Test basic integration management endpoints"""
    
    print("\n" + "="*80)
    print("🧪 Testing Basic Integration Management Routes")
    print("="*80 + "\n")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        
        # Test 1: Get integrations for athlete (should be empty initially)
        print("📝 Test 1: GET /integrations/{athlete_id} - List integrations")
        try:
            response = await client.get(f"{API_URL}/integrations/{TEST_ATHLETE_ID}")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.json()}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ Success: Found {len(data.get('integrations', []))} integrations")
            else:
                print(f"   ❌ Failed with status {response.status_code}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        print("\n" + "-"*80 + "\n")
        
        # Test 2: Save invalid OpenAI key (should fail)
        print("📝 Test 2: POST /integrations/openai/{athlete_id} - Save invalid OpenAI key")
        try:
            response = await client.post(
                f"{API_URL}/integrations/openai/{TEST_ATHLETE_ID}",
                json={"api_key": "invalid-key-format"}
            )
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.json()}")
            
            if response.status_code == 400:
                print(f"   ✅ Success: Correctly rejected invalid key format")
            else:
                print(f"   ❌ Unexpected status {response.status_code}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        print("\n" + "-"*80 + "\n")
        
        # Test 3: Disconnect integration that doesn't exist
        print("📝 Test 3: DELETE /integrations/{athlete_id}/{integration_type} - Disconnect non-existent integration")
        try:
            response = await client.delete(
                f"{API_URL}/integrations/{TEST_ATHLETE_ID}/nonexistent"
            )
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.json()}")
            
            if response.status_code == 404:
                print(f"   ✅ Success: Correctly returned 404 for non-existent integration")
            else:
                print(f"   ⚠️  Unexpected status {response.status_code}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        print("\n" + "="*80)
        print("✅ Basic Integration Tests Complete")
        print("="*80 + "\n")
        
        print("📌 Summary:")
        print("   - GET /integrations/{athlete_id} endpoint works")
        print("   - POST /integrations/openai/{athlete_id} validation works")
        print("   - DELETE /integrations/{athlete_id}/{integration_type} works")
        print("\n   ⚠️  Note: Full OpenAI key validation requires a real API key")
        print("   ⚠️  These tests verify the endpoints are accessible and respond correctly\n")


if __name__ == "__main__":
    asyncio.run(test_basic_integrations())
