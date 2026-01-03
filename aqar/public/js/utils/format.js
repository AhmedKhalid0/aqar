/**
 * Formatting Utilities Module
 * Contains all formatting helper functions
 */

/**
 * Format price with currency
 * @param {number} price - Price value
 * @param {string} currency - Currency code (default: EGP)
 * @returns {string} - Formatted price string
 */
Site.formatPrice = function (price, currency = Config.DEFAULT_CURRENCY) {
    const lang = getCurrentLang();
    const formatted = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US').format(price);
    return lang === 'ar' ? `${formatted} جنيه` : `${formatted} ${currency}`;
};

/**
 * Get localized value from object
 * @param {Object} obj - Object containing localized values
 * @param {string} field - Field name to get
 * @returns {string} - Localized string
 */
Site.getLocalized = function (obj, field) {
    const lang = getCurrentLang();
    if (obj && obj[field]) {
        return obj[field][lang] || obj[field]['ar'] || obj[field]['en'] || '';
    }
    return '';
};

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date string
 */
Site.formatDate = function (date) {
    const lang = getCurrentLang();
    return new Date(date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};
