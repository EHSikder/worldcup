const axios = require('axios');
const env = require('../config/env');

// TheSportsDB V2 API.
//   • Base:   https://www.thesportsdb.com/api/v2/json
//   • Auth:   header  X-API-KEY: <your premium key>
//   • Premium features used here: V2 access, full-season schedule, livescores.
const BASE_URL  = env.THESPORTSDB_BASE_URL || 'https://www.thesportsdb.com/api/v2/json';
const API_KEY   = env.THESPORTSDB_API_KEY;
const LEAGUE_ID = env.THESPORTSDB_LEAGUE_ID;  // e.g. 4429 = FIFA World Cup
const SEASON    = env.THESPORTSDB_SEASON;     // e.g. 2026

function client() {
  if (!API_KEY)   throw new Error('THESPORTSDB_API_KEY is missing.');
  if (!LEAGUE_ID) throw new Error('THESPORTSDB_LEAGUE_ID is missing.');
  return axios.create({
    baseURL: BASE_URL,
    headers: { 'X-API-KEY': API_KEY },
    timeout: 20000,
  });
}

// V2 responses wrap the array under different keys (schedule → "schedule",
// livescore → "livescore", teams → "teams"). Pull it out defensively.
function extractArray(data, keys) {
  if (Array.isArray(data)) return data;
  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  return [];
}

/** Full season schedule — fixtures + final results (up to 3000 events). */
async function fetchSchedule() {
  if (!SEASON) throw new Error('THESPORTSDB_SEASON is missing.');
  const { data } = await client().get(`/schedule/league/${LEAGUE_ID}/${SEASON}`);
  return extractArray(data, ['schedule', 'events', 'results']);
}

/** Live, in-progress events for the league (premium). */
async function fetchLiveScores() {
  const { data } = await client().get(`/livescore/${LEAGUE_ID}`);
  return extractArray(data, ['livescore', 'events', 'results']);
}

/** All teams in the league — handy for one-time id seeding (optional). */
async function fetchLeagueTeams() {
  const { data } = await client().get(`/list/teams/${LEAGUE_ID}`);
  return extractArray(data, ['teams', 'list']);
}

function toInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Map a TheSportsDB soccer status to our match_status enum.
 * Codes: TBD NS 1H HT 2H ET P FT AET PEN BT SUSP INT PST CANC ABD AWD WO
 * Also tolerates the long-form text ("Match Finished", "Half Time", …).
 */
function mapStatus(raw) {
  const s = (raw || '').trim().toUpperCase();
  if (!s) return 'scheduled';

  if (['FT', 'AET', 'PEN', 'AWD', 'WO', 'MATCH FINISHED', 'FINISHED', 'FULL TIME'].includes(s)) return 'finished';
  if (['HT', 'HALF TIME', 'HALFTIME'].includes(s)) return 'halftime';
  if (['ET', 'BT', 'EXTRA TIME', 'BREAK TIME'].includes(s)) return 'extra_time';
  if (['P', 'PENALTIES', 'PEN LIVE', 'PENALTY'].includes(s)) return 'penalties';
  if (['1H', '2H', 'LIVE', 'IN PLAY', 'INPLAY', '1ST HALF', '2ND HALF', 'SUSP', 'INT'].includes(s)) return 'live';

  // NS, TBD, PST (postponed), CANC, ABD, "Not Started", etc.
  return 'scheduled';
}

/** Build a UTC ISO kickoff string from an event, preferring the ISO timestamp. */
function parseKickoff(ev) {
  if (ev.strTimestamp) {
    const d = new Date(ev.strTimestamp);          // "2026-06-11T19:00:00+00:00"
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (ev.dateEvent) {
    // dateEvent + strTime are UTC on TheSportsDB; append Z to be explicit.
    let time = ev.strTime || '00:00:00';
    if (/^\d{2}:\d{2}$/.test(time)) time = `${time}:00`;
    const d = new Date(`${ev.dateEvent}T${time}Z`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

/** Normalise a schedule OR livescore event into one internal shape. */
function parseEvent(ev) {
  return {
    eventId:       ev.idEvent != null ? String(ev.idEvent) : null,
    homeTeamApiId: ev.idHomeTeam != null && ev.idHomeTeam !== '' ? String(ev.idHomeTeam) : null,
    awayTeamApiId: ev.idAwayTeam != null && ev.idAwayTeam !== '' ? String(ev.idAwayTeam) : null,
    homeTeamName:  ev.strHomeTeam || null,
    awayTeamName:  ev.strAwayTeam || null,
    kickoffTime:   parseKickoff(ev),
    status:        mapStatus(ev.strStatus),
    homeScore:     toInt(ev.intHomeScore),
    awayScore:     toInt(ev.intAwayScore),
  };
}

/**
 * Winner's API team id, or null. TheSportsDB's V2 feed exposes only the final
 * intHomeScore / intAwayScore — no separate ET / penalty columns — so a match
 * decided on penalties comes through as a draw. We return null in that case;
 * the caller logs it and an admin sets the winner manually.
 */
function getWinnerApiId(parsed) {
  if (parsed.status !== 'finished') return null;
  if (parsed.homeScore == null || parsed.awayScore == null) return null;
  if (parsed.homeScore > parsed.awayScore) return parsed.homeTeamApiId;
  if (parsed.awayScore > parsed.homeScore) return parsed.awayTeamApiId;
  return null; // group-stage draw, or knockout decided on penalties
}

module.exports = {
  fetchSchedule,
  fetchLiveScores,
  fetchLeagueTeams,
  parseEvent,
  mapStatus,
  getWinnerApiId,
};
