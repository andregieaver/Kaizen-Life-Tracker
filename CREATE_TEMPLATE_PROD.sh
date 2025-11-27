#!/bin/bash

# Simple script to create the waitlist email template in production

echo "Creating waitlist auto-responder template in production..."
echo ""

curl -X POST "https://kaizenlifetracker.com/api/email-templates" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "waitlist_autoresponder",
    "name": "Waitlist Auto-responder",
    "subject": "Thank You for Joining Our Waitlist!",
    "body": "Hi {{user_name}},\n\nThank you for signing up for our waitlist! We are excited to have you join us.\n\nYour email: {{user_email}}\nPreferred language: {{preferred_language}}\n\nWe will notify you as soon as we launch. Stay tuned!\n\nBest regards,\nThe Team",
    "html_body": "<p>Hi {{user_name}},</p><p>Thank you for signing up for our waitlist! We are excited to have you join us.</p><p><strong>Your email:</strong> {{user_email}}<br><strong>Preferred language:</strong> {{preferred_language}}</p><p>We will notify you as soon as we launch. Stay tuned!</p><p>Best regards,<br>The Team</p>",
    "variables": ["{{user_name}}", "{{user_email}}", "{{preferred_language}}"]
  }'

echo ""
echo ""
echo "Done! Template created."
echo ""
echo "Now check the diagnostic: https://kaizenlifetracker.com/api/waiting-list/diagnostic"
