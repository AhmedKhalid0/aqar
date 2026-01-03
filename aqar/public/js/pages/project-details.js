/**
 * Project Details Page Module
 */

Site.pages.projectDetails = async function () {
    const lang = getCurrentLang();
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');
    const container = document.getElementById('projectContent');

    if (!projectId) {
        window.location.href = '/projects.html';
        return;
    }

    try {
        const project = await Site.fetchAPI(`/api/projects/${projectId}`);
        if (!project) {
            if (container) Site.showEmpty(container, lang === 'ar' ? 'المشروع غير موجود' : 'Project not found');
            return;
        }

        document.title = `${project.title?.[lang] || project.title?.ar} | عقار`;
        const breadcrumb = document.getElementById('breadcrumbTitle');
        if (breadcrumb) breadcrumb.textContent = project.title?.[lang] || project.title?.ar || '';

        // Generate full HTML content for project details
        if (container) {
            container.innerHTML = `
                <div class="row">
                    <div class="col-lg-8">
                        <div class="details-gallery mb-4">
                            <img src="${project.images?.[0] || '/images/placeholder.jpg'}" alt="${project.title?.[lang] || project.title?.ar}" class="details-main-image">
                            ${(project.images && project.images.length > 1) ? `
                                <div class="details-thumbnails pt-2">
                                    ${project.images.map((img, i) => `
                                        <img src="${img}" class="${i === 0 ? 'active' : ''}" onclick="this.parentElement.previousElementSibling.src='${img}'; this.parentElement.querySelectorAll('img').forEach(im => im.classList.remove('active')); this.classList.add('active');">
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>

                        <div class="details-info mb-4">
                            <h1 class="h2 mb-3">${project.title?.[lang] || project.title?.ar || ''}</h1>
                            <p class="text-muted mb-4">
                                ${project.location ? `<i class="bi bi-geo-alt-fill text-gold"></i> ${project.location?.[lang] || project.location?.ar || ''}` : ''}
                                ${project.developer ? `<span class="mx-3">|</span><i class="bi bi-building text-gold"></i> ${project.developer?.[lang] || project.developer?.ar || ''}` : ''}
                            </p>

                            <div class="mb-4 text-muted" style="line-height: 1.8;">${project.description?.[lang] || project.description?.ar || (lang === 'ar' ? 'لا يوجد وصف' : 'No description')}</div>

                            ${(project.amenities?.ar || []).length > 0 ? `
                                <h4>${lang === 'ar' ? 'المرافق' : 'Amenities'}</h4>
                                <div class="row">
                                    ${(project.amenities?.[lang] || project.amenities?.ar || []).map(a => `
                                        <div class="col-md-4 col-6 mb-3">
                                            <div class="feature-item">
                                                <i class="bi bi-check-circle-fill"></i>
                                                <span>${a}</span>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="col-lg-4">
                        <div class="details-price-box mb-4">
                            <p class="mb-2">${lang === 'ar' ? 'نطاق السعر' : 'Price Range'}</p>
                            <div class="details-price" style="font-size: 1.5rem;">
                                ${Site.formatPrice(project.priceRange?.min)} - ${Site.formatPrice(project.priceRange?.max)}
                            </div>
                        </div>

                        <div class="details-info mb-4">
                            <div class="row text-center">
                                <div class="col-6 mb-3">
                                    <div class="display-6 text-gold fw-bold">${project.totalUnits || 0}</div>
                                    <small class="text-muted">${lang === 'ar' ? 'إجمالي الوحدات' : 'Total Units'}</small>
                                </div>
                                <div class="col-6 mb-3">
                                    <div class="display-6 text-gold fw-bold">${project.availableUnits || 0}</div>
                                    <small class="text-muted">${lang === 'ar' ? 'وحدات متاحة' : 'Available'}</small>
                                </div>
                            </div>
                        </div>

                        <div class="details-info">
                            <h5 class="mb-4">${lang === 'ar' ? 'تواصل معنا' : 'Contact Us'}</h5>
                            <a href="https://wa.me/${Site.whatsapp || Config.DEFAULT_WHATSAPP}?text=${encodeURIComponent((lang === 'ar' ? 'أريد الاستفسار عن مشروع: ' : 'I want to inquire about project: ') + (project.title?.[lang] || project.title?.ar))}" 
                               class="btn btn-success w-100 mb-3" target="_blank">
                                <i class="bi bi-whatsapp me-2"></i> ${lang === 'ar' ? 'واتساب' : 'WhatsApp'}
                            </a>
                            <a href="tel:${Site.phone || Config.DEFAULT_PHONE}" class="btn btn-navy w-100">
                                <i class="bi bi-telephone-fill me-2"></i> ${lang === 'ar' ? 'اتصال' : 'Call'}
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }

        // Load project units
        const units = await Site.fetchAPI(`/api/units?projectId=${projectId}`);
        const unitsContainer = document.getElementById('projectUnits');
        if (unitsContainer) {
            if (units && units.length > 0) {
                unitsContainer.innerHTML = '';
                units.forEach(unit => unitsContainer.appendChild(Site.createUnitCard(unit)));
            } else {
                Site.showEmpty(unitsContainer, lang === 'ar' ? 'لا توجد وحدات متاحة في هذا المشروع حالياً' : 'No units available in this project currently');
            }
        }
    } catch (error) {
        console.error('Error loading project details:', error);
        if (container) Site.showError(container, lang === 'ar' ? 'حدث خطأ في تحميل البيانات' : 'Error loading data');
    }
};
