/**
 * Routes Index
 * Combines all route modules into a single router
 */

const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const unitsRoutes = require('./units.routes');
const projectsRoutes = require('./projects.routes');
const newsRoutes = require('./news.routes');

/**
 * Initialize all routes with dependencies
 * @param {Object} deps - Dependencies from server.js
 */
const initRoutes = (deps) => {
    // Initialize each route module with dependencies
    authRoutes.init(deps);
    unitsRoutes.init(deps);
    projectsRoutes.init(deps);
    newsRoutes.init(deps);

    // Mount API routes
    router.use('/auth', authRoutes.router);
    router.use('/units', unitsRoutes.router);
    router.use('/projects', projectsRoutes.router);
    router.use('/news', newsRoutes.router);

    return router;
};

module.exports = { initRoutes };
