#!/usr/bin/env python3
"""
Test schedule creation after simulating subscription tier fix
"""

import requests
import json

# Backend URL from environment
BACKEND_URL = "https://multilingual-fitness-1.preview.emergentagent.com/api"

def test_schedule_creation_with_pro_tier():
    """Test what would happen if the user had pro tier"""
    print("🔍 TESTING SCHEDULE CREATION LOGIC")
    print("=" * 70)
    
    athlete_id = "90de5b99-6db3-4e14-8455-c00864fb9976"
    
    print(f"   Testing with athlete_id: {athlete_id}")
    
    # Step 1: Check current state
    print("   Step 1: Check current subscription tier and schedule count")
    
    profile_response = requests.get(f"{BACKEND_URL}/athlete/{athlete_id}")
    if profile_response.status_code == 200:
        profile_data = profile_response.json()
        current_tier = profile_data.get("subscription_tier", "free")
        print(f"      Current tier: '{current_tier}'")
    
    schedules_response = requests.get(f"{BACKEND_URL}/schedules/{athlete_id}")
    if schedules_response.status_code == 200:
        schedules = schedules_response.json()
        print(f"      Current active schedules: {len(schedules)}")
    
    # Step 2: Simulate what the backend logic would do with different tiers
    print("   Step 2: Simulate backend schedule limit logic")
    
    schedule_limits = {
        'free': 1,
        'pro': 5,
        'premium': float('inf')
    }
    
    current_count = len(schedules) if 'schedules' in locals() else 0
    
    for tier, limit in schedule_limits.items():
        limit_display = int(limit) if limit != float('inf') else 'unlimited'
        
        if current_count >= limit:
            status = "❌ BLOCKED"
        else:
            status = "✅ ALLOWED"
        
        print(f"      {tier.upper()} tier (limit: {limit_display}): {status}")
    
    # Step 3: Test actual schedule creation
    print("   Step 3: Test actual schedule creation (will fail with current tier)")
    
    test_schedule = {
        "athlete_id": athlete_id,
        "name": "Test Pro Tier Schedule",
        "prompt": "Test schedule for pro tier verification",
        "frequency": "daily",
        "time": "11:00",
        "active": True
    }
    
    create_response = requests.post(
        f"{BACKEND_URL}/schedules",
        json=test_schedule,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"      Schedule creation status: {create_response.status_code}")
    
    if create_response.status_code == 403:
        error_data = create_response.json()
        print(f"      ❌ Blocked: {error_data.get('detail')}")
    elif create_response.status_code == 200:
        created_schedule = create_response.json()
        print(f"      ✅ Created: {created_schedule.get('id')}")
        # Clean up
        delete_response = requests.delete(f"{BACKEND_URL}/schedules/{created_schedule.get('id')}")
        print(f"      ✅ Cleaned up test schedule")
    else:
        print(f"      ⚠️ Unexpected response: {create_response.status_code}")
    
    # Step 4: Analysis and recommendations
    print("\n📊 ANALYSIS:")
    print("-" * 50)
    
    print(f"Current situation:")
    print(f"  - User has {current_count} active schedules")
    print(f"  - User has '{current_tier}' tier (limit: {schedule_limits.get(current_tier, 1)})")
    print(f"  - User cannot create more schedules")
    
    print(f"\nIf user had 'pro' tier:")
    print(f"  - Limit would be 5 schedules")
    print(f"  - User could create {5 - current_count} more schedules")
    print(f"  - Schedule creation would be ✅ ALLOWED")
    
    print(f"\n💡 SOLUTION:")
    print(f"  1. Verify user actually has Pro subscription with payment provider")
    print(f"  2. Update subscription_tier from 'free' to 'pro' in database")
    print(f"  3. User will then be able to create up to 5 schedules total")
    
    # Step 5: Check if there are any inactive schedules that could be cleaned up
    print("\n   Step 5: Check for inactive schedules that could be cleaned up")
    
    # Note: The GET /schedules endpoint only returns active schedules
    # To check inactive schedules, we'd need direct database access
    print("      Note: GET /schedules only returns active schedules")
    print("      To check inactive schedules, direct database access would be needed")

if __name__ == "__main__":
    test_schedule_creation_with_pro_tier()