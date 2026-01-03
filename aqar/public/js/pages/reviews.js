/**
 * Reviews Page Module
 */

Site.pages.reviews = async function () {
    const lang = getCurrentLang();

    try {
        const reviews = await Site.fetchAPI('/api/reviews');
        const container = document.getElementById('reviewsGrid');
        if (!container) return;

        if (!reviews || reviews.length === 0) {
            Site.showEmpty(container, lang === 'ar' ? 'لا توجد آراء' : 'No reviews', 'bi-chat-quote');
        } else {
            container.innerHTML = '';
            reviews.forEach(review => container.appendChild(Site.createReviewCard(review)));
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
    }

    // Initialize star rating functionality
    initStarRating();

    // Initialize review form submission
    initReviewForm();
};

/**
 * Initialize interactive star rating
 */
function initStarRating() {
    const ratingContainer = document.getElementById('ratingInput');
    const ratingInput = document.getElementById('reviewRating');

    if (!ratingContainer || !ratingInput) return;

    const stars = ratingContainer.querySelectorAll('i');
    let currentRating = 5; // Default rating

    // Set initial state (5 stars filled)
    updateStars(stars, currentRating);

    stars.forEach((star, index) => {
        const rating = index + 1;

        // Hover effect
        star.addEventListener('mouseenter', () => {
            updateStars(stars, rating);
        });

        // Mouse leave - restore current rating
        star.addEventListener('mouseleave', () => {
            updateStars(stars, currentRating);
        });

        // Click to set rating
        star.addEventListener('click', () => {
            currentRating = rating;
            ratingInput.value = rating;
            updateStars(stars, currentRating);
        });

        // Add cursor pointer style
        star.style.cursor = 'pointer';
    });
}

/**
 * Update stars display based on rating
 */
function updateStars(stars, rating) {
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.remove('bi-star');
            star.classList.add('bi-star-fill');
            star.style.color = '#d4af37'; // Gold color
        } else {
            star.classList.remove('bi-star-fill');
            star.classList.add('bi-star');
            star.style.color = '#6c757d'; // Gray color
        }
    });
}

/**
 * Initialize review form submission
 */
function initReviewForm() {
    const form = document.getElementById('reviewForm');
    const successMessage = document.getElementById('reviewSuccess');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('reviewName').value.trim();
        const rating = parseInt(document.getElementById('reviewRating').value);
        const comment = document.getElementById('reviewComment').value.trim();

        if (!name || !comment) {
            alert(getCurrentLang() === 'ar' ? 'يرجى ملء جميع الحقول' : 'Please fill all fields');
            return;
        }

        const submitBtn = document.getElementById('submitReview');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = getCurrentLang() === 'ar' ? 'جاري الإرسال...' : 'Sending...';

        try {
            const response = await fetch('/api/reviews', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    rating,
                    comment
                })
            });

            if (response.ok) {
                // Show success message
                if (successMessage) {
                    successMessage.style.display = 'block';
                    successMessage.textContent = getCurrentLang() === 'ar'
                        ? 'شكراً! سيتم مراجعة تقييمك ونشره قريباً.'
                        : 'Thank you! Your review will be reviewed and published soon.';
                }

                // Reset form
                form.reset();

                // Reset stars to default (5 stars)
                const ratingContainer = document.getElementById('ratingInput');
                if (ratingContainer) {
                    const stars = ratingContainer.querySelectorAll('i');
                    updateStars(stars, 5);
                }
                document.getElementById('reviewRating').value = 5;

                // Hide success message after 5 seconds
                setTimeout(() => {
                    if (successMessage) {
                        successMessage.style.display = 'none';
                    }
                }, 5000);
            } else {
                throw new Error('Failed to submit review');
            }
        } catch (error) {
            console.error('Error submitting review:', error);
            alert(getCurrentLang() === 'ar' ? 'حدث خطأ أثناء الإرسال. يرجى المحاولة مرة أخرى.' : 'An error occurred. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}
