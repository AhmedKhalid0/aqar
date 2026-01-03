// Aqar Admin Dashboard JavaScript
const API_BASE = '';

// ========================================
// Auth Functions
// ========================================
function getToken() {
    return localStorage.getItem('adminToken');
}

function setToken(token) {
    localStorage.setItem('adminToken', token);
}

function removeToken() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
}

function getUser() {
    const user = localStorage.getItem('adminUser');
    return user ? JSON.parse(user) : null;
}

function setUser(user) {
    localStorage.setItem('adminUser', JSON.stringify(user));
}

async function checkAuth() {
    const token = getToken();
    if (!token) {
        window.location.href = '/admin/login.html';
        return false;
    }

    try {
        const response = await fetch(`${API_BASE}/api/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            removeToken();
            window.location.href = '/admin/login.html';
            return false;
        }

        // Check Page Permissions
        if (!enforcePagePermissions()) {
            return false;
        }

        return true;
    } catch (error) {
        removeToken();
        window.location.href = '/admin/login.html';
        return false;
    }
}

async function logout() {
    try {
        // Clear server-side cookie
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) { }
    removeToken();
    window.location.href = '/admin/login.html';
}

// ========================================
// API Functions
// ========================================
async function adminFetch(endpoint, options = {}) {
    const token = getToken();

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    });

    if (response.status === 401 || response.status === 403) {
        removeToken();
        window.location.href = '/admin/login.html';
        throw new Error('Unauthorized');
    }

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
    }

    return response.json();
}

async function uploadImage(file) {
    const token = getToken();
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });

    if (!response.ok) {
        throw new Error('Upload failed');
    }

    return response.json();
}

async function uploadMultipleImages(files) {
    const token = getToken();
    const formData = new FormData();

    for (let file of files) {
        formData.append('images', file);
    }

    const response = await fetch(`${API_BASE}/api/upload/multiple`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });

    if (!response.ok) {
        throw new Error('Upload failed');
    }

    return response.json();
}

// ========================================
// UI Helpers
// ========================================
function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; min-width: 300px;';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);

    setTimeout(() => alertDiv.remove(), 5000);
}

function showLoading() {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="spinner-border text-gold" style="width: 3rem; height: 3rem;"></div>';
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatPrice(price) {
    return new Intl.NumberFormat('ar-EG').format(price) + ' جنيه';
}

// ========================================
// Sidebar & Navigation
// ========================================
async function loadSidebar() {
    const sidebarContainer = document.getElementById('sidebarContainer');
    if (!sidebarContainer) return;

    try {
        const response = await fetch('/admin/components/sidebar.html');
        if (response.ok) {
            sidebarContainer.innerHTML = await response.text();
            initSidebar();
        }
    } catch (error) {
        console.error('Error loading sidebar:', error);
    }
}

// Auto-load sidebar on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    loadSidebar();
});

function initSidebar() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const user = getUser();

    // Permission Mapping
    const permissionMap = {
        '/admin/': 'view_dashboard',
        '/admin/index.html': 'view_dashboard',
        '/admin/units.html': 'manage_units',
        '/admin/projects.html': 'manage_projects',
        '/admin/news.html': 'manage_news',
        '/admin/partners.html': 'manage_settings', // Partners are part of settings/content
        '/admin/reviews.html': 'manage_reviews',
        '/admin/comments.html': 'manage_comments',
        '/admin/messages.html': 'manage_messages',
        '/admin/reports.html': 'view_stats',
        '/admin/users.html': 'manage_users',
        '/admin/settings.html': 'manage_settings',
        '/admin/backup.html': 'manage_backups',
        '/admin/logs.html': 'view_logs'
    };

    navLinks.forEach(link => {
        const href = link.getAttribute('href');

        // 1. Set Active State
        if (href === currentPath) {
            link.classList.add('active');
        }

        // 2. Permission Check
        if (user && user.role !== 'super_admin') {
            const requiredPerm = permissionMap[href];
            if (requiredPerm) {
                const hasPerm = (user.permissions || []).includes(requiredPerm);
                // If special mapping needed (e.g. backward compat), add here
                if (!hasPerm) {
                    link.parentElement.style.display = 'none';
                }
            }
        }
    });

    // Mobile toggle
    const toggleBtn = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.admin-sidebar');

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
    }

    // Display user info
    if (user) {
        const userNameEl = document.getElementById('userName') || document.getElementById('sidebarUserName');
        const userRoleEl = document.getElementById('userRole') || document.getElementById('sidebarUserRole');
        if (userNameEl) userNameEl.textContent = user.name || user.username;
        if (userRoleEl) userRoleEl.textContent = user.role === 'super_admin' ? 'مدير النظام' : 'مخصص';
    }
}

// ========================================
// Image Upload Handler
// ========================================
function initImageUpload(zoneId, previewId, inputId) {
    const zone = document.getElementById(zoneId);
    const preview = document.getElementById(previewId);
    const input = document.getElementById(inputId);
    let uploadedImages = [];

    if (!zone || !input) return { getImages: () => uploadedImages };

    zone.addEventListener('click', () => input.click());

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.style.borderColor = '#d4af37';
    });

    zone.addEventListener('dragleave', () => {
        zone.style.borderColor = '#dee2e6';
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.style.borderColor = '#dee2e6';
        handleFiles(e.dataTransfer.files);
    });

    input.addEventListener('change', () => {
        handleFiles(input.files);
    });

    async function handleFiles(files) {
        showLoading();
        try {
            const result = await uploadMultipleImages(files);
            uploadedImages = [...uploadedImages, ...result.images.map(img => img.url)];
            renderPreviews();
            showAlert('تم رفع الصور بنجاح');
        } catch (error) {
            showAlert('فشل رفع الصور', 'danger');
        } finally {
            hideLoading();
        }
    }

    function renderPreviews() {
        if (!preview) return;
        preview.innerHTML = uploadedImages.map((url, index) => `
            <div class="image-preview-item">
                <img src="${url}" alt="Preview">
                <button type="button" class="remove-btn" onclick="removeImage(${index})">×</button>
            </div>
        `).join('');
    }

    window.removeImage = (index) => {
        uploadedImages.splice(index, 1);
        renderPreviews();
    };

    return {
        getImages: () => uploadedImages,
        setImages: (images) => {
            uploadedImages = images;
            renderPreviews();
        },
        addImage: (url) => {
            if (!uploadedImages.includes(url)) {
                uploadedImages.push(url);
                renderPreviews();
            }
        }
    };
}

// ========================================
// Rich Text Editor (Quill)
// ========================================
function initQuillEditor(elementId) {
    if (typeof Quill === 'undefined') return null;

    return new Quill(`#${elementId}`, {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                [{ 'align': [] }],
                ['link'],
                ['clean']
            ]
        }
    });
}

