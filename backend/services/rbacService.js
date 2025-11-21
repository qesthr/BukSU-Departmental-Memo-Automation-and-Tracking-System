const RBAC = require('rbac');
const { USER_ROLES } = require('../utils/constants');

/**
 * RBAC Service
 *
 * Role-Based Access Control implementation with hierarchical roles:
 * superadmin > admin > secretary > faculty
 *
 * Permissions are hierarchical - higher roles inherit lower role permissions
 */

// Define permissions
const permissions = {
    // Memo permissions
    'memo:create': 'Create memos',
    'memo:read': 'Read memos',
    'memo:read:all': 'Read all memos across departments',
    'memo:read:department': 'Read memos in own department',
    'memo:update': 'Update memos',
    'memo:delete': 'Delete memos',
    'memo:delete:own': 'Delete own memos',
    'memo:approve': 'Approve memos',
    'memo:reject': 'Reject memos',
    'memo:send': 'Send memos',
    'memo:send:cross-department': 'Send memos across departments',

    // User management permissions
    'user:create': 'Create users',
    'user:read': 'Read users',
    'user:read:all': 'Read all users',
    'user:read:department': 'Read users in own department',
    'user:update': 'Update users',
    'user:delete': 'Delete users',
    'user:manage:role': 'Manage user roles',
    'user:manage:superadmin': 'Manage superadmin users',
    'user:manage:admin': 'Manage admin users',
    'user:activate': 'Activate/deactivate users',

    // Settings permissions
    'settings:read': 'Read settings',
    'settings:update': 'Update settings',
    'settings:manage': 'Manage all settings',

    // Analytics permissions
    'analytics:view': 'View analytics',
    'analytics:export': 'Export reports',

    // Calendar permissions
    'calendar:create': 'Create calendar events',
    'calendar:read': 'Read calendar events',
    'calendar:update': 'Update calendar events',
    'calendar:delete': 'Delete calendar events',

    // System permissions
    'system:manage': 'Manage system settings',
    'system:audit': 'View audit logs',
    'system:backup': 'Manage backups'
};

// Define roles with their permissions
const roles = {
    // Faculty - Base role with minimal permissions
    [USER_ROLES.FACULTY]: {
        permissions: [
            'memo:read',
            'memo:read:department',
            'calendar:read'
        ],
        parents: [] // No parent roles
    },

    // Secretary - Can create and manage memos in their department
    [USER_ROLES.SECRETARY]: {
        permissions: [
            'memo:create',
            'memo:read',
            'memo:read:department',
            'memo:update',
            'memo:delete',
            'memo:delete:own',
            'memo:send',
            'calendar:create',
            'calendar:read',
            'calendar:update',
            'calendar:delete'
        ],
        parents: [USER_ROLES.FACULTY] // Inherits faculty permissions
    },

    // Admin - Can manage users and approve memos (highest role)
    [USER_ROLES.ADMIN]: {
        permissions: [
            'memo:read:all',
            'memo:approve',
            'memo:reject',
            'memo:send:cross-department',
            'user:create',
            'user:read:all',
            'user:update',
            'user:delete',
            'user:manage:role',
            'user:activate',
            'settings:read',
            'settings:update',
            'analytics:view',
            'analytics:export',
            'system:audit'
        ],
        parents: [USER_ROLES.SECRETARY] // Inherits secretary permissions
    }
};

// Initialize RBAC instance
let rbacInstance = null;

/**
 * Initialize RBAC system
 * @returns {Promise<RBAC>} RBAC instance
 */
async function initializeRBAC() {
    if (rbacInstance) {
        return rbacInstance;
    }

    rbacInstance = new RBAC({
        roles: Object.keys(roles),
        permissions: Object.keys(permissions),
        grants: {}
    });

    // Add roles and their permissions
    for (const [roleName, roleConfig] of Object.entries(roles)) {
        // Add role
        await rbacInstance.add(roleName);

        // Add parent roles (inheritance)
        for (const parent of roleConfig.parents) {
            await rbacInstance.add(parent);
            await rbacInstance.grant(parent, roleName);
        }

        // Grant permissions to role
        for (const permission of roleConfig.permissions) {
            await rbacInstance.grant(roleName, permission);
        }
    }

    return rbacInstance;
}

/**
 * Check if user has permission
 * @param {Object} user - User object with role property
 * @param {string} permission - Permission to check
 * @returns {Promise<boolean>} True if user has permission
 */
async function can(user, permission) {
    if (!user || !user.role) {
        return false;
    }

    const rbac = await initializeRBAC();

    try {
        return await rbac.can(user.role, permission);
    } catch (error) {
        console.error('RBAC permission check error:', error);
        return false;
    }
}

/**
 * Check if user has any of the specified permissions
 * @param {Object} user - User object with role property
 * @param {string[]} permissions - Array of permissions to check
 * @returns {Promise<boolean>} True if user has at least one permission
 */
async function canAny(user, permissions) {
    if (!user || !user.role || !permissions || permissions.length === 0) {
        return false;
    }

    for (const permission of permissions) {
        if (await can(user, permission)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if user has all of the specified permissions
 * @param {Object} user - User object with role property
 * @param {string[]} permissions - Array of permissions to check
 * @returns {Promise<boolean>} True if user has all permissions
 */
async function canAll(user, permissions) {
    if (!user || !user.role || !permissions || permissions.length === 0) {
        return false;
    }

    for (const permission of permissions) {
        if (!(await can(user, permission))) {
            return false;
        }
    }

    return true;
}

/**
 * Check if user has a specific role
 * @param {Object} user - User object with role property
 * @param {string} role - Role to check
 * @returns {boolean} True if user has the role
 */
function hasRole(user, role) {
    if (!user || !user.role) {
        return false;
    }

    return user.role === role;
}

/**
 * Check if user has any of the specified roles
 * @param {Object} user - User object with role property
 * @param {string[]} roles - Array of roles to check
 * @returns {boolean} True if user has at least one role
 */
function hasAnyRole(user, roles) {
    if (!user || !user.role || !roles || roles.length === 0) {
        return false;
    }

    return roles.includes(user.role);
}

/**
 * Check if user is admin (highest role)
 * @param {Object} user - User object with role property
 * @returns {boolean} True if user is admin
 */
function isAdmin(user) {
    return user && user.role === 'admin';
}

/**
 * Check if user is admin (kept for backward compatibility)
 * @param {Object} user - User object with role property
 * @returns {boolean} True if user is admin
 */
function isAdminOrSuperAdmin(user) {
    return user && user.role === 'admin';
}

/**
 * Get all permissions for a role
 * @param {string} role - Role name
 * @returns {Promise<string[]>} Array of permission names
 */
async function getRolePermissions(role) {
    const rbac = await initializeRBAC();

    try {
        const rolePermissions = [];
        const allPermissions = Object.keys(permissions);

        for (const permission of allPermissions) {
            if (await rbac.can(role, permission)) {
                rolePermissions.push(permission);
            }
        }

        return rolePermissions;
    } catch (error) {
        console.error('Error getting role permissions:', error);
        return [];
    }
}

/**
 * Get all available roles
 * @returns {string[]} Array of role names
 */
function getAllRoles() {
    return Object.keys(roles);
}

/**
 * Get all available permissions
 * @returns {Object} Object mapping permission keys to descriptions
 */
function getAllPermissions() {
    return permissions;
}

module.exports = {
    initializeRBAC,
    can,
    canAny,
    canAll,
    hasRole,
    hasAnyRole,
    isAdmin,
    isAdminOrSuperAdmin,
    getRolePermissions,
    getAllRoles,
    getAllPermissions
};

