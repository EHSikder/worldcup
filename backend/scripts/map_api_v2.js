const axios = require('axios');
const supabase = require('../src/config/database');
const env = require('../src/config/env');

const BASE_URL = 'https://api.worldcupapi.com';

async function run() {
  console.log('Fetching all fixtures to map database...');
  let allFixtures = [];
  let page = 1;
  while (true) {
    const res = await axios.get(`${BASE_URL}/fixtures`, {
      params: { key: env.API_FOOTBALL_KEY, page }
    });
    const data = res.data.data || res.data;
    const fixtures = Array.isArray(data) ? data : [];
    if (fixtures.length === 0) break;
    allFixtures = allFixtures.concat(fixtures);
    page++;
  }
  console.log(`Fetched ${allFixtures.length} total fixtures from API.`);

  // 1. Map Teams again just in case
  const { data: dbTeams } = await supabase.from('teams').select('*');
  for (const team of dbTeams) {
    const fixtureTeam = allFixtures.map(f => f.home).find(t => t?.name === team.name) || 
                        allFixtures.map(f => f.away).find(t => t?.name === team.name);
    if (fixtureTeam && fixtureTeam.id && !team.worldcupapi_id) {
      await supabase.from('teams').update({ worldcupapi_id: fixtureTeam.id, logo_url: fixtureTeam.logo }).eq('id', team.id);
    }
  }

  // Reload teams
  const { data: updatedTeams } = await supabase.from('teams').select('*');
  
  // 2. Fetch all DB matches
  const { data: dbMatches } = await supabase.from('matches').select('*').order('match_number');
  
  let matchesMapped = 0;

  // 3. Map Group Stage Matches (Match 1 to 72)
  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  
  for (const group of groups) {
    // Find teams in this group
    const groupTeamIds = updatedTeams.filter(t => t.group_letter === group).map(t => t.worldcupapi_id).filter(Boolean);
    
    // Find API fixtures for this group
    const groupApiFixtures = allFixtures.filter(f => 
      f.home && f.away && groupTeamIds.includes(f.home.id) && groupTeamIds.includes(f.away.id)
    );
    
    // Sort chronologically (date + time)
    groupApiFixtures.sort((a, b) => new Date(`${a.date}T${a.time}Z`) - new Date(`${b.date}T${b.time}Z`));
    
    // Find DB matches for this group
    const groupDbMatches = dbMatches.filter(m => 
      m.round === 'group_stage' && 
      (m.home_placeholder || '').includes(`Group ${group}`)
    ).sort((a, b) => a.match_number - b.match_number); // Match 1 comes before Match 2

    // Map them 1 to 1
    for (let i = 0; i < Math.min(groupApiFixtures.length, groupDbMatches.length); i++) {
      const apiFix = groupApiFixtures[i];
      const dbMatch = groupDbMatches[i];
      
      const homeTeam = updatedTeams.find(t => t.worldcupapi_id === apiFix.home.id);
      const awayTeam = updatedTeams.find(t => t.worldcupapi_id === apiFix.away.id);

      if (homeTeam && awayTeam) {
        await supabase.from('matches').update({
          worldcupapi_fixture_id: apiFix.id,
          home_team_id: homeTeam.id,
          away_team_id: awayTeam.id
        }).eq('id', dbMatch.id);
        matchesMapped++;
      }
    }
  }

  // 4. Map Knockout Matches (Match 73 to 104)
  // For knockouts, we'll map them strictly by chronological order if they exist.
  const knockoutApiFixtures = allFixtures.filter(f => !f.home || !f.away || f.round !== '1');
  // Wait, API 'round' for group stage might be 1, 2, 3. Knockouts might be 'Round of 32', etc.
  // Actually, let's just grab the remaining unmatched DB matches and map them to remaining API matches chronologically.
  
  const { data: updatedMatches } = await supabase.from('matches').select('*').order('match_number');
  const unmatchedDbMatches = updatedMatches.filter(m => !m.worldcupapi_fixture_id).sort((a, b) => a.match_number - b.match_number);
  
  const mappedApiIds = updatedMatches.filter(m => m.worldcupapi_fixture_id).map(m => m.worldcupapi_fixture_id);
  const unmatchedApiFixtures = allFixtures.filter(f => !mappedApiIds.includes(f.id)).sort((a, b) => new Date(`${a.date}T${a.time}Z`) - new Date(`${b.date}T${b.time}Z`));

  for (let i = 0; i < Math.min(unmatchedDbMatches.length, unmatchedApiFixtures.length); i++) {
    const apiFix = unmatchedApiFixtures[i];
    const dbMatch = unmatchedDbMatches[i];
    
    // We only map the fixture ID, teams will be updated when they are decided.
    let updateData = { worldcupapi_fixture_id: apiFix.id };
    
    // If teams are decided in API, map them too
    if (apiFix.home && apiFix.away) {
       const ht = updatedTeams.find(t => t.worldcupapi_id === apiFix.home.id);
       const at = updatedTeams.find(t => t.worldcupapi_id === apiFix.away.id);
       if (ht) updateData.home_team_id = ht.id;
       if (at) updateData.away_team_id = at.id;
    }

    await supabase.from('matches').update(updateData).eq('id', dbMatch.id);
    matchesMapped++;
  }

  console.log(`Successfully mapped ${matchesMapped} matches.`);
}

run().catch(console.error);
