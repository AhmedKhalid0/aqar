// تحميل متغيرات البيئة
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, param, query, validationResult } = require('express-validator');
const cookieParser = require('cookie-parser');

// نظام إدارة البيانات المحسن
const { dataManager } = require('./lib/dataManager');
const { dataService, FlatFileManager, MigrationTool, searchManager, staticGenerator, apiCache, cacheMiddleware } = require('./lib/index');
const { shardedDataService } = require('./lib/shardedFlatFileDB');

// ==================== SECURITY & CACHE MODULES ====================
const { hybridCache, createRedisCacheMiddleware, trafficManager, queueManager } = require('./lib/redisCache');
const {
    enforceHttps,
    securityHeaders,
    sanitizeInput,
    preventNoSQLInjection,
    activityDetector,
    helmetConfig
} = require('./lib/security');

// تهيئة النظام عند بدء التشغيل
let flatFileEnabled = false;

// Cache middleware للـ APIs العامة
const cacheUnits = cacheMiddleware('units', 2 * 60 * 1000); // 2 min
const cacheProjects = cacheMiddleware('projects', 5 * 60 * 1000); // 5 min
const cacheNews = cacheMiddleware('news', 5 * 60 * 1000); // 5 min

const app = express();
const PORT = process.env.PORT || 3000;
// ==================== JWT CONFIGURATION (IMPROVED SECURITY) ====================
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('❌ CRITICAL: JWT_SECRET must be set in production!');
    console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_secret_change_in_production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + '_refresh';
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '24h';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

// Trust proxy for nginx (required for rate limiting to work correctly)
app.set('trust proxy', 1);

// ==================== VALIDATION HELPERS ====================
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// قواعد التحقق المشتركة
const validators = {
    // التحقق من ID
    id: param('id').trim().notEmpty().escape(),

    // التحقق من pagination
    pagination: [
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
    ],

    // التحقق من بيانات المستخدم
    userLogin: [
        body('username').trim().notEmpty().isLength({ min: 3, max: 50 }).escape(),
        body('password').notEmpty().isLength({ min: 6, max: 100 })
    ],

    // التحقق من بيانات الوحدة
    unit: [
        body('title.ar').optional().trim().isLength({ max: 200 }),
        body('title.en').optional().trim().isLength({ max: 200 }),
        body('price').optional().isNumeric(),
        body('area').optional().isNumeric(),
        body('bedrooms').optional().isInt({ min: 0, max: 20 }),
        body('bathrooms').optional().isInt({ min: 0, max: 20 })
    ],

    // التحقق من بيانات المشروع
    project: [
        body('title.ar').optional().trim().isLength({ max: 200 }),
        body('title.en').optional().trim().isLength({ max: 200 }),
        body('totalUnits').optional().isInt({ min: 0 }),
        body('availableUnits').optional().isInt({ min: 0 })
    ],

    // التحقق من بيانات الأخبار
    news: [
        body('title.ar').optional().trim().isLength({ max: 300 }),
        body('title.en').optional().trim().isLength({ max: 300 }),
        body('category').optional().trim().escape()
    ]
};

// ==================== SECURITY MIDDLEWARE ====================
// HTTPS Enforcement (production only)
app.use(enforceHttps);

// Security Headers
app.use(securityHeaders);

// CORS Configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Helmet with improved CSP
app.use(helmet(helmetConfig));

// Compression - ضغط الاستجابات لتقليل حجم البيانات
app.use(compression({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        // لا تضغط الصور
        const contentType = res.getHeader('Content-Type');
        if (contentType && contentType.includes('image/')) return false;
        return compression.filter(req, res);
    },
    threshold: 1024, // لا تضغط الملفات أقل من 1KB
    level: 6 // مستوى الضغط (1-9)
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Input Sanitization
app.use(sanitizeInput);

// NoSQL Injection Prevention
app.use(preventNoSQLInjection);

// ==================== RATE LIMITING (OPTIMIZED FOR MILLIONS) ====================
// General API Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 500, // 500 requests per minute
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => false // Trust Express req.ip with trust proxy enabled
});
app.use('/api/', apiLimiter);

// High-traffic Public API Limiter (for /api/units, /api/projects, etc.)
const publicApiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 1000, // 1000 requests per minute for public APIs
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/units', publicApiLimiter);
app.use('/api/projects', publicApiLimiter);
app.use('/api/news', publicApiLimiter);

// Strict Rate Limiting for Login - Prevent brute force attacks
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Don't count successful logins
});
app.use('/api/auth/login', loginLimiter);

// ==================== STATIC FILES (OPTIMIZED CACHING) ====================
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            // لا نريد cache للـ HTML
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (filePath.match(/\.(js|css)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
        } else if (filePath.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=2592000, immutable'); // 30 days
        }
    }
}));

// ==================== ADMIN PROTECTION MIDDLEWARE ====================
// Allow login page without authentication
app.get('/admin/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/login.html'));
});

// Serve admin static assets (CSS, JS) without auth
app.use('/admin/css', express.static(path.join(__dirname, 'admin/css')));
app.use('/admin/js', express.static(path.join(__dirname, 'admin/js')));
app.use('/admin/components', express.static(path.join(__dirname, 'admin/components')));

// Protect all other admin routes with server-side auth
const protectAdminRoute = (req, res, next) => {
    const token = req.cookies?.adminToken || req.headers['authorization']?.split(' ')[1];

    if (!token) {
        // No token - redirect to login
        return res.redirect('/admin/login.html');
    }

    try {
        jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        // Invalid token - redirect to login
        return res.redirect('/admin/login.html');
    }
};

// Apply protection to admin HTML pages
app.get('/admin', protectAdminRoute, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/index.html'));
});

app.get('/admin/', protectAdminRoute, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/index.html'));
});

app.get('/admin/index.html', protectAdminRoute, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/index.html'));
});

app.get('/admin/*.html', protectAdminRoute, (req, res) => {
    const requestedFile = path.basename(req.path);
    const filePath = path.join(__dirname, 'admin', requestedFile);

    // Security: prevent directory traversal
    if (!filePath.startsWith(path.join(__dirname, 'admin'))) {
        return res.status(403).send('Access denied');
    }

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Page not found');
    }
});

// File Upload Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
        const allowedMimeTypes = /jpeg|jpg|png|gif|webp|svg\+xml|svg/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedMimeTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Helper Functions - تستخدم نظام DataManager المحسن
const readJSON = (filename) => {
    try {
        // تحويل المسار لاسم الملف فقط
        const name = filename.replace('secure_data/', '').replace('.json', '');
        return dataManager.read(name);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        return [];
    }
};

const writeJSON = (filename, data) => {
    try {
        const name = filename.replace('secure_data/', '').replace('.json', '');
        // الكتابة بشكل متزامن مع الانتظار
        dataManager.write(name, data).catch(err => {
            console.error(`Async write error for ${filename}:`, err);
        });
        return true;
    } catch (error) {
        console.error(`Error writing ${filename}:`, error);
        return false;
    }
};

// دالة الكتابة المتزامنة للعمليات الحرجة
const writeJSONAsync = async (filename, data) => {
    try {
        const name = filename.replace('secure_data/', '').replace('.json', '');
        return await dataManager.write(name, data);
    } catch (error) {
        console.error(`Error writing ${filename}:`, error);
        return false;
    }
};

const logActivity = (userId, username, action, details) => {
    try {
        const manager = shardedDataService.getManager('logs');
        if (manager) {
            manager.create({
                id: uuidv4(),
                userId,
                username,
                action,
                details,
                date: new Date().toISOString().split('T')[0], // For filtering by date
                timestamp: new Date().toISOString()
            });
        } else {
            // Fallback to legacy file
            const logs = readJSON('secure_data/logs.json');
            logs.push({
                id: uuidv4(),
                userId,
                username,
                action,
                details,
                timestamp: new Date().toISOString()
            });
            writeJSON('secure_data/logs.json', logs);
        }
    } catch (error) {
        console.error('Failed to log activity:', error);
    }
};

// ==================== VISITOR TRACKING (REDIS) ====================
// تم استبدال النظام القديم بنظام TrafficManager المعتمد على Redis
// انظر: lib/redisCache.js

const trackVisitor = (req) => {
    trafficManager.trackVisit(req);
};

// Auth Middleware
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

// ==================== PERMISSIONS SYSTEM ====================
const PERMISSIONS = {
    // Content Management
    MANAGE_UNITS: 'manage_units',       // Create, update, delete units
    MANAGE_PROJECTS: 'manage_projects', // Create, update, delete projects
    MANAGE_NEWS: 'manage_news',         // Create, update, delete news

    // User Interaction
    MANAGE_MESSAGES: 'manage_messages', // View, delete messages
    MANAGE_REVIEWS: 'manage_reviews',   // Approve, delete reviews
    MANAGE_COMMENTS: 'manage_comments', // Approve, delete comments

    // System Management
    VIEW_DASHBOARD: 'view_dashboard',   // Access main dashboard stats
    MANAGE_SETTINGS: 'manage_settings', // Update site settings
    MANAGE_USERS: 'manage_users',       // Create, update, delete users
    VIEW_LOGS: 'view_logs',             // View system logs
    VIEW_STATS: 'view_stats',           // View detailed stats (reports)
    MANAGE_BACKUPS: 'manage_backups'    // Create, download backups
};

// Expose Permissions to API for frontend
app.get('/api/admin/permissions-list', (req, res) => {
    res.json(PERMISSIONS);
});

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

        // Backward compatibility for old roles (optional, can be removed after migration)
        if (requiredPermission === PERMISSIONS.MANAGE_NEWS && user.role === 'news_editor') return next();
        if (requiredPermission === PERMISSIONS.MANAGE_UNITS && user.role === 'editor') return next();

        return res.status(403).json({ error: 'Insufficient permissions' });
    };
};

// Deprecated: checkRole (Left for temporary compatibility, will use checkPermission internally)
const checkRole = (...roles) => {
    return (req, res, next) => {
        // Map old roles to new permissions if needed, or just block
        if (req.user.role === 'super_admin') return next();
        if (roles.includes(req.user.role)) return next();
        return res.status(403).json({ error: 'Insufficient permissions' });
    };
};

// ==================== CAPTCHA SYSTEM (File-based for PM2 cluster) ====================
const CAPTCHA_THRESHOLD = 3;
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes
const CAPTCHA_FILE = path.join(__dirname, 'secure_data', 'login_attempts.json');

// Read attempts from file (shared across PM2 instances)
const readAttempts = () => {
    try {
        if (fs.existsSync(CAPTCHA_FILE)) {
            return JSON.parse(fs.readFileSync(CAPTCHA_FILE, 'utf8'));
        }
    } catch (e) { }
    return { attempts: {}, captchas: {} };
};

// Write attempts to file
const writeAttempts = (data) => {
    try {
        fs.writeFileSync(CAPTCHA_FILE, JSON.stringify(data), 'utf8');
    } catch (e) {
        console.error('Failed to write login attempts:', e);
    }
};

// Generate simple math CAPTCHA
const generateCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operators = ['+', '-', '*'];
    const op = operators[Math.floor(Math.random() * operators.length)];
    let answer;
    let question;

    switch (op) {
        case '+': answer = num1 + num2; question = `${num1} + ${num2}`; break;
        case '-': answer = num1 - num2; question = `${num1} - ${num2}`; break;
        case '*': answer = num1 * num2; question = `${num1} × ${num2}`; break;
    }

    return { question, answer: answer.toString() };
};

// Clean up old IP attempts
const cleanupOldAttempts = (data) => {
    const now = Date.now();
    for (const ip in data.attempts) {
        if (now - data.attempts[ip].lastAttempt > ATTEMPT_WINDOW) {
            delete data.attempts[ip];
            delete data.captchas[ip];
        }
    }
    // Clean expired CAPTCHAs
    for (const ip in data.captchas) {
        if (now > data.captchas[ip].expires) {
            delete data.captchas[ip];
        }
    }
    return data;
};

// Get failed attempts for an IP
const getFailedAttempts = (ip) => {
    let data = readAttempts();
    data = cleanupOldAttempts(data);
    writeAttempts(data);

    const record = data.attempts[ip];
    if (!record) return 0;
    return record.count;
};

