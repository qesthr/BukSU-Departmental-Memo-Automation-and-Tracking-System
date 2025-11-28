const { google } = require('googleapis');
const SystemSetting = require('../models/SystemSetting');

/**
 * Create OAuth2 client for Google Analytics
 * Uses environment variables or SystemSetting as fallback
 */
async function createOAuthClient() {
    // Try environment variables first, then SystemSetting
    let clientId = process.env.GOOGLE_ANALYTICS_CLIENT_ID;
    let clientSecret = process.env.GOOGLE_ANALYTICS_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_ANALYTICS_REDIRECT_URI ||
        `${process.env.BASE_URL || 'http://localhost:5000'}/analytics/auth/callback`;

    // eslint-disable-next-line no-console
    console.log('📊 Google Analytics OAuth redirect URI:', redirectUri);
    // eslint-disable-next-line no-console
    console.log('📊 BASE_URL:', process.env.BASE_URL || 'not set');
    // eslint-disable-next-line no-console
    console.log('📊 GOOGLE_ANALYTICS_REDIRECT_URI:', process.env.GOOGLE_ANALYTICS_REDIRECT_URI || 'not set');

    // If not in env, try SystemSetting
    if (!clientId || !clientSecret) {
        clientId = await SystemSetting.get('google_analytics_client_id') || clientId;
        clientSecret = await SystemSetting.get('google_analytics_client_secret') || clientSecret;
    }

    if (!clientId || !clientSecret) {
        throw new Error('Missing Google Analytics OAuth credentials. Please configure them in environment variables or system settings.');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Get authenticated OAuth client using stored tokens
 */
async function getAuthenticatedClient() {
    const oauth2 = await createOAuthClient();

    // Get tokens from SystemSetting
    const accessToken = await SystemSetting.get('google_analytics_access_token');
    const refreshToken = await SystemSetting.get('google_analytics_refresh_token');
    const expiryDate = await SystemSetting.get('google_analytics_token_expiry');

    if (refreshToken) {
        oauth2.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken,
            expiry_date: expiryDate ? new Date(expiryDate).getTime() : undefined
        });

        // Listen for token updates
        oauth2.on('tokens', async (tokens) => {
            try {
                if (tokens.access_token) {
                    await SystemSetting.set('google_analytics_access_token', tokens.access_token);
                }
                if (tokens.refresh_token) {
                    await SystemSetting.set('google_analytics_refresh_token', tokens.refresh_token);
                }
                if (tokens.expiry_date) {
                    await SystemSetting.set('google_analytics_token_expiry', new Date(tokens.expiry_date));
                }
            } catch (error) {
                console.error('Error updating Google Analytics tokens:', error);
            }
        });
    }

    return oauth2;
}

/**
 * Check if Google Analytics is connected
 */
async function isConnected() {
    try {
        const refreshToken = await SystemSetting.get('google_analytics_refresh_token');
        return !!refreshToken;
    } catch {
        return false;
    }
}

/**
 * Get Google Analytics property ID
 * Returns the property ID in the correct format for API calls
 */
async function getPropertyId() {
    let propertyId = await SystemSetting.get('google_analytics_property_id') ||
                     process.env.GOOGLE_ANALYTICS_PROPERTY_ID;

    if (!propertyId) {
        return null;
    }

    // GA4 Property IDs can be in format "G-XXXXXXXXXX" or numeric "123456789"
    // API expects just the ID part (remove "G-" prefix if present)
    if (propertyId.startsWith('G-')) {
        propertyId = propertyId.substring(2);
    }

    return propertyId;
}

/**
 * Store credentials in SystemSetting
 */
async function storeCredentials(clientId, clientSecret, propertyId, updatedBy = null) {
    await SystemSetting.set('google_analytics_client_id', clientId, updatedBy);
    await SystemSetting.set('google_analytics_client_secret', clientSecret, updatedBy);
    if (propertyId) {
        await SystemSetting.set('google_analytics_property_id', propertyId, updatedBy);
    }
}

/**
 * Store OAuth tokens after successful authentication
 */
async function storeTokens(tokens, updatedBy = null) {
    if (tokens.access_token) {
        await SystemSetting.set('google_analytics_access_token', tokens.access_token, updatedBy);
    }
    if (tokens.refresh_token) {
        await SystemSetting.set('google_analytics_refresh_token', tokens.refresh_token, updatedBy);
    }
    if (tokens.expiry_date) {
        await SystemSetting.set('google_analytics_token_expiry', new Date(tokens.expiry_date), updatedBy);
    }
}

/**
 * Disconnect Google Analytics (remove tokens)
 */
async function disconnect() {
    await SystemSetting.set('google_analytics_access_token', null);
    await SystemSetting.set('google_analytics_refresh_token', null);
    await SystemSetting.set('google_analytics_token_expiry', null);
}

/**
 * Get real-time analytics data
 */
