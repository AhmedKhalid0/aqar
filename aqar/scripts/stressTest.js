/**
 * Stress Test - Generate units until index reaches target size
 */
const { shardedDataService } = require('../lib/shardedFlatFileDB');
const fs = require('fs');
const path = require('path');

const TARGET_SIZE_MB = 5;
const BATCH_SIZE = 500;
const INDEX_PATH = path.join(__dirname, '..', 'secure_data', 'units', 'index');

function getIndexSize() {
    const files = fs.readdirSync(INDEX_PATH);
    let totalSize = 0;
    files.forEach(f => {
        const stat = fs.statSync(path.join(INDEX_PATH, f));
        totalSize += stat.size;
    });
    return totalSize;
}

function formatSize(bytes) {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

async function stressTest() {
    console.log('═'.repeat(60));
    console.log('🔥 STRESS TEST - Target:', TARGET_SIZE_MB, 'MB Index');
    console.log('═'.repeat(60));

    shardedDataService.initAll();
    const manager = shardedDataService.getManager('units');

    let totalCreated = 0;
    let currentSize = getIndexSize();
    const targetSize = TARGET_SIZE_MB * 1024 * 1024;

    console.log(`Starting size: ${formatSize(currentSize)}`);
    console.log(`Target: ${TARGET_SIZE_MB} MB\n`);

    while (currentSize < targetSize) {
        const batchStart = Date.now();

        for (let i = 0; i < BATCH_SIZE; i++) {
            const num = totalCreated + i + 1;
            manager.create({
                title: { ar: `وحدة اختبار ${num}`, en: `Test Unit ${num}` },
                description: { ar: `وصف الوحدة ${num}`, en: `Unit description ${num}` },
                price: Math.floor(Math.random() * 5000000) + 500000,
                area: Math.floor(Math.random() * 400) + 50,
                bedrooms: Math.floor(Math.random() * 5) + 1,
                type: 'apartment',
                status: 'active',
                unitStatus: 'available'
            });
        }

        totalCreated += BATCH_SIZE;
        currentSize = getIndexSize();
        const batchTime = ((Date.now() - batchStart) / 1000).toFixed(2);

        console.log(`Created: ${totalCreated} | Size: ${formatSize(currentSize)} | Batch time: ${batchTime}s`);

        if (totalCreated >= 50000) {
            console.log('Safety limit reached (50000 units)');
            break;
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 RESULTS');
    console.log('═'.repeat(60));
    console.log(`Total units created: ${totalCreated}`);
    console.log(`Final index size: ${formatSize(currentSize)}`);
    console.log(`Stats:`, manager.getStats());
    console.log('═'.repeat(60));
}

stressTest().catch(console.error);
