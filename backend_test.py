#!/usr/bin/env python3
"""
Backend API Testing for Schedule CRUD Operations
Tests the running coach application's schedule management functionality
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://fit-buddy-47.preview.emergentagent.com/api"

# Test data
TEST_ATHLETE_ID = "test-athlete-123"
TEST_SCHEDULE_ID = "schedule-test-001"

def print_test_result(test_name, success, details=""):
    """Print formatted test results"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   Details: {details}")
    print()

def test_get_schedules_empty():
    """Test GET /api/schedules/{athlete_id} - should return empty array initially"""
    print("🔍 Testing GET /api/schedules/{athlete_id} (empty list)")
    
    try:
        response = requests.get(f"{BACKEND_URL}/schedules/{TEST_ATHLETE_ID}")
        
        if response.status_code == 200:
            schedules = response.json()
            if isinstance(schedules, list):
                print_test_result("GET schedules (empty)", True, f"Returned {len(schedules)} schedules")
                return True
            else:
                print_test_result("GET schedules (empty)", False, f"Expected list, got {type(schedules)}")
                return False
        else:
            print_test_result("GET schedules (empty)", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("GET schedules (empty)", False, f"Exception: {str(e)}")
        return False

def test_create_schedule():
    """Test POST /api/schedules - create new schedule"""
    print("🔍 Testing POST /api/schedules (create schedule)")
    
    schedule_data = {
        "id": TEST_SCHEDULE_ID,
        "athlete_id": TEST_ATHLETE_ID,
        "name": "Morning Recovery Review",
        "prompt": "Review yesterday's workout and sleep data",
        "frequency": "daily",
        "time": "08:00",
        "days": [],
        "active": True
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/schedules",
            json=schedule_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            created_schedule = response.json()
            
            # Verify all fields are present and correct
            success = True
            details = []
            
            for key, expected_value in schedule_data.items():
                if key in created_schedule:
                    if created_schedule[key] == expected_value:
                        details.append(f"{key}: ✓")
                    else:
                        details.append(f"{key}: ✗ (expected {expected_value}, got {created_schedule[key]})")
                        success = False
                else:
                    details.append(f"{key}: ✗ (missing)")
                    success = False
            
            # Check for additional fields that should be present
            if "created_at" in created_schedule:
                details.append("created_at: ✓")
            else:
                details.append("created_at: ✗ (missing)")
                success = False
                
            print_test_result("POST create schedule", success, "; ".join(details))
            return success, created_schedule
        else:
            print_test_result("POST create schedule", False, f"Status: {response.status_code}, Response: {response.text}")
            return False, None
            
    except Exception as e:
        print_test_result("POST create schedule", False, f"Exception: {str(e)}")
        return False, None

def test_get_schedules_with_data():
    """Test GET /api/schedules/{athlete_id} - should return the created schedule"""
    print("🔍 Testing GET /api/schedules/{athlete_id} (with data)")
    
    try:
        response = requests.get(f"{BACKEND_URL}/schedules/{TEST_ATHLETE_ID}")
        
        if response.status_code == 200:
            schedules = response.json()
            
            if isinstance(schedules, list) and len(schedules) > 0:
                # Find our test schedule
                test_schedule = None
                for schedule in schedules:
                    if schedule.get("id") == TEST_SCHEDULE_ID:
                        test_schedule = schedule
                        break
                
                if test_schedule:
                    print_test_result("GET schedules (with data)", True, f"Found test schedule: {test_schedule['name']}")
                    return True, test_schedule
                else:
                    print_test_result("GET schedules (with data)", False, f"Test schedule not found in {len(schedules)} schedules")
                    return False, None
            else:
                print_test_result("GET schedules (with data)", False, f"Expected non-empty list, got {len(schedules) if isinstance(schedules, list) else 'non-list'}")
                return False, None
        else:
            print_test_result("GET schedules (with data)", False, f"Status: {response.status_code}, Response: {response.text}")
            return False, None
            
    except Exception as e:
        print_test_result("GET schedules (with data)", False, f"Exception: {str(e)}")
        return False, None

def test_update_schedule():
    """Test PUT /api/schedules/{schedule_id} - update existing schedule"""
    print("🔍 Testing PUT /api/schedules/{schedule_id} (update schedule)")
    
    update_data = {
        "name": "Updated Morning Review",
        "time": "09:00"
    }
    
    try:
        response = requests.put(
            f"{BACKEND_URL}/schedules/{TEST_SCHEDULE_ID}",
            json=update_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            updated_schedule = response.json()
            
            # Verify the updates were applied
            success = True
            details = []
            
            if updated_schedule.get("name") == update_data["name"]:
                details.append("name updated: ✓")
            else:
                details.append(f"name update: ✗ (expected {update_data['name']}, got {updated_schedule.get('name')})")
                success = False
                
            if updated_schedule.get("time") == update_data["time"]:
                details.append("time updated: ✓")
            else:
                details.append(f"time update: ✗ (expected {update_data['time']}, got {updated_schedule.get('time')})")
                success = False
            
            # Verify other fields remain unchanged
            if updated_schedule.get("athlete_id") == TEST_ATHLETE_ID:
                details.append("athlete_id preserved: ✓")
            else:
                details.append("athlete_id preserved: ✗")
                success = False
                
            print_test_result("PUT update schedule", success, "; ".join(details))
            return success, updated_schedule
        else:
            print_test_result("PUT update schedule", False, f"Status: {response.status_code}, Response: {response.text}")
            return False, None
            
    except Exception as e:
        print_test_result("PUT update schedule", False, f"Exception: {str(e)}")
        return False, None

def test_verify_update_in_list():
    """Verify the update is reflected in the GET list"""
    print("🔍 Testing GET /api/schedules/{athlete_id} (verify update)")
    
    try:
        response = requests.get(f"{BACKEND_URL}/schedules/{TEST_ATHLETE_ID}")
        
        if response.status_code == 200:
            schedules = response.json()
            
            # Find our test schedule
            test_schedule = None
            for schedule in schedules:
                if schedule.get("id") == TEST_SCHEDULE_ID:
                    test_schedule = schedule
                    break
            
            if test_schedule:
                success = True
                details = []
                
                if test_schedule.get("name") == "Updated Morning Review":
                    details.append("name in list: ✓")
                else:
                    details.append(f"name in list: ✗ (got {test_schedule.get('name')})")
                    success = False
                    
                if test_schedule.get("time") == "09:00":
                    details.append("time in list: ✓")
                else:
                    details.append(f"time in list: ✗ (got {test_schedule.get('time')})")
                    success = False
                
                print_test_result("GET verify update", success, "; ".join(details))
                return success
            else:
                print_test_result("GET verify update", False, "Test schedule not found in list")
                return False
        else:
            print_test_result("GET verify update", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("GET verify update", False, f"Exception: {str(e)}")
        return False

def test_delete_schedule():
    """Test DELETE /api/schedules/{schedule_id} - soft delete schedule"""
    print("🔍 Testing DELETE /api/schedules/{schedule_id} (soft delete)")
    
    try:
        response = requests.delete(f"{BACKEND_URL}/schedules/{TEST_SCHEDULE_ID}")
        
        if response.status_code == 200:
            result = response.json()
            
            if "message" in result and "success" in result["message"].lower():
                print_test_result("DELETE schedule", True, f"Message: {result['message']}")
                return True
            else:
                print_test_result("DELETE schedule", False, f"Unexpected response: {result}")
                return False
        else:
            print_test_result("DELETE schedule", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("DELETE schedule", False, f"Exception: {str(e)}")
        return False

def test_verify_soft_delete():
    """Verify the schedule no longer appears in GET list (soft delete)"""
    print("🔍 Testing GET /api/schedules/{athlete_id} (verify soft delete)")
    
    try:
        response = requests.get(f"{BACKEND_URL}/schedules/{TEST_ATHLETE_ID}")
        
        if response.status_code == 200:
            schedules = response.json()
            
            # Check that our test schedule is not in the active list
            test_schedule_found = False
            for schedule in schedules:
                if schedule.get("id") == TEST_SCHEDULE_ID:
                    test_schedule_found = True
                    break
            
            if not test_schedule_found:
                print_test_result("GET verify soft delete", True, f"Schedule not in active list ({len(schedules)} schedules)")
                return True
            else:
                print_test_result("GET verify soft delete", False, "Schedule still appears in active list")
                return False
        else:
            print_test_result("GET verify soft delete", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("GET verify soft delete", False, f"Exception: {str(e)}")
        return False

def run_all_tests():
    """Run all schedule CRUD tests in sequence"""
    print("🚀 Starting Schedule CRUD API Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Athlete ID: {TEST_ATHLETE_ID}")
    print(f"Test Schedule ID: {TEST_SCHEDULE_ID}")
    print("=" * 60)
    
    test_results = []
    
    # Test 1: GET empty schedules list
    result = test_get_schedules_empty()
    test_results.append(("GET schedules (empty)", result))
    
    # Test 2: POST create schedule
    result, created_schedule = test_create_schedule()
    test_results.append(("POST create schedule", result))
    
    if not result:
        print("❌ Cannot continue tests - schedule creation failed")
        return test_results
    
    # Test 3: GET schedules with data
    result, schedule_data = test_get_schedules_with_data()
    test_results.append(("GET schedules (with data)", result))
    
    # Test 4: PUT update schedule
    result, updated_schedule = test_update_schedule()
    test_results.append(("PUT update schedule", result))
    
    # Test 5: Verify update in list
    result = test_verify_update_in_list()
    test_results.append(("GET verify update", result))
    
    # Test 6: DELETE schedule
    result = test_delete_schedule()
    test_results.append(("DELETE schedule", result))
    
    # Test 7: Verify soft delete
    result = test_verify_soft_delete()
    test_results.append(("GET verify soft delete", result))
    
    # Summary
    print("=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for test_name, success in test_results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if success:
            passed += 1
        else:
            failed += 1
    
    print("=" * 60)
    print(f"Total Tests: {len(test_results)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Success Rate: {(passed/len(test_results)*100):.1f}%")
    
    return test_results

if __name__ == "__main__":
    test_results = run_all_tests()
    
    # Exit with error code if any tests failed
    failed_count = sum(1 for _, success in test_results if not success)
    sys.exit(failed_count)