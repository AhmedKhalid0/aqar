/**
 * Terms Page Module
 */

Site.pages.terms = async function () {
    const lang = getCurrentLang();
    try {
        const content = await Site.fetchAPI('/api/settings/terms');
        const container = document.getElementById('termsContent');
        if (container && content?.[lang]) {
            container.innerHTML = content[lang];
        }
    } catch (error) {
        console.error('Error loading terms:', error);
    }
};
