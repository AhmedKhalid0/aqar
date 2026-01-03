/**
 * Sharded Flat-File Database System
 * نظام قاعدة بيانات الملفات المسطحة مع فهارس مجزأة
 * 
 * @version 3.0.0
 * @description Time + Size based sharded indexes for unlimited scalability
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ==================== CONFIGURATION ====================
const CONFIG = {
    BASE_DIR: path.join(__dirname, '..', 'secure_data'),

    // Maximum shard size in bytes (512KB = 524288 bytes)
    MAX_SHARD_SIZE: 512 * 1024,

    // Supported entity types
    SUPPORTED_TYPES: [
        'units', 'projects', 'news',
        'comments', 'reviews', 'messages', 'visitors', 'logs', 'login_attempts'
    ],

    // Items per page for pagination
    ITEMS_PER_PAGE: 20,

    // Index fields for filtering
    INDEX_FIELDS: {
        units: ['projectId', 'type', 'status', 'unitStatus', 'locationId', 'featured'],
        projects: ['status', 'locationId', 'featured'],
        news: ['status', 'category'],
        comments: ['unitId', 'projectId', 'status', 'userId'],
        reviews: ['unitId', 'projectId', 'status', 'rating'],
        messages: ['status', 'isRead'],
        visitors: ['date', 'page'],
        logs: ['userId', 'action', 'date'],
        login_attempts: ['ip', 'success', 'username']
    },

    // Search fields for full-text search
    SEARCH_FIELDS: {
        units: ['title.ar', 'title.en', 'description.ar', 'description.en'],
        projects: ['title.ar', 'title.en', 'description.ar', 'description.en'],
        news: ['title.ar', 'title.en', 'content.ar', 'content.en'],
        comments: ['content', 'userName'],
        reviews: ['content', 'userName'],
        messages: ['name', 'email', 'subject', 'message'],
        visitors: ['ip', 'userAgent', 'page'],
        logs: ['action', 'details', 'username'],
        login_attempts: ['ip', 'username']
    }
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj, path) {
    const parts = path.split('.');
    let value = obj;
    for (const part of parts) {
        if (value && typeof value === 'object') {
            value = value[part];
        } else {
            return undefined;
        }
    }
    return value;
}

/**
 * Generate shard key from date (YYYY-MM format)
 */
function getShardKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) {
        return getCurrentShardKey();
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * Get current month's shard key
 */
function getCurrentShardKey() {
    return getShardKey(new Date());
}

/**
 * Convert ID to directory path (Directory Hashing)
 */
function idToPath(baseDir, id) {
    const idStr = String(id);
    let dir1, dir2;

    if (/^\d+$/.test(idStr) && idStr.length >= 4) {
        dir1 = idStr.substring(0, 2);
        dir2 = idStr.substring(2, 4);
    } else {
        dir1 = idStr.substring(0, 2) || '00';
        dir2 = idStr.substring(2, 4) || '00';
    }

    return path.join(baseDir, dir1, dir2, `${id}.json`);
}

/**
 * Ensure directory exists
 */
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// ==================== SHARDED FLAT FILE MANAGER ====================
class ShardedFlatFileDB {
    constructor(type) {
        if (!CONFIG.SUPPORTED_TYPES.includes(type)) {
            throw new Error(`Unsupported type: ${type}`);
        }

        this.type = type;
        this.baseDir = path.join(CONFIG.BASE_DIR, type);
        this.indexDir = path.join(this.baseDir, 'index');
        this.metaFile = path.join(this.baseDir, 'meta.json');

        this._ensureDirectories();
        this._loadMeta();
    }

    // ==================== CRUD OPERATIONS ====================

    /**
     * Create a new record
     */
    create(data) {
        const id = data.id || uuidv4();
        const now = new Date();
        const item = {
            ...data,
            id,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
        };

        // Save to individual file
        const filePath = idToPath(this.baseDir, id);
        ensureDir(path.dirname(filePath));
        fs.writeFileSync(filePath, JSON.stringify(item, null, 2));

        // Update sharded index
        this._addToIndex(item, getShardKey(now));

        // Update meta
        this.meta.totalCount++;
        this.meta.lastUpdated = now.toISOString();
        this._saveMeta();

        return item;
    }

    /**
     * Read a record by ID
     */
    read(id) {
        // Try direct path first
        const filePath = idToPath(this.baseDir, id);
        if (fs.existsSync(filePath)) {
            try {
                return JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } catch (e) {
                console.error(`[ShardedFlatFileDB] Read error for ${id}:`, e.message);
            }
        }

        // Fallback: search in all directories
        return this._findById(id);
    }

    /**
     * Update a record
     */
    update(id, updates) {
        const existing = this.read(id);
        if (!existing) return null;

        // Remove from old index
        this._removeFromIndex(existing);

        const updated = {
            ...existing,
            ...updates,
            id,
            updatedAt: new Date().toISOString()
        };

        // Save file
        const filePath = this._getFilePath(id) || idToPath(this.baseDir, id);
        ensureDir(path.dirname(filePath));
        fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));

        // Add to new index (based on original creation date)
        const shardKey = getShardKey(updated.createdAt);
        this._addToIndex(updated, shardKey);

        // Update meta
        this.meta.lastUpdated = new Date().toISOString();
        this._saveMeta();

        return updated;
    }

    /**
     * Delete a record
     */
    delete(id) {
        const existing = this.read(id);
        if (!existing) return false;

        // Remove from index
        this._removeFromIndex(existing);

        // Delete file
        const filePath = this._getFilePath(id);
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Update meta
        this.meta.totalCount = Math.max(0, this.meta.totalCount - 1);
        this.meta.lastUpdated = new Date().toISOString();
        this._saveMeta();

        return true;
    }

    // ==================== QUERY OPERATIONS ====================

    /**
     * Get records with filtering and pagination
     */
    getByFilter(filter = {}, options = {}) {
        const { page = 1, limit = CONFIG.ITEMS_PER_PAGE, sort = 'createdAt:desc' } = options;

        // Get matching IDs from shards (newest first)
        let allIds = this._getIdsFromShards(filter);

        // Sort
        if (sort && allIds.length > 0) {
            const [field, order] = sort.split(':');
            const items = allIds.map(id => this.read(id)).filter(Boolean);
            items.sort((a, b) => {
                const aVal = getNestedValue(a, field);
                const bVal = getNestedValue(b, field);
                const comp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                return order === 'desc' ? -comp : comp;
            });
            allIds = items.map(item => item.id);
        }

        // Paginate
        const total = allIds.length;
        const totalPages = Math.ceil(total / limit);
        const skip = (page - 1) * limit;
        const pageIds = allIds.slice(skip, skip + limit);

        // Read full data
        const data = pageIds.map(id => this.read(id)).filter(Boolean);

        return {
            data,
            total,
            page,
            limit,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        };
    }

    /**
     * Get all IDs across all shards
     */
    getAllIds() {
        return this._getIdsFromShards({});
    }

    /**
     * Search across all shards
     */
    search(query, options = {}) {
        const { limit = 20 } = options;
        if (!query) return [];

        const normalizedQuery = query.toLowerCase().trim();
        const results = [];
        const shards = this._getShardFiles();

        for (const shardFile of shards) {
            const shard = this._loadShard(shardFile);
            if (!shard.searchIndex) continue;

            for (const [id, keywords] of Object.entries(shard.searchIndex)) {
                if (keywords.toLowerCase().includes(normalizedQuery)) {
                    results.push(id);
                    if (results.length >= limit) break;
                }
            }
            if (results.length >= limit) break;
        }

        return results.map(id => this.read(id)).filter(Boolean);
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            type: this.type,
            totalCount: this.meta.totalCount,
            lastUpdated: this.meta.lastUpdated,
            shardCount: this._getShardFiles().length,
            baseDir: this.baseDir
        };
    }

    /**
     * Get meta information
     */
    getMeta() {
        return this.meta;
    }

    // ==================== INDEX OPERATIONS ====================

    /**
     * Rebuild all sharded indexes from files
     */
    rebuildAllIndices() {
        console.log(`[ShardedFlatFileDB] Rebuilding indices for ${this.type}...`);

        // Clear existing index files
        if (fs.existsSync(this.indexDir)) {
            const files = fs.readdirSync(this.indexDir);
            files.forEach(f => fs.unlinkSync(path.join(this.indexDir, f)));
        }

        // Scan all files and rebuild indexes
        const allIds = this._scanAllFiles();
        let count = 0;

        for (const id of allIds) {
            const item = this.read(id);
            if (!item) continue;

            const shardKey = getShardKey(item.createdAt || new Date());
            this._addToIndex(item, shardKey);

            count++;
            if (count % 1000 === 0) {
                console.log(`[ShardedFlatFileDB] Indexed ${count} items...`);
            }
        }

        // Update meta
        this.meta.totalCount = count;
        this.meta.lastIndexed = new Date().toISOString();
        this._saveMeta();

        console.log(`[ShardedFlatFileDB] Indexed ${count} ${this.type} items`);
        return { indexed: count };
    }

    // ==================== PRIVATE METHODS ====================

    _ensureDirectories() {
        ensureDir(this.baseDir);
        ensureDir(this.indexDir);
    }

    _loadMeta() {
        if (fs.existsSync(this.metaFile)) {
            try {
                this.meta = JSON.parse(fs.readFileSync(this.metaFile, 'utf8'));
            } catch (e) {
                this.meta = { totalCount: 0, lastUpdated: null };
            }
        } else {
            this.meta = { totalCount: 0, lastUpdated: null };
        }
    }

    _saveMeta() {
        fs.writeFileSync(this.metaFile, JSON.stringify(this.meta, null, 2));
    }

    _getShardFile(shardKey) {
        return path.join(this.indexDir, `${shardKey}.json`);
    }

    /**
     * Get the current active shard for writing (checks size limit)
     */
    _getActiveShardKey(baseShardKey) {
        // Find existing shards for this base key
        const pattern = new RegExp(`^${baseShardKey}(_\\d{3})?\\.json$`);
        const existingShards = fs.existsSync(this.indexDir)
            ? fs.readdirSync(this.indexDir).filter(f => pattern.test(f)).sort()
            : [];

        if (existingShards.length === 0) {
            return baseShardKey;
        }

        // Check the latest shard's size
        const latestShard = existingShards[existingShards.length - 1];
        const latestPath = path.join(this.indexDir, latestShard);

        try {
            const stat = fs.statSync(latestPath);
            if (stat.size >= CONFIG.MAX_SHARD_SIZE) {
                // Create new shard with incremented suffix
                const match = latestShard.match(/_(\d{3})\.json$/);
                const currentNum = match ? parseInt(match[1]) : 0;
                const newNum = String(currentNum + 1).padStart(3, '0');
                return `${baseShardKey}_${newNum}`;
            }
        } catch (e) { }

        // Use latest shard (remove .json extension)
        return latestShard.replace('.json', '');
    }

    _getShardFiles() {
        if (!fs.existsSync(this.indexDir)) return [];
        return fs.readdirSync(this.indexDir)
            .filter(f => f.endsWith('.json'))
            .sort()
            .reverse(); // Newest first
    }

    _loadShard(shardFile) {
        const fullPath = path.isAbsolute(shardFile) ? shardFile : path.join(this.indexDir, shardFile);
        if (!fs.existsSync(fullPath)) {
            return { ids: [], byField: {}, searchIndex: {}, pathMap: {} };
        }
        try {
            return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        } catch (e) {
            console.error(`[ShardedFlatFileDB] Error loading shard: ${fullPath}`, e.message);
            return { ids: [], byField: {}, searchIndex: {}, pathMap: {} };
        }
    }

    /**
     * Atomic save shard (write to temp file, then rename)
     */
    _saveShard(shardKey, data) {
        const shardPath = this._getShardFile(shardKey);
        const tempPath = shardPath + '.tmp';

        try {
            // Write to temp file first
            fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
            // Atomic rename
            fs.renameSync(tempPath, shardPath);
        } catch (e) {
            console.error(`[ShardedFlatFileDB] Error saving shard: ${shardPath}`, e.message);
            // Clean up temp file if exists
            if (fs.existsSync(tempPath)) {
                try { fs.unlinkSync(tempPath); } catch (e2) { }
            }
            throw e;
        }
    }

    _addToIndex(item, baseShardKey) {
        // Get the active shard (checks size limit and may create new shard)
        const shardKey = this._getActiveShardKey(baseShardKey);
        const shard = this._loadShard(this._getShardFile(shardKey));

        // Add to IDs list
        if (!shard.ids) shard.ids = [];
        if (!shard.ids.includes(item.id)) {
            shard.ids.unshift(item.id); // Newest first
        }

        // Index by fields
        if (!shard.byField) shard.byField = {};
        const fields = CONFIG.INDEX_FIELDS[this.type] || [];
        for (const field of fields) {
            const value = getNestedValue(item, field);
            if (value !== undefined && value !== null) {
                const key = String(value);
                if (!shard.byField[field]) shard.byField[field] = {};
                if (!shard.byField[field][key]) shard.byField[field][key] = [];
                if (!shard.byField[field][key].includes(item.id)) {
                    shard.byField[field][key].push(item.id);
                }
            }
        }

        // Search index
        if (!shard.searchIndex) shard.searchIndex = {};
        const searchFields = CONFIG.SEARCH_FIELDS[this.type] || [];
        const searchText = searchFields
            .map(f => getNestedValue(item, f))
            .filter(Boolean)
            .join(' ');
        shard.searchIndex[item.id] = searchText;

        // Store file path for quick lookup
        if (!shard.pathMap) shard.pathMap = {};
        const filePath = idToPath(this.baseDir, item.id);
        shard.pathMap[item.id] = filePath;

        this._saveShard(shardKey, shard);
    }

    _removeFromIndex(item) {
        const shardKey = getShardKey(item.createdAt || new Date());
        const shard = this._loadShard(this._getShardFile(shardKey));

        // Remove from IDs
        shard.ids = (shard.ids || []).filter(id => id !== item.id);

        // Remove from field indexes
        const fields = CONFIG.INDEX_FIELDS[this.type] || [];
        for (const field of fields) {
            const value = getNestedValue(item, field);
            if (value !== undefined && value !== null && shard.byField && shard.byField[field]) {
                const key = String(value);
                if (shard.byField[field][key]) {
                    shard.byField[field][key] = shard.byField[field][key].filter(id => id !== item.id);
                }
            }
        }

        // Remove from search index
        if (shard.searchIndex) delete shard.searchIndex[item.id];
        if (shard.pathMap) delete shard.pathMap[item.id];

        this._saveShard(shardKey, shard);
    }

    _getIdsFromShards(filter) {
        const shardFiles = this._getShardFiles();
        let allIds = [];

        for (const shardFile of shardFiles) {
            const shard = this._loadShard(shardFile);
            let shardIds = shard.ids || [];

            // Apply filters
            if (Object.keys(filter).length > 0) {
                for (const [field, value] of Object.entries(filter)) {
                    if (shard.byField && shard.byField[field] && shard.byField[field][String(value)]) {
                        const matchingIds = new Set(shard.byField[field][String(value)]);
                        shardIds = shardIds.filter(id => matchingIds.has(id));
                    }
                }
            }

            allIds = allIds.concat(shardIds);
        }

        return allIds;
    }

    _getFilePath(id) {
        // Check all shards for path mapping
        const shardFiles = this._getShardFiles();
        for (const shardFile of shardFiles) {
            const shard = this._loadShard(shardFile);
            if (shard.pathMap && shard.pathMap[id]) {
                return shard.pathMap[id];
            }
        }
        return null;
    }

    _findById(id) {
        const filename = `${id}.json`;

        const searchDir = (dir) => {
            if (!fs.existsSync(dir)) return null;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory() && entry.name !== 'index') {
                    const found = searchDir(fullPath);
                    if (found) return found;
                } else if (entry.name === filename) {
                    try {
                        return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                    } catch (e) { }
                }
            }
            return null;
        };

        return searchDir(this.baseDir);
    }

    _scanAllFiles() {
        const ids = [];

        const scanDir = (dir) => {
            if (!fs.existsSync(dir)) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name === 'index' || entry.name === 'meta.json') continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else if (entry.name.endsWith('.json')) {
                    ids.push(entry.name.replace('.json', ''));
                }
            }
        };

        scanDir(this.baseDir);
        return ids;
    }
}

