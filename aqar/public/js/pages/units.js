/**
 * Units Listing Page Module
 * Units page loader with filtering and pagination
 */

Site.pages.units = async function () {
    const lang = getCurrentLang();
    let allProjects = [];
    let currentPage = 1;
    let totalPages = 1;
    let totalUnits = 0;
    const ITEMS_PER_PAGE = Config.ITEMS_PER_PAGE;

    // Helper functions
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function sortUnitsLocally(units, sortBy) {
        if (!units || !Array.isArray(units)) return units;
        const sorted = [...units];
        switch (sortBy) {
            case 'price-low': sorted.sort((a, b) => (a.price || 0) - (b.price || 0)); break;
            case 'price-high': sorted.sort((a, b) => (b.price || 0) - (a.price || 0)); break;
            case 'area-low': sorted.sort((a, b) => (a.area || 0) - (b.area || 0)); break;
            case 'area-high': sorted.sort((a, b) => (b.area || 0) - (a.area || 0)); break;
            default: sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
        }
        return sorted;
    }

    function generatePageNumbers(current, total) {
        const pages = [];
        const delta = 2;
        if (total <= 7) {
            for (let i = 1; i <= total; i++) pages.push(i);
        } else {
            pages.push(1);
            if (current > delta + 2) pages.push('...');
            for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
                pages.push(i);
            }
            if (current < total - delta - 1) pages.push('...');
            pages.push(total);
        }
        return pages;
    }

    function renderUnits(units) {
        const container = document.getElementById('unitsGrid');
        if (!container) return;

        if (!units || units.length === 0) {
            Site.showEmpty(container, lang === 'ar' ? 'لا توجد وحدات مطابقة للبحث' : 'No units found', 'bi-building');
            const paginationNav = document.getElementById('paginationNav');
            if (paginationNav) paginationNav.style.display = 'none';
            return;
        }

        container.innerHTML = '';
        units.forEach(unit => {
            const project = allProjects.find(p => p.id === unit.projectId);
            const projectImage = project?.images?.[0] || null;
            container.appendChild(Site.createUnitCard(unit, projectImage));
        });
    }

    function renderPagination() {
        const paginationNav = document.getElementById('paginationNav');
        const pagination = document.getElementById('pagination');
        if (!paginationNav || !pagination) return;

        if (totalPages <= 1) {
            paginationNav.style.display = 'none';
            return;
        }

        paginationNav.style.display = 'block';
        pagination.innerHTML = '';

        pagination.innerHTML += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="1"><i class="bi bi-chevron-double-right"></i></a>
            </li>
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage - 1}"><i class="bi bi-chevron-right"></i></a>
            </li>
        `;

        const pages = generatePageNumbers(currentPage, totalPages);
        pages.forEach(p => {
            if (p === '...') {
                pagination.innerHTML += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            } else {
                pagination.innerHTML += `
                    <li class="page-item ${p === currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" data-page="${p}">${p}</a>
                    </li>
                `;
            }
        });

        pagination.innerHTML += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage + 1}"><i class="bi bi-chevron-left"></i></a>
            </li>
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${totalPages}"><i class="bi bi-chevron-double-left"></i></a>
            </li>
        `;

        // Add click listeners
        pagination.querySelectorAll('a[data-page]').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(a.dataset.page);
                if (page >= 1 && page <= totalPages && page !== currentPage) {
                    loadUnits(page);
                    window.scrollTo({ top: 200, behavior: 'smooth' });
                }
            });
        });
    }

    async function loadUnits(page = 1) {
        const container = document.getElementById('unitsGrid');
        if (!container) return;

        container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>';

        const params = new URLSearchParams({ page, limit: ITEMS_PER_PAGE, withPagination: 'true' });

        const getVal = id => document.getElementById(id)?.value || '';
        const project = getVal('filterProject');
        const location = getVal('filterLocation');
        const type = getVal('filterType');
        const minPrice = getVal('filterMinPrice');
        const maxPrice = getVal('filterMaxPrice');
        const minArea = getVal('filterMinArea');
        const maxArea = getVal('filterMaxArea');
        const bedrooms = getVal('filterBedrooms');
        const unitStatus = getVal('filterUnitStatus');
        const featured = document.getElementById('filterFeatured')?.checked;
        const sortBy = getVal('sortBy');

        if (project) params.append('projectId', project);
        if (location) params.append('location', location);
        if (type) params.append('type', type);
        if (unitStatus) params.append('unitStatus', unitStatus);
        if (minPrice) params.append('minPrice', minPrice);
        if (maxPrice) params.append('maxPrice', maxPrice);
        if (minArea) params.append('minArea', minArea);
        if (maxArea) params.append('maxArea', maxArea);
        if (bedrooms) params.append('bedrooms', bedrooms);
        if (featured) params.append('featured', 'true');
        if (sortBy) params.append('sort', sortBy);

        try {
            const result = await Site.fetchAPI(`/api/units?${params}`);
            let unitsData = result.data || result;
            unitsData = sortUnitsLocally(unitsData, sortBy);

            if (result.pagination) {
                currentPage = result.pagination.page;
                totalPages = result.pagination.totalPages;
                totalUnits = result.pagination.total;
            } else {
                totalUnits = unitsData.length;
            }

            renderUnits(unitsData);
            renderPagination();

            const unitsCount = document.getElementById('unitsCount');
            if (unitsCount) unitsCount.textContent = totalUnits;

        } catch (error) {
            console.error('Error loading units:', error);
            Site.showError(container, lang === 'ar' ? 'حدث خطأ في تحميل الوحدات' : 'Error loading units');
        }
    }

    function resetFilters() {
        ['filterProject', 'filterLocation', 'filterType', 'filterMinPrice', 'filterMaxPrice',
            'filterMinArea', 'filterMaxArea', 'filterBedrooms', 'filterUnitStatus'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        const featured = document.getElementById('filterFeatured');
        if (featured) featured.checked = false;
        const sortBy = document.getElementById('sortBy');
        if (sortBy) sortBy.value = 'newest';
        window.history.replaceState({}, '', window.location.pathname);
        loadUnits(1);
    }

    // Load filters
    try {
        const [projects, locations, types] = await Promise.all([
            Site.fetchAPI('/api/projects'),
            Site.fetchAPI('/api/settings/locations'),
            Site.fetchAPI('/api/settings/unit-types')
        ]);

        allProjects = projects;

        const projectSelect = document.getElementById('filterProject');
        if (projectSelect) {
            projects.forEach(p => {
                const option = document.createElement('option');
                option.value = p.id;
                option.textContent = p.title?.[lang] || p.title?.ar || '';
                projectSelect.appendChild(option);
            });
        }

        const locationSelect = document.getElementById('filterLocation');
        if (locationSelect) {
            locations.forEach(loc => {
                const option = document.createElement('option');
                option.value = loc.id;
                option.textContent = loc.name?.[lang] || loc.name?.ar || '';
                locationSelect.appendChild(option);
            });
        }

        const typeSelect = document.getElementById('filterType');
        if (typeSelect) {
            types.forEach(type => {
                const option = document.createElement('option');
                option.value = type.id;
                option.textContent = type.name?.[lang] || type.name?.ar || '';
                typeSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading filters:', error);
    }

    // Restore URL params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('project')) {
        const filterProject = document.getElementById('filterProject');
        if (filterProject) filterProject.value = urlParams.get('project');
    }
    if (urlParams.get('page')) currentPage = parseInt(urlParams.get('page')) || 1;

    // Load initial units
    loadUnits(currentPage);

    // Event listeners
    const debouncedLoad = debounce(() => loadUnits(1), 500);
    ['filterProject', 'filterLocation', 'filterType', 'filterBedrooms', 'filterUnitStatus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => loadUnits(1));
    });
    ['filterMinPrice', 'filterMaxPrice', 'filterMinArea', 'filterMaxArea'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', debouncedLoad);
    });
    const featuredEl = document.getElementById('filterFeatured');
    if (featuredEl) featuredEl.addEventListener('change', () => loadUnits(1));
    const resetBtn = document.getElementById('resetFilters');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);
    const sortByEl = document.getElementById('sortBy');
    if (sortByEl) sortByEl.addEventListener('change', () => loadUnits(currentPage));
};
