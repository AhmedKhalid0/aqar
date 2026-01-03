/**
 * Units Routes
 * CRUD operations for real estate units
 */

const express = require('express');
const router = express.Router();

const { authenticateToken, checkPermission, PERMISSIONS } = require('../middleware/auth.middleware');

// Dependencies injected from server.js
let shardedDataService, staticGenerator, logActivity, updateSitemap, apiCache, cacheUnits;

/**
 * Initialize with dependencies
 */
const init = (deps) => {
    shardedDataService = deps.shardedDataService;
    staticGenerator = deps.staticGenerator;
    logActivity = deps.logActivity;
    updateSitemap = deps.updateSitemap;
    apiCache = deps.apiCache;
    cacheUnits = deps.cacheUnits;
};

/**
 * GET /api/units
 * List units with filtering, pagination, and search
 */
router.get('/', (req, res, next) => {
    // Apply cache middleware
    if (cacheUnits) return cacheUnits(req, res, () => handleGetUnits(req, res));
    handleGetUnits(req, res);
});

function handleGetUnits(req, res) {
    const { page = 1, limit = 20, type, location, status, unitStatus, projectId, minPrice, maxPrice, minArea, maxArea, bedrooms, featured, search, sort, withPagination } = req.query;

    const filter = { status: 'active' };
    if (type) filter.type = type;
    if (location) filter.locationId = location;
    if (projectId) filter.projectId = projectId;
    if (unitStatus) filter.unitStatus = unitStatus;
    else if (status) filter.unitStatus = status;
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

        // Bedrooms filter
        if (bedrooms) {
            const bedroomsNum = parseInt(bedrooms);
            result.data = result.data.filter(u => {
                if (bedroomsNum === 5) return (u.bedrooms || 0) >= 5;
                return u.bedrooms === bedroomsNum;
            });
        }

        // Text search
        if (search) {
            const searchLower = search.toLowerCase();
            result.data = result.data.filter(u =>
                u.title?.ar?.toLowerCase().includes(searchLower) ||
                u.title?.en?.toLowerCase().includes(searchLower) ||
                u.location?.ar?.toLowerCase().includes(searchLower)
            );
        }

        // Sorting
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
 * GET /api/units/:id
 * Get single unit by ID
 */
router.get('/:id', (req, res) => {
    const unitsManager = shardedDataService.getManager('units');

    if (unitsManager) {
        const unit = unitsManager.read(req.params.id);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });
        res.json(unit);
    } else {
        res.status(500).json({ error: 'Flat-File system not available' });
    }
});

/**
 * POST /api/units
 * Create new unit
 */
router.post('/', authenticateToken, checkPermission(PERMISSIONS.MANAGE_UNITS), async (req, res) => {
    try {
        const unitsManager = shardedDataService.getManager('units');

        let numericId = req.body.unitId || req.body.numericId;
        if (!numericId && unitsManager) {
            const meta = unitsManager.getMeta();
            numericId = (meta.totalCount || 0) + 1;
        }
        numericId = String(numericId).padStart(6, '0');

        // Generate SEO-friendly slug
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

        const existingUnit = unitsManager ? unitsManager.read(slug) : null;
        if (!slug || existingUnit) {
            slug = slug ? `${slug}-${Date.now()}` : `unit-${numericId}`;
        }

        const newUnit = {
            id: slug,
            numericId: numericId,
            ...req.body,
            status: req.body.status || 'active',
            createdAt: new Date().toISOString(),
            createdBy: req.user.id
        };

        if (unitsManager) {
            await unitsManager.create(newUnit);
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

/**
 * PUT /api/units/:id
 * Update unit
 */
router.put('/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_UNITS), async (req, res) => {
    try {
        const unitsManager = shardedDataService.getManager('units');

        if (unitsManager) {
            const existingUnit = unitsManager.read(req.params.id);
            if (!existingUnit) return res.status(404).json({ error: 'Unit not found' });

            const updatedUnit = await unitsManager.update(req.params.id, {
                ...req.body,
                updatedAt: new Date().toISOString()
            });

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

/**
 * DELETE /api/units/:id
 * Delete unit
 */
router.delete('/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_UNITS), async (req, res) => {
    try {
        const unitsManager = shardedDataService.getManager('units');

        if (unitsManager) {
            const existingUnit = unitsManager.read(req.params.id);
            if (!existingUnit) return res.status(404).json({ error: 'Unit not found' });

            await unitsManager.delete(req.params.id);
            apiCache.invalidate('units');
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

module.exports = { router, init };
