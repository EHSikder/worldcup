const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const supabase = require('../config/database');
const { signUserToken } = require('../utils/jwt');
const auth     = require('../middleware/auth');

/* ─────────────────────────────────────────────────────────────
   POST /api/auth/login
   Email + password login — checks against password_hash in DB
───────────────────────────────────────────────────────────── */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email, mobile_number, password_hash, jwt_token_version, favorite_team_id, is_verified')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !user) {
      return res.status(404).json({ success: false, message: 'No account found with this email. Please sign up.' });
    }

    if (!user.password_hash) {
      return res.status(400).json({ success: false, message: 'This account has no password set. Please contact support.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password. Please try again.' });
    }

    // If profile not complete, signal that
    if (!user.full_name || !user.favorite_team_id) {
      const tempToken = signUserToken({
        userId: user.id,
        email: user.email,
        tokenVersion: user.jwt_token_version,
      });
      return res.json({
        success: true,
        requiresProfileCompletion: true,
        data: {
          token: tempToken,
          user: { id: user.id, email: user.email },
        },
      });
    }

    const token = signUserToken({
      userId: user.id,
      email: user.email,
      tokenVersion: user.jwt_token_version,
    });

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id:               user.id,
          full_name:        user.full_name,
          email:            user.email,
          mobile_number:    user.mobile_number,
          favorite_team_id: user.favorite_team_id,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /api/auth/pre-signup
   Validates email is not taken and returns a short-lived
   session ticket used by /complete-profile.
───────────────────────────────────────────────────────────── */
router.post('/pre-signup', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    // Check if email already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists. Please log in.' });
    }

    // Hash password now, store it temporarily in a signed token
    const password_hash = await bcrypt.hash(password, 12);

    // Create a short-lived token carrying the hashed password
    const { signUserToken: sign } = require('../utils/jwt');
    const jwt = require('jsonwebtoken');
    const env = require('../config/env');
    const tempToken = jwt.sign(
      { email: email.toLowerCase().trim(), password_hash, type: 'pre-signup' },
      env.JWT_SECRET,
      { expiresIn: '30m' }
    );

    res.json({
      success: true,
      tempToken,
      user: { email: email.toLowerCase().trim() },
    });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /api/auth/complete-profile
   Creates the user in DB using the pre-signup temp token
   + the profile fields filled in on the complete-profile page.
───────────────────────────────────────────────────────────── */
router.post('/complete-profile', async (req, res, next) => {
  try {
    const {
      tempToken,
      mobile_number,
      civil_id,
      favorite_team_id,
      full_name,
      display_name,
      company_name,
    } = req.body;

    if (!tempToken) {
      return res.status(400).json({ success: false, message: 'Session expired. Please sign up again.' });
    }
    if (!mobile_number || !favorite_team_id || !full_name || !display_name) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }
    if (!company_name || !company_name.trim()) {
      return res.status(400).json({ success: false, message: 'Company ID is required.' });
    }
    if (!civil_id || !civil_id.trim()) {
      return res.status(400).json({ success: false, message: 'Civil ID is required.' });
    }
    if (!/^\d{12}$/.test(civil_id.trim())) {
      return res.status(400).json({ success: false, message: 'Civil ID must be exactly 12 numeric digits.' });
    }

    // Verify the temp token
    const jwt = require('jsonwebtoken');
    const env = require('../config/env');
    let payload;
    try {
      payload = jwt.verify(tempToken, env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Session expired. Please sign up again.' });
    }

    if (payload.type !== 'pre-signup') {
      return res.status(401).json({ success: false, message: 'Invalid session token.' });
    }

    const { email, password_hash } = payload;

    // Double-check email still not taken
    const { data: existingEmail } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingEmail) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists. Please log in.' });
    }

    // Check mobile not taken
    const { data: existingMobile } = await supabase
      .from('users')
      .select('id')
      .eq('mobile_number', mobile_number)
      .maybeSingle();

    if (existingMobile) {
      return res.status(409).json({ success: false, message: 'This mobile number is already registered.' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email,
        password_hash,
        full_name:        full_name.trim(),
        display_name:     display_name.trim(),
        company_name:     company_name.trim(),
        mobile_number,
        civil_id:         civil_id.trim(),
        favorite_team_id,
        is_verified:      true,
        hear_about_us:    null,
      })
      .select('id, full_name, display_name, email, mobile_number, jwt_token_version, favorite_team_id')
      .single();

    if (error) {
      console.error('Insert error:', error);
      return res.status(500).json({ success: false, message: 'Failed to create account. Please try again.' });
    }

    const token = signUserToken({
      userId:       user.id,
      email:        user.email,
      tokenVersion: user.jwt_token_version,
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: {
        token,
        user: {
          id:               user.id,
          full_name:        user.full_name,
          display_name:     user.display_name,
          email:            user.email,
          mobile_number:    user.mobile_number,
          favorite_team_id: user.favorite_team_id,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────────
   GET /api/auth/me  (protected)
───────────────────────────────────────────────────────────── */
router.get('/me', auth, async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id, full_name, display_name, company_name, hear_about_us,
        mobile_number, email, civil_id, favorite_team_id,
        is_verified, has_submitted_prediction, total_points, created_at
      `)
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    let favorite_team = null;
    if (user.favorite_team_id) {
      const { data: team } = await supabase
        .from('teams')
        .select('name, flag_url, short_code')
        .eq('id', user.favorite_team_id)
        .single();
      favorite_team = team;
    }

    const { data: predictions } = await supabase
      .from('predictions')
      .select('match_number, points_earned')
      .eq('user_id', req.user.id);

    const totalPredictions   = predictions?.length || 0;
    const correctPredictions = predictions?.filter(p => p.points_earned > 0).length || 0;

    res.json({
      success: true,
      data: {
        ...user,
        favorite_team,
        stats: { total_predictions: totalPredictions, correct_predictions: correctPredictions },
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
