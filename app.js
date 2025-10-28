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
const authRoutes = require('./backend/routes/auth');
const passwordRoutes = require('./backend/routes/passwordRoutes');
const userRoutes = require('./backend/routes/userRoutes');
const forgotPasswordRoutes = require('./backend/routes/forgotPasswordRoutes');
const logRoutes = require('./backend/routes/logRoutes');
const driveRoutes = require('./backend/routes/driveRoutes');
const calendarRoutes = require('./backend/routes/calendarRoutes');

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
                "https://unpkg.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://www.google.com",
                "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "https://www.google.com",
                "https://developers.google.com"],
            frameSrc: ["'self'", "https://www.google.com", "https://accounts.google.com", "https://*.google.com"],
            connectSrc: ["'self'", "https://unpkg.com", "https://www.googleapis.com",
                "https://accounts.google.com", "https://*.google.com", "https://*.googleapis.com"]
        },
    },
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
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
app.use('/auth', authRoutes);
app.use('/', forgotPasswordRoutes); // Forgot password routes
app.use('/admin', require('./frontend/routes/adminRoutes'));

// Serve static files from frontend/public
app.use(express.static(path.join(__dirname, 'frontend/public')));
app.use('/css', express.static(path.join(__dirname, 'frontend/public/css')));
app.use('/images', express.static(path.join(__dirname, 'frontend/public/images')));
app.use('/js', express.static(path.join(__dirname, 'frontend/public/js')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Set up EJS
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'frontend/views'));
app.set('layout', path.join(__dirname, 'frontend/components/layouts/Loginlayout.ejs'));

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
app.get('/admin-dashboard', isAdmin, (req, res) => {
    res.render('admin-dashboard', {
        user: req.user,
        path: '/admin-dashboard'
    });
});

// Log route - protected
app.get('/log', (req, res) => {
    if (req.isAuthenticated()) {
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

app.listen(port, () => {
    console.info(`Server is running at http://localhost:${port}`);
});
