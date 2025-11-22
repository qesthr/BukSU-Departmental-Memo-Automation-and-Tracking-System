const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const isAuthenticated = require('../middleware/isAuthenticated');
const isAdmin = require('../middleware/isAdmin');
const googleDriveService = require('../services/googleDriveService');
const analyticsService = require('../services/googleAnalyticsService');
const User = require('../models/User');

/**
 * System Health Check Endpoint
 * GET /api/system/health
 * Admin only
 */
router.get('/health', [isAuthenticated, isAdmin], async (req, res) => {
    const startTime = Date.now();
    const healthStatus = {
        overall: 'operational',
        timestamp: new Date().toISOString(),
        services: {}
    };

    try {
        // Check Database Connection
        const dbStartTime = Date.now();
        try {
            const dbState = mongoose.connection.readyState;
            // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
            const isConnected = dbState === 1;
            const dbResponseTime = Date.now() - dbStartTime;

            healthStatus.services.database = {
                status: isConnected ? 'operational' : 'down',
                responseTime: dbResponseTime,
                details: isConnected ? 'Connected to MongoDB' : `Connection state: ${dbState}`
            };
        } catch (error) {
            healthStatus.services.database = {
                status: 'down',
                responseTime: Date.now() - dbStartTime,
                details: `Error: ${error.message}`
            };
        }

        // Check Google Drive Connection
        const driveStartTime = Date.now();
        try {
            const isDriveConnected = await googleDriveService.isDriveConnected();
            const driveResponseTime = Date.now() - driveStartTime;

            healthStatus.services.googleDrive = {
                status: isDriveConnected ? 'operational' : 'not_connected',
                responseTime: driveResponseTime,
                details: isDriveConnected ? 'Google Drive is connected' : 'Google Drive is not connected'
            };
        } catch (error) {
            healthStatus.services.googleDrive = {
                status: 'error',
                responseTime: Date.now() - driveStartTime,
                details: `Error checking Drive: ${error.message}`
            };
        }

        // Check Google Calendar Connection (check if any admin has calendar connected)
        const calendarStartTime = Date.now();
        try {
            const adminWithCalendar = await User.findOne({
                role: 'admin',
                $or: [
                    { calendarAccessToken: { $exists: true, $ne: null } },
                    { calendarRefreshToken: { $exists: true, $ne: null } }
                ]
            }).select('calendarAccessToken calendarRefreshToken').lean();

            const isCalendarConnected = !!adminWithCalendar;
            const calendarResponseTime = Date.now() - calendarStartTime;

            healthStatus.services.googleCalendar = {
                status: isCalendarConnected ? 'operational' : 'not_connected',
                responseTime: calendarResponseTime,
                details: isCalendarConnected ? 'Google Calendar is connected' : 'Google Calendar is not connected'
            };
        } catch (error) {
            healthStatus.services.googleCalendar = {
                status: 'error',
                responseTime: Date.now() - calendarStartTime,
                details: `Error checking Calendar: ${error.message}`
            };
        }

        // Check Google Analytics Connection
        const analyticsStartTime = Date.now();
        try {
            const isAnalyticsConnected = await analyticsService.isConnected();
            const analyticsResponseTime = Date.now() - analyticsStartTime;

            healthStatus.services.googleAnalytics = {
                status: isAnalyticsConnected ? 'operational' : 'not_connected',
                responseTime: analyticsResponseTime,
                details: isAnalyticsConnected ? 'Google Analytics is connected' : 'Google Analytics is not connected'
            };
        } catch (error) {
            healthStatus.services.googleAnalytics = {
                status: 'error',
                responseTime: Date.now() - analyticsStartTime,
                details: `Error checking Analytics: ${error.message}`
            };
        }

        // Determine overall status
        const serviceStatuses = Object.values(healthStatus.services).map(s => s.status);
        const hasDown = serviceStatuses.includes('down');
        const hasError = serviceStatuses.includes('error');
        const hasNotConnected = serviceStatuses.filter(s => s === 'not_connected').length === serviceStatuses.length;

        if (hasDown || hasError) {
            healthStatus.overall = 'down';
        } else if (hasNotConnected) {
            healthStatus.overall = 'degraded';
        } else {
            healthStatus.overall = 'operational';
        }

        healthStatus.responseTime = Date.now() - startTime;

        res.json({
            success: true,
            health: healthStatus
        });
    } catch (error) {
        console.error('Error checking system health:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check system health',
            message: error.message
        });
    }
});

module.exports = router;

