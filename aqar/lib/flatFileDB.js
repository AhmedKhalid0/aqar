/**
 * Flat-File Database System
 * نظام قاعدة بيانات الملفات المسطحة للتعامل مع ملايين السجلات
 * 
 * @version 1.0.0
 * @description ملف لكل عنصر + Directory Hashing + Pre-generated Indices
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ==================== CONFIGURATION ====================
const CONFIG = {
    BASE_DIR: path.join(__dirname, '..', 'secure_data'),
    LISTS_DIR: path.join(__dirname, '..', 'public', 'api', 'lists'),
    
    // إعدادات الصفحات
    ITEMS_PER_PAGE: 20,
    MAX_PAGES_CACHE: 100,
    
    // أنواع البيانات المدعومة
    SUPPORTED_TYPES: ['units', 'projects', 'news'],
    
    // حقول الفهرسة لكل نوع
    INDEX_FIELDS: {
        units: ['projectId', 'type', 'status', 'unitStatus', 'location', 'price'],
        projects: ['status', 'location', 'featured'],
        news: ['status', 'category']
    },
    
    // حقول البحث لكل نوع
    SEARCH_FIELDS: {
        units: ['title.ar', 'title.en', 'description.ar', 'description.en', 'location.ar', 'location.en'],
        projects: ['title.ar', 'title.en', 'description.ar', 'description.en'],
        news: ['title.ar', 'title.en', 'content.ar', 'content.en']
    }
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * استخراج الـ numericId من الـ id (للتقسيم)
 * إذا كان الـ id يحتوي على numericId استخدمه، وإلا استخدم hash
 */
function extractNumericId(id, numericId = null) {
    // إذا تم تمرير numericId مباشرة
    if (numericId) return String(numericId).padStart(6, '0');
    
    // إذا كان الـ id رقمي بالكامل
    if (/^\d+$/.test(id)) return String(id).padStart(6, '0');
    
    // إذا كان الـ id يحتوي على رقم في البداية أو النهاية
    const numMatch = String(id).match(/(\d{4,})/);
    if (numMatch) return numMatch[1].padStart(6, '0');
    
    // Fallback: استخدام hash للـ slug IDs
    return id;
}

/**
 * تحويل ID إلى مسار مجلد (Directory Hashing)
 * للـ IDs الرقمية: 001234 → /00/12/001234.json
 * للـ IDs النصية: abc-slug → /ab/c-/abc-slug.json
 */
function idToPath(type, id, numericId = null) {
    const effectiveId = extractNumericId(id, numericId);
    const idStr = String(effectiveId);
    
    // للـ IDs الرقمية: تقسيم بناءً على الأرقام
    // 001234 → /00/12/34.json (أو الملف الكامل)
    let dir1, dir2;
    
    if (/^\d+$/.test(idStr) && idStr.length >= 4) {
        // ID رقمي: استخدام أول 2 أرقام وثاني 2 أرقام
        dir1 = idStr.substring(0, 2);
        dir2 = idStr.substring(2, 4);
    } else {
        // ID نصي (slug): استخدام أول 4 أحرف
        dir1 = idStr.substring(0, 2) || '00';
        dir2 = idStr.substring(2, 4) || '00';
    }
    
    return path.join(CONFIG.BASE_DIR, type, dir1, dir2, `${id}.json`);
}

/**
 * الحصول على مسار مجلد العنصر
 */
function getItemDir(type, id, numericId = null) {
    const effectiveId = extractNumericId(id, numericId);
    const idStr = String(effectiveId);
    
    let dir1, dir2;
    
    if (/^\d+$/.test(idStr) && idStr.length >= 4) {
        dir1 = idStr.substring(0, 2);
        dir2 = idStr.substring(2, 4);
    } else {
        dir1 = idStr.substring(0, 2) || '00';
        dir2 = idStr.substring(2, 4) || '00';
    }
    
    return path.join(CONFIG.BASE_DIR, type, dir1, dir2);
}

