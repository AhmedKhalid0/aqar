/**
 * Authentication Routes
 * Handles login, logout, and token verification
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { authenticateToken, JWT_SECRET } = require('../middleware/auth.middleware');

// These will be injected from server.js
let readJSON, writeJSON, logActivity;
let getFailedAttempts, recordFailedAttempt, clearFailedAttempts;
let getStoredCaptcha, generateCaptcha, storeCaptcha;
let CAPTCHA_THRESHOLD;

/**
 * Initialize with dependencies from server.js
 */
const init = (deps) => {
    readJSON = deps.readJSON;
    writeJSON = deps.writeJSON;
    logActivity = deps.logActivity;
    getFailedAttempts = deps.getFailedAttempts;
    recordFailedAttempt = deps.recordFailedAttempt;
    clearFailedAttempts = deps.clearFailedAttempts;
    getStoredCaptcha = deps.getStoredCaptcha;
    generateCaptcha = deps.generateCaptcha;
    storeCaptcha = deps.storeCaptcha;
    CAPTCHA_THRESHOLD = deps.CAPTCHA_THRESHOLD;
};

/**
 * POST /api/auth/login
 * User login with CAPTCHA support
 */
router.post('/login', async (req, res) => {
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

        // Set HTTP-only cookie for server-side auth
        res.cookie('adminToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000
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

/**
 * POST /api/auth/logout
 * User logout
 */
router.post('/logout', (req, res) => {
    res.clearCookie('adminToken');
    res.json({ success: true });
});

/**
 * GET /api/auth/verify
 * Verify token validity
 */
router.get('/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

module.exports = { router, init };
