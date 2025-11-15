/**
 * Formatting Utilities for BukSU Memo System
 *
 * Reusable formatting functions for dates, files, text, etc.
 */

const { DATE_FORMATS } = require('./constants');

/**
 * Format date to short format (MM/DD/YYYY)
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDateShort(date) {
    if (!date) {
        return '';
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) {
        return '';
    }

    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();

    return `${month}/${day}/${year}`;
}

/**
 * Format date to long format (MMMM DD, YYYY)
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDateLong(date) {
    if (!date) {
        return '';
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) {
        return '';
    }

    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format date with time (MM/DD/YYYY, h:mm:ss A)
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date and time string
 */
function formatDateTime(date) {
    if (!date) {
        return '';
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) {
        return '';
    }

    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    return `${month}/${day}/${year}, ${displayHours}:${minutes}:${seconds} ${ampm}`;
}

/**
 * Format date for filename (YYYY-MM-DD)
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date string for filenames
 */
function formatDateForFilename(date) {
    if (!date) {
        const now = new Date();
        return formatDateForFilename(now);
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) {
        return '';
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Format file size to human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size (e.g., "1.5 MB")
 */
function formatFileSize(bytes) {
    if (!bytes || Number.isNaN(bytes) || bytes < 0) {
        return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    // Format: show 1 decimal place for sizes < 10, round for larger sizes
    const formattedSize = size < 10 && unitIndex > 0 ? size.toFixed(1) : Math.round(size);

    return `${formattedSize} ${units[unitIndex]}`;
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add if truncated (default: '...')
 * @returns {string} - Truncated text
 */
function truncateText(text, maxLength, suffix = '...') {
    if (!text || typeof text !== 'string') {
        return '';
    }

    if (text.length <= maxLength) {
        return text;
    }

    return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Create safe filename from subject or text
 * @param {string} text - Text to convert to filename
 * @param {number} maxLength - Maximum filename length (default: 80)
 * @returns {string} - Safe filename
 */
function createSafeFilename(text, maxLength = 80) {
    if (!text || typeof text !== 'string') {
        return 'Memo';
    }

    return text
        .replace(/[\\/:*?"<>|]+/g, '') // Remove invalid filename characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .trim()
        .substring(0, maxLength) || 'Memo';
}

/**
 * Format user full name
 * @param {object} user - User object with firstName and lastName
 * @returns {string} - Formatted full name
 */
function formatUserName(user) {
    if (!user) {
        return 'Unknown User';
    }

    const firstName = user.firstName || '';
    const lastName = user.lastName || '';

    if (!firstName && !lastName) {
        return user.email || 'Unknown User';
    }

    return `${firstName} ${lastName}`.trim();
}

/**
 * Format user name with email
 * @param {object} user - User object
 * @returns {string} - Formatted name with email
 */
function formatUserNameWithEmail(user) {
    if (!user) {
        return 'Unknown User';
    }

    const name = formatUserName(user);
    const email = user.email || '';

    if (!email) {
        return name;
    }

    return `${name} (${email})`;
}

/**
 * Format priority for display
 * @param {string} priority - Priority value
 * @returns {string} - Capitalized priority
 */
function formatPriority(priority) {
    if (!priority || typeof priority !== 'string') {
        return 'Medium';
    }

    return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
}

/**
 * Format status for display
 * @param {string} status - Status value
 * @returns {string} - Capitalized status
 */
function formatStatus(status) {
    if (!status || typeof status !== 'string') {
        return '';
    }

    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 * @param {Date|string} date - Date to format
 * @returns {string} - Relative time string
 */
function formatRelativeTime(date) {
    if (!date) {
        return '';
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) {
        return '';
    }

    const now = new Date();
    const diffMs = now - d;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
        return 'Just now';
    } else if (diffMins < 60) {
        return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
        return formatDateShort(d);
    }
}

/**
 * Convert HTML to plain text
 * @param {string} html - HTML string
 * @returns {string} - Plain text
 */
function htmlToPlainText(html) {
    if (!html || typeof html !== 'string') {
        return '';
    }

    // Remove HTML tags
    let text = html.replace(/<[^>]*>/g, '');

    // Decode HTML entities
    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
}

/**
 * Format department name (normalize variations)
 * @param {string} department - Department name
 * @returns {string} - Normalized department name
 */
function formatDepartmentName(department) {
    if (!department || typeof department !== 'string') {
        return '';
    }

    const lower = department.toLowerCase().trim();

    // Normalize IT/EMC variations
    if (
        lower === 'it' ||
        lower === 'emc' ||
        lower === 'it/emc' ||
        lower === 'it - emc' ||
        lower === 'it & emc' ||
        (lower.includes('information tech') && lower.includes('multimedia')) ||
        (lower.includes('entertainment') && lower.includes('comput'))
    ) {
        return 'Information Technology and Entertainment Multimedia Computing';
    }

    // Return original with proper capitalization
    return department.trim();
}

module.exports = {
    formatDateShort,
    formatDateLong,
    formatDateTime,
    formatDateForFilename,
    formatFileSize,
    truncateText,
    createSafeFilename,
    formatUserName,
    formatUserNameWithEmail,
    formatPriority,
    formatStatus,
    formatRelativeTime,
    htmlToPlainText,
    formatDepartmentName
};

