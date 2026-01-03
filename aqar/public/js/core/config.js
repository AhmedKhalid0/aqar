/**
 * Application Configuration
 * Contains all constants and configuration values
 */
if (typeof window.Config === 'undefined') {
    window.Config = {
        // API Configuration
        API_BASE: '',

        // Pagination
        ITEMS_PER_PAGE: 12,

        // Default Images
        PLACEHOLDER_IMAGE: '/images/placeholder.svg',

        // Currency
        DEFAULT_CURRENCY: 'EGP',

        // Default Contact (fallbacks)
        DEFAULT_WHATSAPP: '201000000000',
        DEFAULT_PHONE: '+201000000000'
    };

    // Freeze to prevent accidental modification
    Object.freeze(window.Config);
}

// Use var or check for redeclaration (var allows redeclaration)
var Config = window.Config;
