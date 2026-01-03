/**
 * Test Size-Based Sharding
 */
const { shardedDataService } = require('../lib/shardedFlatFileDB');
const fs = require('fs');
const path = require('path');

const BATCH_SIZE = 200;
const MAX_BATCHES = 10;
const INDEX_PATH = path.join(__dirname, '..', 'secure_data', 'units', 'index');

function getShardFiles() {
    return fs.readdirSync(INDEX_PATH).filter(f => f.endsWith('.json')).sort();
}

function formatSize(bytes) {
    return (bytes / 1024).toFixed(1) + ' KB';
}

async function testSizeSharding() {
    console.log('═'.repeat(60));
    console.log('🧪 SIZE-BASED SHARDING TEST');
    console.log('═'.repeat(60));
    console.log('Target: Split at 512KB per shard\n');

    shardedDataService.initAll();
    const manager = shardedDataService.getManager('units');

    console.log('Initial shards:', getShardFiles());

    for (let batch = 1; batch <= MAX_BATCHES; batch++) {
        const batchStart = Date.now();

        for (let i = 0; i < BATCH_SIZE; i++) {
            const num = (batch - 1) * BATCH_SIZE + i + 1;
            manager.create({
                title: { ar: `وحدة ${num}`, en: `Unit ${num}` },
                description: { ar: `وصف ${num}`, en: `Desc ${num}` },
                price: Math.floor(Math.random() * 5000000),
                area: Math.floor(Math.random() * 400) + 50,
                type: 'apartment',
                status: 'active'
            });
        }

        const shards = getShardFiles();
        const sizes = shards.map(f => {
            const stat = fs.statSync(path.join(INDEX_PATH, f));
            return `${f}: ${formatSize(stat.size)}`;
        });

        console.log(`Batch ${batch}: Created ${batch * BATCH_SIZE} units`);
        console.log(`  Shards (${shards.length}): ${sizes.join(' | ')}`);
        console.log(`  Time: ${((Date.now() - batchStart) / 1000).toFixed(2)}s`);
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📊 FINAL RESULTS');
    console.log('═'.repeat(60));

    const finalShards = getShardFiles();
    console.log(`Total shards: ${finalShards.length}`);

    finalShards.forEach(f => {
        const stat = fs.statSync(path.join(INDEX_PATH, f));
        console.log(`  ${f}: ${formatSize(stat.size)}`);
    });

    console.log('\n✅ Size-based sharding test completed!');
}

testSizeSharding().catch(console.error);
