/**
 * System Constants for BukSU Memo System
 *
 * Centralized constants used throughout the application
 */

/**
 * User Roles
 */
const USER_ROLES = {
    ADMIN: 'admin',
    SECRETARY: 'secretary',
    FACULTY: 'faculty'
};

const VALID_ROLES = Object.values(USER_ROLES);

/**
 * Memo Statuses
 */
const MEMO_STATUS = {
    DRAFT: 'draft',
    PENDING: 'pending',
    SENT: 'sent',
    READ: 'read',
    ARCHIVED: 'archived',
    DELETED: 'deleted',
    APPROVED: 'approved',
    REJECTED: 'rejected'
};

const VALID_MEMO_STATUSES = Object.values(MEMO_STATUS);

/**
 * Memo Priorities
 */
const MEMO_PRIORITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
};

const VALID_PRIORITIES = Object.values(MEMO_PRIORITY);

/**
 * Memo Activity Types
 */
const ACTIVITY_TYPE = {
    MEMO_SENT: 'memo_sent',
    MEMO_RECEIVED: 'memo_received',
    PENDING_MEMO: 'pending_memo',
    MEMO_APPROVED: 'memo_approved',
    MEMO_REJECTED: 'memo_rejected',
    PASSWORD_RESET: 'password_reset',
    WELCOME_EMAIL: 'welcome_email',
    USER_ACTIVITY: 'user_activity',
    SYSTEM_NOTIFICATION: 'system_notification',
    USER_DELETED: 'user_deleted',
    USER_PROFILE_EDITED: 'user_profile_edited',
    CALENDAR_CONNECTED: 'calendar_connected'
};

const VALID_ACTIVITY_TYPES = Object.values(ACTIVITY_TYPE);

/**
 * Memo Folders
 */
const MEMO_FOLDER = {
    INBOX: 'inbox',
    SENT: 'sent',
    DRAFTS: 'drafts',
    STARRED: 'starred',
    DELETED: 'deleted'
};

const VALID_FOLDERS = Object.values(MEMO_FOLDER);

/**
 * Calendar Event Statuses
 */
const CALENDAR_EVENT_STATUS = {
    SCHEDULED: 'scheduled',
    SENT: 'sent',
    CANCELLED: 'cancelled'
};

const VALID_CALENDAR_STATUSES = Object.values(CALENDAR_EVENT_STATUS);

/**
 * Email Domains
 */
const ALLOWED_EMAIL_DOMAINS = [
    'buksu.edu.ph',
    'student.buksu.edu.ph'
];

/**
 * File Upload Limits
 */
const FILE_LIMITS = {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB in bytes
    MAX_FILES_PER_MEMO: 10,
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    ALLOWED_DOCUMENT_TYPES: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ]
};

/**
 * Allowed File Extensions
 */
const ALLOWED_EXTENSIONS = {
    IMAGES: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    DOCUMENTS: ['.pdf', '.doc', '.docx', '.txt']
};

/**
 * Validation Limits
 */
const VALIDATION_LIMITS = {
    SUBJECT_MIN_LENGTH: 1,
    SUBJECT_MAX_LENGTH: 200,
    CONTENT_MAX_LENGTH: 10000,
    FIRST_NAME_MIN_LENGTH: 2,
    FIRST_NAME_MAX_LENGTH: 50,
    LAST_NAME_MIN_LENGTH: 2,
    LAST_NAME_MAX_LENGTH: 50,
    PASSWORD_MIN_LENGTH: 8,
    DEPARTMENT_MAX_LENGTH: 100,
    FILENAME_MAX_LENGTH: 80
};

/**
 * Priority Colors (for UI)
 */
const PRIORITY_COLORS = {
    [MEMO_PRIORITY.LOW]: '#10b981',      // green
    [MEMO_PRIORITY.MEDIUM]: '#3b82f6',   // blue
    [MEMO_PRIORITY.HIGH]: '#f59e0b',     // orange
    [MEMO_PRIORITY.URGENT]: '#ef4444'    // red
};

/**
 * Status Colors (for UI)
 */
const STATUS_COLORS = {
    [MEMO_STATUS.DRAFT]: '#6b7280',      // gray
    [MEMO_STATUS.PENDING]: '#f59e0b',   // orange
    [MEMO_STATUS.SENT]: '#3b82f6',      // blue
    [MEMO_STATUS.READ]: '#10b981',      // green
    [MEMO_STATUS.ARCHIVED]: '#6b7280',  // gray
    [MEMO_STATUS.APPROVED]: '#10b981',  // green
    [MEMO_STATUS.REJECTED]: '#ef4444'   // red
};

/**
 * Role Permissions
 */
const ROLE_PERMISSIONS = {
    [USER_ROLES.ADMIN]: {
        canCreateMemo: true,
        canApproveMemo: true,
        canRejectMemo: true,
        canDeleteMemo: true,
        canViewAllMemos: true,
        canManageUsers: true,
        canManageSettings: true,
        canCrossDepartmentSend: true,
        canViewAnalytics: true
    },
    [USER_ROLES.SECRETARY]: {
        canCreateMemo: true,
        canApproveMemo: false,
        canRejectMemo: false,
        canDeleteMemo: true,
        canViewAllMemos: false,
        canManageUsers: false,
        canManageSettings: false,
        canCrossDepartmentSend: false, // Can be overridden by canCrossSend flag
        canViewAnalytics: false
    },
    [USER_ROLES.FACULTY]: {
        canCreateMemo: false,
        canApproveMemo: false,
        canRejectMemo: false,
        canDeleteMemo: false,
        canViewAllMemos: false,
        canManageUsers: false,
        canManageSettings: false,
        canCrossDepartmentSend: false,
        canViewAnalytics: false
    }
};

/**
 * Date Formats
 */
const DATE_FORMATS = {
    SHORT: 'MM/DD/YYYY',
    LONG: 'MMMM DD, YYYY',
    DATETIME: 'MM/DD/YYYY, h:mm:ss A',
    ISO: 'YYYY-MM-DD',
    FILENAME: 'YYYY-MM-DD'
};

/**
 * System Settings Keys
 */
const SETTING_KEYS = {
    API_KEYS: 'api_keys',
    GOOGLE_ANALYTICS_PROPERTY_ID: 'google_analytics_property_id',
    GOOGLE_DRIVE_FOLDER_ID: 'google_drive_folder_id',
    GOOGLE_DRIVE_REFRESH_TOKEN: 'google_drive_refresh_token',
    EMAIL_FROM_ADDRESS: 'email_from_address',
    EMAIL_FROM_NAME: 'email_from_name'
};

module.exports = {
    USER_ROLES,
    VALID_ROLES,
    MEMO_STATUS,
    VALID_MEMO_STATUSES,
    MEMO_PRIORITY,
    VALID_PRIORITIES,
    ACTIVITY_TYPE,
    VALID_ACTIVITY_TYPES,
    MEMO_FOLDER,
    VALID_FOLDERS,
    CALENDAR_EVENT_STATUS,
    VALID_CALENDAR_STATUSES,
    ALLOWED_EMAIL_DOMAINS,
    FILE_LIMITS,
    ALLOWED_EXTENSIONS,
    VALIDATION_LIMITS,
    PRIORITY_COLORS,
    STATUS_COLORS,
    ROLE_PERMISSIONS,
    DATE_FORMATS,
    SETTING_KEYS
};

