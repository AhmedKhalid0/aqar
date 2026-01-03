/**
 * Card Components Module
 * Contains all card generator functions
 */

/**
 * Create a unit card element
 * @param {Object} unit - Unit data object
 * @param {string} projectImage - Fallback project image
 * @returns {HTMLElement} - Card element
 */
Site.createUnitCard = function (unit, projectImage = null) {
    const lang = getCurrentLang();
    const title = Site.getLocalized(unit, 'title');
    const location = Site.getLocalized(unit, 'location');
    const inWishlist = Site.isInWishlist(unit.id);

    // Use project image as fallback if unit has no images
    const unitImage = unit.images?.[0] || projectImage || Config.PLACEHOLDER_IMAGE;

    // Unit status badge
    const statusConfig = {
        'available': { ar: 'متاح', en: 'Available', class: 'bg-success' },
        'sold': { ar: 'مباع', en: 'Sold', class: 'bg-danger' },
        'reserved': { ar: 'محجوز', en: 'Reserved', class: 'bg-warning text-dark' }
    };
    const status = statusConfig[unit.unitStatus] || statusConfig['available'];
    const statusText = lang === 'ar' ? status.ar : status.en;

    const card = document.createElement('div');
    card.className = 'col-lg-4 col-md-6 mb-4';
    card.innerHTML = `
        <div class="unit-card">
            <div class="card-img-wrapper">
                <img src="${unitImage}" alt="${title}" loading="lazy">
                <span class="unit-status-badge ${status.class}">${statusText}</span>
                ${unit.featured ? `<span class="card-badge">${lang === 'ar' ? 'مميز' : 'Featured'}</span>` : ''}
                <button class="wishlist-btn ${inWishlist ? 'active' : ''}" data-unit-id="${unit.id}" title="${lang === 'ar' ? 'المفضلة' : 'Wishlist'}">
                    <i class="bi bi-heart${inWishlist ? '-fill' : ''}"></i>
                </button>
            </div>
            <div class="card-body">
                <h5 class="card-title">${title}</h5>
                <p class="card-location">
                    <i class="bi bi-geo-alt-fill"></i> ${location}
                </p>
                <div class="card-features">
                    <span><i class="bi bi-door-open"></i> ${unit.bedrooms} ${lang === 'ar' ? 'غرف' : 'Beds'}</span>
                    <span><i class="bi bi-droplet"></i> ${unit.bathrooms} ${lang === 'ar' ? 'حمام' : 'Bath'}</span>
                    <span><i class="bi bi-arrows-angle-expand"></i> ${unit.area} ${lang === 'ar' ? 'م²' : 'sqm'}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <span class="card-price">${Site.formatPrice(unit.price)}</span>
                    <a href="/unit-details.html?id=${unit.id}" class="btn btn-navy btn-sm" aria-label="${lang === 'ar' ? 'عرض تفاصيل ' + title : 'View details of ' + title}">
                        ${lang === 'ar' ? 'التفاصيل' : 'Details'}
                    </a>
                </div>
            </div>
        </div>
    `;

    // Add wishlist button event
    const wishlistBtn = card.querySelector('.wishlist-btn');
    wishlistBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        Site.toggleWishlist(unit, wishlistBtn);
    });

    return card;
};

/**
 * Create a project card element
 * @param {Object} project - Project data object
 * @returns {HTMLElement} - Card element
 */
Site.createProjectCard = function (project) {
    const lang = getCurrentLang();
    const title = Site.getLocalized(project, 'title');
    const location = Site.getLocalized(project, 'location');
    const developer = Site.getLocalized(project, 'developer');

    const card = document.createElement('div');
    card.className = 'col-lg-4 col-md-6 mb-4';
    card.innerHTML = `
        <div class="project-card">
            <div class="card-img-wrapper">
                <img src="${project.images?.[0] || Config.PLACEHOLDER_IMAGE}" alt="${title}" loading="lazy">
                ${project.featured ? `<span class="card-badge">${lang === 'ar' ? 'مميز' : 'Featured'}</span>` : ''}
            </div>
            <div class="card-body">
                <h5 class="card-title">${title}</h5>
                <p class="card-location">
                    <i class="bi bi-geo-alt-fill"></i> ${location}
                </p>
                <p class="text-muted mb-2">
                    <i class="bi bi-building text-gold"></i> ${developer}
                </p>
                <div class="d-flex justify-content-between align-items-center">
                    <span class="text-navy">
                        <strong>${project.availableUnits}</strong> ${lang === 'ar' ? 'وحدة متاحة' : 'Available'}
                    </span>
                    <a href="/project-details.html?id=${project.id}" class="btn btn-gold btn-sm" aria-label="${lang === 'ar' ? 'عرض تفاصيل ' + title : 'View details of ' + title}">
                        ${lang === 'ar' ? 'التفاصيل' : 'Details'}
                    </a>
                </div>
            </div>
        </div>
    `;

    return card;
};

/**
 * Create a news card element
 * @param {Object} article - News article data
 * @returns {HTMLElement} - Card element
 */
Site.createNewsCard = function (article) {
    const lang = getCurrentLang();
    const title = Site.getLocalized(article, 'title');
    const excerpt = Site.getLocalized(article, 'excerpt');
    const date = new Date(article.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US');

    const card = document.createElement('div');
    card.className = 'col-lg-4 col-md-6 mb-4';
    card.innerHTML = `
        <a href="/news-details.html?id=${article.id}" class="text-decoration-none">
            <div class="news-card" style="cursor: pointer;">
                <div class="card-img-wrapper">
                    <img src="${article.image || '/images/placeholder.jpg'}" alt="${title}" loading="lazy">
                </div>
                <div class="card-body">
                    <p class="text-muted small mb-2">
                        <i class="bi bi-calendar3 text-gold"></i> ${date}
                    </p>
                    <h5 class="card-title text-navy">${title}</h5>
                    <p class="text-muted">${excerpt}</p>
                    <span class="btn btn-outline-navy btn-sm">
                        ${lang === 'ar' ? 'اقرأ المزيد' : 'Read More'}
                    </span>
                </div>
            </div>
        </a>
    `;

    return card;
};

/**
 * Create a review card element
 * @param {Object} review - Review data
 * @returns {HTMLElement} - Card element
 */
Site.createReviewCard = function (review) {
    const lang = getCurrentLang();
    const comment = review.comment?.[lang] || review.comment?.ar || review.comment;
    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

    const card = document.createElement('div');
    card.className = 'col-lg-4 col-md-6 mb-4';
    card.innerHTML = `
        <div class="review-card">
            <div class="review-stars">${stars}</div>
            <p class="review-text">"${comment}"</p>
            <p class="review-author">— ${review.name}</p>
        </div>
    `;

    return card;
};
