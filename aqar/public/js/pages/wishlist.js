/**
 * Wishlist Page Module
 */

Site.pages.wishlist = async function () {
    const lang = getCurrentLang();
    const wishlist = Site.getWishlist();
    const container = document.getElementById('wishlistGrid');
    if (!container) return;

    if (!wishlist || wishlist.length === 0) {
        Site.showEmpty(container, lang === 'ar' ? 'قائمة الأمنيات فارغة' : 'Wishlist is empty', 'bi-heart');
        return;
    }

    try {
        const [units, projects] = await Promise.all([
            Site.fetchAPI('/api/units'),
            Site.fetchAPI('/api/projects')
        ]);

        // Filter units that are in wishlist (wishlist contains unit IDs or unit objects)
        const wishlistIds = wishlist.map(item => typeof item === 'string' ? item : item.id);
        const wishlistUnits = units.filter(u => wishlistIds.includes(u.id));

        container.innerHTML = '';

        if (wishlistUnits.length === 0) {
            Site.showEmpty(container, lang === 'ar' ? 'الوحدات المحفوظة غير متوفرة' : 'Saved units not available', 'bi-heart');
            return;
        }

        wishlistUnits.forEach(unit => {
            const project = projects.find(p => p.id === unit.projectId);
            const projectImage = project?.images?.[0] || null;
            container.appendChild(Site.createUnitCard(unit, projectImage));
        });
    } catch (error) {
        console.error('Error loading wishlist:', error);
    }
};
