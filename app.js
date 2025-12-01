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

// Force HTTPS in production (Render uses HTTPS)
if (process.env.NODE_ENV === 'production' ||
    (process.env.BASE_URL && process.env.BASE_URL.startsWith('https://'))) {
    app.use((req, res, next) => {
        // Check if request is HTTP (not HTTPS)
        if (req.header('x-forwarded-proto') !== 'https' && req.protocol !== 'https') {
            // Redirect to HTTPS version
            return res.redirect(301, `https://${req.header('host')}${req.url}`);
        }
        next();
    });
}

// Session configuration
// Determine if we're in production (HTTPS) - check both NODE_ENV and BASE_URL
const isProduction = process.env.NODE_ENV === 'production' ||
                     (process.env.BASE_URL && process.env.BASE_URL.startsWith('https://'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction, // true for HTTPS (production), false for HTTP (localhost)
        httpOnly: true,
        sameSite: 'lax', // Works for same-site requests (OAuth callback is same domain)
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        // Don't set domain - let browser handle it automatically
    },
    name: 'connect.sid' // Explicit session cookie name
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
app.use('/api/system', require('./backend/routes/systemRoutes'));
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
        return res.render('admin/settings', {
            pageTitle: 'Admin Settings | Memofy',
            user: req.user,
            path: '/settings'
        });
    }
    if (role === 'secretary') {
        return res.render('secretary-settings', {
            pageTitle: 'Secretary Settings | Memofy',
            user: req.user,
            path: '/settings'
        });
    }
    if (role === 'faculty') {
        return res.render('faculty-settings', {
            pageTitle: 'Faculty Settings | Memofy',
            user: req.user,
            path: '/settings'
        });
    }
    return res.redirect('/login');
});

// Serve static files from frontend/public
app.use(express.static(path.join(__dirname, 'frontend/public')));
app.use('/css', express.static(path.join(__dirname, 'frontend/public/css')));
app.use('/images', express.static(path.join(__dirname, 'frontend/public/images')));
app.use('/js', express.static(path.join(__dirname, 'frontend/public/js')));
// Serve uploads with cache-control headers to prevent aggressive caching of profile pictures
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, path) => {
        // For profile pictures, use shorter cache time to ensure updates are visible
        if (path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
        }
    }
}));

// Routes
app.get('/', (req, res) => {
    res.render('login', { pageTitle: 'Memofy Login Page' }); // frontend/views/login.ejs
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
            pageTitle: 'Memofy Login Page',
            showMinimalMessageModal: true,
            modalTitle: 'Account Not Found',
            modalMessage: message || 'Your account has not been added by an administrator. Please contact your administrator to create your account.',
            modalType: 'error'
        });
    }
    if (error || message) {
        return res.render('login', {
            pageTitle: 'Memofy Login Page',
            showMessageModal: true,
            modalTitle: error ? 'Login Error' : 'Message',
            modalMessage: message || 'Authentication failed. Please try again.',
            modalType: 'error'
        });
    }
    return res.render('login', { pageTitle: 'Memofy Login Page' });
});

// Admin Calendar
app.get('/calendar', isAuthenticated, (req, res) => {
    const role = req.user?.role;
    if (role === 'admin') {
        return res.render('admin/calendar', {
            pageTitle: 'Admin Calendar | Memofy',
            user: req.user,
            path: '/calendar'
        });
    }
    if (role === 'secretary') {
        return res.redirect('/secretary/calendar');
    }
    return res.redirect('/dashboard');
});

// Secretary Calendar - only for secretaries (admin blocked)
app.get('/secretary/calendar', isAuthenticated, validateUserRole, requireRole('secretary'), (req, res) => {
    return res.render('secretary-calendar', {
        pageTitle: 'Secretary Calendar | Memofy',
        user: req.user,
        path: '/calendar'
    });
});

