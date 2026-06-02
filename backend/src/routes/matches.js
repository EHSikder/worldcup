const express = require('express');
const router = express.Router();
const supabase = require('../config/database');

/**
 * GET /api/matches
 * Returns all matches. Supports ?round=round_of_32 filter.
 */
router.get('/', async (req, res, next) => {
  try {
    let query = supabase
      .from('matches')
      .select(`
        id,
        match_number,
        round,
        home_team_id,
        away_team_id,
        home_placeholder,
        away_placeholder,
        home_score,
        away_score,
        home_extra_time_score,
        away_extra_time_score,
        home_penalty_score,
        away_penalty_score,
        winner_team_id,
        status,
        kickoff_time,
        venue,
        city,
        feeds_into_match,
        feeds_into_slot,
        home_team:home_team_id (id, name, short_code, flag_url, flag_code),
        away_team:away_team_id (id, name, short_code, flag_url, flag_code),
        winner:winner_team_id (id, name, short_code, flag_url)
      `)
      .order('match_number', { ascending: true });

    // Filter by round if provided
    if (req.query.round) {
      query = query.eq('round', req.query.round);
    }

    const { data: matches, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: matches,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/matches/bracket
 * Returns the full knockout bracket structure (matches 73-104) with team data
 */
router.get('/bracket', async (req, res, next) => {
  try {
    const { data: matches, error } = await supabase
      .from('matches')
      .select(`
        id,
        match_number,
        round,
        home_team_id,
        away_team_id,
        home_placeholder,
        away_placeholder,
        home_score,
        away_score,
        winner_team_id,
        status,
        kickoff_time,
        feeds_into_match,
        feeds_into_slot,
        home_team:home_team_id (id, name, short_code, flag_url),
        away_team:away_team_id (id, name, short_code, flag_url),
        winner:winner_team_id (id, name, short_code, flag_url)
      `)
      .gte('match_number', 73)
      .order('match_number', { ascending: true });

    if (error) throw error;

    // Structure bracket by rounds
    const bracket = {
      round_of_32: [],
      round_of_16: [],
      quarterfinal: [],
      semifinal: [],
      third_place: [],
      final: [],
    };

    for (const match of (matches || [])) {
      if (bracket[match.round]) {
        bracket[match.round].push(match);
      }
    }

    res.json({
      success: true,
      data: bracket,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/matches/:matchNumber
 * Returns a single match by match_number
 */
router.get('/:matchNumber', async (req, res, next) => {
  try {
    const matchNumber = parseInt(req.params.matchNumber, 10);

    if (isNaN(matchNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid match number.',
      });
    }

    const { data: match, error } = await supabase
      .from('matches')
      .select(`
        *,
        home_team:home_team_id (id, name, short_code, flag_url, flag_code, logo_url),
        away_team:away_team_id (id, name, short_code, flag_url, flag_code, logo_url),
        winner:winner_team_id (id, name, short_code, flag_url)
      `)
      .eq('match_number', matchNumber)
      .single();

    if (error || !match) {
      return res.status(404).json({
        success: false,
        message: `Match #${matchNumber} not found.`,
      });
    }

    res.json({
      success: true,
      data: match,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
