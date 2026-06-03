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
    const data = res.data.data || res.data; // Handle both wrapped and unwrapped array
    const fixtures = Array.isArray(data) ? data : [];
    if (fixtures.length === 0) break;
    allFixtures = allFixtures.concat(fixtures);
    page++;
  }
  
  console.log(`Fetched ${allFixtures.length} total fixtures.`);

  // 1. Map Teams
  const { data: dbTeams } = await supabase.from('teams').select('*');
  let teamsMapped = 0;
  for (const team of dbTeams) {
    // Find team in fixtures
    const fixtureTeam = allFixtures.map(f => f.home).find(t => t.name === team.name) || 
                        allFixtures.map(f => f.away).find(t => t.name === team.name);
    
    if (fixtureTeam && fixtureTeam.id) {
      await supabase.from('teams').update({
        worldcupapi_id: fixtureTeam.id,
        logo_url: fixtureTeam.logo
      }).eq('id', team.id);
      teamsMapped++;
    }
  }
  console.log(`Mapped ${teamsMapped} teams.`);

  // 2. Map Matches
  // Reload teams to get the api IDs
  const { data: updatedTeams } = await supabase.from('teams').select('*');
  
  const { data: dbMatches } = await supabase.from('matches').select('*').order('match_number');
  
  let matchesMapped = 0;
  for (const fixture of allFixtures) {
    const homeTeamApi = fixture.home;
    const awayTeamApi = fixture.away;
    if (!homeTeamApi || !awayTeamApi) continue;

    const dbHomeTeam = updatedTeams.find(t => t.worldcupapi_id === homeTeamApi.id);
    const dbAwayTeam = updatedTeams.find(t => t.worldcupapi_id === awayTeamApi.id);
    
    if (!dbHomeTeam || !dbAwayTeam) continue;

    // Convert fixture date/time to UTC string format matching our DB kickoff_time
    // Fixture: date="2026-06-11", time="19:00:00"
    const fixtureKickoff = new Date(`${fixture.date}T${fixture.time}+03:00`).toISOString();

    // Find a match with same kickoff time, AND home_placeholder containing the group letter
    const matchingMatches = dbMatches.filter(m => {
      const matchKickoff = new Date(m.kickoff_time).toISOString();
      if (matchKickoff !== fixtureKickoff) return false;
      
      // Group Stage: placeholders have "Group X"
      if (m.round === 'group_stage') {
        return m.home_placeholder.includes(`Group ${dbHomeTeam.group_letter}`) || 
               m.home_placeholder.includes(`Group ${dbAwayTeam.group_letter}`);
      }
      return true; // For knockouts, we might need more logic if dates conflict, but usually they don't overlap as much
    });

    if (matchingMatches.length === 1) {
      const matchToUpdate = matchingMatches[0];
      await supabase.from('matches').update({
        worldcupapi_fixture_id: fixture.id,
        home_team_id: dbHomeTeam.id,
        away_team_id: dbAwayTeam.id
      }).eq('id', matchToUpdate.id);
      matchesMapped++;
    }
  }
  
  console.log(`Mapped ${matchesMapped} matches.`);
}

run().catch(console.error);
