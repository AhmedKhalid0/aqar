/**
 * Home Page Module
 * Homepage loader and functionality
 */

Site.pages.home = async function () {
    const lang = getCurrentLang();

    // Load Homepage Settings (Hero, CTA)
    try {
        const settings = await Site.fetchAPI('/api/settings');

        // Hero Section
        if (settings.hero) {
            if (settings.hero.image) {
                const heroSection = document.getElementById('heroSection');
                if (heroSection) {
                    heroSection.style.backgroundImage = `linear-gradient(rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.85)), url('${settings.hero.image}')`;
                }
            }
            if (settings.hero.title?.[lang]) {
                const heroTitle = document.getElementById('heroTitle');
                if (heroTitle) heroTitle.innerHTML = settings.hero.title[lang];
            }
            if (settings.hero.subtitle?.[lang]) {
                const heroSubtitle = document.getElementById('heroSubtitle');
                if (heroSubtitle) heroSubtitle.textContent = settings.hero.subtitle[lang];
            }
        }

        // CTA Section
        if (settings.cta) {
            if (settings.cta.title?.[lang]) {
                const ctaTitle = document.getElementById('ctaTitle');
                if (ctaTitle) ctaTitle.textContent = settings.cta.title[lang];
            }
            if (settings.cta.subtitle?.[lang]) {
                const ctaSubtitle = document.getElementById('ctaSubtitle');
                if (ctaSubtitle) ctaSubtitle.textContent = settings.cta.subtitle[lang];
            }
            if (settings.cta.buttonText?.[lang]) {
                const ctaButtonText = document.getElementById('ctaButtonText');
                if (ctaButtonText) ctaButtonText.textContent = settings.cta.buttonText[lang];
            }
            if (settings.cta.buttonLink) {
                const ctaButton = document.getElementById('ctaButton');
                if (ctaButton) ctaButton.href = settings.cta.buttonLink;
            }
        }

        // Stats
        if (settings.stats) {
            const statsUnits = document.getElementById('statsUnits');
            const statsProjects = document.getElementById('statsProjects');
            const statsClients = document.getElementById('statsClients');
            if (statsUnits) statsUnits.textContent = (settings.stats.units || 500) + '+';
            if (statsProjects) statsProjects.textContent = (settings.stats.projects || 15) + '+';
            if (statsClients) statsClients.textContent = (settings.stats.clients || 1200) + '+';
        }
    } catch (error) {
        console.error('Error loading homepage settings:', error);
    }

    // Load Featured Units
    try {
        const units = await Site.fetchAPI('/api/units');
        const projects = await Site.fetchAPI('/api/projects');
        const featuredUnits = units.filter(u => u.featured).slice(0, 9);
        const unitsContainer = document.getElementById('featuredUnits');
        if (unitsContainer) {
            unitsContainer.innerHTML = '';
            if (featuredUnits.length === 0) {
                Site.showEmpty(unitsContainer, lang === 'ar' ? 'لا توجد وحدات متاحة حالياً' : 'No units available');
            } else {
                featuredUnits.forEach(unit => {
                    const project = projects.find(p => p.id === unit.projectId);
                    const projectImage = project?.images?.[0] || null;
                    unitsContainer.appendChild(Site.createUnitCard(unit, projectImage));
                });
            }
        }
    } catch (error) {
        console.error('Error loading units:', error);
    }

    // Load Featured Projects
    try {
        const projects = await Site.fetchAPI('/api/projects');
        const featuredProjects = projects.filter(p => p.featured).slice(0, 9);
        const projectsContainer = document.getElementById('featuredProjects');
        if (projectsContainer) {
            projectsContainer.innerHTML = '';
            if (featuredProjects.length === 0) {
                Site.showEmpty(projectsContainer, lang === 'ar' ? 'لا توجد مشاريع متاحة حالياً' : 'No projects available');
            } else {
                featuredProjects.forEach(project => {
                    projectsContainer.appendChild(Site.createProjectCard(project));
                });
            }
        }
    } catch (error) {
        console.error('Error loading projects:', error);
    }

    // Load Latest News
    try {
        const news = await Site.fetchAPI('/api/news');
        const latestNews = news.slice(0, 3);
        const newsContainer = document.getElementById('latestNews');
        if (newsContainer) {
            newsContainer.innerHTML = '';
            if (latestNews.length === 0) {
                Site.showEmpty(newsContainer, lang === 'ar' ? 'لا توجد أخبار حالياً' : 'No news available');
            } else {
                latestNews.forEach(article => {
                    newsContainer.appendChild(Site.createNewsCard(article));
                });
            }
        }
    } catch (error) {
        console.error('Error loading news:', error);
    }

    // Load Partners
    try {
        const partners = await Site.fetchAPI('/api/partners');
        const partnersContainer = document.getElementById('partnersGrid');
        if (partnersContainer) {
            partnersContainer.innerHTML = '';
            partners.slice(0, 5).forEach(partner => {
                const name = partner.name?.[lang] || partner.name?.ar || '';
                const col = document.createElement('div');
                col.className = 'col-lg-2 col-md-3 col-4 mb-4';
                col.innerHTML = `
                    <a href="${partner.website || '#'}" target="_blank" class="partner-logo" title="${name}">
                        <img src="${partner.logo || '/images/placeholder.jpg'}" alt="${name}" loading="lazy">
                    </a>
                `;
                partnersContainer.appendChild(col);
            });
        }
    } catch (error) {
        console.error('Error loading partners:', error);
    }

    // Load Reviews
    try {
        const reviews = await Site.fetchAPI('/api/reviews');
        const reviewsContainer = document.getElementById('reviewsGrid');
        if (reviewsContainer) {
            reviewsContainer.innerHTML = '';
            reviews.slice(0, 5).forEach(review => {
                reviewsContainer.appendChild(Site.createReviewCard(review));
            });
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
    }

    // Load About Content
    try {
        const about = await Site.fetchAPI('/api/settings/about');
        const aboutContent = document.getElementById('aboutContent');
        if (aboutContent && about && about[lang]) {
            aboutContent.innerHTML = about[lang];
        }
    } catch (error) {
        console.error('Error loading about:', error);
    }
};
