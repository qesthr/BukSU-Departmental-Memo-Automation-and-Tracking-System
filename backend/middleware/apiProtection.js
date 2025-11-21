/**
 * API Protection Middleware
 *
 * Comprehensive security middleware for protecting public and private APIs
 * Includes rate limiting, request validation, and security headers
 */

const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

/**
 * Rate Limiter Configurations
 */

// General API rate limiter (100 requests per 15 minutes per IP)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for authenticated admin users
        return req.isAuthenticated && req.user && req.user.role === 'admin';
    }
});

// Strict rate limiter for public endpoints (5 requests per 15 minutes)
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Authentication endpoints rate limiter (5 requests per 15 minutes)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: 'Too many login attempts, please try again later.'
    },
    skipSuccessfulRequests: true, // Don't count successful logins
    standardHeaders: true,
    legacyHeaders: false,
});

// File upload rate limiter (10 uploads per hour)
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: {
        success: false,
        message: 'Too many file uploads, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * API Key Authentication Middleware
 * For public APIs that need API key authentication
 */
const apiKeyAuth = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;

    // Skip if user is already authenticated
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }

    if (!apiKey) {
        return res.status(401).json({
            success: false,
            message: 'API key required. Provide it in X-API-Key header or apiKey query parameter.'
        });
    }

    try {
        // Validate API key from database
        const SystemSetting = require('../models/SystemSetting');
        const apiKeysSetting = await SystemSetting.get('api_keys');

        if (!apiKeysSetting) {
            return res.status(503).json({
                success: false,
                message: 'API key authentication not configured'
            });
        }

        const validKeys = JSON.parse(apiKeysSetting);

        if (!Array.isArray(validKeys) || !validKeys.includes(apiKey)) {
            return res.status(403).json({
                success: false,
                message: 'Invalid API key'
            });
        }

        // Optional: Track API usage
        // You can log API usage here for analytics

        next();
    } catch (error) {
        console.error('API key validation error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error validating API key'
        });
    }
};

/**
 * Request Validation Middleware
 * Validates and sanitizes request data
 */
const validateRequest = (validations) => {
    return async (req, res, next) => {
        // Run all validations
        await Promise.all(validations.map(validation => validation.run(req)));

        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        next();
    };
};

/**
 * Common Validation Rules
 */
const validationRules = {
    email: body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Invalid email address'),

    password: body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

    mongoId: (field) => body(field)
        .isMongoId()
        .withMessage(`Invalid ${field} ID`),

    subject: body('subject')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Subject must be between 1 and 200 characters')
        .escape(),

    memoContent: body('content')
        .optional()
        .isLength({ max: 10000 })
        .withMessage('Content must not exceed 10000 characters'),

    department: body('department')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Department name too long')
        .escape(),

    priority: body('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'urgent'])
        .withMessage('Invalid priority level'),
};

/**
 * Input Sanitization Middleware
 * Prevents NoSQL injection and XSS attacks
 */
const sanitizeInput = [
    // Prevent NoSQL injection
    mongoSanitize({
        replaceWith: '_',
        onSanitize: ({ req, key }) => {
            console.warn(`Sanitized NoSQL injection attempt: ${key} in ${req.path}`);
        }
    }),

    // Prevent XSS attacks
    xss({
        whitelist: {
            // Allow specific HTML tags for memo content
            p: [],
            br: [],
            strong: [],
            em: [],
            u: [],
            h1: [],
            h2: [],
            h3: [],
            ul: [],
            ol: [],
            li: []
        }
    })
];

/**
 * Request Size Limiter
 * Prevents large payload attacks
 */
const requestSizeLimiter = (maxSize = '10mb') => {
    return (req, res, next) => {
        const contentLength = parseInt(req.headers['content-length'] || '0');
        const maxBytes = parseSize(maxSize);

        if (contentLength > maxBytes) {
            return res.status(413).json({
                success: false,
                message: `Request payload too large. Maximum size: ${maxSize}`
            });
        }

        next();
    };
};

/**
 * Parse size string to bytes
 */
function parseSize(size) {
    const units = {
        'kb': 1024,
        'mb': 1024 * 1024,
        'gb': 1024 * 1024 * 1024
    };

    const match = size.toLowerCase().match(/^(\d+)(kb|mb|gb)$/);
    if (!match) {return 10 * 1024 * 1024;} // Default 10MB

    return parseInt(match[1]) * units[match[2]];
}

/**
 * API Usage Logger
 * Logs API requests for monitoring and security analysis
 */
const apiLogger = (req, res, next) => {
    const start = Date.now();

    // Log request details
    const requestInfo = {
        method: req.method,
        path: req.path,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        timestamp: new Date().toISOString(),
        userId: req.user ? req.user._id : null,
        userRole: req.user ? req.user.role : null
    };

    // Log response details when finished
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            ...requestInfo,
            status: res.statusCode,
            duration: `${duration}ms`,
            contentLength: res.get('content-length') || 0
        };

        // Log to console (in production, use proper logging service)
        if (process.env.NODE_ENV === 'development') {
            console.log(`[API] ${logData.method} ${logData.path} - ${logData.status} (${logData.duration})`);
        }

        // Alert on suspicious activity
        if (res.statusCode === 401 || res.statusCode === 403) {
            console.warn(`[SECURITY] Unauthorized access attempt:`, logData);
            // In production, send alert to security team
        }

        // Log to database if needed (for audit trail)
        // await AuditLog.create({ ...logData, type: 'api_request' });
    });

    next();
};

/**
 * CORS Configuration Helper
 * Returns CORS middleware with specific origin restrictions
 */
const corsConfig = (allowedOrigins = []) => {
    const defaultOrigins = [
        process.env.FRONTEND_URL,
        'https://buksu.edu.ph'
    ];

    const origins = [...defaultOrigins, ...allowedOrigins].filter(Boolean);

    return (req, res, next) => {
        const origin = req.headers.origin;

        // Allow requests with no origin (mobile apps, Postman, etc.) in development
        if (!origin && process.env.NODE_ENV === 'development') {
            return next();
        }

        if (origin && origins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
        }

        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }

        next();
    };
};

module.exports = {
    // Rate limiters
    apiLimiter,
    strictLimiter,
    authLimiter,
    uploadLimiter,

    // Authentication
    apiKeyAuth,

    // Validation
    validateRequest,
    validationRules,

    // Sanitization
    sanitizeInput,

    // Other utilities
    requestSizeLimiter,
    apiLogger,
    corsConfig
};

