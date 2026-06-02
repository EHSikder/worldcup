-- Run this in Supabase SQL Editor
-- Adds predicted_home_team_id and predicted_away_team_id to predictions table

ALTER TABLE predictions 
  ADD COLUMN IF NOT EXISTS predicted_home_team_id UUID REFERENCES teams(id),
  ADD COLUMN IF NOT EXISTS predicted_away_team_id UUID REFERENCES teams(id);