// Faculty Calendar - view-only, only for faculty
app.get('/faculty/calendar', isAuthenticated, validateUserRole, requireRole('faculty'), (req, res) => {
    return res.render('faculty-calendar', {
        pageTitle: 'Faculty Calendar | Memofy',
        user: req.user,
        path: '/faculty/calendar'
    });
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
// OPTIMIZED: Render page immediately, load memos via API (non-blocking)
app.get('/admin-dashboard', isAuthenticated, validateUserRole, isAdmin, async (req, res) => {
    // Render page immediately without blocking queries
    // Memos and stats will be loaded via API call after page loads (see admin-dashboard.ejs)
    return res.render('admin-dashboard', {
        pageTitle: 'Admin Dashboard | Memofy',
        user: req.user,
        path: '/admin-dashboard',
        allMemos: [] // Empty array - will be loaded via API
    });
});

// Secretary Dashboard route - SECRETARY ONLY
// OPTIMIZED: Render page immediately, load memos via API (non-blocking)
app.get('/secretary-dashboard', isAuthenticated, validateUserRole, requireRole('secretary'), async (req, res) => {
    // Render page immediately without blocking queries
    // Memos will be loaded via API call after page loads (see secretary-dashboard.ejs)
    return res.render('secretary-dashboard', {
        pageTitle: 'Secretary Dashboard | Memofy',
        user: req.user,
        path: '/secretary-dashboard',
        memos: [] // Empty array - will be loaded via API
    });
});

// Faculty Dashboard route - FACULTY ONLY
app.get('/faculty-dashboard', isAuthenticated, validateUserRole, requireRole('faculty'), async (req, res) => {
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
            pageTitle: 'Faculty Dashboard | Memofy',
            user: req.user,
            path: '/faculty-dashboard',
            receivedMemos: receivedMemos || [],
            totalReceived: totalReceived || 0
        });
    } catch (e) {
        console.error('Error fetching faculty dashboard data:', e);
        return res.render('faculty-dashboard', {
            pageTitle: 'Faculty Dashboard | Memofy',
            user: req.user,
            path: '/faculty-dashboard',
            receivedMemos: [],
            totalReceived: 0
        });
    }
});

// Legacy /dashboard route - redirects to appropriate dashboard based on role
app.get('/dashboard', isAuthenticated, validateUserRole, (req, res) => {
    const role = (req.user && req.user.role) || '';
    if (role === 'admin') {
        return res.redirect('/admin-dashboard');
    } else if (role === 'secretary') {
        return res.redirect('/secretary-dashboard');
    } else if (role === 'faculty') {
        return res.redirect('/faculty-dashboard');
    } else {
        return res.redirect('/login');
    }
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
        return res.render('secretary-memos', {
            pageTitle: 'Secretary Memos | Memofy',
            user: req.user,
            path: '/secretary/memos',
            memos,
            received
        });
    } catch (e) {
        return res.render('secretary-memos', {
            pageTitle: 'Secretary Memos | Memofy',
            user: req.user,
            path: '/secretary/memos',
            memos: [],
            received: []
        });
    }
});

