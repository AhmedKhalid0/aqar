/**
 * News Listing Page Module
 */

Site.pages.news = async function () {
    const lang = getCurrentLang();

    try {
        const news = await Site.fetchAPI('/api/news');
        const container = document.getElementById('newsGrid');
        if (!container) return;

        if (!news || news.length === 0) {
            Site.showEmpty(container, lang === 'ar' ? 'لا توجد أخبار حالياً' : 'No news available', 'bi-newspaper');
            return;
        }

        container.innerHTML = '';
        news.forEach(article => container.appendChild(Site.createNewsCard(article)));
    } catch (error) {
        console.error('Error loading news:', error);
    }
};
