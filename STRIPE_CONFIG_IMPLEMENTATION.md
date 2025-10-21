# Stripe Configuration Implementation

## Summary
Added Stripe API keys and webhook configuration section to System Settings → Advanced tab.

## Features Implemented

### Backend Changes (`/app/backend/server.py`)

**Default Settings Structure (lines 9748-9797)**
- Extended default system settings to include Stripe configuration
- Structure includes:
  - `advanced.stripe.live.apiKey`: Live mode API secret key
  - `advanced.stripe.live.webhookSecret`: Live mode webhook signing secret
  - `advanced.stripe.sandbox.apiKey`: Test mode API secret key
  - `advanced.stripe.sandbox.webhookSecret`: Test mode webhook signing secret

### Frontend Changes (`/app/frontend/src/components/SystemSettings.js`)

**1. State Management (lines 107-123)**
- Extended `advancedSettings` state to include:
  - `stripe` object with `live` and `sandbox` nested objects
  - Show/hide toggles for each sensitive field:
    - `showStripeLiveKey`
    - `showStripeLiveWebhook`
    - `showStripeSandboxKey`
    - `showStripeSandboxWebhook`

**2. Load Function (lines 243-262)**
- Updated to populate Stripe fields from API response
- Uses optional chaining for safe access to nested properties
- Initializes all show/hide toggles to `false` for security

**3. Save Function (lines 562-585)**
- Updated to include Stripe configuration in save payload
- Sends both live and sandbox credentials to backend

**4. UI Components (lines 1920-2083)**
- **Stripe Configuration Section**:
  - Positioned after OpenAI API Key section
  - Separated by border-top divider
  
- **Live Mode Section** (green indicator):
  - API Secret Key input with show/hide toggle
  - Webhook Signing Secret input with show/hide toggle
  - Dark theme styling (gray-900 background, gray-600 borders)
  
- **Test/Sandbox Mode Section** (yellow indicator):
  - API Secret Key input with show/hide toggle
  - Webhook Signing Secret input with show/hide toggle
  - Matching dark theme styling

- **Helper Links**:
  - Link to Stripe Dashboard → API Keys
  - Link to Stripe Dashboard → Webhooks
  - Teal accent color (#00C2A8) for links

## Visual Indicators
- **Live Mode**: Green dot (bg-green-500)
- **Test Mode**: Yellow dot (bg-yellow-500)
- Color-coded to distinguish environments at a glance

## Security Features
- All sensitive fields default to password type (hidden)
- Individual show/hide toggles for each field
- Placeholder text shows expected format:
  - Live: `sk_live_...`
  - Test: `sk_test_...`
  - Webhook: `whsec_...`

## User Experience
- Consistent with existing OpenAI API Key section
- Clear separation between live and test environments
- Helpful external links to Stripe documentation
- Dark theme styling matching System Settings aesthetic
- Responsive design with proper spacing and borders

## API Endpoints Used
- **GET** `/api/system/settings?athlete_id={id}` - Load settings
- **POST** `/api/system/settings?athlete_id={id}` - Save settings

## Testing Notes
- Backend compiled successfully ✓
- Frontend compiled successfully ✓
- Settings persist to MongoDB `system_settings` collection
- Only accessible to Super Admin users
- Data structure validated via existing system settings endpoints
