/**
 * Migration Script: Convert JSON arrays to Sharded Flat-File System
 * نقل البيانات من ملفات JSON إلى نظام الملفات المسطحة
 * 
 * Usage: node scripts/migrateToShardedFlatFile.js
 */

const fs = require('fs');
const path = require('path');
const { shardedDataService } = require('../lib/shardedFlatFileDB');

const DATA_DIR = path.join(__dirname, '..', 'secure_data');

// Files to migrate
const MIGRATIONS = [
    { type: 'comments', file: 'comments.json' },
    { type: 'reviews', file: 'reviews.json' },
    { type: 'messages', file: 'messages.json' },
    { type: 'visitors', file: 'visitors.json' },
    { type: 'logs', file: 'logs.json' }
];

/**
 * Migrate a single entity type
 */
async function migrateType(type, filename) {
    const filePath = path.join(DATA_DIR, filename);

    console.log(`\n[Migration] Starting ${type}...`);

    // Check if source file exists
    if (!fs.existsSync(filePath)) {
        console.log(`[Migration] ${filename} not found, skipping...`);
        return { type, migrated: 0, skipped: true };
    }

    // Load existing data
    let data;
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        data = JSON.parse(content);
    } catch (e) {
        console.error(`[Migration] Error reading ${filename}:`, e.message);
        return { type, migrated: 0, error: e.message };
    }

    if (!Array.isArray(data)) {
        console.log(`[Migration] ${filename} is not an array, skipping...`);
        return { type, migrated: 0, skipped: true };
    }

    console.log(`[Migration] Found ${data.length} records in ${filename}`);

    // Get manager
    const manager = shardedDataService.getManager(type);
    let migrated = 0;

    // Migrate each record
    for (const item of data) {
        try {
            // Check if already exists
            if (item.id && manager.read(item.id)) {
                continue; // Skip existing
            }

            // Create in new system
            manager.create(item);
            migrated++;

            if (migrated % 100 === 0) {
                console.log(`[Migration] ${type}: ${migrated} migrated...`);
            }
        } catch (e) {
            console.error(`[Migration] Error migrating ${type} item:`, e.message);
        }
    }

    console.log(`[Migration] ${type}: ${migrated} records migrated successfully`);

    // Backup original file
    const backupPath = path.join(DATA_DIR, `${filename}.backup`);
    if (migrated > 0 && !fs.existsSync(backupPath)) {
        fs.copyFileSync(filePath, backupPath);
        console.log(`[Migration] Created backup: ${backupPath}`);
    }

    return { type, migrated, total: data.length };
}

/**
 * Rebuild indexes for existing flat-file entities (units, projects, news)
 */
async function rebuildExistingIndices() {
    console.log('\n[Migration] Rebuilding indexes for existing entities...');

    const types = ['units', 'projects', 'news'];
    const results = {};

    for (const type of types) {
        const manager = shardedDataService.getManager(type);
        results[type] = manager.rebuildAllIndices();
    }

    return results;
}

/**
 * Main migration function
 */
async function runMigration() {
    console.log('='.repeat(60));
    console.log('Sharded Flat-File Migration');
    console.log('='.repeat(60));

    const startTime = Date.now();
    const results = [];

    // Initialize service
    shardedDataService.initAll();

    // Rebuild indexes for existing entities
    const rebuildResults = await rebuildExistingIndices();
    console.log('\n[Migration] Existing entities indexed:', rebuildResults);

    // Migrate new entities
    for (const { type, file } of MIGRATIONS) {
        const result = await migrateType(type, file);
        results.push(result);
    }

    // Summary
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));

    for (const result of results) {
        if (result.skipped) {
            console.log(`  ${result.type}: Skipped`);
        } else if (result.error) {
            console.log(`  ${result.type}: Error - ${result.error}`);
        } else {
            console.log(`  ${result.type}: ${result.migrated}/${result.total} migrated`);
        }
    }

    console.log(`\nTotal time: ${totalTime}s`);
    console.log('='.repeat(60));

    // Get final stats
    console.log('\nFinal Statistics:');
    const stats = shardedDataService.getAllStats();
    for (const [type, stat] of Object.entries(stats)) {
        console.log(`  ${type}: ${stat.totalCount} records, ${stat.shardCount} shards`);
    }
}

// Run if called directly
if (require.main === module) {
    runMigration().catch(console.error);
}

module.exports = { runMigration, migrateType };
