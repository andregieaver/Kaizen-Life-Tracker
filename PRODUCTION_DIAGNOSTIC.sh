#!/bin/bash

# Production Diagnostic Script for Waitlist Auto-responder
# Replace YOUR_PROD_URL with your actual production URL

PROD_URL="YOUR_PROD_URL"  # Example: https://kaizenlifetracker.com

echo "=========================================="
echo "Waitlist Auto-responder Diagnostic Test"
echo "=========================================="
echo ""

# Test 1: Check if email template exists in production
echo "Test 1: Checking if email template exists..."
echo "URL: ${PROD_URL}/api/email-templates"
TEMPLATES=$(curl -s "${PROD_URL}/api/email-templates")
echo "$TEMPLATES" | grep -q "waitlist_autoresponder"
if [ $? -eq 0 ]; then
    echo "✅ Waitlist auto-responder template EXISTS in production"
else
    echo "❌ Waitlist auto-responder template NOT FOUND in production"
    echo "Response: $TEMPLATES"
fi
echo ""

# Test 2: Submit a test waitlist entry
echo "Test 2: Submitting test waitlist entry..."
TEST_EMAIL="diagnostic_$(date +%s)@example.com"
echo "Test email: $TEST_EMAIL"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "${PROD_URL}/api/waiting-list" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Diagnostic Test\",
    \"email\": \"${TEST_EMAIL}\",
    \"nationality\": \"English\",
    \"integrations\": [\"strava\"],
    \"source\": \"diagnostic\",
    \"gdprConsent\": true
  }")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")

echo "HTTP Status: $HTTP_CODE"
echo "Response: $BODY"

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Waitlist entry created successfully"
else
    echo "❌ Failed to create waitlist entry"
fi
echo ""

# Test 3: Instructions for checking production logs
echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo ""
echo "1. Check your production application logs for entries containing:"
echo "   - 'Waiting list entry added: ${TEST_EMAIL}'"
echo "   - 'EMAIL SERVICE SEND START'"
echo "   - 'Waitlist auto-responder sent to'"
echo ""
echo "2. If you see 'EMAIL SERVICE SEND START', the fix is deployed ✅"
echo "3. If you DON'T see that log, the fix is NOT deployed ❌"
echo ""
echo "4. Common issues:"
echo "   - If logs show '403 Forbidden': SendGrid sender email needs verification"
echo "   - If logs show 'template not found': Run the email template creation command"
echo "   - If NO logs appear: The code fix was not deployed"
echo ""
echo "=========================================="
echo "How to access production logs in Emergent:"
echo "=========================================="
echo "1. Go to your Emergent dashboard"
echo "2. Select your production deployment"
echo "3. Look for 'Logs' or 'Console' tab"
echo "4. Search for the test email: ${TEST_EMAIL}"
echo ""