// ==================== DATA SERVICE ====================
class ShardedDataService {
    constructor() {
        this.managers = {};
    }

    /**
     * Get or create a manager for a type
     */
    getManager(type) {
        if (!this.managers[type]) {
            if (!CONFIG.SUPPORTED_TYPES.includes(type)) {
                return null;
            }
            this.managers[type] = new ShardedFlatFileDB(type);
        }
        return this.managers[type];
    }

    /**
     * Initialize all managers
     */
    initAll() {
        console.log('[ShardedDataService] Initializing...');
        for (const type of CONFIG.SUPPORTED_TYPES) {
            this.getManager(type);
        }
        console.log('[ShardedDataService] Initialized successfully');
    }

    /**
     * Rebuild indexes for all types
     */
    rebuildAllIndices() {
        const results = {};
        for (const type of CONFIG.SUPPORTED_TYPES) {
            const manager = this.getManager(type);
            results[type] = manager.rebuildAllIndices();
        }
        return results;
    }

    /**
     * Get statistics for all types
     */
    getAllStats() {
        const stats = {};
        for (const type of CONFIG.SUPPORTED_TYPES) {
            const manager = this.getManager(type);
            stats[type] = manager.getStats();
        }
        return stats;
    }
}

// ==================== EXPORTS ====================
const shardedDataService = new ShardedDataService();

module.exports = {
    ShardedFlatFileDB,
    ShardedDataService,
    shardedDataService,
    CONFIG
};
