# Oura Ring Integration Setup Guide

## Overview

RunWisely integrates with Oura Ring to automatically import sleep, recovery, and readiness data, providing comprehensive insights for your training optimization. This guide explains how to set up the Oura Ring integration.

## Setting Up Your Oura API Application

To use the Oura Ring integration, you'll need to create an Oura Developer application:

### 1. Create an Oura Developer Account

1. Visit [Oura Cloud Developer Portal](https://cloud.ouraring.com/)
2. Click "Sign Up" or "Log In" with your Oura account
3. Navigate to "My Applications" in the developer console

### 2. Create a New Application

Fill in the following information:

- **Application Name**: `RunWisely Integration` (or your preferred name)
- **Application Type**: `Web Application`
- **Description**: 
  ```
  RunWisely AI running coach integration that imports sleep, HRV, 
  and readiness data from Oura Ring for personalized training recommendations.
  ```
- **Website URL**: `https://kaizen-bodydata.preview.emergentagent.com`
- **Redirect URI**: `https://kaizen-bodydata.preview.emergentagent.com/auth/oura/callback`
- **Scopes Requested**:
  - `email` - Basic profile information
  - `personal` - Personal information access
  - `daily` - Daily summaries (sleep, activity, readiness)
  - `heartrate` - Heart rate data
  - `workout` - Workout session data
  - `session` - Sleep session data
  - `tag` - Tag data
  - `spo2` - Blood oxygen data

### 3. Note Your Credentials

After creating the application, you'll receive:

- **Client ID**: A string identifier (e.g., `ABCD1234`)
- **Client Secret**: A private key that must be kept secure

### 4. Update Backend Configuration

Update your backend `.env` file with your Oura credentials:

```env
OURA_CLIENT_ID=your_actual_oura_client_id_here
OURA_CLIENT_SECRET=your_actual_oura_client_secret_here
OURA_REDIRECT_URI=https://kaizen-bodydata.preview.emergentagent.com/auth/oura/callback
```

**Important**: Replace `your_actual_oura_client_id_here` and `your_actual_oura_client_secret_here` with your real Oura app credentials.

### 5. Restart the Backend

After updating the environment variables:

```bash
sudo supervisorctl restart backend
```

## Using the Oura Ring Integration

### Connecting Your Ring

1. Go to **Account** → **Integrations** in RunWisely
2. Find the **Oura Ring Integration** section
3. Click **Connect to Oura**
4. You'll be redirected to Oura Cloud to authorize the connection
5. Sign in with your Oura account
6. Grant permissions for data access:
   - Sleep and readiness data
   - Heart rate information
   - Activity summaries
   - Personal profile data
7. You'll be redirected back to RunWisely with a success message

### What Gets Imported

The integration automatically imports:

- **Sleep Data**: Total sleep time, sleep efficiency, sleep stages
- **HRV Measurements**: RMSSD values for recovery tracking  
- **Heart Rate**: Resting HR, average HR during sleep
- **Readiness Scores**: Oura's proprietary readiness calculations
- **Recovery Metrics**: Body temperature variations, recovery index
- **Sleep Quality**: Converted to RunWisely's 1-10 scale

### Manual Sync

You can manually sync your latest data:

1. Go to **Account** → **Integrations**
2. In the Oura section (when connected), click **Sync Sleep & Recovery**
3. The system will import recent sleep and recovery data

### Automatic Sync

Once connected, RunWisely will automatically:

- Import new sleep data daily
- Update recovery metrics in real-time
- Include Oura data in daily readiness calculations
- Enhance AI coaching recommendations with recovery insights

## Data Mapping

Oura Ring data is automatically converted to RunWisely format:

| Oura Data | RunWisely Field | Notes |
|-----------|-----------------|-------|
| Total Sleep Duration | Total Sleep Hours | Converted from seconds to hours |
| Sleep Efficiency | Sleep Efficiency | Direct percentage mapping |
| RMSSD | HRV Score | Heart rate variability measure |
| HR Lowest | Resting HR | Lowest heart rate during sleep |
| Sleep Score | Sleep Quality | Converted from 0-100 to 1-10 scale |
| Readiness Score | Used in daily readiness calculation | Combined with other factors |

### Sleep Quality Conversion

Oura's 0-100 sleep score is converted to RunWisely's 1-10 quality scale:

- **85-100**: Excellent (9-10)
- **70-84**: Good (7-8) 
- **55-69**: Average (5-6)
- **40-54**: Poor (3-4)
- **0-39**: Very Poor (1-2)

## Privacy and Security

- **Data Privacy**: Only data you authorize is accessed and imported
- **Secure Storage**: All tokens are encrypted and securely stored
- **Selective Access**: You control which data types are shared
- **Account Control**: Disconnect integration at any time
- **GDPR Compliant**: Data can be exported or deleted on request

## Troubleshooting

### Connection Issues

If you can't connect to Oura:

1. **Check Credentials**: Verify your Client ID and Client Secret are correct
2. **Callback URL**: Ensure redirect URI matches exactly in your Oura app
3. **App Status**: Make sure your Oura app is approved and active
4. **Account Status**: Verify your Oura account is active and Ring is synced
5. **Browser**: Clear cookies/cache or try a different browser

### Sync Issues

If sleep data isn't syncing:

1. **Ring Sync**: Ensure your Oura Ring has synced with the Oura app
2. **Permissions**: Check that you granted all required permissions
3. **Manual Sync**: Try using the manual sync button
4. **Data Availability**: Oura data may have 1-2 hour delays
5. **Rate Limits**: Oura has API rate limits; large syncs may take time

### Data Discrepancies

If imported data doesn't match your Oura app:

1. **Time Zones**: Check that time zones are correctly set
2. **Data Processing**: Oura processes data over several hours
3. **API Version**: Different API versions may show slight variations
4. **Measurement Windows**: Sleep sessions may be calculated differently

## API Rate Limits

Oura enforces the following limits:

- **Personal Apps**: 5,000 requests per day
- **Production Apps**: Higher limits available on request

The integration is designed to stay well within these limits through:

- Efficient data fetching strategies
- Incremental sync (only new data)
- Intelligent retry mechanisms

## Advanced Configuration

### Custom Data Windows

You can adjust sync periods by modifying the backend:

```python
# Sync last 30 days by default
imported_count = await oura_data_manager.import_sleep_data_to_db(athlete_id, days_back=30)
```

### Enhanced Readiness Integration

The Oura readiness score is integrated into RunWisely's readiness calculation:

- Combines with workout load and manual sleep logs
- Weighted alongside HRV and sleep duration
- Provides more comprehensive recovery assessment

### Webhook Support (Future Enhancement)

Future versions may support Oura webhooks for real-time sync:

- Immediate data import upon Ring sync
- Real-time readiness score updates
- Enhanced training load calculations

## Support

If you encounter issues with the Oura Ring integration:

1. Check this setup guide first
2. Verify your Oura app configuration in the developer portal  
3. Check the backend logs for detailed error messages
4. Ensure your Oura Ring is properly synced with your phone
5. Verify environment variables are set correctly

## Data Insights Enabled

With Oura Ring connected, your AI coach can provide insights on:

- **Recovery Patterns**: How your HRV trends affect performance
- **Sleep Optimization**: Recommendations for better sleep quality
- **Training Timing**: Best times to train based on readiness
- **Load Management**: Adjusting training based on recovery metrics
- **Trend Analysis**: Long-term patterns in sleep and recovery

---

**Note**: This integration requires an active Oura Ring subscription and valid API credentials. Oura's API terms of service apply to all data accessed through this integration.