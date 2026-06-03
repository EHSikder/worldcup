/**
 * fix_database.js
 * 
 * This script:
 * 1. Fixes 5 teams whose names differ between our DB and the WorldCupAPI
 * 2. Fetches all 104 fixtures from the API
 * 3. Clears all existing worldcupapi_fixture_id and team assignments from matches
 * 4. Re-maps every fixture to the correct match by matching group fixtures chronologically
 *    and knockout fixtures by chronological order
 * 5. Updates kickoff_time, venue, location from the API
 */

const axios = require('axios');
const supabase = require('../src/config/database');
const env = require('../src/config/env');

const BASE_URL = 'https://api.worldcupapi.com';

// Name mapping: DB name -> API name + API id
const TEAM_NAME_FIXES = [
  { dbName: 'Czechia',        apiName: 'Czech Republic', apiId: 1722 },
  { dbName: 'United States',  apiName: 'USA',            apiId: 1849 },
  { dbName: 'Türkiye',        apiName: 'Turkey',         apiId: 1744 },
  { dbName: 'Curaçao',        apiName: 'Curacao',        apiId: 2732 },
  { dbName: 'Cabo Verde',     apiName: 'Cape Verde',     apiId: 1608 },
];

async function fetchAllFixtures() {
  let allFixtures = [];
  let page = 1;
  while (true) {
    const res = await axios.get(`${BASE_URL}/fixtures`, {
      params: { key: env.API_FOOTBALL_KEY, page }
    });
    const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    if (data.length === 0) break;
    allFixtures = allFixtures.concat(data);
    page++;
  }
  return allFixtures;
}

