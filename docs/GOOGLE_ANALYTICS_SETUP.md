# Google Analytics Integration Setup Guide

This guide will help you set up Google Analytics API integration for the Memofy Reports & Analytics page.

## Prerequisites

1. A Google Cloud Project (same one used for other Google integrations)
2. Google Analytics 4 (GA4) property
3. OAuth 2.0 credentials (Client ID and Client Secret)
4. Node.js and npm installed

## Step 1: Enable Google Analytics Data API

**IMPORTANT:** This API must be enabled before Google Analytics integration will work!

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** > **Library**
4. Search for **"Google Analytics Data API"**
5. Click on **"Google Analytics Data API"** from the results
6. Click the **"Enable"** button
7. Wait a few minutes for the API to be fully enabled

**Quick Link:** [Enable Google Analytics Data API](https://console.developers.google.com/apis/api/analyticsdata.googleapis.com/overview)

**Note:** After enabling, wait 2-5 minutes for the changes to propagate before trying to use the API.

## Step 2: Get Your GA4 Property ID

1. Go to [Google Analytics](https://analytics.google.com/)
2. Select your property (or create a new GA4 property)
3. Go to **Admin** (gear icon) > **Property Settings**
4. Copy the **Property ID** (format: `123456789` or `G-XXXXXXXXXX`)

## Step 3: Configure OAuth 2.0 Credentials

1. In Google Cloud Console, go to **APIs & Services** > **Credentials**
2. Find your existing OAuth 2.0 Client ID (or create a new one)
3. Click **Edit** on your OAuth client
4. Add the following **Authorized redirect URI**:
   - `http://localhost:5000/analytics/auth/callback` (for development)
   - `https://yourdomain.com/analytics/auth/callback` (for production)
5. Make sure the OAuth consent screen includes the scope:
   - `https://www.googleapis.com/auth/analytics.readonly`
6. Save the changes

## Step 4: Configure Credentials

You have two options:

### Option 1: Use the Web Interface (Recommended for First Setup)

1. Go to `/admin/report` in your application
2. Click "Connect Google Analytics"
3. Enter your credentials:
   - **Client ID**: Your OAuth 2.0 Client ID (e.g., `xxxxx.apps.googleusercontent.com`)
   - **Client Secret**: Your OAuth 2.0 Client Secret
   - **Property ID**: Your GA4 Property ID (e.g., `G-XXXXXXXXXX`)
4. Click "Connect"
5. You'll be redirected to Google to authorize access
6. After authorization, you'll be redirected back to the report page

### Option 2: Use Environment Variables (For Production)

Add the following to your `.env` file:

```env
# Google Analytics API Configuration
# Get these values from Google Cloud Console -> APIs & Services -> Credentials
GOOGLE_ANALYTICS_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_ANALYTICS_CLIENT_SECRET=your-client-secret
GOOGLE_ANALYTICS_PROPERTY_ID=G-XXXXXXXXXX
GOOGLE_ANALYTICS_REDIRECT_URI=http://localhost:5000/analytics/auth/callback

# For production, use:
# GOOGLE_ANALYTICS_REDIRECT_URI=https://yourdomain.com/analytics/auth/callback
```

**Note**: If credentials are set in environment variables, they take precedence over the web interface settings.

## Step 5: Verify Setup

1. Navigate to `/admin/report`
2. Check the connection status indicator
3. If connected, you should see:
   - Green status dot
   - "Connected" message
   - Analytics data loading automatically

## Troubleshooting

### "Missing Google Analytics OAuth credentials" Error

- Make sure credentials are set either in environment variables or via the web interface
- Restart your server after adding environment variables

### "Google Analytics Property ID not configured" Error

- Enter your Property ID in the setup form or environment variable
- Make sure you're using a GA4 property (not Universal Analytics)

### "Failed to fetch analytics data" Error

- Verify the OAuth consent screen includes the `analytics.readonly` scope
- Check that the Google Analytics Data API is enabled
- Ensure you have view access to the GA4 property

### OAuth Redirect URI Mismatch

- Make sure the redirect URI in Google Cloud Console matches exactly:
  - Development: `http://localhost:5000/analytics/auth/callback`
  - Production: `https://yourdomain.com/analytics/auth/callback`

## API Endpoints

The following endpoints are available (Admin only):

- `GET /api/analytics/status` - Check connection status
- `GET /analytics/auth` - Start OAuth flow
- `GET /analytics/auth/callback` - OAuth callback
- `POST /api/analytics/credentials` - Store credentials
- `GET /api/analytics/realtime` - Get real-time data
- `GET /api/analytics/data` - Get analytics data for date range
- `GET /api/analytics/activity` - Get user activity over time
- `GET /api/analytics/top-pages` - Get top pages
- `DELETE /api/analytics/disconnect` - Disconnect Google Analytics

## Security Notes

- Credentials are stored securely in the database (SystemSetting model)
- OAuth tokens are encrypted and stored securely
- Only admin users can access analytics data
- All API endpoints require authentication and admin role
