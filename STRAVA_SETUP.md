# Strava Integration Setup Guide

## Overview

RunWisely integrates with Strava to automatically import your workouts, eliminating the need for manual data entry. This guide explains how to set up the Strava integration.

## Setting Up Your Strava API Application

To use the Strava integration, you'll need to create a Strava API application:

### 1. Create a Strava Developer Account

1. Visit [Strava API Settings](https://www.strava.com/settings/api)
2. Log in with your Strava account
3. Click "Create App" (if you don't have one already)

### 2. Configure Your Strava App

Fill in the following information:

- **Application Name**: `RunWisely Integration` (or your preferred name)
- **Category**: `Training`
- **Club**: Leave blank unless you have a specific Strava club
- **Website**: `https://reactrefactor.preview.emergentagent.com`
- **Application Description**: 
  ```
  RunWisely AI running coach integration that automatically imports 
  workout data from Strava for personalized training analysis and recommendations.
  ```
- **Authorization Callback Domain**: `runwisely.preview.emergentagent.com`

### 3. Note Your Credentials

After creating the app, you'll receive:

- **Client ID**: A public identifier (e.g., `12345`)
- **Client Secret**: A private key that must be kept secure

### 4. Update Backend Configuration

Update your backend `.env` file with your Strava credentials:

```env
STRAVA_CLIENT_ID=your_actual_client_id_here
STRAVA_CLIENT_SECRET=your_actual_client_secret_here
STRAVA_REDIRECT_URI=https://reactrefactor.preview.emergentagent.com/auth/strava/callback
```

**Important**: Replace `your_actual_client_id_here` and `your_actual_client_secret_here` with your real Strava app credentials.

### 5. Restart the Backend

After updating the environment variables:

```bash
sudo supervisorctl restart backend
```

## Using the Strava Integration

### Connecting Your Account

1. Go to **Account** → **Integrations** in RunWisely
2. Find the **Strava Integration** section
3. Click **Connect to Strava**
4. You'll be redirected to Strava to authorize the connection
5. Grant permissions for:
   - Read your profile information
   - Read your activity data
6. You'll be redirected back to RunWisely with a success message

### What Gets Imported

The integration automatically imports:

- **Workout Data**: Distance, duration, pace, elevation gain
- **Heart Rate Data**: Average and maximum heart rate (if available)
- **Activity Types**: Running, cycling, and other activities
- **Activity Details**: Names, descriptions, and timestamps
- **Performance Metrics**: Speed, calories, and training data

### Manual Sync

You can manually sync your latest activities:

1. Go to **Account** → **Integrations**
2. In the Strava section (when connected), click **Sync Activities**
3. The system will import any new activities from Strava

### Automatic Sync

Once connected, RunWisely will automatically:

- Import new activities as you complete them
- Update your training data in real-time
- Include Strava data in AI coaching recommendations

## Data Mapping

Strava activities are automatically converted to RunWisely workout format:

| Strava Data | RunWisely Field | Notes |
|-------------|-----------------|-------|
| Distance (meters) | Distance (miles) | Converted from meters |
| Moving Time | Duration | Active training time |
| Activity Type | Workout Type | Mapped to appropriate categories |
| Average Heart Rate | Avg HR | Direct mapping |
| Max Heart Rate | Max HR | Direct mapping |
| Activity Name | Notes | Included in workout notes |

## Privacy and Security

- **Data Privacy**: Only activity data you've made accessible is imported
- **Secure Storage**: All tokens are encrypted and securely stored
- **Controlled Access**: You can disconnect the integration at any time
- **Selective Sync**: Private activities respect your Strava privacy settings

## Troubleshooting

### Connection Issues

If you can't connect to Strava:

1. **Check Credentials**: Verify your Client ID and Client Secret are correct
2. **Callback URL**: Ensure the redirect URI matches exactly
3. **App Status**: Make sure your Strava app is active and approved
4. **Browser**: Try clearing cookies and cache, or use a different browser

### Sync Issues

If activities aren't syncing:

1. **Permissions**: Check that you granted all required permissions
2. **Manual Sync**: Try using the manual sync button
3. **Activity Privacy**: Ensure activities are not set to private
4. **Rate Limits**: Strava has API rate limits; sync may be delayed

### API Rate Limits

Strava enforces the following limits:

- **Short-term**: 200 requests per 15 minutes
- **Daily**: 2,000 requests per day

Large historical imports may take time due to these limits.

## Support

If you encounter issues with the Strava integration:

1. Check this setup guide first
2. Verify your Strava app configuration
3. Check the backend logs for error messages
4. Ensure your environment variables are set correctly

## Advanced Configuration

### Webhook Support (Future Enhancement)

Future versions may support Strava webhooks for real-time sync:

- Immediate activity import upon completion
- Automatic updates when activities are modified
- Real-time training load calculations

### Custom Activity Mapping

You can customize how Strava activity types map to workout categories by modifying the `_map_strava_type_to_workout_type` function in the backend.

---

**Note**: This integration requires a valid Strava account and API application. Strava's API terms of service apply to all data accessed through this integration.