/**
 * الحصول على قيمة متداخلة من كائن
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
 * تنسيق حجم الملف
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==================== FLAT FILE MANAGER ====================
class FlatFileManager {
    constructor(type) {
        if (!CONFIG.SUPPORTED_TYPES.includes(type)) {
            throw new Error(`Unsupported type: ${type}. Supported: ${CONFIG.SUPPORTED_TYPES.join(', ')}`);
        }
        
        this.type = type;
        this.baseDir = path.join(CONFIG.BASE_DIR, type);
        this.listsDir = path.join(CONFIG.LISTS_DIR, type);
        this.metaFile = path.join(CONFIG.BASE_DIR, `${type}_meta.json`);
        
        this._ensureDirectories();
        this._loadMeta();
    }
    
    // ==================== CRUD OPERATIONS ====================
    
    /**
     * إنشاء عنصر جديد
     */
    async create(data) {
        const id = data.id || uuidv4();
        const item = {
            ...data,
            id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // حفظ الملف
        const filePath = idToPath(this.type, id);
        this._ensureDir(path.dirname(filePath));
        fs.writeFileSync(filePath, JSON.stringify(item, null, 2));
        
        // تحديث الفهارس
        await this._updateIndices('add', item);
        
        // تحديث الـ Meta
        this.meta.totalCount++;
        this.meta.lastUpdated = new Date().toISOString();
        this._saveMeta();
        
        // إعادة توليد صفحات القوائم
        await this._regenerateListPages();
        
        return item;
    }
    
    /**
     * قراءة عنصر بواسطة ID
     */
    read(id) {
        // أولاً: محاولة القراءة من pathMap في الفهرس
        const indices = this._loadIndices();
        if (indices.pathMap && indices.pathMap[id]) {
            const mappedPath = indices.pathMap[id];
            if (fs.existsSync(mappedPath)) {
                try {
                    return JSON.parse(fs.readFileSync(mappedPath, 'utf8'));
                } catch (error) {
                    console.error(`[FlatFileDB] Error reading from pathMap ${id}:`, error.message);
                }
            }
        }
        
        // ثانياً: محاولة القراءة من المسار المحسوب
        const filePath = idToPath(this.type, id);
        if (fs.existsSync(filePath)) {
            try {
                return JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } catch (error) {
                console.error(`[FlatFileDB] Error reading ${id}:`, error.message);
            }
        }
        
        // ثالثاً: البحث في جميع المجلدات (للملفات التي لم تُفهرس بشكل صحيح)
        const foundPath = this._findFileById(id);
        if (foundPath && fs.existsSync(foundPath)) {
            try {
                return JSON.parse(fs.readFileSync(foundPath, 'utf8'));
            } catch (error) {
                console.error(`[FlatFileDB] Error reading found file ${id}:`, error.message);
            }
        }
        
        return null;
    }
    
    /**
     * البحث عن ملف بواسطة ID في جميع المجلدات
     */
    _findFileById(id) {
        const filename = `${id}.json`;
        
        const searchDir = (dir) => {
            if (!fs.existsSync(dir)) return null;
            
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    const found = searchDir(fullPath);
                    if (found) return found;
                } else if (entry.name === filename) {
                    return fullPath;
                }
            }
            return null;
        };
        
        return searchDir(this.baseDir);
    }
    
    /**
     * تحديث عنصر
     */
    async update(id, updates) {
        const existing = this.read(id);
        if (!existing) {
            return null;
        }
        
        // إزالة من الفهارس القديمة
        await this._updateIndices('remove', existing);
        
        // دمج التحديثات
        const updated = {
            ...existing,
            ...updates,
            id, // الحفاظ على ID الأصلي
            updatedAt: new Date().toISOString()
        };
        
        // البحث عن المسار الصحيح للملف بكل الطرق الممكنة
        let filePath = null;
        
        // 1. من pathMap
        const indices = this._loadIndices();
        if (indices.pathMap && indices.pathMap[id] && fs.existsSync(indices.pathMap[id])) {
            filePath = indices.pathMap[id];
        }
        
        // 2. من المسار المحسوب
        if (!filePath) {
            const calculatedPath = idToPath(this.type, id);
            if (fs.existsSync(calculatedPath)) {
                filePath = calculatedPath;
            }
        }
        
        // 3. البحث في جميع المجلدات
        if (!filePath) {
            filePath = this._findFileById(id);
        }
        
        // 4. إذا لم نجد، نستخدم المسار المحسوب
        if (!filePath) {
            filePath = idToPath(this.type, id);
        }
        
        // حفظ الملف
        this._ensureDir(path.dirname(filePath));
        fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
        
        // إضافة للفهارس الجديدة
        await this._updateIndices('add', updated);
        
        // تحديث الـ Meta
        this.meta.lastUpdated = new Date().toISOString();
        this._saveMeta();
        
        // إعادة توليد صفحات القوائم
        await this._regenerateListPages();
        
        return updated;
    }
    
    /**
     * حذف عنصر
     */
    async delete(id) {
        const existing = this.read(id);
        if (!existing) {
            return false;
        }
        
        // إزالة من الفهارس
        await this._updateIndices('remove', existing);
        
        // البحث عن المسار الصحيح للملف بكل الطرق الممكنة
        let filePath = null;
        
        // 1. من pathMap
        const indices = this._loadIndices();
        if (indices.pathMap && indices.pathMap[id] && fs.existsSync(indices.pathMap[id])) {
            filePath = indices.pathMap[id];
        }
        
        // 2. من المسار المحسوب
        if (!filePath) {
            const calculatedPath = idToPath(this.type, id);
            if (fs.existsSync(calculatedPath)) {
                filePath = calculatedPath;
            }
        }
        
        // 3. البحث في جميع المجلدات
        if (!filePath) {
            filePath = this._findFileById(id);
        }
        
        // حذف الملف
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[FlatFileDB] Deleted: ${filePath}`);
        } else {
            console.warn(`[FlatFileDB] File not found for delete: ${id}`);
        }
        
        // تحديث الـ Meta
        this.meta.totalCount--;
        this.meta.lastUpdated = new Date().toISOString();
        this._saveMeta();
        
        // إعادة توليد صفحات القوائم
        await this._regenerateListPages();
        
        return true;
    }
    
    // ==================== QUERY OPERATIONS ====================
    
    /**
     * الحصول على صفحة من القائمة (من الملفات المجهزة مسبقاً)
     */
    getPage(page = 1, filter = {}) {
        const filterKey = this._getFilterKey(filter);
        const listFile = path.join(this.listsDir, filterKey, `page_${page}.json`);
        
        if (fs.existsSync(listFile)) {
            try {
                return JSON.parse(fs.readFileSync(listFile, 'utf8'));
            } catch (e) {}
        }
        
        // إذا لم يوجد ملف مجهز، نقوم بالبناء الآن
        return this._buildPage(page, filter);
    }
    
    /**
     * الحصول على عناصر بواسطة فلتر من الفهرس
     */
    getByFilter(filter, options = {}) {
        const { page = 1, limit = CONFIG.ITEMS_PER_PAGE, sort = 'createdAt:desc' } = options;
        
        // قراءة الفهرس المناسب
        let ids = this._getIdsFromIndex(filter);
        
        // الترتيب (نحتاج قراءة البيانات للترتيب)
        if (sort && ids.length > 0) {
            const [field, order] = sort.split(':');
            const items = ids.map(id => this.read(id)).filter(Boolean);
            items.sort((a, b) => {
                const aVal = getNestedValue(a, field);
                const bVal = getNestedValue(b, field);
                const comp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                return order === 'desc' ? -comp : comp;
            });
            ids = items.map(item => item.id);
        }
        
        const total = ids.length;
        const totalPages = Math.ceil(total / limit);
        const skip = (page - 1) * limit;
        const pageIds = ids.slice(skip, skip + limit);
        
        // قراءة البيانات الكاملة للصفحة
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
     * الحصول على جميع IDs
     */
    getAllIds() {
        const indexFile = path.join(CONFIG.BASE_DIR, `${this.type}_index.json`);
        if (fs.existsSync(indexFile)) {
            try {
                const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
                return index.allIds || [];
            } catch (e) {}
        }
        return this._scanAllIds();
    }
    
    /**
     * الحصول على إحصائيات
     */
    getStats() {
        return {
            type: this.type,
            totalCount: this.meta.totalCount,
            lastUpdated: this.meta.lastUpdated,
            indexFields: CONFIG.INDEX_FIELDS[this.type],
            baseDir: this.baseDir
        };
    }
    
    /**
     * الحصول على الـ Meta
     */
    getMeta() {
        return this.meta || { totalCount: 0 };
    }
    
    // ==================== SEARCH ====================
    
    /**
     * البحث (يستخدم فهرس البحث)
     */
    search(query, options = {}) {
        const { limit = 20 } = options;
        const searchIndex = this._loadSearchIndex();
        
        if (!searchIndex || !query) {
            return [];
        }
        
        const normalizedQuery = query.toLowerCase().trim();
        const results = [];
        
        // البحث في الفهرس
        for (const [id, keywords] of Object.entries(searchIndex)) {
            if (keywords.toLowerCase().includes(normalizedQuery)) {
                results.push(id);
                if (results.length >= limit) break;
            }
        }
        
        // قراءة البيانات الكاملة
        return results.map(id => this.read(id)).filter(Boolean);
    }
    
    // ==================== INDEX MANAGEMENT ====================
    
    /**
     * إعادة بناء جميع الفهارس
     */
    async rebuildAllIndices() {
        console.log(`[FlatFileDB] Rebuilding indices for ${this.type}...`);
        
        const allIds = this._scanAllIds();
        const indices = {
            allIds: [],
            byField: {},
            searchIndex: {}
        };
        
        // تهيئة الفهارس
        CONFIG.INDEX_FIELDS[this.type].forEach(field => {
            indices.byField[field] = {};
        });
        
        // مسح جميع الملفات وبناء الفهارس
        let count = 0;
        for (const id of allIds) {
            const item = this.read(id);
            if (!item) continue;
            
            indices.allIds.push(id);
            
            // فهرسة الحقول
            CONFIG.INDEX_FIELDS[this.type].forEach(field => {
                const value = getNestedValue(item, field);
                if (value !== undefined && value !== null) {
                    const key = String(value);
                    if (!indices.byField[field][key]) {
                        indices.byField[field][key] = [];
                    }
                    indices.byField[field][key].push(id);
                }
            });
            
            // فهرس البحث
            const searchText = CONFIG.SEARCH_FIELDS[this.type]
                .map(f => getNestedValue(item, f))
                .filter(Boolean)
                .join(' ');
            indices.searchIndex[id] = searchText;
            
            count++;
            if (count % 1000 === 0) {
                console.log(`[FlatFileDB] Indexed ${count} items...`);
            }
        }
        
        // حفظ الفهارس
        const indexFile = path.join(CONFIG.BASE_DIR, `${this.type}_index.json`);
        fs.writeFileSync(indexFile, JSON.stringify(indices, null, 2));
        
        // تحديث الـ Meta
        this.meta.totalCount = count;
        this.meta.lastIndexed = new Date().toISOString();
        this._saveMeta();
        
        // إعادة توليد صفحات القوائم
        await this._regenerateAllListPages();
        
        console.log(`[FlatFileDB] Indexed ${count} ${this.type} items`);
        
        return { indexed: count };
    }
    
    // ==================== PRIVATE METHODS ====================
    
    _ensureDirectories() {
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
        if (!fs.existsSync(this.listsDir)) {
            fs.mkdirSync(this.listsDir, { recursive: true });
        }
    }
    
    _ensureDir(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
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
    
    _loadIndices() {
        const indexFile = path.join(CONFIG.BASE_DIR, `${this.type}_index.json`);
        if (fs.existsSync(indexFile)) {
            try {
                return JSON.parse(fs.readFileSync(indexFile, 'utf8'));
            } catch (e) {}
        }
        return { allIds: [], byField: {}, searchIndex: {} };
    }
    
    _saveIndices(indices) {
        const indexFile = path.join(CONFIG.BASE_DIR, `${this.type}_index.json`);
        fs.writeFileSync(indexFile, JSON.stringify(indices, null, 2));
    }
    
    _loadSearchIndex() {
        const indices = this._loadIndices();
        return indices.searchIndex || {};
    }
    
    async _updateIndices(action, item) {
        const indices = this._loadIndices();
        
        if (action === 'add') {
            // إضافة إلى قائمة IDs
            if (!indices.allIds.includes(item.id)) {
                indices.allIds.unshift(item.id); // إضافة في البداية (الأحدث أولاً)
            }
            
            // فهرسة الحقول
            CONFIG.INDEX_FIELDS[this.type].forEach(field => {
                const value = getNestedValue(item, field);
                if (value !== undefined && value !== null) {
                    const key = String(value);
                    if (!indices.byField[field]) indices.byField[field] = {};
                    if (!indices.byField[field][key]) indices.byField[field][key] = [];
                    if (!indices.byField[field][key].includes(item.id)) {
                        indices.byField[field][key].push(item.id);
                    }
                }
            });
            
            // فهرس البحث
            const searchText = CONFIG.SEARCH_FIELDS[this.type]
                .map(f => getNestedValue(item, f))
                .filter(Boolean)
                .join(' ');
            indices.searchIndex[item.id] = searchText;
            
        } else if (action === 'remove') {
            // إزالة من قائمة IDs
            indices.allIds = (indices.allIds || []).filter(id => id !== item.id);
            
            // إزالة من فهارس الحقول
            CONFIG.INDEX_FIELDS[this.type].forEach(field => {
                const value = getNestedValue(item, field);
                if (value !== undefined && value !== null) {
                    const key = String(value);
                    if (indices.byField && indices.byField[field] && indices.byField[field][key]) {
                        indices.byField[field][key] = indices.byField[field][key].filter(id => id !== item.id);
                    }
                }
            });
            
            // إزالة من فهرس البحث
            if (indices.searchIndex) {
                delete indices.searchIndex[item.id];
            }
            
            // إزالة من pathMap
            if (indices.pathMap) {
                delete indices.pathMap[item.id];
            }
        }
        
        this._saveIndices(indices);
    }
    
    _getIdsFromIndex(filter) {
        const indexData = this._loadIndices();
        
        if (Object.keys(filter).length === 0) {
            return indexData.allIds || [];
        }
        
        // دعم كلا الهيكلين: indices أو byField
        const indices = indexData.indices || indexData.byField || {};
        
        // الحصول على IDs من كل فلتر ثم التقاطع
        let resultIds = null;
        
        for (const [field, value] of Object.entries(filter)) {
            const fieldIndex = indices[field];
            if (fieldIndex && fieldIndex[String(value)]) {
                const ids = new Set(fieldIndex[String(value)]);
                if (resultIds === null) {
                    resultIds = ids;
                } else {
                    resultIds = new Set([...resultIds].filter(id => ids.has(id)));
                }
            } else {
                // إذا لم يوجد الفلتر، نرجع كل الـ IDs ونفلتر لاحقاً
                if (resultIds === null) {
                    resultIds = new Set(indexData.allIds || []);
                }
            }
        }
        
        return resultIds ? [...resultIds] : (indexData.allIds || []);
    }
    
    _getFilterKey(filter) {
        if (Object.keys(filter).length === 0) {
            return 'all';
        }
        return Object.entries(filter)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([k, v]) => `${k}_${v}`)
            .join('__');
    }
    
    _scanAllIds() {
        const ids = [];
        
        const scanDir = (dir) => {
            if (!fs.existsSync(dir)) return;
            
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
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
    
    _buildPage(page, filter) {
        const result = this.getByFilter(filter, { page, limit: CONFIG.ITEMS_PER_PAGE });
        return result;
    }
    
    // Debounce timer for list regeneration
    _scheduleListRegeneration() {
        // إلغاء المؤقت السابق إذا وجد
        if (this._regenTimer) {
            clearTimeout(this._regenTimer);
        }
        
        // جدولة التحديث بعد 500ms (لتجميع التحديثات المتتالية)
        this._regenTimer = setTimeout(() => {
            this._doRegenerateListPages().catch(console.error);
        }, 500);
    }
    
    async _regenerateListPages() {
        // استخدام debouncing لتحسين الأداء
        this._scheduleListRegeneration();
    }
    
    async _doRegenerateListPages() {
        // توليد أول 5 صفحات فقط (الأكثر استخداماً)
        const indices = this._loadIndices();
        const allIds = indices.allIds || [];
        
        const totalPages = Math.min(5, Math.ceil(allIds.length / CONFIG.ITEMS_PER_PAGE));
        
        this._ensureDir(path.join(this.listsDir, 'all'));
        
        for (let page = 1; page <= totalPages; page++) {
            const skip = (page - 1) * CONFIG.ITEMS_PER_PAGE;
            const pageIds = allIds.slice(skip, skip + CONFIG.ITEMS_PER_PAGE);
            const data = pageIds.map(id => this.read(id)).filter(Boolean);
            
            const pageData = {
                data,
                total: allIds.length,
                page,
                limit: CONFIG.ITEMS_PER_PAGE,
                totalPages: Math.ceil(allIds.length / CONFIG.ITEMS_PER_PAGE),
                hasNext: page < Math.ceil(allIds.length / CONFIG.ITEMS_PER_PAGE),
                hasPrev: page > 1,
                generatedAt: new Date().toISOString()
            };
            
            const pageFile = path.join(this.listsDir, 'all', `page_${page}.json`);
            fs.writeFileSync(pageFile, JSON.stringify(pageData, null, 2));
        }
    }
    
    async _regenerateAllListPages() {
        console.log(`[FlatFileDB] Regenerating list pages for ${this.type}...`);
        
        const indices = this._loadIndices();
        const allIds = indices.allIds || [];
        const totalPages = Math.ceil(allIds.length / CONFIG.ITEMS_PER_PAGE);
        
        // توليد صفحات "all"
        this._ensureDir(path.join(this.listsDir, 'all'));
        
        for (let page = 1; page <= Math.min(totalPages, CONFIG.MAX_PAGES_CACHE); page++) {
            const skip = (page - 1) * CONFIG.ITEMS_PER_PAGE;
            const pageIds = allIds.slice(skip, skip + CONFIG.ITEMS_PER_PAGE);
            const data = pageIds.map(id => this.read(id)).filter(Boolean);
            
            const pageData = {
                data,
                total: allIds.length,
                page,
                limit: CONFIG.ITEMS_PER_PAGE,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
                generatedAt: new Date().toISOString()
            };
            
            const pageFile = path.join(this.listsDir, 'all', `page_${page}.json`);
            fs.writeFileSync(pageFile, JSON.stringify(pageData, null, 2));
        }
        
        // توليد صفحات مفلترة للحقول الشائعة
        const byField = indices.byField || {};
        
        for (const [field, values] of Object.entries(byField)) {
            for (const [value, ids] of Object.entries(values)) {
                if (ids.length === 0) continue;
                
                const filterKey = `${field}_${value}`;
                const filterDir = path.join(this.listsDir, filterKey);
                this._ensureDir(filterDir);
                
                const filterTotalPages = Math.ceil(ids.length / CONFIG.ITEMS_PER_PAGE);
                
                for (let page = 1; page <= Math.min(filterTotalPages, 10); page++) {
                    const skip = (page - 1) * CONFIG.ITEMS_PER_PAGE;
                    const pageIds = ids.slice(skip, skip + CONFIG.ITEMS_PER_PAGE);
                    const data = pageIds.map(id => this.read(id)).filter(Boolean);
                    
                    const pageData = {
                        data,
                        total: ids.length,
                        page,
                        limit: CONFIG.ITEMS_PER_PAGE,
                        totalPages: filterTotalPages,
                        hasNext: page < filterTotalPages,
                        hasPrev: page > 1,
                        filter: { [field]: value },
                        generatedAt: new Date().toISOString()
                    };
                    
                    const pageFile = path.join(filterDir, `page_${page}.json`);
                    fs.writeFileSync(pageFile, JSON.stringify(pageData, null, 2));
                }
            }
        }
        
        console.log(`[FlatFileDB] Generated list pages for ${this.type}`);
    }
}

// ==================== MIGRATION TOOL ====================
class MigrationTool {
    /**
     * ترحيل البيانات من النظام القديم (ملف واحد) إلى النظام الجديد (ملف لكل عنصر)
     */
    static async migrateFromLegacy(type, legacyFilePath) {
        console.log(`[Migration] Starting migration for ${type}...`);
        
        if (!fs.existsSync(legacyFilePath)) {
            console.log(`[Migration] Legacy file not found: ${legacyFilePath}`);
            return { migrated: 0 };
        }
        
        const manager = new FlatFileManager(type);
        const legacyData = JSON.parse(fs.readFileSync(legacyFilePath, 'utf8'));
        
        if (!Array.isArray(legacyData)) {
            console.log(`[Migration] Legacy file is not an array`);
            return { migrated: 0 };
        }
        
        let migrated = 0;
        
        for (const item of legacyData) {
            if (!item.id) {
                item.id = uuidv4();
            }
            
            // حفظ الملف مباشرة (بدون تحديث الفهارس لكل عنصر)
            const filePath = idToPath(type, item.id);
            manager._ensureDir(path.dirname(filePath));
            fs.writeFileSync(filePath, JSON.stringify(item, null, 2));
            
            migrated++;
            
            if (migrated % 100 === 0) {
                console.log(`[Migration] Migrated ${migrated} items...`);
            }
        }
        
        // إعادة بناء الفهارس بعد الترحيل
        await manager.rebuildAllIndices();
        
        // نسخ احتياطي للملف القديم
        const backupPath = legacyFilePath.replace('.json', '_backup.json');
        fs.copyFileSync(legacyFilePath, backupPath);
        
        console.log(`[Migration] Completed! Migrated ${migrated} ${type} items`);
        console.log(`[Migration] Backup created at: ${backupPath}`);
        
        return { migrated, backupPath };
    }
    
    /**
     * تصدير البيانات من النظام الجديد إلى ملف واحد (للنسخ الاحتياطي)
     */
    static exportToLegacy(type, outputPath) {
        const manager = new FlatFileManager(type);
        const allIds = manager.getAllIds();
        const data = allIds.map(id => manager.read(id)).filter(Boolean);
        
        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
        
        return { exported: data.length, path: outputPath };
    }
}

// ==================== EXPORTS ====================
module.exports = {
    FlatFileManager,
    MigrationTool,
    CONFIG,
    idToPath,
    getNestedValue,
    formatBytes
};
