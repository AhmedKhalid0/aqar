/**
 * UI Helper Components Module
 * Contains UI state display functions
 */

/**
 * Show loading spinner in container
 * @param {HTMLElement} container - Container element
 */
Site.showLoading = function (container) {
    container.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
        </div>
    `;
};

/**
 * Show empty state message
 * @param {HTMLElement} container - Container element
 * @param {string} message - Message to display
 * @param {string} icon - Bootstrap icon class
 */
Site.showEmpty = function (container, message, icon = 'bi-inbox') {
    container.innerHTML = `
        <div class="empty-state">
            <i class="bi ${icon}"></i>
            <h3>${message}</h3>
        </div>
    `;
};

/**
 * Show error message
 * @param {HTMLElement} container - Container element
 * @param {string} message - Error message
 */
Site.showError = function (container, message) {
    container.innerHTML = `
        <div class="alert alert-danger text-center" role="alert">
            <i class="bi bi-exclamation-triangle me-2"></i>
            ${message}
        </div>
    `;
};

/**
 * Load HTML component into element
 * @param {string} elementId - Target element ID
 * @param {string} componentPath - Path to component HTML
 */
Site.loadComponent = async function (elementId, componentPath) {
    const element = document.getElementById(elementId);
    if (!element) return;

    try {
        const response = await fetch(componentPath);
        if (response.ok) {
            const html = await response.text();
            element.innerHTML = html;

            // Execute scripts in the loaded component
            const scripts = element.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                if (oldScript.src) {
                    newScript.src = oldScript.src;
                } else {
                    newScript.textContent = oldScript.textContent;
                }
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });

            // Re-apply language after loading component
            if (typeof applyLanguage === 'function') {
                const lang = getCurrentLang();
                applyLanguage(lang);
            }

            // Update active nav link
            Site.updateActiveNavLink();
        }
    } catch (error) {
        console.error(`Error loading ${componentPath}:`, error);
    }
};

/**
 * Update active navigation link based on current URL
 */
Site.updateActiveNavLink = function () {
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || (currentPath === '/' && href === '/') ||
            (currentPath.includes(href) && href !== '/')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
};

/**
 * Initialize navbar scroll effect
 */
Site.initNavbarScroll = function () {
    window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        if (navbar) {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }
    });
};
