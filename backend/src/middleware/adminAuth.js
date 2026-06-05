const { verifyAdminToken } = require('../utils/jwt');
const supabase = require('../config/database');

/**
 * Middleware: Verify admin JWT and attach admin to req.admin
 * Uses the admin_users table.
 */
async function adminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Admin access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAdminToken(token);

    // Verify admin still exists in admin_users table
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('id, username')
      .eq('id', decoded.adminId)
      .single();

    if (error || !admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin token. Admin not found.',
      });
    }

    req.admin = admin;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Admin token expired.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid admin token.' });
    }
    next(err);
  }
}

module.exports = adminAuth;
