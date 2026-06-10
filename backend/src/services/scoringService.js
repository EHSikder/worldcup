const supabase = require('../config/database');

/**
 * Load scoring rules from the database (cached per call)
 */
async function loadScoringRules() {
  const { data, error } = await supabase
    .from('scoring_rules')
    .select('round, correct_winner_points, correct_score_points');

  if (error) {
    throw new Error(`Failed to load scoring rules: ${error.message}`);
  }

  const rules = {};
  for (const rule of data) {
    rules[rule.round] = {
      correctWinnerPoints: rule.correct_winner_points,
      correctScorePoints: rule.correct_score_points,
    };
  }
  return rules;
}

/**
 * Score all predictions for a finished match
 * @param {number} matchNumber - The match_number of the completed match
 * @param {string} winnerTeamId - UUID of the actual winner
 * @param {number} homeScore - Actual home score (full time)
 * @param {number} awayScore - Actual away score (full time)
 */
async function scoreMatch(matchNumber, winnerTeamId, homeScore, awayScore) {
  const rules = await loadScoringRules();

  // Get the match round
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('round')
    .eq('match_number', matchNumber)
    .single();

  if (matchError || !match) {
    throw new Error(`Match ${matchNumber} not found: ${matchError?.message}`);
  }

  const roundRules = rules[match.round];
  if (!roundRules) {
    console.warn(`No scoring rules found for round: ${match.round}`);
    return { scored: 0 };
  }

  // Get all predictions for this match
  const { data: matchPredictions, error: predError2 } = await supabase
    .from('predictions')
    .select('id, user_id, predicted_winner_team_id, predicted_home_score, predicted_away_score')
    .eq('match_number', matchNumber);

  if (predError2) {
    throw new Error(`Failed to fetch predictions: ${predError2.message}`);
  }

  if (!matchPredictions || matchPredictions.length === 0) {
    return { scored: 0 };
  }

  let scored = 0;
  const affectedUserIds = new Set();

  for (const pred of matchPredictions) {
    let points = 0;

    // Check correct winner
    const drawMatch  = pred.predicted_winner_team_id === null && (winnerTeamId === null || winnerTeamId === undefined);
const teamMatch  = pred.predicted_winner_team_id !== null && pred.predicted_winner_team_id === winnerTeamId;
if (drawMatch || teamMatch) {
      points += roundRules.correctWinnerPoints;
    }

    // Check correct score (both home and away must match exactly)
    if (
      pred.predicted_home_score === homeScore &&
      pred.predicted_away_score === awayScore
    ) {
      points += roundRules.correctScorePoints;
    }

    // Update prediction with points and lock it
    await supabase
      .from('predictions')
      .update({
        points_earned: points,
        is_locked: true,
        locked_reason: 'result_confirmed',
      })
      .eq('id', pred.id);

    affectedUserIds.add(pred.user_id);
    scored++;
  }

  // Recalculate total points for all affected users
  for (const userId of affectedUserIds) {
    await recalculateUserPoints(userId);
  }

  return { scored, affectedUsers: affectedUserIds.size };
}

/**
 * Recalculate a user's total points from all their predictions
 */
async function recalculateUserPoints(userId) {
  const { data, error } = await supabase
    .from('predictions')
    .select('points_earned')
    .eq('user_id', userId);

  if (error) {
    console.error(`Failed to recalculate points for ${userId}:`, error.message);
    return;
  }

  const total = (data || []).reduce((sum, p) => sum + (p.points_earned || 0), 0);

  // Also add champion prediction points
  const { data: champPred } = await supabase
    .from('champion_predictions')
    .select('points_earned')
    .eq('user_id', userId)
    .single();

  const champPoints = champPred?.points_earned || 0;

  await supabase
    .from('users')
    .update({ total_points: total + champPoints })
    .eq('id', userId);
}

/**
 * Score champion predictions when the final match is decided
 * Awards 50 points if predicted champion matches the actual winner
 */
async function scoreChampionPredictions(actualChampionTeamId) {
  const CHAMPION_POINTS = 11;

  // Get all champion predictions
  const { data: predictions, error } = await supabase
    .from('champion_predictions')
    .select('id, user_id, predicted_champion_team_id');

  if (error) {
    throw new Error(`Failed to fetch champion predictions: ${error.message}`);
  }

  if (!predictions || predictions.length === 0) return { scored: 0 };

  let scored = 0;
  const affectedUserIds = new Set();

  for (const pred of predictions) {
    const points =
      pred.predicted_champion_team_id === actualChampionTeamId ? CHAMPION_POINTS : 0;

    await supabase
      .from('champion_predictions')
      .update({ points_earned: points })
      .eq('id', pred.id);

    affectedUserIds.add(pred.user_id);
    if (points > 0) scored++;
  }

  // Recalculate totals for affected users
  for (const userId of affectedUserIds) {
    await recalculateUserPoints(userId);
  }

  return { scored, total: predictions.length };
}

module.exports = {
  scoreMatch,
  scoreChampionPredictions,
  recalculateUserPoints,
  loadScoringRules,
};
