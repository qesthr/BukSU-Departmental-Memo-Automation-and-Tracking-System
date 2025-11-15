/**
 * Helper Utilities for BukSU Memo System
 *
 * Reusable helper functions for common operations
 */

const crypto = require('crypto');
const {
    USER_ROLES,
    ROLE_PERMISSIONS,
    MEMO_STATUS,
    MEMO_PRIORITY
} = require('./constants');

/**
 * Generate random token
 * @param {number} length - Token length in bytes (default: 32)
 * @returns {string} - Random hex token
 */
function generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate secure random string
 * @param {number} length - String length
 * @returns {string} - Random alphanumeric string
 */
function generateRandomString(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
}

/**
 * Check if user has specific permission
 * @param {object} user - User object with role
 * @param {string} permission - Permission to check
 * @returns {boolean} - True if user has permission
 */
function hasPermission(user, permission) {
    if (!user || !user.role) {
        return false;
    }

    const permissions = ROLE_PERMISSIONS[user.role];
    if (!permissions) {
        return false;
    }

    return permissions[permission] === true;
}

/**
 * Check if user is admin
 * @param {object} user - User object
 * @returns {boolean} - True if user is admin
 */
function isAdmin(user) {
    return user && user.role === USER_ROLES.ADMIN;
}

/**
 * Check if user is secretary
 * @param {object} user - User object
 * @returns {boolean} - True if user is secretary
 */
function isSecretary(user) {
    return user && user.role === USER_ROLES.SECRETARY;
}

/**
 * Check if user is faculty
 * @param {object} user - User object
 * @returns {boolean} - True if user is faculty
 */
function isFaculty(user) {
    return user && user.role === USER_ROLES.FACULTY;
}

/**
 * Check if user can create memos
 * @param {object} user - User object
 * @returns {boolean} - True if user can create memos
 */
function canCreateMemo(user) {
    return hasPermission(user, 'canCreateMemo');
}

/**
 * Check if user can approve memos
 * @param {object} user - User object
 * @returns {boolean} - True if user can approve memos
 */
function canApproveMemo(user) {
    return hasPermission(user, 'canApproveMemo');
}

/**
 * Check if memo is in pending status
 * @param {object} memo - Memo object
 * @returns {boolean} - True if memo is pending
 */
function isPendingMemo(memo) {
    return memo && memo.status === MEMO_STATUS.PENDING;
}

/**
 * Check if memo is approved
 * @param {object} memo - Memo object
 * @returns {boolean} - True if memo is approved
 */
function isApprovedMemo(memo) {
    return memo && memo.status === MEMO_STATUS.APPROVED;
}

/**
 * Check if memo is rejected
 * @param {object} memo - Memo object
 * @returns {boolean} - True if memo is rejected
 */
function isRejectedMemo(memo) {
    return memo && memo.status === MEMO_STATUS.REJECTED;
}

/**
 * Check if memo is urgent priority
 * @param {object} memo - Memo object
 * @returns {boolean} - True if memo is urgent
 */
function isUrgentMemo(memo) {
    return memo && memo.priority === MEMO_PRIORITY.URGENT;
}

/**
 * Get user's display name
 * @param {object} user - User object
 * @returns {string} - Display name
 */
function getUserDisplayName(user) {
    if (!user) {
        return 'Unknown User';
    }

    if (user.firstName && user.lastName) {
        return `${user.firstName} ${user.lastName}`;
    }

    if (user.email) {
        return user.email;
    }

    return 'Unknown User';
}

/**
 * Extract email domain
 * @param {string} email - Email address
 * @returns {string} - Email domain
 */
function getEmailDomain(email) {
    if (!email || typeof email !== 'string') {
        return '';
    }

    const parts = email.toLowerCase().trim().split('@');
    return parts.length === 2 ? parts[1] : '';
}

/**
 * Check if email is from BukSU domain
 * @param {string} email - Email address
 * @returns {boolean} - True if BukSU email
 */
function isBukSuEmail(email) {
    const domain = getEmailDomain(email);
    return domain === 'buksu.edu.ph' || domain === 'student.buksu.edu.ph';
}

/**
 * Sanitize string for database queries
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeString(str) {
    if (!str || typeof str !== 'string') {
        return '';
    }

    return str.trim().replace(/[<>]/g, '');
}

/**
 * Deep clone object
 * @param {object} obj - Object to clone
 * @returns {object} - Cloned object
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }

    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item));
    }

    const cloned = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }

    return cloned;
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 * @param {*} value - Value to check
 * @returns {boolean} - True if empty
 */
function isEmpty(value) {
    if (value === null || value === undefined) {
        return true;
    }

    if (typeof value === 'string') {
        return value.trim().length === 0;
    }

    if (Array.isArray(value)) {
        return value.length === 0;
    }

    if (typeof value === 'object') {
        return Object.keys(value).length === 0;
    }

    return false;
}

/**
 * Get file extension from filename
 * @param {string} filename - Filename
 * @returns {string} - File extension (with dot)
 */
function getFileExtension(filename) {
    if (!filename || typeof filename !== 'string') {
        return '';
    }

    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1 || lastDot === filename.length - 1) {
        return '';
    }

    return filename.substring(lastDot).toLowerCase();
}

/**
 * Check if file is an image based on extension
 * @param {string} filename - Filename
 * @returns {boolean} - True if image file
 */
function isImageFile(filename) {
    const extension = getFileExtension(filename);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    return imageExtensions.includes(extension);
}

/**
 * Check if file is a document based on extension
 * @param {string} filename - Filename
 * @returns {boolean} - True if document file
 */
function isDocumentFile(filename) {
    const extension = getFileExtension(filename);
    const docExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    return docExtensions.includes(extension);
}

/**
 * Sleep/delay function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after delay
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delayMs - Initial delay in milliseconds
 * @returns {Promise} - Promise that resolves with function result
 */
async function retryWithBackoff(fn, maxRetries = 3, delayMs = 1000) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries - 1) {
                const delay = delayMs * Math.pow(2, attempt);
                await sleep(delay);
            }
        }
    }

    throw lastError;
}

/**
 * Parse query string parameters
 * @param {string} queryString - Query string
 * @returns {object} - Parsed parameters
 */
function parseQueryString(queryString) {
    const params = {};

    if (!queryString || typeof queryString !== 'string') {
        return params;
    }

    const pairs = queryString.replace(/^\?/, '').split('&');

    for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key) {
            params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
        }
    }

    return params;
}

module.exports = {
    generateToken,
    generateRandomString,
    hasPermission,
    isAdmin,
    isSecretary,
    isFaculty,
    canCreateMemo,
    canApproveMemo,
    isPendingMemo,
    isApprovedMemo,
    isRejectedMemo,
    isUrgentMemo,
    getUserDisplayName,
    getEmailDomain,
    isBukSuEmail,
    sanitizeString,
    deepClone,
    isEmpty,
    getFileExtension,
    isImageFile,
    isDocumentFile,
    sleep,
    retryWithBackoff,
    parseQueryString
};

