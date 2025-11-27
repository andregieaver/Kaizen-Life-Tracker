#!/bin/bash

# Production Setup Script for Waitlist Auto-responder
# Run this script to complete the production setup

PROD_URL="https://kaizenlifetracker.com"
ADMIN_EMAIL="andre@humanweb.no"
ADMIN_PASSWORD="Pernilla666!"

echo "=========================================="
echo "Production Setup for Waitlist Auto-responder"
echo "=========================================="
echo ""

# Step 1: Login as admin
echo "Step 1: Logging in as super admin..."
LOGIN_RESPONSE=$(curl -s -X POST "${PROD_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")

ATHLETE_ID=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('athlete_id', ''))" 2>/dev/null)

if [ -z "$ATHLETE_ID" ]; then
    echo "❌ Failed to login. Check your credentials."
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo "✅ Logged in successfully (athlete_id: $ATHLETE_ID)"
echo ""

# Step 2: Reload email service
echo "Step 2: Reloading email service from database..."
RELOAD_RESPONSE=$(curl -s -X POST "${PROD_URL}/api/system/reload-email-service?athlete_id=${ATHLETE_ID}")
echo "$RELOAD_RESPONSE" | python3 -m json.tool
echo ""

# Step 3: Create waitlist email template
echo "Step 3: Creating waitlist auto-responder email template..."
TEMPLATE_RESPONSE=$(curl -s -X POST "${PROD_URL}/api/email-templates" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "waitlist_autoresponder",
    "name": "Waitlist Auto-responder",
    "subject": "Thank You for Joining Our Waitlist!",
    "body": "Hi {{user_name}},\n\nThank you for signing up for our waitlist! We are excited to have you join us.\n\nYour email: {{user_email}}\nPreferred language: {{preferred_language}}\n\nWe will notify you as soon as we launch. Stay tuned!\n\nBest regards,\nThe Team",
    "html_body": "<p>Hi {{user_name}},</p><p>Thank you for signing up for our waitlist! We are excited to have you join us.</p><p><strong>Your email:</strong> {{user_email}}<br><strong>Preferred language:</strong> {{preferred_language}}</p><p>We will notify you as soon as we launch. Stay tuned!</p><p>Best regards,<br>The Team</p>",
    "variables": ["{{user_name}}", "{{user_email}}", "{{preferred_language}}"]
  }')

echo "$TEMPLATE_RESPONSE" | python3 -m json.tool
echo ""

# Step 4: Run diagnostic
echo "Step 4: Running diagnostic to verify setup..."
echo ""
DIAGNOSTIC=$(curl -s "${PROD_URL}/api/waiting-list/diagnostic")
echo "$DIAGNOSTIC" | python3 -m json.tool
echo ""

# Check if everything is ready
READY=$(echo "$DIAGNOSTIC" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('checks', {}).get('ready_to_send', False))" 2>/dev/null)

echo ""
echo "=========================================="
if [ "$READY" = "True" ]; then
    echo "✅ SUCCESS! Waitlist auto-responder is ready!"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo "1. Test by signing up on: ${PROD_URL}"
    echo "2. Check your email for the auto-responder"
    echo "3. If no email arrives, check SendGrid Activity logs"
else
    echo "⚠️ Setup incomplete. Check the diagnostic output above."
    echo "=========================================="
fi
