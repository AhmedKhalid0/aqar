/**
 * Flat-File Database System - Main Entry Point
 * نقطة الدخول الرئيسية لنظام قاعدة البيانات المسطحة
 * 
 * @version 1.0.0
 */

const { FlatFileManager, MigrationTool, CONFIG: FlatFileConfig } = require('./flatFileDB');
const { searchManager, SearchManager } = require('./searchManager');
const { staticGenerator, StaticGenerator } = require('./staticGenerator');
const { dataManager } = require('./dataManager');
const { apiCache, cacheMiddleware, LRUCache, APICache } = require('./cache');

// ==================== UNIFIED DATA SERVICE ====================
class DataService {
    constructor() {
        this.flatFileManagers = new Map();
        this.useFlatFile = new Set(['units', 'projects', 'news']); // الأنواع التي تستخدم النظام الجديد
        this.initialized = false;
    }
    
    /**
     * تهيئة النظام
     */
    async initialize() {
        if (this.initialized) return;
        
        console.log('[DataService] Initializing...');
        
        // تحميل فهارس البحث
        for (const type of this.useFlatFile) {
            await searchManager.load(type);
        }
        
        this.initialized = true;
        console.log('[DataService] Initialized successfully');
    }
    
    /**
     * الحصول على مدير الملفات المناسب
     */
    getManager(type) {
        if (this.useFlatFile.has(type)) {
            if (!this.flatFileManagers.has(type)) {
                this.flatFileManagers.set(type, new FlatFileManager(type));
            }
            return this.flatFileManagers.get(type);
        }
        return null;
    }
    
    /**
     * التحقق من استخدام النظام الجديد
     */
    usesFlatFile(type) {
        return this.useFlatFile.has(type);
    }
    
    // ==================== CRUD OPERATIONS ====================
    
    /**
     * إنشاء عنصر جديد
     */
    async create(type, data) {
        if (this.usesFlatFile(type)) {
            const manager = this.getManager(type);
            const item = await manager.create(data);
            
            // تحديث فهرس البحث
            await searchManager.addToIndex(type, item);
            
            // تحديث الصفحات الثابتة (أول 5 صفحات)
            await staticGenerator.updateFirstPages(type, 5);
            
            return item;
        } else {
            // استخدام النظام القديم
            const items = dataManager.read(type);
            items.push(data);
            await dataManager.write(type, items);
            return data;
        }
    }
    
    /**
     * قراءة عنصر بواسطة ID
     */
    read(type, id) {
        if (this.usesFlatFile(type)) {
            const manager = this.getManager(type);
            return manager.read(id);
        } else {
            return dataManager.getById(type, id);
        }
    }
    
    /**
     * تحديث عنصر
     */
    async update(type, id, updates) {
        if (this.usesFlatFile(type)) {
            const manager = this.getManager(type);
            const item = await manager.update(id, updates);
            
            if (item) {
                // تحديث فهرس البحث
                await searchManager.removeFromIndex(type, id);
                await searchManager.addToIndex(type, item);
                
                // تحديث الصفحات الثابتة
                await staticGenerator.updateFirstPages(type, 5);
            }
            
            return item;
        } else {
            return await dataManager.update(type, id, updates);
        }
    }
    
    /**
     * حذف عنصر
     */
    async delete(type, id) {
        if (this.usesFlatFile(type)) {
            const manager = this.getManager(type);
            const result = await manager.delete(id);
            
            if (result) {
                // إزالة من فهرس البحث
                await searchManager.removeFromIndex(type, id);
                
                // تحديث الصفحات الثابتة
                await staticGenerator.updateFirstPages(type, 5);
            }
            
            return result;
        } else {
            return await dataManager.delete(type, id);
        }
    }
    
    // ==================== QUERY OPERATIONS ====================
    
    /**
     * استعلام مع فلترة وترقيم صفحات
     */
    query(type, options = {}) {
        if (this.usesFlatFile(type)) {
            const manager = this.getManager(type);
            return manager.getByFilter(options.filter || {}, {
                page: options.page || 1,
                limit: options.limit || 20,
                sort: options.sort
            });
        } else {
            return dataManager.query(type, options);
        }
    }
    
    /**
     * الحصول على صفحة من الملفات المجهزة مسبقاً
     */
    getStaticPage(type, page = 1, filter = {}) {
        if (this.usesFlatFile(type)) {
            const manager = this.getManager(type);
            return manager.getPage(page, filter);
        }
        return null;
    }
    
    /**
     * البحث
     */
    async search(type, query, options = {}) {
        if (this.usesFlatFile(type)) {
            const ids = await searchManager.search(type, query, options);
            const manager = this.getManager(type);
            return ids.map(id => manager.read(id)).filter(Boolean);
        } else {
            return dataManager.search(type, query);
        }
    }
    
    /**
     * البحث في جميع الأنواع
     */
    async searchAll(query, options = {}) {
        return await searchManager.searchAll(query, options);
    }
    
    // ==================== UTILITY OPERATIONS ====================
    
    /**
     * الحصول على إحصائيات
     */
    getStats(type) {
        if (this.usesFlatFile(type)) {
            const manager = this.getManager(type);
            return {
                ...manager.getStats(),
                searchStats: searchManager.getStats(type)
            };
        } else {
            return dataManager.getStats(type);
        }
    }
    
    /**
     * إعادة بناء الفهارس
     */
    async rebuildIndices(type) {
        if (this.usesFlatFile(type)) {
            const manager = this.getManager(type);
            await manager.rebuildAllIndices();
            await searchManager.reload(type);
            await staticGenerator.generateAll(type);
            return { success: true };
        }
        return { success: false, error: 'Type does not use flat file system' };
    }
    
    /**
     * ترحيل من النظام القديم
     */
    async migrate(type) {
        const legacyFile = require('path').join(__dirname, '..', 'secure_data', `${type}.json`);
        return await MigrationTool.migrateFromLegacy(type, legacyFile);
    }
    
    /**
     * توليد الصفحات الثابتة
     */
    async generateStaticPages(type) {
        return await staticGenerator.generateAll(type);
    }
}

// ==================== SINGLETON INSTANCE ====================
const dataService = new DataService();

// ==================== EXPORTS ====================
module.exports = {
    // Main Service
    dataService,
    DataService,
    
    // Individual Components
    FlatFileManager,
    MigrationTool,
    searchManager,
    SearchManager,
    staticGenerator,
    StaticGenerator,
    dataManager,
    
    // Cache System
    apiCache,
    cacheMiddleware,
    LRUCache,
    APICache,
    
    // Config
    FlatFileConfig
};
