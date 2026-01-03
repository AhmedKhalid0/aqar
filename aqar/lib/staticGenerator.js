/**
 * Static Generator - توليد ملفات القوائم الثابتة
 * 
 * @version 1.0.0
 * @description توليد ملفات JSON ثابتة للقوائم يتم تقديمها مباشرة من Nginx
 */

const fs = require('fs');
const path = require('path');
const { FlatFileManager } = require('./flatFileDB');

// ==================== CONFIGURATION ====================
const CONFIG = {
    LISTS_DIR: path.join(__dirname, '..', 'public', 'api', 'lists'),
    ITEMS_PER_PAGE: 20,
    MAX_PAGES: 100,
    
    // الفلاتر الشائعة المجهزة مسبقاً
    PREGENERATE_FILTERS: {
        units: [
            { status: 'active' },
            { status: 'active', unitStatus: 'available' },
            { status: 'active', unitStatus: 'sold' },
            { status: 'active', unitStatus: 'reserved' },
            { status: 'active', type: 'apartment' },
            { status: 'active', type: 'villa' },
            { status: 'active', type: 'duplex' },
            { status: 'active', type: 'studio' },
            { status: 'active', type: 'penthouse' },
            { status: 'active', featured: true }
        ],
        projects: [
            { status: 'active' },
            { status: 'active', featured: true }
        ],
        news: [
            { status: 'published' }
        ]
    }
};

// ==================== STATIC GENERATOR ====================
class StaticGenerator {
    constructor() {
        this.managers = new Map();
    }
    
    /**
     * الحصول على مدير الملفات لنوع معين
     */
    getManager(type) {
        if (!this.managers.has(type)) {
            this.managers.set(type, new FlatFileManager(type));
        }
        return this.managers.get(type);
    }
    
    /**
     * توليد جميع صفحات القوائم لنوع معين
     */
    async generateAll(type) {
        console.log(`[StaticGenerator] Generating all pages for ${type}...`);
        const startTime = Date.now();
        
        const manager = this.getManager(type);
        const filters = CONFIG.PREGENERATE_FILTERS[type] || [{}];
        
        let totalPages = 0;
        
        for (const filter of filters) {
            const pages = await this.generateFilteredPages(type, filter);
            totalPages += pages;
        }
        
        const duration = Date.now() - startTime;
        console.log(`[StaticGenerator] Generated ${totalPages} pages for ${type} in ${duration}ms`);
        
        return { type, totalPages, duration };
    }
    
    /**
     * توليد صفحات لفلتر معين
     */
    async generateFilteredPages(type, filter = {}) {
        const manager = this.getManager(type);
        const filterKey = this._getFilterKey(filter);
        const outputDir = path.join(CONFIG.LISTS_DIR, type, filterKey);
        
        this._ensureDir(outputDir);
        
        // الحصول على البيانات المفلترة
        const result = manager.getByFilter(filter, { page: 1, limit: 999999 });
        const allData = result.data;
        
        const totalPages = Math.ceil(allData.length / CONFIG.ITEMS_PER_PAGE);
        const pagesToGenerate = Math.min(totalPages, CONFIG.MAX_PAGES);
        
        for (let page = 1; page <= pagesToGenerate; page++) {
            const skip = (page - 1) * CONFIG.ITEMS_PER_PAGE;
            const pageData = allData.slice(skip, skip + CONFIG.ITEMS_PER_PAGE);
            
            // إنشاء ملخص خفيف للقوائم (بدون البيانات الكاملة)
            const summaryData = pageData.map(item => this._createSummary(type, item));
            
            const pageContent = {
                data: summaryData,
                fullData: pageData, // البيانات الكاملة أيضاً
                total: allData.length,
                page,
                limit: CONFIG.ITEMS_PER_PAGE,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
                filter: Object.keys(filter).length > 0 ? filter : null,
                generatedAt: new Date().toISOString()
            };
            
            const pageFile = path.join(outputDir, `page_${page}.json`);
            fs.writeFileSync(pageFile, JSON.stringify(pageContent));
        }
        
        // إنشاء ملف meta للفلتر
        const metaFile = path.join(outputDir, 'meta.json');
        fs.writeFileSync(metaFile, JSON.stringify({
            filter,
            total: allData.length,
            totalPages,
            generatedPages: pagesToGenerate,
            generatedAt: new Date().toISOString()
        }));
        
        return pagesToGenerate;
    }
    
    /**
     * تحديث صفحة واحدة بعد تعديل عنصر
     */
    async updatePage(type, page, filter = {}) {
        const manager = this.getManager(type);
        const filterKey = this._getFilterKey(filter);
        const outputDir = path.join(CONFIG.LISTS_DIR, type, filterKey);
        
        this._ensureDir(outputDir);
        
        const result = manager.getByFilter(filter, { page, limit: CONFIG.ITEMS_PER_PAGE });
        
        const summaryData = result.data.map(item => this._createSummary(type, item));
        
        const pageContent = {
            data: summaryData,
            fullData: result.data,
            total: result.total,
            page,
            limit: CONFIG.ITEMS_PER_PAGE,
            totalPages: result.totalPages,
            hasNext: result.hasNext,
            hasPrev: result.hasPrev,
            filter: Object.keys(filter).length > 0 ? filter : null,
            generatedAt: new Date().toISOString()
        };
        
        const pageFile = path.join(outputDir, `page_${page}.json`);
        fs.writeFileSync(pageFile, JSON.stringify(pageContent));
        
        return pageContent;
    }
    
    /**
     * تحديث أول N صفحات بعد تعديل (للاستخدام السريع)
     */
    async updateFirstPages(type, count = 5) {
        const filters = CONFIG.PREGENERATE_FILTERS[type] || [{}];
        
        for (const filter of filters) {
            for (let page = 1; page <= count; page++) {
                await this.updatePage(type, page, filter);
            }
        }
    }
    
    /**
     * إنشاء ملخص خفيف للعنصر (للقوائم)
     */
    _createSummary(type, item) {
        switch (type) {
            case 'units':
                return {
                    id: item.id,
                    title: item.title,
                    type: item.type,
                    price: item.price,
                    area: item.area,
                    bedrooms: item.bedrooms,
                    bathrooms: item.bathrooms,
                    location: item.location,
                    projectId: item.projectId,
                    unitStatus: item.unitStatus,
                    status: item.status,
                    featured: item.featured,
                    images: item.images?.slice(0, 1) || [], // أول صورة فقط
                    createdAt: item.createdAt
                };
            
            case 'projects':
                return {
                    id: item.id,
                    title: item.title,
                    location: item.location,
                    status: item.status,
                    featured: item.featured,
                    image: item.image,
                    createdAt: item.createdAt
                };
            
            case 'news':
                return {
                    id: item.id,
                    title: item.title,
                    excerpt: item.excerpt || (item.content?.ar?.substring(0, 150) + '...'),
                    category: item.category,
                    status: item.status,
                    image: item.image,
                    createdAt: item.createdAt
                };
            
            default:
                return item;
        }
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
    
    _ensureDir(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

// ==================== SINGLETON INSTANCE ====================
const staticGenerator = new StaticGenerator();

// ==================== EXPORTS ====================
module.exports = {
    StaticGenerator,
    staticGenerator,
    CONFIG
};
