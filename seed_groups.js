const fs = require('fs');
let sql = '-- Seed 72 Group Stage Matches\nINSERT INTO matches (match_number, round, home_placeholder, away_placeholder, kickoff_time, status) VALUES\n';
const groups = ['A','B','C','D','E','F','G','H','I','J','K','L'];
let matchNum = 1;
const values = [];

// Base date: June 11, 2026. We will just spread matches across a few days for placeholder purposes.
let dayOffset = 0;

for (const g of groups) {
  // Using +03 to represent Kuwait time explicitly
  values.push(`(${matchNum++}, 'group_stage', '1st Group ${g}', '2nd Group ${g}', '2026-06-${11 + dayOffset} 16:00:00+03', 'scheduled')`);
  values.push(`(${matchNum++}, 'group_stage', '3rd Group ${g}', '4th Group ${g}', '2026-06-${11 + dayOffset} 19:00:00+03', 'scheduled')`);
  values.push(`(${matchNum++}, 'group_stage', '1st Group ${g}', '3rd Group ${g}', '2026-06-${15 + dayOffset} 16:00:00+03', 'scheduled')`);
  values.push(`(${matchNum++}, 'group_stage', '4th Group ${g}', '2nd Group ${g}', '2026-06-${15 + dayOffset} 19:00:00+03', 'scheduled')`);
  values.push(`(${matchNum++}, 'group_stage', '4th Group ${g}', '1st Group ${g}', '2026-06-${19 + dayOffset} 16:00:00+03', 'scheduled')`);
  values.push(`(${matchNum++}, 'group_stage', '2nd Group ${g}', '3rd Group ${g}', '2026-06-${19 + dayOffset} 19:00:00+03', 'scheduled')`);
  
  if (g === 'D' || g === 'H') {
    dayOffset++; // Increment day every 4 groups just to spread them out
  }
}
sql += values.join(',\n') + '\nON CONFLICT (match_number) DO NOTHING;';
fs.writeFileSync('seed_groups.sql', sql);
