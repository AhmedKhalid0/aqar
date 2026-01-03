const fs = require('fs');
const path = require('path');
const { shardedDataService } = require('../lib/shardedFlatFileDB');

// Read old reviews
const oldReviewsPath = './secure_data/all_reviews.json';
if (fs.existsSync(oldReviewsPath)) {
    const oldReviews = JSON.parse(fs.readFileSync(oldReviewsPath, 'utf8'));
    console.log('Found', oldReviews.length, 'old reviews');

    const manager = shardedDataService.getManager('reviews');
    let migrated = 0;

    for (const review of oldReviews) {
        try {
            // Check if already exists
            const existing = manager.read(review.id);
            if (!existing) {
                manager.create(review);
                migrated++;
            }
        } catch (e) {
            console.error('Error migrating review:', review.id, e.message);
        }
    }

    console.log('Migrated', migrated, 'reviews to sharded system');
} else {
    console.log('No old reviews file found');
}
