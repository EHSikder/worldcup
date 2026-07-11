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
const { fetchEspnScoreboard, findCompletedWinnerName } = require('../services/espnService');
const {
  scoreMatch,
  scoreChampionPredictions,
} = require('../services/scoringService');

// Minutes to wait after a knockout ties (penalties) before asking ESPN for the
// shootout winner — lets the shootout finish first.
const PENALTY_WAIT_MIN = 10;

// Columns processMatchUpdate / linkMatch need from a match row.
// feeds_into_* are intentionally NOT selected — the system no longer advances
// teams itself (see finalizeMatch); you set knockout teams / event ids manually.
const MATCH_COLS =
  'id, match_number, round, status, winner_team_id, kickoff_time, home_team_id, away_team_id, home_score, away_score, thesportsdb_event_id';

// A pair of teams can meet up to twice (group + knockout), so a pair alone is
// not a unique key — we disambiguate by date below.
const pairKey = (a, b) => [a, b].sort().join('|');

// Two games can share a DATE but never a kickoff TIME, so we disambiguate by
// matching the event's kickoff to a candidate's kickoff (small tolerance for
// minor feed differences). It NEVER guesses: if it can't confirm by time, it
// links nothing — this is what stops the wrong-team updates.
const KICKOFF_TOL_MS = 2 * 3600 * 1000; // 2h — well under the gap between same-day games
const closeTime = (a, b) => !!(a && b) && Math.abs(new Date(a) - new Date(b)) <= KICKOFF_TOL_MS;

/**
 * Pick the ONE unlinked match a schedule event belongs to, from the candidates
 * that share its team pair, by kickoff time:
 *   • 1 candidate → if both have a time it must line up (rejects a stray event
 *     with the same teams at a different time); a not-yet-scheduled match with
 *     no time is allowed (seeding);
 *   • 2+ candidates (teams meet in group AND knockout) → the one whose kickoff
 *     matches this event's time; if none, don't guess (return null).
 */
function pickByTime(candidates, eventTime) {
  const list = (candidates || []).filter((c) => !c.thesportsdb_event_id);
  if (list.length === 0) return null;
  if (list.length === 1) {
    const c = list[0];
    if (c.kickoff_time && eventTime && !closeTime(c.kickoff_time, eventTime)) return null;
    return c;
  }
  return list.find((c) => closeTime(c.kickoff_time, eventTime)) || null;
}

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
 *  2) by team pair (auto-links once both teams are present) and SELF-HEAL the
 *     event id. The system never advances teams itself, so a knockout match
 *     links only after YOU set its teams (or its thesportsdb_event_id) — no
 *     guesswork can put a wrong team into a later round.
 */
