/**
 * Storage Utilities Module
 * Handles localStorage operations (wishlist, preferences)
 */

// ========================================
// Wishlist Functions
// ========================================

/**
 * Get wishlist from localStorage
 * @returns {Array} - Array of wishlist items
 */
Site.getWishlist = function () {
    return JSON.parse(localStorage.getItem('wishlist') || '[]');
};

/**
 * Save wishlist to localStorage
 * @param {Array} wishlist - Wishlist array to save
 */
Site.saveWishlist = function (wishlist) {
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    Site.updateWishlistCount();
};

/**
 * Add unit to wishlist
 * @param {Object} unit - Unit object to add
 * @returns {boolean} - True if added, false if already exists
 */
Site.addToWishlist = function (unit) {
    const wishlist = Site.getWishlist();
    if (!wishlist.find(u => u.id === unit.id)) {
        wishlist.push(unit);
        Site.saveWishlist(wishlist);
        return true;
    }
    return false;
};

/**
 * Remove unit from wishlist
 * @param {string} unitId - Unit ID to remove
 */
Site.removeFromWishlist = function (unitId) {
    let wishlist = Site.getWishlist();
    wishlist = wishlist.filter(u => u.id !== unitId);
    Site.saveWishlist(wishlist);
};

/**
 * Check if unit is in wishlist
 * @param {string} unitId - Unit ID to check
 * @returns {boolean} - True if in wishlist
 */
Site.isInWishlist = function (unitId) {
    const wishlist = Site.getWishlist();
    return wishlist.some(u => u.id === unitId);
};

/**
 * Toggle unit in wishlist
 * @param {Object} unit - Unit object
 * @param {HTMLElement} button - Wishlist button element
 */
Site.toggleWishlist = function (unit, button) {
    if (Site.isInWishlist(unit.id)) {
        Site.removeFromWishlist(unit.id);
        button.classList.remove('active');
        button.innerHTML = '<i class="bi bi-heart"></i>';
    } else {
        Site.addToWishlist(unit);
        button.classList.add('active');
        button.innerHTML = '<i class="bi bi-heart-fill"></i>';
    }
};

/**
 * Update wishlist count badges in UI
 */
Site.updateWishlistCount = function () {
    const count = Site.getWishlist().length;
    const badges = document.querySelectorAll('.wishlist-count');
    badges.forEach(badge => {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    });
};
