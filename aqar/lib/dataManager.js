/**
 * DataManager - نظام إدارة البيانات المحسن
 * يوفر: Caching, File Locking, Atomic Writes, Pagination, Indexes, Auto-Archive
 * 
 * @version 2.0.0
 * @author Aqar Team
 */

const fs = require('fs');
const path = require('path');

// ==================== CONFIGURATION ====================
const CONFIG = {
    // مسار مجلد البيانات
    DATA_DIR: path.join(__dirname, '..', 'secure_data'),
    ARCHIVE_DIR: path.join(__dirname, '..', 'secure_data', 'archive'),
    
    // إعدادات الكاش
    CACHE_ENABLED: true,
    CACHE_TTL: 5 * 60 * 1000, // 5 دقائق
    
    // إعدادات الأرشفة
    ARCHIVE_THRESHOLD: 1000, // أرشفة عند تجاوز هذا العدد
    ARCHIVE_KEEP_RECENT: 500, // الاحتفاظ بآخر 500 عنصر
    
    // إعدادات القفل
    LOCK_TIMEOUT: 10000, // 10 ثواني
    LOCK_RETRY_DELAY: 50, // 50 مللي ثانية
    MAX_LOCK_RETRIES: 200,
    
    // الملفات القابلة للأرشفة
    ARCHIVABLE_FILES: ['messages', 'comments', 'logs', 'all_reviews']
};

// ==================== CACHE SYSTEM ====================
class CacheManager {
    constructor() {
        this.cache = new Map();
        this.indexes = new Map();
        this.fileStats = new Map();
    }
    
    /**
     * الحصول على بيانات من الكاش أو الملف
     */
    get(filename) {
        const cacheKey = this._getCacheKey(filename);
        const cached = this.cache.get(cacheKey);
        
        if (cached && this._isCacheValid(filename, cached)) {
            return cached.data;
        }
        
        return null;
    }
    
    /**
     * تخزين بيانات في الكاش
     */
    set(filename, data) {
        if (!CONFIG.CACHE_ENABLED) return;
        
        const cacheKey = this._getCacheKey(filename);
        const filePath = this._getFilePath(filename);
        
        let mtime = Date.now();
        try {
            if (fs.existsSync(filePath)) {
                mtime = fs.statSync(filePath).mtimeMs;
            }
        } catch (e) {}
        
        this.cache.set(cacheKey, {
            data: data,
            timestamp: Date.now(),
            mtime: mtime
        });
        
        // بناء الفهرس
        if (Array.isArray(data)) {
            this._buildIndex(filename, data);
        }
    }
    
    /**
     * حذف من الكاش
     */
    invalidate(filename) {
        const cacheKey = this._getCacheKey(filename);
        this.cache.delete(cacheKey);
        this.indexes.delete(cacheKey);
    }
    
    /**
     * حذف كل الكاش
     */
    clear() {
        this.cache.clear();
        this.indexes.clear();
    }
    
    /**
     * الحصول على عنصر بواسطة ID من الفهرس
     */
    getById(filename, id) {
        const cacheKey = this._getCacheKey(filename);
        const index = this.indexes.get(cacheKey);
        
        if (index && index.byId.has(id)) {
            const data = this.get(filename);
            if (data) {
                return data[index.byId.get(id)];
            }
        }
        
        return null;
    }
    
    /**
     * البحث في الفهرس
     */
    search(filename, field, value) {
        const cacheKey = this._getCacheKey(filename);
        const index = this.indexes.get(cacheKey);
        
        if (index && index.byField.has(field)) {
            const fieldIndex = index.byField.get(field);
            if (fieldIndex.has(value)) {
                const data = this.get(filename);
                if (data) {
                    return fieldIndex.get(value).map(idx => data[idx]);
                }
            }
        }
        
        return [];
    }
    
    // ==================== PRIVATE METHODS ====================
    
    _getCacheKey(filename) {
        return filename.replace('.json', '');
    }
    
    _getFilePath(filename) {
        if (!filename.endsWith('.json')) filename += '.json';
        return path.join(CONFIG.DATA_DIR, filename);
    }
    
    _isCacheValid(filename, cached) {
        // التحقق من TTL
        if (Date.now() - cached.timestamp > CONFIG.CACHE_TTL) {
            return false;
        }
        
        // التحقق من تغيير الملف
        const filePath = this._getFilePath(filename);
        try {
            if (fs.existsSync(filePath)) {
                const currentMtime = fs.statSync(filePath).mtimeMs;
                if (currentMtime !== cached.mtime) {
                    return false;
                }
            }
        } catch (e) {
            return false;
        }
        
        return true;
    }
    
