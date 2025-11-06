require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const connectDB = require('./backend/config/db');
const passport = require('./backend/config/passport');
const isAdmin = require('./backend/middleware/isAdmin');
const isAuthenticated = require('./backend/middleware/isAuthenticated');
const Memo = require('./backend/models/Memo');
const authRoutes = require('./backend/routes/auth');
const passwordRoutes = require('./backend/routes/passwordRoutes');
const userRoutes = require('./backend/routes/userRoutes');
const forgotPasswordRoutes = require('./backend/routes/forgotPasswordRoutes');
const logRoutes = require('./backend/routes/logRoutes');
const driveRoutes = require('./backend/routes/driveRoutes');
const calendarRoutes = require('./backend/routes/calendarRoutes');
const auditRoutes = require('./backend/routes/auditRoutes');

// Connect to MongoDB
connectDB();

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
                "https://unpkg.com", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://www.google.com",
                "https://www.gstatic.com", "https://fonts.googleapis.com",
                "https://cdn.jsdelivr.net"],
            styleSrcElem: ["'self'", "'unsafe-inline'", "https://www.gstatic.com",
                "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "https://www.google.com",
                "https://www.gstatic.com", "https://developers.google.com"],
            frameSrc: ["'self'", "https://www.google.com", "https://accounts.google.com", "https://*.google.com"],
            connectSrc: ["'self'", "https://unpkg.com", "https://www.googleapis.com",
                "https://accounts.google.com", "https://*.google.com", "https://*.googleapis.com"]
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
// Public invite routes (render and completion)
app.get('/invite/:token', require('./backend/controllers/inviteController').renderInvitePage);
app.post('/invite/complete', require('./backend/controllers/inviteController').completeInvite);
app.use('/api/log', logRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/audit', auditRoutes);
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
app.use('/auth', authRoutes);
app.use('/', forgotPasswordRoutes); // Forgot password routes
app.use('/admin', require('./frontend/routes/adminRoutes'));

// Serve static files from frontend/public
app.use(express.static(path.join(__dirname, 'frontend/public')));
app.use('/css', express.static(path.join(__dirname, 'frontend/public/css')));
app.use('/images', express.static(path.join(__dirname, 'frontend/public/images')));
app.use('/js', express.static(path.join(__dirname, 'frontend/public/js')));
<<<<<<< HEAD
app.use(express.static(path.join(__dirname, 'frontend/components')));
=======
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
>>>>>>> 24a06b666f6b0504be8e4daa1ac7cad27a20491d

// Set up EJS
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'frontend/views'));
app.set('layout', path.join(__dirname, 'frontend/components/layouts/Loginlayout.ejs'));
app.set("views", [
  path.join(__dirname, "frontend", "views"),
  path.join(__dirname, "frontend", "components")
]);


// Pass environment variables and path to views
app.use((req, res, next) => {
    res.locals.RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY;
    res.locals.path = req.path; // Make current path available to all views
    next();
});

// Routes
app.get('/', (req, res) => {
    res.render('login'); // frontend/views/login.ejs
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

// Secretary Calendar (duplicate layout using secretary components)
app.get('/secretary/calendar', isAuthenticated, (req, res) => {
    const role = req.user?.role;
    if (role === 'secretary') {
        return res.render('secretary-calendar', { user: req.user, path: '/calendar' });
    }
    return res.redirect('/calendar');
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
app.get('/admin-dashboard', isAdmin, async (req, res) => {
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

// Unified dashboard route for non-admin roles
app.get('/dashboard', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/');
    }
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
        return res.render('faculty-dashboard', { user: req.user, path: '/dashboard' });
    }
    // Fallback for any other roles
    return res.redirect('/admin-dashboard');
});

// Secretary memos page - only for secretaries
app.get('/secretary/memos', async (req, res) => {
    if (!req.isAuthenticated()) { return res.redirect('/'); }
    if (!req.user || req.user.role !== 'secretary') { return res.redirect('/admin-dashboard'); }
    try {
        const memos = await Memo.find({ createdBy: req.user._id }).sort({ createdAt: -1 })
            .populate('recipient', 'firstName lastName email');
        const received = await Memo.find({ recipient: req.user._id, status: { $ne: 'deleted' }, activityType: { $ne: 'pending_memo' } })
            .sort({ createdAt: -1 })
            .populate('sender', 'firstName lastName email');
        return res.render('secretary-memos', { user: req.user, path: '/secretary/memos', memos, received });
    } catch (e) {
        return res.render('secretary-memos', { user: req.user, path: '/secretary/memos', memos: [], received: [] });
    }
});

// Faculty memos page - only for faculty
app.get('/faculty/memos', async (req, res) => {
    if (!req.isAuthenticated()) { return res.redirect('/'); }
    if (!req.user || req.user.role !== 'faculty') { return res.redirect('/dashboard'); }
    try {
        // Get memos received by faculty (only sent/approved status, not pending)
        const received = await Memo.find({
            recipient: req.user._id,
            status: { $in: ['sent', 'approved'] },
            activityType: { $ne: 'system_notification' }
        })
            .sort({ createdAt: -1 })
            .populate('sender', 'firstName lastName email profilePicture department')
            .populate('recipient', 'firstName lastName email profilePicture department');
        return res.render('faculty-memos', { user: req.user, path: '/faculty/memos', received });
    } catch (e) {
        return res.render('faculty-memos', { user: req.user, path: '/faculty/memos', received: [] });
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

// temporary route for admin dashboard
app.get("/admin-dashboard", (req, res) => {
  res.render("admin-dashboard", {
    title: "Admin Dashboard",
    adminName: "Queen Niña"
  });
});
