#!/usr/bin/env python3
"""
Strava Authorization Callback Domain Fix Testing
Tests that the Strava authorization URL uses the correct production callback domain
"""

import requests
import json
import sys
from urllib.parse import urlparse, parse_qs

# Backend URL from environment
BACKEND_URL = "https://trainsmart-ui.preview.emergentagent.com/api"

def print_test_result(test_name, success, details=""):
    """Print formatted test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"   {status}: {test_name}")
    if details:
        print(f"      Details: {details}")

def test_strava_authorization_callback_domain():
    """
    TEST STRAVA AUTHORIZATION URL CALLBACK DOMAIN FIX
    
    Review Request:
    User reported that after authorizing on Strava, they were redirected to:
    http://localhost:8001/api/auth/strava/callback?state=...&code=...
    
    This is wrong - it should use the production domain from callbackDomain in settings.
    
    Fix Applied:
    Updated StravaService.get_authorization_url to use callbackDomain from system_settings.
    
    Test Scenario:
    1. Generate Authorization URL: GET /api/auth/strava?user_id=77e6ef02-0c9e-4ede-a428-213b83eed1fe
    2. Verify Redirect URI: Parse the returned authorization URL and extract redirect_uri parameter
    3. CRITICAL CHECK: redirect_uri should be https://trainsmart-ui.preview.emergentagent.com/api/auth/strava/callback
       NOT http://localhost:8001/api/auth/strava/callback
    
    Success Criteria:
    - Authorization URL generated successfully
    - redirect_uri uses https (not http)
    - redirect_uri uses trainsmart-ui.preview.emergentagent.com (not localhost:8001)
    - URL is properly formatted and ready for user to click
    """
    print("🔍 TESTING STRAVA AUTHORIZATION CALLBACK DOMAIN FIX")
    print("=" * 70)
    
    try:
        # Use super admin ID from test_result.md
        user_id = "77e6ef02-0c9e-4ede-a428-213b83eed1fe"  # andre@humanweb.no
        expected_callback_domain = "trainsmart-ui.preview.emergentagent.com"
        expected_redirect_uri = f"https://{expected_callback_domain}/api/auth/strava/callback"
        
        print(f"   Using user_id: {user_id}")
        print(f"   Expected callback domain: {expected_callback_domain}")
        print(f"   Expected redirect_uri: {expected_redirect_uri}")
        print()
        
        # Step 1: Generate Authorization URL
        print("   Step 1: Generate Authorization URL - GET /api/auth/strava")
        
        auth_url = f"{BACKEND_URL}/auth/strava?user_id={user_id}"
        print(f"   Request URL: {auth_url}")
        
        auth_response = requests.get(auth_url)
        
        print(f"   Response Status: {auth_response.status_code}")
        
        if auth_response.status_code != 200:
            print_test_result("Generate Authorization URL", False, 
                            f"Failed with status {auth_response.status_code}: {auth_response.text}")
            return False
        
        auth_data = auth_response.json()
        print(f"   Response Data: {json.dumps(auth_data, indent=2)}")
        
        # Extract authorization URL
        authorization_url = auth_data.get('authUrl')
        state = auth_data.get('state')
        
        if not authorization_url:
            print_test_result("Generate Authorization URL", False, "No authUrl in response")
            return False
        
        if not state:
            print_test_result("Generate Authorization URL", False, "No state in response")
            return False
        
        print_test_result("Generate Authorization URL", True, 
                         f"Authorization URL generated successfully")
        print(f"      State: {state}")
        print()
        
        # Step 2: Parse Authorization URL and Extract redirect_uri
        print("   Step 2: Parse Authorization URL and Extract redirect_uri")
        
        print(f"   Full Authorization URL:")
        print(f"   {authorization_url}")
        print()
        
        # Parse URL to extract redirect_uri parameter
        parsed_url = urlparse(authorization_url)
        query_params = parse_qs(parsed_url.query)
        
        print(f"   Parsed URL Components:")
        print(f"   - Scheme: {parsed_url.scheme}")
        print(f"   - Netloc: {parsed_url.netloc}")
        print(f"   - Path: {parsed_url.path}")
        print()
        
        print(f"   Query Parameters:")
        for key, value in query_params.items():
            print(f"   - {key}: {value[0] if value else 'None'}")
        print()
        
        # Extract redirect_uri
        redirect_uri = query_params.get('redirect_uri', [None])[0]
        
        if not redirect_uri:
            print_test_result("Extract redirect_uri", False, "redirect_uri parameter not found in URL")
            return False
        
        print_test_result("Extract redirect_uri", True, f"redirect_uri: {redirect_uri}")
        print()
        
        # Step 3: CRITICAL CHECK - Verify redirect_uri
        print("   Step 3: CRITICAL CHECK - Verify redirect_uri")
        
        # Check 1: Uses HTTPS (not HTTP)
        uses_https = redirect_uri.startswith('https://')
        if uses_https:
            print_test_result("Check 1: Uses HTTPS", True, "redirect_uri uses https://")
        else:
            print_test_result("Check 1: Uses HTTPS", False, 
                            f"redirect_uri uses {redirect_uri.split('://')[0]}:// instead of https://")
        
        # Check 2: Uses production domain (not localhost)
        uses_production = 'localhost' not in redirect_uri and '127.0.0.1' not in redirect_uri
        if uses_production:
            print_test_result("Check 2: Production Domain", True, 
                            "redirect_uri does not use localhost")
        else:
            print_test_result("Check 2: Production Domain", False, 
                            f"redirect_uri uses localhost instead of production domain")
        
        # Check 3: Uses expected callback domain
        has_expected_domain = expected_callback_domain in redirect_uri
        if has_expected_domain:
            print_test_result("Check 3: Expected Domain", True, 
                            f"redirect_uri uses expected domain: {expected_callback_domain}")
        else:
            print_test_result("Check 3: Expected Domain", False, 
                            f"redirect_uri does not use expected domain: {expected_callback_domain}")
        
        # Check 4: Exact match with expected redirect_uri
        exact_match = redirect_uri == expected_redirect_uri
        if exact_match:
            print_test_result("Check 4: Exact Match", True, 
                            f"redirect_uri matches expected: {expected_redirect_uri}")
        else:
            print_test_result("Check 4: Exact Match", False, 
                            f"Expected: {expected_redirect_uri}\nActual: {redirect_uri}")
        
        # Check 5: Verify other required OAuth parameters
        print()
        print("   Step 4: Verify Other OAuth Parameters")
        
        required_params = ['client_id', 'response_type', 'scope', 'state']
        missing_params = []
        
        for param in required_params:
            if param in query_params:
                print_test_result(f"Parameter: {param}", True, f"Value: {query_params[param][0]}")
            else:
                missing_params.append(param)
                print_test_result(f"Parameter: {param}", False, "Missing")
        
        if missing_params:
            print_test_result("OAuth Parameters Complete", False, 
                            f"Missing parameters: {', '.join(missing_params)}")
        else:
            print_test_result("OAuth Parameters Complete", True, 
                            "All required OAuth parameters present")
        
        # Step 5: Summary
        print()
        print("   Step 5: Test Summary")
        print("   " + "="*50)
        
        all_checks_passed = (
            uses_https and
            uses_production and
            has_expected_domain and
            exact_match and
            not missing_params
        )
        
        if all_checks_passed:
            print("   ✅ ALL CHECKS PASSED")
            print(f"   ✅ Authorization URL uses correct callback domain")
            print(f"   ✅ redirect_uri: {redirect_uri}")
            print(f"   ✅ User will be redirected to production domain after Strava authorization")
            print_test_result("Strava Authorization Callback Domain Fix", True, 
                            "Fix verified - callback domain is correct")
        else:
            print("   ❌ SOME CHECKS FAILED")
            print(f"   ❌ redirect_uri: {redirect_uri}")
            print(f"   ❌ Expected: {expected_redirect_uri}")
            print_test_result("Strava Authorization Callback Domain Fix", False, 
                            "Fix not working correctly - callback domain is wrong")
        
        print()
        print("✅ STRAVA AUTHORIZATION CALLBACK DOMAIN TEST COMPLETED")
        return all_checks_passed
        
    except Exception as e:
        print_test_result("Strava Authorization Test - Exception", False, f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("🚀 STARTING STRAVA AUTHORIZATION CALLBACK DOMAIN TEST")
    print("=" * 70)
    print()
    
    # Run the Strava authorization callback domain test
    result = test_strava_authorization_callback_domain()
    
    print()
    print("=" * 70)
    if result:
        print("🎉 TEST PASSED - STRAVA CALLBACK DOMAIN FIX VERIFIED")
    else:
        print("❌ TEST FAILED - STRAVA CALLBACK DOMAIN FIX NOT WORKING")
    print("=" * 70)
    
    sys.exit(0 if result else 1)
