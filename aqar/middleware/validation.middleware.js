/**
 * Validation Middleware
 * Centralized validation rules for the application
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Execute validation and return errors if any
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

/**
 * Validation rules for different entities
 */
const validators = {
    // ID validation
    id: param('id').trim().notEmpty().escape(),

    // Pagination validation
    pagination: [
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
    ],

    // User login validation
    userLogin: [
        body('username').trim().notEmpty().isLength({ min: 3, max: 50 }).escape(),
        body('password').notEmpty().isLength({ min: 6, max: 100 })
    ],

    // Unit validation
    unit: [
        body('title.ar').optional().trim().isLength({ max: 200 }),
        body('title.en').optional().trim().isLength({ max: 200 }),
        body('price').optional().isNumeric(),
        body('area').optional().isNumeric(),
        body('bedrooms').optional().isInt({ min: 0, max: 20 }),
        body('bathrooms').optional().isInt({ min: 0, max: 20 })
    ],

    // Project validation
    project: [
        body('title.ar').optional().trim().isLength({ max: 200 }),
        body('title.en').optional().trim().isLength({ max: 200 }),
        body('totalUnits').optional().isInt({ min: 0 }),
        body('availableUnits').optional().isInt({ min: 0 })
    ],

    // News validation
    news: [
        body('title.ar').optional().trim().isLength({ max: 300 }),
        body('title.en').optional().trim().isLength({ max: 300 }),
        body('category').optional().trim().escape()
    ],

    // Contact form validation
    contact: [
        body('name').trim().notEmpty().isLength({ min: 2, max: 100 }),
        body('email').optional().isEmail().normalizeEmail(),
        body('phone').optional().trim().isLength({ max: 20 }),
        body('message').trim().notEmpty().isLength({ min: 5, max: 2000 })
    ],

    // Review validation
    review: [
        body('name').trim().notEmpty().isLength({ min: 2, max: 100 }),
        body('content').trim().notEmpty().isLength({ min: 10, max: 1000 }),
        body('rating').optional().isInt({ min: 1, max: 5 })
    ]
};

module.exports = {
    validate,
    validators
};
