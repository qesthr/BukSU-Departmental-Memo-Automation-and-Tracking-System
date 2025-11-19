/* eslint-disable no-console, no-unused-vars */
require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./backend/config/db');
const passport = require('./backend/config/passport');
const isAdmin = require('./backend/middleware/isAdmin');
const isAuthenticated = require('./backend/middleware/isAuthenticated');
const requireRole = require('./backend/middleware/requireRole');
const validateUserRole = require('./backend/middleware/validateUserRole');
const Memo = require('./backend/models/Memo');
const CalendarEvent = require('./backend/models/CalendarEvent');
const authRoutes = require('./backend/routes/auth');
const passwordRoutes = require('./backend/routes/passwordRoutes');
const userRoutes = require('./backend/routes/userRoutes');
const settingsRoutes = require('./backend/routes/settingsRoutes');
const forgotPasswordRoutes = require('./backend/routes/forgotPasswordRoutes');
const logRoutes = require('./backend/routes/logRoutes');
const driveRoutes = require('./backend/routes/driveRoutes');
const calendarRoutes = require('./backend/routes/calendarRoutes');
const auditRoutes = require('./backend/routes/auditRoutes');
const activityLogRoutes = require('./backend/routes/activityLogRoutes');
const signatureRoutes = require('./backend/routes/signatureRoutes');
const rollbackRoutes = require('./backend/routes/rollbackRoutes');

// Connect to MongoDB
connectDB();

// Initialize scheduled memo processor (runs every minute to send scheduled memos)
// Wait for DB connection before starting
mongoose.connection.once('open', () => {
    const scheduledMemoService = require('./backend/services/scheduledMemoService');
    scheduledMemoService.startScheduledMemoProcessor();
});

const app = express();
const port = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'",
                "https://www.google.com", "https://www.gstatic.com",
                "https://accounts.google.com", "https://apis.google.com",
                "https://unpkg.com", "https://cdn.jsdelivr.net",
                // Allow Google Tag Manager / gtag.js
                "https://www.googletagmanager.com",
                // Optional: GA debug tools (keep commented unless needed)
                // "https://www.google-analytics.com"
            ],
            styleSrc: ["'self'", "'unsafe-inline'", "https://www.google.com",
                "https://www.gstatic.com", "https://fonts.googleapis.com",
                "https://cdn.jsdelivr.net"],
            styleSrcElem: ["'self'", "'unsafe-inline'", "https://www.gstatic.com",
                "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com",
                // Allow Font Awesome webfonts from jsDelivr
                "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:", "https://www.google.com",
                "https://www.gstatic.com", "https://developers.google.com",
                // Allow GA pixel requests if any image beacons are used
                "https://www.google-analytics.com"],
            frameSrc: ["'self'", "https://www.google.com", "https://accounts.google.com", "https://*.google.com"],
            connectSrc: ["'self'", "https://unpkg.com", "https://www.googleapis.com",
                "https://accounts.google.com", "https://*.google.com", "https://*.googleapis.com",
                // Allow GA/gtag network requests
                "https://www.google-analytics.com", "https://region1.google-analytics.com",
                "https://www.googletagmanager.com"]
        },
    },
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust reverse proxy (needed for secure cookies behind proxies/load balancers)
app.set('trust proxy', 1);

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/password', passwordRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
// Public invite routes (render and completion)
app.get('/invite/:token', require('./backend/controllers/inviteController').renderInvitePage);
app.post('/invite/complete', require('./backend/controllers/inviteController').completeInvite);
app.use('/api/log', logRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/signatures', signatureRoutes);
app.use('/api/rollback', rollbackRoutes);
app.use('/calendar', require('./backend/routes/calendarOAuthRoutes'));
app.use('/api/analytics', require('./backend/routes/analyticsRoutes'));
app.use('/analytics', require('./backend/routes/analyticsRoutes'));

// --- Simple SSE event bus for admin notifications ---
const sseClients = new Set();
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();
    sseClients.add(res);
    req.on('close', () => {
        sseClients.delete(res);
    });
});

function broadcastEvent(event, data) {
    const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) {
        try { res.write(payload); } catch (e) { /* ignore */ }
    }
}

app.locals.broadcastEvent = broadcastEvent;

// Set up EJS first (needed for views configuration)
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', [
    path.join(__dirname, 'frontend/views'),
    path.join(__dirname, 'frontend/components')
]);
app.set('layout', path.join(__dirname, 'frontend/components/layouts/Loginlayout.ejs'));

