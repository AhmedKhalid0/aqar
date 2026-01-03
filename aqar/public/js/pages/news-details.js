/**
 * News Details Page Module
 */

Site.pages.newsDetails = async function () {
    const lang = getCurrentLang();
    const params = new URLSearchParams(window.location.search);
    const newsId = params.get('id');
    const container = document.getElementById('articleContent');

    if (!newsId) {
        window.location.href = '/news.html';
        return;
    }

    try {
        const article = await Site.fetchAPI(`/api/news/${newsId}`);
        if (!article) {
            window.location.href = '/news.html';
            return;
        }

        document.title = `${article.title?.[lang] || article.title?.ar} | عقار`;
        const breadcrumb = document.getElementById('breadcrumbTitle');
        if (breadcrumb) breadcrumb.textContent = article.title?.[lang] || article.title?.ar || '';

        if (container) {
            const date = new Date(article.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            });

            container.innerHTML = `
                <img src="${article.image || '/images/placeholder.jpg'}" class="w-100 rounded-3 mb-4" alt="${article.title?.[lang] || article.title?.ar}" style="max-height: 500px; object-fit: cover;">
                
                <div class="d-flex align-items-center mb-3 text-muted">
                    <i class="bi bi-calendar-event me-2 ms-2"></i>
                    <span>${date}</span>
                </div>

                <h1 class="mb-4">${article.title?.[lang] || article.title?.ar || ''}</h1>

                <div class="article-body" style="line-height: 2; font-size: 1.1rem; color: #4a5568;">
                    ${article.content?.[lang] || article.content?.ar || ''}
                </div>

                <hr class="my-5">

                <div class="d-flex justify-content-between align-items-center">
                    <a href="/news.html" class="btn btn-outline-primary">
                        <i class="bi bi-arrow-${lang === 'ar' ? 'right' : 'left'}"></i> ${lang === 'ar' ? 'العودة للأخبار' : 'Back to News'}
                    </a>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading news details:', error);
        if (container) Site.showError(container, lang === 'ar' ? 'حدث خطأ في تحميل المقال' : 'Error loading article');
    }
};