// ========================================
// Confirmation Dialog
// ========================================
function confirmAction(message) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">تأكيد</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إلغاء</button>
                        <button type="button" class="btn btn-danger" id="confirmBtn">تأكيد</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        modal.querySelector('#confirmBtn').addEventListener('click', () => {
            resolve(true);
            bsModal.hide();
        });

        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
            resolve(false);
        });
    });
}

// ========================================
// Init Function
// ========================================
async function init() {
    const isAuthed = await checkAuth();
    if (isAuthed) {
        // Enforce Page Permissions
        const user = getUser();
        const currentPath = window.location.pathname;

        const permissionMap = {
            '/admin/units.html': 'manage_units',
            '/admin/projects.html': 'manage_projects',
            '/admin/news.html': 'manage_news',
            '/admin/partners.html': 'manage_settings',
            '/admin/reviews.html': 'manage_reviews',
            '/admin/comments.html': 'manage_comments',
            '/admin/messages.html': 'manage_messages',
            '/admin/reports.html': 'view_stats',
            '/admin/users.html': 'manage_users',
            '/admin/settings.html': 'manage_settings',
            '/admin/backup.html': 'manage_backups',
            '/admin/logs.html': 'view_logs'
        };

        if (user && user.role !== 'super_admin' && permissionMap[currentPath]) {
            const requiredPerm = permissionMap[currentPath];
            const hasPerm = (user.permissions || []).includes(requiredPerm);

            if (!hasPerm) {
                document.body.innerHTML = `
                    <div class="d-flex align-items-center justify-content-center vh-100 bg-light">
                        <div class="text-center p-5 bg-white rounded shadow-sm">
                            <i class="bi bi-shield-lock text-danger display-1 mb-3"></i>
                            <h2 class="mb-3">غير مصرح لك بالدخول</h2>
                            <p class="text-muted mb-4">ليس لديك الصلاحية للوصول لهذه الصفحة.</p>
                            <a href="/admin/" class="btn btn-primary">العودة للرئيسية</a>
                        </div>
                    </div>
                `;
                return false;
            }
        }

        await loadSidebar();
    }
    return isAuthed;
}

