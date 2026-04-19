// ==================== middleware/validation.js ====================
const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

exports.rentalRequestValidation = [
  body('from').notEmpty().withMessage('From location is required').trim(),
  body('to').notEmpty().withMessage('To location is required').trim(),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('vehicleType').notEmpty().withMessage('Vehicle type is required'),
  body('budgetMin').isNumeric().withMessage('Minimum budget must be a number'),
  body('budgetMax').isNumeric().withMessage('Maximum budget must be a number')
    .custom((value, { req }) => {
      if (Number(value) < Number(req.body.budgetMin)) {
        throw new Error('Maximum budget must be greater than or equal to minimum budget');
      }
      return true;
    }),
  validate
];

exports.routeConfigValidation = [
  body('from').notEmpty().withMessage('From location is required').trim(),
  body('to').notEmpty().withMessage('To location is required').trim(),
  body('vehicleType').isIn(['Bus', 'Mini Bus', 'Car', 'Luxury', 'Other']).withMessage('Invalid vehicle type'),
  body('priceMin').isNumeric().withMessage('Price min must be a number'),
  body('priceMax').isNumeric().withMessage('Price max must be a number')
    .custom((value, { req }) => {
      if (Number(value) < Number(req.body.priceMin)) {
        throw new Error('Price max must be greater than or equal to price min');
      }
      return true;
    }),
  body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
  validate
];

exports.rentalServiceValidation = [
  body('routeConfigId').isMongoId().withMessage('Valid Route Configuration ID is required'),
  body('availableDates').isArray({ min: 1 }).withMessage('At least one available date is required'),
  body('availableDates.*').isISO8601().withMessage('All dates must be valid ISO8601 format'),
  validate
];
