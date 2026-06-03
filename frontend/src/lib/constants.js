// Bracket structure: which match feeds into which
export const BRACKET_FLOW = {
  // R32 -> R16
  73: { feedsInto: 89, slot: 'home' },
  75: { feedsInto: 89, slot: 'away' },
  74: { feedsInto: 90, slot: 'home' },
  77: { feedsInto: 90, slot: 'away' },
  76: { feedsInto: 91, slot: 'home' },
  78: { feedsInto: 91, slot: 'away' },
  79: { feedsInto: 92, slot: 'home' },
  80: { feedsInto: 92, slot: 'away' },
  83: { feedsInto: 93, slot: 'home' },
  84: { feedsInto: 93, slot: 'away' },
  81: { feedsInto: 94, slot: 'home' },
  82: { feedsInto: 94, slot: 'away' },
  86: { feedsInto: 95, slot: 'home' },
  88: { feedsInto: 95, slot: 'away' },
  85: { feedsInto: 96, slot: 'home' },
  87: { feedsInto: 96, slot: 'away' },
  // R16 -> QF
  89: { feedsInto: 97, slot: 'home' },
  90: { feedsInto: 97, slot: 'away' },
  91: { feedsInto: 99, slot: 'home' },
  92: { feedsInto: 99, slot: 'away' },
  93: { feedsInto: 98, slot: 'home' },
  94: { feedsInto: 98, slot: 'away' },
  95: { feedsInto: 100, slot: 'home' },
  96: { feedsInto: 100, slot: 'away' },
  // QF -> SF
  97: { feedsInto: 101, slot: 'home' },
  98: { feedsInto: 101, slot: 'away' },
  99: { feedsInto: 102, slot: 'home' },
  100: { feedsInto: 102, slot: 'away' },
  // SF -> Final
  101: { feedsInto: 104, slot: 'home' },
  102: { feedsInto: 104, slot: 'away' },
  // Final
  104: { feedsInto: null, slot: null },
};

export const ROUND_NAMES = {
  round_of_32: 'Round of 32',
  round_of_16: 'Round of 16',
  quarterfinal: 'Quarterfinals',
  semifinal: 'Semifinals',
  third_place: 'Third Place',
  final: 'Final',
};

export const ROUND_ORDER = [
  'round_of_32',
  'round_of_16',
  'quarterfinal',
  'semifinal',
  'final',
];

// Match numbers per round
export const ROUND_MATCHES = {
  round_of_32: [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88],
  round_of_16: [89, 90, 91, 92, 93, 94, 95, 96],
  quarterfinal: [97, 98, 99, 100],
  semifinal: [101, 102],
  final: [104],
};

// Left bracket path (upper half)
export const LEFT_BRACKET = {
  round_of_32: [73, 75, 74, 77, 83, 84, 81, 82],
  round_of_16: [89, 90, 93, 94],
  quarterfinal: [97, 98],
  semifinal: [101],
};

// Right bracket path (lower half)
export const RIGHT_BRACKET = {
  round_of_32: [76, 78, 79, 80, 86, 88, 85, 87],
  round_of_16: [91, 92, 95, 96],
  quarterfinal: [99, 100],
  semifinal: [102],
};

// R32 match descriptions and eligible groups
export const R32_MATCH_INFO = {
  73: { home: { type: '2nd', group: 'A' }, away: { type: '2nd', group: 'B' }, label: '2A vs 2B' },
  74: { home: { type: '1st', group: 'E' }, away: { type: '3rd', groups: ['A','B','C','D','F'] }, label: '1E vs 3rd' },
  75: { home: { type: '1st', group: 'F' }, away: { type: '2nd', group: 'C' }, label: '1F vs 2C' },
  76: { home: { type: '1st', group: 'C' }, away: { type: '2nd', group: 'F' }, label: '1C vs 2F' },
  77: { home: { type: '1st', group: 'I' }, away: { type: '3rd', groups: ['C','D','F','G','H'] }, label: '1I vs 3rd' },
  78: { home: { type: '2nd', group: 'E' }, away: { type: '2nd', group: 'I' }, label: '2E vs 2I' },
  79: { home: { type: '1st', group: 'A' }, away: { type: '3rd', groups: ['C','E','F','H','I'] }, label: '1A vs 3rd' },
  80: { home: { type: '1st', group: 'L' }, away: { type: '3rd', groups: ['E','H','I','J','K'] }, label: '1L vs 3rd' },
  81: { home: { type: '1st', group: 'G' }, away: { type: '3rd', groups: ['A','E','H','I','J'] }, label: '1G vs 3rd' },
  82: { home: { type: '1st', group: 'D' }, away: { type: '3rd', groups: ['B','E','F','I','J'] }, label: '1D vs 3rd' },
  83: { home: { type: '1st', group: 'H' }, away: { type: '2nd', group: 'J' }, label: '1H vs 2J' },
  84: { home: { type: '2nd', group: 'K' }, away: { type: '2nd', group: 'L' }, label: '2K vs 2L' },
  85: { home: { type: '1st', group: 'B' }, away: { type: '3rd', groups: ['E','F','G','I','J'] }, label: '1B vs 3rd' },
  86: { home: { type: '2nd', group: 'D' }, away: { type: '2nd', group: 'G' }, label: '2D vs 2G' },
  87: { home: { type: '1st', group: 'J' }, away: { type: '2nd', group: 'H' }, label: '1J vs 2H' },
  88: { home: { type: '1st', group: 'K' }, away: { type: '3rd', groups: ['D','E','I','J','L'] }, label: '1K vs 3rd' },
};

export const SCORING_TABLE = [
  { round: 'Group Stage', points: 1 },
  { round: 'Round of 32', points: 3 },
  { round: 'Round of 16', points: 5 },
  { round: 'Quarter-Finals', points: 7 },
  { round: 'Semi-Finals', points: 9 },
  { round: 'Final / Tournament Winner', points: 11 },
];

export const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
