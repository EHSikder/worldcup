const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Sign a user JWT (24h expiry)
 */
function signUserToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '60d' });
}

/**
 * Verify a user JWT
 */
function verifyUserToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

/**
 * Sign an admin JWT (8h expiry)
 */
function signAdminToken(payload) {
  return jwt.sign(payload, env.ADMIN_JWT_SECRET, { expiresIn: '8h' });
}

/**
 * Verify an admin JWT
 */
function verifyAdminToken(token) {
  return jwt.verify(token, env.ADMIN_JWT_SECRET);
}

module.exports = {
  signUserToken,
  verifyUserToken,
  signAdminToken,
  verifyAdminToken,
};
