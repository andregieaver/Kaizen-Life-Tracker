#!/usr/bin/env python3
"""
Schedule Execution Flow Test - Focused on the reported issue
"""

import requests
import json
import sys
import time
from datetime import datetime, timedelta
import pytz

# Backend URL from environment
BACKEND_URL = "https://admin-ai-tools.preview.emergentagent.com/api"

def print_test_result(test_name, success, details=""):
    """Print formatted test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"   {status}: {test_name}")
    if details:
        print(f"      Details: {details}")
    print()

def test_schedule_execution_with_existing_schedule():
    """
    Test schedule execution using existing schedules to avoid plan limits
    """
    print("🔍 TESTING SCHEDULE EXECUTION WITH EXISTING SCHEDULES")
    print("=" * 70)
    
    try:
        # Use the specific test athlete from review request
        athlete_id = "90de5b99-6db3-4e14-8455-c00864fb9976"
        athlete_email = "andre@example.com"
        athlete_password = "password123"
        
        print(f"   Using test athlete: {athlete_email}")
        print(f"   Athlete ID: {athlete_id}")
        
        # Step 1: Login
        print("   Step 1: LOGIN")
        
        login_data = {
            "email": athlete_email,
            "password": athlete_password
        }
        
        login_response = requests.post(
            f"{BACKEND_URL}/auth/login",
            json=login_data,
            headers={"Content-Type": "application/json"}
        )
        
        if login_response.status_code != 200:
            print_test_result("Login", False, f"Login failed: {login_response.status_code}")
            return False
        
        print_test_result("Login", True, "Successfully logged in")
        
        # Step 2: Get existing schedules
        print("   Step 2: GET EXISTING SCHEDULES")
        
        schedules_response = requests.get(f"{BACKEND_URL}/schedules/{athlete_id}")
        
        if schedules_response.status_code != 200:
            print_test_result("Get Schedules", False, f"Failed: {schedules_response.status_code}")
            return False
        
        schedules = schedules_response.json()
        print_test_result("Get Schedules", True, f"Found {len(schedules)} active schedules")
        
        # Step 3: Analyze existing schedules
        print("   Step 3: ANALYZE EXISTING SCHEDULES")
        
        oslo_tz = pytz.timezone('Europe/Oslo')
        current_oslo_time = datetime.now(oslo_tz)
        
        print(f"      Current Oslo time: {current_oslo_time.strftime('%H:%M')}")
        print("      Existing schedules:")
        
        for i, schedule in enumerate(schedules, 1):
            name = schedule.get('name', 'Unnamed')
            time_str = schedule.get('time', 'No time')
            frequency = schedule.get('frequency', 'No frequency')
            last_executed = schedule.get('last_executed', 'Never')
            active = schedule.get('active', False)
            
            print(f"         {i}. '{name}' at {time_str} ({frequency})")
            print(f"            Active: {active}, Last executed: {last_executed}")
        
        # Step 4: Update one schedule to execute now
        print("   Step 4: UPDATE SCHEDULE TO EXECUTE NOW")
        
        if not schedules:
            print_test_result("Update Schedule", False, "No schedules available to update")
            return False
        
        # Use the first schedule
        test_schedule = schedules[0]
        test_schedule_id = test_schedule.get('id')
        
        # Set execution time to 1 minute from now
        execution_time = current_oslo_time + timedelta(minutes=1)
        new_time_str = execution_time.strftime("%H:%M")
        
        print(f"      Updating schedule '{test_schedule.get('name')}' to execute at {new_time_str}")
        
        update_data = {
            "name": test_schedule.get('name', 'Test Schedule'),
            "prompt": "Provide a brief analysis of my current training status. This is a test of the scheduler execution flow.",
            "frequency": "daily",
            "time": new_time_str,
            "active": True
        }
        
        update_response = requests.put(
            f"{BACKEND_URL}/schedules/{test_schedule_id}",
            json=update_data,
            headers={"Content-Type": "application/json"}
        )
        
        if update_response.status_code != 200:
            print_test_result("Update Schedule", False, f"Failed: {update_response.status_code} - {update_response.text}")
            return False
        
        print_test_result("Update Schedule", True, f"Updated to execute at {new_time_str}")
        
        # Step 5: Check OpenAI API key
        print("   Step 5: CHECK OPENAI API KEY")
        
        integrations_response = requests.get(f"{BACKEND_URL}/integrations/{athlete_id}")
        
        openai_configured = False
        if integrations_response.status_code == 200:
            integrations_data = integrations_response.json()
            for integration in integrations_data.get("integrations", []):
                if integration.get("integration_type") == "openai" and integration.get("is_active"):
                    openai_configured = True
                    break
        
        if openai_configured:
            print_test_result("OpenAI API Key", True, "OpenAI API key is configured")
        else:
            print_test_result("OpenAI API Key", False, "OpenAI API key not configured - execution will fail")
        
        # Step 6: Get baseline recommendation count
        print("   Step 6: GET BASELINE RECOMMENDATIONS")
        
        rec_response = requests.get(f"{BACKEND_URL}/recommendations/{athlete_id}")
        recommendations_before = 0
        if rec_response.status_code == 200:
            recommendations_before = len(rec_response.json())
        
        print_test_result("Baseline Recommendations", True, f"Current count: {recommendations_before}")
        
        # Step 7: Monitor for execution
        print("   Step 7: MONITOR FOR EXECUTION")
        print(f"      Waiting 2.5 minutes for scheduler to execute at {new_time_str}...")
        print("      Monitoring every 30 seconds...")
        
        execution_detected = False
        
        # Monitor for 2.5 minutes (5 checks every 30 seconds)
        for check_num in range(5):
            time.sleep(30)  # Wait 30 seconds
            
            current_check_time = datetime.now(oslo_tz)
            print(f"      Check {check_num + 1}/5 at {current_check_time.strftime('%H:%M:%S')}")
            
            # Check if last_executed was updated
            schedule_check_response = requests.get(f"{BACKEND_URL}/schedules/{athlete_id}")
            if schedule_check_response.status_code == 200:
                current_schedules = schedule_check_response.json()
                
                current_test_schedule = None
                for schedule in current_schedules:
                    if schedule.get("id") == test_schedule_id:
                        current_test_schedule = schedule
                        break
                
                if current_test_schedule:
                    current_last_executed = current_test_schedule.get("last_executed")
                    if current_last_executed:
                        print(f"         ✅ EXECUTION DETECTED! last_executed: {current_last_executed}")
                        execution_detected = True
                        break
                    else:
                        print(f"         ⏳ No execution yet (last_executed: None)")
                else:
                    print(f"         ❌ Test schedule not found")
            
            # Check for new recommendations
            rec_check_response = requests.get(f"{BACKEND_URL}/recommendations/{athlete_id}")
            if rec_check_response.status_code == 200:
                current_recommendations = len(rec_check_response.json())
                if current_recommendations > recommendations_before:
                    print(f"         ✅ NEW RECOMMENDATION! Count: {recommendations_before} → {current_recommendations}")
                    execution_detected = True
                    break
                else:
                    print(f"         ⏳ No new recommendations ({current_recommendations})")
        
        # Step 8: Final assessment
        print("   Step 8: FINAL ASSESSMENT")
        
        if execution_detected:
            print_test_result("Schedule Execution", True, "Schedule was executed by the scheduler")
            
            # Get the latest recommendations to see if one was generated
            final_rec_response = requests.get(f"{BACKEND_URL}/recommendations/{athlete_id}")
            if final_rec_response.status_code == 200:
                final_recommendations = final_rec_response.json()
                
                # Look for recent recommendations
                recent_recommendations = []
                for rec in final_recommendations:
                    generated_at = rec.get('generated_at', '')
                    if generated_at:
                        try:
                            gen_time = datetime.fromisoformat(generated_at.replace('Z', '+00:00'))
                            if (datetime.now(pytz.UTC) - gen_time).total_seconds() < 300:  # Last 5 minutes
                                recent_recommendations.append(rec)
                        except:
                            pass
                
                if recent_recommendations:
                    print("      ✅ Recent recommendations found:")
                    for rec in recent_recommendations[:2]:  # Show first 2
                        print(f"         - {rec.get('title', 'No title')}")
                        print(f"           Generated: {rec.get('generated_at', 'Unknown time')}")
                        print(f"           Content: {rec.get('content', '')[:100]}...")
                
            return True
        else:
            print_test_result("Schedule Execution", False, "Schedule was NOT executed within monitoring window")
            
            print("      🔍 DIAGNOSTIC INFORMATION:")
            
            if not openai_configured:
                print("         - ❌ OpenAI API key not configured (likely cause)")
                print("         - 💡 Configure OpenAI API key in Account Settings")
            else:
                print("         - ✅ OpenAI API key is configured")
                print("         - 💡 Possible scheduler timing or logic issue")
            
            # Check scheduler logs (we can see them in the backend logs)
            print("         - 💡 Check backend logs for scheduler activity")
            print("         - 💡 Scheduler may be running but not executing due to:")
            print("           * Time zone conversion issues")
            print("           * Daily frequency logic (already executed today)")
            print("           * OpenAI API call failures")
            
            return False
        
    except Exception as e:
        print_test_result("Schedule Execution Test", False, f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 STARTING SCHEDULE EXECUTION FLOW TEST")
    print("=" * 80)
    print()
    
    test_passed = test_schedule_execution_with_existing_schedule()
    
    print()
    print("🏁 TESTING COMPLETE")
    print("=" * 80)
    
    if test_passed:
        print("🎉 SCHEDULE EXECUTION FLOW TEST PASSED!")
        print("✅ Scheduler is working correctly")
        sys.exit(0)
    else:
        print("❌ SCHEDULE EXECUTION FLOW TEST FAILED")
        print("⚠️ Scheduler has issues that need to be addressed")
        sys.exit(1)