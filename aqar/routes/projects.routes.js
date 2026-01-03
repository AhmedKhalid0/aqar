/**
 * Projects Routes
 * CRUD operations for real estate projects
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const { authenticateToken, checkPermission, checkRole, PERMISSIONS } = require('../middleware/auth.middleware');

// Dependencies
let shardedDataService, staticGenerator, logActivity, updateSitemap, apiCache, cacheProjects;

const init = (deps) => {
    shardedDataService = deps.shardedDataService;
    staticGenerator = deps.staticGenerator;
    logActivity = deps.logActivity;
    updateSitemap = deps.updateSitemap;
    apiCache = deps.apiCache;
    cacheProjects = deps.cacheProjects;
};

/**
 * GET /api/projects
 * List projects with filtering and pagination
 */
router.get('/', (req, res, next) => {
    if (cacheProjects) return cacheProjects(req, res, () => handleGetProjects(req, res));
    handleGetProjects(req, res);
});

function handleGetProjects(req, res) {
    const { page = 1, limit = 20, location, featured, search, withPagination } = req.query;

    const filter = { status: 'active' };
    if (location) filter.locationId = location;
    if (featured === 'true') filter.featured = true;

    const projectsManager = shardedDataService.getManager('projects');
    const unitsManager = shardedDataService.getManager('units');

    if (projectsManager) {
        let result = projectsManager.getByFilter(filter, { page: parseInt(page), limit: parseInt(limit) });

        if (search) {
            const searchLower = search.toLowerCase();
            result.data = result.data.filter(p =>
                p.title?.ar?.toLowerCase().includes(searchLower) ||
                p.title?.en?.toLowerCase().includes(searchLower)
            );
        }

        if (unitsManager) {
            result.data = result.data.map(project => {
                const unitsResult = unitsManager.getByFilter({ projectId: project.id }, { limit: 1000 });
                const availableUnits = unitsResult.data.filter(u => u.unitStatus === 'available').length;
                return { ...project, totalUnits: unitsResult.total, availableUnits };
            });
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
 * GET /api/projects/all
 * Get all projects without pagination
 */
router.get('/all', (req, res) => {
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

/**
 * GET /api/projects/:id
 * Get single project
 */
router.get('/:id', (req, res) => {
    const projectsManager = shardedDataService.getManager('projects');
    const unitsManager = shardedDataService.getManager('units');

    if (projectsManager) {
        const project = projectsManager.read(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

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

/**
 * POST /api/projects
 * Create new project
 */
router.post('/', authenticateToken, checkPermission(PERMISSIONS.MANAGE_PROJECTS), async (req, res) => {
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

/**
 * PUT /api/projects/:id
 * Update project
 */
router.put('/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_PROJECTS), async (req, res) => {
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

/**
 * DELETE /api/projects/:id
 * Delete project
 */
router.delete('/:id', authenticateToken, checkPermission(PERMISSIONS.MANAGE_PROJECTS), async (req, res) => {
    try {
        const projectsManager = shardedDataService.getManager('projects');

        if (projectsManager) {
            const existing = projectsManager.read(req.params.id);
            if (!existing) return res.status(404).json({ error: 'Project not found' });

            await projectsManager.delete(req.params.id);
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

/**
 * POST /api/projects/:id/duplicate
 * Duplicate a project
 */
router.post('/:id/duplicate', authenticateToken, checkRole('super_admin', 'editor'), async (req, res) => {
    try {
        const projectsManager = shardedDataService.getManager('projects');

        if (projectsManager) {
            const existing = projectsManager.read(req.params.id);
            if (!existing) return res.status(404).json({ error: 'Project not found' });

            const newProject = {
                ...existing,
                id: `proj_${Date.now()}`,
                title: {
                    ar: (existing.title?.ar || '') + ' (نسخة)',
                    en: (existing.title?.en || '') + ' (Copy)'
                },
                createdAt: new Date().toISOString(),
                createdBy: req.user.id
            };

            await projectsManager.create(newProject);
            logActivity(req.user.id, req.user.username, 'DUPLICATE_PROJECT', `Duplicated project: ${req.params.id}`);
            res.status(201).json(newProject);
        } else {
            res.status(500).json({ error: 'Flat-File system not available' });
        }
    } catch (error) {
        console.error('Duplicate project error:', error);
        res.status(500).json({ error: 'Failed to duplicate project' });
    }
});

module.exports = { router, init };
