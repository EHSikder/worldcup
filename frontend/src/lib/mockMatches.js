export const generateMockMatches = () => {
  const matches = [];
  let matchNumber = 1;

  const createMatch = (stage, home, away, dateOffset = 0) => {
    const kickoff = new Date();
    kickoff.setDate(kickoff.getDate() + dateOffset);
    return {
      id: `match-${matchNumber}`,
      match_number: matchNumber++,
      stage,
      home_team: home,
      away_team: away,
      kickoff_time: kickoff.toISOString(),
      status: 'scheduled'
    };
  };

  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  
  // Group Stage (72 matches)
  groups.forEach((group, idx) => {
    // Just mock team names for UI testing
    const t1 = { id: `g${group}1`, name: `Team 1 Grp ${group}`, flag_url: 'https://flagcdn.com/w40/un.png' };
    const t2 = { id: `g${group}2`, name: `Team 2 Grp ${group}`, flag_url: 'https://flagcdn.com/w40/un.png' };
    const t3 = { id: `g${group}3`, name: `Team 3 Grp ${group}`, flag_url: 'https://flagcdn.com/w40/un.png' };
    const t4 = { id: `g${group}4`, name: `Team 4 Grp ${group}`, flag_url: 'https://flagcdn.com/w40/un.png' };

    matches.push(createMatch('Group Stage', t1, t2, idx));
    matches.push(createMatch('Group Stage', t3, t4, idx));
    matches.push(createMatch('Group Stage', t1, t3, idx + 4));
    matches.push(createMatch('Group Stage', t4, t2, idx + 4));
    matches.push(createMatch('Group Stage', t4, t1, idx + 8));
    matches.push(createMatch('Group Stage', t2, t3, idx + 8));
  });

  // Round of 32 (16 matches)
  for(let i=0; i<16; i++) {
    matches.push(createMatch('Round of 32', 
      { id: 'tbd', name: 'TBD', flag_url: 'https://flagcdn.com/w40/un.png' },
      { id: 'tbd', name: 'TBD', flag_url: 'https://flagcdn.com/w40/un.png' },
      14 + (i%4)
    ));
  }

  // Round of 16 (8 matches)
  for(let i=0; i<8; i++) {
    matches.push(createMatch('Round of 16', 
      { id: 'tbd', name: 'TBD', flag_url: 'https://flagcdn.com/w40/un.png' },
      { id: 'tbd', name: 'TBD', flag_url: 'https://flagcdn.com/w40/un.png' },
      20 + (i%2)
    ));
  }

  // Quarter-Finals (4 matches)
  for(let i=0; i<4; i++) {
    matches.push(createMatch('Quarter-Finals', 
      { id: 'tbd', name: 'TBD', flag_url: 'https://flagcdn.com/w40/un.png' },
      { id: 'tbd', name: 'TBD', flag_url: 'https://flagcdn.com/w40/un.png' },
      25 + (i%2)
    ));
  }

  // Semi-Finals (2 matches)
  for(let i=0; i<2; i++) {
    matches.push(createMatch('Semi-Finals', 
      { id: 'tbd', name: 'TBD', flag_url: 'https://flagcdn.com/w40/un.png' },
      { id: 'tbd', name: 'TBD', flag_url: 'https://flagcdn.com/w40/un.png' },
      29 + i
    ));
  }

  // 3rd Place Match
  matches.push(createMatch('Third Place', 
    { id: 'tbd', name: 'TBD', flag_url: 'https://flagcdn.com/w40/un.png' },
    { id: 'tbd', name: 'TBD', flag_url: 'https://flagcdn.com/w40/un.png' },
      33
  ));

  // Final
  matches.push(createMatch('Final', 
    { id: 'tbd', name: 'TBD', flag_url: 'https://flagcdn.com/w40/un.png' },
    { id: 'tbd', name: 'TBD', flag_url: 'https://flagcdn.com/w40/un.png' },
      34
  ));

  return matches;
};
