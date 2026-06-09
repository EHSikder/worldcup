// backend/src/routes/predictions.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/database');
const auth = require('../middleware/auth');

/**
 * GET /api/predictions
 * Returns all predictions for the authenticated user.
 */
router.get('/', auth, async (req, res, next) => {
  try {
    const { data: predictions, error } = await supabase
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
        updated_at
      `)
      .eq('user_id', req.user.id)
      .order('match_number', { ascending: true });

    if (error) throw error;

    // Champion prediction
    const { data: champPred } = await supabase
      .from('champion_predictions')
      .select(`
        id,
        predicted_champion_team_id,
        points_earned,
        predicted_champion:predicted_champion_team_id (id, name, short_code, flag_url)
      `)
      .eq('user_id', req.user.id)
      .single();

    res.json({
      success: true,
      data: {
        predictions: predictions || [],
        champion_prediction: champPred || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/predictions
 * Upsert predictions for the authenticated user.
 * Handles both new predictions and edits in one call.
 * Individual prediction rows are locked by the cron job 5 minutes before kickoff.
 */
router.put('/', auth, async (req, res, next) => {
  try {
    const { predictions, champion_prediction_team_id } = req.body;

    if (!Array.isArray(predictions) || predictions.length === 0) {
      return res.status(400).json({ success: false, message: 'No predictions provided.' });
    }

    const userId = req.user.id;
    const matchNumbers = predictions.map(p => parseInt(p.match_number));

    // Fetch all matches in one query
    const { data: matches, error: matchErr } = await supabase
      .from('matches')
      .select('match_number, kickoff_time, status')
      .in('match_number', matchNumbers);

    if (matchErr) throw matchErr;

    const matchMap = {};
    for (const m of (matches || [])) matchMap[m.match_number] = m;

    // Fetch existing predictions for this user in one query
    const { data: existing, error: existErr } = await supabase
      .from('predictions')
      .select('id, match_number, is_locked')
      .eq('user_id', userId)
      .in('match_number', matchNumbers);

    if (existErr) throw existErr;

    const existingMap = {};
    for (const e of (existing || [])) existingMap[e.match_number] = e;

    const now = new Date();
    const toInsert = [];
    const toUpdate = [];
    const skippedLocked = [];
    const skippedNotFound = [];

    for (const pred of predictions) {
      const matchNum = parseInt(pred.match_number);
      const match = matchMap[matchNum];

      if (!match) {
        skippedNotFound.push(matchNum);
        continue;
      }

      // Time-based lock: refuse if kickoff is in ≤5 minutes OR match not scheduled
      const kickoff = match.kickoff_time ? new Date(match.kickoff_time) : null;
      const minutesUntil = kickoff ? (kickoff - now) / 60000 : Infinity;
      const timeLocked = match.status !== 'scheduled' || minutesUntil <= 5;

      const existingPred = existingMap[matchNum];

      // If prediction row already exists and is individually locked, skip
      if (existingPred?.is_locked || timeLocked) {
        skippedLocked.push(matchNum);
        continue;
      }

      const row = {
        match_number: matchNum,
        predicted_winner_team_id: pred.predicted_winner_team_id || null,
        predicted_home_score: pred.predicted_home_score != null ? parseInt(pred.predicted_home_score) : 0,
        predicted_away_score: pred.predicted_away_score != null ? parseInt(pred.predicted_away_score) : 0,
      };

      if (existingPred) {
        toUpdate.push({ id: existingPred.id, ...row });
      } else {
        toInsert.push({ user_id: userId, ...row });
      }
    }

    // Batch insert new predictions
    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase
        .from('predictions')
        .insert(toInsert);
      if (insertErr) throw insertErr;
    }

    // Update existing predictions one by one (Supabase doesn't support batch update by different IDs)
    for (const upd of toUpdate) {
      const { id, ...fields } = upd;
      const { error: updErr } = await supabase
        .from('predictions')
        .update(fields)
        .eq('id', id);
      if (updErr) throw updErr;
    }

    // Handle champion prediction (upsert — one per user)
    if (champion_prediction_team_id) {
      const { error: champErr } = await supabase
        .from('champion_predictions')
        .upsert(
          { user_id: userId, predicted_champion_team_id: champion_prediction_team_id },
          { onConflict: 'user_id' }
        );
      if (champErr) throw champErr;
    }

    // Mark user as having submitted predictions
    const totalSaved = toInsert.length + toUpdate.length;
    if (totalSaved > 0) {
      await supabase
        .from('users')
        .update({ has_submitted_prediction: true })
        .eq('id', userId);
    }

    res.json({
      success: true,
      message: `${totalSaved} predictions saved.`,
      data: {
        inserted: toInsert.length,
        updated: toUpdate.length,
        skipped_locked: skippedLocked,
        skipped_not_found: skippedNotFound,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/predictions — kept for backwards compatibility, delegates to PUT logic
 */
router.post('/', auth, async (req, res, next) => {
  // Forward to the PUT handler
  req.method = 'PUT';
  router.handle(req, res, next);
});

module.exports = router;
