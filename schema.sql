-- ============================================================
-- FIFA WORLD CUP 2026 KNOCKOUT PREDICTOR — COMPLETE SQL SCHEMA
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE match_round AS ENUM (
  'group_stage',
  'round_of_32',
  'round_of_16',
  'quarterfinal',
  'semifinal',
  'third_place',
  'final'
);

CREATE TYPE match_status AS ENUM (
  'scheduled',
  'live',
  'halftime',
  'extra_time',
  'penalties',
  'finished',
  'postponed',
  'cancelled',
  'suspended'
);

CREATE TYPE lock_reason AS ENUM (
  'admin_lock',
  'result_confirmed'
);

-- ============================================================
-- TABLES
-- ============================================================

-- 1. TEAMS — All 48 participating nations
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  short_code CHAR(3) NOT NULL,
  group_letter CHAR(1) NOT NULL CHECK (group_letter IN ('A','B','C','D','E','F','G','H','I','J','K','L')),
  logo_url TEXT,
  flag_url TEXT,
  flag_code CHAR(6), -- ISO 3166-1 alpha-2 code for flagcdn.com (e.g. 'br', 'gb-eng')
  api_football_id INTEGER,
  group_position INTEGER DEFAULT 0, -- final group standing: 1, 2, 3, or 4
  is_eliminated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teams_group ON teams(group_letter);
CREATE INDEX idx_teams_api_football_id ON teams(api_football_id);
CREATE UNIQUE INDEX idx_teams_name ON teams(name);

-- 2. MATCHES — All 104 tournament matches (72 group + 32 knockout)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_number INTEGER NOT NULL UNIQUE,
  round match_round NOT NULL,
  home_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  away_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  home_placeholder TEXT, -- e.g., 'Winner Group A', 'Winner Match 73'
  away_placeholder TEXT,
  home_score INTEGER,
  away_score INTEGER,
  home_extra_time_score INTEGER,
  away_extra_time_score INTEGER,
  home_penalty_score INTEGER,
  away_penalty_score INTEGER,
  winner_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  status match_status DEFAULT 'scheduled',
  kickoff_time TIMESTAMPTZ,
  venue TEXT,
  city TEXT,
  api_football_fixture_id INTEGER,
  feeds_into_match INTEGER, -- which match number does the winner go to
  feeds_into_slot TEXT CHECK (feeds_into_slot IN ('home', 'away')), -- home or away slot
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matches_round ON matches(round);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_kickoff ON matches(kickoff_time);
CREATE INDEX idx_matches_api_fixture ON matches(api_football_fixture_id);

-- 3. USERS — Registered participants
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  civil_id CHAR(12) NOT NULL CHECK (civil_id ~ '^\d{12}$'),
  favorite_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  otp_code TEXT,
  otp_expires_at TIMESTAMPTZ,
  is_verified BOOLEAN DEFAULT FALSE,
  has_submitted_prediction BOOLEAN DEFAULT FALSE,
  total_points INTEGER DEFAULT 0,
  jwt_token_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_mobile ON users(mobile_number);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_total_points ON users(total_points DESC);
CREATE INDEX idx_users_civil_id ON users(civil_id);

-- 4. PREDICTIONS — User bracket predictions (one row per match per user)
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_number INTEGER NOT NULL REFERENCES matches(match_number) ON DELETE CASCADE,
  predicted_winner_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  predicted_home_score INTEGER,
  predicted_away_score INTEGER,
  is_locked BOOLEAN DEFAULT FALSE,
  locked_reason lock_reason,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_number)
);

CREATE INDEX idx_predictions_user ON predictions(user_id);
CREATE INDEX idx_predictions_match ON predictions(match_number);
CREATE INDEX idx_predictions_user_match ON predictions(user_id, match_number);

