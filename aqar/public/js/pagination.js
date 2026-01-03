/**
 * Professional Pagination System
 * نظام التنقل الاحترافي للصفحات
 */

class PaginationManager {
    constructor(options = {}) {
        this.container = options.container || '#pagination';
        this.itemsContainer = options.itemsContainer || '#items-container';
        this.loadingContainer = options.loadingContainer || '#loading';
        this.apiEndpoint = options.apiEndpoint || '/api/units';
        this.itemsPerPage = options.itemsPerPage || 12;
        this.currentPage = 1;
        this.totalPages = 1;
        this.totalItems = 0;
        this.filters = options.filters || {};
        this.renderItem = options.renderItem || this.defaultRenderItem;
        this.onPageChange = options.onPageChange || null;
        this.lang = document.documentElement.lang || 'ar';
    }

    async loadPage(page = 1) {
        this.currentPage = page;
        this.showLoading();

        try {
            const params = new URLSearchParams({
                page: page,
                limit: this.itemsPerPage,
                withPagination: 'true',
                ...this.filters
            });

            const response = await fetch(`${this.apiEndpoint}?${params}`);
            const result = await response.json();

            if (result.pagination) {
                this.totalItems = result.pagination.total;
                this.totalPages = result.pagination.totalPages;
                this.renderItems(result.data);
                this.renderPagination();
            } else {
                // Fallback for old API format
                this.renderItems(result);
            }

            if (this.onPageChange) {
                this.onPageChange(page, result);
            }

            // Scroll to top smoothly
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error) {
            console.error('Failed to load page:', error);
            this.showError();
        }

        this.hideLoading();
    }

    renderItems(items) {
        const container = document.querySelector(this.itemsContainer);
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-search fa-3x text-muted mb-3"></i>
                    <p class="text-muted">${this.lang === 'ar' ? 'لا توجد نتائج' : 'No results found'}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = items.map(item => this.renderItem(item, this.lang)).join('');
    }

    renderPagination() {
        const container = document.querySelector(this.container);
        if (!container || this.totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }

        const pages = this.generatePageNumbers();
        
        container.innerHTML = `
            <nav aria-label="Page navigation" class="d-flex justify-content-center">
                <ul class="pagination pagination-lg">
                    <!-- First & Prev -->
                    <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
                        <a class="page-link" href="#" data-page="1" aria-label="First">
                            <i class="fas fa-angle-double-${this.lang === 'ar' ? 'right' : 'left'}"></i>
                        </a>
                    </li>
                    <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
                        <a class="page-link" href="#" data-page="${this.currentPage - 1}" aria-label="Previous">
                            <i class="fas fa-angle-${this.lang === 'ar' ? 'right' : 'left'}"></i>
                        </a>
                    </li>
                    
                    <!-- Page Numbers -->
                    ${pages.map(p => {
                        if (p === '...') {
                            return '<li class="page-item disabled"><span class="page-link">...</span></li>';
                        }
                        return `
                            <li class="page-item ${p === this.currentPage ? 'active' : ''}">
                                <a class="page-link" href="#" data-page="${p}">${p}</a>
                            </li>
                        `;
                    }).join('')}
                    
                    <!-- Next & Last -->
                    <li class="page-item ${this.currentPage === this.totalPages ? 'disabled' : ''}">
                        <a class="page-link" href="#" data-page="${this.currentPage + 1}" aria-label="Next">
                            <i class="fas fa-angle-${this.lang === 'ar' ? 'left' : 'right'}"></i>
                        </a>
                    </li>
                    <li class="page-item ${this.currentPage === this.totalPages ? 'disabled' : ''}">
                        <a class="page-link" href="#" data-page="${this.totalPages}" aria-label="Last">
                            <i class="fas fa-angle-double-${this.lang === 'ar' ? 'left' : 'right'}"></i>
                        </a>
                    </li>
                </ul>
            </nav>
            <div class="text-center text-muted mt-2">
                ${this.lang === 'ar' 
                    ? `عرض ${(this.currentPage - 1) * this.itemsPerPage + 1} - ${Math.min(this.currentPage * this.itemsPerPage, this.totalItems)} من ${this.totalItems}`
                    : `Showing ${(this.currentPage - 1) * this.itemsPerPage + 1} - ${Math.min(this.currentPage * this.itemsPerPage, this.totalItems)} of ${this.totalItems}`
                }
            </div>
        `;

        // Add event listeners
        container.querySelectorAll('.page-link[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(e.currentTarget.dataset.page);
                if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
                    this.loadPage(page);
                }
            });
        });
    }

    generatePageNumbers() {
        const pages = [];
        const total = this.totalPages;
        const current = this.currentPage;
        const delta = 2; // Pages to show around current

        if (total <= 7) {
            for (let i = 1; i <= total; i++) pages.push(i);
        } else {
            // Always show first page
            pages.push(1);

            if (current > delta + 2) {
                pages.push('...');
            }

            // Pages around current
            for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
                pages.push(i);
            }

            if (current < total - delta - 1) {
                pages.push('...');
            }

            // Always show last page
            pages.push(total);
        }

        return pages;
    }

    setFilters(filters) {
        this.filters = { ...this.filters, ...filters };
        this.loadPage(1);
    }

    showLoading() {
        const loading = document.querySelector(this.loadingContainer);
        if (loading) loading.style.display = 'block';
        
        const container = document.querySelector(this.itemsContainer);
        if (container) container.style.opacity = '0.5';
    }

    hideLoading() {
        const loading = document.querySelector(this.loadingContainer);
        if (loading) loading.style.display = 'none';
        
        const container = document.querySelector(this.itemsContainer);
        if (container) container.style.opacity = '1';
    }

    showError() {
        const container = document.querySelector(this.itemsContainer);
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                    <p class="text-danger">${this.lang === 'ar' ? 'حدث خطأ في تحميل البيانات' : 'Error loading data'}</p>
                    <button class="btn btn-primary" onclick="location.reload()">
                        ${this.lang === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
                    </button>
                </div>
            `;
        }
    }

    defaultRenderItem(item, lang) {
        return `<div class="col-md-4 mb-4">
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title">${item.title?.[lang] || item.title?.ar || item.id}</h5>
                </div>
            </div>
        </div>`;
    }
}

// CSS Styles for pagination
const paginationStyles = `
<style>
.pagination {
    flex-wrap: wrap;
    gap: 0.25rem;
}
.pagination .page-link {
    border-radius: 8px !important;
    margin: 0 2px;
    min-width: 42px;
    text-align: center;
    border: 1px solid #dee2e6;
    color: #c8a45a;
    transition: all 0.3s ease;
}
.pagination .page-item.active .page-link {
    background: linear-gradient(135deg, #c8a45a 0%, #a88a3d 100%);
    border-color: #c8a45a;
    color: #fff;
}
.pagination .page-link:hover {
    background-color: #f8f9fa;
    border-color: #c8a45a;
    color: #a88a3d;
}
.pagination .page-item.disabled .page-link {
    color: #6c757d;
    background-color: #f8f9fa;
}
@media (max-width: 576px) {
    .pagination .page-link {
        min-width: 36px;
        padding: 0.375rem 0.5rem;
        font-size: 0.875rem;
    }
}
</style>
`;

// Inject styles
if (!document.querySelector('#pagination-styles')) {
    const styleEl = document.createElement('div');
    styleEl.id = 'pagination-styles';
    styleEl.innerHTML = paginationStyles;
    document.head.appendChild(styleEl);
}

// Export for use
window.PaginationManager = PaginationManager;
