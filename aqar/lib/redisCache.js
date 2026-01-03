/**
 * Redis Cache System for PM2 Cluster
 * نظام Cache موزع للتعامل مع ملايين الطلبات
 * 
 * @version 1.0.0
 * @description Distributed cache with Redis + In-Memory fallback
 */

let Redis;
try {
    Redis = require('ioredis');
} catch (e) {
    Redis = null;
}

// ==================== REDIS CACHE ====================
class RedisCache {
    constructor(options = {}) {
        this.client = null;
        this.connected = false;
        this.prefix = options.prefix || 'aqar:';
        this.defaultTTL = options.defaultTTL || 300; // 5 minutes

        this.ttl = {
            units: 120,      // 2 minutes
            projects: 300,   // 5 minutes
            news: 300,       // 5 minutes
            pages: 600,      // 10 minutes
            search: 60,      // 1 minute
            settings: 600,   // 10 minutes
            indices: 30      // 30 seconds
        };

        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            errors: 0
        };
    }

    async connect(redisUrl) {
        if (!Redis) {
            console.log('[RedisCache] ioredis not installed, skipping Redis');
            return false;
        }

        try {
            this.client = new Redis(redisUrl || 'redis://localhost:6379', {
                maxRetriesPerRequest: 3,
                retryDelayOnFailover: 100,
                lazyConnect: true,
                connectTimeout: 5000,
                enableReadyCheck: true,
                reconnectOnError: (err) => {
                    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
                    return targetErrors.some(e => err.message.includes(e));
                }
            });

            this.client.on('error', (err) => {
                console.error('[RedisCache] Error:', err.message);
                this.stats.errors++;
            });

            this.client.on('connect', () => {
                console.log('[RedisCache] Connected to Redis');
                this.connected = true;
            });

            this.client.on('close', () => {
                console.log('[RedisCache] Connection closed');
                this.connected = false;
            });

            await this.client.connect();
            return true;
        } catch (err) {
            console.error('[RedisCache] Connection failed:', err.message);
            this.connected = false;
            return false;
        }
    }

    _key(type, params = {}) {
        const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
        return `${this.prefix}${type}:${sorted}`;
    }

    async get(type, params = {}) {
        if (!this.connected) return null;

        try {
            const key = this._key(type, params);
            const data = await this.client.get(key);

            if (data) {
                this.stats.hits++;
                return JSON.parse(data);
            }

            this.stats.misses++;
            return null;
        } catch (err) {
            console.error('[RedisCache] Get error:', err.message);
            this.stats.errors++;
            return null;
        }
    }

    async set(type, params, value, customTtl = null) {
        if (!this.connected) return false;

        try {
            const key = this._key(type, params);
            const ttl = customTtl || this.ttl[type] || this.defaultTTL;
            await this.client.setex(key, ttl, JSON.stringify(value));
            this.stats.sets++;
            return true;
        } catch (err) {
            console.error('[RedisCache] Set error:', err.message);
            this.stats.errors++;
            return false;
        }
    }

    async delete(type, params = {}) {
        if (!this.connected) return false;

        try {
            const key = this._key(type, params);
            await this.client.del(key);
            return true;
        } catch (err) {
            console.error('[RedisCache] Delete error:', err.message);
            return false;
        }
    }

    async invalidate(type) {
        if (!this.connected) return false;

        try {
            const pattern = `${this.prefix}${type}:*`;

            // استخدام SCAN بدلاً من KEYS للأداء
            let cursor = '0';
            let deletedCount = 0;

            do {
                const [newCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
                cursor = newCursor;

                if (keys.length > 0) {
                    await this.client.del(...keys);
                    deletedCount += keys.length;
                }
            } while (cursor !== '0');

            console.log(`[RedisCache] Invalidated ${deletedCount} keys for type: ${type}`);
            return true;
        } catch (err) {
            console.error('[RedisCache] Invalidate error:', err.message);
            return false;
        }
    }

    async invalidateAll() {
        if (!this.connected) return false;

        try {
            const pattern = `${this.prefix}*`;
            let cursor = '0';
            let deletedCount = 0;

            do {
                const [newCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
                cursor = newCursor;

                if (keys.length > 0) {
                    await this.client.del(...keys);
                    deletedCount += keys.length;
                }
            } while (cursor !== '0');

            console.log(`[RedisCache] Invalidated all ${deletedCount} keys`);
            return true;
        } catch (err) {
            console.error('[RedisCache] Invalidate all error:', err.message);
            return false;
        }
    }

    async getStats() {
        const stats = { ...this.stats };

        if (this.connected) {
            try {
                const info = await this.client.info('memory');
                const match = info.match(/used_memory_human:(.+)/);
                stats.memoryUsed = match ? match[1].trim() : 'unknown';
                stats.connected = true;
            } catch (e) {
                stats.connected = false;
            }
        } else {
            stats.connected = false;
        }

        stats.hitRate = stats.hits + stats.misses > 0
            ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2) + '%'
            : '0%';

        return stats;
    }

    async disconnect() {
        if (this.client) {
            await this.client.quit();
            this.connected = false;
        }
    }
}

