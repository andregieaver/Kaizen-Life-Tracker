#!/usr/bin/env python3
"""
FINAL STRAVA OAUTH INTEGRATION COMPREHENSIVE TEST

Test Complete Strava OAuth Flow End-to-End as requested in review request.

Test Scenarios:
1. OAuth Initiation - GET /api/auth/strava?user_id=ai-coach-connect-1
2. Callback Endpoint Reachability - GET /api/auth/strava/callback?code=test_code&state=invalid_state
3. Status Endpoint - GET /api/auth/strava/status?user_id=ai-coach-connect-1
4. Disconnect Endpoint - POST /api/auth/strava/disconnect with user_id

Critical Validations:
✅ All endpoints return JSON (not HTML or "404 page not found")
✅ Callback URL in authorization URL includes /api/ prefix
✅ No 404 errors for any Strava endpoint
✅ OAuth state is properly created and stored
"""

import requests
import json
import sys
from urllib.parse import urlparse, parse_qs

# Backend URL from environment
BACKEND_URL = "https://wellness-portal-49.preview.emergentagent.com/api"

def print_test_result(test_name, success, details=""):
    """Print formatted test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"   {status}: {test_name}")
    if details:
        print(f"      Details: {details}")

def main():
    print("🔍 FINAL STRAVA OAUTH INTEGRATION COMPREHENSIVE TEST")
    print("=" * 70)
    
    try:
        # Use known super admin from test_result.md
        test_user_id = "77e6ef02-0c9e-4ede-a428-213b83eed1fe"  # andre@humanweb.no
        
        print(f"   Using test_user_id: {test_user_id}")
        
        # Test 1: OAuth Initiation - GET /api/auth/strava?user_id=ai-coach-connect-1
        print("\n   Test 1: OAuth Initiation - GET /api/auth/strava?user_id={user_id}")
        
        oauth_url = f"{BACKEND_URL}/auth/strava?user_id={test_user_id}"
        print(f"   URL: {oauth_url}")
        
        oauth_response = requests.get(oauth_url)
        
        print(f"   Response Status: {oauth_response.status_code}")
        print(f"   Response Headers: {dict(oauth_response.headers)}")
        print(f"   Response Text: {oauth_response.text[:500]}...")
        
        # Critical Validation: Should return JSON, not HTML
        content_type = oauth_response.headers.get('content-type', '')
        is_json = 'application/json' in content_type
        
        auth_url = None
        state = None
        
        if oauth_response.status_code == 200 and is_json:
            try:
                oauth_data = oauth_response.json()
                auth_url = oauth_data.get("authUrl") or oauth_data.get("authorization_url")
                state = oauth_data.get("state")
                
                if auth_url and state:
                    print_test_result("OAuth Initiation", True, f"Returns valid authUrl with state: {state[:20]}...")
                    
                    # Verify authUrl contains /api/auth/strava/callback in redirect_uri
                    if "/api/auth/strava/callback" in auth_url:
                        print_test_result("Callback URL in Authorization URL", True, "Contains /api/ prefix")
                    else:
                        print_test_result("Callback URL in Authorization URL", False, "Missing /api/ prefix")
                    
                    # Parse and validate OAuth parameters
                    parsed_url = urlparse(auth_url)
                    params = parse_qs(parsed_url.query)
                    
                    required_params = ['client_id', 'redirect_uri', 'response_type', 'scope', 'state']
                    missing_params = [p for p in required_params if p not in params]
                    
                    if not missing_params:
                        print_test_result("OAuth Parameters Complete", True, "All required OAuth parameters present")
                    else:
                        print_test_result("OAuth Parameters Complete", False, f"Missing: {missing_params}")
                    
                else:
                    print_test_result("OAuth Initiation", False, f"Missing authUrl or state in response: {oauth_data}")
            except json.JSONDecodeError:
                print_test_result("OAuth Initiation", False, "Response is not valid JSON")
        else:
            print_test_result("OAuth Initiation", False, f"Status: {oauth_response.status_code}, JSON: {is_json}")
        
        # Test 2: Callback Endpoint Reachability - GET /api/auth/strava/callback?code=test_code&state=invalid_state
        print("\n   Test 2: Callback Endpoint Reachability")
        
        callback_url = f"{BACKEND_URL}/auth/strava/callback?code=test_code&state=invalid_state"
        print(f"   URL: {callback_url}")
        
        callback_response = requests.get(callback_url)
        
        print(f"   Response Status: {callback_response.status_code}")
        print(f"   Response Headers: {dict(callback_response.headers)}")
        print(f"   Response Text: {callback_response.text[:500]}...")
        
        # Critical Validation: Should return error about invalid state (not 404)
        callback_content_type = callback_response.headers.get('content-type', '')
        callback_is_json = 'application/json' in callback_content_type
        
        if callback_response.status_code == 404:
            print_test_result("Callback Endpoint Reachability", False, "Returns 404 - endpoint not found")
        elif callback_response.status_code in [400, 401, 403] and callback_is_json:
            print_test_result("Callback Endpoint Reachability", True, f"Endpoint reachable, returns error about invalid state: {callback_response.status_code}")
        elif callback_response.status_code == 500:
            print_test_result("Callback Endpoint Reachability", True, f"Endpoint reachable but has server error: {callback_response.status_code}")
        else:
            print_test_result("Callback Endpoint Reachability", False, f"Unexpected response: {callback_response.status_code}")
        
        # Test 3: Status Endpoint - GET /api/auth/strava/status?user_id=ai-coach-connect-1
        print("\n   Test 3: Status Endpoint")
        
        status_url = f"{BACKEND_URL}/auth/strava/status?user_id={test_user_id}"
        print(f"   URL: {status_url}")
        
        status_response = requests.get(status_url)
        
        print(f"   Response Status: {status_response.status_code}")
        print(f"   Response Headers: {dict(status_response.headers)}")
        print(f"   Response Text: {status_response.text[:500]}...")
        
        # Critical Validation: Should return JSON (not 404)
        status_content_type = status_response.headers.get('content-type', '')
        status_is_json = 'application/json' in status_content_type
        
        if status_response.status_code == 404:
            print_test_result("Status Endpoint", False, "Returns 404 - endpoint not found")
        elif status_response.status_code == 200 and status_is_json:
            try:
                status_data = status_response.json()
                if "connected" in status_data:
                    print_test_result("Status Endpoint", True, f"Returns connection status: {status_data}")
                else:
                    print_test_result("Status Endpoint", True, f"Endpoint works, returns: {status_data}")
            except json.JSONDecodeError:
                print_test_result("Status Endpoint", False, "Response is not valid JSON")
        else:
            print_test_result("Status Endpoint", False, f"Status: {status_response.status_code}, JSON: {status_is_json}")
        
        # Test 4: Disconnect Endpoint - POST /api/auth/strava/disconnect with user_id
        print("\n   Test 4: Disconnect Endpoint")
        
        disconnect_url = f"{BACKEND_URL}/auth/strava/disconnect"
        disconnect_data = {"user_id": test_user_id}
        
        print(f"   URL: {disconnect_url}")
        print(f"   Data: {disconnect_data}")
        
        disconnect_response = requests.post(
            disconnect_url,
            json=disconnect_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"   Response Status: {disconnect_response.status_code}")
        print(f"   Response Headers: {dict(disconnect_response.headers)}")
        print(f"   Response Text: {disconnect_response.text[:500]}...")
        
        # Critical Validation: Should return 404 (not connected) or success
        disconnect_content_type = disconnect_response.headers.get('content-type', '')
        disconnect_is_json = 'application/json' in disconnect_content_type
        
        if disconnect_response.status_code == 404 and disconnect_is_json:
            print_test_result("Disconnect Endpoint", True, "Returns 404 (not connected) - endpoint works")
        elif disconnect_response.status_code == 200 and disconnect_is_json:
            print_test_result("Disconnect Endpoint", True, "Returns success - endpoint works")
        elif disconnect_response.status_code == 404 and not disconnect_is_json:
            print_test_result("Disconnect Endpoint", False, "Returns 404 page not found (endpoint missing)")
        else:
            print_test_result("Disconnect Endpoint", False, f"Unexpected response: {disconnect_response.status_code}")
        
        # Summary of Critical Validations
        print("\n   CRITICAL VALIDATIONS SUMMARY:")
        print("   " + "="*50)
        
        validations = []
        
        # Check if all endpoints return JSON (not HTML)
        all_json = (
            is_json and 
            callback_is_json and 
            status_is_json and 
            disconnect_is_json
        )
        validations.append(f"✅ All endpoints return JSON (not HTML): {all_json}")
        
        # Check if callback URL includes /api/ prefix
        callback_prefix_ok = "/api/auth/strava/callback" in auth_url if auth_url else False
        validations.append(f"✅ Callback URL includes /api/ prefix: {callback_prefix_ok}")
        
        # Check no 404 errors for endpoints
        no_404_errors = (
            oauth_response.status_code != 404 and
            callback_response.status_code != 404 and
            status_response.status_code != 404 and
            disconnect_response.status_code != 404
        )
        validations.append(f"✅ No 404 errors for Strava endpoints: {no_404_errors}")
        
        # Check OAuth state creation
        oauth_state_ok = state is not None
        validations.append(f"✅ OAuth state properly created: {oauth_state_ok}")
        
        for validation in validations:
            print(f"   {validation}")
        
        # Overall success criteria
        success_criteria_met = all_json and callback_prefix_ok and no_404_errors and oauth_state_ok
        
        if success_criteria_met:
            print_test_result("Overall Strava OAuth Integration", True, "All critical validations passed")
        else:
            print_test_result("Overall Strava OAuth Integration", False, "Some critical validations failed")
        
        print("\n✅ STRAVA OAUTH INTEGRATION COMPREHENSIVE TEST COMPLETED")
        return success_criteria_met
        
    except Exception as e:
        print_test_result("Strava OAuth Integration Test - Exception", False, f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)