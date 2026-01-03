/**
 * Media Picker Component
 * Reusable component for selecting images from library, external URL, or upload
 */

const MediaPicker = {
    modalId: 'mediaPickerModal',
    currentCallback: null,
    mediaItems: [],

    /**
     * Initialize the media picker - call once on page load
     */
    init() {
        if (document.getElementById(this.modalId)) return;

        const modalHTML = `
        <div class="modal fade" id="${this.modalId}" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">اختر صورة</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Tabs -->
                        <ul class="nav nav-tabs mb-3" role="tablist">
                            <li class="nav-item">
                                <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#mpLibrary">
                                    <i class="bi bi-images me-2"></i>المكتبة
                                </button>
                            </li>
                            <li class="nav-item">
                                <button class="nav-link" data-bs-toggle="tab" data-bs-target="#mpExternal">
                                    <i class="bi bi-link-45deg me-2"></i>رابط خارجي
                                </button>
                            </li>
                            <li class="nav-item">
                                <button class="nav-link" data-bs-toggle="tab" data-bs-target="#mpUpload">
                                    <i class="bi bi-cloud-upload me-2"></i>رفع جديد
                                </button>
                            </li>
                        </ul>

                        <!-- Tab Content -->
                        <div class="tab-content">
                            <!-- Library Tab -->
                            <div class="tab-pane fade show active" id="mpLibrary">
                                <div class="mb-3">
                                    <input type="text" class="form-control" id="mpSearchInput" placeholder="بحث في المكتبة...">
                                </div>
                                <div class="mp-grid" id="mpLibraryGrid">
                                    <div class="text-center py-4 text-muted">جاري التحميل...</div>
                                </div>
                            </div>

                            <!-- External URL Tab -->
                            <div class="tab-pane fade" id="mpExternal">
                                <div class="mb-3">
                                    <label class="form-label">رابط الصورة</label>
                                    <input type="url" class="form-control" id="mpExternalUrl" placeholder="https://example.com/image.jpg">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">معاينة</label>
                                    <div class="mp-preview" id="mpExternalPreview">
                                        <span class="text-muted">أدخل رابط صورة للمعاينة</span>
                                    </div>
                                </div>
                                <button type="button" class="btn btn-gold" id="mpUseExternalBtn" disabled>
                                    <i class="bi bi-check2 me-2"></i>استخدام هذا الرابط
                                </button>
                            </div>

                            <!-- Upload Tab -->
                            <div class="tab-pane fade" id="mpUpload">
                                <div class="mp-upload-zone" id="mpUploadZone">
                                    <i class="bi bi-cloud-upload d-block mb-2" style="font-size: 2rem; color: var(--gold-primary);"></i>
                                    <p class="mb-1">اسحب صورة هنا أو انقر للاختيار</p>
                                    <small class="text-muted">JPG, PNG, GIF, SVG - حد أقصى 5MB</small>
                                </div>
                                <input type="file" id="mpFileInput" accept="image/*" style="display: none;">
                                <div id="mpUploadProgress" class="mt-3" style="display: none;">
                                    <div class="progress">
                                        <div class="progress-bar bg-gold" role="progressbar" style="width: 0%"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <style>
            .mp-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                gap: 10px;
                max-height: 350px;
                overflow-y: auto;
            }
            .mp-grid-item {
                aspect-ratio: 1;
                border-radius: 8px;
                overflow: hidden;
                cursor: pointer;
                border: 2px solid transparent;
                transition: all 0.2s;
            }
            .mp-grid-item:hover {
                border-color: var(--gold-primary);
                transform: scale(1.05);
            }
            .mp-grid-item.selected {
                border-color: var(--gold-primary);
                box-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
            }
            .mp-grid-item img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .mp-preview {
                border: 1px dashed var(--border-color);
                border-radius: 10px;
                padding: 20px;
                text-align: center;
                min-height: 150px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .mp-preview img {
                max-width: 100%;
                max-height: 200px;
                border-radius: 5px;
            }
            .mp-upload-zone {
                border: 2px dashed var(--gold-primary);
                border-radius: 10px;
                padding: 30px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s;
            }
            .mp-upload-zone:hover {
                background: rgba(212, 175, 55, 0.1);
            }
        </style>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.initEvents();
    },

    initEvents() {
        // Search
        document.getElementById('mpSearchInput').addEventListener('input', (e) => {
            this.renderLibrary(e.target.value);
        });

        // External URL preview
        const urlInput = document.getElementById('mpExternalUrl');
        urlInput.addEventListener('input', () => {
            const url = urlInput.value.trim();
            const preview = document.getElementById('mpExternalPreview');
            const btn = document.getElementById('mpUseExternalBtn');

            if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                preview.innerHTML = `<img src="${url}" onerror="this.parentElement.innerHTML='<span class=\\'text-danger\\'>فشل تحميل الصورة</span>'" onload="document.getElementById('mpUseExternalBtn').disabled=false">`;
            } else {
                preview.innerHTML = '<span class="text-muted">أدخل رابط صورة للمعاينة</span>';
                btn.disabled = true;
            }
        });

        // Use external URL button
        document.getElementById('mpUseExternalBtn').addEventListener('click', () => {
            const url = document.getElementById('mpExternalUrl').value.trim();
            if (url && this.currentCallback) {
                this.currentCallback(url);
                this.close();
            }
        });

        // Upload zone
        const zone = document.getElementById('mpUploadZone');
        const input = document.getElementById('mpFileInput');

        zone.addEventListener('click', () => input.click());
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.style.background = 'rgba(212, 175, 55, 0.2)';
        });
        zone.addEventListener('dragleave', () => {
            zone.style.background = '';
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.style.background = '';
            this.handleUpload(e.dataTransfer.files[0]);
        });
        input.addEventListener('change', () => {
            if (input.files[0]) {
                this.handleUpload(input.files[0]);
            }
        });
    },

    async loadLibrary() {
        try {
            const response = await Admin.adminFetch('/api/admin/media');
            this.mediaItems = response.images || [];
            this.renderLibrary();
        } catch (error) {
            console.error('Error loading media:', error);
            document.getElementById('mpLibraryGrid').innerHTML = '<div class="text-center text-danger">فشل تحميل المكتبة</div>';
        }
    },

    renderLibrary(searchQuery = '') {
        const grid = document.getElementById('mpLibraryGrid');
        let items = this.mediaItems;

        if (searchQuery) {
            items = items.filter(item => item.filename.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        if (items.length === 0) {
            grid.innerHTML = '<div class="text-center py-4 text-muted">لا توجد صور</div>';
            return;
        }

        grid.innerHTML = items.map(item => `
            <div class="mp-grid-item" data-url="${item.url}" onclick="MediaPicker.selectFromLibrary('${item.url}')">
                <img src="${item.url}" alt="${item.filename}" loading="lazy">
            </div>
        `).join('');
    },

    selectFromLibrary(url) {
        // Remove previous selection
        document.querySelectorAll('.mp-grid-item.selected').forEach(el => el.classList.remove('selected'));

        // Add selection to clicked item
        const item = document.querySelector(`.mp-grid-item[data-url="${url}"]`);
        if (item) item.classList.add('selected');

        // Callback
        if (this.currentCallback) {
            this.currentCallback(url);
            this.close();
        }
    },

    async handleUpload(file) {
        if (!file) return;

        const progress = document.getElementById('mpUploadProgress');
        const progressBar = progress.querySelector('.progress-bar');

        progress.style.display = 'block';
        progressBar.style.width = '50%';

        try {
            const formData = new FormData();
            formData.append('image', file);

            const response = await Admin.adminFetch('/api/upload', {
                method: 'POST',
                body: formData,
                isFormData: true
            });

            progressBar.style.width = '100%';

            if (response.url && this.currentCallback) {
                this.currentCallback(response.url);
                this.close();
                Admin.showAlert('تم رفع الصورة بنجاح');
            }
        } catch (error) {
            console.error('Upload error:', error);
            Admin.showAlert('فشل رفع الصورة', 'danger');
        } finally {
            progress.style.display = 'none';
            progressBar.style.width = '0%';
            document.getElementById('mpFileInput').value = '';
        }
    },

    /**
     * Open the media picker
     * @param {Function} callback - Called with selected URL
     */
    open(callback) {
        this.init();
        this.currentCallback = callback;
        this.loadLibrary();

        // Reset state
        document.getElementById('mpExternalUrl').value = '';
        document.getElementById('mpExternalPreview').innerHTML = '<span class="text-muted">أدخل رابط صورة للمعاينة</span>';
        document.getElementById('mpUseExternalBtn').disabled = true;

        // Show first tab
        const firstTab = document.querySelector(`#${this.modalId} .nav-link`);
        if (firstTab) {
            bootstrap.Tab.getOrCreateInstance(firstTab).show();
        }

        new bootstrap.Modal(document.getElementById(this.modalId)).show();
    },

    close() {
        const modal = bootstrap.Modal.getInstance(document.getElementById(this.modalId));
        if (modal) modal.hide();
    }
};

// Make available globally
window.MediaPicker = MediaPicker;