async function linkMatch(parsed, homeUuid, awayUuid) {
  // 1) Exact, by the stored TheSportsDB event id.
  if (parsed.eventId) {
    const { data } = await supabase
      .from('matches').select(MATCH_COLS)
      .eq('thesportsdb_event_id', parsed.eventId).limit(1);
    if (data && data[0]) return data[0];
  }

  if (!homeUuid || !awayUuid) return null;

  // 2) Team-pair fallback — ALL unlinked matches with this pair, then disambiguate
  //    by date so a stray/duplicate event can't hijack the wrong match.
  const { data: cands } = await supabase
    .from('matches').select(MATCH_COLS)
    .is('thesportsdb_event_id', null)
    .or(`and(home_team_id.eq.${homeUuid},away_team_id.eq.${awayUuid}),and(home_team_id.eq.${awayUuid},away_team_id.eq.${homeUuid})`);

  const m = pickByTime(cands || [], parsed.kickoffTime);
  if (!m) return null;

  if (parsed.eventId) {
    await supabase.from('matches').update({ thesportsdb_event_id: parsed.eventId }).eq('id', m.id);
    m.thesportsdb_event_id = parsed.eventId;
  }
  return m;
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
          if (!dbMatch || dbMatch.status === 'finished' || dbMatch.status === 'penalties') continue;

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
          if (!dbMatch || dbMatch.status === 'finished' || dbMatch.status === 'penalties') continue;

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

    // 2b. Resolve penalty-shootout winners via ESPN (knockout matches that tied
    //     and have waited out the shootout). Safe with dual matches.
    try {
      await resolvePendingPenalties(ctx, errors, incMatches, addPoints);
    } catch (e) {
      errors.push(`Penalty resolution Error: ${e.message}`);
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

  // Effective result — extra time / penalties may override the raw feed below.
  let effStatus = parsed.status;
  let effWinner = winnerTeamId;
  let effHome   = parsed.homeScore;
  let effAway   = parsed.awayScore;
  const extra   = {}; // ET / penalties_since columns to write, if any

  // No draws in the knockout stage. A level "finished" score means we don't yet
  // know who advanced. First try EXTRA TIME (v1 lookupevent); if still level,
  // it's penalties — keep it in-progress and let the ESPN pass resolve it.
  if (parsed.status === 'finished' && dbMatch.round !== 'group_stage' && !winnerTeamId) {
    // Knockout level at full time → penalties. We do NOT read any score from
    // TheSportsDB for it (its penalty field is unreliable/delayed): park it in
    // 'penalties' with the level score and let the ESPN pass fill in the winner.
    effStatus = 'penalties';
    if (dbMatch.status !== 'penalties') extra.penalties_since = new Date().toISOString();
    console.warn(`⏳ Match #${dbMatch.match_number} level — penalties; winner via ESPN.`);
  }

  // Build ONLY changed columns.
  const updateData = { ...extra };
  if (effStatus && effStatus !== 'scheduled' && effStatus !== dbMatch.status) {
    updateData.status = effStatus;
  }
  if (parsed.kickoffTime &&
      new Date(parsed.kickoffTime).getTime() !== new Date(dbMatch.kickoff_time || 0).getTime()) {
    updateData.kickoff_time = parsed.kickoffTime;
  }
  if (effHome != null && effHome !== dbMatch.home_score) updateData.home_score = effHome;
  if (effAway != null && effAway !== dbMatch.away_score) updateData.away_score = effAway;

  // Only fill team ids if the match doesn't already have them.
  if (homeTeamId && !dbMatch.home_team_id) updateData.home_team_id = homeTeamId;
  if (awayTeamId && !dbMatch.away_team_id) updateData.away_team_id = awayTeamId;
  if (effWinner && effWinner !== dbMatch.winner_team_id) updateData.winner_team_id = effWinner;

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

  // Finalize ONLY when we truly have a finished result (knockouts require a winner).
  if (previousStatus !== 'finished' && effStatus === 'finished') {
    await finalizeMatch(dbMatch, effWinner, homeTeamId, awayTeamId, effHome, effAway, errors, incLocked, addPoints);
  }
}

/**
 * Lock + score a finished match and score the champion on the final.
 *
 * NO bracket advancement. The system never writes teams into a later match —
 * not the winner into feeds_into_match, not the semifinal loser into the third-
 * place match. That auto-advance was the source of the "random wrong-team"
 * updates, so it's removed: you fill each knockout match's teams (or its
 * thesportsdb_event_id) manually and the feed only ever scores what's there.
 * Shared by the normal sync and the ESPN penalty resolver.
 */
async function finalizeMatch(dbMatch, winnerTeamId, homeTeamId, awayTeamId, homeScore, awayScore, errors, incLocked, addPoints) {
  console.log(`🏆 Match #${dbMatch.match_number} finished! Scoring...`);

  const { count } = await supabase
    .from('predictions')
    .update({ is_locked: true, locked_reason: 'result_confirmed' })
    .eq('match_number', dbMatch.match_number)
    .eq('is_locked', false)
    .select('*', { count: 'exact', head: true });
  if (incLocked) incLocked(count || 0);

  if (homeScore != null && awayScore != null) {
    const result = await scoreMatch(dbMatch.match_number, winnerTeamId, homeScore, awayScore);
    if (addPoints) addPoints(result.scored || 0);

    if (dbMatch.round === 'final') {
      console.log('🏆 FINAL decided! Scoring champion predictions...');
      await scoreChampionPredictions(winnerTeamId);
    }
  }
}

/**
 * For matches in 'penalties', once the wait elapses, read the shootout winner
 * from ESPN (by team names + date) and finalize (score + advance). One ESPN
 * call per date covers all matches that tied that day (dual matches).
 */
async function resolvePendingPenalties(ctx, errors, incMatches, addPoints) {
  const { data: pens } = await supabase
    .from('matches')
    .select('id, match_number, round, status, kickoff_time, penalties_since, home_team_id, away_team_id, home_score, away_score, home:home_team_id(name), away:away_team_id(name)')
    .eq('status', 'penalties');
  if (!pens || !pens.length) return;

  const espnByDate = {};

  for (const m of pens) {
    if (!m.penalties_since) {
      await supabase.from('matches').update({ penalties_since: new Date().toISOString() }).eq('id', m.id);
      continue; // start the clock
    }
    // Give the shootout time to finish before asking ESPN; then retry each cycle.
    if ((Date.now() - new Date(m.penalties_since).getTime()) / 60000 < PENALTY_WAIT_MIN) continue;

    const homeName = m.home && m.home.name;
    const awayName = m.away && m.away.name;
    if (!homeName || !awayName) continue;

    const dateStr = m.kickoff_time ? new Date(m.kickoff_time).toISOString().slice(0, 10).replace(/-/g, '') : '';
    if (!(dateStr in espnByDate)) {
      try { espnByDate[dateStr] = await fetchEspnScoreboard(dateStr || null); }
      catch (e) { console.warn('ESPN fetch failed:', e.message); espnByDate[dateStr] = []; }
    }

    const winnerName = findCompletedWinnerName(espnByDate[dateStr], homeName, awayName);
    if (!winnerName) continue; // not decided yet — retry next cycle

    const winnerUuid = await resolveTeam(null, winnerName, ctx);
    if (!winnerUuid) { console.warn(`ESPN penalty winner "${winnerName}" (#${m.match_number}) not found in DB.`); continue; }

    // Winner + finished only (level score kept; no penalty score). Then score + advance.
    const { error } = await supabase.from('matches')
      .update({ winner_team_id: winnerUuid, status: 'finished', updated_at: new Date().toISOString() })
      .eq('id', m.id);
    if (error) { errors.push(`Penalty finalize #${m.match_number}: ${error.message}`); continue; }
    if (incMatches) incMatches();
    console.log(`🥅 #${m.match_number} penalty winner: ${winnerName} (via ESPN).`);
    await finalizeMatch(
      { match_number: m.match_number, round: m.round },
      winnerUuid, m.home_team_id, m.away_team_id, m.home_score, m.away_score, errors, null, addPoints
    );
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
