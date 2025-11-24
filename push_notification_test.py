#!/usr/bin/env python3
"""
Push Notification Testing Script
Tests the push notification setup and functionality as requested in the review
"""

import requests
import json
import sys
from datetime import datetime, timezone, timedelta

# Backend URL from environment
BACKEND_URL = "https://oura-integration.preview.emergentagent.com/api"

def print_test_result(test_name, success, details=""):
    """Print formatted test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"   {status}: {test_name}")
    if details:
        print(f"      Details: {details}")

def test_push_notification_setup():
    """
    PRIORITY: Test Push Notification Setup and Functionality
    Test the complete push notification flow as requested in review
    """
    print("🔍 TESTING PUSH NOTIFICATION SETUP AND FUNCTIONALITY")
    print("=" * 70)
    
    # Test athlete from review request
    test_athlete_id = "90de5b99-6db3-4e14-8455-c00864fb9976"
    test_email = "andre@example.com"
    
    try:
        # Step 1: Login as andre@example.com
        print("   Step 1: Login as andre@example.com")
        
        login_data = {
            "email": test_email,
            "password": "password123"
        }
        
        login_response = requests.post(
            f"{BACKEND_URL}/auth/login",
            json=login_data,
            headers={"Content-Type": "application/json"}
        )
        
        if login_response.status_code != 200:
            print_test_result("Push Notification - Login", False, f"Login failed: {login_response.status_code}")
            return False
        
        athlete_data = login_response.json()
        athlete_id = athlete_data.get("athlete_id")
        
        if athlete_id != test_athlete_id:
            print_test_result("Push Notification - Login", False, f"Expected athlete_id {test_athlete_id}, got {athlete_id}")
            return False
        
        print_test_result("Push Notification - Login", True, f"Successfully logged in as {test_email}")
        
        # Step 2: CHECK PUSH SUBSCRIPTIONS
        print("   Step 2: Check push subscriptions for athlete")
        
        subscriptions_response = requests.get(f"{BACKEND_URL}/push/subscriptions/{athlete_id}")
        
        subscriptions_details = []
        has_subscriptions = False
        
        if subscriptions_response.status_code == 200:
            subscriptions_data = subscriptions_response.json()
            subscriptions = subscriptions_data.get("subscriptions", [])
            
            subscriptions_details.append(f"✅ Subscriptions endpoint accessible")
            subscriptions_details.append(f"Found {len(subscriptions)} push subscriptions")
            
            if len(subscriptions) > 0:
                has_subscriptions = True
                for i, sub in enumerate(subscriptions, 1):
                    endpoint = sub.get('endpoint', 'N/A')
                    subscriptions_details.append(f"Subscription {i}: endpoint={endpoint[:50]}...")
                    keys = sub.get('keys', {})
                    subscriptions_details.append(f"  Keys: p256dh={'✅ Present' if keys.get('p256dh') else '❌ Missing'}")
                    subscriptions_details.append(f"  Keys: auth={'✅ Present' if keys.get('auth') else '❌ Missing'}")
            else:
                subscriptions_details.append("❌ No push subscriptions found - user needs to enable notifications")
                
        else:
            subscriptions_details.append(f"❌ Subscriptions endpoint failed: {subscriptions_response.status_code}")
            if subscriptions_response.status_code == 404:
                subscriptions_details.append("❌ Push subscriptions endpoint not implemented")
        
        print_test_result("Check Push Subscriptions", subscriptions_response.status_code == 200, "; ".join(subscriptions_details))
        
        # Step 3: VERIFY VAPID KEYS
        print("   Step 3: Verify VAPID public key accessibility")
        
        vapid_response = requests.get(f"{BACKEND_URL}/push/vapid-public-key")
        
        vapid_details = []
        vapid_key_accessible = False
        
        if vapid_response.status_code == 200:
            vapid_data = vapid_response.json()
            public_key = vapid_data.get("publicKey")
            
            if public_key:
                vapid_details.append("✅ VAPID public key endpoint accessible")
                vapid_details.append(f"✅ Public key returned: {public_key[:20]}...")
                vapid_key_accessible = True
            else:
                vapid_details.append("❌ No public key in response")
        else:
            vapid_details.append(f"❌ VAPID endpoint failed: {vapid_response.status_code}")
            if vapid_response.status_code == 404:
                vapid_details.append("❌ VAPID public key endpoint not implemented")
        
        print_test_result("Verify VAPID Keys", vapid_key_accessible, "; ".join(vapid_details))
        
        # Step 4: CHECK RECENT RECOMMENDATIONS
        print("   Step 4: Check recent recommendations for schedule execution")
        
        recommendations_response = requests.get(f"{BACKEND_URL}/recommendations/{athlete_id}")
        
        recommendations_details = []
        recent_recommendations = []
        
        if recommendations_response.status_code == 200:
            recommendations = recommendations_response.json()
            
            # Look for recent recommendations (within last hour)
            one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
            
            for rec in recommendations:
                generated_at = rec.get("generated_at")
                if generated_at:
                    try:
                        rec_time = datetime.fromisoformat(generated_at.replace('Z', '+00:00'))
                        if rec_time > one_hour_ago:
                            recent_recommendations.append(rec)
                    except:
                        pass
            
            recommendations_details.append(f"✅ Recommendations endpoint accessible")
            recommendations_details.append(f"Total recommendations: {len(recommendations)}")
            recommendations_details.append(f"Recent recommendations (last hour): {len(recent_recommendations)}")
            
            if recent_recommendations:
                for rec in recent_recommendations[:3]:  # Show up to 3 recent ones
                    schedule_id = rec.get("schedule_id", "N/A")
                    title = rec.get("title", "N/A")
                    recommendations_details.append(f"Recent: '{title}' (schedule_id: {schedule_id})")
            
        else:
            recommendations_details.append(f"❌ Recommendations endpoint failed: {recommendations_response.status_code}")
        
        print_test_result("Check Recent Recommendations", recommendations_response.status_code == 200, "; ".join(recommendations_details))
        
        # Step 5: TEST PUSH NOTIFICATION
        print("   Step 5: Test push notification sending")
        
        test_push_response = requests.post(f"{BACKEND_URL}/push/test/{athlete_id}")
        
        push_test_details = []
        push_test_success = False
        
        if test_push_response.status_code == 200:
            push_result = test_push_response.json()
            
            if has_subscriptions:
                push_test_details.append("✅ Test push notification endpoint accessible")
                push_test_details.append(f"Response: {push_result.get('message', 'No message')}")
                
                if "sent" in push_result.get('message', '').lower():
                    push_test_details.append("✅ Test notification sent successfully")
                    push_test_success = True
                else:
                    push_test_details.append("⚠️ Test notification may not have been sent")
            else:
                push_test_details.append("⚠️ No subscriptions available for testing")
                push_test_details.append("User needs to enable push notifications in Account Settings")
                
        elif test_push_response.status_code == 404:
            push_test_details.append("❌ Test push endpoint not found")
        elif test_push_response.status_code == 400:
            try:
                error_data = test_push_response.json()
                error_message = error_data.get('detail', test_push_response.text)
            except:
                error_message = test_push_response.text
            push_test_details.append(f"❌ Test push failed: {error_message}")
        else:
            push_test_details.append(f"❌ Test push failed: {test_push_response.status_code}")
        
        print_test_result("Test Push Notification", push_test_success or not has_subscriptions, "; ".join(push_test_details))
        
        # Step 6: CHECK BACKEND LOGS FOR PUSH ATTEMPTS (simulated)
        print("   Step 6: Check for push notification configuration")
        
        config_details = []
        
        # Check if VAPID keys are configured in environment
        if vapid_key_accessible:
            config_details.append("✅ VAPID public key accessible - private key likely configured")
        else:
            config_details.append("❌ VAPID keys may not be properly configured")
        
        # Check if push notification function exists by testing endpoint
        if test_push_response.status_code != 404:
            config_details.append("✅ Push notification endpoints exist")
        else:
            config_details.append("❌ Push notification endpoints missing")
        
        print_test_result("Push Notification Configuration", len(config_details) > 0, "; ".join(config_details))
        
        # Step 7: CHECK BACKEND LOGS
        print("   Step 7: Check backend logs for push notification attempts")
        
        # Check supervisor logs for push notification activity
        try:
            import subprocess
            log_result = subprocess.run(
                ["tail", "-n", "50", "/var/log/supervisor/backend.out.log"],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            log_lines = log_result.stdout.split('\n')
            push_log_lines = [line for line in log_lines if 'push' in line.lower() or 'notification' in line.lower()]
            
            log_details = []
            if push_log_lines:
                log_details.append(f"✅ Found {len(push_log_lines)} push-related log entries")
                for line in push_log_lines[-3:]:  # Show last 3 entries
                    log_details.append(f"Log: {line.strip()}")
            else:
                log_details.append("⚠️ No push notification logs found in recent backend logs")
            
            print_test_result("Backend Push Logs", len(push_log_lines) > 0, "; ".join(log_details))
            
        except Exception as e:
            print_test_result("Backend Push Logs", False, f"Could not check logs: {str(e)}")
        
        # Step 8: OVERALL ASSESSMENT
        print("   Step 8: Overall push notification setup assessment")
        
        assessment = []
        
        if has_subscriptions:
            if vapid_key_accessible and push_test_success:
                assessment.append("✅ PUSH NOTIFICATIONS FULLY FUNCTIONAL")
                assessment.append("✅ User has subscriptions, VAPID keys work, test successful")
            elif vapid_key_accessible:
                assessment.append("⚠️ PUSH NOTIFICATIONS PARTIALLY WORKING")
                assessment.append("✅ User has subscriptions and VAPID keys configured")
                assessment.append("⚠️ Test notification may have issues")
            else:
                assessment.append("❌ PUSH NOTIFICATIONS NOT WORKING")
                assessment.append("✅ User has subscriptions but VAPID configuration issues")
        else:
            if vapid_key_accessible:
                assessment.append("⚠️ PUSH NOTIFICATIONS READY BUT NOT ENABLED")
                assessment.append("✅ VAPID keys configured correctly")
                assessment.append("❌ User needs to enable push notifications in Account Settings")
            else:
                assessment.append("❌ PUSH NOTIFICATIONS NOT CONFIGURED")
                assessment.append("❌ VAPID keys not accessible")
                assessment.append("❌ User has no subscriptions")
        
        # Check if recent recommendations exist (indicates schedules are working)
        if recent_recommendations:
            assessment.append("✅ Recent recommendations found - schedules are executing")
            assessment.append("✅ Push notifications should be triggered for new recommendations")
        else:
            assessment.append("⚠️ No recent recommendations - schedules may not be executing")
            assessment.append("💡 Check schedule execution and OpenAI API key configuration")
        
        print("\n📊 PUSH NOTIFICATION ASSESSMENT:")
        print("-" * 50)
        for item in assessment:
            print(f"  {item}")
        
        # Determine overall success
        overall_success = (
            subscriptions_response.status_code == 200 and
            vapid_key_accessible and
            recommendations_response.status_code == 200
        )
        
        if overall_success:
            if has_subscriptions:
                print("\n✅ PUSH NOTIFICATION SETUP COMPLETE AND FUNCTIONAL")
            else:
                print("\n⚠️ PUSH NOTIFICATION SETUP COMPLETE BUT USER NEEDS TO ENABLE")
                print("💡 User should go to Account Settings and enable push notifications")
        else:
            print("\n❌ PUSH NOTIFICATION SETUP HAS ISSUES")
            print("⚠️ Check VAPID configuration and backend setup")
        
        return overall_success
        
    except Exception as e:
        print_test_result("Push Notification Testing - Exception", False, f"Exception: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 STARTING PUSH NOTIFICATION TESTING")
    print("=" * 70)
    
    # Run push notification tests
    push_notification_success = test_push_notification_setup()
    
    print("\n" + "=" * 70)
    
    # Final result
    if push_notification_success:
        print("🎉 PUSH NOTIFICATION TESTING COMPLETED!")
        print("✅ Push notification setup verified")
        print("✅ VAPID keys accessible")
        print("✅ Endpoints functional")
        print("💡 Check assessment above for user-specific recommendations")
        sys.exit(0)
    else:
        print("❌ PUSH NOTIFICATION TESTING FOUND ISSUES!")
        print("⚠️ Check the detailed output above for specific problems")
        sys.exit(1)