// Record failed attempt
const recordFailedAttempt = (ip) => {
    let data = readAttempts();
    data = cleanupOldAttempts(data);

    if (!data.attempts[ip]) {
        data.attempts[ip] = { count: 0, lastAttempt: Date.now() };
    }
    data.attempts[ip].count++;
    data.attempts[ip].lastAttempt = Date.now();

    writeAttempts(data);
    return data.attempts[ip].count;
};

// Store CAPTCHA for IP
const storeCaptcha = (ip, captcha) => {
    let data = readAttempts();
    data.captchas[ip] = { answer: captcha.answer, expires: Date.now() + 5 * 60 * 1000 };
    writeAttempts(data);
};

// Get stored CAPTCHA for IP
const getStoredCaptcha = (ip) => {
    const data = readAttempts();
    return data.captchas[ip];
};

// Clear failed attempts on successful login
const clearFailedAttempts = (ip) => {
    let data = readAttempts();
    delete data.attempts[ip];
    delete data.captchas[ip];
    writeAttempts(data);
};

// Check if CAPTCHA is required
app.get('/api/auth/captcha-status', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    const attempts = getFailedAttempts(ip);
    const requiresCaptcha = attempts >= CAPTCHA_THRESHOLD;

    if (requiresCaptcha) {
        const captcha = generateCaptcha();
        storeCaptcha(ip, captcha);
        res.json({ requiresCaptcha: true, captchaQuestion: captcha.question, attempts });
    } else {
        res.json({ requiresCaptcha: false, attempts });
    }
});

