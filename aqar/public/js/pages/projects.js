/**
 * Projects Listing Page Module
 */

Site.pages.projects = async function () {
    const lang = getCurrentLang();
    let currentPage = 1;
    let totalPages = 1;
    const ITEMS_PER_PAGE = Config.ITEMS_PER_PAGE;

    async function loadProjects(page = 1) {
        const container = document.getElementById('projectsGrid');
        if (!container) return;
        container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>';

        const params = new URLSearchParams({ page, limit: ITEMS_PER_PAGE, withPagination: 'true' });
        const location = document.getElementById('filterLocation')?.value;
        if (location) params.append('location', location);

        try {
            const result = await Site.fetchAPI(`/api/projects?${params}`);
            const projects = result.data || result;

            if (result.pagination) {
                currentPage = result.pagination.page;
                totalPages = result.pagination.totalPages;
            }

            if (!projects || projects.length === 0) {
                Site.showEmpty(container, lang === 'ar' ? 'لا توجد مشاريع مطابقة' : 'No projects found', 'bi-building');
                return;
            }

            // Sort locally
            const sortBy = document.getElementById('sortBy')?.value;
            if (sortBy === 'units') {
                projects.sort((a, b) => (b.availableUnits || 0) - (a.availableUnits || 0));
            } else {
                projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            }

            container.innerHTML = '';
            projects.forEach(project => container.appendChild(Site.createProjectCard(project)));
        } catch (error) {
            console.error('Error loading projects:', error);
            Site.showError(container, lang === 'ar' ? 'حدث خطأ في تحميل المشاريع' : 'Error loading projects');
        }
    }

    // Load locations for filter
    try {
        const locations = await Site.fetchAPI('/api/settings/locations');
        const locationSelect = document.getElementById('filterLocation');
        if (locationSelect) {
            locations.forEach(loc => {
                const option = document.createElement('option');
                option.value = loc.id;
                option.textContent = loc.name?.[lang] || loc.name?.ar || '';
                locationSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading locations:', error);
    }

    loadProjects(1);
    document.getElementById('filterLocation')?.addEventListener('change', () => loadProjects(1));
    document.getElementById('sortBy')?.addEventListener('change', () => loadProjects(1));
};
