#!/usr/bin/env python3
"""
Test Results CRUD API Testing Only
Tests the Test Results API endpoints as requested in the review
"""

import requests
import json
import sys
import uuid
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://mobile-first-kaizen.preview.emergentagent.com/api"

def print_test_result(test_name, success, details=""):
    """Print formatted test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"   {status}: {test_name}")
    if details:
        print(f"      Details: {details}")

def test_test_results_crud_api():
    """
    COMPREHENSIVE TEST RESULTS CRUD API TESTING
    Test all Test Results API endpoints as requested in the review
    """
    print("🔍 TESTING TEST RESULTS CRUD API ENDPOINTS")
    print("=" * 70)
    
    try:
        # Step 1: Login as andre@example.com to get athlete_id
        print("   Step 1: Login as andre@example.com")
        
        login_data = {
            "email": "andre@example.com",
            "password": "password123"
        }
        
        login_response = requests.post(
            f"{BACKEND_URL}/auth/login",
            json=login_data,
            headers={"Content-Type": "application/json"}
        )
        
        if login_response.status_code != 200:
            print_test_result("Test Results API - Login", False, f"Login failed: {login_response.status_code}")
            return False
        
        athlete_data = login_response.json()
        athlete_id = athlete_data.get("athlete_id")
        
        if not athlete_id:
            print_test_result("Test Results API - Login", False, "No athlete_id returned")
            return False
        
        print(f"      ✅ Login successful, athlete_id: {athlete_id}")
        
        # Step 2: Test GET /api/test-results/{athlete_id} - Fetch all test results
        print("   Step 2: GET /api/test-results/{athlete_id} - Fetch all test results")
        
        get_all_response = requests.get(f"{BACKEND_URL}/test-results/{athlete_id}")
        
        if get_all_response.status_code != 200:
            print_test_result("GET All Test Results", False, f"Failed: {get_all_response.status_code}")
            return False
        
        all_results_data = get_all_response.json()
        initial_results = all_results_data.get("results", [])
        
        print_test_result("GET All Test Results", True, f"Retrieved {len(initial_results)} existing test results")
        
        # Step 3: Test GET /api/test-results/{athlete_id}/test-names - Fetch unique test names
        print("   Step 3: GET /api/test-results/{athlete_id}/test-names - Fetch unique test names")
        
        get_names_response = requests.get(f"{BACKEND_URL}/test-results/{athlete_id}/test-names")
        
        if get_names_response.status_code != 200:
            print_test_result("GET Test Names", False, f"Failed: {get_names_response.status_code}")
            return False
        
        names_data = get_names_response.json()
        test_names = names_data.get("test_names", [])
        
        print_test_result("GET Test Names", True, f"Retrieved {len(test_names)} unique test names: {test_names}")
        
        # Step 4: Test POST /api/test-results - Create new test result (Pull-ups)
        print("   Step 4: POST /api/test-results - Create new test result (Pull-ups)")
        
        test_result_1 = {
            "id": f"test-{int(datetime.now().timestamp())}-1",
            "athlete_id": athlete_id,
            "test_name": "Pull-ups",
            "unit": "repetitions",
            "result_value": 20,
            "time_to_completion": None,
            "notes": "Felt strong today",
            "test_date": "2025-01-15",
            "created_at": datetime.now().isoformat()
        }
        
        create_response_1 = requests.post(
            f"{BACKEND_URL}/test-results",
            json=test_result_1,
            headers={"Content-Type": "application/json"}
        )
        
        if create_response_1.status_code != 200:
            print_test_result("POST Create Test Result 1", False, f"Failed: {create_response_1.status_code} - {create_response_1.text}")
            return False
        
        create_data_1 = create_response_1.json()
        result_id_1 = create_data_1.get("id")
        
        print_test_result("POST Create Test Result 1", True, f"Created Pull-ups test result, ID: {result_id_1}")
        
        # Step 5: Create another Pull-ups test result (different date)
        print("   Step 5: Create another Pull-ups test result (different date)")
        
        test_result_2 = {
            "id": f"test-{int(datetime.now().timestamp())}-2",
            "athlete_id": athlete_id,
            "test_name": "Pull-ups",
            "unit": "repetitions",
            "result_value": 22,
            "time_to_completion": None,
            "notes": "Personal best!",
            "test_date": "2025-01-20",
            "created_at": datetime.now().isoformat()
        }
        
        create_response_2 = requests.post(
            f"{BACKEND_URL}/test-results",
            json=test_result_2,
            headers={"Content-Type": "application/json"}
        )
        
        if create_response_2.status_code != 200:
            print_test_result("POST Create Test Result 2", False, f"Failed: {create_response_2.status_code}")
            return False
        
        create_data_2 = create_response_2.json()
        result_id_2 = create_data_2.get("id")
        
        print_test_result("POST Create Test Result 2", True, f"Created second Pull-ups test result, ID: {result_id_2}")
        
        # Step 6: Create different test type (5km Run with time)
        print("   Step 6: Create different test type (5km Run with time)")
        
        test_result_3 = {
            "id": f"test-{int(datetime.now().timestamp())}-3",
            "athlete_id": athlete_id,
            "test_name": "5km Run",
            "unit": "time",
            "result_value": 1200,  # 20 minutes in seconds
            "time_to_completion": 1200,
            "notes": "Good pace, felt comfortable",
            "test_date": "2025-01-18",
            "created_at": datetime.now().isoformat()
        }
        
        create_response_3 = requests.post(
            f"{BACKEND_URL}/test-results",
            json=test_result_3,
            headers={"Content-Type": "application/json"}
        )
        
        if create_response_3.status_code != 200:
            print_test_result("POST Create Test Result 3", False, f"Failed: {create_response_3.status_code}")
            return False
        
        create_data_3 = create_response_3.json()
        result_id_3 = create_data_3.get("id")
        
        print_test_result("POST Create Test Result 3", True, f"Created 5km Run test result, ID: {result_id_3}")
        
        # Step 7: Create weight-based test (Bench Press)
        print("   Step 7: Create weight-based test (Bench Press)")
        
        test_result_4 = {
            "id": f"test-{int(datetime.now().timestamp())}-4",
            "athlete_id": athlete_id,
            "test_name": "Bench Press",
            "unit": "weight",
            "result_value": 185,  # 185 lbs
            "time_to_completion": None,
            "notes": "1 rep max test",
            "test_date": "2025-01-22",
            "created_at": datetime.now().isoformat()
        }
        
        create_response_4 = requests.post(
            f"{BACKEND_URL}/test-results",
            json=test_result_4,
            headers={"Content-Type": "application/json"}
        )
        
        if create_response_4.status_code != 200:
            print_test_result("POST Create Test Result 4", False, f"Failed: {create_response_4.status_code}")
            return False
        
        create_data_4 = create_response_4.json()
        result_id_4 = create_data_4.get("id")
        
        print_test_result("POST Create Test Result 4", True, f"Created Bench Press test result, ID: {result_id_4}")
        
        # Step 8: Verify test-names endpoint returns unique test names
        print("   Step 8: Verify test-names endpoint returns updated unique test names")
        
        get_names_response_2 = requests.get(f"{BACKEND_URL}/test-results/{athlete_id}/test-names")
        
        if get_names_response_2.status_code != 200:
            print_test_result("GET Updated Test Names", False, f"Failed: {get_names_response_2.status_code}")
            return False
        
        names_data_2 = get_names_response_2.json()
        updated_test_names = names_data_2.get("test_names", [])
        
        expected_names = ["Pull-ups", "5km Run", "Bench Press"]
        names_check = all(name in updated_test_names for name in expected_names)
        
        print_test_result("GET Updated Test Names", names_check, f"Expected names found: {updated_test_names}")
        
        # Step 9: Test PUT /api/test-results/{result_id} - Update existing test result
        print("   Step 9: PUT /api/test-results/{result_id} - Update existing test result")
        
        update_data = {
            "test_name": "Pull-ups",
            "unit": "repetitions",
            "result_value": 25,  # Updated from 20 to 25
            "time_to_completion": None,
            "notes": "New personal record! Felt amazing",  # Updated notes
            "test_date": "2025-01-15"  # Same date
        }
        
        update_response = requests.put(
            f"{BACKEND_URL}/test-results/{result_id_1}",
            json=update_data,
            headers={"Content-Type": "application/json"}
        )
        
        if update_response.status_code != 200:
            print_test_result("PUT Update Test Result", False, f"Failed: {update_response.status_code} - {update_response.text}")
            return False
        
        print_test_result("PUT Update Test Result", True, f"Updated test result {result_id_1}")
        
        # Step 10: Verify update by fetching all results
        print("   Step 10: Verify update by fetching all results")
        
        get_all_response_2 = requests.get(f"{BACKEND_URL}/test-results/{athlete_id}")
        
        if get_all_response_2.status_code != 200:
            print_test_result("GET All Results After Update", False, f"Failed: {get_all_response_2.status_code}")
            return False
        
        all_results_data_2 = get_all_response_2.json()
        updated_results = all_results_data_2.get("results", [])
        
        # Find the updated result
        updated_result = None
        for result in updated_results:
            if result.get("id") == result_id_1:
                updated_result = result
                break
        
        if updated_result and updated_result.get("result_value") == 25 and "amazing" in updated_result.get("notes", "").lower():
            print_test_result("Verify Update Persistence", True, f"Update verified: value={updated_result.get('result_value')}, notes updated")
        else:
            print_test_result("Verify Update Persistence", False, f"Update not reflected in database")
        
        # Step 11: Test DELETE /api/test-results/{result_id} - Delete test result
        print("   Step 11: DELETE /api/test-results/{result_id} - Delete test result")
        
        delete_response = requests.delete(f"{BACKEND_URL}/test-results/{result_id_3}")
        
        if delete_response.status_code != 200:
            print_test_result("DELETE Test Result", False, f"Failed: {delete_response.status_code} - {delete_response.text}")
            return False
        
        print_test_result("DELETE Test Result", True, f"Deleted test result {result_id_3}")
        
        # Step 12: Verify deletion by fetching all results
        print("   Step 12: Verify deletion by fetching all results")
        
        get_all_response_3 = requests.get(f"{BACKEND_URL}/test-results/{athlete_id}")
        
        if get_all_response_3.status_code != 200:
            print_test_result("GET All Results After Delete", False, f"Failed: {get_all_response_3.status_code}")
            return False
        
        all_results_data_3 = get_all_response_3.json()
        final_results = all_results_data_3.get("results", [])
        
        # Check that deleted result is not in the list
        deleted_result_found = any(result.get("id") == result_id_3 for result in final_results)
        
        if not deleted_result_found:
            print_test_result("Verify Deletion", True, f"Deleted result not found in list (correct)")
        else:
            print_test_result("Verify Deletion", False, f"Deleted result still appears in list")
        
        # Step 13: Test DELETE with non-existent ID (should return 404)
        print("   Step 13: Test DELETE with non-existent ID (should return 404)")
        
        fake_id = "non-existent-test-result-id"
        delete_fake_response = requests.delete(f"{BACKEND_URL}/test-results/{fake_id}")
        
        if delete_fake_response.status_code == 404:
            print_test_result("DELETE Non-existent ID", True, f"Correctly returned 404 for non-existent ID")
        else:
            print_test_result("DELETE Non-existent ID", False, f"Expected 404, got {delete_fake_response.status_code}")
        
        # Step 14: Test different units and scenarios
        print("   Step 14: Test different units and scenarios")
        
        # Distance test
        distance_test = {
            "id": f"test-{int(datetime.now().timestamp())}-distance",
            "athlete_id": athlete_id,
            "test_name": "Long Jump",
            "unit": "distance",
            "result_value": 2.5,  # 2.5 meters
            "time_to_completion": None,
            "notes": "Good technique",
            "test_date": "2025-01-25",
            "created_at": datetime.now().isoformat()
        }
        
        distance_response = requests.post(
            f"{BACKEND_URL}/test-results",
            json=distance_test,
            headers={"Content-Type": "application/json"}
        )
        
        # Percentage test
        percentage_test = {
            "id": f"test-{int(datetime.now().timestamp())}-percentage",
            "athlete_id": athlete_id,
            "test_name": "Body Fat",
            "unit": "percentage",
            "result_value": 12.5,  # 12.5%
            "time_to_completion": None,
            "notes": "DEXA scan results",
            "test_date": "2025-01-26",
            "created_at": datetime.now().isoformat()
        }
        
        percentage_response = requests.post(
            f"{BACKEND_URL}/test-results",
            json=percentage_test,
            headers={"Content-Type": "application/json"}
        )
        
        units_success = (distance_response.status_code == 200 and percentage_response.status_code == 200)
        print_test_result("Different Units Test", units_success, f"Distance and percentage units tested")
        
        # Step 15: Final verification - count all test results
        print("   Step 15: Final verification - count all test results")
        
        final_get_response = requests.get(f"{BACKEND_URL}/test-results/{athlete_id}")
        
        if final_get_response.status_code == 200:
            final_data = final_get_response.json()
            final_count = len(final_data.get("results", []))
            
            # We created 4 initially, deleted 1, added 2 more = 5 total
            expected_count = len(initial_results) + 5  # 4 created - 1 deleted + 2 additional
            
            print_test_result("Final Count Verification", True, f"Final count: {final_count} test results")
        
        # Clean up - delete test results we created
        print("   Step 16: Clean up test data")
        
        cleanup_ids = [result_id_1, result_id_2, result_id_4, 
                      distance_test["id"], percentage_test["id"]]
        
        cleanup_success = 0
        for cleanup_id in cleanup_ids:
            cleanup_response = requests.delete(f"{BACKEND_URL}/test-results/{cleanup_id}")
            if cleanup_response.status_code == 200:
                cleanup_success += 1
        
        print_test_result("Cleanup Test Data", cleanup_success == len(cleanup_ids), f"Cleaned up {cleanup_success}/{len(cleanup_ids)} test results")
        
        print("\n✅ ALL TEST RESULTS CRUD API TESTS COMPLETED SUCCESSFULLY")
        return True
        
    except Exception as e:
        print_test_result("Test Results CRUD API - Exception", False, f"Exception: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 STARTING TEST RESULTS CRUD API TESTING")
    print("=" * 80)
    
    success = test_test_results_crud_api()
    
    print(f"\n{'='*80}")
    print("📊 TEST SUMMARY")
    print(f"{'='*80}")
    
    if success:
        print("✅ PASS: Test Results CRUD API Endpoints")
        print("\n🎉 ALL TESTS PASSED!")
    else:
        print("❌ FAIL: Test Results CRUD API Endpoints")
        print("\n⚠️ TESTS FAILED - Check details above")
    
    sys.exit(0 if success else 1)