// ==================== AUTH ROUTES ====================
app.post('/api/auth/login', async (req, res) => {
    try {
        const ip = req.ip || req.connection.remoteAddress;
        const { username, password, captchaAnswer } = req.body;
        const attempts = getFailedAttempts(ip);

        // Check if CAPTCHA is required
        if (attempts >= CAPTCHA_THRESHOLD) {
            const storedCaptcha = getStoredCaptcha(ip);

            if (!storedCaptcha || Date.now() > storedCaptcha.expires) {
                return res.status(400).json({
                    error: 'CAPTCHA expired. Please refresh and try again.',
                    requiresCaptcha: true
                });
            }

            if (!captchaAnswer || captchaAnswer.toString() !== storedCaptcha.answer) {
                return res.status(400).json({
                    error: 'Incorrect CAPTCHA answer.',
                    requiresCaptcha: true
                });
            }
        }

        const users = readJSON('secure_data/users.json');
        const user = users.find(u => u.username === username);

        if (!user || !await bcrypt.compare(password, user.password)) {
            const newAttempts = recordFailedAttempt(ip);
            await new Promise(resolve => setTimeout(resolve, 1000));

            const response = { error: 'Invalid credentials' };
            if (newAttempts >= CAPTCHA_THRESHOLD) {
                const captcha = generateCaptcha();
                storeCaptcha(ip, captcha);
                response.requiresCaptcha = true;
                response.captchaQuestion = captcha.question;
            }
            response.attemptsRemaining = Math.max(0, CAPTCHA_THRESHOLD - newAttempts);

            return res.status(401).json(response);
        }

        // Successful login - clear failed attempts
        clearFailedAttempts(ip);

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, permissions: user.permissions || [] },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Set HTTP-only cookie for server-side auth (more secure)
        res.cookie('adminToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        logActivity(user.id, user.username, 'LOGIN', 'User logged in');

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name,
                permissions: user.permissions || []
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('adminToken');
    res.json({ success: true });
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// ==================== SETTINGS ROUTES ====================
app.get('/api/settings', (req, res) => {
    const settings = readJSON('secure_data/settings.json');
    res.json(settings);
});

app.get('/api/settings/locations', (req, res) => {
    const settings = readJSON('secure_data/settings.json');
    res.json(settings.locations || []);
});

app.get('/api/settings/unit-types', (req, res) => {
    const settings = readJSON('secure_data/settings.json');
    res.json(settings.unitTypes || []);
});

app.get('/api/settings/contact', (req, res) => {
    const settings = readJSON('secure_data/settings.json');
    res.json(settings.contact || {});
});

app.get('/api/settings/social', (req, res) => {
    const settings = readJSON('secure_data/settings.json');
    res.json(settings.social || {});
});

app.get('/api/settings/terms', (req, res) => {
    const settings = readJSON('secure_data/settings.json');
    res.json(settings.termsContent || {});
});

app.get('/api/settings/about', (req, res) => {
    const settings = readJSON('secure_data/settings.json');
    res.json(settings.aboutContent || {});
});

app.put('/api/admin/settings', authenticateToken, checkPermission(PERMISSIONS.MANAGE_SETTINGS), (req, res) => {
    try {
        const settings = readJSON('secure_data/settings.json');
        const updatedSettings = { ...settings, ...req.body };
        writeJSON('secure_data/settings.json', updatedSettings);
        logActivity(req.user.id, req.user.username, 'UPDATE_SETTINGS', 'Updated site settings');
        res.json(updatedSettings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

app.post('/api/admin/settings/locations', authenticateToken, checkRole('super_admin'), (req, res) => {
    try {
        const settings = readJSON('secure_data/settings.json');
        // Generate slug from English name
        const slug = (req.body.name?.en || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uuidv4();
        const newLocation = { id: slug, ...req.body };
        settings.locations = settings.locations || [];
        // Check for duplicate ID
        if (settings.locations.find(l => l.id === slug)) {
            return res.status(400).json({ error: 'Location with this ID already exists' });
        }
        settings.locations.push(newLocation);
        writeJSON('secure_data/settings.json', settings);
        logActivity(req.user.id, req.user.username, 'ADD_LOCATION', `Added location: ${newLocation.name?.ar}`);
        res.status(201).json(newLocation);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add location' });
    }
});

app.delete('/api/admin/settings/locations/:id', authenticateToken, checkRole('super_admin'), (req, res) => {
    try {
        const settings = readJSON('secure_data/settings.json');
        settings.locations = (settings.locations || []).filter(l => l.id !== req.params.id);
        writeJSON('secure_data/settings.json', settings);
        logActivity(req.user.id, req.user.username, 'DELETE_LOCATION', `Deleted location: ${req.params.id}`);
        res.json({ message: 'Location deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete location' });
    }
});

app.post('/api/admin/settings/unit-types', authenticateToken, checkRole('super_admin'), (req, res) => {
    try {
        const settings = readJSON('secure_data/settings.json');
        // Generate slug from English name
        const slug = (req.body.name?.en || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uuidv4();
        const newType = { id: slug, ...req.body };
        settings.unitTypes = settings.unitTypes || [];
        // Check for duplicate ID
        if (settings.unitTypes.find(t => t.id === slug)) {
            return res.status(400).json({ error: 'Unit type with this ID already exists' });
        }
        settings.unitTypes.push(newType);
        writeJSON('secure_data/settings.json', settings);
        logActivity(req.user.id, req.user.username, 'ADD_UNIT_TYPE', `Added unit type: ${newType.name?.ar}`);
        res.status(201).json(newType);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add unit type' });
    }
});

app.delete('/api/admin/settings/unit-types/:id', authenticateToken, checkRole('super_admin'), (req, res) => {
    try {
        const settings = readJSON('secure_data/settings.json');
        settings.unitTypes = (settings.unitTypes || []).filter(t => t.id !== req.params.id);
        writeJSON('secure_data/settings.json', settings);
        logActivity(req.user.id, req.user.username, 'DELETE_UNIT_TYPE', `Deleted unit type: ${req.params.id}`);
        res.json({ message: 'Unit type deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete unit type' });
    }
});

// Payment Plans
app.post('/api/admin/settings/payment-plans', authenticateToken, checkRole('super_admin'), (req, res) => {
    try {
        const settings = readJSON('secure_data/settings.json');
        const slug = (req.body.name?.en || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uuidv4();
        const newPlan = { id: slug, ...req.body };
        settings.paymentPlans = settings.paymentPlans || [];
        if (settings.paymentPlans.find(p => p.id === slug)) {
            return res.status(400).json({ error: 'Payment plan with this ID already exists' });
        }
        settings.paymentPlans.push(newPlan);
        writeJSON('secure_data/settings.json', settings);
        logActivity(req.user.id, req.user.username, 'ADD_PAYMENT_PLAN', `Added payment plan: ${newPlan.name?.ar}`);
        res.status(201).json(newPlan);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add payment plan' });
    }
});

app.delete('/api/admin/settings/payment-plans/:id', authenticateToken, checkRole('super_admin'), (req, res) => {
    try {
        const settings = readJSON('secure_data/settings.json');
        settings.paymentPlans = (settings.paymentPlans || []).filter(p => p.id !== req.params.id);
        writeJSON('secure_data/settings.json', settings);
        logActivity(req.user.id, req.user.username, 'DELETE_PAYMENT_PLAN', `Deleted payment plan: ${req.params.id}`);
        res.json({ message: 'Payment plan deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete payment plan' });
    }
});

// Unit Statuses
app.post('/api/admin/settings/unit-statuses', authenticateToken, checkRole('super_admin'), (req, res) => {
    try {
        const settings = readJSON('secure_data/settings.json');
        const slug = (req.body.name?.en || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uuidv4();
        const newStatus = { id: slug, ...req.body };
        settings.unitStatuses = settings.unitStatuses || [];
        if (settings.unitStatuses.find(s => s.id === slug)) {
            return res.status(400).json({ error: 'Unit status with this ID already exists' });
        }
        settings.unitStatuses.push(newStatus);
        writeJSON('secure_data/settings.json', settings);
        logActivity(req.user.id, req.user.username, 'ADD_UNIT_STATUS', `Added unit status: ${newStatus.name?.ar}`);
        res.status(201).json(newStatus);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add unit status' });
    }
});

app.delete('/api/admin/settings/unit-statuses/:id', authenticateToken, checkRole('super_admin'), (req, res) => {
    try {
        const settings = readJSON('secure_data/settings.json');
        settings.unitStatuses = (settings.unitStatuses || []).filter(s => s.id !== req.params.id);
        writeJSON('secure_data/settings.json', settings);
        logActivity(req.user.id, req.user.username, 'DELETE_UNIT_STATUS', `Deleted unit status: ${req.params.id}`);
        res.json({ message: 'Unit status deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete unit status' });
    }
});

// Views
app.post('/api/admin/settings/views', authenticateToken, checkRole('super_admin'), (req, res) => {
    try {
        const settings = readJSON('secure_data/settings.json');
        const slug = (req.body.name?.en || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uuidv4();
        const newView = { id: slug, ...req.body };
        settings.views = settings.views || [];
        if (settings.views.find(v => v.id === slug)) {
            return res.status(400).json({ error: 'View with this ID already exists' });
        }
        settings.views.push(newView);
        writeJSON('secure_data/settings.json', settings);
        logActivity(req.user.id, req.user.username, 'ADD_VIEW', `Added view: ${newView.name?.ar}`);
        res.status(201).json(newView);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add view' });
    }
});

app.delete('/api/admin/settings/views/:id', authenticateToken, checkRole('super_admin'), (req, res) => {
    try {
        const settings = readJSON('secure_data/settings.json');
        settings.views = (settings.views || []).filter(v => v.id !== req.params.id);
        writeJSON('secure_data/settings.json', settings);
        logActivity(req.user.id, req.user.username, 'DELETE_VIEW', `Deleted view: ${req.params.id}`);
        res.json({ message: 'View deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete view' });
    }
});

// ==================== UNITS ROUTES ====================

// Admin route for units - No caching, strict auth, shows all statuses
app.get('/api/admin/units', authenticateToken, checkPermission(PERMISSIONS.MANAGE_UNITS), (req, res) => {
    try {
        const { page = 1, limit = 20, type, location, status, unitStatus, projectId, minPrice, maxPrice, minArea, maxArea, featured, search, withPagination } = req.query;

        // No forced status='active' filter for admin
        const filter = {};
        if (status) filter.status = status; // Admin can filter by record status (active/inactive)
        if (type) filter.type = type;
        if (location) filter.locationId = location;
        if (projectId) filter.projectId = projectId;
        if (unitStatus) filter.unitStatus = unitStatus;
        if (featured === 'true') filter.featured = true;

        const unitsManager = shardedDataService.getManager('units');

        if (unitsManager) {
            let result = unitsManager.getByFilter(filter, {
                page: parseInt(page),
                limit: parseInt(limit)
            });

            // Price filter
            if (minPrice || maxPrice) {
                result.data = result.data.filter(u => {
                    const price = u.price || 0;
                    if (minPrice && price < parseInt(minPrice)) return false;
                    if (maxPrice && price > parseInt(maxPrice)) return false;
                    return true;
                });
            }

            // Area filter
            if (minArea || maxArea) {
                result.data = result.data.filter(u => {
                    const area = u.area || 0;
                    if (minArea && area < parseInt(minArea)) return false;
                    if (maxArea && area > parseInt(maxArea)) return false;
                    return true;
                });
            }

            // Search filter
            if (search) {
                const searchLower = search.toLowerCase();
                try {
                    result.data = result.data.filter(u =>
                        (u.title?.ar || '').toLowerCase().includes(searchLower) ||
                        (u.title?.en || '').toLowerCase().includes(searchLower) ||
                        (u.unitNumber || '').toLowerCase().includes(searchLower)
                    );
                } catch (e) { }
            }

            if (withPagination === 'true') {
                res.json({
                    data: result.data,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: result.total,
                        totalPages: Math.ceil(result.total / parseInt(limit))
                    }
                });
            } else {
                res.json(result.data);
            }
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Admin units fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch units' });
    }
});

// استخدام نظام Flat-File للتعامل مع ملايين السجلات
app.get('/api/units', cacheUnits, (req, res) => {
    const { page = 1, limit = 20, type, location, status, unitStatus, projectId, minPrice, maxPrice, minArea, maxArea, bedrooms, featured, search, sort, withPagination } = req.query;

    // بناء الفلتر
    const filter = { status: 'active' };
    if (type) filter.type = type;
    if (location) filter.locationId = location;
    if (projectId) filter.projectId = projectId;
    if (unitStatus) filter.unitStatus = unitStatus;
    else if (status) filter.unitStatus = status;
    if (featured === 'true') filter.featured = true;

    // استخدام FlatFileManager للقراءة من الملفات الفردية
    const unitsManager = shardedDataService.getManager('units');

    if (unitsManager) {
        // نظام Flat-File: قراءة من الفهرس والملفات الفردية
        let result = unitsManager.getByFilter(filter, {
            page: parseInt(page),
            limit: parseInt(limit)
        });

        // فلترة السعر (إضافية)
        if (minPrice || maxPrice) {
            result.data = result.data.filter(u => {
                const price = u.price || 0;
                if (minPrice && price < parseInt(minPrice)) return false;
                if (maxPrice && price > parseInt(maxPrice)) return false;
                return true;
            });
        }

        // فلترة المساحة
        if (minArea || maxArea) {
            result.data = result.data.filter(u => {
                const area = u.area || 0;
                if (minArea && area < parseInt(minArea)) return false;
                if (maxArea && area > parseInt(maxArea)) return false;
                return true;
            });
        }

        // فلترة عدد الغرف
        if (bedrooms) {
            const bedroomsNum = parseInt(bedrooms);
            result.data = result.data.filter(u => {
                if (bedroomsNum === 5) return (u.bedrooms || 0) >= 5;
                return u.bedrooms === bedroomsNum;
            });
        }

        // البحث النصي
        if (search) {
            const searchLower = search.toLowerCase();
            result.data = result.data.filter(u =>
                u.title?.ar?.toLowerCase().includes(searchLower) ||
                u.title?.en?.toLowerCase().includes(searchLower) ||
                u.location?.ar?.toLowerCase().includes(searchLower)
            );
        }

        // الترتيب
        if (sort) {
            switch (sort) {
                case 'price-low':
                    result.data.sort((a, b) => (a.price || 0) - (b.price || 0));
                    break;
                case 'price-high':
                    result.data.sort((a, b) => (b.price || 0) - (a.price || 0));
                    break;
                case 'area-low':
                    result.data.sort((a, b) => (a.area || 0) - (b.area || 0));
                    break;
                case 'area-high':
                    result.data.sort((a, b) => (b.area || 0) - (a.area || 0));
                    break;
                case 'newest':
                default:
                    result.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    break;
            }
        }

        // إرجاع مع pagination أو مصفوفة بسيطة
        if (withPagination === 'true') {
            res.json({
                data: result.data,
                pagination: {
                    total: result.total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: result.totalPages,
                    hasNext: result.hasNext,
                    hasPrev: result.hasPrev
                }
            });
        } else {
            res.json(result.data);
        }
    } else {
        res.status(500).json({ error: 'Flat-File system not available' });
    }
});

app.get('/api/units/:id', (req, res) => {
    // قراءة وحدة واحدة من Flat-File (2KB فقط!)
    const unitsManager = shardedDataService.getManager('units');

    if (unitsManager) {
        const unit = unitsManager.read(req.params.id);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });
        res.json(unit);
    } else {
        res.status(500).json({ error: 'Flat-File system not available' });
    }
});

app.post('/api/units', authenticateToken, checkPermission(PERMISSIONS.MANAGE_UNITS), async (req, res) => {
    try {
        const unitsManager = shardedDataService.getManager('units');

        // الحصول على numericId من المستخدم أو توليد واحد جديد
        let numericId = req.body.unitId || req.body.numericId;
        if (!numericId && unitsManager) {
            // توليد numericId تلقائي من العداد
            const meta = unitsManager.getMeta();
            numericId = (meta.totalCount || 0) + 1;
        }
        numericId = String(numericId).padStart(6, '0');

        // Generate SEO-friendly slug (للـ URL)
        let slug = '';
        const titleEn = req.body.title?.en || '';
        const titleAr = req.body.title?.ar || '';
        const unitNumber = req.body.unitNumber || '';
        const buildingNumber = req.body.buildingNumber || '';

        if (titleEn) {
            slug = titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            if (unitNumber) slug += `-unit-${unitNumber}`;
            if (buildingNumber) slug += `-building-${buildingNumber}`;
        } else if (unitNumber || buildingNumber) {
            slug = `unit-${unitNumber || 'x'}-building-${buildingNumber || 'x'}`;
        } else if (titleAr) {
            slug = titleAr.replace(/[^\u0600-\u06FF0-9]+/g, '-').replace(/^-|-$/g, '');
        }

        // Ensure uniqueness
        const existingUnit = unitsManager ? unitsManager.read(slug) : null;
        if (!slug || existingUnit) {
            slug = slug ? `${slug}-${Date.now()}` : `unit-${numericId}`;
        }

        const newUnit = {
            id: slug,
            numericId: numericId, // ID رقمي للتقسيم
            ...req.body,
            status: req.body.status || 'active',
            createdAt: new Date().toISOString(),
            createdBy: req.user.id
        };

        // حفظ في Flat-File
        if (unitsManager) {
            await unitsManager.create(newUnit);
            // تحديث الصفحات الثابتة
            staticGenerator.updateFirstPages('units', 5).catch(console.error);
        }

        logActivity(req.user.id, req.user.username, 'CREATE_UNIT', `Created unit: ${newUnit.title?.ar || newUnit.id}`);
        updateSitemap();
        res.status(201).json(newUnit);
    } catch (error) {
        console.error('Create unit error:', error);
        res.status(500).json({ error: 'Failed to create unit' });
    }
});

app.put('/api/units/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_UNITS), async (req, res) => {
    try {
        const unitsManager = shardedDataService.getManager('units');

        if (unitsManager) {
            const existingUnit = unitsManager.read(req.params.id);
            if (!existingUnit) return res.status(404).json({ error: 'Unit not found' });

            const updatedUnit = await unitsManager.update(req.params.id, {
                ...req.body,
                updatedAt: new Date().toISOString()
            });

            // تحديث الصفحات الثابتة
            staticGenerator.updateFirstPages('units', 5).catch(console.error);

            logActivity(req.user.id, req.user.username, 'UPDATE_UNIT', `Updated unit: ${req.params.id}`);
            res.json(updatedUnit);
        } else {
            res.status(500).json({ error: 'Flat-File system not available' });
        }
    } catch (error) {
        console.error('Update unit error:', error);
        res.status(500).json({ error: 'Failed to update unit' });
    }
});

app.delete('/api/units/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_UNITS), async (req, res) => {
    try {
        const unitsManager = shardedDataService.getManager('units');

        if (unitsManager) {
            const existingUnit = unitsManager.read(req.params.id);
            if (!existingUnit) return res.status(404).json({ error: 'Unit not found' });

            await unitsManager.delete(req.params.id);

            // مسح الـ cache لضمان عدم ظهور الوحدة المحذوفة
            apiCache.invalidate('units');

            // تحديث الصفحات الثابتة
            staticGenerator.updateFirstPages('units', 5).catch(console.error);

            logActivity(req.user.id, req.user.username, 'DELETE_UNIT', `Deleted unit: ${req.params.id}`);
            updateSitemap();
            res.json({ message: 'Unit deleted successfully' });
        } else {
            res.status(500).json({ error: 'Flat-File system not available' });
        }
    } catch (error) {
        console.error('Delete unit error:', error);
        res.status(500).json({ error: 'Failed to delete unit' });
    }
});

// ==================== PROJECTS ROUTES ====================
// استخدام نظام Flat-File للتعامل مع ملايين السجلات
app.get('/api/projects', cacheProjects, (req, res) => {
    const { page = 1, limit = 20, location, featured, search, withPagination } = req.query;

    // بناء الفلتر
    const filter = { status: 'active' };
    if (location) filter.locationId = location;
    if (featured === 'true') filter.featured = true;

    // استخدام FlatFileManager
    const projectsManager = shardedDataService.getManager('projects');
    const unitsManager = shardedDataService.getManager('units');

    if (projectsManager) {
        let result = projectsManager.getByFilter(filter, {
            page: parseInt(page),
            limit: parseInt(limit)
        });

        // البحث النصي
        if (search) {
            const searchLower = search.toLowerCase();
            result.data = result.data.filter(p =>
                p.title?.ar?.toLowerCase().includes(searchLower) ||
                p.title?.en?.toLowerCase().includes(searchLower)
            );
        }

        // إضافة عدد الوحدات (من الفهرس فقط)
        if (unitsManager) {
            result.data = result.data.map(project => {
                const unitsResult = unitsManager.getByFilter({ projectId: project.id }, { limit: 1000 });
                const availableUnits = unitsResult.data.filter(u => u.unitStatus === 'available').length;
                return { ...project, totalUnits: unitsResult.total, availableUnits };
            });
        }

        // إرجاع مع pagination أو مصفوفة بسيطة
        if (withPagination === 'true') {
            res.json({
                data: result.data,
                pagination: {
                    total: result.total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: result.totalPages,
                    hasNext: result.hasNext,
                    hasPrev: result.hasPrev
                }
            });
        } else {
            res.json(result.data);
        }
    } else {
        res.status(500).json({ error: 'Flat-File system not available' });
    }
});

// API للحصول على جميع المشاريع بدون pagination (للتوافق) - يستخدم Flat-File
app.get('/api/projects/all', (req, res) => {
    const projectsManager = shardedDataService.getManager('projects');
    const unitsManager = shardedDataService.getManager('units');

    if (projectsManager) {
        const result = projectsManager.getByFilter({ status: 'active' }, { limit: 1000 });

        const projectsWithCounts = result.data.map(project => {
            let totalUnits = 0, availableUnits = 0;
            if (unitsManager) {
                const unitsResult = unitsManager.getByFilter({ projectId: project.id }, { limit: 10000 });
                totalUnits = unitsResult.total;
                availableUnits = unitsResult.data.filter(u => u.unitStatus === 'available').length;
            }
            return { ...project, totalUnits, availableUnits };
        });

        res.json(projectsWithCounts);
    } else {
        res.status(500).json({ error: 'Flat-File system not available' });
    }
});

app.get('/api/projects/:id', (req, res) => {
    const projectsManager = shardedDataService.getManager('projects');
    const unitsManager = shardedDataService.getManager('units');

    if (projectsManager) {
        const project = projectsManager.read(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // حساب عدد الوحدات من الفهرس
        let totalUnits = 0, availableUnits = 0;
        if (unitsManager) {
            const unitsResult = unitsManager.getByFilter({ projectId: project.id }, { limit: 10000 });
            totalUnits = unitsResult.total;
            availableUnits = unitsResult.data.filter(u => u.unitStatus === 'available').length;
        }

        res.json({ ...project, totalUnits, availableUnits });
    } else {
        res.status(500).json({ error: 'Flat-File system not available' });
    }
});

app.post('/api/projects', authenticateToken, checkPermission(PERMISSIONS.MANAGE_PROJECTS), async (req, res) => {
    try {
        const projectsManager = shardedDataService.getManager('projects');
        const newProject = {
            id: `project-${uuidv4().split('-')[0]}`,
            ...req.body,
            status: req.body.status || 'active',
            createdAt: new Date().toISOString(),
            createdBy: req.user.id
        };

        if (projectsManager) {
            await projectsManager.create(newProject);
            staticGenerator.updateFirstPages('projects', 5).catch(console.error);
        }

        logActivity(req.user.id, req.user.username, 'CREATE_PROJECT', `Created project: ${newProject.title?.ar || newProject.id}`);
        updateSitemap();
        res.status(201).json(newProject);
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

app.put('/api/projects/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_PROJECTS), async (req, res) => {
    try {
        const projectsManager = shardedDataService.getManager('projects');

        if (projectsManager) {
            const existing = projectsManager.read(req.params.id);
            if (!existing) return res.status(404).json({ error: 'Project not found' });

            const updated = await projectsManager.update(req.params.id, {
                ...req.body,
                updatedAt: new Date().toISOString()
            });

            staticGenerator.updateFirstPages('projects', 5).catch(console.error);
            logActivity(req.user.id, req.user.username, 'UPDATE_PROJECT', `Updated project: ${req.params.id}`);
            res.json(updated);
        } else {
            res.status(500).json({ error: 'Flat-File system not available' });
        }
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

app.delete('/api/projects/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_PROJECTS), async (req, res) => {
    try {
        const projectsManager = shardedDataService.getManager('projects');

        if (projectsManager) {
            const existing = projectsManager.read(req.params.id);
            if (!existing) return res.status(404).json({ error: 'Project not found' });

            await projectsManager.delete(req.params.id);

            // مسح الـ cache لضمان عدم ظهور المشروع المحذوف
            apiCache.invalidate('projects');

            staticGenerator.updateFirstPages('projects', 5).catch(console.error);
            logActivity(req.user.id, req.user.username, 'DELETE_PROJECT', `Deleted project: ${req.params.id}`);
            updateSitemap();
            res.json({ message: 'Project deleted successfully' });
        } else {
            res.status(500).json({ error: 'Flat-File system not available' });
        }
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// Duplicate project
app.post('/api/projects/:id/duplicate', authenticateToken, checkRole('super_admin', 'editor'), async (req, res) => {
    try {
        const projectsManager = shardedDataService.getManager('projects');

        if (projectsManager) {
            const existing = projectsManager.read(req.params.id);
            if (!existing) return res.status(404).json({ error: 'Project not found' });

            // Create a copy with new ID and modified title
            const newProject = {
                ...existing,
                id: `proj_${Date.now()}`,
                title: {
                    ar: (existing.title?.ar || '') + ' (نسخة)',
                    en: (existing.title?.en || '') + ' (Copy)'
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await projectsManager.create(newProject);
            apiCache.invalidate('projects');
            logActivity(req.user.id, req.user.username, 'DUPLICATE_PROJECT', `Duplicated project: ${req.params.id} -> ${newProject.id}`);
            res.status(201).json(newProject);
        } else {
            res.status(500).json({ error: 'Flat-File system not available' });
        }
    } catch (error) {
        console.error('Duplicate project error:', error);
        res.status(500).json({ error: 'Failed to duplicate project' });
    }
});

// ==================== NEWS ROUTES ====================
// استخدام نظام Flat-File للتعامل مع ملايين السجلات
app.get('/api/news', cacheNews, (req, res) => {
    const { page = 1, limit = 20, category, search, withPagination } = req.query;

    // بناء الفلتر
    const filter = { status: 'published' };
    if (category) filter.category = category;

    // استخدام FlatFileManager
    const newsManager = shardedDataService.getManager('news');

    if (newsManager) {
        let result = newsManager.getByFilter(filter, {
            page: parseInt(page),
            limit: parseInt(limit)
        });

        // البحث النصي
        if (search) {
            const searchLower = search.toLowerCase();
            result.data = result.data.filter(n =>
                n.title?.ar?.toLowerCase().includes(searchLower) ||
                n.title?.en?.toLowerCase().includes(searchLower)
            );
        }

        // إرجاع مع pagination أو مصفوفة بسيطة
        if (withPagination === 'true') {
            res.json({
                data: result.data,
                pagination: {
                    total: result.total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: result.totalPages,
                    hasNext: result.hasNext,
                    hasPrev: result.hasPrev
                }
            });
        } else {
            res.json(result.data);
        }
    } else {
        res.status(500).json({ error: 'Flat-File system not available' });
    }
});

// للتوافق مع الكود القديم - يستخدم Flat-File
app.get('/api/news/all', (req, res) => {
    const newsManager = shardedDataService.getManager('news');
    if (newsManager) {
        const result = newsManager.getByFilter({ status: 'published' }, { limit: 1000 });
        res.json(result.data);
    } else {
        res.status(500).json({ error: 'Flat-File system not available' });
    }
});

app.get('/api/news/:id', (req, res) => {
    // قراءة خبر واحد من Flat-File
    const newsManager = shardedDataService.getManager('news');

    if (newsManager) {
        const article = newsManager.read(req.params.id);
        if (!article) return res.status(404).json({ error: 'Article not found' });
        res.json(article);
    } else {
        res.status(500).json({ error: 'Flat-File system not available' });
    }
});

app.post('/api/news', authenticateToken, checkPermission(PERMISSIONS.MANAGE_NEWS), async (req, res) => {
    try {
        const newsManager = shardedDataService.getManager('news');

        // Generate SEO-friendly slug
        let slug = '';
        const titleEn = req.body.title?.en || '';
        const titleAr = req.body.title?.ar || '';

        if (titleEn) {
            slug = titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        } else if (titleAr) {
            slug = titleAr.replace(/[^\u0600-\u06FF0-9]+/g, '-').replace(/^-|-$/g, '');
        }

        // Ensure uniqueness
        const existing = newsManager ? newsManager.read(slug) : null;
        if (!slug || existing) {
            slug = slug ? `${slug}-${Date.now()}` : uuidv4();
        }

        const newArticle = {
            id: slug,
            ...req.body,
            status: req.body.status || 'published',
            createdAt: new Date().toISOString(),
            createdBy: req.user.id
        };

        if (newsManager) {
            await newsManager.create(newArticle);
            staticGenerator.updateFirstPages('news', 5).catch(console.error);
        }

        logActivity(req.user.id, req.user.username, 'CREATE_NEWS', `Created article: ${newArticle.title?.ar || newArticle.id}`);
        res.status(201).json(newArticle);
    } catch (error) {
        console.error('Create news error:', error);
        res.status(500).json({ error: 'Failed to create article' });
    }
});

app.put('/api/news/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_NEWS), async (req, res) => {
    try {
        const newsManager = shardedDataService.getManager('news');

        if (newsManager) {
            const existing = newsManager.read(req.params.id);
            if (!existing) return res.status(404).json({ error: 'Article not found' });

            const updated = await newsManager.update(req.params.id, {
                ...req.body,
                updatedAt: new Date().toISOString()
            });

            staticGenerator.updateFirstPages('news', 5).catch(console.error);
            logActivity(req.user.id, req.user.username, 'UPDATE_NEWS', `Updated article: ${req.params.id}`);
            res.json(updated);
        } else {
            res.status(500).json({ error: 'Flat-File system not available' });
        }
    } catch (error) {
        console.error('Update news error:', error);
        res.status(500).json({ error: 'Failed to update article' });
    }
});

app.delete('/api/news/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_NEWS), async (req, res) => {
    try {
        const newsManager = shardedDataService.getManager('news');

        if (newsManager) {
            const existing = newsManager.read(req.params.id);
            if (!existing) return res.status(404).json({ error: 'Article not found' });

            await newsManager.delete(req.params.id);

            // مسح الـ cache لضمان عدم ظهور الخبر المحذوف
            apiCache.invalidate('news');

            staticGenerator.updateFirstPages('news', 5).catch(console.error);
            logActivity(req.user.id, req.user.username, 'DELETE_NEWS', `Deleted article: ${req.params.id}`);
            res.json({ message: 'Article deleted successfully' });
        } else {
            res.status(500).json({ error: 'Flat-File system not available' });
        }
    } catch (error) {
        console.error('Delete news error:', error);
        res.status(500).json({ error: 'Failed to delete article' });
    }
});

// ==================== PARTNERS ROUTES ====================
app.get('/api/partners', (req, res) => {
    const partners = readJSON('secure_data/partners.json');
    res.json(partners.filter(p => p.status === 'active'));
});

app.post('/api/partners', authenticateToken, checkPermission(PERMISSIONS.MANAGE_SETTINGS), (req, res) => {
    try {
        const partners = readJSON('secure_data/partners.json');
        const newPartner = {
            id: uuidv4(),
            ...req.body,
            createdAt: new Date().toISOString()
        };
        partners.push(newPartner);
        writeJSON('secure_data/partners.json', partners);
        logActivity(req.user.id, req.user.username, 'CREATE_PARTNER', `Added partner: ${newPartner.name?.ar || newPartner.id}`);
        res.status(201).json(newPartner);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add partner' });
    }
});

app.delete('/api/partners/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_SETTINGS), (req, res) => {
    try {
        let partners = readJSON('secure_data/partners.json');
        partners = partners.filter(p => p.id !== req.params.id);
        writeJSON('secure_data/partners.json', partners);
        logActivity(req.user.id, req.user.username, 'DELETE_PARTNER', `Deleted partner: ${req.params.id}`);
        res.json({ message: 'Partner deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete partner' });
    }
});

// ==================== COMMENTS ROUTES ====================
app.get('/api/comments/:type/:itemId', (req, res) => {
    const comments = readJSON('secure_data/comments.json') || [];
    const { type, itemId } = req.params;
    const filtered = comments.filter(c => c.type === type && c.itemId === itemId && c.status === 'approved');
    res.json(filtered);
});

// [DEPRECATED - Using shardedDataService instead at line ~3078]
// app.post('/api/comments', async (req, res) => {
//     try {
//         const newComment = {
//             id: uuidv4(),
//             ...req.body,
//             approved: false,
//             createdAt: new Date().toISOString()
//         };
//
//         // Use Queue if enabled
//         if (queueManager && queueManager.enabled) {
//             await queueManager.enqueue('comments', newComment);
//             return res.status(201).json({ message: 'Comment submitted for approval (Queued)' });
//         }
//
//         // Fallback to disk
//         const comments = readJSON('secure_data/comments.json');
//         comments.push(newComment);
//         writeJSON('secure_data/comments.json', comments);
//         res.status(201).json({ message: 'Comment submitted for approval' });
//     } catch (error) {
//         res.status(500).json({ error: 'Failed to submit comment' });
//     }
// });

// [DEPRECATED - Using shardedDataService instead]
// app.get('/api/admin/comments', authenticateToken, (req, res) => {
//     try {
//         let comments = readJSON('secure_data/comments.json') || [];
//         comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
//         res.json(comments);
//     } catch (error) {
//         res.status(500).json({ error: 'Failed to load comments' });
//     }
// });

// للتوافق مع الكود القديم
app.get('/api/admin/comments/all', authenticateToken, (req, res) => {
    const comments = readJSON('secure_data/comments.json') || [];
    res.json(comments);
});

app.put('/api/admin/comments/:id/approve', authenticateToken, checkPermission(PERMISSIONS.MANAGE_COMMENTS), (req, res) => {
    try {
        const manager = shardedDataService.getManager('comments');
        const existing = manager.read(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Comment not found' });

        const updated = manager.update(req.params.id, { status: 'approved' });
        logActivity(req.user.id, req.user.username, 'APPROVE_COMMENT', `Approved comment: ${req.params.id}`);
        res.json({ message: 'Comment approved', data: updated });
    } catch (error) {
        console.error('Approve comment error:', error);
        res.status(500).json({ error: 'Failed to approve comment' });
    }
});

app.put('/api/admin/comments/:id/reject', authenticateToken, checkPermission(PERMISSIONS.MANAGE_COMMENTS), (req, res) => {
    try {
        const manager = shardedDataService.getManager('comments');
        const existing = manager.read(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Comment not found' });

        const updated = manager.update(req.params.id, { status: 'rejected' });
        logActivity(req.user.id, req.user.username, 'REJECT_COMMENT', `Rejected comment: ${req.params.id}`);
        res.json({ message: 'Comment rejected', data: updated });
    } catch (error) {
        console.error('Reject comment error:', error);
        res.status(500).json({ error: 'Failed to reject comment' });
    }
});

app.delete('/api/admin/comments/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_COMMENTS), (req, res) => {
    try {
        const manager = shardedDataService.getManager('comments');
        const existing = manager.read(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Comment not found' });

        manager.delete(req.params.id);
        logActivity(req.user.id, req.user.username, 'DELETE_COMMENT', `Deleted comment: ${req.params.id}`);
        res.json({ message: 'Comment deleted' });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// ==================== REVIEWS ROUTES ====================
app.get('/api/reviews', (req, res) => {
    try {
        const manager = shardedDataService.getManager('reviews');
        // Only return approved reviews for public display
        const result = manager.getByFilter({ status: 'approved' }, { limit: 100, sort: 'createdAt:desc' });
        res.json(result.data || []);
    } catch (error) {
        console.error('Get reviews error:', error);
        // Fallback to legacy file
        const reviews = readJSON('secure_data/reviews.json');
        res.json(reviews);
    }
});

app.post('/api/reviews', async (req, res) => {
    try {
        const newReview = {
            id: uuidv4(),
            ...req.body,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        // Use shardedDataService for consistency with admin panel
        const manager = shardedDataService.getManager('reviews');
        if (manager) {
            manager.create(newReview);
            res.status(201).json({ message: 'Review submitted for approval' });
        } else {
            // Fallback to disk
            const allReviews = readJSON('secure_data/all_reviews.json');
            allReviews.push(newReview);
            writeJSON('secure_data/all_reviews.json', allReviews);
            res.status(201).json({ message: 'Review submitted for approval' });
        }
    } catch (error) {
        console.error('Review submission error:', error);
        res.status(500).json({ error: 'Failed to submit review' });
    }
});

// [DEPRECATED - Using shardedDataService instead]
// app.get('/api/admin/reviews', authenticateToken, (req, res) => {
//     const allReviews = readJSON('secure_data/all_reviews.json');
//     res.json(allReviews);
// });

app.put('/api/admin/reviews/:id/approve', authenticateToken, checkPermission(PERMISSIONS.MANAGE_REVIEWS), (req, res) => {
    try {
        const manager = shardedDataService.getManager('reviews');
        const existing = manager.read(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Review not found' });

        const updated = manager.update(req.params.id, { status: 'approved' });
        logActivity(req.user.id, req.user.username, 'APPROVE_REVIEW', `Approved review: ${req.params.id}`);
        res.json({ message: 'Review approved', data: updated });
    } catch (error) {
        console.error('Approve review error:', error);
        res.status(500).json({ error: 'Failed to approve review' });
    }
});

app.delete('/api/admin/reviews/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_REVIEWS), (req, res) => {
    try {
        const manager = shardedDataService.getManager('reviews');
        const existing = manager.read(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Review not found' });

        manager.delete(req.params.id);
        logActivity(req.user.id, req.user.username, 'DELETE_REVIEW', `Deleted review: ${req.params.id}`);
        res.json({ message: 'Review deleted' });
    } catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({ error: 'Failed to delete review' });
    }
});

// ==================== CONTACT MESSAGES ====================
app.post('/api/contact', async (req, res) => {
    try {
        const newMessage = {
            id: uuidv4(),
            ...req.body,
            isRead: false,
            status: 'new',
            createdAt: new Date().toISOString()
        };

        // Use shardedDataService for consistency with admin panel
        const manager = shardedDataService.getManager('messages');
        if (manager) {
            manager.create(newMessage);
            res.status(201).json({ message: 'Message sent successfully' });
        } else {
            // Fallback to disk
            const messages = readJSON('secure_data/messages.json');
            messages.push(newMessage);
            writeJSON('secure_data/messages.json', messages);
            res.status(201).json({ message: 'Message sent successfully' });
        }
    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// [DEPRECATED - Using shardedDataService instead]
// app.get('/api/admin/messages', authenticateToken, (req, res) => {
//     try {
//         let messages = readJSON('secure_data/messages.json') || [];
//         messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
//         res.json(messages);
//     } catch (error) {
//         res.status(500).json({ error: 'Failed to load messages' });
//     }
// });

// للتوافق مع الكود القديم
app.get('/api/admin/messages/all', authenticateToken, (req, res) => {
    const messages = readJSON('secure_data/messages.json');
    res.json(messages);
});

app.put('/api/admin/messages/:id/read', authenticateToken, checkPermission(PERMISSIONS.MANAGE_MESSAGES), (req, res) => {
    try {
        const manager = shardedDataService.getManager('messages');
        const existing = manager.read(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Message not found' });

        const updated = manager.update(req.params.id, { isRead: true });
        res.json({ message: 'Message marked as read', data: updated });
    } catch (error) {
        console.error('Mark message read error:', error);
        res.status(500).json({ error: 'Failed to update message' });
    }
});

app.delete('/api/admin/messages/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_MESSAGES), (req, res) => {
    try {
        const manager = shardedDataService.getManager('messages');
        const existing = manager.read(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Message not found' });

        manager.delete(req.params.id);
        res.json({ message: 'Message deleted' });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

// ==================== USER MANAGEMENT ====================
app.get('/api/admin/users', authenticateToken, checkPermission(PERMISSIONS.MANAGE_USERS), (req, res) => {
    const users = readJSON('secure_data/users.json');
    res.json(users.map(u => ({ id: u.id, username: u.username, name: u.name, role: u.role, permissions: u.permissions, createdAt: u.createdAt })));
});

app.post('/api/admin/users', authenticateToken, checkPermission(PERMISSIONS.MANAGE_USERS), async (req, res) => {
    try {
        const users = readJSON('secure_data/users.json');
        const { username, password, name, role, permissions } = req.body;

        if (users.find(u => u.username === username)) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: uuidv4(),
            username,
            password: hashedPassword,
            name,
            role: role || 'editor',
            permissions: permissions || [], // Store permissions
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        writeJSON('secure_data/users.json', users);
        logActivity(req.user.id, req.user.username, 'CREATE_USER', `Created user: ${username}`);

        res.status(201).json({ id: newUser.id, username: newUser.username, name: newUser.name, role: newUser.role, permissions: newUser.permissions });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create user' });
    }
});

app.put('/api/admin/users/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_USERS), (req, res) => {
    try {
        let users = readJSON('secure_data/users.json');
        const index = users.findIndex(u => u.id === req.params.id);

        if (index === -1) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { name, username, role, permissions } = req.body;

        // Check if username is taken by another user
        if (username && users.find(u => u.username === username && u.id !== req.params.id)) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        users[index] = {
            ...users[index],
            name,
            username,
            role,
            permissions: permissions || users[index].permissions || [], // Update permissions
            updatedAt: new Date().toISOString()
        };
        writeJSON('secure_data/users.json', users);
        logActivity(req.user.id, req.user.username, 'UPDATE_USER', `Updated user: ${username}`);

        res.json({ id: users[index].id, username: users[index].username, name: users[index].name, role: users[index].role, permissions: users[index].permissions });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

app.put('/api/admin/users/:id/password', authenticateToken, checkPermission(PERMISSIONS.MANAGE_USERS), async (req, res) => {
    try {
        let users = readJSON('secure_data/users.json');
        const index = users.findIndex(u => u.id === req.params.id);

        if (index === -1) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { password } = req.body;
        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        users[index].password = hashedPassword;
        users[index].updatedAt = new Date().toISOString();
        writeJSON('secure_data/users.json', users);
        logActivity(req.user.id, req.user.username, 'CHANGE_PASSWORD', `Changed password for user: ${users[index].username}`);

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to change password' });
    }
});

app.delete('/api/admin/users/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_USERS), (req, res) => {
    try {
        let users = readJSON('secure_data/users.json');
        const user = users.find(u => u.id === req.params.id);

        if (user && user.role === 'super_admin') {
            const superAdminCount = users.filter(u => u.role === 'super_admin').length;
            if (superAdminCount <= 1) {
                return res.status(400).json({ error: 'Cannot delete the last super admin' });
            }
        }

        users = users.filter(u => u.id !== req.params.id);
        writeJSON('secure_data/users.json', users);
        logActivity(req.user.id, req.user.username, 'DELETE_USER', `Deleted user: ${req.params.id}`);

        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// ==================== ACTIVITY LOGS ====================
// [DEPRECATED - Using shardedDataService instead]
// app.get('/api/admin/logs', authenticateToken, checkRole('super_admin'), (req, res) => {
//     const logs = readJSON('secure_data/logs.json');
//     res.json(logs.slice(-100).reverse());
// });

// ==================== FILE UPLOAD WITH IMAGE OPTIMIZATION ====================
// دالة ضغط وتحسين الصور
const optimizeImage = async (inputPath, outputPath, options = {}) => {
    const {
        maxWidth = 1920,
        maxHeight = 1080,
        quality = 80,
        format = 'jpeg'
    } = options;

    try {
        const image = sharp(inputPath);
        const metadata = await image.metadata();

        // تحديد الحجم الجديد مع الحفاظ على النسبة
        let resizeOptions = {};
        if (metadata.width > maxWidth || metadata.height > maxHeight) {
            resizeOptions = {
                width: maxWidth,
                height: maxHeight,
                fit: 'inside',
                withoutEnlargement: true
            };
        }

        // ضغط وحفظ الصورة
        if (format === 'webp') {
            await image
                .resize(resizeOptions)
                .webp({ quality })
                .toFile(outputPath);
        } else {
            await image
                .resize(resizeOptions)
                .jpeg({ quality, mozjpeg: true })
                .toFile(outputPath);
        }

        return true;
    } catch (error) {
        console.error('Image optimization error:', error);
        return false;
    }
};

app.post('/api/upload', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const originalPath = req.file.path;
        const ext = path.extname(req.file.filename).toLowerCase();
        const baseName = path.basename(req.file.filename, ext);
        const optimizedFilename = `${baseName}-opt.jpg`;
        const optimizedPath = path.join(path.dirname(originalPath), optimizedFilename);

        // ضغط الصورة (إذا كانت كبيرة)
        const stats = fs.statSync(originalPath);
        if (stats.size > 500 * 1024) { // أكبر من 500KB
            const optimized = await optimizeImage(originalPath, optimizedPath, {
                maxWidth: 1920,
                quality: 85
            });

            if (optimized) {
                // حذف الملف الأصلي واستخدام المضغوط
                fs.unlinkSync(originalPath);
                const imageUrl = `/uploads/${optimizedFilename}`;
                logActivity(req.user.id, req.user.username, 'UPLOAD_IMAGE', `Uploaded & optimized: ${optimizedFilename}`);
                return res.json({ url: imageUrl, filename: optimizedFilename, optimized: true });
            }
        }

        const imageUrl = `/uploads/${req.file.filename}`;
        logActivity(req.user.id, req.user.username, 'UPLOAD_IMAGE', `Uploaded: ${req.file.filename}`);
        res.json({ url: imageUrl, filename: req.file.filename });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

app.post('/api/upload/multiple', authenticateToken, upload.array('images', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const urls = [];
        for (const file of req.files) {
            const originalPath = file.path;
            const ext = path.extname(file.filename).toLowerCase();
            const baseName = path.basename(file.filename, ext);
            const optimizedFilename = `${baseName}-opt.jpg`;
            const optimizedPath = path.join(path.dirname(originalPath), optimizedFilename);

            // ضغط الصور الكبيرة
            const stats = fs.statSync(originalPath);
            if (stats.size > 500 * 1024) {
                const optimized = await optimizeImage(originalPath, optimizedPath, {
                    maxWidth: 1920,
                    quality: 85
                });

                if (optimized) {
                    fs.unlinkSync(originalPath);
                    urls.push({ url: `/uploads/${optimizedFilename}`, filename: optimizedFilename, optimized: true });
                    continue;
                }
            }

            urls.push({ url: `/uploads/${file.filename}`, filename: file.filename });
        }

        logActivity(req.user.id, req.user.username, 'UPLOAD_IMAGES', `Uploaded ${req.files.length} images`);
        res.json({ images: urls });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload files' });
    }
});


// ==================== MEDIA LIBRARY API ====================
app.get('/api/admin/media', authenticateToken, (req, res) => {
    try {
        const uploadsDir = path.join(__dirname, 'public/uploads');

        if (!fs.existsSync(uploadsDir)) {
            return res.json({ images: [] });
        }

        const files = fs.readdirSync(uploadsDir);
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

        const images = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return imageExtensions.includes(ext);
            })
            .map(file => {
                const filePath = path.join(uploadsDir, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    url: `/uploads/${file}`,
                    size: stats.size,
                    uploadedAt: stats.mtime
                };
            })
            .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

        res.json({ images, total: images.length });
    } catch (error) {
        console.error('Media library error:', error);
        res.status(500).json({ error: 'Failed to load media library' });
    }
});

app.delete('/api/admin/media/:filename', authenticateToken, (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(__dirname, 'public/uploads', filename);

        // Security check - prevent directory traversal
        if (filename.includes('..') || filename.includes('/')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        fs.unlinkSync(filePath);
        logActivity(req.user.id, req.user.username, 'DELETE_IMAGE', `Deleted: ${filename}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete media error:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Rename media file
app.patch('/api/admin/media/:filename', authenticateToken, (req, res) => {
    try {
        const { filename } = req.params;
        const { newName } = req.body;

        if (!newName) {
            return res.status(400).json({ error: 'New name is required' });
        }

        // Security check
        if (filename.includes('..') || filename.includes('/') || newName.includes('..') || newName.includes('/')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const oldPath = path.join(__dirname, 'public/uploads', filename);
        const ext = path.extname(filename);
        const newFilename = newName.includes('.') ? newName : `${newName}${ext}`;
        const newPath = path.join(__dirname, 'public/uploads', newFilename);

        if (!fs.existsSync(oldPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        if (fs.existsSync(newPath)) {
            return res.status(400).json({ error: 'A file with this name already exists' });
        }

        fs.renameSync(oldPath, newPath);
        logActivity(req.user.id, req.user.username, 'RENAME_IMAGE', `Renamed: ${filename} -> ${newFilename}`);
        res.json({ success: true, newFilename, url: `/uploads/${newFilename}` });
    } catch (error) {
        console.error('Rename media error:', error);
        res.status(500).json({ error: 'Failed to rename file' });
    }
});

// ==================== CACHE STATS API ====================
app.get('/api/admin/cache-stats', authenticateToken, checkRole('super_admin'), (req, res) => {
    res.json(apiCache.getStats());
});

app.post('/api/admin/cache-clear', authenticateToken, checkRole('super_admin'), (req, res) => {
    const { type } = req.body;
    if (type) {
        apiCache.invalidate(type);
        res.json({ message: `Cache cleared for ${type}` });
    } else {
        Object.keys(apiCache.caches).forEach(t => apiCache.invalidate(t));
        res.json({ message: 'All caches cleared' });
    }
});

// ==================== SITEMAP GENERATOR (SPLIT INTO MULTIPLE FILES) ====================
const SITEMAP_URLS_PER_FILE = 500; // الحد الأقصى لعدد الروابط في كل ملف

const updateSitemap = () => {
    try {
        const baseUrl = process.env.SITE_URL || 'https://aqar.com';
        const sitemapDir = path.join(__dirname, 'public/sitemaps');

        // إنشاء مجلد sitemaps إذا لم يكن موجوداً
        if (!fs.existsSync(sitemapDir)) {
            fs.mkdirSync(sitemapDir, { recursive: true });
        }

        // حذف الملفات القديمة
        const oldFiles = fs.readdirSync(sitemapDir).filter(f => f.startsWith('sitemap-'));
        oldFiles.forEach(f => fs.unlinkSync(path.join(sitemapDir, f)));

        const unitsManager = shardedDataService.getManager('units');
        const projectsManager = shardedDataService.getManager('projects');
        const newsManager = shardedDataService.getManager('news');

        // جمع كل الروابط
        const allUrls = [];

        // الصفحات الثابتة
        allUrls.push({ loc: `${baseUrl}/`, priority: '1.0', changefreq: 'daily' });
        allUrls.push({ loc: `${baseUrl}/units.html`, priority: '0.9', changefreq: 'daily' });
        allUrls.push({ loc: `${baseUrl}/projects.html`, priority: '0.9', changefreq: 'weekly' });
        allUrls.push({ loc: `${baseUrl}/news.html`, priority: '0.8', changefreq: 'daily' });
        allUrls.push({ loc: `${baseUrl}/partners.html`, priority: '0.7', changefreq: 'monthly' });
        allUrls.push({ loc: `${baseUrl}/reviews.html`, priority: '0.7', changefreq: 'weekly' });
        allUrls.push({ loc: `${baseUrl}/contact.html`, priority: '0.8', changefreq: 'monthly' });

        // الوحدات
        if (unitsManager) {
            const units = unitsManager.getByFilter({ status: 'active' }, { limit: 100000 }).data;
            units.forEach(unit => {
                allUrls.push({
                    loc: `${baseUrl}/unit-details.html?id=${unit.id}`,
                    lastmod: unit.updatedAt || unit.createdAt,
                    priority: '0.8',
                    changefreq: 'weekly'
                });
            });
        }

        // المشاريع
        if (projectsManager) {
            const projects = projectsManager.getByFilter({ status: 'active' }, { limit: 10000 }).data;
            projects.forEach(project => {
                allUrls.push({
                    loc: `${baseUrl}/project-details.html?id=${project.id}`,
                    lastmod: project.updatedAt || project.createdAt,
                    priority: '0.9',
                    changefreq: 'weekly'
                });
            });
        }

        // الأخبار
        if (newsManager) {
            const news = newsManager.getByFilter({ status: 'published' }, { limit: 50000 }).data;
            news.forEach(item => {
                allUrls.push({
                    loc: `${baseUrl}/news-details.html?id=${item.id}`,
                    lastmod: item.updatedAt || item.createdAt,
                    priority: '0.7',
                    changefreq: 'monthly'
                });
            });
        }

        // تقسيم الروابط إلى ملفات
        const sitemapFiles = [];
        const totalFiles = Math.ceil(allUrls.length / SITEMAP_URLS_PER_FILE);

        for (let i = 0; i < totalFiles; i++) {
            const start = i * SITEMAP_URLS_PER_FILE;
            const end = start + SITEMAP_URLS_PER_FILE;
            const chunk = allUrls.slice(start, end);

            let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
            chunk.forEach(url => {
                sitemap += `    <url>
        <loc>${url.loc}</loc>
        ${url.lastmod ? `<lastmod>${url.lastmod.split('T')[0]}</lastmod>` : ''}
        <changefreq>${url.changefreq}</changefreq>
        <priority>${url.priority}</priority>
    </url>\n`;
            });
            sitemap += '</urlset>';

            const filename = `sitemap-${String(i + 1).padStart(3, '0')}.xml`;
            fs.writeFileSync(path.join(sitemapDir, filename), sitemap);
            sitemapFiles.push(filename);
        }

        // إنشاء Sitemap Index
        let sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
        const now = new Date().toISOString().split('T')[0];
        sitemapFiles.forEach(filename => {
            sitemapIndex += `    <sitemap>
        <loc>${baseUrl}/sitemaps/${filename}</loc>
        <lastmod>${now}</lastmod>
    </sitemap>\n`;
        });
        sitemapIndex += '</sitemapindex>';

        // حفظ sitemap index في المجلد الرئيسي
        fs.writeFileSync(path.join(__dirname, 'public/sitemap.xml'), sitemapIndex);

        console.log(`✅ Sitemap updated: ${allUrls.length} URLs in ${totalFiles} files`);
    } catch (error) {
        console.error('Error updating sitemap:', error);
    }
};

// ==================== VISITOR TRACKING ====================
// Track visitors on public pages
app.use((req, res, next) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/admin/') && !req.path.includes('.')) {
        trackVisitor(req);
    }
    next();
});

// Get visitor stats
// Get visitor stats (Redis-based)
app.get('/api/admin/visitors', authenticateToken, async (req, res) => {
    try {
        const stats = await trafficManager.getStats(30);
        const today = new Date().toISOString().split('T')[0];
        const todayStats = stats.daily[today] || { count: 0, uniqueCount: 0 };

        // Calculate last 7 days and 30 days
        const days = Object.keys(stats.daily).sort();
        const last7Days = days.slice(-7);
        const last30Days = days.slice(-30);

        const stats7Days = last7Days.reduce((acc, d) => acc + (stats.daily[d]?.count || 0), 0);
        const stats30Days = last30Days.reduce((acc, d) => acc + (stats.daily[d]?.count || 0), 0);
        const unique7Days = last7Days.reduce((acc, d) => acc + (stats.daily[d]?.uniqueCount || 0), 0);
        const unique30Days = last30Days.reduce((acc, d) => acc + (stats.daily[d]?.uniqueCount || 0), 0);

        res.json({
            today: { views: todayStats.count, unique: todayStats.uniqueCount },
            last7Days: { views: stats7Days, unique: unique7Days },
            last30Days: { views: stats30Days, unique: unique30Days },
            total: stats.total || 0,
            daily: stats.daily
        });
    } catch (error) {
        console.error('Visitor stats error:', error);
        res.status(500).json({ error: 'Failed to fetch visitor stats' });
    }
});

// ==================== ADMIN STATS ====================
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
    const units = readJSON('secure_data/units.json');
    const projects = readJSON('secure_data/projects.json');
    const news = readJSON('secure_data/news.json');
    const messages = readJSON('secure_data/messages.json');
    const allReviews = readJSON('secure_data/all_reviews.json');
    const today = new Date().toISOString().split('T')[0];

    // Get stats from Redis
    const visitorsStats = await trafficManager.getStats(1);
    const todayData = visitorsStats.daily[today] || { count: 0 };

    res.json({
        units: { total: units.length, active: units.filter(u => u.status === 'active').length },
        projects: { total: projects.length, active: projects.filter(p => p.status === 'active').length },
        news: { total: news.length, published: news.filter(n => n.status === 'published').length },
        messages: { total: messages.length, unread: messages.filter(m => !m.read).length },
        reviews: { total: allReviews.length, pending: allReviews.filter(r => r.status === 'pending').length },
        visitors: { today: todayData.count, total: visitorsStats.total }
    });
});

// ==================== ADMIN REPORTS ====================
app.get('/api/admin/reports', authenticateToken, async (req, res) => {
    const units = readJSON('secure_data/units.json');
    const projects = readJSON('secure_data/projects.json');
    const messages = readJSON('secure_data/messages.json');
    const visitorsStats = await trafficManager.getStats(30);

    // Units by type
    const unitsByType = {};
    units.forEach(u => {
        unitsByType[u.type] = (unitsByType[u.type] || 0) + 1;
    });

    // Units by status
    const unitsByStatus = {};
    units.forEach(u => {
        const status = u.unitStatus || 'available';
        unitsByStatus[status] = (unitsByStatus[status] || 0) + 1;
    });

    // Units by location
    const unitsByLocation = {};
    units.forEach(u => {
        const loc = u.location?.ar || 'غير محدد';
        unitsByLocation[loc] = (unitsByLocation[loc] || 0) + 1;
    });

    // Messages by month
    const messagesByMonth = {};
    messages.forEach(m => {
        const month = m.createdAt?.substring(0, 7) || 'unknown';
        messagesByMonth[month] = (messagesByMonth[month] || 0) + 1;
    });

    res.json({
        unitsByType,
        unitsByStatus,
        unitsByLocation,
        messagesByMonth,
        visitorStats: visitorsStats.daily,
        summary: {
            totalUnits: units.length,
            activeUnits: units.filter(u => u.status === 'active').length,
            totalProjects: projects.length,
            totalMessages: messages.length,
            totalVisitors: visitorsStats.total || 0
        }
    });
});

// ==================== DATA MANAGEMENT APIs ====================
// إحصائيات النظام المفصلة
app.get('/api/admin/system-stats', authenticateToken, checkRole('super_admin'), (req, res) => {
    const stats = {
        units: dataManager.getStats('units'),
        projects: dataManager.getStats('projects'),
        news: dataManager.getStats('news'),
        messages: dataManager.getStats('messages'),
        comments: dataManager.getStats('comments'),
        reviews: dataManager.getStats('reviews'),
        all_reviews: dataManager.getStats('all_reviews'),
        logs: dataManager.getStats('logs'),
        settings: dataManager.getStats('settings')
    };

    // حساب الإجمالي
    const totalSize = Object.values(stats).reduce((acc, s) => acc + s.fileSize, 0);

    res.json({
        files: stats,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        cacheEnabled: true,
        archiveThreshold: 1000
    });
});

// أرشفة البيانات يدوياً
app.post('/api/admin/archive/:type', authenticateToken, checkRole('super_admin'), async (req, res) => {
    try {
        const { type } = req.params;
        const allowedTypes = ['messages', 'comments', 'logs', 'all_reviews'];

        if (!allowedTypes.includes(type)) {
            return res.status(400).json({ error: 'Invalid type. Allowed: ' + allowedTypes.join(', ') });
        }

        const result = await dataManager.archive(type);
        logActivity(req.user.id, req.user.username, 'ARCHIVE_DATA', `Archived ${result.archived} items from ${type}`);

        res.json({
            success: true,
            message: `تم أرشفة ${result.archived} عنصر`,
            ...result
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to archive data: ' + error.message });
    }
});

// مسح الكاش
app.post('/api/admin/clear-cache', authenticateToken, checkRole('super_admin'), (req, res) => {
    const { type } = req.body;

    if (type) {
        dataManager.clearCache(type);
        logActivity(req.user.id, req.user.username, 'CLEAR_CACHE', `Cleared cache for ${type}`);
    } else {
        dataManager.clearCache();
        logActivity(req.user.id, req.user.username, 'CLEAR_CACHE', 'Cleared all cache');
    }

    res.json({ success: true, message: 'Cache cleared successfully' });
});

// قائمة ملفات الأرشيف
app.get('/api/admin/archives', authenticateToken, checkRole('super_admin'), (req, res) => {
    try {
        const archiveDir = path.join(__dirname, 'secure_data', 'archive');
        if (!fs.existsSync(archiveDir)) {
            return res.json([]);
        }

        const files = fs.readdirSync(archiveDir)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const filePath = path.join(archiveDir, f);
                const stats = fs.statSync(filePath);
                return {
                    name: f,
                    size: stats.size,
                    sizeFormatted: formatBytes(stats.size),
                    createdAt: stats.birthtime
                };
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(files);
    } catch (error) {
        res.status(500).json({ error: 'Failed to list archives' });
    }
});

// تنزيل ملف أرشيف - مع حماية من Path Traversal
app.get('/api/admin/archives/:filename', authenticateToken, checkRole('super_admin'), (req, res) => {
    try {
        const archiveDir = path.join(__dirname, 'secure_data', 'archive');

        // حماية من Path Traversal - التحقق من أن الملف داخل المجلد المسموح
        const filename = path.basename(req.params.filename); // إزالة أي مسارات
        if (filename !== req.params.filename || filename.includes('..')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const filePath = path.join(archiveDir, filename);

        // التحقق من أن المسار النهائي داخل archiveDir
        if (!filePath.startsWith(archiveDir)) {
            return res.status(400).json({ error: 'Invalid path' });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Archive not found' });
        }

        res.download(filePath);
    } catch (error) {
        res.status(500).json({ error: 'Failed to download archive' });
    }
});

// حذف ملف أرشيف - مع حماية من Path Traversal
app.delete('/api/admin/archives/:filename', authenticateToken, checkRole('super_admin'), (req, res) => {
    try {
        const archiveDir = path.join(__dirname, 'secure_data', 'archive');

        // حماية من Path Traversal
        const filename = path.basename(req.params.filename);
        if (filename !== req.params.filename || filename.includes('..')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const filePath = path.join(archiveDir, filename);

        if (!filePath.startsWith(archiveDir)) {
            return res.status(400).json({ error: 'Invalid path' });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Archive not found' });
        }

        fs.unlinkSync(filePath);
        logActivity(req.user.id, req.user.username, 'DELETE_ARCHIVE', `Deleted archive: ${req.params.filename}`);

        res.json({ success: true, message: 'Archive deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete archive' });
    }
});

// Helper function
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==================== FLAT-FILE DATABASE APIs ====================

// تفعيل/تعطيل نظام Flat-File
app.post('/api/admin/flatfile/enable', authenticateToken, checkRole('super_admin'), async (req, res) => {
    try {
        flatFileEnabled = true;
        await dataService.initialize();
        res.json({ success: true, message: 'Flat-File Database enabled' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/flatfile/disable', authenticateToken, checkRole('super_admin'), (req, res) => {
    flatFileEnabled = false;
    res.json({ success: true, message: 'Flat-File Database disabled' });
});

app.get('/api/admin/flatfile/status', authenticateToken, (req, res) => {
    res.json({
        enabled: flatFileEnabled,
        types: ['units', 'projects', 'news'],
        stats: {
            units: flatFileEnabled ? dataService.getStats('units') : null,
            projects: flatFileEnabled ? dataService.getStats('projects') : null,
            news: flatFileEnabled ? dataService.getStats('news') : null
        }
    });
});

// ترحيل البيانات من النظام القديم
app.post('/api/admin/flatfile/migrate/:type', authenticateToken, checkRole('super_admin'), async (req, res) => {
    try {
        const { type } = req.params;

        if (!['units', 'projects', 'news'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type. Allowed: units, projects, news' });
        }

        console.log(`[Migration] Starting migration for ${type}...`);
        const result = await dataService.migrate(type);
        logActivity(req.user.id, req.user.username, 'MIGRATE_DATA', `Migrated ${result.migrated} ${type} to flat-file system`);

        res.json({
            success: true,
            message: `تم ترحيل ${result.migrated} عنصر بنجاح`,
            ...result
        });
    } catch (error) {
        console.error('[Migration] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// إعادة بناء الفهارس
app.post('/api/admin/flatfile/rebuild/:type', authenticateToken, checkRole('super_admin'), async (req, res) => {
    try {
        const { type } = req.params;

        if (!['units', 'projects', 'news'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type' });
        }

        const result = await dataService.rebuildIndices(type);
        logActivity(req.user.id, req.user.username, 'REBUILD_INDEX', `Rebuilt indices for ${type}`);

        res.json({ success: true, message: 'تم إعادة بناء الفهارس بنجاح', ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// إعادة بناء الفهارس
app.post('/api/admin/rebuild-indices', authenticateToken, checkRole('super_admin'), async (req, res) => {
    try {
        const types = ['units', 'projects', 'news'];
        const results = {};

        for (const type of types) {
            const manager = shardedDataService.getManager(type);
            if (manager) {
                const result = await manager.rebuildAllIndices();
                results[type] = result.indexed;
            }
        }

        logActivity(req.user.id, req.user.username, 'REBUILD_INDICES', `Rebuilt indices: ${JSON.stringify(results)}`);
        res.json({ success: true, indexed: results });
    } catch (error) {
        console.error('Rebuild indices error:', error);
        res.status(500).json({ error: error.message });
    }
});

// توليد الصفحات الثابتة
app.post('/api/admin/flatfile/generate/:type', authenticateToken, checkRole('super_admin'), async (req, res) => {
    try {
        const { type } = req.params;

        if (!['units', 'projects', 'news'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type' });
        }

        const result = await dataService.generateStaticPages(type);
        logActivity(req.user.id, req.user.username, 'GENERATE_PAGES', `Generated ${result.totalPages} static pages for ${type}`);

        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// البحث السريع (يستخدم FlexSearch)
app.get('/api/search', async (req, res) => {
    try {
        const { q, type, limit = 20 } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        if (type && ['units', 'projects', 'news'].includes(type)) {
            const results = await dataService.search(type, q, { limit: parseInt(limit) });
            res.json({ type, query: q, results, count: results.length });
        } else {
            // البحث في جميع الأنواع
            const allResults = await dataService.searchAll(q, { limit: parseInt(limit) });
            res.json({ query: q, results: allResults });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// الصفحات الثابتة المجهزة مسبقاً (Static Pages)
app.get('/api/v2/:type', (req, res) => {
    try {
        const { type } = req.params;
        const { page = 1 } = req.query;

        if (!['units', 'projects', 'news'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type' });
        }

        // محاولة قراءة الصفحة الثابتة
        const staticFile = path.join(__dirname, 'public', 'api', 'lists', type, 'all', `page_${page}.json`);

        if (fs.existsSync(staticFile)) {
            const data = JSON.parse(fs.readFileSync(staticFile, 'utf8'));
            res.json(data);
        } else {
            // fallback إلى النظام العادي
            const result = dataService.query(type, { page: parseInt(page), filter: { status: 'active' } });
            res.json(result);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// قراءة عنصر واحد من Flat-File
app.get('/api/v2/:type/:id', (req, res) => {
    try {
        const { type, id } = req.params;

        if (!['units', 'projects', 'news'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type' });
        }

        const item = dataService.read(type, id);

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// إحصائيات Flat-File
app.get('/api/admin/flatfile/stats', authenticateToken, (req, res) => {
    try {
        const stats = {};

        for (const type of ['units', 'projects', 'news']) {
            try {
                stats[type] = dataService.getStats(type);
            } catch (e) {
                stats[type] = { error: e.message };
            }
        }

        res.json({
            flatFileEnabled,
            stats,
            searchStats: searchManager.getStats()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage(),
        version: '2.0.0'
    });
});

app.get('/api/health', (req, res) => {
    const unitsManager = shardedDataService.getManager('units');
    const projectsManager = shardedDataService.getManager('projects');
    const newsManager = shardedDataService.getManager('news');

    res.json({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        services: {
            flatFile: !!unitsManager,
            cache: true,
            search: true
        },
        counts: {
            units: unitsManager ? unitsManager.getStats().totalCount : 0,
            projects: projectsManager ? projectsManager.getStats().totalCount : 0,
            news: newsManager ? newsManager.getStats().totalCount : 0
        }
    });
});

// ==================== REFRESH TOKEN ====================
app.post('/api/auth/refresh', authenticateToken, (req, res) => {
    try {
        // إنشاء توكن جديد بنفس البيانات
        const newToken = jwt.sign(
            { id: req.user.id, username: req.user.username, role: req.user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        logActivity(req.user.id, req.user.username, 'TOKEN_REFRESH', 'Token refreshed');

        res.json({
            token: newToken,
            expiresIn: '24h',
            user: { id: req.user.id, username: req.user.username, role: req.user.role }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

// ==================== BACKUP SYSTEM ====================
const archiver = require('archiver');

// إنشاء نسخة احتياطية
app.post('/api/admin/backup/create', authenticateToken, checkRole('super_admin'), async (req, res) => {
    try {
        const backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFilename = `backup-${timestamp}.zip`;
        const backupPath = path.join(backupDir, backupFilename);

        const output = fs.createWriteStream(backupPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            const stats = fs.statSync(backupPath);
            logActivity(req.user.id, req.user.username, 'CREATE_BACKUP', `Created backup: ${backupFilename} (${formatBytes(stats.size)})`);

            res.json({
                success: true,
                filename: backupFilename,
                size: stats.size,
                sizeFormatted: formatBytes(stats.size),
                createdAt: new Date().toISOString()
            });
        });

        archive.on('error', (err) => {
            throw err;
        });

        archive.pipe(output);

        // إضافة مجلد secure_data
        archive.directory(path.join(__dirname, 'secure_data'), 'secure_data');

        // إضافة مجلد uploads (اختياري - قد يكون كبيراً)
        const includeUploads = req.body.includeUploads !== false;
        if (includeUploads && fs.existsSync(path.join(__dirname, 'public/uploads'))) {
            archive.directory(path.join(__dirname, 'public/uploads'), 'uploads');
        }

        await archive.finalize();

    } catch (error) {
        console.error('Backup error:', error);
        res.status(500).json({ error: 'Failed to create backup' });
    }
});

// قائمة النسخ الاحتياطية
app.get('/api/admin/backup/list', authenticateToken, checkRole('super_admin'), (req, res) => {
    try {
        const backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            return res.json({ backups: [] });
        }

        const files = fs.readdirSync(backupDir)
            .filter(f => f.endsWith('.zip'))
            .map(filename => {
                const filePath = path.join(backupDir, filename);
                const stats = fs.statSync(filePath);
                return {
                    filename,
                    size: stats.size,
                    sizeFormatted: formatBytes(stats.size),
                    createdAt: stats.birthtime.toISOString()
                };
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ backups: files });
    } catch (error) {
        res.status(500).json({ error: 'Failed to list backups' });
    }
});

// تنزيل نسخة احتياطية - مع دعم token في query string للتنزيل المباشر
app.get('/api/admin/backup/download/:filename', (req, res) => {
    try {
        // التحقق من التوكن (من header أو query string)
        let token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        let user;
        try {
            user = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        if (user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const backupDir = path.join(__dirname, 'backups');
        const filename = path.basename(req.params.filename);

        if (filename !== req.params.filename || filename.includes('..')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const filePath = path.join(backupDir, filename);

        if (!filePath.startsWith(backupDir) || !fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        logActivity(user.id, user.username, 'DOWNLOAD_BACKUP', `Downloaded backup: ${filename}`);
        res.download(filePath);
    } catch (error) {
        res.status(500).json({ error: 'Failed to download backup' });
    }
});

// حذف نسخة احتياطية
app.delete('/api/admin/backup/:filename', authenticateToken, checkRole('super_admin'), (req, res) => {
    try {
        const backupDir = path.join(__dirname, 'backups');
        const filename = path.basename(req.params.filename);

        if (filename !== req.params.filename || filename.includes('..')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const filePath = path.join(backupDir, filename);

        if (!filePath.startsWith(backupDir) || !fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        fs.unlinkSync(filePath);
        logActivity(req.user.id, req.user.username, 'DELETE_BACKUP', `Deleted backup: ${filename}`);

        res.json({ success: true, message: 'Backup deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete backup' });
    }
});

// استعادة نسخة احتياطية
app.post('/api/admin/backup/restore/:filename', authenticateToken, checkRole('super_admin'), async (req, res) => {
    try {
        const backupDir = path.join(__dirname, 'backups');
        const filename = path.basename(req.params.filename);

        if (filename !== req.params.filename || filename.includes('..')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const filePath = path.join(backupDir, filename);

        if (!filePath.startsWith(backupDir) || !fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        const extract = require('extract-zip');
        const tempDir = path.join(__dirname, 'temp_restore_' + Date.now());

        await extract(filePath, { dir: tempDir });

        // استعادة secure_data
        const secureDataSource = path.join(tempDir, 'secure_data');
        const secureDataDest = path.join(__dirname, 'secure_data');

        if (fs.existsSync(secureDataSource)) {
            // نسخ الملفات
            const files = fs.readdirSync(secureDataSource);
            for (const file of files) {
                const src = path.join(secureDataSource, file);
                const dest = path.join(secureDataDest, file);
                if (fs.statSync(src).isFile()) {
                    fs.copyFileSync(src, dest);
                }
            }
        }

        // تنظيف المجلد المؤقت
        fs.rmSync(tempDir, { recursive: true, force: true });

        // إعادة تحميل الكاش
        dataManager.clearCache();

        logActivity(req.user.id, req.user.username, 'RESTORE_BACKUP', `Restored backup: ${filename}`);

        res.json({ success: true, message: 'Backup restored successfully' });
    } catch (error) {
        console.error('Restore error:', error);
        res.status(500).json({ error: 'Failed to restore backup: ' + error.message });
    }
});

// ==================== ERROR HANDLING MIDDLEWARE ====================
// [MOVED TO END - After sharded routes] 404 Handler for API routes
// Note: This must come AFTER all API routes are defined
// app.use((req, res, next) => {
//     if (req.path.startsWith('/api/')) {
//         return res.status(404).json({ error: 'Endpoint not found', path: req.path });
//     }
//     next();
// });

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Global Error:', err);

    // Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 5MB' });
    }

    if (err.message === 'Only image files are allowed') {
        return res.status(400).json({ error: err.message });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
    }

    // Default error
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
});

// ==================== SHARDED FLAT-FILE API ROUTES ====================
// Initialize sharded data service
shardedDataService.initAll();

// --- Comments API ---
app.get('/api/admin/comments', authenticateToken, checkPermission(PERMISSIONS.MANAGE_COMMENTS), (req, res) => {
    try {
        const { page = 1, limit = 20, status, unitId, projectId } = req.query;
        const manager = shardedDataService.getManager('comments');
        const filter = {};
        if (status) filter.status = status;
        if (unitId) filter.unitId = unitId;
        if (projectId) filter.projectId = projectId;
        const result = manager.getByFilter(filter, { page: parseInt(page), limit: parseInt(limit) });
        res.json({ data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

app.post('/api/comments', (req, res) => {
    try {
        const manager = shardedDataService.getManager('comments');
        const comment = manager.create({ ...req.body, status: 'pending' });
        res.status(201).json(comment);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create comment' });
    }
});

app.put('/api/admin/comments/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_COMMENTS), (req, res) => {
    try {
        const manager = shardedDataService.getManager('comments');
        const updated = manager.update(req.params.id, req.body);
        if (!updated) return res.status(404).json({ error: 'Comment not found' });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update comment' });
    }
});

app.delete('/api/admin/comments/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_COMMENTS), (req, res) => {
    try {
        const manager = shardedDataService.getManager('comments');
        const deleted = manager.delete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Comment not found' });
        res.json({ message: 'Comment deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// --- Reviews API ---
app.get('/api/admin/reviews', authenticateToken, checkPermission(PERMISSIONS.MANAGE_REVIEWS), (req, res) => {
    try {
        const { page = 1, limit = 20, status, unitId, projectId, rating } = req.query;
        const manager = shardedDataService.getManager('reviews');
        const filter = {};
        if (status) filter.status = status;
        if (unitId) filter.unitId = unitId;
        if (projectId) filter.projectId = projectId;
        if (rating) filter.rating = rating;
        const result = manager.getByFilter(filter, { page: parseInt(page), limit: parseInt(limit) });
        res.json({ data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

app.post('/api/reviews', (req, res) => {
    try {
        const manager = shardedDataService.getManager('reviews');
        const review = manager.create({ ...req.body, status: 'pending' });
        res.status(201).json(review);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create review' });
    }
});

app.put('/api/admin/reviews/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_REVIEWS), (req, res) => {
    try {
        const manager = shardedDataService.getManager('reviews');
        const updated = manager.update(req.params.id, req.body);
        if (!updated) return res.status(404).json({ error: 'Review not found' });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update review' });
    }
});

app.delete('/api/admin/reviews/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_REVIEWS), (req, res) => {
    try {
        const manager = shardedDataService.getManager('reviews');
        const deleted = manager.delete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Review not found' });
        res.json({ message: 'Review deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete review' });
    }
});

// --- Messages API ---
app.get('/api/admin/messages', authenticateToken, checkPermission(PERMISSIONS.MANAGE_MESSAGES), (req, res) => {
    try {
        const { page = 1, limit = 20, status, isRead } = req.query;
        const manager = shardedDataService.getManager('messages');
        const filter = {};
        if (status) filter.status = status;
        if (isRead !== undefined) filter.isRead = isRead === 'true';
        const result = manager.getByFilter(filter, { page: parseInt(page), limit: parseInt(limit) });
        res.json({ data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

app.post('/api/messages', (req, res) => {
    try {
        const manager = shardedDataService.getManager('messages');
        const message = manager.create({ ...req.body, isRead: false, status: 'new' });
        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create message' });
    }
});

app.put('/api/admin/messages/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_MESSAGES), (req, res) => {
    try {
        const manager = shardedDataService.getManager('messages');
        const updated = manager.update(req.params.id, req.body);
        if (!updated) return res.status(404).json({ error: 'Message not found' });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update message' });
    }
});

app.delete('/api/admin/messages/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_MESSAGES), (req, res) => {
    try {
        const manager = shardedDataService.getManager('messages');
        const deleted = manager.delete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Message not found' });
        res.json({ message: 'Message deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

// --- Activity Logs API ---
app.get('/api/admin/logs', authenticateToken, checkPermission(PERMISSIONS.VIEW_LOGS), (req, res) => {
    try {
        const { page = 1, limit = 50, userId, action, date } = req.query;
        const manager = shardedDataService.getManager('logs');
        const filter = {};
        if (userId) filter.userId = userId;
        if (action) filter.action = action;
        if (date) filter.date = date;
        const result = manager.getByFilter(filter, { page: parseInt(page), limit: parseInt(limit), sort: 'createdAt:desc' });
        res.json({ data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// --- Visitors/Analytics API ---
app.get('/api/admin/visitors', authenticateToken, checkPermission(PERMISSIONS.VIEW_STATS), (req, res) => {
    try {
        const { page = 1, limit = 100, date } = req.query;
        const manager = shardedDataService.getManager('visitors');
        const filter = {};
        if (date) filter.date = date;
        const result = manager.getByFilter(filter, { page: parseInt(page), limit: parseInt(limit), sort: 'createdAt:desc' });
        res.json({ data: result.data, pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch visitors' });
    }
});

// --- Sharded System Stats ---
app.get('/api/admin/sharded-stats', authenticateToken, checkRole('super_admin'), (req, res) => {
    try {
        const stats = shardedDataService.getAllStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// --- Rebuild Sharded Indexes ---
app.post('/api/admin/sharded-rebuild', authenticateToken, checkRole('super_admin'), async (req, res) => {
    try {
        const results = shardedDataService.rebuildAllIndices();
        res.json({ message: 'Indexes rebuilt', results });
    } catch (error) {
        res.status(500).json({ error: 'Failed to rebuild indexes' });
    }
});

// SPA Fallback for Admin (protected)
app.get('/admin/*', protectAdminRoute, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin/index.html'));
});

// ==================== BACKGROUND WORKER (QUEUE FLUSH) ====================
async function flushQueues() {
    if (!queueManager.enabled) return;

    const queues = ['messages', 'comments', 'reviews'];

    for (const queueName of queues) {
        try {
            // Get batch of 50 items
            const items = await queueManager.dequeueBatch(queueName, 50);
            if (items.length === 0) continue;

            const filename = `secure_data/${queueName === 'reviews' ? 'all_reviews' : queueName}.json`;

            // Read current file
            let currentData = dataManager.read(queueName === 'reviews' ? 'all_reviews' : queueName);
            if (!Array.isArray(currentData)) currentData = [];

            // Append new items (extract data property)
            items.forEach(item => {
                if (item && item.data) {
                    currentData.push(item.data);
                }
            });

            // Write back to disk
            await dataManager.write(queueName === 'reviews' ? 'all_reviews' : queueName, currentData);

            console.log(`[QueueWorker] Flushed ${items.length} items to ${filename}`);

        } catch (error) {
            console.error(`[QueueWorker] Failed to flush ${queueName}:`, error);
        }
    }
}

// Run queue flush every 5 seconds
setInterval(flushQueues, 5000);

// Start Server
app.listen(PORT, async () => {
    console.log('');
    console.log('🏢 ═══════════════════════════════════════════════════════════');
    console.log(`🏢 Aqar Server v2.1.0 - Running on http://localhost:${PORT}`);
    console.log('🏢 ═══════════════════════════════════════════════════════════');
    console.log('');

    // تهيئة Redis Cache
    try {
        await hybridCache.initialize();
        if (hybridCache.useRedis) {
            trafficManager.client = hybridCache.redis.client;
            trafficManager.enabled = true;

            // Queue Manager
            queueManager.client = hybridCache.redis.client;
            queueManager.enabled = true;

            console.log('✅ Traffic & Queue Managers: Enabled with Redis');
        }
        const stats = await hybridCache.getStats();
        if (stats.redis.connected) {
            console.log(`✅ Redis Cache: Connected (${stats.redis.memoryUsed || 'active'})`);
        } else {
            console.log(`⚠️  Redis Cache: Not available, using in-memory fallback`);
        }
    } catch (e) {
        console.log(`⚠️  Redis Cache: Failed to initialize, using in-memory fallback`);
    }

    console.log(`📊 Data Manager: Caching enabled, Archive threshold: 1000 items`);
    console.log(`📁 Flat-File DB: Available (use /api/admin/flatfile/enable to activate)`);

    // تهيئة نظام البحث
    try {
        await dataService.initialize();
        console.log(`🔍 Search Engine: Initialized`);
    } catch (e) {
        console.log(`🔍 Search Engine: Will initialize on first use`);
    }

    // Security Status
    console.log('');
    console.log('🔐 Security Status:');
    console.log(`   - HTTPS Enforcement: ${process.env.NODE_ENV === 'production' ? 'Enabled' : 'Disabled (dev mode)'}`);
    console.log(`   - CSP Headers: Enabled`);
    console.log(`   - Rate Limiting: Enabled (500 req/min API, 1000 req/min public)`);
    console.log(`   - Input Sanitization: Enabled`);
    console.log('');

    updateSitemap();

    console.log('🚀 Server is ready to handle millions of requests!');
    console.log('');
});

module.exports = app;
