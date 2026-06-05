const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const supabase = require('../config/database');
const { signAdminToken } = require('../utils/jwt');
const adminAuth = require('../middleware/adminAuth');
const { authLimiter } = require('../middleware/rateLimit');
const { generateXlsx, generateCsv } = require('../services/exportService');
const { runSync } = require('../cron/syncMatches');
const {
  lockRoundRules,
  updateTeamRules,
  exportRules,
  validate,
} = require('../utils/validators');

// The only email allowed to access admin panel
// const ADMIN_EMAIL removed — now using admin_users table

/**
 * POST /api/admin/login
 * Admin login — uses the admin_users table with username + password
 */
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.',
      });
    }

    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('id, username, password_hash')
      .eq('username', username)
      .single();

    if (error || !admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
      });
    }

    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
      });
    }

    const token = signAdminToken({
      adminId: admin.id,
      username: admin.username,
    });

    res.json({
      success: true,
      message: 'Admin login successful.',
      data: { token, admin: { id: admin.id, username: admin.username } },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/users
 * List all users with search/filter
 */
router.get('/users', adminAuth, async (req, res, next) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    let query = supabase
      .from('users')
      .select('id, full_name, mobile_number, email, civil_id, is_verified, has_submitted_prediction, total_points, created_at, favorite_team_id', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit, 10) - 1);

    // Search filter
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,mobile_number.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data: users, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: users || [],
      pagination: {
        total: count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil((count || 0) / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/users/:userId/predictions
 * Get a user's complete predictions
 */
router.get('/users/:userId/predictions', adminAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Get user info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, full_name, mobile_number, total_points')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Get predictions
    const { data: predictions, error: predError } = await supabase
      .from('predictions')
      .select(`
        id,
        match_number,
        predicted_winner_team_id,
        predicted_home_score,
        predicted_away_score,
        is_locked,
        locked_reason,
        points_earned,
        created_at,
        predicted_winner:predicted_winner_team_id (id, name, short_code, flag_url)
      `)
      .eq('user_id', userId)
      .order('match_number', { ascending: true });

    if (predError) throw predError;

    // Get champion prediction
    const { data: champPred } = await supabase
      .from('champion_predictions')
      .select(`
        predicted_champion_team_id,
        points_earned,
        predicted_champion:predicted_champion_team_id (id, name, short_code, flag_url)
      `)
      .eq('user_id', userId)
      .single();

    res.json({
      success: true,
      data: {
        user,
        predictions: predictions || [],
        champion_prediction: champPred || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/lock-round
 * Lock or unlock a bracket round
 */
router.post('/lock-round', adminAuth, lockRoundRules, validate, async (req, res, next) => {
  try {
    const { round, is_locked } = req.body;

    // Update bracket_locks
    const { error: lockError } = await supabase
      .from('bracket_locks')
      .update({
        is_locked,
        locked_by: req.admin.id,
        locked_at: is_locked ? new Date().toISOString() : null,
      })
      .eq('round', round);

    if (lockError) throw lockError;

    // If locking, also lock all predictions for matches in this round
    if (is_locked) {
      // Get all match numbers for this round
      const { data: roundMatches } = await supabase
        .from('matches')
        .select('match_number')
        .eq('round', round);

      if (roundMatches && roundMatches.length > 0) {
        const matchNumbers = roundMatches.map((m) => m.match_number);

        const { error: predLockError } = await supabase
          .from('predictions')
          .update({
            is_locked: true,
            locked_reason: 'admin_lock',
          })
          .in('match_number', matchNumbers);

        if (predLockError) throw predLockError;
      }
    }

    res.json({
      success: true,
      message: `Round "${round}" has been ${is_locked ? 'locked' : 'unlocked'}.`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/bracket-locks
 * Returns lock status for all rounds
 */
router.get('/bracket-locks', adminAuth, async (req, res, next) => {
  try {
    const { data: locks, error } = await supabase
      .from('bracket_locks')
      .select('round, is_locked, locked_by, locked_at')
      .order('round', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: locks || [],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/teams/:id
 * Update team details
 */
router.put('/teams/:id', adminAuth, updateTeamRules, validate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = {};

    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.logo_url !== undefined) updates.logo_url = req.body.logo_url;
    if (req.body.flag_url !== undefined) updates.flag_url = req.body.flag_url;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update.',
      });
    }

    const { data: team, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.',
      });
    }

    res.json({
      success: true,
      message: 'Team updated successfully.',
      data: team,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/export
 * Generate and download export file
 */
router.get('/export', adminAuth, exportRules, validate, async (req, res, next) => {
  try {
    const { type, format } = req.query;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `wc2026_${type}_${timestamp}`;

    if (format === 'xlsx') {
      const buffer = await generateXlsx(type);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      return res.send(Buffer.from(buffer));
    }

    if (format === 'csv') {
      const csv = await generateCsv(type);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/sync-status
 * Returns recent sync log entries
 */
router.get('/sync-status', adminAuth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;

    const { data: logs, error } = await supabase
      .from('sync_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({
      success: true,
      data: logs || [],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/trigger-sync
 * Manually trigger an API-Football sync
 */
router.post('/trigger-sync', adminAuth, async (req, res, next) => {
  try {
    // Run sync in background (don't await — return immediately)
    runSync().catch((err) => {
      console.error('Manual sync failed:', err.message);
    });

    res.json({
      success: true,
      message: 'Sync triggered. Check /api/admin/sync-status for progress.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/stats
 * Dashboard statistics
 */
router.get('/stats', adminAuth, async (req, res, next) => {
  try {
    // Total users
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Verified users
    const { count: verifiedUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_verified', true);

    // Users who submitted predictions
    const { count: predictingUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('has_submitted_prediction', true);

    // Total predictions
    const { count: totalPredictions } = await supabase
      .from('predictions')
      .select('*', { count: 'exact', head: true });

    // Upcoming matches (scheduled knockout matches)
    const { data: upcomingMatches } = await supabase
      .from('matches')
      .select('match_number, round, kickoff_time, home_placeholder, away_placeholder')
      .eq('status', 'scheduled')
      .neq('round', 'group_stage')
      .order('kickoff_time', { ascending: true })
      .limit(5);

    // Finished matches
    const { count: finishedMatches } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'finished')
      .neq('round', 'group_stage');

    // Live matches
    const { data: liveMatches } = await supabase
      .from('matches')
      .select('match_number, round, home_score, away_score, status')
      .in('status', ['live', 'halftime', 'extra_time', 'penalties']);

    // Last sync
    const { data: lastSync } = await supabase
      .from('sync_log')
      .select('started_at, completed_at, status, matches_updated')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    res.json({
      success: true,
      data: {
        total_users: totalUsers || 0,
        verified_users: verifiedUsers || 0,
        predicting_users: predictingUsers || 0,
        total_predictions: totalPredictions || 0,
        finished_knockout_matches: finishedMatches || 0,
        live_matches: liveMatches || [],
        upcoming_matches: upcomingMatches || [],
        last_sync: lastSync || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
