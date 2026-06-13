const { verifyUserToken } = require('../utils/jwt');
const supabase = require('../config/database');

/**
 * Middleware: Verify user JWT and attach user object to req.user
 */
async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyUserToken(token);

    // Fetch user from database to ensure they still exist and are verified
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, mobile_number, email, civil_id, favorite_team_id, is_verified, has_submitted_prediction, total_points, jwt_token_version')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.',
      });
    }

    if (!user.is_verified) {
      return res.status(403).json({
        success: false,
        message: 'Account not verified. Please verify your OTP.',
      });
    }

    // Check token version for invalidation
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.jwt_token_version) {
      return res.status(401).json({
        success: false,
        message: 'Token has been invalidated. Please log in again.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    next(err);
  }
}

module.exports = auth;