async function run() {
  console.log('=== STEP 1: Fix team name mismatches ===');
  
  for (const fix of TEAM_NAME_FIXES) {
    const { data: team, error } = await supabase
      .from('teams')
      .select('id, name, worldcupapi_id')
      .eq('name', fix.dbName)
      .single();
    
    if (team) {
      const { error: updateErr } = await supabase
        .from('teams')
        .update({ worldcupapi_id: fix.apiId })
        .eq('id', team.id);
      
      if (updateErr) {
        console.error(`  ❌ Failed to update ${fix.dbName}:`, updateErr.message);
      } else {
        console.log(`  ✅ ${fix.dbName} -> worldcupapi_id = ${fix.apiId}`);
      }
    } else {
      console.warn(`  ⚠️ Team "${fix.dbName}" not found in DB`);
    }
  }

  console.log('\n=== STEP 2: Fetch all fixtures from API ===');
  const allFixtures = await fetchAllFixtures();
  console.log(`  Fetched ${allFixtures.length} fixtures`);

  // Sort chronologically
  allFixtures.sort((a, b) => {
    const da = new Date(`${a.date}T${a.time}Z`);
    const db = new Date(`${b.date}T${b.time}Z`);
    return da - db || a.id - b.id;
  });

  console.log('\n=== STEP 3: Build team API ID -> UUID map ===');
  const { data: allTeams } = await supabase.from('teams').select('id, name, worldcupapi_id, group_letter');
  const teamByApiId = {};
  for (const t of allTeams) {
    if (t.worldcupapi_id) {
      teamByApiId[t.worldcupapi_id] = t;
    }
  }
  console.log(`  ${Object.keys(teamByApiId).length} teams have API IDs`);

  // Separate group stage and knockout fixtures
  const groupFixtures = allFixtures.filter(f => ['1', '2', '3'].includes(f.round));
  const knockoutFixtures = allFixtures.filter(f => !['1', '2', '3'].includes(f.round));
  
  console.log(`  Group stage: ${groupFixtures.length} fixtures`);
  console.log(`  Knockout: ${knockoutFixtures.length} fixtures`);

  console.log('\n=== STEP 4: Clear all existing fixture mappings from matches ===');
  // First, get all matches
  const { data: allMatches } = await supabase
    .from('matches')
    .select('*')
    .order('match_number');
  
  console.log(`  Total matches in DB: ${allMatches.length}`);

  // Group stage matches are match_number 1-72
  const groupMatches = allMatches.filter(m => m.round === 'group_stage').sort((a, b) => a.match_number - b.match_number);
  const knockoutMatches = allMatches.filter(m => m.round !== 'group_stage').sort((a, b) => a.match_number - b.match_number);

  console.log(`  Group matches in DB: ${groupMatches.length}`);
  console.log(`  Knockout matches in DB: ${knockoutMatches.length}`);

  console.log('\n=== STEP 5: Map group stage fixtures ===');
  
  // Group the API fixtures by group_id
  const groupIdToGroupLetter = {};
  // We need to figure out which group_id maps to which group letter
  // We can do this by checking which teams are in each group_id
  const fixturesByGroupId = {};
  for (const f of groupFixtures) {
    if (!fixturesByGroupId[f.group_id]) fixturesByGroupId[f.group_id] = [];
    fixturesByGroupId[f.group_id].push(f);
  }
  
  // For each group_id, find what group_letter its teams belong to
  for (const [gid, fixtures] of Object.entries(fixturesByGroupId)) {
    const teamIds = new Set();
    fixtures.forEach(f => { teamIds.add(f.home.id); teamIds.add(f.away.id); });
    
    // Look up the group_letter from any of these teams
    for (const tid of teamIds) {
      const team = teamByApiId[tid];
      if (team) {
        groupIdToGroupLetter[gid] = team.group_letter;
        break;
      }
    }
  }
  
  console.log('  Group ID -> Letter mapping:', groupIdToGroupLetter);

  let mapped = 0;
  
  // For each group letter, sort the API fixtures chronologically and map to DB matches
  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  for (const groupLetter of groups) {
    // Find the group_id for this letter
    const gid = Object.entries(groupIdToGroupLetter).find(([_, v]) => v === groupLetter)?.[0];
    if (!gid) {
      console.warn(`  ⚠️ No group_id found for Group ${groupLetter}`);
      continue;
    }
    
    // Get API fixtures for this group, sorted chronologically
    const apiFixtures = (fixturesByGroupId[gid] || []).sort((a, b) => {
      const da = new Date(`${a.date}T${a.time}Z`);
      const db = new Date(`${b.date}T${b.time}Z`);
      return da - db || a.id - b.id;
    });
    
    // Get DB matches for this group, sorted by match_number  
    const dbGroupMatches = groupMatches.filter(m => {
      return m.home_placeholder?.includes(`Group ${groupLetter}`) || 
             m.away_placeholder?.includes(`Group ${groupLetter}`);
    }).sort((a, b) => a.match_number - b.match_number);
    
    if (apiFixtures.length !== dbGroupMatches.length) {
      console.warn(`  ⚠️ Group ${groupLetter}: API has ${apiFixtures.length} fixtures, DB has ${dbGroupMatches.length} matches`);
    }
    
    for (let i = 0; i < Math.min(apiFixtures.length, dbGroupMatches.length); i++) {
      const apiFix = apiFixtures[i];
      const dbMatch = dbGroupMatches[i];
      
      const homeTeam = teamByApiId[apiFix.home.id];
      const awayTeam = teamByApiId[apiFix.away.id];
      
      const updateData = {
        worldcupapi_fixture_id: apiFix.id,
        home_team_id: homeTeam?.id || null,
        away_team_id: awayTeam?.id || null,
        kickoff_time: `${apiFix.date}T${apiFix.time}Z`,
        venue: apiFix.location || null,
      };
      
      const { error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', dbMatch.id);
      
      if (error) {
        console.error(`  ❌ Match #${dbMatch.match_number}: ${error.message}`);
      } else {
        mapped++;
      }
    }
    console.log(`  Group ${groupLetter}: Mapped ${Math.min(apiFixtures.length, dbGroupMatches.length)} matches`);
  }

  console.log('\n=== STEP 6: Map knockout fixtures ===');
  
  // Map knockout by chronological order
  // API rounds: R32, R16, QF, SF, 3PPO, F
  // DB rounds: round_of_32, round_of_16, quarterfinal, semifinal, third_place, final
  const roundMapping = {
    'R32': 'round_of_32',
    'R16': 'round_of_16',
    'QF': 'quarterfinal',
    'SF': 'semifinal',
    '3PPO': 'third_place',
    'F': 'final',
  };

  // Sort knockout fixtures chronologically
  knockoutFixtures.sort((a, b) => {
    const da = new Date(`${a.date}T${a.time}Z`);
    const db = new Date(`${b.date}T${b.time}Z`);
    return da - db || a.id - b.id;
  });

  // For each round, map API fixtures to DB matches
  for (const [apiRound, dbRound] of Object.entries(roundMapping)) {
    const apiRoundFixtures = knockoutFixtures.filter(f => f.round === apiRound);
    const dbRoundMatches = knockoutMatches.filter(m => m.round === dbRound)
      .sort((a, b) => a.match_number - b.match_number);
    
    if (apiRoundFixtures.length !== dbRoundMatches.length) {
      console.warn(`  ⚠️ ${dbRound}: API has ${apiRoundFixtures.length}, DB has ${dbRoundMatches.length}`);
    }
    
    for (let i = 0; i < Math.min(apiRoundFixtures.length, dbRoundMatches.length); i++) {
      const apiFix = apiRoundFixtures[i];
      const dbMatch = dbRoundMatches[i];
      
      const updateData = {
        worldcupapi_fixture_id: apiFix.id,
        kickoff_time: `${apiFix.date}T${apiFix.time}Z`,
        venue: apiFix.location || null,
      };

      // For knockout, teams might be placeholders (e.g., "Winner Group A")
      // Only set team IDs if the API has real team IDs (not placeholder group IDs)
      const homeTeam = teamByApiId[apiFix.home?.id];
      const awayTeam = teamByApiId[apiFix.away?.id];
      if (homeTeam) updateData.home_team_id = homeTeam.id;
      if (awayTeam) updateData.away_team_id = awayTeam.id;
      
      const { error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', dbMatch.id);
      
      if (error) {
        console.error(`  ❌ Match #${dbMatch.match_number} (${dbRound}): ${error.message}`);
      } else {
        mapped++;
      }
    }
    console.log(`  ${dbRound}: Mapped ${Math.min(apiRoundFixtures.length, dbRoundMatches.length)} matches`);
  }

  console.log(`\n=== DONE: Total ${mapped} matches mapped ===`);
  
  // Verify
  const { data: verify } = await supabase
    .from('matches')
    .select('match_number, worldcupapi_fixture_id, home_team_id, away_team_id')
    .is('worldcupapi_fixture_id', null);
  
  if (verify && verify.length > 0) {
    console.log(`\n⚠️ ${verify.length} matches still unmapped:`);
    verify.forEach(m => console.log(`  Match #${m.match_number}`));
  } else {
    console.log('\n✅ All matches have worldcupapi_fixture_id!');
  }
  
  // Show first 10 matches to verify
  const { data: sample } = await supabase
    .from('matches')
    .select('match_number, round, kickoff_time, venue, worldcupapi_fixture_id')
    .order('match_number')
    .limit(10);
  
  console.log('\nFirst 10 matches after fix:');
  sample.forEach(m => {
    console.log(`  #${m.match_number} (${m.round}) - ${m.kickoff_time} @ ${m.venue} [API:${m.worldcupapi_fixture_id}]`);
  });
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
