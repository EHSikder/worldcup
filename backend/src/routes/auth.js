const express = require('express');
const router = express.Router();
const supabase = require('../config/database');
const { signUserToken } = require('../utils/jwt');
const auth = require('../middleware/auth');
const admin = require('../config/firebase');

/**
 * POST /api/auth/firebase-login
 * Receives Firebase ID token, verifies it, and logs the user in if they exist.
 */
router.post('/firebase-login', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'No token provided' });

    // Verify token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { email } = decodedToken;

    // For email/password users, require email verification
    const signInProvider = decodedToken.firebase?.sign_in_provider;
    if (signInProvider === 'password' && !decodedToken.email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in. Check your inbox for the verification link.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // Check if user exists
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email, mobile_number, jwt_token_version, favorite_team_id')
      .eq('email', email)
      .single();

    if (error || !user) {
      // User doesn't exist, they need to sign up
      return res.status(404).json({
        success: false,
        message: 'Account not found. Please sign up first.'
      });
    }

    // User exists, generate our custom JWT
    const jwtToken = signUserToken({
      userId: user.id,
      email: user.email,
      tokenVersion: user.jwt_token_version,
    });

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token: jwtToken,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          mobile_number: user.mobile_number,
          favorite_team_id: user.favorite_team_id,
        },
      },
    });
  } catch (err) {
    console.error('Firebase Login Error:', err);
    res.status(401).json({ success: false, message: 'Invalid Firebase token.' });
  }
});

/**
 * POST /api/auth/firebase-signup
 * Receives Firebase ID token, checks if user exists. If they don't, signals to complete profile.
 */
router.post('/firebase-signup', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'No token provided' });

    // Verify token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { email, name, uid } = decodedToken;

    // For email/password users, require email verification
    const signInProvider = decodedToken.firebase?.sign_in_provider;
    if (signInProvider === 'password' && !decodedToken.email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email first. Check your inbox for the verification link.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // Check if user exists
    const { data: user, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (user) {
      // User already exists, they should log in
      return res.status(409).json({
        success: false,
        message: 'Account already exists. Please log in.'
      });
    }

    // User doesn't exist, tell frontend to prompt for profile completion
    return res.json({
      success: true,
      requiresProfileCompletion: true,
      user: { email, name, firebase_uid: uid }
    });
  } catch (err) {
    console.error('Firebase Signup Error:', err);
    res.status(401).json({ success: false, message: 'Invalid Firebase token.' });
  }
});

/**
 * POST /api/auth/complete-profile
 * Creates a new user after Google Sign-in with additional profile info.
 */
router.post('/complete-profile', async (req, res, next) => {
  try {
    const { token, mobile_number, civil_id, favorite_team_id, full_name } = req.body;
    if (!token || !mobile_number || !civil_id || !favorite_team_id) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Validate civil_id format
    if (!/^\d{12}$/.test(civil_id)) {
      return res.status(400).json({
        success: false,
        message: 'Civil ID must be exactly 12 numeric digits.',
        code: 'INVALID_CIVIL_ID'
      });
    }

    // Verify token again to ensure identity
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { email, name, uid } = decodedToken;

    // Double check email isn't already taken
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Account already exists' });
    }

    // Check if mobile number is taken
    const { data: existingMobile } = await supabase
      .from('users')
      .select('id')
      .eq('mobile_number', mobile_number)
      .single();

    if (existingMobile) {
      return res.status(409).json({ success: false, message: 'Mobile number already registered.' });
    }

    // Create user
    const insertData = {
      full_name: full_name || name || 'User',
      email,
      firebase_uid: uid,
      mobile_number,
      civil_id,
      favorite_team_id,
      is_verified: true, // Google accounts are pre-verified
    };

    const { data: user, error } = await supabase
      .from('users')
      .insert(insertData)
      .select('id, full_name, email, mobile_number, jwt_token_version, favorite_team_id')
      .single();

    if (error) {
      console.error('Insert Error:', error);
      return res.status(500).json({ success: false, message: 'Failed to create account.' });
    }

    // Generate JWT
    const jwtToken = signUserToken({
      userId: user.id,
      email: user.email,
      tokenVersion: user.jwt_token_version,
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        token: jwtToken,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          mobile_number: user.mobile_number,
          favorite_team_id: user.favorite_team_id,
        },
      },
    });
  } catch (err) {
    console.error('Complete Profile Error:', err);
    res.status(401).json({ success: false, message: 'Authentication failed.' });
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
        id, full_name, mobile_number, email, civil_id, favorite_team_id,
        is_verified, has_submitted_prediction, total_points, created_at, firebase_uid
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
