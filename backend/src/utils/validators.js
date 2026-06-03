const { body, param, query, validationResult } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

// --- Auth validators ---

const registerRules = [
  body('full_name').trim().notEmpty().withMessage('Full name is required'),
  body('mobile_number')
    .trim()
    .notEmpty()
    .withMessage('Mobile number is required')
    .matches(/^\+?[\d\s-]{7,20}$/)
    .withMessage('Invalid mobile number format'),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('civil_id')
    .trim()
    .matches(/^\d{12}$/)
    .withMessage('Civil ID must be exactly 12 digits'),
  body('favorite_team_id').optional().isUUID().withMessage('Invalid team ID'),
];

const loginRules = [
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// --- Prediction validators ---

const submitPredictionRules = [
  body('predictions')
    .isArray({ min: 1 })
    .withMessage('Predictions must be a non-empty array'),
  body('predictions.*.match_number')
    .isInt({ min: 1, max: 104 })
    .withMessage('Match number must be between 1 and 104'),
  body('predictions.*.predicted_winner_team_id')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('predicted_winner_team_id must be a valid UUID'),
  body('predictions.*.predicted_home_score')
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage('Home score must be a non-negative integer'),
  body('predictions.*.predicted_away_score')
    .optional({ nullable: true })
    .isInt({ min: 0 })
    .withMessage('Away score must be a non-negative integer'),
  body('champion_prediction_team_id')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('Champion prediction must be a valid team UUID'),
];

// --- Admin validators ---

const adminLoginRules = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const lockRoundRules = [
  body('round')
    .isIn([
      'round_of_32',
      'round_of_16',
      'quarterfinal',
      'semifinal',
      'third_place',
      'final',
    ])
    .withMessage('Invalid round'),
  body('is_locked').isBoolean().withMessage('is_locked must be boolean'),
];

const updateTeamRules = [
  param('id').isUUID().withMessage('Invalid team ID'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('logo_url').optional().isURL().withMessage('Invalid logo URL'),
  body('flag_url').optional().isURL().withMessage('Invalid flag URL'),
];

const exportRules = [
  query('type')
    .isIn(['users', 'predictions', 'leaderboard'])
    .withMessage('Type must be users, predictions, or leaderboard'),
  query('format')
    .isIn(['xlsx', 'csv'])
    .withMessage('Format must be xlsx or csv'),
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  submitPredictionRules,
  adminLoginRules,
  lockRoundRules,
  updateTeamRules,
  exportRules,
};