// Pass environment variables and path to views - MUST be before routes
app.use(async (req, res, next) => {
    res.locals.RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY;
    res.locals.path = req.path; // Make current path available to all views

    // Get Google Analytics Property ID for tracking (if configured)
    // Primary: Use environment variable (faster, no DB query)
    // Fallback: Database (only if DB is connected and env var not set)
    try {
        let propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID;

        // Only query database if env var is not set AND mongoose is connected
        if (!propertyId && mongoose.connection.readyState === 1) {
            const SystemSetting = require('./backend/models/SystemSetting');
            propertyId = await SystemSetting.get('google_analytics_property_id');
        }

        // For gtag.js, we need the full "G-XXXXXXXXXX" format
        if (propertyId && !propertyId.startsWith('G-')) {
            propertyId = 'G-' + propertyId;
        }

        res.locals.gaPropertyId = propertyId || null;
    } catch (error) {
        // Silently fail - tracking is optional
        // Could be database not connected yet or other error
        console.error('GA Property ID fetch error (non-critical):', error.message);
        res.locals.gaPropertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID || null;
    }

    next();
});

app.use('/auth', authRoutes);
app.use('/', forgotPasswordRoutes); // Forgot password routes
app.use('/admin', require('./frontend/routes/adminRoutes'));

app.get('/settings', isAuthenticated, validateUserRole, (req, res) => {
    const role = (req.user && req.user.role) || '';
    if (role === 'admin') {
        return res.render('admin/settings', { user: req.user, path: '/settings' });
    }
    if (role === 'secretary') {
        return res.render('secretary-settings', { user: req.user, path: '/settings' });
    }
    if (role === 'faculty') {
        return res.render('faculty-settings', { user: req.user, path: '/settings' });
    }
    return res.redirect('/login');
});