// ==================== HYBRID CACHE (Redis + In-Memory Fallback) ====================
class HybridCache {
    constructor() {
        this.redis = new RedisCache();
        this.inMemory = new Map();
        this.maxInMemory = 1000;
        this.useRedis = false;

        this.ttl = {
            units: 120000,      // 2 minutes in ms
            projects: 300000,   // 5 minutes
            news: 300000,       // 5 minutes
            pages: 600000,      // 10 minutes
            search: 60000,      // 1 minute
            settings: 600000,   // 10 minutes
            indices: 30000      // 30 seconds
        };
    }

    async initialize(redisUrl = null) {
        const url = redisUrl || process.env.REDIS_URL;

        if (url) {
            try {
                const connected = await this.redis.connect(url);
                this.useRedis = connected;

                if (connected) {
                    console.log('[HybridCache] Using Redis as primary cache');
                } else {
                    console.log('[HybridCache] Redis unavailable, using in-memory cache');
                }
            } catch (err) {
                console.log('[HybridCache] Redis connection failed, using in-memory cache');
                this.useRedis = false;
            }
        } else {
            console.log('[HybridCache] No REDIS_URL, using in-memory cache');
        }

        // التنظيف الدوري للـ In-Memory cache
        setInterval(() => this._cleanupMemory(), 60000);
    }

    _memoryKey(type, params) {
        return JSON.stringify({ type, params });
    }

    _cleanupMemory() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, item] of this.inMemory.entries()) {
            if (now > item.expires) {
                this.inMemory.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`[HybridCache] Cleaned ${cleaned} expired in-memory entries`);
        }
    }

    async get(type, params = {}) {
        // محاولة Redis أولاً
        if (this.useRedis) {
            const result = await this.redis.get(type, params);
            if (result !== null) return result;
        }

        // Fallback إلى In-Memory
        const key = this._memoryKey(type, params);
        const item = this.inMemory.get(key);

        if (item && Date.now() < item.expires) {
            return item.value;
        }

        if (item) {
            this.inMemory.delete(key);
        }

        return null;
    }

    async set(type, params, value, customTtl = null) {
        const ttlMs = customTtl || this.ttl[type] || 300000;
        const ttlSec = Math.floor(ttlMs / 1000);

        // حفظ في Redis
        if (this.useRedis) {
            await this.redis.set(type, params, value, ttlSec);
        }

        // حفظ في In-Memory أيضاً (للأداء العالي)
        if (this.inMemory.size >= this.maxInMemory) {
            // حذف أقدم عنصر
            const firstKey = this.inMemory.keys().next().value;
            this.inMemory.delete(firstKey);
        }

        const key = this._memoryKey(type, params);
        this.inMemory.set(key, {
            value,
            expires: Date.now() + ttlMs
        });

        return true;
    }

    async invalidate(type) {
        // مسح من Redis
        if (this.useRedis) {
            await this.redis.invalidate(type);
        }

        // مسح من In-Memory
        for (const key of this.inMemory.keys()) {
            if (key.includes(`"type":"${type}"`)) {
                this.inMemory.delete(key);
            }
        }

        return true;
    }

    async invalidateAll() {
        if (this.useRedis) {
            await this.redis.invalidateAll();
        }

        this.inMemory.clear();
        return true;
    }

    async getStats() {
        return {
            redis: this.useRedis ? await this.redis.getStats() : { connected: false },
            inMemory: {
                size: this.inMemory.size,
                maxSize: this.maxInMemory
            }
        };
    }
}

