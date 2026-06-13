const { verifyUserToken } = require('../utils/jwt');
const supabase = require('../config/database');

async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token   = authHeader.split(' ')[1];
    const decoded = verifyUserToken(token);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, mobile_number, email, civil_id, favorite_team_id, is_verified, has_submitted_prediction, total_points, jwt_token_version')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Invalid token. User not found.' });
    }

    // Check token version (lets us invalidate sessions)
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.jwt_token_version) {
      return res.status(401).json({ success: false, message: 'Token has been invalidated. Please log in again.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    next(err);
  }
}

module.exports = auth;
