/**
 * Privacy Page Module
 */

Site.pages.privacy = async function () {
    const lang = getCurrentLang();
    try {
        const content = await Site.fetchAPI('/api/settings/privacy');
        const container = document.getElementById('privacyContent');
        if (container && content?.[lang]) {
            container.innerHTML = content[lang];
        }
    } catch (error) {
        console.error('Error loading privacy:', error);
    }
};