// ==================== CACHE MIDDLEWARE FOR EXPRESS ====================
function createRedisCacheMiddleware(hybridCache) {
    return (type, customTtl = null) => {
        return async (req, res, next) => {
            // تخطي الـ cache للمستخدمين المصرح لهم أو غير GET
            if (req.user || req.method !== 'GET') {
                return next();
            }

            const params = { ...req.query, path: req.path };

            try {
                const cached = await hybridCache.get(type, params);

                if (cached) {
                    res.set('X-Cache', 'HIT');
                    res.set('X-Cache-Type', hybridCache.useRedis ? 'redis' : 'memory');
                    return res.json(cached);
                }
            } catch (err) {
                console.error('[CacheMiddleware] Get error:', err.message);
            }

            // تخزين الـ response الأصلي
            const originalJson = res.json.bind(res);

            res.json = async (data) => {
                try {
                    await hybridCache.set(type, params, data, customTtl);
                } catch (err) {
                    console.error('[CacheMiddleware] Set error:', err.message);
                }

                res.set('X-Cache', 'MISS');
                return originalJson(data);
            };

            next();
        };
    };
}

// ==================== RATE LIMIT STORE FOR REDIS ====================
class RedisRateLimitStore {
    constructor(redisClient, options = {}) {
        this.client = redisClient;
        this.prefix = options.prefix || 'rl:';
        this.windowMs = options.windowMs || 60000;
    }

    async increment(key) {
        const redisKey = this.prefix + key;
        const now = Date.now();
        const windowStart = now - this.windowMs;

        // استخدام Sorted Set لتتبع الطلبات
        await this.client.zremrangebyscore(redisKey, '-inf', windowStart);
        await this.client.zadd(redisKey, now, now.toString());
        await this.client.expire(redisKey, Math.ceil(this.windowMs / 1000));

        const count = await this.client.zcard(redisKey);

        return {
            totalHits: count,
            resetTime: new Date(now + this.windowMs)
        };
    }

    async decrement(key) {
        const redisKey = this.prefix + key;
        await this.client.zpopmax(redisKey);
    }

    async resetKey(key) {
        const redisKey = this.prefix + key;
        await this.client.del(redisKey);
    }
}

// ==================== TRAFFIC MANAGER (Redis-based) ====================
class RedisTrafficManager {
    constructor(redisClient, enabled = true) {
        this.client = redisClient;
        this.enabled = enabled;
        this.prefix = 'aqar:traffic:';
    }

    // Track a visit
    async trackVisit(req) {
        // If Redis is not connected, we simply skip tracking to avoid crashing
        if (!this.enabled || !this.client) return;

        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        const today = new Date().toISOString().split('T')[0];

        // Use hash of IP+UA to anonymize but keep unique ID
        const visitorId = `${ip}-${userAgent.substring(0, 50)}`;

        try {
            const pipe = this.client.pipeline();

            // 1. Total hits (Global)
            pipe.incr(`${this.prefix}total`);

            // 2. Daily hits
            pipe.incr(`${this.prefix}daily:${today}:hits`);

            // 3. Daily unique visitors (HyperLogLog for massive scale)
            // PFADD uses tiny constant memory (12k) for millions of unique items
            pipe.pfadd(`${this.prefix}daily:${today}:unique`, visitorId);

            // Execute pipeline
            await pipe.exec();

            // Set expiration for daily keys (keep for 90 days) without awaiting
            this.client.expire(`${this.prefix}daily:${today}:hits`, 7776000);
            this.client.expire(`${this.prefix}daily:${today}:unique`, 7776000);

        } catch (err) {
            console.error('[TrafficManager] Error tracking visit:', err.message);
        }
    }

