#!/usr/bin/env node
/**
 * Generate Fake Data - توليد بيانات وهمية لاختبار النظام
 * 
 * الاستخدام:
 *   node scripts/generateFakeData.js [count]
 *   node scripts/generateFakeData.js 500
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { FlatFileManager } = require('../lib/flatFileDB');
const { staticGenerator } = require('../lib/staticGenerator');

// ==================== DATA TEMPLATES ====================

// الصور المتاحة
const AVAILABLE_IMAGES = [
    '/uploads/1766590847252-c1151886-0163-48e7-abe1-4dea0f2f3b68.jpg',
    '/uploads/1766591416272-7fe0dc19-e41e-4e0a-8f71-03f2430ee559.jpg',
    '/uploads/1766591419114-f09f133e-69aa-4e30-8fcd-8211d1567dd1.jpg',
    '/uploads/1766635934210-e6c031d1-fd60-4894-9a7d-083aa9b76af3.jpg',
    '/uploads/1766635937611-ba380479-d149-4335-a299-bb48282ccfd5.jpg',
    '/uploads/1766644120503-b8a5285f-a6a2-47a5-832e-6c2ea840abef.jpg',
    '/uploads/1766644120510-25bcff8c-5212-43a2-b5e2-12fc8a3cf794.jpg',
    '/uploads/1766644120512-c9feca98-1331-4f41-bf53-a3825cddbb50.jpg',
    '/uploads/1766644392681-f8b78712-22c1-4daf-b8c6-353bcb2651d1.jpg',
    '/uploads/1766644392682-47488809-ee00-4602-a91f-846ed94e7627.jpg',
    '/uploads/1766644392683-f80be205-732f-4692-b953-5db73e48a436.jpg',
    '/uploads/1766797503773-92c16a72-4bf7-4a70-88f6-21abc9415855.jpg',
    '/uploads/1766797522158-3deae7a4-55db-4429-a74d-f12ab9c2a324.jpg'
];

// المواقع
const LOCATIONS = [
    { ar: 'جولف بورتو مارينا', en: 'Golf Porto Marina', id: 'golf-porto-marina' },
    { ar: 'التجمع الخامس', en: 'Fifth Settlement', id: 'fifth-settlement' },
    { ar: 'الشيخ زايد', en: 'Sheikh Zayed', id: 'sheikh-zayed' },
    { ar: 'العاصمة الإدارية', en: 'New Capital', id: 'new-capital' },
    { ar: '6 أكتوبر', en: '6th of October', id: 'october-6' },
    { ar: 'مدينتي', en: 'Madinaty', id: 'madinaty' },
    { ar: 'الرحاب', en: 'Rehab City', id: 'rehab' },
    { ar: 'الساحل الشمالي', en: 'North Coast', id: 'north-coast' },
    { ar: 'العين السخنة', en: 'Ain Sokhna', id: 'ain-sokhna' },
    { ar: 'المعادي', en: 'Maadi', id: 'maadi' }
];

// أنواع الوحدات
const UNIT_TYPES = ['apartment', 'villa', 'duplex', 'penthouse', 'studio', 'chalet', 'townhouse', 'twin-house'];

// حالات الوحدات
const UNIT_STATUS = ['available', 'sold', 'reserved'];

// التشطيبات
const FINISHING = ['finished', 'semi-finished', 'core-shell'];

// المميزات
const FEATURES_AR = [
    'تشطيب سوبر لوكس', 'حمام سباحة خاص', 'حديقة خاصة', 'موقف سيارات',
    'أمن 24 ساعة', 'نادي رياضي', 'قريب من المواصلات', 'إطلالة بحرية',
    'تكييف مركزي', 'مصعد خاص', 'غرفة خادمة', 'تراس واسع'
];

const FEATURES_EN = [
    'Premium Finish', 'Private Pool', 'Private Garden', 'Parking',
    '24/7 Security', 'Gym', 'Near Transportation', 'Sea View',
    'Central AC', 'Private Elevator', 'Maid Room', 'Large Terrace'
];

// المطورين
const DEVELOPERS = [
    { ar: 'نيو سيتي', en: 'New City' },
    { ar: 'إعمار مصر', en: 'Emaar Misr' },
    { ar: 'طلعت مصطفى', en: 'Talaat Moustafa' },
    { ar: 'سوديك', en: 'SODIC' },
    { ar: 'بالم هيلز', en: 'Palm Hills' },
    { ar: 'ماونتن فيو', en: 'Mountain View' },
    { ar: 'هايد بارك', en: 'Hyde Park' },
    { ar: 'لافيستا', en: 'La Vista' }
];

// فئات الأخبار
const NEWS_CATEGORIES = ['projects', 'tips', 'market', 'events', 'company'];

// وسائل الراحة للمشاريع
const AMENITIES_AR = [
    'ملاعب جولف', 'سبا', 'مطاعم راقية', 'أمن 24 ساعة', 'حمامات سباحة',
    'نادي صحي', 'مسجد', 'مدارس دولية', 'مراكز تسوق', 'مناطق ترفيهية للأطفال',
    'مسارات للجري', 'حدائق طبيعية', 'كلوب هاوس', 'ملاعب تنس'
];

const AMENITIES_EN = [
    'Golf Courses', 'Spa', 'Fine Dining', '24/7 Security', 'Swimming Pools',
    'Health Club', 'Mosque', 'International Schools', 'Shopping Centers', 'Kids Play Areas',
    'Jogging Tracks', 'Landscaped Gardens', 'Club House', 'Tennis Courts'
];

// ==================== HELPER FUNCTIONS ====================

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomItems(arr, count) {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

function randomImages(count = 3) {
    return randomItems(AVAILABLE_IMAGES, count);
}

function randomDate(startYear = 2024) {
    const start = new Date(startYear, 0, 1);
    const end = new Date();
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

function generateSlug(text) {
    return text.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
}

// ==================== DATA GENERATORS ====================

function generateProject(index) {
    const location = randomItem(LOCATIONS);
    const developer = randomItem(DEVELOPERS);
    const totalUnits = randomInt(100, 2000);
    const minPrice = randomInt(1, 10) * 1000000;
    
    return {
        id: `project-${String(index).padStart(4, '0')}`,
        title: {
            ar: `مشروع ${developer.ar} - ${location.ar} ${index}`,
            en: `${developer.en} Project - ${location.en} ${index}`
        },
        description: {
            ar: `<p>مجتمع سكني متكامل في ${location.ar}، يجمع بين الفخامة والراحة مع تصاميم معمارية فريدة. يضم المشروع ${totalUnits} وحدة سكنية متنوعة.</p>`,
            en: `<p>An integrated residential community in ${location.en}, combining luxury and comfort with unique architectural designs. The project includes ${totalUnits} diverse residential units.</p>`
        },
        developer: developer,
        location: { ar: location.ar, en: location.en },
        locationId: location.id,
        totalUnits: totalUnits,
        availableUnits: randomInt(50, totalUnits),
        priceRange: {
            min: minPrice,
            max: minPrice + randomInt(5, 20) * 1000000
        },
        amenities: {
            ar: randomItems(AMENITIES_AR, randomInt(4, 8)),
            en: randomItems(AMENITIES_EN, randomInt(4, 8))
        },
        images: randomImages(randomInt(2, 4)),
        status: 'active',
        featured: Math.random() > 0.7,
        createdAt: randomDate(),
        createdBy: 'admin-001'
    };
}

function generateUnit(index, projectIds) {
    const location = randomItem(LOCATIONS);
    const type = randomItem(UNIT_TYPES);
    const area = randomInt(50, 500);
    const bedrooms = randomInt(1, 6);
    const price = randomInt(5, 100) * 100000;
    const projectId = randomItem(projectIds);
    
    const typeNames = {
        apartment: { ar: 'شقة', en: 'Apartment' },
        villa: { ar: 'فيلا', en: 'Villa' },
        duplex: { ar: 'دوبلكس', en: 'Duplex' },
        penthouse: { ar: 'بنتهاوس', en: 'Penthouse' },
        studio: { ar: 'استوديو', en: 'Studio' },
        chalet: { ar: 'شاليه', en: 'Chalet' },
        townhouse: { ar: 'تاون هاوس', en: 'Townhouse' },
        'twin-house': { ar: 'توين هاوس', en: 'Twin House' }
    };
    
    return {
        id: `unit-${String(index).padStart(6, '0')}`,
        title: {
            ar: `${typeNames[type].ar} ${area} متر - ${location.ar}`,
            en: `${typeNames[type].en} ${area} sqm - ${location.en}`
        },
        location: { ar: location.ar, en: location.en },
        locationId: location.id,
        description: {
            ar: `<p>${typeNames[type].ar} فاخرة بمساحة ${area} متر مربع في ${location.ar}. تتميز بتشطيبات عالية الجودة وموقع متميز.</p>`,
            en: `<p>Luxury ${typeNames[type].en.toLowerCase()} with ${area} sqm in ${location.en}. Features high-quality finishes and prime location.</p>`
        },
        price: price,
        area: area,
        bedrooms: bedrooms,
        bathrooms: randomInt(1, bedrooms + 1),
        type: type,
        status: 'active',
        unitStatus: randomItem(UNIT_STATUS),
        featured: Math.random() > 0.8,
        finishing: randomItem(FINISHING),
        paymentPlans: randomItems(['cash', '3-years', '6-years', '8-years', '10-years'], randomInt(1, 3)),
        features: {
            ar: randomItems(FEATURES_AR, randomInt(3, 6)),
            en: randomItems(FEATURES_EN, randomInt(3, 6))
        },
        images: randomImages(randomInt(1, 4)),
        buildingNumber: String(randomInt(1, 50)),
        floor: randomItem(['الأرضي', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس']),
        unitNumber: String(randomInt(100, 9999)),
        usableSpace: Math.round(area * 0.85),
        gardenShare: type === 'villa' || type === 'townhouse' ? randomInt(50, 200) : 0,
        view: randomItem(['garden', 'pool', 'street', 'landscape', 'sea', 'golf', '']),
        projectId: projectId,
        createdAt: randomDate(),
        createdBy: 'admin-001'
    };
}

function generateNews(index) {
    const category = randomItem(NEWS_CATEGORIES);
    const titles = {
        projects: [
            { ar: 'افتتاح مرحلة جديدة في مشروع', en: 'Opening of New Phase in Project' },
            { ar: 'إطلاق مشروع سكني جديد في', en: 'Launch of New Residential Project in' },
            { ar: 'تسليم وحدات المرحلة الأولى من', en: 'Delivery of Phase One Units in' }
        ],
        tips: [
            { ar: 'نصائح لشراء عقار استثماري ناجح', en: 'Tips for Buying a Successful Investment Property' },
            { ar: 'كيف تختار الوحدة المناسبة لك', en: 'How to Choose the Right Unit for You' },
            { ar: 'أهم العوامل عند شراء عقار', en: 'Key Factors When Buying Property' }
        ],
        market: [
            { ar: 'تحليل سوق العقارات المصري', en: 'Egyptian Real Estate Market Analysis' },
            { ar: 'توقعات أسعار العقارات لعام', en: 'Property Price Predictions for Year' },
            { ar: 'أفضل المناطق للاستثمار العقاري', en: 'Best Areas for Real Estate Investment' }
        ],
        events: [
            { ar: 'معرض العقارات السنوي', en: 'Annual Real Estate Exhibition' },
            { ar: 'فعالية حصرية للعملاء', en: 'Exclusive Client Event' },
            { ar: 'ورشة عمل الاستثمار العقاري', en: 'Real Estate Investment Workshop' }
        ],
        company: [
            { ar: 'نيو سيتي تحقق رقماً قياسياً في المبيعات', en: 'New City Achieves Record Sales' },
            { ar: 'توسعات جديدة لشركة نيو سيتي', en: 'New City Announces Expansion' },
            { ar: 'شراكة استراتيجية جديدة', en: 'New Strategic Partnership' }
        ]
    };
    
    const titleTemplate = randomItem(titles[category]);
    const location = randomItem(LOCATIONS);
    
    return {
        id: `news-${String(index).padStart(4, '0')}`,
        title: {
            ar: `${titleTemplate.ar} ${location.ar} ${index}`,
            en: `${titleTemplate.en} ${location.en} ${index}`
        },
        content: {
            ar: `<p>في خطوة جديدة تؤكد ريادة نيو سيتي في سوق العقارات المصري، أعلنت الشركة عن ${titleTemplate.ar}.</p><p>يأتي هذا في إطار استراتيجية الشركة للتوسع وتلبية احتياجات العملاء المتزايدة.</p><p>تتميز هذه الخطوة بعدة مزايا تشمل الموقع المتميز والتصاميم العصرية والأسعار التنافسية.</p>`,
            en: `<p>In a new step confirming New City's leadership in the Egyptian real estate market, the company announced ${titleTemplate.en}.</p><p>This comes as part of the company's strategy to expand and meet growing customer needs.</p><p>This step features several advantages including prime location, modern designs, and competitive prices.</p>`
        },
        excerpt: {
            ar: `أعلنت شركة نيو سيتي عن ${titleTemplate.ar} في إطار استراتيجية التوسع...`,
            en: `New City announced ${titleTemplate.en} as part of expansion strategy...`
        },
        image: randomItem(AVAILABLE_IMAGES),
        category: category,
        status: 'published',
        createdAt: randomDate(),
        createdBy: 'admin-001'
    };
}

// ==================== MAIN FUNCTION ====================

async function main() {
    const args = process.argv.slice(2);
    const count = parseInt(args[0]) || 100;
    
    console.log('\n' + '🎲'.repeat(30));
    console.log('     توليد بيانات وهمية للاختبار');
    console.log('🎲'.repeat(30));
    
    console.log(`\n📊 العدد المطلوب: ${count} لكل نوع`);
    
    // إنشاء المديرين
    const projectsManager = new FlatFileManager('projects');
    const unitsManager = new FlatFileManager('units');
    const newsManager = new FlatFileManager('news');
    
    // 1. توليد المشاريع
    console.log('\n🏗️  توليد المشاريع...');
    const projectIds = [];
    const projectCount = Math.ceil(count / 10); // 10% من العدد للمشاريع
    
    for (let i = 1; i <= projectCount; i++) {
        const project = generateProject(i);
        await projectsManager.create(project);
        projectIds.push(project.id);
        
        if (i % 10 === 0) {
            process.stdout.write(`\r   تم إنشاء ${i}/${projectCount} مشروع`);
        }
    }
    console.log(`\n   ✅ تم إنشاء ${projectCount} مشروع`);
    
    // 2. توليد الوحدات
    console.log('\n🏠 توليد الوحدات...');
    for (let i = 1; i <= count; i++) {
        const unit = generateUnit(i, projectIds);
        await unitsManager.create(unit);
        
        if (i % 50 === 0) {
            process.stdout.write(`\r   تم إنشاء ${i}/${count} وحدة`);
        }
    }
    console.log(`\n   ✅ تم إنشاء ${count} وحدة`);
    
    // 3. توليد الأخبار
    console.log('\n📰 توليد الأخبار...');
    const newsCount = Math.ceil(count / 5); // 20% من العدد للأخبار
    
    for (let i = 1; i <= newsCount; i++) {
        const news = generateNews(i);
        await newsManager.create(news);
        
        if (i % 20 === 0) {
            process.stdout.write(`\r   تم إنشاء ${i}/${newsCount} خبر`);
        }
    }
    console.log(`\n   ✅ تم إنشاء ${newsCount} خبر`);
    
    // 4. إعادة بناء الفهارس
    console.log('\n📇 إعادة بناء الفهارس...');
    await projectsManager.rebuildAllIndices();
    await unitsManager.rebuildAllIndices();
    await newsManager.rebuildAllIndices();
    console.log('   ✅ تم إعادة بناء الفهارس');
    
    // 5. توليد الصفحات الثابتة
    console.log('\n📄 توليد الصفحات الثابتة...');
    await staticGenerator.generateAll('projects');
    await staticGenerator.generateAll('units');
    await staticGenerator.generateAll('news');
    console.log('   ✅ تم توليد الصفحات الثابتة');
    
    // 6. عرض الإحصائيات
    console.log('\n' + '='.repeat(60));
    console.log('📊 ملخص التوليد:');
    console.log('='.repeat(60));
    console.log(`   🏗️  المشاريع: ${projectsManager.getStats().totalCount}`);
    console.log(`   🏠 الوحدات: ${unitsManager.getStats().totalCount}`);
    console.log(`   📰 الأخبار: ${newsManager.getStats().totalCount}`);
    console.log('='.repeat(60));
    
    console.log('\n✅ تم توليد البيانات بنجاح!\n');
}

// تشغيل
main().catch(console.error);