// Secretary archive page - only for secretaries (admin blocked)
app.get('/secretary/archive', isAuthenticated, validateUserRole, requireRole('secretary'), async (req, res) => {
    try {
        const User = require('./backend/models/User');
        // OPTIMIZED: Parallelize queries and use batch fetch instead of populate
        const [archivedMemosRaw, archivedEventsRaw] = await Promise.all([
            // Get archived memos (limit to 100 for performance, add pagination later if needed)
            Memo.find({
                sender: req.user._id,
                recipient: { $ne: req.user._id },
                status: { $in: ['archived', 'sent', 'approved'] },
                activityType: { $ne: 'system_notification' }
            })
                .select('subject status priority createdAt department recipient')
                .sort({ createdAt: -1 })
                .limit(100)
                .lean(),
            // Get archived calendar events
            CalendarEvent.find({
                createdBy: req.user._id,
                category: 'archived'
            })
                .select('title description startDate endDate createdBy')
                .sort({ createdAt: -1 })
                .limit(50)
                .lean()
        ]);

        // Batch fetch users (much faster than populate)
        const recipientIds = [...new Set(archivedMemosRaw.map(m => m.recipient).filter(Boolean))];
        const eventCreatorIds = [...new Set(archivedEventsRaw.map(e => e.createdBy).filter(Boolean))];
        const allUserIds = [...new Set([...recipientIds, ...eventCreatorIds])];

        const users = allUserIds.length > 0 ? await User.find({ _id: { $in: allUserIds } })
            .select('firstName lastName email profilePicture department')
            .lean() : [];

        const userMap = new Map(users.map(u => [u._id.toString(), u]));

        // Map users to memos and events
        const archivedMemos = archivedMemosRaw.map(memo => ({
            ...memo,
            recipient: memo.recipient ? userMap.get(memo.recipient.toString()) : null
        }));

        const archivedEvents = archivedEventsRaw.map(event => ({
            ...event,
            createdBy: event.createdBy ? userMap.get(event.createdBy.toString()) : null
        }));

        return res.render('secretary-archive', {
            pageTitle: 'Secretary Archive | Memofy',
            user: req.user,
            path: '/secretary/archive',
            archivedMemos: archivedMemos || [],
            archivedEvents: archivedEvents || []
        });
    } catch (e) {
        console.error('Error fetching archived memos:', e);
        return res.render('secretary-archive', {
            pageTitle: 'Secretary Archive | Memofy',
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
        const User = require('./backend/models/User');

        // System-generated activity types to exclude from archive
        const systemActivityTypes = [
            'user_activity',
            'system_notification',
            'user_deleted',
            'password_reset',
            'welcome_email',
            'user_profile_edited'
        ];

        // OPTIMIZED: Parallelize all queries and use batch fetch instead of populate
        const [archivedMemosRaw, archivedEventsRaw, archivedSignaturesRaw] = await Promise.all([
            // Get archived memos (limit to 100 for performance)
            Memo.find({
                $and: [
                    {
                        $or: [
                            { sender: req.user._id },
                            { recipient: req.user._id }
                        ]
                    },
                    {
                        status: { $in: ['archived', 'approved'] },
                        activityType: { $nin: systemActivityTypes }
                    }
                ]
            })
                .select('subject status priority createdAt department sender recipient')
                .sort({ createdAt: -1 })
                .limit(100)
                .lean(),
            // Get archived calendar events
            CalendarEvent.find({
                createdBy: req.user._id,
                category: 'archived'
            })
                .select('title description startDate endDate createdBy')
                .sort({ createdAt: -1 })
                .limit(50)
                .lean(),
            // Get archived signatures
            Signature.find({
                isActive: false
            })
                .select('name imageUrl order createdBy updatedAt createdAt')
                .sort({ updatedAt: -1, createdAt: -1 })
                .limit(50)
                .lean()
        ]);

        // Batch fetch all users at once
        const senderIds = [...new Set(archivedMemosRaw.map(m => m.sender).filter(Boolean))];
        const recipientIds = [...new Set(archivedMemosRaw.map(m => m.recipient).filter(Boolean))];
        const eventCreatorIds = [...new Set(archivedEventsRaw.map(e => e.createdBy).filter(Boolean))];
        const signatureCreatorIds = [...new Set(archivedSignaturesRaw.map(s => s.createdBy).filter(Boolean))];
        const allUserIds = [...new Set([...senderIds, ...recipientIds, ...eventCreatorIds, ...signatureCreatorIds])];

        const users = allUserIds.length > 0 ? await User.find({ _id: { $in: allUserIds } })
            .select('firstName lastName email profilePicture department role')
            .lean() : [];

        const userMap = new Map(users.map(u => [u._id.toString(), u]));

        // Map users to memos, events, and signatures
        const archivedMemos = archivedMemosRaw.map(memo => ({
            ...memo,
            sender: memo.sender ? userMap.get(memo.sender.toString()) : null,
            recipient: memo.recipient ? userMap.get(memo.recipient.toString()) : null
        }));

        const archivedEvents = archivedEventsRaw.map(event => ({
            ...event,
            createdBy: event.createdBy ? userMap.get(event.createdBy.toString()) : null
        }));

        const archivedSignatures = archivedSignaturesRaw.map(signature => ({
            ...signature,
            createdBy: signature.createdBy ? userMap.get(signature.createdBy.toString()) : null
        }));

        return res.render('admin-archive', {
            pageTitle: 'Admin Archive | Memofy',
            user: req.user,
            path: '/admin/archive',
            archivedMemos: archivedMemos || [],
            archivedEvents: archivedEvents || [],
            archivedSignatures: archivedSignatures || []
        });
    } catch (e) {
        console.error('Error fetching archived items:', e);
        return res.render('admin-archive', {
            pageTitle: 'Admin Archive | Memofy',
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
        return res.render('faculty-memos', {
            pageTitle: 'Faculty Memos | Memofy',
            user: req.user,
            path: '/faculty/memos',
            received
        });
    } catch (e) {
        return res.render('faculty-memos', {
            pageTitle: 'Faculty Memos | Memofy',
            user: req.user,
            path: '/faculty/memos',
            received: []
        });
    }
});

// Faculty archive page - only for faculty
app.get('/faculty/archive', isAuthenticated, validateUserRole, requireRole('faculty'), async (req, res) => {
    try {
        const User = require('./backend/models/User');

        // OPTIMIZED: Fetch memos without populate, then batch fetch users
        const archivedMemosRaw = await Memo.find({
            recipient: req.user._id,
            status: 'archived',
            activityType: { $ne: 'system_notification' }
        })
            .select('subject status priority createdAt department sender recipient')
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        // Batch fetch users (much faster than populate)
        const senderIds = [...new Set(archivedMemosRaw.map(m => m.sender).filter(Boolean))];
        const recipientIds = [...new Set(archivedMemosRaw.map(m => m.recipient).filter(Boolean))];
        const allUserIds = [...new Set([...senderIds, ...recipientIds])];

        const users = allUserIds.length > 0 ? await User.find({ _id: { $in: allUserIds } })
            .select('firstName lastName email profilePicture department')
            .lean() : [];

        const userMap = new Map(users.map(u => [u._id.toString(), u]));

        // Map users to memos
        const archivedMemos = archivedMemosRaw.map(memo => ({
            ...memo,
            sender: memo.sender ? userMap.get(memo.sender.toString()) : null,
            recipient: memo.recipient ? userMap.get(memo.recipient.toString()) : null
        }));

        return res.render('faculty-archive', {
            pageTitle: 'Faculty Archive | Memofy',
            user: req.user,
            path: '/faculty/archive',
            archivedMemos: archivedMemos || []
        });
    } catch (e) {
        console.error('Error fetching archived memos:', e);
        return res.render('faculty-archive', {
            pageTitle: 'Faculty Archive | Memofy',
            user: req.user,
            path: '/faculty/archive',
            archivedMemos: []
        });
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
            pageTitle: 'Activity Log | Memofy',
            user: req.user,
            path: '/log'
        });
    } else {
        res.redirect('/');
    }
});

// Note: Admin routes are already mounted at /admin prefix (see line 189)
// This prevents conflicts with faculty-dashboard and secretary-dashboard routes

// Error handling middleware
const errorHandler = require('./backend/middleware/errorHandler');
app.use(errorHandler);

// Start server

// Listen on all network interfaces (0.0.0.0) to allow remote access
// For localhost-only access, use: app.listen(port, 'localhost', ...)
app.listen(port, '0.0.0.0', () => {
    console.info(`Server is running at http://localhost:${port}`);
});
