const axios = require('axios');
const { canonTeam } = require('./sportsDbApiService');

// ESPN's free, unauthenticated soccer scoreboard. For a COMPLETED match it
// exposes a per-team `winner: true/false` flag — including the penalty-shootout
// winner, which TheSportsDB never gives us. We use it only as a last resort, for
// the handful of knockout matches that go to penalties.
//   https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard
const ESPN_SCOREBOARD =
  process.env.ESPN_SCOREBOARD_URL ||
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

/**
 * Fetch the scoreboard, optionally for a specific UTC day (YYYYMMDD).
 * Returns the raw events array (never throws on empty — returns []).
 */
async function fetchEspnScoreboard(dateStr) {
  const { data } = await axios.get(ESPN_SCOREBOARD, {
    params: dateStr ? { dates: dateStr } : {},
    timeout: 20000,
  });
  return (data && Array.isArray(data.events)) ? data.events : [];
}

/**
 * Find the event for these two teams and, if it is COMPLETED, return the
 * winning team's name. Returns null if the match isn't found or isn't decided
 * yet (so the caller simply retries next cycle).
 *   Match is by team name (canonicalised) — no id mapping needed.
 */
function findCompletedWinnerName(events, homeName, awayName) {
  const a = canonTeam(homeName);
  const b = canonTeam(awayName);
  if (!a || !b) return null;

  for (const ev of (events || [])) {
    const comp = ev.competitions && ev.competitions[0];
    const competitors = comp && comp.competitors;
    if (!competitors || competitors.length < 2) continue;

    const keys = competitors.map((c) => canonTeam(c.team && (c.team.displayName || c.team.name || c.team.shortDisplayName)));
    if (!(keys.includes(a) && keys.includes(b))) continue;

    // Only trust a finished match.
    const completed = comp.status && comp.status.type && comp.status.type.completed;
    if (!completed) return null;

    const winner = competitors.find((c) => c.winner === true);
    if (winner && winner.team) {
      return winner.team.displayName || winner.team.name || null;
    }
    return null; // completed but no winner flag yet
  }
  return null; // not on this scoreboard
}

module.exports = { fetchEspnScoreboard, findCompletedWinnerName };
