/**
 * Authentication & Authorization Middleware
 * Centralized auth functions for the application
 */

const jwt = require('jsonwebtoken');

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_secret_change_in_production';

// ==================== PERMISSIONS SYSTEM ====================
const PERMISSIONS = {
    // Content Management
    MANAGE_UNITS: 'manage_units',
    MANAGE_PROJECTS: 'manage_projects',
    MANAGE_NEWS: 'manage_news',

    // User Interaction
    MANAGE_MESSAGES: 'manage_messages',
    MANAGE_REVIEWS: 'manage_reviews',
    MANAGE_COMMENTS: 'manage_comments',

    // System Management
    VIEW_DASHBOARD: 'view_dashboard',
    MANAGE_SETTINGS: 'manage_settings',
    MANAGE_USERS: 'manage_users',
    VIEW_LOGS: 'view_logs',
    VIEW_STATS: 'view_stats',
    MANAGE_BACKUPS: 'manage_backups'
};

// ==================== AUTH MIDDLEWARE ====================
/**
 * Verify JWT token and attach user to request
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

/**
 * Check if user has specific permission
 */
const checkPermission = (requiredPermission) => {
    return (req, res, next) => {
        const user = req.user;

        // Super Admin has all permissions
        if (user.role === 'super_admin') {
            return next();
        }

        // Check granular permissions
        if (user.permissions && user.permissions.includes(requiredPermission)) {
            return next();
        }

        // Backward compatibility for old roles
        if (requiredPermission === PERMISSIONS.MANAGE_NEWS && user.role === 'news_editor') return next();
        if (requiredPermission === PERMISSIONS.MANAGE_UNITS && user.role === 'editor') return next();

        return res.status(403).json({ error: 'Insufficient permissions' });
    };
};

/**
 * Check if user has one of the specified roles
 * @deprecated Use checkPermission instead
 */
const checkRole = (...roles) => {
    return (req, res, next) => {
        if (req.user.role === 'super_admin') return next();
        if (roles.includes(req.user.role)) return next();
        return res.status(403).json({ error: 'Insufficient permissions' });
    };
};

module.exports = {
    authenticateToken,
    checkPermission,
    checkRole,
    PERMISSIONS,
    JWT_SECRET
};
