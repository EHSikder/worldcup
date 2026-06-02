const env = require('../config/env');

const BASE_URL = 'https://v3.football.api-sports.io';
const LEAGUE_ID = 1; // FIFA World Cup
const SEASON = 2026;

/**
 * Make an authenticated request to API-Football
 */
async function apiRequest(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'x-apisports-key': env.API_FOOTBALL_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`API-Football error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football errors: ${JSON.stringify(data.errors)}`);
  }

  return data;
}

/**
 * Map API-Football status codes to our match_status enum
 */
function mapStatus(shortStatus) {
  const statusMap = {
    // Finished
    FT: 'finished',
    AET: 'finished',
    PEN: 'finished',
    // Live
    '1H': 'live',
    '2H': 'live',
    HT: 'halftime',
    // Extra time / Penalties in progress
    ET: 'extra_time',
    BT: 'extra_time',
    P: 'penalties',
    // Scheduled
    NS: 'scheduled',
    TBD: 'scheduled',
    // Other
    PST: 'postponed',
    CANC: 'cancelled',
    SUSP: 'suspended',
    INT: 'suspended',
    ABD: 'suspended',
    AWD: 'finished',
    WO: 'finished',
  };
  return statusMap[shortStatus] || 'scheduled';
}

/**
 * Fetch all World Cup 2026 fixtures
 */
async function fetchAllFixtures() {
  const data = await apiRequest('/fixtures', {
    league: LEAGUE_ID,
    season: SEASON,
  });
  return data.response || [];
}

/**
 * Fetch fixtures for a specific round
 */
async function fetchFixturesByRound(round) {
  const data = await apiRequest('/fixtures', {
    league: LEAGUE_ID,
    season: SEASON,
    round,
  });
  return data.response || [];
}

/**
 * Fetch all teams for the World Cup 2026
 */
async function fetchTeams() {
  const data = await apiRequest('/teams', {
    league: LEAGUE_ID,
    season: SEASON,
  });
  return data.response || [];
}

/**
 * Parse a fixture response into a normalized object
 */
function parseFixture(fixture) {
  const f = fixture.fixture;
  const goals = fixture.goals;
  const teams = fixture.teams;
  const score = fixture.score;

  return {
    fixtureId: f.id,
    status: mapStatus(f.status?.short),
    statusShort: f.status?.short,
    homeTeamApiId: teams?.home?.id,
    awayTeamApiId: teams?.away?.id,
    homeScore: goals?.home,
    awayScore: goals?.away,
    homeExtraTimeScore: score?.extratime?.home,
    awayExtraTimeScore: score?.extratime?.away,
    homePenaltyScore: score?.penalty?.home,
    awayPenaltyScore: score?.penalty?.away,
    homeWinner: teams?.home?.winner,
    awayWinner: teams?.away?.winner,
    kickoffTime: f.date,
    venue: f.venue?.name,
    city: f.venue?.city,
  };
}

/**
 * Determine the winner team API ID from a parsed fixture
 */
function getWinnerApiId(parsed) {
  if (parsed.homeWinner === true) return parsed.homeTeamApiId;
  if (parsed.awayWinner === true) return parsed.awayTeamApiId;
  return null;
}

module.exports = {
  fetchAllFixtures,
  fetchFixturesByRound,
  fetchTeams,
  parseFixture,
  getWinnerApiId,
  mapStatus,
};