async function getRealtimeData(startDate, endDate) {
    try {
        // Check if connected first
        const connected = await isConnected();
        if (!connected) {
            throw new Error('Google Analytics is not connected');
        }

        const auth = await getAuthenticatedClient();
        const propertyId = await getPropertyId();

        if (!propertyId) {
            throw new Error('Google Analytics Property ID not configured');
        }

        // Check if auth is valid
        if (!auth) {
            throw new Error('Authentication client not available');
        }

        // Initialize Analytics Data API v1beta
        const analyticsData = google.analyticsdata('v1beta');

        if (!analyticsData || !analyticsData.properties) {
            throw new Error('Analytics Data API not available. Please ensure Google Analytics Data API is enabled.');
        }

        // Get real-time active users
        const realtimeResponse = await analyticsData.properties.runRealtimeReport({
            auth: auth,
            property: `properties/${propertyId}`,
            requestBody: {
                dimensions: [{ name: 'country' }],
                metrics: [{ name: 'activeUsers' }]
            }
        });

        return {
            activeUsers: realtimeResponse.data?.rows?.[0]?.metricValues?.[0]?.value || '0',
            realtime: true
        };
    } catch (error) {
        console.error('Error fetching real-time analytics:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            response: error.response?.data
        });

        // Check for API not enabled error
        if (error.message && error.message.includes('has not been used') ||
            error.message && error.message.includes('not enabled')) {
            throw new Error('Google Analytics Data API is not enabled. Please enable it in Google Cloud Console: https://console.developers.google.com/apis/api/analyticsdata.googleapis.com/overview?project=914437323569');
        }

        throw error;
    }
}

/**
 * Get analytics data for a date range
 */
async function getAnalyticsData(startDate, endDate, metrics = ['activeUsers', 'screenPageViews', 'sessions']) {
    try {
        const auth = await getAuthenticatedClient();
        const propertyId = await getPropertyId();

        if (!propertyId) {
            throw new Error('Google Analytics Property ID not configured');
        }

        // Initialize Analytics Data API v1beta
        const analyticsData = google.analyticsdata('v1beta');

        // Format dates
        const startDateStr = startDate instanceof Date ? startDate.toISOString().split('T')[0] : startDate;
        const endDateStr = endDate instanceof Date ? endDate.toISOString().split('T')[0] : endDate;

        // Build metrics array
        const metricsArray = metrics.map(m => ({ name: m }));

        const response = await analyticsData.properties.runReport({
            auth: auth,
            property: `properties/${propertyId}`,
            requestBody: {
                dateRanges: [{
                    startDate: startDateStr,
                    endDate: endDateStr
                }],
                dimensions: [{ name: 'date' }],
                metrics: metricsArray
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching analytics data:', error);

        // Check for API not enabled error
        if (error.message && error.message.includes('has not been used') ||
            error.message && error.message.includes('not enabled')) {
            throw new Error('Google Analytics Data API is not enabled. Please enable it in Google Cloud Console: https://console.developers.google.com/apis/api/analyticsdata.googleapis.com/overview?project=914437323569');
        }

        throw error;
    }
}

/**
 * Get top pages
 */
async function getTopPages(startDate, endDate, limit = 10) {
    try {
        const auth = await getAuthenticatedClient();
        const propertyId = await getPropertyId();

        if (!propertyId) {
            throw new Error('Google Analytics Property ID not configured');
        }

        // Initialize Analytics Data API v1beta
        const analyticsData = google.analyticsdata('v1beta');

        const startDateStr = startDate instanceof Date ? startDate.toISOString().split('T')[0] : startDate;
        const endDateStr = endDate instanceof Date ? endDate.toISOString().split('T')[0] : endDate;

        const response = await analyticsData.properties.runReport({
            auth: auth,
            property: `properties/${propertyId}`,
            requestBody: {
                dateRanges: [{
                    startDate: startDateStr,
                    endDate: endDateStr
                }],
                dimensions: [{ name: 'pagePath' }],
                metrics: [
                    { name: 'screenPageViews' },
                    { name: 'activeUsers' }
                ],
                orderBys: [{
                    metric: { metricName: 'screenPageViews' },
                    desc: true
                }],
                limit: limit
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching top pages:', error);

        // Check for API not enabled error
        if (error.message && error.message.includes('has not been used') ||
            error.message && error.message.includes('not enabled')) {
            throw new Error('Google Analytics Data API is not enabled. Please enable it in Google Cloud Console: https://console.developers.google.com/apis/api/analyticsdata.googleapis.com/overview?project=914437323569');
        }

        throw error;
    }
}

/**
 * Get user activity over time
 */
async function getUserActivity(startDate, endDate, metric = 'activeUsers') {
    try {
        const data = await getAnalyticsData(startDate, endDate, [metric]);
        return data;
    } catch (error) {
        console.error('Error fetching user activity:', error);
        throw error;
    }
}

module.exports = {
    createOAuthClient,
    getAuthenticatedClient,
    isConnected,
    getPropertyId,
    storeCredentials,
    storeTokens,
    disconnect,
    getRealtimeData,
    getAnalyticsData,
    getTopPages,
    getUserActivity
};