    _buildIndex(filename, data) {
        const cacheKey = this._getCacheKey(filename);
        const index = {
            byId: new Map(),
            byField: new Map()
        };
        
        // الحقول المفهرسة حسب نوع الملف
        const indexableFields = {
            'units': ['projectId', 'type', 'status', 'unitStatus', 'location'],
            'projects': ['status', 'location', 'featured'],
            'news': ['status', 'category'],
            'messages': ['read', 'type'],
            'comments': ['status', 'type', 'itemId'],
            'reviews': ['status'],
            'all_reviews': ['status']
        };
        
        const fieldsToIndex = indexableFields[cacheKey] || [];
        
        data.forEach((item, idx) => {
            // فهرسة بـ ID
            if (item.id) {
                index.byId.set(item.id, idx);
            }
            
            // فهرسة الحقول الأخرى
            fieldsToIndex.forEach(field => {
                if (!index.byField.has(field)) {
                    index.byField.set(field, new Map());
                }
                
                const value = this._getFieldValue(item, field);
                if (value !== undefined && value !== null) {
                    const fieldIndex = index.byField.get(field);
                    if (!fieldIndex.has(value)) {
                        fieldIndex.set(value, []);
                    }
                    fieldIndex.get(value).push(idx);
                }
            });
        });
        
        this.indexes.set(cacheKey, index);
    }
    
    _getFieldValue(item, field) {
        // دعم الحقول المتداخلة مثل location.ar
        const parts = field.split('.');
        let value = item;
        for (const part of parts) {
            if (value && typeof value === 'object') {
                value = value[part];
            } else {
                return undefined;
            }
        }
        return value;
    }
}

// ==================== LOCK MANAGER ====================
class LockManager {
    constructor() {
        this.locks = new Map();
    }
    
    /**
     * الحصول على قفل للملف
     */
    async acquire(filename, timeout = CONFIG.LOCK_TIMEOUT) {
        const lockKey = this._getLockKey(filename);
        const startTime = Date.now();
        let retries = 0;
        
        while (retries < CONFIG.MAX_LOCK_RETRIES) {
            if (!this.locks.has(lockKey)) {
                // إنشاء القفل
                this.locks.set(lockKey, {
                    timestamp: Date.now(),
                    holder: Math.random().toString(36).substr(2, 9)
                });
                
                return this.locks.get(lockKey).holder;
            }
            
            // التحقق من انتهاء صلاحية القفل
            const lock = this.locks.get(lockKey);
            if (Date.now() - lock.timestamp > timeout) {
                // القفل منتهي الصلاحية، إزالته
                this.locks.delete(lockKey);
                continue;
            }
            
            // الانتظار
            await this._sleep(CONFIG.LOCK_RETRY_DELAY);
            retries++;
        }
        
        throw new Error(`Failed to acquire lock for ${filename} after ${retries} retries`);
    }
    
    /**
     * تحرير القفل
     */
    release(filename, holder) {
        const lockKey = this._getLockKey(filename);
        const lock = this.locks.get(lockKey);
        
        if (lock && lock.holder === holder) {
            this.locks.delete(lockKey);
            return true;
        }
        
        return false;
    }
    
    _getLockKey(filename) {
        return filename.replace('.json', '');
    }
    
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ==================== DATA MANAGER ====================
class DataManager {
    constructor() {
        this.cache = new CacheManager();
        this.lockManager = new LockManager();
        this._ensureDirectories();
    }
    
    /**
     * قراءة بيانات من ملف JSON
     */
    read(filename, useCache = true) {
        try {
            // محاولة القراءة من الكاش
            if (useCache) {
                const cached = this.cache.get(filename);
                if (cached !== null) {
                    return cached;
                }
            }
            
            // القراءة من الملف
            const filePath = this._getFilePath(filename);
            if (!fs.existsSync(filePath)) {
                return Array.isArray(this._getDefaultValue(filename)) ? [] : {};
            }
            
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            
            // تخزين في الكاش
            this.cache.set(filename, data);
            
            return data;
        } catch (error) {
            console.error(`[DataManager] Error reading ${filename}:`, error.message);
            return Array.isArray(this._getDefaultValue(filename)) ? [] : {};
        }
    }
    
