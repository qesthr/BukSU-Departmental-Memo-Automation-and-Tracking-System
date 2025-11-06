const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/isAuthenticated');
const isAdmin = require('../middleware/isAdmin');
const analyticsService = require('../services/googleAnalyticsService');
const reportService = require('../services/reportService');
const reportPdfService = require('../services/reportPdfService');

/**
 * Start OAuth flow for Google Analytics
 * Admin only
 */
router.get('/auth', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        const oauth2 = await analyticsService.createOAuthClient();
        const scopes = [
            'https://www.googleapis.com/auth/analytics.readonly'
        ];
        const url = oauth2.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: scopes
        });
        return res.redirect(url);
    } catch (error) {
        console.error('Error starting Google Analytics OAuth:', error);
        return res.status(500).json({
            error: 'Failed to start Google Analytics authentication',
            message: error.message
        });
    }
});

/**
 * OAuth callback for Google Analytics
 * Admin only
 */
router.get('/auth/callback', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).json({ error: 'Missing authorization code' });
        }

        const oauth2 = await analyticsService.createOAuthClient();
        const { tokens } = await oauth2.getToken(code);

        // Store tokens
        await analyticsService.storeTokens(tokens, req.user._id);

        // Redirect to report page
        return res.redirect('/admin/report?connected=true');
    } catch (error) {
        console.error('Error handling Google Analytics OAuth callback:', error);
        return res.redirect('/admin/report?error=oauth_failed');
    }
});

/**
 * Store credentials (Client ID, Secret, Property ID)
 * Admin only
 */
router.post('/credentials', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        const { clientId, clientSecret, propertyId } = req.body;

        if (!clientId || !clientSecret) {
            return res.status(400).json({
                error: 'Client ID and Client Secret are required'
            });
        }

        await analyticsService.storeCredentials(clientId, clientSecret, propertyId, req.user._id);

        return res.json({
            success: true,
            message: 'Credentials stored successfully'
        });
    } catch (error) {
        console.error('Error storing credentials:', error);
        return res.status(500).json({
            error: 'Failed to store credentials',
            message: error.message
        });
    }
});

/**
 * Check connection status
 * Admin only
 */
router.get('/status', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        const isConnected = await analyticsService.isConnected();
        const propertyId = await analyticsService.getPropertyId();

        return res.json({
            connected: isConnected,
            propertyId: propertyId || null
        });
    } catch (error) {
        console.error('Error checking connection status:', error);
        return res.status(500).json({
            error: 'Failed to check connection status',
            message: error.message
        });
    }
});

/**
 * Disconnect Google Analytics
 * Admin only
 */
router.delete('/disconnect', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        await analyticsService.disconnect();
        return res.json({
            success: true,
            message: 'Google Analytics disconnected successfully'
        });
    } catch (error) {
        console.error('Error disconnecting Google Analytics:', error);
        return res.status(500).json({
            error: 'Failed to disconnect',
            message: error.message
        });
    }
});

/**
 * Get real-time analytics data
 * Admin only
 */
router.get('/realtime', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        // Check if Google Analytics is connected
        const isConnected = await analyticsService.isConnected();
        if (!isConnected) {
            return res.status(200).json({
                activeUsers: '0',
                realtime: false,
                message: 'Google Analytics not connected'
            });
        }

        const data = await analyticsService.getRealtimeData();
        return res.json(data);
    } catch (error) {
        console.error('Error fetching real-time data:', error);
        console.error('Error stack:', error.stack);

        // Return a graceful error response instead of 500
        return res.status(200).json({
            activeUsers: '0',
            realtime: false,
            error: error.message || 'Failed to fetch real-time data'
        });
    }
});

/**
 * Get analytics data for date range
 * Admin only
 */
router.get('/data', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        const { startDate, endDate, metrics } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'startDate and endDate are required'
            });
        }

        // Check if Google Analytics is connected
        const isConnected = await analyticsService.isConnected();
        if (!isConnected) {
            return res.status(200).json({
                rows: [],
                message: 'Google Analytics not connected'
            });
        }

        const metricsArray = metrics ? metrics.split(',') :
            ['activeUsers', 'screenPageViews', 'sessions'];

        const data = await analyticsService.getAnalyticsData(
            startDate,
            endDate,
            metricsArray
        );

        return res.json(data);
    } catch (error) {
        console.error('Error fetching analytics data:', error);
        console.error('Error stack:', error.stack);
        return res.status(200).json({
            rows: [],
            error: error.message || 'Failed to fetch analytics data'
        });
    }
});

/**
 * Get user activity over time
 * Admin only
 */
router.get('/activity', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        const { startDate, endDate, metric = 'activeUsers' } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'startDate and endDate are required'
            });
        }

        // Check if Google Analytics is connected
        const isConnected = await analyticsService.isConnected();
        if (!isConnected) {
            return res.status(200).json({
                rows: [],
                message: 'Google Analytics not connected'
            });
        }

        const data = await analyticsService.getUserActivity(startDate, endDate, metric);
        return res.json(data);
    } catch (error) {
        console.error('Error fetching user activity:', error);
        console.error('Error stack:', error.stack);
        return res.status(200).json({
            rows: [],
            error: error.message || 'Failed to fetch user activity'
        });
    }
});