// ========================================
// Permission Enforcer
// ========================================
function enforcePagePermissions() {
    const user = getUser();
    const currentPath = window.location.pathname.split('?')[0];

    const permissionMap = {
        '/admin/': 'view_dashboard',
        '/admin/index.html': 'view_dashboard',
        '/admin/units.html': 'manage_units',
        '/admin/projects.html': 'manage_projects',
        '/admin/news.html': 'manage_news',
        '/admin/partners.html': 'manage_settings',
        '/admin/reviews.html': 'manage_reviews',
        '/admin/comments.html': 'manage_comments',
        '/admin/messages.html': 'manage_messages',
        '/admin/reports.html': 'view_stats',
        '/admin/users.html': 'manage_users',
        '/admin/settings.html': 'manage_settings',
        '/admin/backup.html': 'manage_backups',
        '/admin/logs.html': 'view_logs'
    };

    if (user && user.role !== 'super_admin' && permissionMap[currentPath]) {
        const requiredPerm = permissionMap[currentPath];
        const hasPerm = (user.permissions || []).includes(requiredPerm);

        if (!hasPerm) {
            // Special handling for Dashboard: Redirect to first authorized page
            if (currentPath === '/admin/' || currentPath === '/admin/index.html') {
                for (const [path, perm] of Object.entries(permissionMap)) {
                    if (path !== '/admin/' && path !== '/admin/index.html' && user.permissions.includes(perm)) {
                        window.location.href = path;
                        return false;
                    }
                }
            }

            document.body.innerHTML = `
                <div class="d-flex align-items-center justify-content-center vh-100 bg-light">
                    <div class="text-center p-5 bg-white rounded shadow-sm">
                        <i class="bi bi-shield-lock text-danger display-1 mb-3"></i>
                        <h2 class="mb-3">غير مصرح لك بالدخول</h2>
                        <p class="text-muted mb-4">ليس لديك الصلاحية للوصول لهذه الصفحة.</p>
                        <a href="/admin/" class="btn btn-primary">العودة للرئيسية</a>
                    </div>
                </div>
            `;
            return false;
        }
    }
    return true;
}

function decodeHtml(html) {
    if (!html) return '';
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
}

// ========================================
// Export
// ========================================
window.Admin = {
    init,
    getToken,
    setToken,
    removeToken,
    getUser,
    setUser,
    checkAuth,
    logout,
    adminFetch,
    uploadImage,
    uploadMultipleImages,
    showAlert,
    showLoading,
    hideLoading,
    formatDate,
    formatPrice,
    loadSidebar,
    initSidebar,
    initImageUpload,
    initQuillEditor,
    confirmAction,
    decodeHtml
};
