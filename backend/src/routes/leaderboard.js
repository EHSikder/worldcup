const express = require('express');
const router = express.Router();
const supabase = require('../config/database');

/**
 * GET /api/leaderboard
 * Returns top users ranked by total_points
 */
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, total_points, has_submitted_prediction, favorite_team_id')
      .eq('has_submitted_prediction', true)
      .order('total_points', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Add rank
    const ranked = (users || []).map((u, i) => ({
      ...u,
      rank: i + 1,
      correct_predictions: 0, // will be computed later when scoring runs
    }));

    res.json({
      success: true,
      data: ranked,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/leaderboard/user/:userId
 * Returns a specific user's rank and point breakdown
 */
router.get('/user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Get user
    const { data: userRank, error } = await supabase
      .from('users')
      .select('id, full_name, total_points, has_submitted_prediction')
      .eq('id', userId)
      .single();

    if (error || !userRank) {
      return res.status(404).json({
        success: false,
        message: 'User not found on leaderboard.',
      });
    }

    // Get point breakdown by round
    const { data: predictions } = await supabase
      .from('predictions')
      .select(`
        match_number,
        points_earned,
        predicted_winner_team_id,
        predicted_home_score,
        predicted_away_score,
        is_locked,
        matches!inner(round)
      `)
      .eq('user_id', userId)
      .gt('points_earned', 0);

    // Group points by round
    const pointsByRound = {};
    for (const pred of (predictions || [])) {
      const round = pred.matches?.round;
      if (!pointsByRound[round]) {
        pointsByRound[round] = { points: 0, correct: 0 };
      }
      pointsByRound[round].points += pred.points_earned;
      pointsByRound[round].correct += 1;
    }

    // Get champion prediction
    const { data: champPred } = await supabase
      .from('champion_predictions')
      .select('points_earned, predicted_champion_team_id')
      .eq('user_id', userId)
      .single();

    res.json({
      success: true,
      data: {
        ...userRank,
        points_by_round: pointsByRound,
        champion_prediction_points: champPred?.points_earned || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
