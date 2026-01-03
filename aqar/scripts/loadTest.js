/**
 * Load Test Script - Sharded Flat-File System
 * اختبار الحمل لنظام الملفات المسطحة المجزأة
 * 
 * Creates 100 items of each type using APIs
 * 
 * Usage: node scripts/loadTest.js
 */

const https = require('https');

const BASE_URL = 'https://aqardevelopment.net';
const ITEMS_PER_TYPE = 100;

// Admin credentials (get token first)
let AUTH_TOKEN = null;

// Random image URLs
const RANDOM_IMAGES = [
    'https://picsum.photos/800/600',
    'https://picsum.photos/1200/800',
    'https://picsum.photos/1000/700',
    'https://picsum.photos/900/600',
    'https://picsum.photos/1100/800'
];

// Random Arabic/English text
const arabicTitles = ['شقة فاخرة', 'فيلا راقية', 'مكتب تجاري', 'محل للبيع', 'استوديو مميز', 'بنتهاوس فخم', 'دوبلكس عصري', 'روف مطل'];
const englishTitles = ['Luxury Apartment', 'Premium Villa', 'Commercial Office', 'Shop for Sale', 'Special Studio', 'Luxury Penthouse', 'Modern Duplex', 'Roof with View'];
const arabicNames = ['أحمد محمد', 'سارة علي', 'محمد خالد', 'فاطمة حسن', 'عمر يوسف', 'نور الدين', 'ليلى أحمد', 'كريم سعيد'];
const englishNames = ['Ahmed Mohamed', 'Sara Ali', 'Mohamed Khaled', 'Fatima Hassan', 'Omar Youssef', 'Nour Eldin', 'Layla Ahmed', 'Karim Saeed'];

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeRequest(method, path, data = null, useAuth = false) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || 3000,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (useAuth && AUTH_TOKEN) {
            options.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
        }

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function login() {
    console.log('🔐 Logging in...');
    const result = await makeRequest('POST', '/api/auth/login', {
        username: 'admin',
        password: 'admin123'
    });

    if (result.status === 200 && result.data.token) {
        AUTH_TOKEN = result.data.token;
        console.log('✅ Login successful');
        return true;
    } else {
        console.error('❌ Login failed:', result.data);
        return false;
    }
}

// Generate test data functions
function generateUnit(i) {
    return {
        title: {
            ar: `${randomItem(arabicTitles)} #${i}`,
            en: `${randomItem(englishTitles)} #${i}`
        },
        description: {
            ar: `وصف تفصيلي للوحدة رقم ${i}. تتميز بموقع استراتيجي وتشطيبات فاخرة.`,
            en: `Detailed description for unit #${i}. Features strategic location and luxury finishes.`
        },
        price: randomInt(500000, 5000000),
        area: randomInt(50, 500),
        bedrooms: randomInt(1, 5),
        bathrooms: randomInt(1, 4),
        type: ['apartment', 'villa', 'office', 'shop', 'duplex'][randomInt(0, 4)],
        status: 'active',
        unitStatus: 'available',
        featured: i % 10 === 0,
        images: [randomItem(RANDOM_IMAGES), randomItem(RANDOM_IMAGES)]
    };
}

function generateProject(i) {
    return {
        title: {
            ar: `مشروع ${randomItem(arabicTitles)} ${i}`,
            en: `Project ${randomItem(englishTitles)} ${i}`
        },
        description: {
            ar: `مشروع سكني متكامل يضم ${randomInt(50, 500)} وحدة.`,
            en: `Integrated residential project with ${randomInt(50, 500)} units.`
        },
        status: 'active',
        featured: i % 5 === 0,
        images: [randomItem(RANDOM_IMAGES)]
    };
}

function generateNews(i) {
    return {
        title: {
            ar: `خبر عقاري هام #${i}`,
            en: `Important Real Estate News #${i}`
        },
        content: {
            ar: `<p>محتوى الخبر رقم ${i}. أخبار عقارية مهمة عن السوق العقاري.</p>`,
            en: `<p>News content #${i}. Important real estate news about the market.</p>`
        },
        status: 'published',
        category: ['market', 'projects', 'tips', 'investment'][randomInt(0, 3)],
        image: randomItem(RANDOM_IMAGES)
    };
}

function generateComment(i) {
    return {
        content: `تعليق رقم ${i} - هذا تعليق تجريبي للاختبار. Comment #${i} - This is a test comment.`,
        userName: randomItem(arabicNames),
        userEmail: `user${i}@test.com`,
        unitId: `unit-${randomInt(1, 50)}`,
        status: 'pending'
    };
}

function generateReview(i) {
    return {
        content: `مراجعة رقم ${i} - تجربة ممتازة مع الشركة. Review #${i} - Excellent experience with the company.`,
        userName: randomItem(englishNames),
        userEmail: `reviewer${i}@test.com`,
        rating: randomInt(3, 5),
        projectId: `project-${randomInt(1, 20)}`,
        status: 'pending'
    };
}

