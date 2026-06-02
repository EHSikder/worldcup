const express = require('express');
const router = express.Router();
const supabase = require('../config/database');

/**
 * GET /api/teams
 * Returns all 48 teams grouped by group_letter
 */
router.get('/', async (req, res, next) => {
  try {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, short_code, group_letter, logo_url, flag_url, flag_code, group_position, is_eliminated')
      .order('group_letter', { ascending: true })
      .order('group_position', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: teams || [],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/teams/:id
 * Returns a single team by UUID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: team, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found.',
      });
    }

    res.json({
      success: true,
      data: team,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
