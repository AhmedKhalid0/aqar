/**
 * Site Object Definition
 * Central namespace for all site functionality
 */
if (typeof window.Site === 'undefined') {
    window.Site = {
        // Global state
        whatsapp: '',
        phone: '',

        // Branding (loaded from settings)
        branding: null,

        // Page loaders namespace (populated by pages/*.js)
        pages: {},

        // Will be populated by other modules
        // API functions from utils/api.js
        // Format functions from utils/format.js
        // Storage functions from utils/storage.js
        // Card creators from components/cards.js
        // UI helpers from components/ui.js
    };
}

// Language helper (using var to allow redeclaration)
if (typeof window.getCurrentLang !== 'function') {
    window.getCurrentLang = function () {
        return localStorage.getItem('lang') || 'ar';
    };
}
var getCurrentLang = window.getCurrentLang;

// Use var to allow redeclaration
var Site = window.Site;
