// Internationalization (i18n) System
const translations = {
    ar: {
        // Navigation
        "nav.home": "الرئيسية",
        "nav.units": "الوحدات",
        "nav.projects": "المشاريع",
        "nav.news": "الأخبار",
        "nav.partners": "الشركاء",
        "nav.reviews": "آراء العملاء",
        "nav.team": "فريقنا",
        "nav.contact": "اتصل بنا",
        
        // Breadcrumbs
        "breadcrumb.home": "الرئيسية",
        "breadcrumb.units": "الوحدات",
        "breadcrumb.projects": "المشاريع",
        "breadcrumb.news": "الأخبار",
        "breadcrumb.team": "فريقنا",
        "breadcrumb.privacy": "سياسة الخصوصية",
        "breadcrumb.terms": "الشروط والأحكام",
        
        // Team Page
        "team.title": "فريقنا",
        
        // Privacy
        "privacy.title": "سياسة الخصوصية",
        
        // Hero
        "hero.title": "اعثر على <span>منزل أحلامك</span> معنا",
        "hero.subtitle": "نقدم لك أفضل الوحدات العقارية من كبرى شركات التطوير في مصر",
        "hero.search": "ابحث الآن",
        
        // Search
        "search.location": "الموقع",
        "search.allLocations": "جميع المواقع",
        "search.type": "نوع العقار",
        "search.allTypes": "جميع الأنواع",
        "search.apartment": "شقة",
        "search.villa": "فيلا",
        "search.duplex": "دوبلكس",
        "search.penthouse": "بنتهاوس",
        "search.priceRange": "نطاق السعر",
        "search.minPrice": "الحد الأدنى",
        "search.maxPrice": "الحد الأقصى",
        "search.bedrooms": "غرف النوم",
        "search.any": "أي",
        "search.button": "بحث",
        
        // Sections
        "section.featuredUnits": "وحدات مميزة",
        "section.featuredProjects": "مشاريع مميزة",
        "section.latestNews": "آخر الأخبار",
        "section.ourPartners": "شركاؤنا",
        "section.clientReviews": "آراء عملائنا",
        "section.viewAll": "عرض الكل",
        
        // Unit Card
        "unit.bedrooms": "غرف",
        "unit.bathrooms": "حمامات",
        "unit.area": "م²",
        "unit.details": "التفاصيل",
        "unit.addToWishlist": "إضافة للمفضلة",
        "unit.removeFromWishlist": "إزالة من المفضلة",
        
        // Filters
        "filter.title": "تصفية النتائج",
        "filter.location": "الموقع",
        "filter.priceFrom": "السعر من",
        "filter.priceTo": "السعر إلى",
        "filter.areaFrom": "المساحة من",
        "filter.areaTo": "المساحة إلى",
        "filter.reset": "إعادة تعيين",
        "filter.apply": "تطبيق",
        
        // Details
        "details.features": "المميزات",
        "details.description": "الوصف",
        "details.location": "الموقع",
        "details.price": "السعر",
        "details.area": "المساحة",
        "details.bedrooms": "غرف النوم",
        "details.bathrooms": "الحمامات",
        "details.developer": "المطور",
        "details.contactUs": "تواصل معنا",
        "details.whatsapp": "واتساب",
        "details.call": "اتصل بنا",
        "details.similar": "وحدات مشابهة",
        
        // Contact
        "contact.title": "اتصل بنا",
        "contact.subtitle": "نحن هنا لمساعدتك",
        "contact.name": "الاسم الكامل",
        "contact.email": "البريد الإلكتروني",
        "contact.phone": "رقم الهاتف",
        "contact.subject": "الموضوع",
        "contact.message": "الرسالة",
        "contact.captcha": "أجب على السؤال التالي",
        "contact.send": "إرسال الرسالة",
        "contact.sending": "جاري الإرسال...",
        "contact.success": "تم إرسال رسالتك بنجاح!",
        "contact.error": "حدث خطأ، حاول مرة أخرى",
        "contact.address": "التجمع الخامس، القاهرة الجديدة",
        "contact.hours": "السبت - الخميس: 9 ص - 6 م",
        
        // Reviews
        "reviews.title": "آراء العملاء",
        "reviews.subtitle": "ماذا يقول عملاؤنا عنا",
        "reviews.addReview": "أضف رأيك",
        "reviews.yourName": "اسمك",
        "reviews.yourRating": "تقييمك",
        "reviews.yourComment": "تعليقك",
        "reviews.submit": "إرسال التقييم",
        "reviews.pending": "شكراً! سيتم مراجعة تقييمك ونشره قريباً.",
        
        // Wishlist
        "wishlist.title": "قائمة المفضلة",
        "wishlist.empty": "لا توجد وحدات في المفضلة",
        "wishlist.emptyDesc": "قم بإضافة الوحدات التي تعجبك لحفظها هنا",
        "wishlist.browse": "تصفح الوحدات",
        
        // Footer
        "footer.about": "عن عقار",
        "footer.aboutText": "عقار هي منصتك العقارية الأولى في مصر. نقدم لك أفضل الوحدات السكنية والتجارية من كبرى شركات التطوير العقاري.",
        "footer.quickLinks": "روابط سريعة",
        "footer.areas": "المناطق",
        "footer.contactUs": "تواصل معنا",
        "footer.copyright": "© 2024 عقار. جميع الحقوق محفوظة.",
        "footer.privacy": "سياسة الخصوصية",
        "footer.terms": "الشروط والأحكام",
        
        // Areas
        "areas.fifthSettlement": "التجمع الخامس",
        "areas.sheikhZayed": "الشيخ زايد",
        "areas.newCapital": "العاصمة الإدارية",
        "areas.october": "6 أكتوبر",
        
        // Common
        "common.loading": "جاري التحميل...",
        "common.noResults": "لا توجد نتائج",
        "common.error": "حدث خطأ",
        "common.readMore": "اقرأ المزيد",
        "common.egp": "جنيه",
        "common.sqm": "م²",
        
        // Stats
        "stats.units": "وحدة متاحة",
        "stats.projects": "مشروع",
        "stats.years": "سنوات خبرة",
        "stats.clients": "عميل سعيد",
        
        // CTA
        "cta.title": "هل تبحث عن عقار مميز؟",
        "cta.subtitle": "تواصل معنا الآن واحصل على أفضل العروض",
        "cta.button": "تواصل معنا",
        
        // Filters
        "filter.project": "المشروع",
        "filter.allProjects": "جميع المشاريع",
        
        // Hero
        "hero.projects": "مشاريعنا",
        "hero.units": "الوحدات المتاحة",
        
        // About
        "about.welcome": "مرحباً بك في عقار",
        "about.contact": "تواصل معنا",
        "about.quality": "جودة البناء",
        "about.qualityDesc": "نستخدم أفضل المواد ونتبع أعلى معايير الجودة",
        "about.locations": "مواقع استراتيجية",
        "about.locationsDesc": "نختار أفضل المواقع لمشاريعنا",
        "about.design": "تصاميم عصرية",
        "about.designDesc": "تصاميم تجمع بين الجمال والوظيفية",
        "about.trust": "ثقة وأمان",
        "about.trustDesc": "سجل حافل بالمشاريع الناجحة",
        
        // Unit Details
        "details.buildingNumber": "رقم العمارة",
        "details.floor": "الدور",
        "details.unitNumber": "رقم الوحدة",
        "details.view": "الإطلالة",
        "details.gardenShare": "نسبة الحديقة",
        "details.usableSpace": "المساحة القابلة للاستخدام",
        "details.type": "النوع",
        "details.finishing": "التشطيب",
        "details.priceRange": "نطاق الأسعار",
        "details.totalUnits": "إجمالي الوحدات",
        "details.availableUnits": "وحدات متاحة",
        "details.facilities": "المرافق والخدمات",
        "details.projectUnits": "وحدات المشروع",
        
        // Partners
        "partners.title": "شركاؤنا",
        "partners.subtitle": "نفخر بشراكتنا مع أكبر شركات التطوير العقاري في مصر",
        "partners.successPartners": "شركاء النجاح",
        
        // Breadcrumb
        "breadcrumb.home": "الرئيسية",
        "breadcrumb.units": "الوحدات",
        "breadcrumb.projects": "المشاريع",
        "breadcrumb.partners": "الشركاء",
        "breadcrumb.news": "الأخبار",
        
        // Buttons
        "btn.whatsapp": "واتساب",
        "btn.call": "اتصل بنا",
        "btn.more": "المزيد",
        "btn.available": "متاحة",
        
        // Sort Options
        "sort.newest": "الأحدث",
        "sort.oldest": "الأقدم",
        "sort.priceLow": "السعر: الأقل",
        "sort.priceHigh": "السعر: الأعلى",
        "sort.areaSmall": "المساحة: الأصغر",
        "sort.areaLarge": "المساحة: الأكبر",
        
        // Units Page
        "units.title": "الوحدات",
        "units.count": "وحدة",
        "units.allLocations": "جميع المواقع",
        "units.allProjects": "جميع المشاريع",
        
        // Projects Page
        "projects.title": "المشاريع العقارية",
        "projects.allLocations": "جميع المواقع",
        
        // News Page
        "news.title": "الأخبار والمقالات",
        "news.allCategories": "جميع التصنيفات",
        "news.projectNews": "أخبار المشاريع",
        "news.investmentTips": "نصائح استثمارية",
        "news.marketNews": "أخبار السوق",
        
        // Reviews Page  
        "reviews.pageTitle": "آراء العملاء",
        
        // Contact Page
        "contact.sendMessage": "أرسل لنا رسالة",
        "contact.selectSubject": "اختر الموضوع",
        "contact.generalInquiry": "استفسار عام",
        "contact.unitInquiry": "استفسار عن وحدة",
        "contact.projectInquiry": "استفسار عن مشروع",
        "contact.partnership": "شراكة",
        "contact.complaint": "شكوى",
        "contact.other": "أخرى",
        "contact.answer": "الإجابة",
        
        // Comments
        "comments.title": "التعليقات",
        "comments.addComment": "أضف تعليقك",
        "comments.submit": "إرسال التعليق",
        "comments.name": "اسمك",
        "comments.email": "بريدك الإلكتروني",
        "comments.comment": "تعليقك",
        "comments.noComments": "لا توجد تعليقات بعد",
        
        // Empty States
        "empty.noUnits": "لا توجد وحدات مطابقة للبحث",
        "empty.noProjects": "لا توجد مشاريع مطابقة",
        "empty.noNews": "لا توجد أخبار",
        
        // Footer
        "footer.address": "العنوان",
        "footer.phone": "الهاتف",
        "footer.email": "البريد الإلكتروني",
        "footer.workingHours": "ساعات العمل",
        
        // Sort
        "sort.mostUnits": "الأكثر وحدات"
    },
    
    en: {
        // Navigation
        "nav.home": "Home",
        "nav.units": "Units",
        "nav.projects": "Projects",
        "nav.news": "News",
        "nav.partners": "Partners",
        "nav.reviews": "Reviews",
        "nav.team": "Our Team",
        "nav.contact": "Contact",
        
        // Breadcrumbs
        "breadcrumb.home": "Home",
        "breadcrumb.units": "Units",
        "breadcrumb.projects": "Projects",
        "breadcrumb.news": "News",
        "breadcrumb.team": "Our Team",
        "breadcrumb.privacy": "Privacy Policy",
        "breadcrumb.terms": "Terms & Conditions",
        
        // Team Page
        "team.title": "Our Team",
        
        // Privacy
        "privacy.title": "Privacy Policy",
        
        // Hero
        "hero.title": "Find Your <span>Dream Home</span> With Us",
        "hero.subtitle": "We offer you the best real estate units from major development companies in Egypt",
        "hero.search": "Search Now",
        
        // Search
        "search.location": "Location",
        "search.allLocations": "All Locations",
        "search.type": "Property Type",
        "search.allTypes": "All Types",
        "search.apartment": "Apartment",
        "search.villa": "Villa",
        "search.duplex": "Duplex",
        "search.penthouse": "Penthouse",
        "search.priceRange": "Price Range",
        "search.minPrice": "Min Price",
        "search.maxPrice": "Max Price",
        "search.bedrooms": "Bedrooms",
        "search.any": "Any",
        "search.button": "Search",
        
        // Sections
        "section.featuredUnits": "Featured Units",
        "section.featuredProjects": "Featured Projects",
        "section.latestNews": "Latest News",
        "section.ourPartners": "Our Partners",
        "section.clientReviews": "Client Reviews",
        "section.viewAll": "View All",
        
        // Unit Card
        "unit.bedrooms": "Beds",
        "unit.bathrooms": "Baths",
        "unit.area": "sqm",
        "unit.details": "Details",
        "unit.addToWishlist": "Add to Wishlist",
        "unit.removeFromWishlist": "Remove from Wishlist",
        
        // Filters
        "filter.title": "Filter Results",
        "filter.location": "Location",
        "filter.priceFrom": "Price From",
        "filter.priceTo": "Price To",
        "filter.areaFrom": "Area From",
        "filter.areaTo": "Area To",
        "filter.reset": "Reset",
        "filter.apply": "Apply",
        
        // Details
        "details.features": "Features",
        "details.description": "Description",
        "details.location": "Location",
        "details.price": "Price",
        "details.area": "Area",
        "details.bedrooms": "Bedrooms",
        "details.bathrooms": "Bathrooms",
        "details.developer": "Developer",
        "details.contactUs": "Contact Us",
        "details.whatsapp": "WhatsApp",
        "details.call": "Call Us",
        "details.similar": "Similar Units",
        
        // Contact
        "contact.title": "Contact Us",
        "contact.subtitle": "We're here to help",
        "contact.name": "Full Name",
        "contact.email": "Email Address",
        "contact.phone": "Phone Number",
        "contact.subject": "Subject",
        "contact.message": "Message",
        "contact.captcha": "Answer the following question",
        "contact.send": "Send Message",
        "contact.sending": "Sending...",
        "contact.success": "Your message has been sent successfully!",
        "contact.error": "An error occurred, please try again",
        "contact.address": "Fifth Settlement, New Cairo",
        "contact.hours": "Sat - Thu: 9 AM - 6 PM",
        
        // Reviews
        "reviews.title": "Customer Reviews",
        "reviews.subtitle": "What our customers say about us",
        "reviews.addReview": "Add Your Review",
        "reviews.yourName": "Your Name",
        "reviews.yourRating": "Your Rating",
        "reviews.yourComment": "Your Comment",
        "reviews.submit": "Submit Review",
        "reviews.pending": "Thank you! Your review will be reviewed and published soon.",
        
        // Wishlist
        "wishlist.title": "Wishlist",
        "wishlist.empty": "No units in wishlist",
        "wishlist.emptyDesc": "Add units you like to save them here",
        "wishlist.browse": "Browse Units",
        
        // Footer
        "footer.about": "About Aqar",
        "footer.aboutText": "Aqar is your premier real estate platform in Egypt. We offer you the best residential and commercial units from major real estate developers.",
        "footer.quickLinks": "Quick Links",
        "footer.areas": "Areas",
        "footer.contactUs": "Contact Us",
        "footer.copyright": "© 2024 Aqar. All rights reserved.",
        "footer.privacy": "Privacy Policy",
        "footer.terms": "Terms & Conditions",
        
        // Areas
        "areas.fifthSettlement": "Fifth Settlement",
        "areas.sheikhZayed": "Sheikh Zayed",
        "areas.newCapital": "New Capital",
        "areas.october": "6th of October",
        
        // Common
        "common.loading": "Loading...",
        "common.noResults": "No results found",
        "common.error": "An error occurred",
        "common.readMore": "Read More",
        "common.egp": "EGP",
        "common.sqm": "sqm",
        
        // Stats
        "stats.units": "Available Units",
        "stats.projects": "Projects",
        "stats.years": "Years Experience",
        "stats.clients": "Happy Clients",
        
        // CTA
        "cta.title": "Looking for a premium property?",
        "cta.subtitle": "Contact us now and get the best offers",
        "cta.button": "Contact Us",
        
        // Filters
        "filter.project": "Project",
        "filter.allProjects": "All Projects",
        
        // Hero
        "hero.projects": "Our Projects",
        "hero.units": "Available Units",
        
        // About
        "about.welcome": "Welcome to Aqar",
        "about.contact": "Contact Us",
        "about.quality": "Build Quality",
        "about.qualityDesc": "We use the best materials and follow the highest quality standards",
        "about.locations": "Strategic Locations",
        "about.locationsDesc": "We choose the best locations for our projects",
        "about.design": "Modern Designs",
        "about.designDesc": "Designs that combine beauty and functionality",
        "about.trust": "Trust & Security",
        "about.trustDesc": "A proven track record of successful projects",
        
        // Unit Details
        "details.buildingNumber": "Building Number",
        "details.floor": "Floor",
        "details.unitNumber": "Unit Number",
        "details.view": "View",
        "details.gardenShare": "Garden Share",
        "details.usableSpace": "Usable Space",
        "details.type": "Type",
        "details.finishing": "Finishing",
        "details.priceRange": "Price Range",
        "details.totalUnits": "Total Units",
        "details.availableUnits": "Available Units",
        "details.facilities": "Facilities & Services",
        "details.projectUnits": "Project Units",
        
        // Partners
        "partners.title": "Our Partners",
        "partners.subtitle": "We are proud to partner with the largest real estate development companies in Egypt",
        "partners.successPartners": "Success Partners",
        
        // Breadcrumb
        "breadcrumb.home": "Home",
        "breadcrumb.units": "Units",
        "breadcrumb.projects": "Projects",
        "breadcrumb.partners": "Partners",
        "breadcrumb.news": "News",
        
        // Buttons
        "btn.whatsapp": "WhatsApp",
        "btn.call": "Call Us",
        "btn.more": "More",
        "btn.available": "Available",
        
        // Sort Options
        "sort.newest": "Newest",
        "sort.oldest": "Oldest",
        "sort.priceLow": "Price: Low to High",
        "sort.priceHigh": "Price: High to Low",
        "sort.areaSmall": "Area: Smallest",
        "sort.areaLarge": "Area: Largest",
        
        // Units Page
        "units.title": "Units",
        "units.count": "Units",
        "units.allLocations": "All Locations",
        "units.allProjects": "All Projects",
        
        // Projects Page
        "projects.title": "Real Estate Projects",
        "projects.allLocations": "All Locations",
        
        // News Page
        "news.title": "News & Articles",
        "news.allCategories": "All Categories",
        "news.projectNews": "Project News",
        "news.investmentTips": "Investment Tips",
        "news.marketNews": "Market News",
        
        // Reviews Page
        "reviews.pageTitle": "Customer Reviews",
        
        // Contact Page
        "contact.sendMessage": "Send us a message",
        "contact.selectSubject": "Select Subject",
        "contact.generalInquiry": "General Inquiry",
        "contact.unitInquiry": "Unit Inquiry",
        "contact.projectInquiry": "Project Inquiry",
        "contact.partnership": "Partnership",
        "contact.complaint": "Complaint",
        "contact.other": "Other",
        "contact.answer": "Answer",
        
        // Comments
        "comments.title": "Comments",
        "comments.addComment": "Add Your Comment",
        "comments.submit": "Submit Comment",
        "comments.name": "Your Name",
        "comments.email": "Your Email",
        "comments.comment": "Your Comment",
        "comments.noComments": "No comments yet",
        
        // Empty States
        "empty.noUnits": "No units match your search",
        "empty.noProjects": "No matching projects",
        "empty.noNews": "No news available",
        
        // Footer
        "footer.address": "Address",
        "footer.phone": "Phone",
        "footer.email": "Email",
        "footer.workingHours": "Working Hours",
        
        // Sort
        "sort.mostUnits": "Most Units"
    }
};

// Get current language
function getCurrentLang() {
    return localStorage.getItem('lang') || 'ar';
}

// Set language
function setLanguage(lang) {
    localStorage.setItem('lang', lang);
    localStorage.setItem('aqar_lang', lang);
    // Reload page to apply language changes to dynamic content
    window.location.reload();
}

// Apply language to page
function applyLanguage(lang) {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
    document.body.setAttribute('dir', dir);
    
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = translations[lang][key];
            } else {
                el.innerHTML = translations[lang][key];
            }
        }
    });
    
    // Update current lang display
    const currentLangEl = document.getElementById('currentLang');
    if (currentLangEl) {
        currentLangEl.textContent = lang === 'ar' ? 'العربية' : 'English';
    }
    
    // Trigger custom event for dynamic content
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
}

// Translate a single key
function t(key) {
    const lang = getCurrentLang();
    return translations[lang][key] || key;
}

// Get localized content from object
function getLocalized(obj, field) {
    const lang = getCurrentLang();
    if (obj && obj[field]) {
        return obj[field][lang] || obj[field]['ar'] || obj[field]['en'] || '';
    }
    return '';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const lang = getCurrentLang();
    applyLanguage(lang);
});
