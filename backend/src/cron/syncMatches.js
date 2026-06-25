const cron = require('node-cron');
const supabase = require('../config/database');
const env = require('../config/env');
const {
  fetchSchedule,
  fetchLiveScores,
  parseEvent,
  getWinnerApiId,
  canonTeam,
} = require('../services/sportsDbApiService');
const {
  scoreMatch,
  scoreChampionPredictions,
} = require('../services/scoringService');

// Columns processMatchUpdate / linkMatch need from a match row.
const MATCH_COLS =
  'id, match_number, round, status, winner_team_id, feeds_into_match, feeds_into_slot, kickoff_time, home_team_id, away_team_id, home_score, away_score, thesportsdb_event_id';

// A pair of teams meets at most once in the tournament.
const pairKey = (a, b) => [a, b].sort().join('|');

/** Load teams once into lookup maps (by TheSportsDB id and by name). */
async function buildContext() {
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, thesportsdb_id');

  const teamByApiId = new Map();
  const teamByName  = new Map();
  (teams || []).forEach((t) => {
    if (t.thesportsdb_id) teamByApiId.set(String(t.thesportsdb_id), t);
    if (t.name)           teamByName.set(canonTeam(t.name), t);
  });

  return { teamByApiId, teamByName, unresolved: new Map() };
}

/**
 * Resolve a TheSportsDB team id → our team UUID.
 *  1) by teams.thesportsdb_id (fast path once seeded)
 *  2) by case-insensitive name match — and SELF-HEAL by storing the id, so you
 *     never have to hand-enter team ids; national-team names are stable.
 */
async function resolveTeam(apiId, apiName, ctx) {
  if (apiId && ctx.teamByApiId.has(apiId)) return ctx.teamByApiId.get(apiId).id;

  if (apiName) {
    // canonTeam folds accents/casing/aliases ("USA"↔"United States", etc.) so
    // names line up even when TheSportsDB spells a team differently than our DB.
    const t = ctx.teamByName.get(canonTeam(apiName));
    if (t) {
      if (apiId && !t.thesportsdb_id) {
        await supabase.from('teams').update({ thesportsdb_id: apiId }).eq('id', t.id);
        t.thesportsdb_id = apiId;
        ctx.teamByApiId.set(apiId, t);
      }
      return t.id;
    }
    // Couldn't match — record (name + id) so the run logs exactly which teams
    // need a manual thesportsdb_id.
    if (ctx.unresolved && apiId) ctx.unresolved.set(apiName, apiId);
  }
  return null;
}

/**
 * Link an API event → our match row.
 *  1) by matches.thesportsdb_event_id (preferred, exact)
 *  2) by team pair (auto-links once both teams resolve) and SELF-HEAL the
 *     event id. Knockout matches link automatically as bracket advancement
 *     fills their teams; you can also set thesportsdb_event_id by hand.
 */
async function linkMatch(parsed, homeUuid, awayUuid) {
  if (parsed.eventId) {
    const { data } = await supabase
      .from('matches').select(MATCH_COLS)
      .eq('thesportsdb_event_id', parsed.eventId).limit(1);
    if (data && data[0]) return data[0];
  }

  if (homeUuid && awayUuid) {
    const { data } = await supabase
      .from('matches').select(MATCH_COLS)
      .is('thesportsdb_event_id', null)
      .or(`and(home_team_id.eq.${homeUuid},away_team_id.eq.${awayUuid}),and(home_team_id.eq.${awayUuid},away_team_id.eq.${homeUuid})`)
      .limit(1);

    if (data && data[0]) {
      const m = data[0];
      if (parsed.eventId) {
        await supabase.from('matches').update({ thesportsdb_event_id: parsed.eventId }).eq('id', m.id);
        m.thesportsdb_event_id = parsed.eventId;
      }
      return m;
    }
  }
  return null;
}

