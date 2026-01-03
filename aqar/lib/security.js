/**
 * Security Middleware Collection
 * مجموعة middleware للأمان المحسن
 * 
 * @version 1.0.0
 */

// ==================== HTTPS ENFORCEMENT ====================
const enforceHttps = (req, res, next) => {
    // تخطي في development
    if (process.env.NODE_ENV !== 'production') {
        return next();
    }

    // التحقق من الاتصال الآمن
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        return next();
    }

    // إعادة التوجيه إلى HTTPS
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
};

// ==================== SECURITY HEADERS ====================
const securityHeaders = (req, res, next) => {
    // XSS Protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Content Type Options
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Frame Options (clickjacking protection)
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');

    // Remove X-Powered-By
    res.removeHeader('X-Powered-By');

    next();
};

// ==================== INPUT SANITIZATION ====================
const sanitizeInput = (req, res, next) => {
    const sanitizeValue = (value) => {
        if (typeof value !== 'string') return value;

        // إزالة الـ null bytes
        value = value.replace(/\0/g, '');

        // إزالة script tags
        value = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

        // إزالة event handlers
        value = value.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

        // تحويل HTML entities الخطيرة
        value = value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');

        return value;
    };

    const sanitizeObject = (obj, depth = 0) => {
        if (depth > 10) return obj; // حماية من التكرار اللانهائي

        if (Array.isArray(obj)) {
            return obj.map(item => sanitizeObject(item, depth + 1));
        }

        if (obj && typeof obj === 'object') {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                // تنظيف اسم المفتاح أيضاً
                const cleanKey = sanitizeValue(key);
                result[cleanKey] = sanitizeObject(value, depth + 1);
            }
            return result;
        }

        if (typeof obj === 'string') {
            return sanitizeValue(obj);
        }

        return obj;
    };

    // تنظيف body و query و params
    if (req.body) req.body = sanitizeObject(req.body);
    if (req.query) req.query = sanitizeObject(req.query);
    if (req.params) req.params = sanitizeObject(req.params);

    next();
};

// ==================== NoSQL INJECTION PREVENTION ====================
const preventNoSQLInjection = (req, res, next) => {
    const checkForInjection = (obj) => {
        if (!obj || typeof obj !== 'object') return false;

        for (const [key, value] of Object.entries(obj)) {
            // التحقق من مفاتيح MongoDB-style
            if (key.startsWith('$')) {
                return true;
            }

            if (typeof value === 'object' && value !== null) {
                if (checkForInjection(value)) return true;
            }
        }

        return false;
    };

    if (checkForInjection(req.body) || checkForInjection(req.query)) {
        return res.status(400).json({ error: 'Invalid request format' });
    }

    next();
};

