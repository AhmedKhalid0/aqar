/**
 * Search Manager - نظام البحث السريع باستخدام FlexSearch
 * 
 * @version 1.0.0
 * @description فهرس بحث في الذاكرة للبحث الفوري في ملايين السجلات
 */

const fs = require('fs');
const path = require('path');

// ==================== CONFIGURATION ====================
const CONFIG = {
    BASE_DIR: path.join(__dirname, '..', 'secure_data'),
    
    // حقول البحث لكل نوع
    SEARCH_CONFIG: {
        units: {
            fields: ['title.ar', 'title.en', 'description.ar', 'description.en', 'location.ar', 'location.en', 'type'],
            weights: { 'title.ar': 3, 'title.en': 3, 'type': 2 }
        },
        projects: {
            fields: ['title.ar', 'title.en', 'description.ar', 'description.en', 'location.ar', 'location.en'],
            weights: { 'title.ar': 3, 'title.en': 3 }
        },
        news: {
            fields: ['title.ar', 'title.en', 'content.ar', 'content.en', 'category'],
            weights: { 'title.ar': 3, 'title.en': 3, 'category': 2 }
        }
    }
};

// ==================== UTILITY FUNCTIONS ====================
function getNestedValue(obj, path) {
    const parts = path.split('.');
    let value = obj;
    for (const part of parts) {
        if (value && typeof value === 'object') {
            value = value[part];
        } else {
            return '';
        }
    }
    return value || '';
}

// ==================== SIMPLE SEARCH ENGINE ====================
// محرك بحث بسيط وسريع بدون تبعيات خارجية
class SimpleSearchEngine {
    constructor() {
        this.documents = new Map(); // id -> { text, data }
        this.invertedIndex = new Map(); // word -> Set<id>
        this.wordCache = new Map(); // كاش للكلمات المعالجة
    }
    
    /**
     * تنظيف وتحليل النص
     */
    tokenize(text) {
        if (!text) return [];
        
        // تحويل لحروف صغيرة وإزالة علامات الترقيم
        const normalized = String(text)
            .toLowerCase()
            .replace(/[^\w\s\u0600-\u06FF]/g, ' ') // الحفاظ على العربية والإنجليزية
            .replace(/\s+/g, ' ')
            .trim();
        
        if (!normalized) return [];
        
        // تقسيم إلى كلمات
        const words = normalized.split(' ').filter(w => w.length >= 2);
        
        // إضافة أجزاء الكلمات للبحث الجزئي
        const tokens = new Set(words);
        words.forEach(word => {
            // إضافة prefixes للبحث الجزئي
            for (let i = 2; i < word.length; i++) {
                tokens.add(word.substring(0, i));
            }
        });
        
        return [...tokens];
    }
    
    /**
     * إضافة مستند للفهرس
     */
    add(id, text, data = null) {
        const tokens = this.tokenize(text);
        
        // تخزين المستند
        this.documents.set(id, { text, data, tokens: new Set(tokens) });
        
        // تحديث الفهرس المقلوب
        tokens.forEach(token => {
            if (!this.invertedIndex.has(token)) {
                this.invertedIndex.set(token, new Set());
            }
            this.invertedIndex.get(token).add(id);
        });
    }
    
    /**
     * إزالة مستند من الفهرس
     */
    remove(id) {
        const doc = this.documents.get(id);
        if (!doc) return;
        
        // إزالة من الفهرس المقلوب
        doc.tokens.forEach(token => {
            const ids = this.invertedIndex.get(token);
            if (ids) {
                ids.delete(id);
                if (ids.size === 0) {
                    this.invertedIndex.delete(token);
                }
            }
        });
        
        // إزالة المستند
        this.documents.delete(id);
    }
    
    /**
     * البحث
     */
    search(query, limit = 20) {
        const queryTokens = this.tokenize(query);
        if (queryTokens.length === 0) return [];
        
        // حساب النتائج مع التقييم
        const scores = new Map();
        
        queryTokens.forEach(token => {
            const ids = this.invertedIndex.get(token);
            if (ids) {
                ids.forEach(id => {
                    const currentScore = scores.get(id) || 0;
                    // كلما كان التطابق أكبر، النتيجة أعلى
                    scores.set(id, currentScore + 1);
                });
            }
        });
        
        // ترتيب حسب النتيجة
        const results = [...scores.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([id, score]) => ({
                id,
                score,
                data: this.documents.get(id)?.data
            }));
        
        return results;
    }
    
