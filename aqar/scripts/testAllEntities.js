/**
 * Comprehensive Test - All Entity Types Sharding
 */
const { shardedDataService } = require('../lib/shardedFlatFileDB');
const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..', 'secure_data');
const ITEMS_PER_TYPE = 3000; // Force all entities to split beyond 512KB

const generators = {
    units: (i) => ({ title: { ar: `وحدة ${i}`, en: `Unit ${i}` }, price: i * 1000, status: 'active' }),
    projects: (i) => ({ title: { ar: `مشروع ${i}`, en: `Project ${i}` }, status: 'active' }),
    news: (i) => ({ title: { ar: `خبر ${i}`, en: `News ${i}` }, status: 'published' }),
    comments: (i) => ({ content: `Comment ${i}`, userName: `User ${i}`, status: 'pending' }),
    reviews: (i) => ({ content: `Review ${i}`, rating: (i % 5) + 1, status: 'pending' }),
    messages: (i) => ({ name: `Name ${i}`, email: `test${i}@test.com`, message: `Message ${i}` }),
    visitors: (i) => ({ ip: `192.168.${i % 255}.${i % 255}`, page: '/test' }),
    logs: (i) => ({ action: 'TEST', userId: 'test', details: `Log ${i}` }),
    login_attempts: (i) => ({ ip: `10.0.${i % 255}.${i % 255}`, username: `user${i}`, success: i % 2 === 0 })
};

function getShardInfo(type) {
    const indexDir = path.join(BASE_DIR, type, 'index');
    if (!fs.existsSync(indexDir)) return { count: 0, files: [] };

    const files = fs.readdirSync(indexDir).filter(f => f.endsWith('.json'));
    const info = files.map(f => {
        const stat = fs.statSync(path.join(indexDir, f));
        return `${f}: ${(stat.size / 1024).toFixed(1)}KB`;
    });
    return { count: files.length, files: info };
}

async function testAllEntities() {
    console.log('═'.repeat(70));
    console.log('🧪 COMPREHENSIVE SHARDING TEST - ALL ENTITIES');
    console.log('═'.repeat(70));
    console.log(`Target: ${ITEMS_PER_TYPE} items per type (enough to trigger 512KB split)\n`);

    shardedDataService.initAll();

    const results = {};

    for (const [type, generator] of Object.entries(generators)) {
        console.log(`\n📦 Testing ${type}...`);
        const manager = shardedDataService.getManager(type);

        const startTime = Date.now();
        let created = 0;

        for (let i = 1; i <= ITEMS_PER_TYPE; i++) {
            try {
                manager.create(generator(i));
                created++;
            } catch (e) {
                console.log(`   ❌ Error at ${i}: ${e.message}`);
                break;
            }
        }

        const time = ((Date.now() - startTime) / 1000).toFixed(2);
        const shardInfo = getShardInfo(type);

        console.log(`   ✅ Created: ${created} | Time: ${time}s | Shards: ${shardInfo.count}`);
        shardInfo.files.forEach(f => console.log(`      ${f}`));

        results[type] = { created, time, shards: shardInfo.count };
    }

    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(70));
    console.log(`${'Type'.padEnd(18)} | ${'Created'.padEnd(8)} | ${'Time'.padEnd(8)} | Shards`);
    console.log('─'.repeat(70));

    for (const [type, r] of Object.entries(results)) {
        console.log(`${type.padEnd(18)} | ${String(r.created).padEnd(8)} | ${r.time.padEnd(8)} | ${r.shards}`);
    }

    console.log('═'.repeat(70));
    console.log('✅ All entities tested!');
}

testAllEntities().catch(console.error);
