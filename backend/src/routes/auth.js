const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const supabase = require('../config/database');
const { signUserToken } = require('../utils/jwt');
const auth = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const {
  registerRules,
  loginRules,
  validate,
} = require('../utils/validators');

/**
 * POST /api/auth/register
 * Register a new user with email and password
 */
router.post('/register', authLimiter, registerRules, validate, async (req, res, next) => {
  try {
    const { full_name, mobile_number, email, password, civil_id, favorite_team_id } = req.body;

    // Check if email already exists
    const { data: existingEmail } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered.',
      });
    }

    // Check if mobile number already exists
    const { data: existingMobile } = await supabase
      .from('users')
      .select('id')
      .eq('mobile_number', mobile_number)
      .single();

    if (existingMobile) {
      return res.status(409).json({
        success: false,
        message: 'Mobile number already registered.',
      });
    }

    // Hash the password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const insertData = {
      full_name,
      mobile_number,
      email,
      civil_id,
      password_hash,
      is_verified: true, // auto-verified with password auth
    };

    if (favorite_team_id) {
      insertData.favorite_team_id = favorite_team_id;
    }

    const { data: user, error } = await supabase
      .from('users')
      .insert(insertData)
      .select('id, full_name, email, mobile_number')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'Account already exists with this email or mobile number.',
        });
      }
      throw error;
    }

    // Generate JWT
    const token = signUserToken({
      userId: user.id,
      email: user.email,
      tokenVersion: 1,
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        token,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          mobile_number: user.mobile_number,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', authLimiter, loginRules, validate, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email, mobile_number, password_hash, jwt_token_version')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
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
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          mobile_number: user.mobile_number,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Get current user profile (JWT protected)
 */
router.get('/me', auth, async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        mobile_number,
        email,
        civil_id,
        favorite_team_id,
        is_verified,
        has_submitted_prediction,
        total_points,
        created_at
      `)
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    // Get favorite team info separately
    let favorite_team = null;
    if (user.favorite_team_id) {
      const { data: team } = await supabase
        .from('teams')
        .select('name, flag_url, short_code')
        .eq('id', user.favorite_team_id)
        .single();
      favorite_team = team;
    }

    // Get prediction stats
    const { data: predictions } = await supabase
      .from('predictions')
      .select('match_number, points_earned')
      .eq('user_id', req.user.id);

    const totalPredictions = predictions?.length || 0;
    const correctPredictions = predictions?.filter(p => p.points_earned > 0).length || 0;
    const pointsBreakdown = {};
    (predictions || []).forEach(p => {
      const round = p.match_number >= 73 && p.match_number <= 88 ? 'round_of_32'
        : p.match_number >= 89 && p.match_number <= 96 ? 'round_of_16'
        : p.match_number >= 97 && p.match_number <= 100 ? 'quarterfinal'
        : p.match_number >= 101 && p.match_number <= 102 ? 'semifinal'
        : 'final';
      pointsBreakdown[round] = (pointsBreakdown[round] || 0) + (p.points_earned || 0);
    });

    res.json({
      success: true,
      data: {
        ...user,
        favorite_team,
        stats: {
          total_predictions: totalPredictions,
          correct_predictions: correctPredictions,
          points_breakdown: pointsBreakdown,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
