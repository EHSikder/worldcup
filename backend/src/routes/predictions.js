const express = require('express');
const router = express.Router();
const supabase = require('../config/database');
const auth = require('../middleware/auth');
const { submitPredictionRules, validate } = require('../utils/validators');

/**
 * GET /api/predictions
 * Returns all predictions for the authenticated user
 */
router.get('/', auth, async (req, res, next) => {
  try {
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select(`
        id,
        match_number,
        predicted_winner_team_id,
        predicted_home_team_id,
        predicted_away_team_id,
        predicted_home_score,
        predicted_away_score,
        is_locked,
        locked_reason,
        points_earned,
        created_at,
        updated_at,
        predicted_winner:predicted_winner_team_id (id, name, short_code, flag_url)
      `)
      .eq('user_id', req.user.id)
      .order('match_number', { ascending: true });

    if (error) throw error;

    // Also fetch champion prediction
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
 * POST /api/predictions
 * Submit bracket predictions (create new)
 */
router.post('/', auth, submitPredictionRules, validate, async (req, res, next) => {
  try {
    const { predictions, champion_prediction_team_id } = req.body;
    const userId = req.user.id;

    // Check if user already submitted
    if (req.user.has_submitted_prediction) {
      return res.status(400).json({
        success: false,
        message: 'Predictions already submitted. Use PUT to edit.',
      });
    }

    // Validate all match numbers exist and are knockout matches
    const matchNumbers = predictions.map((p) => p.match_number);

    // Check bracket locks for all relevant rounds
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('match_number, round')
      .in('match_number', matchNumbers);

    if (matchError) throw matchError;

    // Check which rounds are locked
    const rounds = [...new Set(matches.map((m) => m.round))];
    const { data: locks } = await supabase
      .from('bracket_locks')
      .select('round, is_locked')
      .in('round', rounds);

    const lockedRounds = new Set(
      (locks || []).filter((l) => l.is_locked).map((l) => l.round)
    );

    // Filter out predictions for locked rounds
    const lockedPredictions = [];
    const validPredictions = [];

    for (const pred of predictions) {
      const match = matches.find((m) => m.match_number === pred.match_number);
      if (!match) {
        return res.status(400).json({
          success: false,
          message: `Match #${pred.match_number} not found.`,
        });
      }
      if (lockedRounds.has(match.round)) {
        lockedPredictions.push(pred.match_number);
      } else {
        validPredictions.push({
          user_id: userId,
          match_number: pred.match_number,
          predicted_winner_team_id: pred.predicted_winner_team_id,
          predicted_home_team_id: pred.predicted_home_team_id || null,
          predicted_away_team_id: pred.predicted_away_team_id || null,
          predicted_home_score: pred.predicted_home_score,
          predicted_away_score: pred.predicted_away_score,
        });
      }
    }

    if (lockedPredictions.length > 0 && validPredictions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All predicted rounds are locked.',
        locked_matches: lockedPredictions,
      });
    }

    // Insert valid predictions
    if (validPredictions.length > 0) {
      const { error: insertError } = await supabase
        .from('predictions')
        .insert(validPredictions);

      if (insertError) {
        if (insertError.code === '23505') {
          return res.status(409).json({
            success: false,
            message: 'Some predictions already exist. Use PUT to edit.',
          });
        }
        throw insertError;
      }
    }

    // Handle champion prediction
    if (champion_prediction_team_id) {
      const { error: champError } = await supabase
        .from('champion_predictions')
        .upsert(
          {
            user_id: userId,
            predicted_champion_team_id: champion_prediction_team_id,
          },
          { onConflict: 'user_id' }
        );

      if (champError) throw champError;
    }

    // Mark user as having submitted
    await supabase
      .from('users')
      .update({ has_submitted_prediction: true })
      .eq('id', userId);

    res.status(201).json({
      success: true,
      message: 'Predictions submitted successfully.',
      data: {
        submitted: validPredictions.length,
        locked_skipped: lockedPredictions,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/predictions
 * Edit existing predictions
 */
router.put('/', auth, submitPredictionRules, validate, async (req, res, next) => {
  try {
    const { predictions, champion_prediction_team_id } = req.body;
    const userId = req.user.id;

    const updated = [];
    const locked = [];
    const created = [];

    for (const pred of predictions) {
      // Check if the round is locked
      const { data: match } = await supabase
        .from('matches')
        .select('round')
        .eq('match_number', pred.match_number)
        .single();

      if (match) {
        const { data: bracketLock } = await supabase
          .from('bracket_locks')
          .select('is_locked')
          .eq('round', match.round)
          .single();

        if (bracketLock?.is_locked) {
          locked.push(pred.match_number);
          continue;
        }
      }

      // Check if prediction already exists
      const { data: existing } = await supabase
        .from('predictions')
        .select('id, is_locked')
        .eq('user_id', userId)
        .eq('match_number', pred.match_number)
        .single();

      if (existing) {
        if (existing.is_locked) {
          locked.push(pred.match_number);
          continue;
        }

        // Update existing prediction
        const { error: updateError } = await supabase
          .from('predictions')
          .update({
            predicted_winner_team_id: pred.predicted_winner_team_id,
            predicted_home_team_id: pred.predicted_home_team_id || null,
            predicted_away_team_id: pred.predicted_away_team_id || null,
            predicted_home_score: pred.predicted_home_score,
            predicted_away_score: pred.predicted_away_score,
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
        updated.push(pred.match_number);
      } else {
        // Create new prediction
        const { error: insertError } = await supabase
          .from('predictions')
          .insert({
            user_id: userId,
            match_number: pred.match_number,
            predicted_winner_team_id: pred.predicted_winner_team_id,
            predicted_home_team_id: pred.predicted_home_team_id || null,
            predicted_away_team_id: pred.predicted_away_team_id || null,
            predicted_home_score: pred.predicted_home_score,
            predicted_away_score: pred.predicted_away_score,
          });

        if (insertError) throw insertError;
        created.push(pred.match_number);
      }
    }

    // Handle champion prediction update
    if (champion_prediction_team_id) {
      const { error: champError } = await supabase
        .from('champion_predictions')
        .upsert(
          {
            user_id: userId,
            predicted_champion_team_id: champion_prediction_team_id,
          },
          { onConflict: 'user_id' }
        );

      if (champError) throw champError;
    }

    // Mark user as having submitted if they haven't
    if (!req.user.has_submitted_prediction && (updated.length > 0 || created.length > 0)) {
      await supabase
        .from('users')
        .update({ has_submitted_prediction: true })
        .eq('id', userId);
    }

    res.json({
      success: true,
      message: 'Predictions updated.',
      data: {
        updated,
        created,
        locked,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
