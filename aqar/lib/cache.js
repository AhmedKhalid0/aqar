/**
 * In-Memory Cache System
 * نظام التخزين المؤقت في الذاكرة للأداء العالي
 * 
 * @version 1.0.0
 * @description LRU Cache with TTL support for handling millions of requests
 */

class LRUCache {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 1000;
        this.ttl = options.ttl || 5 * 60 * 1000; // 5 minutes default
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
    }

    get(key) {
        const item = this.cache.get(key);
        
        if (!item) {
            this.stats.misses++;
            return null;
        }

        // Check TTL
        if (Date.now() > item.expires) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }

        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, item);
        
        this.stats.hits++;
        return item.value;
    }

    set(key, value, customTtl = null) {
        // Remove oldest if at capacity
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            value,
            expires: Date.now() + (customTtl || this.ttl)
        });
        
        this.stats.sets++;
        return true;
    }

    delete(key) {
        const result = this.cache.delete(key);
        if (result) this.stats.deletes++;
        return result;
    }

    // Delete all keys matching a pattern
    deletePattern(pattern) {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
                count++;
            }
        }
        this.stats.deletes += count;
        return count;
    }

    clear() {
        this.cache.clear();
        return true;
    }

    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;
        
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            ...this.stats,
            hitRate: `${hitRate}%`
        };
    }

    // Cleanup expired items
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expires) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        return cleaned;
    }
}

// ==================== API CACHE ====================
class APICache {
    constructor() {
        // Different caches for different data types
        this.caches = {
            units: new LRUCache({ maxSize: 5000, ttl: 2 * 60 * 1000 }), // 2 min
            projects: new LRUCache({ maxSize: 500, ttl: 5 * 60 * 1000 }), // 5 min
            news: new LRUCache({ maxSize: 1000, ttl: 5 * 60 * 1000 }), // 5 min
            pages: new LRUCache({ maxSize: 200, ttl: 10 * 60 * 1000 }), // 10 min
            indices: new LRUCache({ maxSize: 50, ttl: 30 * 1000 }) // 30 sec
        };

        // Auto cleanup every 5 minutes
        setInterval(() => this.cleanupAll(), 5 * 60 * 1000);
    }

    getCache(type) {
        return this.caches[type] || this.caches.units;
    }

    // Generate cache key
    generateKey(type, params = {}) {
        const sortedParams = Object.keys(params)
            .sort()
            .map(k => `${k}=${params[k]}`)
            .join('&');
        return `${type}:${sortedParams}`;
    }

    // Get cached result
    get(type, params = {}) {
        const key = this.generateKey(type, params);
        return this.getCache(type).get(key);
    }

    // Set cached result
    set(type, params, value, ttl = null) {
        const key = this.generateKey(type, params);
        return this.getCache(type).set(key, value, ttl);
    }

    // Invalidate cache for a type
    invalidate(type) {
        if (this.caches[type]) {
            this.caches[type].clear();
        }
        // Also clear related page cache
        this.caches.pages.deletePattern(type);
    }

    // Invalidate specific item
    invalidateItem(type, id) {
        this.caches[type]?.deletePattern(id);
        this.caches.pages.deletePattern(type);
    }

    cleanupAll() {
        let total = 0;
        for (const cache of Object.values(this.caches)) {
            total += cache.cleanup();
        }
        return total;
    }

    getStats() {
        const stats = {};
        for (const [name, cache] of Object.entries(this.caches)) {
            stats[name] = cache.getStats();
        }
        return stats;
    }
}

// ==================== RESPONSE CACHE MIDDLEWARE ====================
function createCacheMiddleware(apiCache) {
    return (type, ttl = null) => {
        return (req, res, next) => {
            // Skip cache for authenticated requests or POST/PUT/DELETE
            if (req.user || req.method !== 'GET') {
                return next();
            }

            const params = { ...req.query, path: req.path };
            const cached = apiCache.get(type, params);

            if (cached) {
                res.set('X-Cache', 'HIT');
                return res.json(cached);
            }

            // Store original json method
            const originalJson = res.json.bind(res);
            
            res.json = (data) => {
                // Cache the response
                apiCache.set(type, params, data, ttl);
                res.set('X-Cache', 'MISS');
                return originalJson(data);
            };

            next();
        };
    };
}

// Singleton instance
const apiCache = new APICache();
const cacheMiddleware = createCacheMiddleware(apiCache);

module.exports = {
    LRUCache,
    APICache,
    apiCache,
    cacheMiddleware
};