async function runSync() {
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

  const incMatches = () => { matchesUpdated++; };
  const incLocked  = (n) => { predictionsLocked += (n || 0); };
  const addPoints  = (n) => { pointsRecalculated += (n || 0); };

  try {
    console.log('🔄 Starting TheSportsDB sync...');

    if (!env.THESPORTSDB_API_KEY) {
      throw new Error('THESPORTSDB_API_KEY is not configured. Skipping sync.');
    }

    const ctx = await buildContext();

    // 1. Livescores — real-time in-play updates.
    try {
      const liveEvents = await fetchLiveScores();
      console.log(`📡 Fetched ${liveEvents.length} live events from TheSportsDB`);

      for (const ev of liveEvents) {
        try {
          const parsed = parseEvent(ev);
          parsed.kickoffTime = null; // livescore has no reliable kickoff — never overwrite it
          if (!parsed.eventId) continue;

          const homeTeamId = await resolveTeam(parsed.homeTeamApiId, parsed.homeTeamName, ctx);
          const awayTeamId = await resolveTeam(parsed.awayTeamApiId, parsed.awayTeamName, ctx);
          const dbMatch    = await linkMatch(parsed, homeTeamId, awayTeamId);
          if (!dbMatch || dbMatch.status === 'finished') continue;

          const winnerApiId  = getWinnerApiId(parsed);
          const winnerTeamId = winnerApiId ? await resolveTeam(winnerApiId, null, ctx) : null;

          await processMatchUpdate(dbMatch, parsed, { homeTeamId, awayTeamId, winnerTeamId }, errors, incMatches, incLocked, addPoints);
        } catch (matchErr) {
          errors.push(`Live event ${ev.idEvent}: ${matchErr.message}`);
        }
      }
    } catch (e) {
      errors.push(`LiveScores Error: ${e.message}`);
    }

    // 2. Schedule — fixtures (kickoff/teams) + final results. One request, so
    //    we run it every sync; the diff below means unchanged rows aren't
    //    rewritten, and finished rows are skipped.
    try {
      const schedEvents = await fetchSchedule();
      console.log(`📅 Fetched ${schedEvents.length} schedule events from TheSportsDB`);

      for (const ev of schedEvents) {
        try {
          const parsed = parseEvent(ev);
          if (!parsed.eventId) continue;

          const homeTeamId = await resolveTeam(parsed.homeTeamApiId, parsed.homeTeamName, ctx);
          const awayTeamId = await resolveTeam(parsed.awayTeamApiId, parsed.awayTeamName, ctx);
          const dbMatch    = await linkMatch(parsed, homeTeamId, awayTeamId);
          if (!dbMatch || dbMatch.status === 'finished') continue;

          const winnerApiId  = getWinnerApiId(parsed);
          const winnerTeamId = winnerApiId ? await resolveTeam(winnerApiId, null, ctx) : null;

          await processMatchUpdate(dbMatch, parsed, { homeTeamId, awayTeamId, winnerTeamId }, errors, incMatches, incLocked, addPoints);
        } catch (fixtureErr) {
          errors.push(`Schedule event ${ev.idEvent}: ${fixtureErr.message}`);
        }
      }
    } catch (e) {
      errors.push(`Schedule Error: ${e.message}`);
    }

    // 3. Lock predictions for matches starting in < 5 minutes.
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

        if (diffMinutes <= 5 && diffMinutes > -100) {
          const { count } = await supabase
            .from('predictions')
            .update({ is_locked: true, locked_reason: 'time_lock' })
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

    // Name the exact teams we couldn't match, so you can map them once:
    //   UPDATE teams SET thesportsdb_id = '<id>' WHERE name = '<your team name>';
    if (ctx.unresolved.size) {
      const list = [...ctx.unresolved.entries()].map(([name, id]) => `"${name}" (id ${id})`).join(', ');
      console.warn(`⚠️ ${ctx.unresolved.size} TheSportsDB team(s) didn't match any DB team — set their thesportsdb_id: ${list}`);
    }

    await supabase
      .from('sync_log')
      .update({
        completed_at: new Date().toISOString(),
        matches_updated: matchesUpdated,
        predictions_locked: predictionsLocked,
        points_recalculated: pointsRecalculated,
        errors: errors.length > 0 ? errors.join('\n') : null,
        status: 'completed',
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

async function processMatchUpdate(dbMatch, parsed, resolved, errors, incMatches, incLocked, addPoints) {
  const previousStatus = dbMatch.status;
  const { homeTeamId, awayTeamId, winnerTeamId } = resolved;

  // No draws in the knockout stage. TheSportsDB's feed has no penalty column, so
  // a level "finished" score means we don't know who advanced yet — keep the
  // match showing in-progress (penalties) and DON'T finalize/score/advance until
  // a winner is known (a later poll, or an admin setting it).
  let effStatus = parsed.status;
  if (parsed.status === 'finished' && dbMatch.round !== 'group_stage' && !winnerTeamId) {
    effStatus = 'penalties';
    console.warn(`⏳ Match #${dbMatch.match_number} level ${parsed.homeScore}-${parsed.awayScore} in knockout — awaiting winner (penalties); kept in-progress.`);
  }

  // Build ONLY changed columns — avoids needless updated_at bumps + realtime
  // events on every sync. (TheSportsDB's feed has no ET/penalty columns, so
  // those are left for manual entry on a penalty-shootout match.)
  const updateData = {};
  if (effStatus && effStatus !== 'scheduled' && effStatus !== dbMatch.status) {
    updateData.status = effStatus;
  }
  if (parsed.kickoffTime &&
      new Date(parsed.kickoffTime).getTime() !== new Date(dbMatch.kickoff_time || 0).getTime()) {
    updateData.kickoff_time = parsed.kickoffTime;
  }
  if (parsed.homeScore !== null && parsed.homeScore !== dbMatch.home_score) updateData.home_score = parsed.homeScore;
  if (parsed.awayScore !== null && parsed.awayScore !== dbMatch.away_score) updateData.away_score = parsed.awayScore;

  // Only fill team ids if the match doesn't already have them (knockouts get
  // their teams from bracket advancement below).
  if (homeTeamId && !dbMatch.home_team_id) updateData.home_team_id = homeTeamId;
  if (awayTeamId && !dbMatch.away_team_id) updateData.away_team_id = awayTeamId;
  if (winnerTeamId && winnerTeamId !== dbMatch.winner_team_id) updateData.winner_team_id = winnerTeamId;

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

  // Finalize ONLY when we truly have a finished result (knockouts require a
  // winner — see effStatus above), then score + advance the bracket.
  if (previousStatus !== 'finished' && effStatus === 'finished') {
    console.log(`🏆 Match #${dbMatch.match_number} finished! Scoring...`);

    // Lock predictions for this match (if not already locked by time).
    const { count } = await supabase
      .from('predictions')
      .update({ is_locked: true, locked_reason: 'result_confirmed' })
      .eq('match_number', dbMatch.match_number)
      .eq('is_locked', false)
      .select('*', { count: 'exact', head: true });

    incLocked(count || 0);

    // Score the match.
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

    // Advance winner.
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

    // Advance loser if semifinal (to third-place match #103).
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
