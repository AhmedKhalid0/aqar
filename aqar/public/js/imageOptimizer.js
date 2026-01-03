/**
 * Image Optimizer - تحسين تسليم الصور
 * Lazy loading, WebP support, responsive images
 */

class ImageOptimizer {
    constructor() {
        this.observer = null;
        this.placeholderColor = '#f0f0f0';
        this.init();
    }

    init() {
        // Setup Intersection Observer for lazy loading
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadImage(entry.target);
                        this.observer.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.01
            });
        }

        // Process existing images
        this.processImages();

        // Watch for new images added to DOM
        this.watchDOM();
    }

    processImages() {
        document.querySelectorAll('img[data-src], img.lazy').forEach(img => {
            this.prepareImage(img);
        });
    }

    prepareImage(img) {
        // Add loading placeholder
        if (!img.src || img.src.includes('data:image')) {
            img.style.backgroundColor = this.placeholderColor;
        }

        // Add blur effect while loading
        img.style.filter = 'blur(5px)';
        img.style.transition = 'filter 0.3s ease-out';

        if (this.observer) {
            this.observer.observe(img);
        } else {
            // Fallback for browsers without IntersectionObserver
            this.loadImage(img);
        }
    }

    loadImage(img) {
        const src = img.dataset.src || img.src;
        if (!src) return;

        // Create new image to preload
        const newImg = new Image();
        
        newImg.onload = () => {
            img.src = newImg.src;
            img.style.filter = 'none';
            img.style.backgroundColor = 'transparent';
            img.classList.add('loaded');
            img.removeAttribute('data-src');
        };

        newImg.onerror = () => {
            img.src = '/images/placeholder.jpg';
            img.style.filter = 'none';
            img.alt = 'Image not available';
        };

        // Check WebP support and use if available
        if (this.supportsWebP() && src.match(/\.(jpg|jpeg|png)$/i)) {
            // Try WebP version first (if server supports it)
            newImg.src = src;
        } else {
            newImg.src = src;
        }
    }

    supportsWebP() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }

    watchDOM() {
        const mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeName === 'IMG') {
                        if (node.dataset.src || node.classList.contains('lazy')) {
                            this.prepareImage(node);
                        }
                    }
                    if (node.querySelectorAll) {
                        node.querySelectorAll('img[data-src], img.lazy').forEach(img => {
                            this.prepareImage(img);
                        });
                    }
                });
            });
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Utility: Convert image URL to optimized version
    static optimizeUrl(url, width = 400, quality = 80) {
        if (!url) return '/images/placeholder.jpg';
        
        // If already a full URL, return as is
        if (url.startsWith('http')) return url;
        
        // Ensure leading slash
        if (!url.startsWith('/')) url = '/' + url;
        
        return url;
    }

    // Generate srcset for responsive images
    static generateSrcset(url, sizes = [320, 640, 960, 1280]) {
        return sizes.map(size => `${url} ${size}w`).join(', ');
    }
}

// Helper function to create optimized image HTML
function createOptimizedImage(src, alt = '', className = '', sizes = '(max-width: 768px) 100vw, 50vw') {
    const optimizedSrc = ImageOptimizer.optimizeUrl(src);
    
    return `
        <img 
            data-src="${optimizedSrc}"
            alt="${alt}"
            class="lazy ${className}"
            loading="lazy"
            style="background-color: #f0f0f0;"
        >
    `;
}

// Helper for background images with lazy loading
function lazyBackgroundImage(element, imageUrl) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.backgroundImage = `url('${imageUrl}')`;
                observer.unobserve(entry.target);
            }
        });
    });
    
    observer.observe(element);
}

// CSS for image loading states
const imageStyles = `
<style>
img.lazy {
    opacity: 0;
    transition: opacity 0.3s ease-in;
}
img.lazy.loaded {
    opacity: 1;
}
.image-container {
    position: relative;
    overflow: hidden;
    background-color: #f0f0f0;
}
.image-container::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
    animation: shimmer 1.5s infinite;
}
.image-container.loaded::before {
    display: none;
}
@keyframes shimmer {
    100% { left: 100%; }
}
</style>
`;

// Inject styles
if (!document.querySelector('#image-optimizer-styles')) {
    const styleEl = document.createElement('div');
    styleEl.id = 'image-optimizer-styles';
    styleEl.innerHTML = imageStyles;
    document.head.appendChild(styleEl);
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    window.imageOptimizer = new ImageOptimizer();
});

// Export
window.ImageOptimizer = ImageOptimizer;
window.createOptimizedImage = createOptimizedImage;
window.lazyBackgroundImage = lazyBackgroundImage;
