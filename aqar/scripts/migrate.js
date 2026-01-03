#!/usr/bin/env node
/**
 * Migration Script - سكربت ترحيل البيانات من النظام القديم إلى Flat-File Database
 * 
 * الاستخدام:
 *   node scripts/migrate.js [type]
 *   node scripts/migrate.js units
 *   node scripts/migrate.js projects
 *   node scripts/migrate.js news
 *   node scripts/migrate.js all
 */

const path = require('path');
const fs = require('fs');

// إضافة المسار للـ lib
const { FlatFileManager, MigrationTool } = require('../lib/flatFileDB');
const { staticGenerator } = require('../lib/staticGenerator');
const { searchManager } = require('../lib/searchManager');

const TYPES = ['units', 'projects', 'news'];

async function migrateType(type) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 بدء ترحيل ${type}...`);
    console.log('='.repeat(60));
    
    const legacyFile = path.join(__dirname, '..', 'secure_data', `${type}.json`);
    
    if (!fs.existsSync(legacyFile)) {
        console.log(`⚠️  الملف القديم غير موجود: ${legacyFile}`);
        return { type, migrated: 0, skipped: true };
    }
    
    try {
        // قراءة البيانات القديمة
        const legacyData = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
        console.log(`📄 وجد ${legacyData.length} عنصر في الملف القديم`);
        
        if (legacyData.length === 0) {
            console.log(`⚠️  الملف فارغ، تخطي الترحيل`);
            return { type, migrated: 0, skipped: true };
        }
        
        // الترحيل
        const result = await MigrationTool.migrateFromLegacy(type, legacyFile);
        
        console.log(`✅ تم ترحيل ${result.migrated} عنصر`);
        console.log(`📁 النسخة الاحتياطية: ${result.backupPath}`);
        
        // توليد الصفحات الثابتة
        console.log(`\n📑 توليد الصفحات الثابتة...`);
        const pagesResult = await staticGenerator.generateAll(type);
        console.log(`✅ تم توليد ${pagesResult.totalPages} صفحة في ${pagesResult.duration}ms`);
        
        return { type, ...result, pages: pagesResult.totalPages };
        
    } catch (error) {
        console.error(`❌ خطأ في ترحيل ${type}:`, error.message);
        return { type, error: error.message };
    }
}

async function migrateAll() {
    console.log('\n' + '🔄'.repeat(30));
    console.log('     بدء ترحيل جميع البيانات');
    console.log('🔄'.repeat(30));
    
    const results = [];
    
    for (const type of TYPES) {
        const result = await migrateType(type);
        results.push(result);
    }
    
    // ملخص
    console.log('\n' + '='.repeat(60));
    console.log('📊 ملخص الترحيل:');
    console.log('='.repeat(60));
    
    let totalMigrated = 0;
    results.forEach(r => {
        if (r.error) {
            console.log(`❌ ${r.type}: خطأ - ${r.error}`);
        } else if (r.skipped) {
            console.log(`⏭️  ${r.type}: تم التخطي`);
        } else {
            console.log(`✅ ${r.type}: ${r.migrated} عنصر، ${r.pages || 0} صفحة`);
            totalMigrated += r.migrated;
        }
    });
    
    console.log('\n' + '-'.repeat(60));
    console.log(`📈 إجمالي العناصر المرحلة: ${totalMigrated}`);
    console.log('='.repeat(60));
    
    return results;
}

async function showStats(type) {
    const manager = new FlatFileManager(type);
    const stats = manager.getStats();
    
    console.log(`\n📊 إحصائيات ${type}:`);
    console.log(`   - العدد الإجمالي: ${stats.totalCount}`);
    console.log(`   - آخر تحديث: ${stats.lastUpdated || 'غير محدد'}`);
    console.log(`   - المسار: ${stats.baseDir}`);
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';
    
    switch (command) {
        case 'all':
            await migrateAll();
            break;
            
        case 'units':
        case 'projects':
        case 'news':
            await migrateType(command);
            break;
            
        case 'stats':
            const statsType = args[1];
            if (statsType && TYPES.includes(statsType)) {
                await showStats(statsType);
            } else {
                for (const t of TYPES) {
                    await showStats(t);
                }
            }
            break;
            
        case 'rebuild':
            const rebuildType = args[1];
            if (rebuildType && TYPES.includes(rebuildType)) {
                const manager = new FlatFileManager(rebuildType);
                console.log(`🔄 إعادة بناء فهارس ${rebuildType}...`);
                await manager.rebuildAllIndices();
                console.log(`✅ تم إعادة بناء الفهارس`);
            } else {
                console.log('يرجى تحديد النوع: units, projects, news');
            }
            break;
            
        case 'generate':
            const genType = args[1];
            if (genType && TYPES.includes(genType)) {
                console.log(`📑 توليد الصفحات الثابتة لـ ${genType}...`);
                const result = await staticGenerator.generateAll(genType);
                console.log(`✅ تم توليد ${result.totalPages} صفحة`);
            } else {
                console.log('يرجى تحديد النوع: units, projects, news');
            }
            break;
            
        case 'help':
        default:
            console.log(`
📖 أداة ترحيل قاعدة البيانات المسطحة
=====================================

الاستخدام:
  node scripts/migrate.js <command> [type]

الأوامر:
  all                 ترحيل جميع البيانات (units, projects, news)
  units               ترحيل الوحدات فقط
  projects            ترحيل المشاريع فقط
  news                ترحيل الأخبار فقط
  stats [type]        عرض إحصائيات النوع المحدد أو الجميع
  rebuild <type>      إعادة بناء فهارس نوع معين
  generate <type>     توليد الصفحات الثابتة لنوع معين
  help                عرض هذه المساعدة

أمثلة:
  node scripts/migrate.js all
  node scripts/migrate.js units
  node scripts/migrate.js stats units
  node scripts/migrate.js rebuild units
  node scripts/migrate.js generate news
`);
            break;
    }
}

// تشغيل
main().catch(console.error);