-- 5. BRACKET_LOCKS — Admin-controlled round locks
CREATE TABLE bracket_locks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round match_round NOT NULL UNIQUE,
  is_locked BOOLEAN DEFAULT FALSE,
  locked_by UUID,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ADMIN_USERS — Admin panel access
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SCORING_RULES — Configurable points per round
CREATE TABLE scoring_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round match_round NOT NULL UNIQUE,
  correct_winner_points INTEGER NOT NULL DEFAULT 0,
  correct_score_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SYNC_LOG — Track API-Football sync jobs
CREATE TABLE sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  matches_updated INTEGER DEFAULT 0,
  predictions_locked INTEGER DEFAULT 0,
  points_recalculated INTEGER DEFAULT 0,
  errors TEXT,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX idx_sync_log_started ON sync_log(started_at DESC);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_predictions_updated_at BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bracket_locks_updated_at BEFORE UPDATE ON bracket_locks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- TEAMS: Public read, admin write (via service_role)
CREATE POLICY "teams_public_read" ON teams FOR SELECT TO anon, authenticated USING (true);

-- MATCHES: Public read, admin write (via service_role)
CREATE POLICY "matches_public_read" ON matches FOR SELECT TO anon, authenticated USING (true);

-- USERS: Users can read/update only their own row
CREATE POLICY "users_read_own" ON users FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
CREATE POLICY "users_update_own" ON users FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));
-- Allow insert for registration (anon)
CREATE POLICY "users_insert_anon" ON users FOR INSERT TO anon
  WITH CHECK (true);

-- PREDICTIONS: Users can CRUD only their own predictions
CREATE POLICY "predictions_read_own" ON predictions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "predictions_insert_own" ON predictions FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "predictions_update_own" ON predictions FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND is_locked = false)
  WITH CHECK (user_id = (SELECT auth.uid()));

-- BRACKET_LOCKS: Public read, admin write (via service_role)
CREATE POLICY "bracket_locks_public_read" ON bracket_locks FOR SELECT TO anon, authenticated USING (true);

-- SCORING_RULES: Public read
CREATE POLICY "scoring_rules_public_read" ON scoring_rules FOR SELECT TO anon, authenticated USING (true);

-- SYNC_LOG: Public read (for status display)
CREATE POLICY "sync_log_public_read" ON sync_log FOR SELECT TO anon, authenticated USING (true);