    // Get stats formatted for Admin Dashboard
    async getStats(days = 30) {
        if (!this.enabled || !this.client) {
            return { daily: {}, total: 0 };
        }

        const stats = {
            daily: {},
            total: 0
        };

        try {
            // Get Total
            const total = await this.client.get(`${this.prefix}total`);
            stats.total = parseInt(total) || 0;

            // Get last N days
            const promises = [];
            const dateKeys = [];

            // Get past days
            for (let i = 0; i < days; i++) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dayStr = d.toISOString().split('T')[0];
                dateKeys.push(dayStr);

                promises.push(this.client.get(`${this.prefix}daily:${dayStr}:hits`));
                promises.push(this.client.pfcount(`${this.prefix}daily:${dayStr}:unique`));
            }

            const results = await Promise.all(promises);

            // Process results
            for (let i = 0; i < dateKeys.length; i++) {
                const dayStr = dateKeys[i];
                const hits = parseInt(results[i * 2]) || 0;
                const unique = parseInt(results[i * 2 + 1]) || 0;

                if (hits > 0) {
                    stats.daily[dayStr] = {
                        count: hits,
                        uniqueCount: unique
                    };
                }
            }
        } catch (err) {
            console.error('[TrafficManager] Error getting stats:', err.message);
        }

        return stats;
    }
}

// ==================== QUEUE MANAGER (Write-Behind) ====================
class RedisQueueManager {
    constructor(redisClient, enabled = true) {
        this.client = redisClient;
        this.enabled = enabled;
        this.prefix = 'aqar:queue:';
    }

    // Add item to queue
    async enqueue(queueName, data) {
        if (!this.enabled || !this.client) {
            console.warn(`[QueueManager] Redis not enabled, data lost for queue: ${queueName}`);
            return false;
        }

        try {
            const key = this.prefix + queueName;
            const payload = JSON.stringify({
                data,
                timestamp: Date.now()
            });
            await this.client.rpush(key, payload);
            return true;
        } catch (error) {
            console.error(`[QueueManager] Failed to enqueue to ${queueName}:`, error);
            return false;
        }
    }

    // Get batch of items from queue
    async dequeueBatch(queueName, limit = 50) {
        if (!this.enabled || !this.client) return [];

        try {
            const key = this.prefix + queueName;
            const pipeline = this.client.pipeline();
            for (let i = 0; i < limit; i++) {
                pipeline.lpop(key);
            }

            const results = await pipeline.exec();

            const items = results
                .map(r => r[1])
                .filter(val => val !== null)
                .map(val => {
                    try { return JSON.parse(val); } catch (e) { return null; }
                })
                .filter(val => val !== null);

            return items;

        } catch (error) {
            console.error(`[QueueManager] Failed to dequeue from ${queueName}:`, error);
            return [];
        }
    }

    // Get queue length
    async getLength(queueName) {
        if (!this.enabled || !this.client) return 0;
        return await this.client.llen(this.prefix + queueName);
    }
}

// ==================== SINGLETON INSTANCES ====================
const hybridCache = new HybridCache();
const trafficManager = new RedisTrafficManager(null, false); // Initialize loose, attach client later
const queueManager = new RedisQueueManager(null, false);

// ==================== EXPORTS ====================
module.exports = {
    RedisCache,
    HybridCache,
    hybridCache,
    RedisTrafficManager,
    trafficManager,
    RedisQueueManager,
    queueManager,
    createRedisCacheMiddleware,
    RedisRateLimitStore
};