function generateMessage(i) {
    return {
        name: randomItem(arabicNames),
        email: `sender${i}@test.com`,
        phone: `010${randomInt(10000000, 99999999)}`,
        subject: `استفسار رقم ${i}`,
        message: `رسالة للاستفسار عن الوحدات المتاحة. Message #${i} inquiring about available units.`,
        isRead: false,
        status: 'new'
    };
}

function generateVisitor(i) {
    return {
        ip: `192.168.${randomInt(1, 255)}.${randomInt(1, 255)}`,
        userAgent: `Mozilla/5.0 (Test Browser ${i})`,
        page: ['/', '/units', '/projects', '/contact', '/about'][randomInt(0, 4)],
        referrer: ['google.com', 'facebook.com', 'direct', 'instagram.com'][randomInt(0, 3)],
        date: new Date().toISOString().split('T')[0]
    };
}

function generateLog(i) {
    return {
        userId: 'admin',
        username: 'admin',
        action: ['LOGIN', 'CREATE_UNIT', 'UPDATE_PROJECT', 'DELETE_NEWS', 'VIEW_MESSAGES'][randomInt(0, 4)],
        details: `Activity log entry #${i}`,
        ip: `192.168.1.${randomInt(1, 255)}`,
        date: new Date().toISOString().split('T')[0]
    };
}

// Create items using APIs
async function createItems(type, generator, endpoint, count, useAuth = true) {
    console.log(`\n📦 Creating ${count} ${type}...`);
    let success = 0;
    let failed = 0;

    for (let i = 1; i <= count; i++) {
        try {
            const data = generator(i);
            const result = await makeRequest('POST', endpoint, data, useAuth);

            if (result.status === 200 || result.status === 201) {
                success++;
            } else {
                failed++;
                if (failed <= 3) {
                    console.log(`   ⚠️ Failed ${type} #${i}:`, result.status, result.data?.error || '');
                }
            }

            // Progress
            if (i % 25 === 0) {
                console.log(`   Progress: ${i}/${count}`);
            }
        } catch (e) {
            failed++;
            if (failed <= 3) {
                console.log(`   ❌ Error ${type} #${i}:`, e.message);
            }
        }
    }

    console.log(`   ✅ ${type}: ${success} created, ${failed} failed`);
    return { success, failed };
}

// Main test function
async function runLoadTest() {
    console.log('═'.repeat(60));
    console.log('🔬 SHARDED FLAT-FILE LOAD TEST');
    console.log('═'.repeat(60));
    console.log(`Target: ${ITEMS_PER_TYPE} items per type`);
    console.log();

    const startTime = Date.now();

    // Login first
    const loggedIn = await login();
    if (!loggedIn) {
        console.error('Cannot proceed without authentication');
        return;
    }

    const results = {};

    // Create items for each type
    results.units = await createItems('units', generateUnit, '/api/admin/units', ITEMS_PER_TYPE);
    results.projects = await createItems('projects', generateProject, '/api/admin/projects', ITEMS_PER_TYPE);
    results.news = await createItems('news', generateNews, '/api/admin/news', ITEMS_PER_TYPE);

    // Public endpoints (no auth needed)
    results.comments = await createItems('comments', generateComment, '/api/comments', ITEMS_PER_TYPE, false);
    results.reviews = await createItems('reviews', generateReview, '/api/reviews', ITEMS_PER_TYPE, false);
    results.messages = await createItems('messages', generateMessage, '/api/messages', ITEMS_PER_TYPE, false);

    // These would need special handling - create via sharded service directly
    // For now, skip visitors and logs as they are usually auto-generated
    console.log('\n📊 Visitors and Logs are auto-generated by the system');

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 LOAD TEST RESULTS');
    console.log('═'.repeat(60));

    let totalSuccess = 0;
    let totalFailed = 0;

    for (const [type, result] of Object.entries(results)) {
        console.log(`  ${type.padEnd(12)}: ${result.success} ✅ | ${result.failed} ❌`);
        totalSuccess += result.success;
        totalFailed += result.failed;
    }

    console.log('─'.repeat(60));
    console.log(`  TOTAL      : ${totalSuccess} ✅ | ${totalFailed} ❌`);
    console.log(`  TIME       : ${totalTime}s`);
    console.log('═'.repeat(60));

    // Verify sharded stats
    console.log('\n📁 Checking Sharded Stats...');
    const statsResult = await makeRequest('GET', '/api/admin/sharded-stats', null, true);
    if (statsResult.status === 200) {
        console.log('Sharded Database Stats:');
        for (const [type, stat] of Object.entries(statsResult.data)) {
            console.log(`  ${type.padEnd(15)}: ${stat.totalCount} records, ${stat.shardCount} shards`);
        }
    }
}

// Run the test
runLoadTest().catch(console.error);
