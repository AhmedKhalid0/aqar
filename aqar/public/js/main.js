/**
 * Main Application Entry Point
 * ========================================
 * This file serves as the application router and initializer.
 * All functionality is now modularized in separate files.
 * 
 * Module Load Order:
 * 1. core/config.js    - Configuration constants
 * 2. core/site.js      - Site object definition
 * 3. utils/api.js      - API communication
 * 4. utils/format.js   - Formatting helpers
 * 5. utils/storage.js  - Storage (wishlist)
 * 6. components/cards.js - Card components
 * 7. components/ui.js  - UI helpers
 * 8. pages/*.js        - Page loaders
 * 9. i18n.js           - Internationalization
 * 10. main.js (this)   - Router & Init
 */

// ========================================
// PAGE ROUTER - Auto-detects current page
// ========================================
Site.initPageRouter = function () {
    const path = window.location.pathname.toLowerCase();

    // Route to appropriate page loader
    if (path === '/' || path === '/index.html' || path.endsWith('/index.html')) {
        Site.pages.home();
    } else if (path.includes('units.html') && !path.includes('unit-details')) {
        Site.pages.units();
    } else if (path.includes('projects.html') && !path.includes('project-details')) {
        Site.pages.projects();
    } else if (path.includes('news.html') && !path.includes('news-details')) {
        Site.pages.news();
    } else if (path.includes('contact.html')) {
        Site.pages.contact();
    } else if (path.includes('team.html')) {
        Site.pages.team();
    } else if (path.includes('partners.html')) {
        Site.pages.partners();
    } else if (path.includes('reviews.html')) {
        Site.pages.reviews();
    } else if (path.includes('wishlist.html')) {
        Site.pages.wishlist();
    } else if (path.includes('privacy.html')) {
        Site.pages.privacy();
    } else if (path.includes('terms.html')) {
        Site.pages.terms();
    } else if (path.includes('unit-details.html')) {
        Site.pages.unitDetails();
    } else if (path.includes('project-details.html')) {
        Site.pages.projectDetails();
    } else if (path.includes('news-details.html')) {
        Site.pages.newsDetails();
    }
};

// ========================================
// INITIALIZATION
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    // Load header and footer components
    await Promise.all([
        Site.loadComponent('global-header', '/components/header.html'),
        Site.loadComponent('global-footer', '/components/footer.html')
    ]);

    // Initialize navbar scroll effect
    Site.initNavbarScroll();

    // Load global settings (phone, whatsapp, branding)
    try {
        const settings = await Site.fetchAPI('/api/settings');
        if (settings.contact) {
            Site.whatsapp = settings.contact.whatsapp || Config.DEFAULT_WHATSAPP;
            Site.phone = settings.contact.phone || Config.DEFAULT_PHONE;
        }

        // Load branding (logo, company name)
        if (settings.branding) {
            Site.branding = settings.branding;
            const lang = getCurrentLang();

            // Update logo - ALWAYS SHOW LOGO (independent of showCompanyName)
            const logoElements = document.querySelectorAll('.site-logo');
            logoElements.forEach(logo => {
                // Get language-specific logo or fallback to main logo
                let logoUrl = lang === 'ar'
                    ? (settings.branding.logoAr || settings.branding.logo)
                    : (settings.branding.logoEn || settings.branding.logo);

                // If language logo is SVG but main logo is PNG/JPG, prefer main logo
                // (some browsers have issues rendering SVG in img tags)
                const langLogo = lang === 'ar' ? settings.branding.logoAr : settings.branding.logoEn;
                const mainLogo = settings.branding.logo;
                if (langLogo && langLogo.toLowerCase().endsWith('.svg') &&
                    mainLogo && !mainLogo.toLowerCase().endsWith('.svg')) {
                    logoUrl = mainLogo;
                }

                if (logoUrl) {
                    logo.src = logoUrl;
                    logo.style.display = 'inline-block';
                }
            });

            // Update company name - ONLY if showCompanyName is true
            const nameElements = document.querySelectorAll('.company-name');
            nameElements.forEach(el => {
                if (settings.branding.showCompanyName) {
                    const name = settings.branding.companyName?.[lang] || settings.branding.companyName?.ar || '';
                    if (name) {
                        el.textContent = name;
                        el.style.display = 'inline';
                    }
                } else {
                    // Hide company name if showCompanyName is false
                    el.style.display = 'none';
                }
            });
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }

    // Update wishlist count on all pages
    Site.updateWishlistCount();

    // Route to appropriate page
    Site.initPageRouter();
});
