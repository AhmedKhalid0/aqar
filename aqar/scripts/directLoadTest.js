/**
 * Direct Load Test Script - Sharded Flat-File System
 * اختبار الحمل المباشر لنظام الملفات المسطحة المجزأة
 * 
 * Creates 100 items of each type directly using ShardedDataService
 * 
 * Usage: node scripts/directLoadTest.js
 */

const { shardedDataService } = require('../lib/shardedFlatFileDB');

const ITEMS_PER_TYPE = 100;

// Random data generators
const arabicTitles = ['شقة فاخرة', 'فيلا راقية', 'مكتب تجاري', 'محل للبيع', 'استوديو مميز', 'بنتهاوس فخم', 'دوبلكس عصري', 'روف مطل'];
const englishTitles = ['Luxury Apartment', 'Premium Villa', 'Commercial Office', 'Shop for Sale', 'Special Studio', 'Luxury Penthouse', 'Modern Duplex', 'Roof with View'];
const arabicNames = ['أحمد محمد', 'سارة علي', 'محمد خالد', 'فاطمة حسن', 'عمر يوسف', 'نور الدين', 'ليلى أحمد', 'كريم سعيد'];
const RANDOM_IMAGES = ['https://picsum.photos/800/600', 'https://picsum.photos/1200/800', 'https://picsum.photos/1000/700'];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Data generators
const generators = {
    units: (i) => ({
        title: { ar: `${randomItem(arabicTitles)} #${i}`, en: `${randomItem(englishTitles)} #${i}` },
        description: { ar: `وصف الوحدة ${i}`, en: `Unit description ${i}` },
        price: randomInt(500000, 5000000),
        area: randomInt(50, 500),
        bedrooms: randomInt(1, 5),
        type: 'apartment',
        status: 'active',
        unitStatus: 'available',
        featured: i % 10 === 0,
        images: [randomItem(RANDOM_IMAGES)]
    }),

    projects: (i) => ({
        title: { ar: `مشروع ${i}`, en: `Project ${i}` },
        description: { ar: `وصف المشروع ${i}`, en: `Project description ${i}` },
        status: 'active',
        featured: i % 5 === 0,
        images: [randomItem(RANDOM_IMAGES)]
    }),

    news: (i) => ({
        title: { ar: `خبر ${i}`, en: `News ${i}` },
        content: { ar: `<p>محتوى الخبر ${i}</p>`, en: `<p>News content ${i}</p>` },
        status: 'published',
        category: 'market',
        image: randomItem(RANDOM_IMAGES)
    }),

    comments: (i) => ({
        content: `تعليق ${i} - Comment ${i}`,
        userName: randomItem(arabicNames),
        userEmail: `user${i}@test.com`,
        unitId: `unit-${randomInt(1, 50)}`,
        status: 'pending'
    }),

    reviews: (i) => ({
        content: `مراجعة ${i} - Review ${i}`,
        userName: randomItem(arabicNames),
        userEmail: `reviewer${i}@test.com`,
        rating: randomInt(3, 5),
        status: 'pending'
    }),

    messages: (i) => ({
        name: randomItem(arabicNames),
        email: `sender${i}@test.com`,
        phone: `010${randomInt(10000000, 99999999)}`,
        subject: `استفسار ${i}`,
        message: `رسالة ${i}`,
        isRead: false,
        status: 'new'
    }),

    visitors: (i) => ({
        ip: `192.168.${randomInt(1, 255)}.${randomInt(1, 255)}`,
        userAgent: `Test Browser ${i}`,
        page: ['/', '/units', '/projects'][randomInt(0, 2)],
        date: new Date().toISOString().split('T')[0]
    }),

    logs: (i) => ({
        userId: 'test',
        username: 'test',
        action: ['LOGIN', 'CREATE', 'UPDATE', 'DELETE'][randomInt(0, 3)],
        details: `Log entry ${i}`,
        date: new Date().toISOString().split('T')[0]
    }),

    login_attempts: (i) => ({
        ip: `10.0.${randomInt(1, 255)}.${randomInt(1, 255)}`,
        username: `user${randomInt(1, 100)}`,
        success: Math.random() > 0.3
    })
};

async function runDirectLoadTest() {
    console.log('═'.repeat(60));
    console.log('🔬 DIRECT SHARDED FLAT-FILE LOAD TEST');
    console.log('═'.repeat(60));
    console.log(`Target: ${ITEMS_PER_TYPE} items per type\n`);

    const startTime = Date.now();
    const results = {};

    // Initialize service
    shardedDataService.initAll();

    // Test each type
    const types = Object.keys(generators);

    for (const type of types) {
        console.log(`\n📦 Creating ${ITEMS_PER_TYPE} ${type}...`);
        const manager = shardedDataService.getManager(type);

        if (!manager) {
            console.log(`   ⚠️ Manager not found for ${type}`);
            results[type] = { success: 0, failed: ITEMS_PER_TYPE };
            continue;
        }

        let success = 0;
        let failed = 0;
        const typeStart = Date.now();

        for (let i = 1; i <= ITEMS_PER_TYPE; i++) {
            try {
                const data = generators[type](i);
                manager.create(data);
                success++;
            } catch (e) {
                failed++;
                if (failed <= 2) {
                    console.log(`   ❌ Error: ${e.message}`);
                }
            }
        }

        const typeTime = ((Date.now() - typeStart) / 1000).toFixed(2);
        console.log(`   ✅ ${success} created, ${failed} failed (${typeTime}s)`);
        results[type] = { success, failed, time: typeTime };
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 LOAD TEST RESULTS');
    console.log('═'.repeat(60));

    let totalSuccess = 0;
    let totalFailed = 0;

    for (const [type, result] of Object.entries(results)) {
        console.log(`  ${type.padEnd(15)}: ${String(result.success).padStart(3)} ✅ | ${result.failed} ❌ (${result.time}s)`);
        totalSuccess += result.success;
        totalFailed += result.failed;
    }

    console.log('─'.repeat(60));
    console.log(`  TOTAL          : ${totalSuccess} ✅ | ${totalFailed} ❌`);
    console.log(`  TOTAL TIME     : ${totalTime}s`);
    console.log('═'.repeat(60));

    // Final stats
    console.log('\n📁 Final Sharded Stats:');
    const stats = shardedDataService.getAllStats();
    for (const [type, stat] of Object.entries(stats)) {
        console.log(`  ${type.padEnd(15)}: ${String(stat.totalCount).padStart(4)} records, ${stat.shardCount} shards`);
    }

    console.log('\n✅ Load test completed!');
}

// Run
runDirectLoadTest().catch(console.error);
