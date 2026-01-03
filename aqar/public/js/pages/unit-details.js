/**
 * Unit Details Page Module
 */

Site.pages.unitDetails = async function () {
    const lang = getCurrentLang();
    const params = new URLSearchParams(window.location.search);
    const unitId = params.get('id');
    const container = document.getElementById('unitContent');

    if (!unitId) {
        window.location.href = '/units.html';
        return;
    }

    try {
        const [unit, projects] = await Promise.all([
            Site.fetchAPI(`/api/units/${unitId}`),
            Site.fetchAPI('/api/projects')
        ]);

        if (!unit) {
            if (container) Site.showEmpty(container, lang === 'ar' ? 'الوحدة غير موجودة' : 'Unit not found');
            return;
        }

        // Helper for status badge
        const getStatusBadge = (status) => {
            const config = {
                'available': { ar: 'متاح', en: 'Available', class: 'bg-success' },
                'sold': { ar: 'مباع', en: 'Sold', class: 'bg-danger' },
                'reserved': { ar: 'محجوز', en: 'Reserved', class: 'bg-warning text-dark' }
            };
            const s = config[status] || config['available'];
            return `<span class="badge ${s.class} fs-6">${lang === 'ar' ? s.ar : s.en}</span>`;
        };

        const project = projects.find(p => p.id === unit.projectId);
        const projectImage = project?.images?.[0] || null;
        const mainImage = unit.images?.[0] || projectImage || '/images/placeholder.jpg';
        const hasMultipleImages = unit.images?.length > 1;
        const inWishlist = Site.isInWishlist ? Site.isInWishlist(unit.id) : false;

        document.title = `${unit.title?.[lang] || unit.title?.ar} | عقار`;
        const breadcrumb = document.getElementById('breadcrumbTitle');
        if (breadcrumb) breadcrumb.textContent = unit.title?.[lang] || unit.title?.ar || '';

        if (container) {
            container.innerHTML = `
                <div class="row">
                    <div class="col-lg-8">
                        <!-- Gallery -->
                        <div class="details-gallery mb-4">
                            <img src="${mainImage}" alt="${unit.title?.[lang] || unit.title?.ar}" class="details-main-image" id="mainImage">
                            ${hasMultipleImages ? `
                                <div class="details-thumbnails">
                                    ${unit.images.map((img, i) => `
                                        <img src="${img}" class="${i === 0 ? 'active' : ''}" onclick="document.getElementById('mainImage').src='${img}'; document.querySelectorAll('.details-thumbnails img').forEach(im => im.classList.remove('active')); this.classList.add('active');">
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>

                        <!-- Details -->
                        <div class="details-info mb-4">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <div>
                                    <h1 class="h2 mb-2">${unit.title?.[lang] || unit.title?.ar || ''}</h1>
                                    ${getStatusBadge(unit.unitStatus)}
                                </div>
                                <button class="btn ${inWishlist ? 'btn-danger' : 'btn-outline-danger'}" onclick="Site.toggleWishlist('${unit.id}', this)">
                                    <i class="bi bi-heart${inWishlist ? '-fill' : ''}"></i>
                                </button>
                            </div>
                            
                            <p class="text-muted mb-4">
                                <i class="bi bi-geo-alt-fill text-gold"></i> ${unit.location?.[lang] || unit.location?.ar || ''}
                            </p>

                            <div class="details-features">
                                <div class="feature-item">
                                    <i class="bi bi-door-open"></i>
                                    <div>
                                        <small class="text-muted">${lang === 'ar' ? 'غرف' : 'Bedrooms'}</small>
                                        <div class="fw-bold">${unit.bedrooms}</div>
                                    </div>
                                </div>
                                <div class="feature-item">
                                    <i class="bi bi-droplet"></i>
                                    <div>
                                        <small class="text-muted">${lang === 'ar' ? 'حمامات' : 'Bathrooms'}</small>
                                        <div class="fw-bold">${unit.bathrooms}</div>
                                    </div>
                                </div>
                                <div class="feature-item">
                                    <i class="bi bi-arrows-angle-expand"></i>
                                    <div>
                                        <small class="text-muted">${lang === 'ar' ? 'المساحة' : 'Area'}</small>
                                        <div class="fw-bold">${unit.area} ${lang === 'ar' ? 'م²' : 'm²'}</div>
                                    </div>
                                </div>
                                <div class="feature-item">
                                    <i class="bi bi-house"></i>
                                    <div>
                                        <small class="text-muted">${lang === 'ar' ? 'النوع' : 'Type'}</small>
                                        <div class="fw-bold">${unit.type}</div>
                                    </div>
                                </div>
                            </div>

                            ${(unit.buildingNumber || unit.floor || unit.unitNumber || unit.view || unit.gardenShare > 0) ? `
                            <div class="details-features mt-3">
                                ${unit.buildingNumber ? `<div class="feature-item"><i class="bi bi-building"></i><div><small class="text-muted">${lang === 'ar' ? 'رقم المبنى' : 'Building'}</small><div class="fw-bold">${unit.buildingNumber}</div></div></div>` : ''}
                                ${unit.floor ? `<div class="feature-item"><i class="bi bi-layers"></i><div><small class="text-muted">${lang === 'ar' ? 'الدور' : 'Floor'}</small><div class="fw-bold">${unit.floor}</div></div></div>` : ''}
                                ${unit.unitNumber ? `<div class="feature-item"><i class="bi bi-hash"></i><div><small class="text-muted">${lang === 'ar' ? 'رقم الوحدة' : 'Unit No'}</small><div class="fw-bold">${unit.unitNumber}</div></div></div>` : ''}
                                ${unit.view ? `<div class="feature-item"><i class="bi bi-eye"></i><div><small class="text-muted">${lang === 'ar' ? 'الإطلالة' : 'View'}</small><div class="fw-bold">${unit.view}</div></div></div>` : ''}
                                ${unit.gardenShare > 0 ? `<div class="feature-item"><i class="bi bi-tree"></i><div><small class="text-muted">${lang === 'ar' ? 'حديقة' : 'Garden'}</small><div class="fw-bold">${unit.gardenShare}%</div></div></div>` : ''}
                                ${unit.usableSpace ? `<div class="feature-item"><i class="bi bi-bounding-box"></i><div><small class="text-muted">${lang === 'ar' ? 'مساحة صافية' : 'Net Area'}</small><div class="fw-bold">${unit.usableSpace} ${lang === 'ar' ? 'م²' : 'm²'}</div></div></div>` : ''}
                            </div>
                            ` : ''}

                            <hr>

                            <h4 class="mb-3">${lang === 'ar' ? 'الوصف' : 'Description'}</h4>
                            <div class="mb-4 text-muted" style="line-height: 1.8;">
                                ${unit.description?.[lang] || unit.description?.ar || (lang === 'ar' ? 'لا يوجد وصف' : 'No description')}
                            </div>

                            ${(unit.features?.ar || []).length > 0 ? `
                                <h4 class="mb-3">${lang === 'ar' ? 'المميزات' : 'Features'}</h4>
                                <ul class="list-unstyled row">
                                    ${(unit.features?.[lang] || unit.features?.ar || []).map(f => `
                                        <li class="col-md-6 mb-2">
                                            <i class="bi bi-check-circle-fill text-gold me-2"></i> ${f}
                                        </li>
                                    `).join('')}
                                </ul>
                            ` : ''}
                        </div>
                    </div>

                    <div class="col-lg-4">
                        <!-- Price Box -->
                        <div class="details-price-box mb-4">
                            <p class="mb-2">${lang === 'ar' ? 'السعر' : 'Price'}</p>
                            <div class="details-price">${Site.formatPrice(unit.price)}</div>
                        </div>

                        <!-- Contact Box -->
                        <div class="details-info">
                            <h5 class="mb-4">${lang === 'ar' ? 'تواصل معنا' : 'Contact Us'}</h5>
                            <a href="https://wa.me/${Site.whatsapp || Config.DEFAULT_WHATSAPP}?text=${encodeURIComponent((lang === 'ar' ? 'استفسار عن: ' : 'Inquiry about: ') + (unit.title?.[lang] || unit.title?.ar))}" target="_blank" class="btn btn-success w-100 mb-3">
                                <i class="bi bi-whatsapp me-2"></i> ${lang === 'ar' ? 'تواصل واتساب' : 'WhatsApp'}
                            </a>
                            <a href="tel:${Site.phone || Config.DEFAULT_PHONE}" class="btn btn-navy w-100">
                                <i class="bi bi-telephone-fill me-2"></i> ${lang === 'ar' ? 'اتصال' : 'Call'}
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }

        // Load similar units with filtering
        const similarContainer = document.getElementById('similarUnits');
        if (similarContainer) {
            try {
                const similarUnits = await Site.fetchAPI('/api/units');
                const similar = similarUnits
                    .filter(u => u.id !== unit.id && u.type === unit.type)
                    .slice(0, 3);

                similarContainer.innerHTML = '';
                if (similar.length === 0) {
                    similarContainer.innerHTML = `<p class="text-muted">${lang === 'ar' ? 'لا توجد وحدات مشابهة' : 'No similar units'}</p>`;
                } else {
                    similar.forEach(u => {
                        const p = projects.find(proj => proj.id === u.projectId);
                        const pImg = p?.images?.[0] || null;
                        similarContainer.appendChild(Site.createUnitCard(u, pImg));
                    });
                }
            } catch (error) {
                console.error('Error loading similar units:', error);
            }
        }

        // Load comments
        const commentsContainer = document.getElementById('commentsContainer');
        if (commentsContainer) {
            try {
                const comments = await Site.fetchAPI(`/api/comments/unit/${unitId}`);

                if (!comments || comments.length === 0) {
                    commentsContainer.innerHTML = `<p class="text-muted">${lang === 'ar' ? 'لا توجد تعليقات بعد. كن أول من يعلق!' : 'No comments yet. Be the first to comment!'}</p>`;
                } else {
                    commentsContainer.innerHTML = comments.map(c => `
                        <div class="card mb-3">
                            <div class="card-body">
                                <div class="d-flex justify-content-between mb-2">
                                    <strong>${c.name}</strong>
                                    <small class="text-muted">${new Date(c.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}</small>
                                </div>
                                <p class="mb-0 text-muted">${c.comment}</p>
                            </div>
                        </div>
                    `).join('');
                }
            } catch (e) {
                console.error('Error loading comments', e);
            }
        }

        // Comments form handler
        const commentForm = document.getElementById('commentForm');
        if (commentForm) {
            // Remove old listeners by cloning
            const newForm = commentForm.cloneNode(true);
            commentForm.parentNode.replaceChild(newForm, commentForm);

            newForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = newForm.querySelector('button[type="submit"]');
                const originalText = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

                try {
                    const data = {
                        type: 'unit',
                        itemId: unitId,
                        name: document.getElementById('commentName').value,
                        email: document.getElementById('commentEmail').value,
                        comment: document.getElementById('commentText').value
                    };
                    await Site.fetchAPI('/api/comments', {
                        method: 'POST',
                        body: JSON.stringify(data)
                    });
                    alert(lang === 'ar' ? 'تم إرسال تعليقك وسيتم مراجعته قريباً' : 'Your comment has been submitted for review');
                    newForm.reset();
                    // Reload comments
                    if (commentsContainer) {
                        const comments = await Site.fetchAPI(`/api/comments/unit/${unitId}`);
                        if (comments && comments.length > 0) {
                            commentsContainer.innerHTML = comments.map(c => `
                                <div class="card mb-3">
                                    <div class="card-body">
                                        <div class="d-flex justify-content-between mb-2">
                                            <strong>${c.name}</strong>
                                            <small class="text-muted">${new Date(c.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}</small>
                                        </div>
                                        <p class="mb-0 text-muted">${c.comment}</p>
                                    </div>
                                </div>
                            `).join('');
                        } else {
                            commentsContainer.innerHTML = `<p class="text-muted">${lang === 'ar' ? 'لا توجد تعليقات بعد. كن أول من يعلق!' : 'No comments yet. Be the first to comment!'}</p>`;
                        }
                    }
                } catch (error) {
                    alert(lang === 'ar' ? 'حدث خطأ في إرسال التعليق' : 'An error occurred');
                    console.error(error);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }
            });
        }

    } catch (error) {
        console.error('[UnitDetails] Error:', error);
        if (container) Site.showError(container, lang === 'ar' ? 'حدث خطأ في تحميل البيانات' : 'Error loading data');
    }
};
