// Media Library Component
// Allows selecting images from previously uploaded files

class MediaLibrary {
    constructor(options = {}) {
        this.onSelect = options.onSelect || (() => {});
        this.multiple = options.multiple !== false;
        this.selectedImages = [];
        this.allImages = [];
        this.modalId = 'mediaLibraryModal';
        this.init();
    }

    init() {
        // Create modal if it doesn't exist
        if (!document.getElementById(this.modalId)) {
            this.createModal();
        }
        this.modal = new bootstrap.Modal(document.getElementById(this.modalId));
    }

    createModal() {
        const modalHtml = `
        <div class="modal fade" id="${this.modalId}" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="bi bi-images me-2"></i>مكتبة الوسائط
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <div class="d-flex gap-2 align-items-center">
                                <input type="text" class="form-control form-control-sm" id="mediaSearchInput" 
                                    placeholder="بحث..." style="width: 200px;">
                                <span class="text-muted small" id="mediaCount">0 صورة</span>
                            </div>
                            <div class="d-flex gap-2">
                                <button class="btn btn-outline-primary btn-sm" id="mediaUploadBtn">
                                    <i class="bi bi-cloud-upload me-1"></i>رفع صور جديدة
                                </button>
                                <input type="file" id="mediaUploadInput" multiple accept="image/*" style="display:none;">
                            </div>
                        </div>
                        <div class="media-grid" id="mediaGrid">
                            <div class="text-center py-5">
                                <div class="spinner-border text-gold" role="status"></div>
                                <p class="mt-2 text-muted">جاري تحميل الصور...</p>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer justify-content-between">
                        <div>
                            <span class="text-muted" id="selectedCountText">لم يتم تحديد صور</span>
                        </div>
                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إلغاء</button>
                            <button type="button" class="btn btn-gold" id="mediaSelectBtn" disabled>
                                <i class="bi bi-check-lg me-1"></i>اختيار المحدد
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <style>
            .media-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 15px;
                max-height: 60vh;
                overflow-y: auto;
                padding: 5px;
            }
            .media-item {
                position: relative;
                aspect-ratio: 1;
                border-radius: 8px;
                overflow: hidden;
                cursor: pointer;
                border: 3px solid transparent;
                transition: all 0.2s ease;
                background: #f8f9fa;
            }
            .media-item:hover {
                transform: scale(1.02);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .media-item.selected {
                border-color: var(--gold-color, #c9a227);
                box-shadow: 0 0 0 3px rgba(201, 162, 39, 0.3);
            }
            .media-item img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .media-item .media-overlay {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: linear-gradient(transparent, rgba(0,0,0,0.7));
                color: white;
                padding: 8px;
                font-size: 11px;
                opacity: 0;
                transition: opacity 0.2s;
            }
            .media-item:hover .media-overlay {
                opacity: 1;
            }
            .media-item .select-check {
                position: absolute;
                top: 8px;
                right: 8px;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: rgba(255,255,255,0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.2s;
            }
            .media-item:hover .select-check,
            .media-item.selected .select-check {
                opacity: 1;
            }
            .media-item.selected .select-check {
                background: var(--gold-color, #c9a227);
                color: white;
            }
            .media-item .delete-btn {
                position: absolute;
                top: 8px;
                left: 8px;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: rgba(220, 53, 69, 0.9);
                color: white;
                border: none;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.2s;
                cursor: pointer;
                font-size: 12px;
            }
            .media-item:hover .delete-btn {
                opacity: 1;
            }
            .media-empty {
                text-align: center;
                padding: 60px 20px;
                color: #6c757d;
            }
            .media-empty i {
                font-size: 64px;
                margin-bottom: 15px;
                opacity: 0.5;
            }
        </style>`;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.bindEvents();
    }

    bindEvents() {
        // Upload button
        document.getElementById('mediaUploadBtn').addEventListener('click', () => {
            document.getElementById('mediaUploadInput').click();
        });

        // File input change
        document.getElementById('mediaUploadInput').addEventListener('change', (e) => {
            this.uploadFiles(e.target.files);
        });

        // Search
        document.getElementById('mediaSearchInput').addEventListener('input', (e) => {
            this.filterImages(e.target.value);
        });

        // Select button
        document.getElementById('mediaSelectBtn').addEventListener('click', () => {
            this.confirmSelection();
        });
    }

    async open(callback, options = {}) {
        this.onSelect = callback || this.onSelect;
        this.multiple = options.multiple !== false;
        this.selectedImages = [];
        this.updateSelectedCount();
        await this.loadImages();
        this.modal.show();
    }

