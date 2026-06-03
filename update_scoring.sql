-- Update scoring rules based on new requirements (including Exact Score points)
UPDATE public.scoring_rules
SET correct_winner_points = 1, correct_score_points = 10
WHERE round = 'group_stage';

UPDATE public.scoring_rules
SET correct_winner_points = 3, correct_score_points = 10
WHERE round = 'round_of_32';

UPDATE public.scoring_rules
SET correct_winner_points = 5, correct_score_points = 10
WHERE round = 'round_of_16';

UPDATE public.scoring_rules
SET correct_winner_points = 7, correct_score_points = 10
WHERE round = 'quarterfinal';

UPDATE public.scoring_rules
SET correct_winner_points = 9, correct_score_points = 10
WHERE round = 'semifinal';

UPDATE public.scoring_rules
SET correct_winner_points = 10, correct_score_points = 10
WHERE round = 'third_place';

UPDATE public.scoring_rules
SET correct_winner_points = 11, correct_score_points = 10
WHERE round = 'final';