    /**
     * كتابة بيانات إلى ملف JSON مع قفل وكتابة ذرية
     */
    async write(filename, data) {
        let lockHolder = null;
        
        try {
            // الحصول على القفل
            lockHolder = await this.lockManager.acquire(filename);
            
            // الكتابة الذرية
            await this._atomicWrite(filename, data);
            
            // تحديث الكاش
            this.cache.set(filename, data);
            
            // التحقق من الحاجة للأرشفة
            if (CONFIG.ARCHIVABLE_FILES.includes(filename.replace('.json', ''))) {
                await this._checkAndArchive(filename, data);
            }
            
            return true;
        } catch (error) {
            console.error(`[DataManager] Error writing ${filename}:`, error.message);
            return false;
        } finally {
            // تحرير القفل
            if (lockHolder) {
                this.lockManager.release(filename, lockHolder);
            }
        }
    }
    
    /**
     * إضافة عنصر جديد
     */
    async add(filename, item) {
        const data = this.read(filename);
        if (!Array.isArray(data)) {
            throw new Error(`${filename} is not an array`);
        }
        
        data.push(item);
        await this.write(filename, data);
        return item;
    }
    
    /**
     * تحديث عنصر
     */
    async update(filename, id, updates) {
        const data = this.read(filename);
        if (!Array.isArray(data)) {
            throw new Error(`${filename} is not an array`);
        }
        
        const index = data.findIndex(item => item.id === id);
        if (index === -1) {
            return null;
        }
        
        data[index] = { ...data[index], ...updates, updatedAt: new Date().toISOString() };
        await this.write(filename, data);
        return data[index];
    }
    
    /**
     * حذف عنصر
     */
    async delete(filename, id) {
        const data = this.read(filename);
        if (!Array.isArray(data)) {
            throw new Error(`${filename} is not an array`);
        }
        
        const index = data.findIndex(item => item.id === id);
        if (index === -1) {
            return false;
        }
        
        data.splice(index, 1);
        await this.write(filename, data);
        return true;
    }
    
    /**
     * الحصول على عنصر بواسطة ID
     */
    getById(filename, id) {
        // محاولة من الفهرس أولاً
        const fromIndex = this.cache.getById(filename, id);
        if (fromIndex) {
            return fromIndex;
        }
        
        // البحث في البيانات
        const data = this.read(filename);
        if (Array.isArray(data)) {
            return data.find(item => item.id === id) || null;
        }
        
        return null;
    }
    