-- ADMIN_USERS: No public access (all access via service_role key on backend)

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to recalculate a user's total points
CREATE OR REPLACE FUNCTION recalculate_user_points(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  total INTEGER;
BEGIN
  SELECT COALESCE(SUM(points_earned), 0) INTO total
  FROM predictions
  WHERE user_id = p_user_id;
  
  UPDATE users SET total_points = total WHERE id = p_user_id;
  RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a prediction can be edited
CREATE OR REPLACE FUNCTION can_edit_prediction(p_user_id UUID, p_match_number INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  pred_locked BOOLEAN;
  round_locked BOOLEAN;
  m_round match_round;
BEGIN
  -- Check if prediction itself is locked
  SELECT is_locked INTO pred_locked
  FROM predictions
  WHERE user_id = p_user_id AND match_number = p_match_number;
  
  IF pred_locked = true THEN RETURN false; END IF;
  
  -- Check if the round is locked by admin
  SELECT m.round INTO m_round FROM matches m WHERE m.match_number = p_match_number;
  SELECT bl.is_locked INTO round_locked FROM bracket_locks bl WHERE bl.round = m_round;
  
  IF round_locked = true THEN RETURN false; END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SEED DATA: 48 TEAMS
-- ============================================================

INSERT INTO teams (name, short_code, group_letter, flag_code, flag_url) VALUES
-- Group A
('Mexico', 'MEX', 'A', 'mx', 'https://flagcdn.com/w80/mx.png'),
('South Africa', 'RSA', 'A', 'za', 'https://flagcdn.com/w80/za.png'),
('South Korea', 'KOR', 'A', 'kr', 'https://flagcdn.com/w80/kr.png'),
('Czechia', 'CZE', 'A', 'cz', 'https://flagcdn.com/w80/cz.png'),

-- Group B
('Canada', 'CAN', 'B', 'ca', 'https://flagcdn.com/w80/ca.png'),
('Bosnia and Herzegovina', 'BIH', 'B', 'ba', 'https://flagcdn.com/w80/ba.png'),
('Qatar', 'QAT', 'B', 'qa', 'https://flagcdn.com/w80/qa.png'),
('Switzerland', 'SUI', 'B', 'ch', 'https://flagcdn.com/w80/ch.png'),

-- Group C
('Brazil', 'BRA', 'C', 'br', 'https://flagcdn.com/w80/br.png'),
('Morocco', 'MAR', 'C', 'ma', 'https://flagcdn.com/w80/ma.png'),
('Haiti', 'HAI', 'C', 'ht', 'https://flagcdn.com/w80/ht.png'),
('Scotland', 'SCO', 'C', 'gb-sct', 'https://flagcdn.com/w80/gb-sct.png'),

-- Group D
('United States', 'USA', 'D', 'us', 'https://flagcdn.com/w80/us.png'),
('Paraguay', 'PAR', 'D', 'py', 'https://flagcdn.com/w80/py.png'),
('Australia', 'AUS', 'D', 'au', 'https://flagcdn.com/w80/au.png'),
('Türkiye', 'TUR', 'D', 'tr', 'https://flagcdn.com/w80/tr.png'),

-- Group E
('Germany', 'GER', 'E', 'de', 'https://flagcdn.com/w80/de.png'),
('Curaçao', 'CUW', 'E', 'cw', 'https://flagcdn.com/w80/cw.png'),
('Ivory Coast', 'CIV', 'E', 'ci', 'https://flagcdn.com/w80/ci.png'),
('Ecuador', 'ECU', 'E', 'ec', 'https://flagcdn.com/w80/ec.png'),

-- Group F
('Netherlands', 'NED', 'F', 'nl', 'https://flagcdn.com/w80/nl.png'),
('Japan', 'JPN', 'F', 'jp', 'https://flagcdn.com/w80/jp.png'),
('Sweden', 'SWE', 'F', 'se', 'https://flagcdn.com/w80/se.png'),
('Tunisia', 'TUN', 'F', 'tn', 'https://flagcdn.com/w80/tn.png'),

-- Group G
('Belgium', 'BEL', 'G', 'be', 'https://flagcdn.com/w80/be.png'),
('Egypt', 'EGY', 'G', 'eg', 'https://flagcdn.com/w80/eg.png'),
('Iran', 'IRN', 'G', 'ir', 'https://flagcdn.com/w80/ir.png'),
('New Zealand', 'NZL', 'G', 'nz', 'https://flagcdn.com/w80/nz.png'),

-- Group H
('Spain', 'ESP', 'H', 'es', 'https://flagcdn.com/w80/es.png'),
('Cabo Verde', 'CPV', 'H', 'cv', 'https://flagcdn.com/w80/cv.png'),
('Saudi Arabia', 'KSA', 'H', 'sa', 'https://flagcdn.com/w80/sa.png'),
('Uruguay', 'URU', 'H', 'uy', 'https://flagcdn.com/w80/uy.png'),

-- Group I
('France', 'FRA', 'I', 'fr', 'https://flagcdn.com/w80/fr.png'),
('Senegal', 'SEN', 'I', 'sn', 'https://flagcdn.com/w80/sn.png'),
('Iraq', 'IRQ', 'I', 'iq', 'https://flagcdn.com/w80/iq.png'),
('Norway', 'NOR', 'I', 'no', 'https://flagcdn.com/w80/no.png'),

-- Group J
('Argentina', 'ARG', 'J', 'ar', 'https://flagcdn.com/w80/ar.png'),
('Algeria', 'ALG', 'J', 'dz', 'https://flagcdn.com/w80/dz.png'),
('Austria', 'AUT', 'J', 'at', 'https://flagcdn.com/w80/at.png'),
('Jordan', 'JOR', 'J', 'jo', 'https://flagcdn.com/w80/jo.png'),

-- Group K
('Portugal', 'POR', 'K', 'pt', 'https://flagcdn.com/w80/pt.png'),
('DR Congo', 'COD', 'K', 'cd', 'https://flagcdn.com/w80/cd.png'),
('Uzbekistan', 'UZB', 'K', 'uz', 'https://flagcdn.com/w80/uz.png'),
('Colombia', 'COL', 'K', 'co', 'https://flagcdn.com/w80/co.png'),

-- Group L
('England', 'ENG', 'L', 'gb-eng', 'https://flagcdn.com/w80/gb-eng.png'),
('Croatia', 'CRO', 'L', 'hr', 'https://flagcdn.com/w80/hr.png'),
('Ghana', 'GHA', 'L', 'gh', 'https://flagcdn.com/w80/gh.png'),
('Panama', 'PAN', 'L', 'pa', 'https://flagcdn.com/w80/pa.png');

-- ============================================================
-- SEED DATA: KNOCKOUT MATCHES (73-104)
-- ============================================================

-- Round of 32 (Matches 73-88)
INSERT INTO matches (match_number, round, home_placeholder, away_placeholder, kickoff_time, venue, city, feeds_into_match, feeds_into_slot) VALUES
(73, 'round_of_32', '2nd Group A', '2nd Group B', '2026-06-28 18:00:00+00', 'SoFi Stadium', 'Los Angeles', 89, 'home'),
(74, 'round_of_32', '1st Group E', '3rd Group A/B/C/D/F', '2026-06-29 15:00:00+00', 'Gillette Stadium', 'Boston', 90, 'home'),
(75, 'round_of_32', '1st Group F', '2nd Group C', '2026-06-29 18:00:00+00', 'Estadio BBVA', 'Monterrey', 89, 'away'),
(76, 'round_of_32', '1st Group C', '2nd Group F', '2026-06-29 21:00:00+00', 'NRG Stadium', 'Houston', 91, 'home'),
(77, 'round_of_32', '1st Group I', '3rd Group C/D/F/G/H', '2026-06-30 15:00:00+00', 'MetLife Stadium', 'New York/New Jersey', 90, 'away'),
(78, 'round_of_32', '2nd Group E', '2nd Group I', '2026-06-30 18:00:00+00', 'AT&T Stadium', 'Dallas', 91, 'away'),
(79, 'round_of_32', '1st Group A', '3rd Group C/E/F/H/I', '2026-06-30 21:00:00+00', 'Estadio Azteca', 'Mexico City', 92, 'home'),
(80, 'round_of_32', '1st Group L', '3rd Group E/H/I/J/K', '2026-07-01 15:00:00+00', 'Mercedes-Benz Stadium', 'Atlanta', 92, 'away'),
(81, 'round_of_32', '1st Group G', '3rd Group A/E/H/I/J', '2026-07-01 18:00:00+00', 'Lumen Field', 'Seattle', 94, 'home'),
(82, 'round_of_32', '1st Group D', '3rd Group B/E/F/I/J', '2026-07-01 21:00:00+00', 'Levi''s Stadium', 'San Francisco', 94, 'away'),
(83, 'round_of_32', '1st Group H', '2nd Group J', '2026-07-02 15:00:00+00', 'SoFi Stadium', 'Los Angeles', 93, 'home'),
(84, 'round_of_32', '2nd Group K', '2nd Group L', '2026-07-02 18:00:00+00', 'BMO Field', 'Toronto', 93, 'away'),
(85, 'round_of_32', '1st Group B', '3rd Group E/F/G/I/J', '2026-07-02 21:00:00+00', 'BC Place', 'Vancouver', 96, 'home'),
(86, 'round_of_32', '2nd Group D', '2nd Group G', '2026-07-03 15:00:00+00', 'Lincoln Financial Field', 'Philadelphia', 95, 'home'),
(87, 'round_of_32', '1st Group J', '2nd Group H', '2026-07-03 18:00:00+00', 'Hard Rock Stadium', 'Miami', 96, 'away'),
(88, 'round_of_32', '1st Group K', '3rd Group D/E/I/J/L', '2026-07-03 21:00:00+00', 'Arrowhead Stadium', 'Kansas City', 95, 'away');

-- Round of 16 (Matches 89-96)
INSERT INTO matches (match_number, round, home_placeholder, away_placeholder, kickoff_time, venue, city, feeds_into_match, feeds_into_slot) VALUES
(89, 'round_of_16', 'Winner Match 73', 'Winner Match 75', '2026-07-04 18:00:00+00', 'NRG Stadium', 'Houston', 97, 'home'),
(90, 'round_of_16', 'Winner Match 74', 'Winner Match 77', '2026-07-04 21:00:00+00', 'Lincoln Financial Field', 'Philadelphia', 97, 'away'),
(91, 'round_of_16', 'Winner Match 76', 'Winner Match 78', '2026-07-05 18:00:00+00', 'MetLife Stadium', 'New York/New Jersey', 99, 'home'),
(92, 'round_of_16', 'Winner Match 79', 'Winner Match 80', '2026-07-05 21:00:00+00', 'Estadio Azteca', 'Mexico City', 99, 'away'),
(93, 'round_of_16', 'Winner Match 83', 'Winner Match 84', '2026-07-06 18:00:00+00', 'AT&T Stadium', 'Dallas', 98, 'home'),
(94, 'round_of_16', 'Winner Match 81', 'Winner Match 82', '2026-07-06 21:00:00+00', 'Lumen Field', 'Seattle', 98, 'away'),
(95, 'round_of_16', 'Winner Match 86', 'Winner Match 88', '2026-07-07 18:00:00+00', 'Mercedes-Benz Stadium', 'Atlanta', 100, 'home'),
(96, 'round_of_16', 'Winner Match 85', 'Winner Match 87', '2026-07-07 21:00:00+00', 'BC Place', 'Vancouver', 100, 'away');

-- Quarterfinals (Matches 97-100)
INSERT INTO matches (match_number, round, home_placeholder, away_placeholder, kickoff_time, venue, city, feeds_into_match, feeds_into_slot) VALUES
(97, 'quarterfinal', 'Winner Match 89', 'Winner Match 90', '2026-07-09 18:00:00+00', 'Gillette Stadium', 'Boston', 101, 'home'),
(98, 'quarterfinal', 'Winner Match 93', 'Winner Match 94', '2026-07-09 21:00:00+00', 'SoFi Stadium', 'Los Angeles', 101, 'away'),
(99, 'quarterfinal', 'Winner Match 91', 'Winner Match 92', '2026-07-10 18:00:00+00', 'Hard Rock Stadium', 'Miami', 102, 'home'),
(100, 'quarterfinal', 'Winner Match 95', 'Winner Match 96', '2026-07-10 21:00:00+00', 'Arrowhead Stadium', 'Kansas City', 102, 'away');

-- Semifinals (Matches 101-102)
INSERT INTO matches (match_number, round, home_placeholder, away_placeholder, kickoff_time, venue, city, feeds_into_match, feeds_into_slot) VALUES
(101, 'semifinal', 'Winner Match 97', 'Winner Match 98', '2026-07-14 21:00:00+00', 'AT&T Stadium', 'Dallas', 104, 'home'),
(102, 'semifinal', 'Winner Match 99', 'Winner Match 100', '2026-07-15 21:00:00+00', 'Mercedes-Benz Stadium', 'Atlanta', 104, 'away');

-- Third Place Match (Match 103)
INSERT INTO matches (match_number, round, home_placeholder, away_placeholder, kickoff_time, venue, city) VALUES
(103, 'third_place', 'Loser Match 101', 'Loser Match 102', '2026-07-18 21:00:00+00', 'Hard Rock Stadium', 'Miami');

-- Final (Match 104)
INSERT INTO matches (match_number, round, home_placeholder, away_placeholder, kickoff_time, venue, city) VALUES
(104, 'final', 'Winner Match 101', 'Winner Match 102', '2026-07-19 21:00:00+00', 'MetLife Stadium', 'New York/New Jersey');

-- ============================================================
-- SEED DATA: SCORING RULES
-- ============================================================

INSERT INTO scoring_rules (round, correct_winner_points, correct_score_points) VALUES
('round_of_32', 1, 3),
('round_of_16', 2, 5),
('quarterfinal', 10, 15),
('semifinal', 20, 30),
('final', 30, 50),
('third_place', 5, 10);

-- ============================================================
-- SEED DATA: BRACKET LOCKS (all unlocked initially)
-- ============================================================

INSERT INTO bracket_locks (round, is_locked) VALUES
('round_of_32', false),
('round_of_16', false),
('quarterfinal', false),
('semifinal', false),
('third_place', false),
('final', false);

-- ============================================================
-- SEED DATA: DEFAULT ADMIN USER
-- password: 'admin2026!' — CHANGE THIS IMMEDIATELY after deployment
-- ============================================================

INSERT INTO admin_users (username, password_hash) VALUES
('admin', crypt('admin2026!', gen_salt('bf', 10)));

-- ============================================================
-- VIEWS FOR CONVENIENCE
-- ============================================================

-- Leaderboard view
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  u.id,
  u.full_name,
  u.total_points,
  u.favorite_team_id,
  t.name AS favorite_team_name,
  t.flag_url AS favorite_team_flag,
  RANK() OVER (ORDER BY u.total_points DESC) AS rank,
  (SELECT COUNT(*) FROM predictions p WHERE p.user_id = u.id AND p.points_earned > 0) AS correct_predictions
FROM users u
LEFT JOIN teams t ON u.favorite_team_id = t.id
WHERE u.is_verified = true AND u.has_submitted_prediction = true
ORDER BY u.total_points DESC;

-- Bracket view (knockout matches with team details)
CREATE OR REPLACE VIEW bracket_view AS
SELECT
  m.match_number,
  m.round,
  m.home_placeholder,
  m.away_placeholder,
  m.home_score,
  m.away_score,
  m.status,
  m.kickoff_time,
  m.venue,
  m.city,
  m.feeds_into_match,
  m.feeds_into_slot,
  m.winner_team_id,
  ht.name AS home_team_name,
  ht.short_code AS home_team_code,
  ht.flag_url AS home_team_flag,
  ht.id AS home_team_id,
  at2.name AS away_team_name,
  at2.short_code AS away_team_code,
  at2.flag_url AS away_team_flag,
  at2.id AS away_team_id,
  wt.name AS winner_team_name,
  bl.is_locked AS round_locked
FROM matches m
LEFT JOIN teams ht ON m.home_team_id = ht.id
LEFT JOIN teams at2 ON m.away_team_id = at2.id
LEFT JOIN teams wt ON m.winner_team_id = wt.id
LEFT JOIN bracket_locks bl ON m.round = bl.round
WHERE m.round != 'group_stage'
ORDER BY m.match_number;

-- ============================================================
-- CHAMPION PREDICTION TABLE
-- Separate from match predictions — who wins the whole thing
-- ============================================================

CREATE TABLE champion_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  predicted_champion_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE champion_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "champion_pred_read_own" ON champion_predictions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "champion_pred_insert_own" ON champion_predictions FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "champion_pred_update_own" ON champion_predictions FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE TRIGGER update_champion_predictions_updated_at BEFORE UPDATE ON champion_predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- DONE — Schema is ready to use
-- ============================================================
