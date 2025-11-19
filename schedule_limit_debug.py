#!/usr/bin/env python3
"""
Specific diagnostic test for schedule limit issue with andre@humanweb.no
"""

import requests
import json

# Backend URL from environment
BACKEND_URL = "https://bodyscore-app.preview.emergentagent.com/api"

def debug_schedule_limit_issue():
    """Debug the specific schedule limit issue"""
    print("🔍 DEBUGGING SCHEDULE LIMIT ISSUE")
    print("=" * 70)
    
    # Use the existing andre@example.com user that we know has the issue
    athlete_id = "90de5b99-6db3-4e14-8455-c00864fb9976"
    
    print(f"   Investigating athlete_id: {athlete_id}")
    
    # Step 1: Check athlete profile subscription_tier
    print("   Step 1: Check athlete profile subscription_tier")
    
    profile_response = requests.get(f"{BACKEND_URL}/athlete/{athlete_id}")
    
    if profile_response.status_code == 200:
        profile_data = profile_response.json()
        subscription_tier = profile_data.get("subscription_tier", "NOT_SET")
        subscription_status = profile_data.get("subscription_status", "NOT_SET")
        email = profile_data.get("email", "NOT_SET")
        name = profile_data.get("name", "NOT_SET")
        
        print(f"      Email: {email}")
        print(f"      Name: {name}")
        print(f"      subscription_tier: '{subscription_tier}'")
        print(f"      subscription_status: '{subscription_status}'")
        
        # This is the root cause!
        if subscription_tier == "free":
            print(f"      ❌ PROBLEM IDENTIFIED: User has 'free' tier in database")
            print(f"      💡 User reports having Pro plan but database shows 'free'")
        elif subscription_tier == "pro":
            print(f"      ✅ User has 'pro' tier in database")
        else:
            print(f"      ⚠️ Unexpected subscription_tier: '{subscription_tier}'")
    else:
        print(f"      ❌ Cannot get athlete profile: {profile_response.status_code}")
        return
    
    # Step 2: Check existing schedules
    print("   Step 2: Check existing schedules")
    
    schedules_response = requests.get(f"{BACKEND_URL}/schedules/{athlete_id}")
    
    if schedules_response.status_code == 200:
        schedules = schedules_response.json()
        print(f"      Active schedules count: {len(schedules)}")
        
        for i, schedule in enumerate(schedules, 1):
            print(f"        {i}. '{schedule.get('name')}' - Active: {schedule.get('active')}")
            
        # Check if user has more schedules than free tier allows
        if len(schedules) > 1 and subscription_tier == "free":
            print(f"      ❌ INCONSISTENCY: User has {len(schedules)} schedules but free tier limit is 1")
            print(f"      💡 This suggests user was previously on a higher tier")
    else:
        print(f"      ❌ Cannot get schedules: {schedules_response.status_code}")
    
    # Step 3: Check subscription status API
    print("   Step 3: Check subscription status API")
    
    subscription_response = requests.get(f"{BACKEND_URL}/subscription/status/{athlete_id}")
    
    if subscription_response.status_code == 200:
        subscription_data = subscription_response.json()
        api_tier = subscription_data.get("tier", "NOT_SET")
        api_status = subscription_data.get("status", "NOT_SET")
        
        print(f"      API tier: '{api_tier}'")
        print(f"      API status: '{api_status}'")
        
        if subscription_tier != api_tier:
            print(f"      ❌ MISMATCH: Database tier ('{subscription_tier}') != API tier ('{api_tier}')")
        else:
            print(f"      ✅ Database and API tier match")
    else:
        print(f"      ❌ Subscription status API failed: {subscription_response.status_code}")
        print(f"      Response: {subscription_response.text}")
    
    # Step 4: Test schedule creation to see exact error
    print("   Step 4: Test schedule creation to see exact error")
    
    test_schedule = {
        "athlete_id": athlete_id,
        "name": "Test Limit Diagnosis",
        "prompt": "Test schedule for limit diagnosis",
        "frequency": "daily",
        "time": "10:00",
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
        error_message = error_data.get("detail", "Unknown error")
        print(f"      Error message: {error_message}")
        
        # Parse the error message to extract current count and limit
        if "Current:" in error_message and "Limit:" in error_message:
            # Extract numbers from error message
            import re
            current_match = re.search(r'Current: (\d+)', error_message)
            limit_match = re.search(r'Limit: (\d+)', error_message)
            
            if current_match and limit_match:
                current_count = int(current_match.group(1))
                limit_count = int(limit_match.group(1))
                
                print(f"      Current schedules: {current_count}")
                print(f"      Enforced limit: {limit_count}")
                
                if limit_count == 1:
                    print(f"      ❌ CONFIRMED: Backend is enforcing free tier limit (1)")
                elif limit_count == 5:
                    print(f"      ✅ Backend is enforcing pro tier limit (5)")
                else:
                    print(f"      ⚠️ Unexpected limit: {limit_count}")
    elif create_response.status_code == 200:
        print(f"      ✅ Schedule creation succeeded (no limit reached)")
        # Clean up
        created_schedule = create_response.json()
        delete_response = requests.delete(f"{BACKEND_URL}/schedules/{created_schedule.get('id')}")
        print(f"      ✅ Test schedule cleaned up")
    else:
        print(f"      ❌ Unexpected response: {create_response.status_code}")
        print(f"      Response: {create_response.text}")
    
    # Step 5: Diagnosis and recommendations
    print("\n📊 DIAGNOSIS:")
    print("-" * 50)
    
    if subscription_tier == "free":
        print("❌ ROOT CAUSE: User's subscription_tier is 'free' in database")
        print("💡 User reports having Pro plan but database doesn't reflect this")
        print("💡 This could be due to:")
        print("   - Subscription not properly updated after payment")
        print("   - Webhook failure during subscription activation")
        print("   - Manual database update needed")
        print("   - User confusion about their actual plan")
    elif subscription_tier == "pro":
        print("⚠️ User has 'pro' tier but still getting free tier limits")
        print("💡 This could be due to:")
        print("   - Backend caching issue")
        print("   - Code bug in tier lookup")
        print("   - Database query issue")
    
    print("\n💡 RECOMMENDATIONS:")
    print("-" * 50)
    print("1. Verify user's actual subscription status with payment provider")
    print("2. Update subscription_tier to 'pro' in athlete_profiles collection if confirmed")
    print("3. Test schedule creation after tier update")
    print("4. Check webhook logs for subscription events")

if __name__ == "__main__":
    debug_schedule_limit_issue()