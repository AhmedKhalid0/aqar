/**
 * News Routes
 * CRUD operations for news articles
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const { authenticateToken, checkPermission, PERMISSIONS } = require('../middleware/auth.middleware');

// Dependencies
let shardedDataService, staticGenerator, logActivity, apiCache, cacheNews;

const init = (deps) => {
    shardedDataService = deps.shardedDataService;
    staticGenerator = deps.staticGenerator;
    logActivity = deps.logActivity;
    apiCache = deps.apiCache;
    cacheNews = deps.cacheNews;
};

/**
 * GET /api/news
 * List news with filtering and pagination
 */
router.get('/', (req, res, next) => {
    if (cacheNews) return cacheNews(req, res, () => handleGetNews(req, res));
    handleGetNews(req, res);
});

function handleGetNews(req, res) {
    const { page = 1, limit = 20, category, search, withPagination } = req.query;

    const filter = { status: 'published' };
    if (category) filter.category = category;

    const newsManager = shardedDataService.getManager('news');

    if (newsManager) {
        let result = newsManager.getByFilter(filter, { page: parseInt(page), limit: parseInt(limit) });

        if (search) {
            const searchLower = search.toLowerCase();
            result.data = result.data.filter(n =>
                n.title?.ar?.toLowerCase().includes(searchLower) ||
                n.title?.en?.toLowerCase().includes(searchLower)
            );
        }

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
}

/**
 * GET /api/news/all
 * Get all published news
 */
router.get('/all', (req, res) => {
    const newsManager = shardedDataService.getManager('news');
    if (newsManager) {
        const result = newsManager.getByFilter({ status: 'published' }, { limit: 1000 });
        res.json(result.data);
    } else {
        res.status(500).json({ error: 'Flat-File system not available' });
    }
});

/**
 * GET /api/news/:id
 * Get single article
 */
router.get('/:id', (req, res) => {
    const newsManager = shardedDataService.getManager('news');

    if (newsManager) {
        const article = newsManager.read(req.params.id);
        if (!article) return res.status(404).json({ error: 'Article not found' });
        res.json(article);
    } else {
        res.status(500).json({ error: 'Flat-File system not available' });
    }
});

/**
 * POST /api/news
 * Create new article
 */
router.post('/', authenticateToken, checkPermission(PERMISSIONS.MANAGE_NEWS), async (req, res) => {
    try {
        const newsManager = shardedDataService.getManager('news');

        let slug = '';
        const titleEn = req.body.title?.en || '';
        const titleAr = req.body.title?.ar || '';

        if (titleEn) {
            slug = titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        } else if (titleAr) {
            slug = titleAr.replace(/[^\u0600-\u06FF0-9]+/g, '-').replace(/^-|-$/g, '');
        }

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

/**
 * PUT /api/news/:id
 * Update article
 */
router.put('/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_NEWS), async (req, res) => {
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

/**
 * DELETE /api/news/:id
 * Delete article
 */
router.delete('/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_NEWS), async (req, res) => {
    try {
        const newsManager = shardedDataService.getManager('news');

        if (newsManager) {
            const existing = newsManager.read(req.params.id);
            if (!existing) return res.status(404).json({ error: 'Article not found' });

            await newsManager.delete(req.params.id);
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

module.exports = { router, init };