// Serve static files from frontend/public
app.use(express.static(path.join(__dirname, 'frontend/public')));
app.use('/css', express.static(path.join(__dirname, 'frontend/public/css')));
app.use('/images', express.static(path.join(__dirname, 'frontend/public/images')));
app.use('/js', express.static(path.join(__dirname, 'frontend/public/js')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.get('/', (req, res) => {
    res.render('login'); // frontend/views/login.ejs
});

// Unauthorized access page - plain white background with error modal
app.get('/unauthorized', (req, res) => {
    res.render('unauthorized');
});

// Explicit login route to handle redirects with error messages
app.get('/login', (req, res) => {
    const { error, message } = req.query || {};
    if (error === 'account_not_found') {
        return res.render('login', {
            showMinimalMessageModal: true,
            modalTitle: 'Account Not Found',
            modalMessage: message || 'Your account has not been added by an administrator. Please contact your administrator to create your account.',
            modalType: 'error'
        });
    }
    if (error || message) {
        return res.render('login', {
            showMessageModal: true,
            modalTitle: error ? 'Login Error' : 'Message',
            modalMessage: message || 'Authentication failed. Please try again.',
            modalType: 'error'
        });
    }
    return res.render('login');
});

// Admin Calendar
app.get('/calendar', isAuthenticated, (req, res) => {
    const role = req.user?.role;
    if (role === 'admin') {
        return res.render('admin/calendar', { user: req.user, path: '/calendar' });
    }
    if (role === 'secretary') {
        return res.redirect('/secretary/calendar');
    }
    return res.redirect('/dashboard');
});

// Secretary Calendar - only for secretaries (admin blocked)
app.get('/secretary/calendar', isAuthenticated, validateUserRole, requireRole('secretary'), (req, res) => {
    return res.render('secretary-calendar', { user: req.user, path: '/calendar' });
});

// Faculty Calendar - view-only, only for faculty
app.get('/faculty/calendar', isAuthenticated, validateUserRole, requireRole('faculty'), (req, res) => {
    return res.render('faculty-calendar', { user: req.user, path: '/faculty/calendar' });
});



// Auth success route
app.get('/auth-success', (req, res) => {
    if (req.isAuthenticated()) {
        res.render('auth-success');
    } else {
        res.redirect('/');
    }
});

// Dashboard route - protected
// app.get('/dashboard', (req, res) => {
//     if (req.isAuthenticated()) {
//         if (req.user && req.user.role === 'admin') {
//             res.redirect('/admin-dashboard');
//         } else {
//             res.render('admin-dashboard', {
//                 user: req.user,
//                 path: '/dashboard'
//             });
//         }
//     } else {
//         res.redirect('/');
//     }
// });

// Admin Dashboard route - ADMIN ONLY
app.get('/admin-dashboard', isAuthenticated, validateUserRole, isAdmin, async (req, res) => {
    try {
        const allMemos = await Memo.find({}).sort({ createdAt: -1 }).limit(50)
            .populate('sender', 'firstName lastName email')
            .populate('recipient', 'firstName lastName email');
        res.render('admin-dashboard', {
            user: req.user,
            path: '/admin-dashboard',
            allMemos
        });
    } catch (e) {
        res.render('admin-dashboard', { user: req.user, path: '/admin-dashboard', allMemos: [] });
    }
});

// Unified dashboard route for secretary and faculty ONLY (admin blocked)
app.get('/dashboard', isAuthenticated, validateUserRole, requireRole('secretary', 'faculty'), async (req, res) => {
    const role = (req.user && req.user.role) || '';

    if (role === 'secretary') {
        try {
            const memos = await Memo.find({ createdBy: req.user._id }).sort({ createdAt: -1 })
                .populate('recipient', 'firstName lastName email');
            return res.render('secretary-dashboard', { user: req.user, path: '/dashboard', memos });
        } catch (e) {
            return res.render('secretary-dashboard', { user: req.user, path: '/dashboard', memos: [] });
        }
    }

    if (role === 'faculty') {
        try {
            // Get memos received by faculty (only sent/approved status, not pending)
            const receivedMemos = await Memo.find({
                recipient: req.user._id,
                status: { $in: ['sent', 'approved'] },
                activityType: { $ne: 'system_notification' }
            })
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('sender', 'firstName lastName email profilePicture department')
                .populate('recipient', 'firstName lastName email profilePicture department');

            // Count total received memos
            const totalReceived = await Memo.countDocuments({
                recipient: req.user._id,
                status: { $in: ['sent', 'approved'] },
                activityType: { $ne: 'system_notification' }
            });

            return res.render('faculty-dashboard', {
                user: req.user,
                path: '/dashboard',
                receivedMemos: receivedMemos || [],
                totalReceived: totalReceived || 0
            });
        } catch (e) {
            console.error('Error fetching faculty dashboard data:', e);
            return res.render('faculty-dashboard', {
                user: req.user,
                path: '/dashboard',
                receivedMemos: [],
                totalReceived: 0
            });
        }
    }

    // This should never be reached due to requireRole middleware, but keep as safety
    return res.redirect('/admin-dashboard?error=invalid_role');
});

// Secretary memos page - only for secretaries (admin blocked)
app.get('/secretary/memos', isAuthenticated, validateUserRole, requireRole('secretary'), async (req, res) => {
    try {
        const memos = await Memo.find({ createdBy: req.user._id }).sort({ createdAt: -1 })
            .populate('recipient', 'firstName lastName email');
        const received = await Memo.find({
            recipient: req.user._id,
            status: { $ne: 'deleted' },
            $or: [
                { activityType: { $ne: 'pending_memo' } },
                {
                    activityType: 'system_notification',
                    'metadata.eventType': 'memo_review_decision',
                    'metadata.action': { $in: ['rejected', 'approved'] }
                }
            ]
        })
            .sort({ createdAt: -1 })
            .populate('sender', 'firstName lastName email');
        return res.render('secretary-memos', { user: req.user, path: '/secretary/memos', memos, received });
    } catch (e) {
        return res.render('secretary-memos', { user: req.user, path: '/secretary/memos', memos: [], received: [] });
    }
});

// Secretary archive page - only for secretaries (admin blocked)
app.get('/secretary/archive', isAuthenticated, validateUserRole, requireRole('secretary'), async (req, res) => {
    try {
        // Get archived memos OR sent/approved memos that can be archived
        // Include memos where the secretary is the sender but NOT the recipient
        // Exclude the tracking memo where recipient equals sender
        const archivedMemos = await Memo.find({
            sender: req.user._id,
            recipient: { $ne: req.user._id }, // Exclude memos sent to the secretary themselves
            status: { $in: ['archived', 'sent', 'approved'] },
            activityType: { $ne: 'system_notification' }
        })
            .sort({ createdAt: -1 })
            .populate('recipient', 'firstName lastName email profilePicture department');

        // Get archived calendar events created by the secretary
        const archivedEvents = await CalendarEvent.find({
            createdBy: req.user._id,
            category: 'archived'
        })
            .sort({ createdAt: -1 })
            .populate('createdBy', 'firstName lastName email');

        return res.render('secretary-archive', {
            user: req.user,
            path: '/secretary/archive',
            archivedMemos: archivedMemos || [],
            archivedEvents: archivedEvents || []
        });
    } catch (e) {
        console.error('Error fetching archived memos:', e);
        return res.render('secretary-archive', {
            user: req.user,
            path: '/secretary/archive',
            archivedMemos: [],
            archivedEvents: []
        });
    }
});

// Admin archive page - only for admins
app.get('/admin/archive', isAuthenticated, validateUserRole, isAdmin, async (req, res) => {
    try {
        const Signature = require('./backend/models/Signature');

        // Get archived memos OR sent/approved memos that can be archived
        // Include memos where the admin is the sender but NOT the recipient
        // Exclude the tracking memo where recipient equals sender
        const archivedMemos = await Memo.find({
            sender: req.user._id,
            recipient: { $ne: req.user._id }, // Exclude memos sent to the admin themselves
            status: { $in: ['archived', 'sent', 'approved'] },
            activityType: { $ne: 'system_notification' }
        })
            .sort({ createdAt: -1 })
            .populate('recipient', 'firstName lastName email profilePicture department');

        // Get archived calendar events created by the admin
        const archivedEvents = await CalendarEvent.find({
            createdBy: req.user._id,
            category: 'archived'
        })
            .sort({ createdAt: -1 })
            .populate('createdBy', 'firstName lastName email');

        // Get archived signatures
        const archivedSignatures = await Signature.find({
            isActive: false
        })
            .sort({ updatedAt: -1, createdAt: -1 })
            .populate('createdBy', 'firstName lastName email');

        return res.render('admin-archive', {
            user: req.user,
            path: '/admin/archive',
            archivedMemos: archivedMemos || [],
            archivedEvents: archivedEvents || [],
            archivedSignatures: archivedSignatures || []
        });
    } catch (e) {
        console.error('Error fetching archived items:', e);
        return res.render('admin-archive', {
            user: req.user,
            path: '/admin/archive',
            archivedMemos: [],
            archivedEvents: [],
            archivedSignatures: []
        });
    }
});

// Faculty memos page - only for faculty
app.get('/faculty/memos', isAuthenticated, validateUserRole, requireRole('faculty'), async (req, res) => {
    try {
        // Get memos received by faculty (only sent/approved status, not pending)
        // Exclude acknowledgment notifications
        const received = await Memo.find({
            recipient: req.user._id,
            status: { $in: ['sent', 'approved'] },
            activityType: { $ne: 'system_notification' },
            // Exclude acknowledgment notifications
            $nor: [
                { 'metadata.notificationType': 'acknowledgment' },
                { subject: /^Memo Acknowledged:/i }
            ]
        })
            .sort({ createdAt: -1 })
            .populate('sender', 'firstName lastName email profilePicture department')
            .populate('recipient', 'firstName lastName email profilePicture department');
        return res.render('faculty-memos', { user: req.user, path: '/faculty/memos', received });
    } catch (e) {
        return res.render('faculty-memos', { user: req.user, path: '/faculty/memos', received: [] });
    }
});

// Faculty archive page - only for faculty
app.get('/faculty/archive', isAuthenticated, validateUserRole, requireRole('faculty'), async (req, res) => {
    try {
        // Get archived memos received by faculty
        const archivedMemos = await Memo.find({
            recipient: req.user._id,
            status: 'archived',
            activityType: { $ne: 'system_notification' }
        })
            .sort({ createdAt: -1 })
            .populate('sender', 'firstName lastName email profilePicture department')
            .populate('recipient', 'firstName lastName email profilePicture department');
        return res.render('faculty-archive', { user: req.user, path: '/faculty/archive', archivedMemos: archivedMemos || [] });
    } catch (e) {
        console.error('Error fetching archived memos:', e);
        return res.render('faculty-archive', { user: req.user, path: '/faculty/archive', archivedMemos: [] });
    }
});

// Log route - redirect faculty to their memos page
app.get('/log', (req, res) => {
    if (req.isAuthenticated()) {
        // Redirect faculty to their own memos page
        if (req.user && req.user.role === 'faculty') {
            return res.redirect('/faculty/memos');
        }
        // Admins and secretaries go to admin log
        res.render('admin/log', {
            user: req.user,
            path: '/log'
        });
    } else {
        res.redirect('/');
    }
});

// Import and use admin routes
const adminRoutes = require('./frontend/routes/adminRoutes');

// Mount admin routes - all admin routes will be protected by isAdmin middleware
app.use('/', adminRoutes);

// Error handling middleware
const errorHandler = require('./backend/middleware/errorHandler');
app.use(errorHandler);

// Start server

// Listen on all network interfaces (0.0.0.0) to allow remote access
// For localhost-only access, use: app.listen(port, 'localhost', ...)
app.listen(port, '0.0.0.0', () => {
    const localIP = require('os').networkInterfaces();
    const ipv4 = Object.values(localIP)
        .flat()
        .find(i => i.family === 'IPv4' && !i.internal)?.address;
    console.info(`Server is running at http://localhost:${port}`);
    if (ipv4) {
        console.info(`Server also accessible at http://${ipv4}:${port}`);
    }
});
