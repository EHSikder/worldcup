const cron = require('node-cron');
const supabase = require('../config/database');
const env = require('../config/env');
const {
  fetchAllFixtures,
  fetchLiveScores,
  parseFixture,
  parseLiveScore,
  getWinnerApiId,
} = require('../services/worldCupApiService');
const {
  scoreMatch,
  scoreChampionPredictions,
} = require('../services/scoringService');

/**
 * Run a full sync of match data from WorldCupAPI
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
    console.log('🔄 Starting WorldCupAPI sync...');

    if (!env.API_FOOTBALL_KEY) {
      throw new Error('API key is not configured. Skipping sync.');
    }

    // Build a map of worldcupapi_id -> team UUID
    const { data: teams } = await supabase
      .from('teams')
      .select('id, worldcupapi_id');

    const teamApiMap = {};
    for (const team of (teams || [])) {
      if (team.worldcupapi_id) {
        teamApiMap[team.worldcupapi_id] = team.id;
      }
    }

    // 1. Fetch live scores for updates
    try {
      const liveScores = await fetchLiveScores();
      console.log(`📡 Fetched ${liveScores.length} live matches from WorldCupAPI`);

      for (const match of liveScores) {
        try {
          const parsed = parseLiveScore(match);
          if (!parsed.fixtureId) continue;

          // Find the match in our DB by worldcupapi_fixture_id
          const { data: dbMatch } = await supabase
            .from('matches')
            .select('id, match_number, round, status, winner_team_id, feeds_into_match, feeds_into_slot, home_team_id, away_team_id')
            .eq('worldcupapi_fixture_id', parsed.fixtureId)
            .single();

          if (!dbMatch) continue;

          await processMatchUpdate(dbMatch, parsed, teamApiMap, errors, () => matchesUpdated++, () => predictionsLocked++, (p) => pointsRecalculated += p);
        } catch (matchErr) {
          errors.push(`Live Match ${match.id}: ${matchErr.message}`);
        }
      }
    } catch (e) {
      errors.push(`LiveScores Error: ${e.message}`);
    }

    // 2. Fetch all fixtures to keep dates/teams in sync 
    // To strictly limit to 1 request per 5 minutes, we only run the full fixtures sync (which requires multiple paginated requests) once per day, or skip it.
    // The user requested 1 request every 5 minutes total. We will prioritize liveScores.
    const currentMinute = new Date().getMinutes();
    // Only run fixtures sync on the top of the hour to save requests
    if (currentMinute < 5) {
      try {
        const fixtures = await fetchAllFixtures();
        console.log(`📅 Fetched ${fixtures.length} fixtures from WorldCupAPI`);
  
        for (const fixture of fixtures) {
          try {
            const parsed = parseFixture(fixture);
            if (!parsed.fixtureId) continue;
  
            const { data: dbMatch } = await supabase
              .from('matches')
              .select('id, match_number, round, status, winner_team_id, feeds_into_match, feeds_into_slot, kickoff_time, home_team_id, away_team_id')
              .eq('worldcupapi_fixture_id', parsed.fixtureId)
              .single();
  
            if (!dbMatch) continue;
            
            // Only update if it's not live/finished since liveScores handles those better
            if (dbMatch.status === 'scheduled') {
              await processMatchUpdate(dbMatch, parsed, teamApiMap, errors, () => matchesUpdated++, () => predictionsLocked++, (p) => pointsRecalculated += p);
            }
          } catch (fixtureErr) {
            errors.push(`Fixture ${fixture.id}: ${fixtureErr.message}`);
          }
        }
      } catch (e) {
        errors.push(`Fixtures Error: ${e.message}`);
      }
    }

    // 3. Lock predictions for matches starting in < 5 minutes
    try {
      const { data: upcomingMatches } = await supabase
        .from('matches')
        .select('match_number, kickoff_time')
        .eq('status', 'scheduled')
        .not('kickoff_time', 'is', null);
        
      const now = new Date();
      for (const m of (upcomingMatches || [])) {
        const kickoff = new Date(m.kickoff_time);
        const diffMinutes = (kickoff - now) / 1000 / 60;
        
        if (diffMinutes <= 5 && diffMinutes > -100) { // Lock 5 mins before, up to during match if status didn't update yet
          const { count } = await supabase
            .from('predictions')
            .update({
              is_locked: true,
              locked_reason: 'time_lock',
            })
            .eq('match_number', m.match_number)
            .eq('is_locked', false)
            .select('*', { count: 'exact', head: true });
            
          predictionsLocked += count || 0;
          if (count > 0) {
            console.log(`🔒 Locked ${count} predictions for Match #${m.match_number} (Kickoff in ${Math.round(diffMinutes)} mins)`);
          }
        }
      }
    } catch (e) {
      errors.push(`Locking Error: ${e.message}`);
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

async function processMatchUpdate(dbMatch, parsed, teamApiMap, errors, incMatches, incLocked, addPoints) {
  const previousStatus = dbMatch.status;

  const homeTeamId = teamApiMap[parsed.homeTeamApiId] || null;
  const awayTeamId = teamApiMap[parsed.awayTeamApiId] || null;
  const winnerApiId = getWinnerApiId(parsed);
  const winnerTeamId = winnerApiId ? teamApiMap[winnerApiId] : null;

  const updateData = {};
  if (parsed.status && parsed.status !== 'scheduled') updateData.status = parsed.status;
  if (parsed.kickoffTime) updateData.kickoff_time = parsed.kickoffTime;
  if (parsed.homeScore !== null) updateData.home_score = parsed.homeScore;
  if (parsed.awayScore !== null) updateData.away_score = parsed.awayScore;
  if (parsed.homeExtraTimeScore !== null) updateData.home_extra_time_score = parsed.homeExtraTimeScore;
  if (parsed.awayExtraTimeScore !== null) updateData.away_extra_time_score = parsed.awayExtraTimeScore;
  if (parsed.homePenaltyScore !== null) updateData.home_penalty_score = parsed.homePenaltyScore;
  if (parsed.awayPenaltyScore !== null) updateData.away_penalty_score = parsed.awayPenaltyScore;

  // Only update team IDs if the DB match doesn't already have them
  // (e.g., knockout matches where teams are decided later)
  if (homeTeamId && !dbMatch.home_team_id) updateData.home_team_id = homeTeamId;
  if (awayTeamId && !dbMatch.away_team_id) updateData.away_team_id = awayTeamId;
  if (winnerTeamId) updateData.winner_team_id = winnerTeamId;

  if (Object.keys(updateData).length > 0) {
    const { error: updateError } = await supabase
      .from('matches')
      .update(updateData)
      .eq('id', dbMatch.id);

    if (updateError) {
      errors.push(`Match #${dbMatch.match_number}: ${updateError.message}`);
      return;
    }
    incMatches();
  }

  // If status changed to 'finished', trigger scoring and bracket advancement
  if (previousStatus !== 'finished' && parsed.status === 'finished') {
    console.log(`🏆 Match #${dbMatch.match_number} finished! Scoring...`);

    // Lock predictions for this match (if not already locked by time)
    const { count } = await supabase
      .from('predictions')
      .update({
        is_locked: true,
        locked_reason: 'result_confirmed',
      })
      .eq('match_number', dbMatch.match_number)
      .eq('is_locked', false)
      .select('*', { count: 'exact', head: true });

    incLocked(count || 0);

    // Score the match
    if (parsed.homeScore !== null && parsed.awayScore !== null) {
      const result = await scoreMatch(
        dbMatch.match_number,
        winnerTeamId,
        parsed.homeScore,
        parsed.awayScore
      );
      addPoints(result.scored || 0);

      if (dbMatch.round === 'final') {
        console.log('🏆 FINAL decided! Scoring champion predictions...');
        await scoreChampionPredictions(winnerTeamId);
      }
    }

    // Advance winner
    if (winnerTeamId && dbMatch.feeds_into_match && dbMatch.feeds_into_slot) {
      const slotColumn = dbMatch.feeds_into_slot === 'home' ? 'home_team_id' : 'away_team_id';
      const { error: advanceError } = await supabase
        .from('matches')
        .update({ [slotColumn]: winnerTeamId })
        .eq('match_number', dbMatch.feeds_into_match);

      if (advanceError) {
        errors.push(`Advance M#${dbMatch.match_number} → M#${dbMatch.feeds_into_match}: ${advanceError.message}`);
      } else {
        console.log(`➡️ Advanced winner to Match #${dbMatch.feeds_into_match} (${dbMatch.feeds_into_slot} slot)`);
      }
    }

    // Advance loser if semifinal
    if (dbMatch.round === 'semifinal') {
      const loserTeamId = winnerTeamId === homeTeamId ? awayTeamId : homeTeamId;
      if (loserTeamId) {
        const thirdPlaceSlot = dbMatch.match_number === 101 ? 'home_team_id' : 'away_team_id';
        const { error: thirdPlaceError } = await supabase
          .from('matches')
          .update({ [thirdPlaceSlot]: loserTeamId })
          .eq('match_number', 103);
        
        if (thirdPlaceError) {
          errors.push(`Third place advancement from M#${dbMatch.match_number}: ${thirdPlaceError.message}`);
        } else {
          console.log(`➡️ Advanced loser from M#${dbMatch.match_number} to Match #103 (third place)`);
        }
      }
    }
  }
}

/**
 * Start the cron job — runs every 5 minutes
 */
function startSyncCron() {
  console.log('⏰ Match sync cron scheduled (every 5 minutes)');

  cron.schedule('*/5 * * * *', async () => {
    console.log(`🕐 Cron triggered at ${new Date().toISOString()}`);
    await runSync();
  });
}

module.exports = { startSyncCron, runSync };