/**
 * Get top pages
 * Admin only
 */
router.get('/top-pages', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        const { startDate, endDate, limit = 10 } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'startDate and endDate are required'
            });
        }

        // Check if Google Analytics is connected
        const isConnected = await analyticsService.isConnected();
        if (!isConnected) {
            return res.status(200).json({
                rows: [],
                message: 'Google Analytics not connected'
            });
        }

        const data = await analyticsService.getTopPages(startDate, endDate, parseInt(limit));
        return res.json(data);
    } catch (error) {
        console.error('Error fetching top pages:', error);
        console.error('Error stack:', error.stack);
        return res.status(200).json({
            rows: [],
            error: error.message || 'Failed to fetch top pages'
        });
    }
});

// ============================================
// DATABASE STATISTICS ENDPOINTS
// ============================================

/**
 * Get overall statistics from database
 * Admin only
 */
router.get('/db/stats', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        const stats = await reportService.getOverallStats();
        return res.json(stats);
    } catch (error) {
        console.error('Error fetching database stats:', error);
        return res.status(500).json({
            error: 'Failed to fetch database statistics',
            message: error.message
        });
    }
});

/**
 * Get memo statistics for date range
 * Admin only
 */
router.get('/db/memos', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'startDate and endDate are required'
            });
        }

        const stats = await reportService.getMemoStatsForDateRange(startDate, endDate);
        return res.json(stats);
    } catch (error) {
        console.error('Error fetching memo stats:', error);
        return res.status(500).json({
            error: 'Failed to fetch memo statistics',
            message: error.message
        });
    }
});

/**
 * Get memos over time
 * Admin only
 */
router.get('/db/memos-over-time', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'startDate and endDate are required'
            });
        }

        const data = await reportService.getMemosOverTime(startDate, endDate);
        return res.json(data);
    } catch (error) {
        console.error('Error fetching memos over time:', error);
        return res.status(500).json({
            error: 'Failed to fetch memos over time',
            message: error.message
        });
    }
});

/**
 * Get memo statistics by department
 * Admin only
 */
router.get('/db/memos-by-department', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'startDate and endDate are required'
            });
        }

        const data = await reportService.getMemoStatsByDepartment(startDate, endDate);
        return res.json(data);
    } catch (error) {
        console.error('Error fetching memos by department:', error);
        return res.status(500).json({
            error: 'Failed to fetch memos by department',
            message: error.message
        });
    }
});

/**
 * Get user statistics
 * Admin only
 */
router.get('/db/users', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        const stats = await reportService.getUserStats();
        return res.json(stats);
    } catch (error) {
        console.error('Error fetching user stats:', error);
        return res.status(500).json({
            error: 'Failed to fetch user statistics',
            message: error.message
        });
    }
});

/**
 * Get recent activity
 * Admin only
 */
router.get('/db/activity', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const activities = await reportService.getRecentActivity(parseInt(limit));
        return res.json(activities);
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        return res.status(500).json({
            error: 'Failed to fetch recent activity',
            message: error.message
        });
    }
});

/**
 * Get user activity over time (from login data)
 * Admin only
 */
router.get('/db/user-activity', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'startDate and endDate are required'
            });
        }

        const data = await reportService.getUserActivityOverTime(startDate, endDate);
        return res.json(data);
    } catch (error) {
        console.error('Error fetching user activity:', error);
        return res.status(500).json({
            error: 'Failed to fetch user activity',
            message: error.message
        });
    }
});

/**
 * Get activity logs over time (from system memos)
 * Admin only
 */
router.get('/db/activity-logs', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        const { startDate, endDate, activityType } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'startDate and endDate are required'
            });
        }

        const data = await reportService.getActivityLogsOverTime(startDate, endDate, activityType || null);

        // Format data for Google Charts compatibility
        const formattedData = {
            rows: data.map(item => ({
                dimensionValues: [{ value: item._id }],
                metricValues: [{ value: item.count.toString() }]
            }))
        };

        return res.json(formattedData);
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        return res.status(500).json({
            error: 'Failed to fetch activity logs',
            message: error.message
        });
    }
});

/**
 * Get activity logs by type over time
 * Admin only
 */
router.get('/db/activity-logs-by-type', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                error: 'startDate and endDate are required'
            });
        }

        const data = await reportService.getActivityLogsByTypeOverTime(startDate, endDate);
        return res.json(data);
    } catch (error) {
        console.error('Error fetching activity logs by type:', error);
        return res.status(500).json({
            error: 'Failed to fetch activity logs by type',
            message: error.message
        });
    }
});

/**
 * Export report as PDF
 * Admin only
 */
router.get('/export/pdf', [isAuthenticated, isAdmin], async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Default to last 30 days if not provided
        const end = endDate || new Date().toISOString().split('T')[0];
        const start = startDate || (() => {
            const d = new Date(end);
            d.setDate(d.getDate() - 30);
            return d.toISOString().split('T')[0];
        })();

        // Generate PDF
        const pdfBuffer = await reportPdfService.generateReportPDF(start, end);

        // Set response headers
        const filename = `Memofy-Report-${start}-to-${end}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        // Send PDF
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating PDF report:', error);
        return res.status(500).json({
            error: 'Failed to generate PDF report',
            message: error.message
        });
    }
});

module.exports = router;