// ==================== PATH TRAVERSAL PREVENTION ====================
const preventPathTraversal = (paramName) => {
    return (req, res, next) => {
        const value = req.params[paramName] || req.query[paramName] || req.body[paramName];

        if (value && typeof value === 'string') {
            // التحقق من محاولات path traversal
            if (value.includes('..') || value.includes('\0') || /[<>:"|?*]/.test(value)) {
                return res.status(400).json({ error: 'Invalid path parameter' });
            }
        }

        next();
    };
};

// ==================== REQUEST SIZE LIMITER ====================
const createSizeLimiter = (maxSize = '10mb') => {
    const parseSize = (size) => {
        const match = size.match(/^(\d+)(kb|mb|gb)?$/i);
        if (!match) return 10 * 1024 * 1024; // default 10MB

        const num = parseInt(match[1]);
        const unit = (match[2] || 'b').toLowerCase();

        switch (unit) {
            case 'kb': return num * 1024;
            case 'mb': return num * 1024 * 1024;
            case 'gb': return num * 1024 * 1024 * 1024;
            default: return num;
        }
    };

    const maxBytes = parseSize(maxSize);

    return (req, res, next) => {
        const contentLength = parseInt(req.headers['content-length'] || '0');

        if (contentLength > maxBytes) {
            return res.status(413).json({
                error: 'Request too large',
                maxSize: maxSize
            });
        }

        next();
    };
};

// ==================== IP BLACKLIST ====================
class IPBlacklist {
    constructor() {
        this.blacklist = new Set();
        this.tempBan = new Map(); // IP -> unban timestamp
    }

    add(ip, duration = 0) {
        if (duration > 0) {
            this.tempBan.set(ip, Date.now() + duration);
        } else {
            this.blacklist.add(ip);
        }
    }

    remove(ip) {
        this.blacklist.delete(ip);
        this.tempBan.delete(ip);
    }

    isBlocked(ip) {
        if (this.blacklist.has(ip)) return true;

        const unbanTime = this.tempBan.get(ip);
        if (unbanTime) {
            if (Date.now() < unbanTime) return true;
            this.tempBan.delete(ip);
        }

        return false;
    }

    middleware() {
        return (req, res, next) => {
            const ip = req.ip || req.connection.remoteAddress;

            if (this.isBlocked(ip)) {
                return res.status(403).json({ error: 'Access denied' });
            }

            next();
        };
    }
}

// ==================== SUSPICIOUS ACTIVITY DETECTOR ====================
class SuspiciousActivityDetector {
    constructor() {
        this.activities = new Map(); // IP -> array of activities
        this.thresholds = {
            rapidRequests: { count: 100, window: 10000 }, // 100 requests in 10 seconds
            failedLogins: { count: 10, window: 300000 },  // 10 failed logins in 5 minutes
            invalidPaths: { count: 20, window: 60000 }    // 20 invalid paths in 1 minute
        };

        // التنظيف الدوري
        setInterval(() => this._cleanup(), 60000);
    }

    _cleanup() {
        const now = Date.now();
        const maxAge = 600000; // 10 minutes

        for (const [ip, activities] of this.activities.entries()) {
            const filtered = activities.filter(a => now - a.timestamp < maxAge);
            if (filtered.length === 0) {
                this.activities.delete(ip);
            } else {
                this.activities.set(ip, filtered);
            }
        }
    }

    record(ip, type) {
        if (!this.activities.has(ip)) {
            this.activities.set(ip, []);
        }

        this.activities.get(ip).push({
            type,
            timestamp: Date.now()
        });
    }

    isSuspicious(ip) {
        const activities = this.activities.get(ip) || [];
        const now = Date.now();

        for (const [type, threshold] of Object.entries(this.thresholds)) {
            const recentCount = activities.filter(
                a => a.type === type && now - a.timestamp < threshold.window
            ).length;

            if (recentCount >= threshold.count) {
                return { suspicious: true, reason: type };
            }
        }

        return { suspicious: false };
    }

    middleware() {
        return (req, res, next) => {
            const ip = req.ip || req.connection.remoteAddress;

            // تسجيل الطلب
            this.record(ip, 'rapidRequests');

            // التحقق من النشاط المشبوه
            const result = this.isSuspicious(ip);
            if (result.suspicious) {
                console.warn(`[Security] Suspicious activity from ${ip}: ${result.reason}`);
                return res.status(429).json({
                    error: 'Too many requests',
                    retryAfter: 60
                });
            }

            next();
        };
    }
}

// ==================== LOGGING MIDDLEWARE ====================
const createSecurityLogger = (options = {}) => {
    const logFile = options.logFile || null;

    return (req, res, next) => {
        const startTime = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - startTime;
            const logEntry = {
                timestamp: new Date().toISOString(),
                method: req.method,
                path: req.path,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                statusCode: res.statusCode,
                duration: duration,
                userId: req.user?.id || null
            };

            // تسجيل الطلبات المشبوهة
            if (res.statusCode >= 400) {
                console.warn('[Security]', JSON.stringify(logEntry));
            }
        });

        next();
    };
};

// ==================== HELMET CONFIGURATION ====================
const helmetConfig = {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'", // لبعض المكتبات
                "https://cdnjs.cloudflare.com",
                "https://cdn.jsdelivr.net",
                "https://static.cloudflareinsights.com" // Cloudflare Analytics
            ],
            scriptSrcAttr: ["'unsafe-inline'"], // للـ inline event handlers مثل onclick
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://fonts.googleapis.com",
                "https://cdnjs.cloudflare.com",
                "https://cdn.jsdelivr.net" // Bootstrap & other CDN styles
            ],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com",
                "https://cdnjs.cloudflare.com",
                "https://cdn.jsdelivr.net" // Bootstrap Icons fonts
            ],
            connectSrc: [
                "'self'",
                "https://cdn.jsdelivr.net", // Source maps
                "https://cdnjs.cloudflare.com",
                "https://cloudflareinsights.com", // Cloudflare Analytics
                "https://*.cloudflareinsights.com"
            ],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
};

// ==================== SINGLETON INSTANCES ====================
const ipBlacklist = new IPBlacklist();
const activityDetector = new SuspiciousActivityDetector();

// ==================== EXPORTS ====================
module.exports = {
    // Middleware
    enforceHttps,
    securityHeaders,
    sanitizeInput,
    preventNoSQLInjection,
    preventPathTraversal,
    createSizeLimiter,
    createSecurityLogger,

    // Classes
    IPBlacklist,
    SuspiciousActivityDetector,

    // Instances
    ipBlacklist,
    activityDetector,

    // Config
    helmetConfig
};