    /**
     * استعلام مع فلترة وترقيم صفحات
     */
    query(filename, options = {}) {
        const {
            filter = {},
            sort = null,
            page = 1,
            limit = 20,
            fields = null
        } = options;
        
        let data = this.read(filename);
        if (!Array.isArray(data)) {
            return { data: [], total: 0, page, totalPages: 0 };
        }
        
        // تطبيق الفلتر
        if (Object.keys(filter).length > 0) {
            data = data.filter(item => {
                return Object.entries(filter).every(([key, value]) => {
                    const itemValue = this._getNestedValue(item, key);
                    if (Array.isArray(value)) {
                        return value.includes(itemValue);
                    }
                    return itemValue === value;
                });
            });
        }
        
        const total = data.length;
        
        // تطبيق الترتيب
        if (sort) {
            const [field, order] = sort.split(':');
            data.sort((a, b) => {
                const aVal = this._getNestedValue(a, field);
                const bVal = this._getNestedValue(b, field);
                const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                return order === 'desc' ? -comparison : comparison;
            });
        }
        
        // تطبيق الترقيم
        const totalPages = Math.ceil(total / limit);
        const skip = (page - 1) * limit;
        data = data.slice(skip, skip + limit);
        
        // تحديد الحقول المطلوبة
        if (fields && Array.isArray(fields)) {
            data = data.map(item => {
                const selected = {};
                fields.forEach(field => {
                    selected[field] = item[field];
                });
                return selected;
            });
        }
        
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
     * البحث النصي
     */
    search(filename, query, fields = ['title.ar', 'title.en', 'description.ar', 'description.en']) {
        const data = this.read(filename);
        if (!Array.isArray(data) || !query) {
            return [];
        }
        
        const normalizedQuery = query.toLowerCase().trim();
        
        return data.filter(item => {
            return fields.some(field => {
                const value = this._getNestedValue(item, field);
                if (typeof value === 'string') {
                    return value.toLowerCase().includes(normalizedQuery);
                }
                return false;
            });
        });
    }
    
    /**
     * الحصول على إحصائيات
     */
    getStats(filename) {
        const data = this.read(filename);
        const filePath = this._getFilePath(filename);
        
        let fileSize = 0;
        try {
            fileSize = fs.statSync(filePath).size;
        } catch (e) {}
        
        return {
            count: Array.isArray(data) ? data.length : Object.keys(data).length,
            fileSize,
            fileSizeFormatted: this._formatBytes(fileSize),
            cached: this.cache.get(filename) !== null,
            hasIndex: this.cache.indexes.has(filename.replace('.json', ''))
        };
    }
    
    /**
     * أرشفة البيانات القديمة
     */
    async archive(filename) {
        const data = this.read(filename);
        if (!Array.isArray(data) || data.length <= CONFIG.ARCHIVE_THRESHOLD) {
            return { archived: 0, remaining: data.length };
        }
        
        // ترتيب حسب التاريخ
        const sorted = [...data].sort((a, b) => {
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
        
        // الاحتفاظ بالأحدث
        const toKeep = sorted.slice(0, CONFIG.ARCHIVE_KEEP_RECENT);
        const toArchive = sorted.slice(CONFIG.ARCHIVE_KEEP_RECENT);
        
        if (toArchive.length === 0) {
            return { archived: 0, remaining: toKeep.length };
        }
        
        // حفظ الأرشيف
        const archiveFilename = `${filename.replace('.json', '')}_${Date.now()}.json`;
        const archivePath = path.join(CONFIG.ARCHIVE_DIR, archiveFilename);
        fs.writeFileSync(archivePath, JSON.stringify(toArchive, null, 2));
        
        // تحديث الملف الأصلي
        await this.write(filename, toKeep);
        
        console.log(`[DataManager] Archived ${toArchive.length} items from ${filename}`);
        
        return {
            archived: toArchive.length,
            remaining: toKeep.length,
            archiveFile: archiveFilename
        };
    }
    
    /**
     * مسح الكاش
     */
    clearCache(filename = null) {
        if (filename) {
            this.cache.invalidate(filename);
        } else {
            this.cache.clear();
        }
    }
    
    // ==================== PRIVATE METHODS ====================
    
    _getFilePath(filename) {
        if (!filename.endsWith('.json')) filename += '.json';
        return path.join(CONFIG.DATA_DIR, filename);
    }
    
    _getDefaultValue(filename) {
        const name = filename.replace('.json', '');
        if (name === 'settings') return {};
        if (name === 'visitors') return { daily: {}, total: 0 };
        return [];
    }
    
    _ensureDirectories() {
        if (!fs.existsSync(CONFIG.DATA_DIR)) {
            fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
        }
        if (!fs.existsSync(CONFIG.ARCHIVE_DIR)) {
            fs.mkdirSync(CONFIG.ARCHIVE_DIR, { recursive: true });
        }
    }
    
    async _atomicWrite(filename, data) {
        const filePath = this._getFilePath(filename);
        const tempPath = filePath + '.tmp';
        const backupPath = filePath + '.backup';
        
        // 1. كتابة الملف المؤقت
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
        
        // 2. التحقق من صحة الملف المؤقت
        try {
            JSON.parse(fs.readFileSync(tempPath, 'utf8'));
        } catch (e) {
            fs.unlinkSync(tempPath);
            throw new Error('Invalid JSON in temp file');
        }
        
        // 3. نسخ احتياطي للملف الحالي
        if (fs.existsSync(filePath)) {
            fs.copyFileSync(filePath, backupPath);
        }
        
        // 4. استبدال الملف (عملية ذرية)
        fs.renameSync(tempPath, filePath);
        
        // 5. حذف النسخة الاحتياطية بعد النجاح
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
        }
    }
    
    async _checkAndArchive(filename, data) {
        if (Array.isArray(data) && data.length > CONFIG.ARCHIVE_THRESHOLD) {
            // جدولة الأرشفة (بدون انتظار)
            setImmediate(() => this.archive(filename).catch(console.error));
        }
    }
    
    _getNestedValue(obj, path) {
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
    
    _formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// ==================== SINGLETON INSTANCE ====================
const dataManager = new DataManager();

// ==================== EXPORTS ====================
module.exports = {
    dataManager,
    DataManager,
    CacheManager,
    LockManager,
    CONFIG
};
