const { verifyAdminToken } = require('../utils/jwt');
const supabase = require('../config/database');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@wc-26.com';

/**
 * Middleware: Verify admin JWT and attach admin to req.admin
 * Uses the users table (same as login) — not a separate admin_users table.
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

    // Verify admin still exists in the users table and is the admin email
    const { data: admin, error } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('id', decoded.adminId)
      .single();

    if (error || !admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin token. User not found.',
      });
    }

    // Ensure the user is the designated admin
    if (admin.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Not an admin account.',
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
