-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  short_code character NOT NULL,
  group_letter character NOT NULL CHECK (group_letter = ANY (ARRAY['A'::bpchar, 'B'::bpchar, 'C'::bpchar, 'D'::bpchar, 'E'::bpchar, 'F'::bpchar, 'G'::bpchar, 'H'::bpchar, 'I'::bpchar, 'J'::bpchar, 'K'::bpchar, 'L'::bpchar])),
  logo_url text,
  flag_url text,
  flag_code character,
  worldcupapi_id integer,
  group_position integer DEFAULT 0,
  is_eliminated boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teams_pkey PRIMARY KEY (id)
);
CREATE TABLE public.matches (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  match_number integer NOT NULL UNIQUE,
  round USER-DEFINED NOT NULL,
  home_team_id uuid,
  away_team_id uuid,
  home_placeholder text,
  away_placeholder text,
  home_score integer,
  away_score integer,
  home_extra_time_score integer,
  away_extra_time_score integer,
  home_penalty_score integer,
  away_penalty_score integer,
  winner_team_id uuid,
  status USER-DEFINED DEFAULT 'scheduled'::match_status,
  kickoff_time timestamp with time zone,
  venue text,
  city text,
  worldcupapi_fixture_id integer,
  feeds_into_match integer,
  feeds_into_slot text CHECK (feeds_into_slot = ANY (ARRAY['home'::text, 'away'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT matches_pkey PRIMARY KEY (id),
  CONSTRAINT matches_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES public.teams(id),
  CONSTRAINT matches_away_team_id_fkey FOREIGN KEY (away_team_id) REFERENCES public.teams(id),
  CONSTRAINT matches_winner_team_id_fkey FOREIGN KEY (winner_team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  full_name text NOT NULL,
  mobile_number text NOT NULL UNIQUE,
  email text NOT NULL,
  firebase_uid text,
  civil_id text CHECK (civil_id IS NULL OR civil_id ~ '^\d{12}$'::text),
  favorite_team_id uuid,
  otp_code text,
  otp_expires_at timestamp with time zone,
  is_verified boolean DEFAULT true,
  has_submitted_prediction boolean DEFAULT false,
  total_points integer DEFAULT 0,
  jwt_token_version integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  display_name text,
  company_name text NOT NULL,
  hear_about_us text,
  is_banned boolean NOT NULL DEFAULT false,
  password_hash text,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_favorite_team_id_fkey FOREIGN KEY (favorite_team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.predictions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  match_number integer NOT NULL,
  predicted_winner_team_id uuid,
  predicted_home_score integer,
  predicted_away_score integer,
  is_locked boolean DEFAULT false,
  locked_reason USER-DEFINED,
  points_earned integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT predictions_pkey PRIMARY KEY (id),
  CONSTRAINT predictions_match_number_fkey FOREIGN KEY (match_number) REFERENCES public.matches(match_number),
  CONSTRAINT predictions_predicted_winner_team_id_fkey FOREIGN KEY (predicted_winner_team_id) REFERENCES public.teams(id),
  CONSTRAINT predictions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.bracket_locks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  round USER-DEFINED NOT NULL UNIQUE,
  is_locked boolean DEFAULT false,
  locked_by uuid,
  locked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT bracket_locks_pkey PRIMARY KEY (id)
);
CREATE TABLE public.admin_users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.scoring_rules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  round USER-DEFINED NOT NULL UNIQUE,
  correct_winner_points integer NOT NULL DEFAULT 0,
  correct_score_points integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT scoring_rules_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sync_log (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  matches_updated integer DEFAULT 0,
  predictions_locked integer DEFAULT 0,
  points_recalculated integer DEFAULT 0,
  errors text,
  status text DEFAULT 'running'::text CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text])),
  CONSTRAINT sync_log_pkey PRIMARY KEY (id)
);
CREATE TABLE public.champion_predictions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE,
  predicted_champion_team_id uuid NOT NULL,
  points_earned integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT champion_predictions_pkey PRIMARY KEY (id),
  CONSTRAINT champion_predictions_predicted_champion_team_id_fkey FOREIGN KEY (predicted_champion_team_id) REFERENCES public.teams(id),
  CONSTRAINT champion_predictions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text,
  auth_key text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.notification_log (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  day_key text NOT NULL,
  trigger_type text NOT NULL,
  sent_at timestamp with time zone DEFAULT now(),
  meta jsonb,
  CONSTRAINT notification_log_pkey PRIMARY KEY (id)
);
