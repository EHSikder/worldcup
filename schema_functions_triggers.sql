*Functions*
  
can_edit_prediction

DECLARE
  pred_locked BOOLEAN;
  round_locked BOOLEAN;
  m_round match_round;
  m_kickoff TIMESTAMPTZ;
BEGIN
  -- Check if prediction itself is locked
  SELECT is_locked INTO pred_locked
  FROM predictions
  WHERE user_id = p_user_id AND match_number = p_match_number;
  
  IF pred_locked = true THEN RETURN false; END IF;
  
  -- Check if the round is locked by admin, or if match starts in less than 5 minutes
  SELECT m.round, m.kickoff_time INTO m_round, m_kickoff FROM matches m WHERE m.match_number = p_match_number;
  SELECT bl.is_locked INTO round_locked FROM bracket_locks bl WHERE bl.round = m_round;
  
  IF round_locked = true THEN RETURN false; END IF;
  
  -- 5 minute lockout check (extra safety on DB level)
  IF m_kickoff IS NOT NULL AND NOW() >= m_kickoff - INTERVAL '5 minutes' THEN
    RETURN false;
  END IF;
  RETURN true;
END;

can_predict

DECLARE
  pred_locked  BOOLEAN;
  m_kickoff    TIMESTAMPTZ;
  m_status     TEXT;
BEGIN
  -- Check if this specific prediction row is locked
  SELECT is_locked INTO pred_locked
  FROM predictions
  WHERE user_id = p_user_id AND match_number = p_match_number;

  IF pred_locked = true THEN RETURN false; END IF;

  -- Get match state
  SELECT kickoff_time, status::TEXT
  INTO m_kickoff, m_status
  FROM matches
  WHERE match_number = p_match_number;

  -- Only scheduled matches can be predicted
  IF m_status IS NULL OR m_status != 'scheduled' THEN RETURN false; END IF;

  -- 5-minute window lock
  IF m_kickoff IS NOT NULL AND NOW() >= m_kickoff - INTERVAL '5 minutes' THEN
    RETURN false;
  END IF;

  RETURN true;
END;

recalculate_user_points

DECLARE
  match_pts  INTEGER;
  champ_pts  INTEGER;
  total      INTEGER;
BEGIN
  SELECT COALESCE(SUM(points_earned), 0)
  INTO match_pts
  FROM predictions
  WHERE user_id = p_user_id;

  SELECT COALESCE(points_earned, 0)
  INTO champ_pts
  FROM champion_predictions
  WHERE user_id = p_user_id;

  total := match_pts + COALESCE(champ_pts, 0);

  UPDATE users SET total_points = total WHERE id = p_user_id;
  RETURN total;
END;

recalculate_user_points


DECLARE
  match_pts  INTEGER;
  champ_pts  INTEGER;
  total      INTEGER;
BEGIN
  SELECT COALESCE(SUM(points_earned), 0)
  INTO match_pts
  FROM predictions
  WHERE user_id = p_user_id;

  SELECT COALESCE(points_earned, 0)
  INTO champ_pts
  FROM champion_predictions
  WHERE user_id = p_user_id;

  total := match_pts + COALESCE(champ_pts, 0);

  UPDATE users SET total_points = total WHERE id = p_user_id;
  RETURN total;
END;

score_match_predictions


DECLARE
  m               RECORD;
  rule            RECORD;
  pred            RECORD;
  winner_correct  BOOLEAN;
  score_correct   BOOLEAN;
  pts             INTEGER;
  total_scored    INTEGER := 0;
BEGIN
  -- Get match
  SELECT * INTO m FROM matches WHERE match_number = p_match_number;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF m.status != 'finished' THEN RETURN 0; END IF;

  -- Get scoring rules for this round
  SELECT * INTO rule FROM scoring_rules WHERE round = m.round;
  IF NOT FOUND THEN
    -- Sensible defaults if admin forgot to insert rules
    rule.correct_winner_points := 3;
    rule.correct_score_points  := 7;
  END IF;

  -- Score every locked prediction for this match
  FOR pred IN
    SELECT * FROM predictions
    WHERE match_number = p_match_number AND is_locked = true
  LOOP
    pts := 0;

    -- ── Winner check ─────────────────────────────────────────
    -- IS NOT DISTINCT FROM handles all cases:
    --   draw prediction (NULL) vs draw result (NULL)  → TRUE  ✓
    --   home team ID   vs same home team ID           → TRUE  ✓
    --   home team ID   vs away team ID                → FALSE ✓
    --   NULL           vs a team ID                   → FALSE ✓
    winner_correct :=
      pred.predicted_winner_team_id IS NOT DISTINCT FROM m.winner_team_id;

    -- ── Exact score check ─────────────────────────────────────
    score_correct := (
      m.home_score IS NOT NULL AND
      m.away_score IS NOT NULL AND
      pred.predicted_home_score = m.home_score AND
      pred.predicted_away_score = m.away_score
    );

    IF winner_correct THEN pts := pts + rule.correct_winner_points; END IF;
    IF score_correct  THEN pts := pts + rule.correct_score_points;  END IF;

    -- Update prediction row
    UPDATE predictions
    SET points_earned = pts,
        updated_at    = NOW()
    WHERE id = pred.id;

    -- Recalculate user total
    PERFORM recalculate_user_points(pred.user_id);

    total_scored := total_scored + 1;
  END LOOP;

  RETURN total_scored;
END;

trigger_auto_score_on_finish


BEGIN
  -- Only fire when status transitions INTO 'finished'
  IF NEW.status = 'finished'
     AND (OLD.status IS DISTINCT FROM 'finished')
  THEN
    PERFORM score_match_predictions(NEW.match_number);
  END IF;
  RETURN NEW;
END;

trigger_lock_predictions_on_live


BEGIN
  IF NEW.status != 'scheduled'
     AND OLD.status = 'scheduled'
  THEN
    UPDATE predictions
    SET is_locked     = true,
        locked_reason = 'match_started',
        updated_at    = NOW()
    WHERE match_number = NEW.match_number
      AND is_locked = false;
  END IF;
  RETURN NEW;
END;

update_updated_at_column


BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;

*Triggers*-

Name	Table	Function	Events	Orientation	Enabled	

auto_score_on_match_finish
matches
trigger_auto_score_on_finish
AFTER UPDATE
ROW



lock_predictions_on_live
matches
trigger_lock_predictions_on_live
AFTER UPDATE
ROW



update_admin_users_updated_at
admin_users
update_updated_at_column
BEFORE UPDATE
ROW



update_bracket_locks_updated_at
bracket_locks
update_updated_at_column
BEFORE UPDATE
ROW



update_champion_predictions_updated_at
champion_predictions
update_updated_at_column
BEFORE UPDATE
ROW



update_matches_updated_at
matches
update_updated_at_column
BEFORE UPDATE
ROW



update_predictions_updated_at
predictions
update_updated_at_column
BEFORE UPDATE
ROW



update_teams_updated_at
teams
update_updated_at_column
BEFORE UPDATE
ROW



update_users_updated_at
users
update_updated_at_column
BEFORE UPDATE
ROW






