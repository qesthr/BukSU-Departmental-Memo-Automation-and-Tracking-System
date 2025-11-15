/**
 * Validation Utilities for BukSU Memo System
 *
 * Reusable validation functions specific to the system
 */

const {
    ALLOWED_EMAIL_DOMAINS,
    VALID_ROLES,
    VALID_MEMO_STATUSES,
    VALID_PRIORITIES,
    VALIDATION_LIMITS,
    FILE_LIMITS
} = require('./constants');

/**
 * Validate BukSU email address
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid BukSU email
 */
function isValidBukSuEmail(email) {
    if (!email || typeof email !== 'string') {
        return false;
    }

    const lowerEmail = email.toLowerCase().trim();
    return ALLOWED_EMAIL_DOMAINS.some(domain => lowerEmail.endsWith(`@${domain}`));
}

/**
 * Validate email format (general)
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid email format
 */
function isValidEmail(email) {
    if (!email || typeof email !== 'string') {
        return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} - { valid: boolean, message: string }
 */
function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        return { valid: false, message: 'Password is required' };
    }

    if (password.length < VALIDATION_LIMITS.PASSWORD_MIN_LENGTH) {
        return {
            valid: false,
            message: `Password must be at least ${VALIDATION_LIMITS.PASSWORD_MIN_LENGTH} characters long`
        };
    }

    // Check for at least one uppercase, one lowercase, and one number
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
        return {
            valid: false,
            message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
        };
    }

    return { valid: true, message: 'Password is valid' };
}

/**
 * Validate user role
 * @param {string} role - Role to validate
 * @returns {boolean} - True if valid role
 */
function isValidRole(role) {
    return role && VALID_ROLES.includes(role);
}

/**
 * Validate memo status
 * @param {string} status - Status to validate
 * @returns {boolean} - True if valid status
 */
function isValidMemoStatus(status) {
    return status && VALID_MEMO_STATUSES.includes(status);
}

/**
 * Validate memo priority
 * @param {string} priority - Priority to validate
 * @returns {boolean} - True if valid priority
 */
function isValidPriority(priority) {
    return priority && VALID_PRIORITIES.includes(priority);
}

/**
 * Validate memo subject
 * @param {string} subject - Subject to validate
 * @returns {object} - { valid: boolean, message: string }
 */
function validateMemoSubject(subject) {
    if (!subject || typeof subject !== 'string') {
        return { valid: false, message: 'Subject is required' };
    }

    const trimmed = subject.trim();
    const minLength = VALIDATION_LIMITS.SUBJECT_MIN_LENGTH;
    const maxLength = VALIDATION_LIMITS.SUBJECT_MAX_LENGTH;

    if (trimmed.length < minLength) {
        return { valid: false, message: `Subject must be at least ${minLength} character(s) long` };
    }

    if (trimmed.length > maxLength) {
        return { valid: false, message: `Subject cannot exceed ${maxLength} characters` };
    }

    return { valid: true, message: 'Subject is valid' };
}

/**
 * Validate memo content
 * @param {string} content - Content to validate (optional)
 * @returns {object} - { valid: boolean, message: string }
 */
function validateMemoContent(content) {
    // Content is optional, but if provided, check length
    if (content === null || content === undefined) {
        return { valid: true, message: 'Content is optional' };
    }

    if (typeof content !== 'string') {
        return { valid: false, message: 'Content must be a string' };
    }

    const maxLength = VALIDATION_LIMITS.CONTENT_MAX_LENGTH;
    if (content.length > maxLength) {
        return { valid: false, message: `Content cannot exceed ${maxLength} characters` };
    }

    return { valid: true, message: 'Content is valid' };
}

/**
 * Validate name (first name or last name)
 * @param {string} name - Name to validate
 * @param {string} fieldName - Field name for error message (e.g., 'First name', 'Last name')
 * @returns {object} - { valid: boolean, message: string }
 */
