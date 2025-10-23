require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const connectDB = require('./backend/config/db');
const passport = require('./backend/config/passport');
const authRoutes = require('./backend/routes/auth');
const passwordRoutes = require('./backend/routes/passwordRoutes');

// Connect to MongoDB
connectDB();

const app = express();
const port = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.google.com", "https://www.gstatic.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://www.google.com"],
            imgSrc: ["'self'", "data:", "https:", "https://www.google.com"],
            frameSrc: ["'self'", "https://www.google.com"]
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
app.use('/auth', authRoutes);

// Serve static files from frontend/public
app.use(express.static(path.join(__dirname, 'frontend/public')));
app.use('/css', express.static(path.join(__dirname, 'frontend/public/css')));
app.use('/images', express.static(path.join(__dirname, 'frontend/public/images')));
app.use('/js', express.static(path.join(__dirname, 'frontend/public/js')));
app.use(express.static(path.join(__dirname, 'frontend/components')));

// Set up EJS
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'frontend/views'));
app.set('layout', path.join(__dirname, 'frontend/components/layouts/Loginlayout.ejs'));
app.set("views", [
  path.join(__dirname, "frontend", "views"),
  path.join(__dirname, "frontend", "components")
]);


// Pass environment variables to views
app.use((req, res, next) => {
    res.locals.RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY;
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
app.get('/dashboard', (req, res) => {
    if (req.isAuthenticated()) {
        res.render('dashboard', { user: req.user });
    } else {
        res.redirect('/');
    }
});

// Error handling middleware
const errorHandler = require('./backend/middleware/errorHandler');
app.use(errorHandler);

// Start server
app.listen(port, () => {
    console.info(`Server is running at http://localhost:${port}`);
});

// temporary route for admin dashboard
app.get("/admin-dashboard", (req, res) => {
  res.render("admin-dashboard", {
    title: "Admin Dashboard",
    adminName: "Queen Niña"
  });
});