    async loadImages() {
        const grid = document.getElementById('mediaGrid');
        grid.innerHTML = `
            <div class="text-center py-5" style="grid-column: 1/-1;">
                <div class="spinner-border text-gold" role="status"></div>
                <p class="mt-2 text-muted">جاري تحميل الصور...</p>
            </div>`;

        try {
            const data = await Admin.adminFetch('/api/admin/media');
            
            this.allImages = data.images || [];
            document.getElementById('mediaCount').textContent = `${this.allImages.length} صورة`;
            
            this.renderImages(this.allImages);
        } catch (error) {
            console.error('Failed to load media:', error);
            grid.innerHTML = `
                <div class="media-empty" style="grid-column: 1/-1;">
                    <i class="bi bi-exclamation-circle"></i>
                    <p>فشل تحميل الصور</p>
                </div>`;
        }
    }

    renderImages(images) {
        const grid = document.getElementById('mediaGrid');
        
        if (images.length === 0) {
            grid.innerHTML = `
                <div class="media-empty" style="grid-column: 1/-1;">
                    <i class="bi bi-images"></i>
                    <p>لا توجد صور مرفوعة</p>
                    <button class="btn btn-gold btn-sm" onclick="document.getElementById('mediaUploadInput').click()">
                        <i class="bi bi-cloud-upload me-1"></i>رفع صور
                    </button>
                </div>`;
            return;
        }

        grid.innerHTML = images.map(img => `
            <div class="media-item" data-url="${img.url}" data-filename="${img.filename}">
                <img src="${img.url}" alt="${img.filename}" loading="lazy">
                <div class="select-check">
                    <i class="bi bi-check"></i>
                </div>
                <button class="delete-btn" onclick="event.stopPropagation(); mediaLibrary.deleteImage('${img.filename}')">
                    <i class="bi bi-trash"></i>
                </button>
                <div class="media-overlay">
                    <div class="text-truncate">${img.filename}</div>
                    <small>${this.formatSize(img.size)}</small>
                </div>
            </div>
        `).join('');

        // Bind click events
        grid.querySelectorAll('.media-item').forEach(item => {
            item.addEventListener('click', () => this.toggleSelect(item));
        });
    }

    toggleSelect(item) {
        const url = item.dataset.url;
        
        if (!this.multiple) {
            // Single selection mode
            document.querySelectorAll('.media-item.selected').forEach(el => el.classList.remove('selected'));
            this.selectedImages = [];
        }

        if (item.classList.contains('selected')) {
            item.classList.remove('selected');
            this.selectedImages = this.selectedImages.filter(img => img.url !== url);
        } else {
            item.classList.add('selected');
            this.selectedImages.push({
                url: url,
                filename: item.dataset.filename
            });
        }

        this.updateSelectedCount();
    }

    updateSelectedCount() {
        const count = this.selectedImages.length;
        const text = count === 0 ? 'لم يتم تحديد صور' : `تم تحديد ${count} صورة`;
        document.getElementById('selectedCountText').textContent = text;
        document.getElementById('mediaSelectBtn').disabled = count === 0;
    }

    filterImages(query) {
        const filtered = this.allImages.filter(img => 
            img.filename.toLowerCase().includes(query.toLowerCase())
        );
        this.renderImages(filtered);
    }

    async uploadFiles(files) {
        if (!files || files.length === 0) return;

        try {
            Admin.showLoading('جاري رفع الصور...');
            await Admin.uploadMultipleImages(files);
            Admin.showAlert('تم رفع الصور بنجاح', 'success');
            await this.loadImages();
        } catch (error) {
            console.error('Upload error:', error);
            Admin.showAlert('فشل رفع الصور', 'danger');
        } finally {
            Admin.hideLoading();
            document.getElementById('mediaUploadInput').value = '';
        }
    }

    async deleteImage(filename) {
        if (!confirm(`هل تريد حذف الصورة "${filename}"؟`)) return;

        try {
            await Admin.adminFetch(`/api/admin/media/${encodeURIComponent(filename)}`, {
                method: 'DELETE'
            });
            Admin.showAlert('تم حذف الصورة', 'success');
            this.selectedImages = this.selectedImages.filter(img => img.filename !== filename);
            await this.loadImages();
        } catch (error) {
            console.error('Delete error:', error);
            Admin.showAlert('فشل حذف الصورة', 'danger');
        }
    }

    confirmSelection() {
        if (this.selectedImages.length > 0) {
            this.onSelect(this.multiple ? this.selectedImages : this.selectedImages[0]);
            this.modal.hide();
        }
    }

    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
}

// Global instance
let mediaLibrary;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    mediaLibrary = new MediaLibrary();
});

// Helper function to open media library
function openMediaLibrary(callback, options = {}) {
    if (!mediaLibrary) {
        mediaLibrary = new MediaLibrary();
    }
    mediaLibrary.open(callback, options);
}