    /**
     * مسح الفهرس
     */
    clear() {
        this.documents.clear();
        this.invertedIndex.clear();
    }
    
    /**
     * الحصول على إحصائيات
     */
    getStats() {
        return {
            documentsCount: this.documents.size,
            uniqueTokens: this.invertedIndex.size,
            memoryUsage: this._estimateMemory()
        };
    }
    
    _estimateMemory() {
        // تقدير تقريبي لاستخدام الذاكرة
        let size = 0;
        this.documents.forEach((doc) => {
            size += doc.text.length * 2; // UTF-16
        });
        return size;
    }
}

// ==================== SEARCH MANAGER ====================
class SearchManager {
    constructor() {
        this.engines = new Map(); // type -> SimpleSearchEngine
        this.loaded = new Set();
    }
    
    /**
     * تحميل فهرس البحث لنوع معين
     */
    async load(type) {
        if (this.loaded.has(type)) {
            return;
        }
        
        console.log(`[SearchManager] Loading search index for ${type}...`);
        
        const engine = new SimpleSearchEngine();
        const indexFile = path.join(CONFIG.BASE_DIR, `${type}_index.json`);
        
        if (fs.existsSync(indexFile)) {
            try {
                const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
                const searchIndex = index.searchIndex || {};
                
                for (const [id, text] of Object.entries(searchIndex)) {
                    engine.add(id, text, { id });
                }
                
                console.log(`[SearchManager] Loaded ${engine.getStats().documentsCount} documents for ${type}`);
            } catch (error) {
                console.error(`[SearchManager] Error loading index for ${type}:`, error.message);
            }
        }
        
        this.engines.set(type, engine);
        this.loaded.add(type);
    }
    
    /**
     * البحث في نوع معين
     */
    async search(type, query, options = {}) {
        await this.load(type);
        
        const engine = this.engines.get(type);
        if (!engine) {
            return [];
        }
        
        const { limit = 20 } = options;
        const results = engine.search(query, limit);
        
        return results.map(r => r.id);
    }
    
    /**
     * البحث في جميع الأنواع
     */
    async searchAll(query, options = {}) {
        const { limit = 20 } = options;
        const results = {};
        
        for (const type of Object.keys(CONFIG.SEARCH_CONFIG)) {
            results[type] = await this.search(type, query, { limit: Math.ceil(limit / 3) });
        }
        
        return results;
    }
    
    /**
     * إضافة عنصر للفهرس
     */
    async addToIndex(type, item) {
        await this.load(type);
        
        const engine = this.engines.get(type);
        if (!engine) return;
        
        const config = CONFIG.SEARCH_CONFIG[type];
        if (!config) return;
        
        const text = config.fields
            .map(field => getNestedValue(item, field))
            .filter(Boolean)
            .join(' ');
        
        engine.add(item.id, text, { id: item.id });
    }
    
    /**
     * إزالة عنصر من الفهرس
     */
    async removeFromIndex(type, id) {
        const engine = this.engines.get(type);
        if (engine) {
            engine.remove(id);
        }
    }
    
    /**
     * إعادة تحميل الفهرس
     */
    async reload(type) {
        this.loaded.delete(type);
        this.engines.delete(type);
        await this.load(type);
    }
    
    /**
     * الحصول على إحصائيات
     */
    getStats(type = null) {
        if (type) {
            const engine = this.engines.get(type);
            return engine ? engine.getStats() : null;
        }
        
        const stats = {};
        this.engines.forEach((engine, t) => {
            stats[t] = engine.getStats();
        });
        return stats;
    }
}

// ==================== SINGLETON INSTANCE ====================
const searchManager = new SearchManager();

// ==================== EXPORTS ====================
module.exports = {
    SearchManager,
    SimpleSearchEngine,
    searchManager,
    CONFIG
};
