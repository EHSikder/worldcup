const rateLimit = require('express-rate-limit');

/**
 * General rate limiter: 200 requests per 15 minutes per IP.
 * Applied globally to all /api/ routes.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

/**
 * Auth rate limiter: 10 requests per 15 minutes per IP.
 * Applied to signup/login for regular users.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
  },
});

/**
 * Admin rate limiter: 60 requests per 15 minutes per IP.
 * More generous — admins do many actions in quick succession.
 */
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many admin requests. Please try again in a few minutes.',
  },
});

module.exports = { generalLimiter, authLimiter, adminLimiter };
