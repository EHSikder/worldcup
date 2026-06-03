const axios = require('axios');
const env = require('../config/env');

const BASE_URL = 'https://api.worldcupapi.com';

/**
 * Fetch all fixtures from WorldCupAPI
 */
async function fetchAllFixtures() {
  if (!env.API_FOOTBALL_KEY) {
    throw new Error('API key is missing.');
  }

  try {
    let allFixtures = [];
    let page = 1;
    
    while (true) {
      const response = await axios.get(`${BASE_URL}/fixtures`, {
        params: { key: env.API_FOOTBALL_KEY, page }
      });
      
      let fixtures = [];
      if (response.data && response.data.success !== undefined) {
        if (!response.data.success) {
          throw new Error(response.data.error || 'Failed to fetch fixtures');
        }
        fixtures = response.data.data;
      } else {
        fixtures = Array.isArray(response.data) ? response.data : [];
      }
      
      if (!fixtures || fixtures.length === 0) break;
      
      allFixtures = allFixtures.concat(fixtures);
      page++;
    }
    
    return allFixtures;
  } catch (err) {
    console.error('Error fetching fixtures from WorldCupAPI:', err.message);
    throw err;
  }
}

/**
 * Fetch live scores from WorldCupAPI
 */
async function fetchLiveScores() {
  if (!env.API_FOOTBALL_KEY) {
    throw new Error('API key is missing.');
  }

  try {
    const response = await axios.get(`${BASE_URL}/livescores`, {
      params: { key: env.API_FOOTBALL_KEY }
    });
    
    if (response.data && response.data.success !== undefined) {
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch live scores');
      }
      return response.data.data;
    }
    
    return Array.isArray(response.data) ? response.data : [];
  } catch (err) {
    console.error('Error fetching live scores from WorldCupAPI:', err.message);
    throw err;
  }
}

/**
 * Parse standard fixture data to our internal format
 */
function parseFixture(fixture) {
  // fixture object shape from docs:
  // {
  //   "id": 1825339,
  //   "date": "2026-06-11",
  //   "time": "19:00:00",
  //   "home": { "id": 1450, "name": "Mexico" },
  //   "away": { "id": 2767, "name": "South Africa" }
  // }
  
  return {
    fixtureId: fixture.id || fixture.fixture_id,
    homeTeamApiId: fixture.home?.id,
    awayTeamApiId: fixture.away?.id,
    kickoffTime: `${fixture.date}T${fixture.time}Z`,
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    homePenaltyScore: null,
    awayPenaltyScore: null,
    homeExtraTimeScore: null,
    awayExtraTimeScore: null,
  };
}

/**
 * Parse live score data to our internal format
 */
function parseLiveScore(match) {
  // match object shape from docs:
  // {
  //   "id": 483252,
  //   "fixture_id": 1657338,
  //   "status": "IN PLAY" | "FINISHED" | "HALF TIME" etc,
  //   "scores": {
  //     "score": "0 - 1",
  //     "ht_score": "",
  //     "ft_score": "",
  //     "et_score": "",
  //     "ps_score": ""
  //   },
  //   "home": { "id": 211 },
  //   "away": { "id": 208 }
  // }

  let homeScore = null;
  let awayScore = null;
  let homePenaltyScore = null;
  let awayPenaltyScore = null;
  let homeExtraTimeScore = null;
  let awayExtraTimeScore = null;

  // parse primary score
  if (match.scores?.score) {
    const parts = match.scores.score.split('-');
    if (parts.length === 2) {
      homeScore = parseInt(parts[0].trim(), 10);
      awayScore = parseInt(parts[1].trim(), 10);
    }
  }

  // parse penalty score
  if (match.scores?.ps_score) {
    const parts = match.scores.ps_score.split('-');
    if (parts.length === 2) {
      homePenaltyScore = parseInt(parts[0].trim(), 10);
      awayPenaltyScore = parseInt(parts[1].trim(), 10);
    }
  }

  // parse extra time score
  if (match.scores?.et_score) {
    const parts = match.scores.et_score.split('-');
    if (parts.length === 2) {
      homeExtraTimeScore = parseInt(parts[0].trim(), 10);
      awayExtraTimeScore = parseInt(parts[1].trim(), 10);
    }
  }

  let mappedStatus = 'scheduled';
  const apiStatus = (match.status || '').toUpperCase();
  
  if (apiStatus.includes('IN PLAY') || apiStatus.includes('LIVE')) {
    mappedStatus = 'live';
  } else if (apiStatus.includes('FINISHED') || apiStatus.includes('FT') || apiStatus.includes('FULL TIME')) {
    mappedStatus = 'finished';
  } else if (apiStatus.includes('HALF TIME') || apiStatus.includes('HT')) {
    mappedStatus = 'halftime';
  } else if (apiStatus.includes('EXTRA TIME') || apiStatus.includes('ET')) {
    mappedStatus = 'extra_time';
  } else if (apiStatus.includes('PENALTIES') || apiStatus.includes('PEN')) {
    mappedStatus = 'penalties';
  }

  return {
    fixtureId: match.fixture_id || match.id,
    homeTeamApiId: match.home?.id,
    awayTeamApiId: match.away?.id,
    status: mappedStatus,
    homeScore,
    awayScore,
    homeExtraTimeScore,
    awayExtraTimeScore,
    homePenaltyScore,
    awayPenaltyScore,
  };
}

/**
 * Determine the winner based on parsed scores
 */
function getWinnerApiId(parsed) {
  if (parsed.status !== 'finished') return null;
  if (parsed.homeScore === null || parsed.awayScore === null) return null;

  // check penalties first
  if (parsed.homePenaltyScore !== null && parsed.awayPenaltyScore !== null) {
    if (parsed.homePenaltyScore > parsed.awayPenaltyScore) return parsed.homeTeamApiId;
    if (parsed.awayPenaltyScore > parsed.homePenaltyScore) return parsed.awayTeamApiId;
  }
  
  // check extra time next
  if (parsed.homeExtraTimeScore !== null && parsed.awayExtraTimeScore !== null) {
    if (parsed.homeExtraTimeScore > parsed.awayExtraTimeScore) return parsed.homeTeamApiId;
    if (parsed.awayExtraTimeScore > parsed.homeExtraTimeScore) return parsed.awayTeamApiId;
  }

  // base score
  if (parsed.homeScore > parsed.awayScore) return parsed.homeTeamApiId;
  if (parsed.awayScore > parsed.homeScore) return parsed.awayTeamApiId;

  // if draw at full time and no extra/penalties available (group stage matches normally)
  return null;
}

module.exports = {
  fetchAllFixtures,
  fetchLiveScores,
  parseFixture,
  parseLiveScore,
  getWinnerApiId,
};
