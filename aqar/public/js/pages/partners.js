/**
 * Partners Page Module
 */

Site.pages.partners = async function () {
    const lang = getCurrentLang();

    try {
        const partners = await Site.fetchAPI('/api/partners');
        const container = document.getElementById('partnersGrid');
        if (!container) return;

        if (!partners || partners.length === 0) {
            Site.showEmpty(container, lang === 'ar' ? 'لا يوجد شركاء' : 'No partners', 'bi-building');
            return;
        }

        container.innerHTML = '';
        partners.forEach(partner => {
            const name = partner.name?.[lang] || partner.name?.ar || '';
            const col = document.createElement('div');
            col.className = 'col-lg-2 col-md-3 col-4 mb-4';
            col.innerHTML = `
                <a href="${partner.website || '#'}" target="_blank" class="partner-logo" title="${name}">
                    <img src="${partner.logo || '/images/placeholder.jpg'}" alt="${name}" loading="lazy">
                </a>
            `;
            container.appendChild(col);
        });
    } catch (error) {
        console.error('Error loading partners:', error);
    }
};
