const cron = require('node-cron');
const supabase = require('../config/database');
const env = require('../config/env');
const {
  fetchAllFixtures,
  parseFixture,
  getWinnerApiId,
} = require('../services/apiFootballService');
const {
  scoreMatch,
  scoreChampionPredictions,
} = require('../services/scoringService');

/**
 * Run a full sync of match data from API-Football
 */
async function runSync() {
  // Create sync log entry
  const { data: syncLog, error: logError } = await supabase
    .from('sync_log')
    .insert({ status: 'running' })
    .select('id')
    .single();

  if (logError) {
    console.error('❌ Failed to create sync log:', logError.message);
    return;
  }

  const logId = syncLog.id;
  let matchesUpdated = 0;
  let predictionsLocked = 0;
  let pointsRecalculated = 0;
  const errors = [];

  try {
    console.log('🔄 Starting API-Football sync...');

    if (!env.API_FOOTBALL_KEY) {
      throw new Error('API_FOOTBALL_KEY is not configured. Skipping sync.');
    }

    // Fetch all fixtures
    const fixtures = await fetchAllFixtures();
    console.log(`📦 Fetched ${fixtures.length} fixtures from API-Football`);

    // Build a map of api_football_id -> team UUID
    const { data: teams } = await supabase
      .from('teams')
      .select('id, api_football_id');

    const teamApiMap = {};
    for (const team of (teams || [])) {
      if (team.api_football_id) {
        teamApiMap[team.api_football_id] = team.id;
      }
    }

    // Process each fixture
    for (const fixture of fixtures) {
      try {
        const parsed = parseFixture(fixture);

        // Find the match in our DB by api_football_fixture_id
        const { data: match } = await supabase
          .from('matches')
          .select('id, match_number, round, status, winner_team_id, feeds_into_match, feeds_into_slot')
          .eq('api_football_fixture_id', parsed.fixtureId)
          .single();

        if (!match) {
          // This fixture isn't mapped to any of our matches yet — skip
          continue;
        }

        const previousStatus = match.status;

        // Resolve team UUIDs from API IDs
        const homeTeamId = teamApiMap[parsed.homeTeamApiId] || null;
        const awayTeamId = teamApiMap[parsed.awayTeamApiId] || null;
        const winnerApiId = getWinnerApiId(parsed);
        const winnerTeamId = winnerApiId ? teamApiMap[winnerApiId] : null;

        // Prepare match update
        const updateData = {
          status: parsed.status,
          home_score: parsed.homeScore,
          away_score: parsed.awayScore,
          home_extra_time_score: parsed.homeExtraTimeScore,
          away_extra_time_score: parsed.awayExtraTimeScore,
          home_penalty_score: parsed.homePenaltyScore,
          away_penalty_score: parsed.awayPenaltyScore,
        };

        // Set team IDs if resolved
        if (homeTeamId) updateData.home_team_id = homeTeamId;
        if (awayTeamId) updateData.away_team_id = awayTeamId;
        if (winnerTeamId) updateData.winner_team_id = winnerTeamId;

        // Update match
        const { error: updateError } = await supabase
          .from('matches')
          .update(updateData)
          .eq('id', match.id);

        if (updateError) {
          errors.push(`Match #${match.match_number}: ${updateError.message}`);
          continue;
        }

        matchesUpdated++;

        // If status changed to 'finished', trigger scoring and bracket advancement
        if (previousStatus !== 'finished' && parsed.status === 'finished') {
          console.log(`🏆 Match #${match.match_number} finished! Scoring...`);

          // Lock predictions for this match
          const { count } = await supabase
            .from('predictions')
            .update({
              is_locked: true,
              locked_reason: 'result_confirmed',
            })
            .eq('match_number', match.match_number)
            .eq('is_locked', false)
            .select('*', { count: 'exact', head: true });

          predictionsLocked += count || 0;

          // Score the match
          if (winnerTeamId && parsed.homeScore !== null && parsed.awayScore !== null) {
            const result = await scoreMatch(
              match.match_number,
              winnerTeamId,
              parsed.homeScore,
              parsed.awayScore
            );
            pointsRecalculated += result.scored || 0;

            // If this is the final, also score champion predictions
            if (match.round === 'final') {
              console.log('🏆 FINAL decided! Scoring champion predictions...');
              await scoreChampionPredictions(winnerTeamId);
            }
          }

          // Advance winner to next match (bracket flow)
          if (winnerTeamId && match.feeds_into_match && match.feeds_into_slot) {
            const slotColumn =
              match.feeds_into_slot === 'home'
                ? 'home_team_id'
                : 'away_team_id';

            const { error: advanceError } = await supabase
              .from('matches')
              .update({ [slotColumn]: winnerTeamId })
              .eq('match_number', match.feeds_into_match);

            if (advanceError) {
              errors.push(
                `Advance M#${match.match_number} → M#${match.feeds_into_match}: ${advanceError.message}`
              );
            } else {
              console.log(
                `➡️ Advanced winner to Match #${match.feeds_into_match} (${match.feeds_into_slot} slot)`
              );
            }
          }

          // Handle third-place match: advance losers from semifinals
          if (match.round === 'semifinal') {
            // The loser goes to match 103 (third_place)
            const loserTeamId =
              winnerTeamId === homeTeamId ? awayTeamId : homeTeamId;

            if (loserTeamId) {
              // Determine which slot in match 103 based on match number
              const thirdPlaceSlot =
                match.match_number === 101 ? 'home_team_id' : 'away_team_id';

              const { error: thirdPlaceError } = await supabase
                .from('matches')
                .update({ [thirdPlaceSlot]: loserTeamId })
                .eq('match_number', 103);

              if (thirdPlaceError) {
                errors.push(
                  `Third place advancement from M#${match.match_number}: ${thirdPlaceError.message}`
                );
              } else {
                console.log(
                  `➡️ Advanced loser from M#${match.match_number} to Match #103 (third place)`
                );
              }
            }
          }
        }
      } catch (fixtureErr) {
        errors.push(`Fixture ${fixture.fixture?.id}: ${fixtureErr.message}`);
      }
    }

    // Complete sync log
    await supabase
      .from('sync_log')
      .update({
        completed_at: new Date().toISOString(),
        matches_updated: matchesUpdated,
        predictions_locked: predictionsLocked,
        points_recalculated: pointsRecalculated,
        errors: errors.length > 0 ? errors.join('\n') : null,
        status: errors.length > 0 ? 'completed' : 'completed',
      })
      .eq('id', logId);

    console.log(
      `✅ Sync complete: ${matchesUpdated} matches updated, ${predictionsLocked} predictions locked, ${pointsRecalculated} scored`
    );
    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length} errors during sync`);
    }
  } catch (err) {
    console.error('❌ Sync failed:', err.message);

    await supabase
      .from('sync_log')
      .update({
        completed_at: new Date().toISOString(),
        errors: err.message,
        status: 'failed',
      })
      .eq('id', logId);
  }
}

/**
 * Start the cron job — runs every 20 minutes
 */
function startSyncCron() {
  console.log('⏰ Match sync cron scheduled (every 20 minutes)');

  cron.schedule('*/20 * * * *', async () => {
    console.log(`🕐 Cron triggered at ${new Date().toISOString()}`);
    await runSync();
  });
}

module.exports = { startSyncCron, runSync };