function validateName(name, fieldName = 'Name') {
    if (!name || typeof name !== 'string') {
        return { valid: false, message: `${fieldName} is required` };
    }

    const trimmed = name.trim();
    const minLength = VALIDATION_LIMITS.FIRST_NAME_MIN_LENGTH;
    const maxLength = VALIDATION_LIMITS.FIRST_NAME_MAX_LENGTH;

    if (trimmed.length < minLength) {
        return { valid: false, message: `${fieldName} must be at least ${minLength} characters long` };
    }

    if (trimmed.length > maxLength) {
        return { valid: false, message: `${fieldName} cannot exceed ${maxLength} characters` };
    }

    // Check for valid characters (letters, spaces, hyphens, apostrophes)
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!nameRegex.test(trimmed)) {
        return { valid: false, message: `${fieldName} can only contain letters, spaces, hyphens, and apostrophes` };
    }

    return { valid: true, message: `${fieldName} is valid` };
}

/**
 * Validate employee ID format
 * @param {string} employeeId - Employee ID to validate
 * @returns {boolean} - True if valid format
 */
function isValidEmployeeId(employeeId) {
    if (!employeeId || typeof employeeId !== 'string') {
        return false;
    }

    // Alphanumeric and hyphens only
    const employeeIdRegex = /^[A-Za-z0-9-]+$/;
    return employeeIdRegex.test(employeeId.trim());
}

/**
 * Validate department name
 * @param {string} department - Department name to validate
 * @param {string} role - User role (admin should not have department)
 * @returns {object} - { valid: boolean, message: string }
 */
function validateDepartment(department, role) {
    // Admins should not have a department
    if (role === 'admin') {
        if (department && department.trim().length > 0) {
            return { valid: false, message: 'Admins cannot belong to any department' };
        }
        return { valid: true, message: 'Department validation passed for admin' };
    }

    // Secretary and faculty must have a department
    if (!department || typeof department !== 'string' || department.trim().length === 0) {
        return { valid: false, message: 'Department is required for secretaries and faculty' };
    }

    const maxLength = VALIDATION_LIMITS.DEPARTMENT_MAX_LENGTH;
    if (department.trim().length > maxLength) {
        return { valid: false, message: `Department name cannot exceed ${maxLength} characters` };
    }

    return { valid: true, message: 'Department is valid' };
}

/**
 * Validate file type
 * @param {string} mimetype - MIME type of the file
 * @returns {boolean} - True if allowed file type
 */
function isValidFileType(mimetype) {
    if (!mimetype || typeof mimetype !== 'string') {
        return false;
    }

    const allAllowedTypes = [
        ...FILE_LIMITS.ALLOWED_IMAGE_TYPES,
        ...FILE_LIMITS.ALLOWED_DOCUMENT_TYPES
    ];

    return allAllowedTypes.includes(mimetype.toLowerCase());
}

/**
 * Validate file size
 * @param {number} size - File size in bytes
 * @returns {object} - { valid: boolean, message: string }
 */
function validateFileSize(size) {
    if (!size || typeof size !== 'number' || size <= 0) {
        return { valid: false, message: 'Invalid file size' };
    }

    if (size > FILE_LIMITS.MAX_FILE_SIZE) {
        const maxMB = FILE_LIMITS.MAX_FILE_SIZE / (1024 * 1024);
        return { valid: false, message: `File size cannot exceed ${maxMB}MB` };
    }

    return { valid: true, message: 'File size is valid' };
}

/**
 * Validate MongoDB ObjectId format
 * @param {string} id - ID to validate
 * @returns {boolean} - True if valid ObjectId format
 */
function isValidObjectId(id) {
    if (!id || typeof id !== 'string') {
        return false;
    }

    // MongoDB ObjectId is 24 hex characters
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    return objectIdRegex.test(id.trim());
}

/**
 * Validate multiple ObjectIds
 * @param {Array<string>} ids - Array of IDs to validate
 * @returns {boolean} - True if all are valid ObjectIds
 */
function areValidObjectIds(ids) {
    if (!Array.isArray(ids)) {
        return false;
    }

    return ids.every(id => isValidObjectId(id));
}

module.exports = {
    isValidBukSuEmail,
    isValidEmail,
    validatePassword,
    isValidRole,
    isValidMemoStatus,
    isValidPriority,
    validateMemoSubject,
    validateMemoContent,
    validateName,
    isValidEmployeeId,
    validateDepartment,
    isValidFileType,
    validateFileSize,
    isValidObjectId,
    areValidObjectIds
};

