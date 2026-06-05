-- PRODEMUNDIAL 2026: Supabase / PostgreSQL schema

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Invitado'),
    'member',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER create_profile_on_auth_user
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();

-- Funciones de ayuda
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT auth.role() = 'admin'
    OR EXISTS(
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    );
$$;

-- Perfiles vinculados a auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  avatar_url text,
  role text NOT NULL DEFAULT 'member',
  token_balance integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, role)
);

-- Invitaciones
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  invite_code text UNIQUE NOT NULL,
  issued_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  used_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_invite_code(invite_code text)
RETURNS TABLE(email text) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  invitation_id uuid;
BEGIN
  SELECT id, email
  INTO invitation_id, email
  FROM public.invitations
  WHERE public.invitations.invite_code = invite_code
    AND status = 'pending'
    AND expires_at > now()
  LIMIT 1;

  IF invitation_id IS NULL THEN
    RAISE EXCEPTION 'Código de invitación inválido o expirado.';
  END IF;

  UPDATE public.invitations
  SET status = 'claimed',
      used_at = now()
  WHERE id = invitation_id;

  RETURN QUERY SELECT email FROM public.invitations WHERE id = invitation_id;
END;
$$;

-- Equipos
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text,
  provider_team_id text,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  flag_url text,
  group_label text,
  fifa_ranking integer,
  coach text,
  confederation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
  , UNIQUE(provider, provider_team_id)
);

-- Jugadores
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  provider text,
  provider_player_id text,
  name text NOT NULL,
  position text,
  date_of_birth date,
  nationality text,
  market_value integer,
  photo_url text,
  club text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_player_id)
);

-- Partidos
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text,
  provider_match_id text,
  home_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  away_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  kick_off timestamptz NOT NULL,
  stadium text,
  city text,
  referee text,
  phase text,
  round text,
  group_label text,
  status text NOT NULL DEFAULT 'scheduled',
  score_home integer,
  score_away integer,
  mvp_player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  official_lineup jsonb,
  live_event jsonb,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_match_id)
);

-- Predicciones por partido
CREATE TABLE IF NOT EXISTS predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  predicted_winner text,
  predicted_score_home integer,
  predicted_score_away integer,
  predicted_first_scorer uuid REFERENCES players(id) ON DELETE SET NULL,
  predicted_mvp uuid REFERENCES players(id) ON DELETE SET NULL,
  predicted_yellow_cards integer,
  predicted_red_cards integer,
  token_cost integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  locked_at timestamptz,
  scored_at timestamptz,
  points integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_id)
);

-- Predicciones especiales
CREATE TABLE IF NOT EXISTS special_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prediction_type text NOT NULL,
  predicted_value text NOT NULL,
  token_cost integer NOT NULL DEFAULT 3,
  is_locked boolean NOT NULL DEFAULT false,
  points integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, prediction_type)
);

-- Pagos
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_ar integer NOT NULL,
  token_amount integer NOT NULL,
  method text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reference text,
  metadata jsonb,
  receipt_url text,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Transacciones de tokens
CREATE TABLE IF NOT EXISTS token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  change_amount integer NOT NULL,
  balance_before integer NOT NULL,
  balance_after integer NOT NULL,
  source text NOT NULL,
  source_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Leaderboard
CREATE TABLE IF NOT EXISTS leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period text NOT NULL,
  rank integer NOT NULL,
  points integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, period)
);

-- Notificaciones
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb,
  read boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Eventos del partido
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  provider text,
  provider_event_id text,
  event_type text NOT NULL,
  event_data jsonb,
  event_time text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_event_id)
);

-- Auditoría
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource text,
  resource_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Inteligencia diaria de jugadores
CREATE TABLE IF NOT EXISTS player_market_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  market_value_eur integer NOT NULL,
  provider text NOT NULL,
  provider_player_id text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id, provider, captured_at)
);

CREATE TABLE IF NOT EXISTS player_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'available',
  reason text,
  expected_return text,
  source text NOT NULL,
  confidence integer NOT NULL DEFAULT 70,
  is_active boolean NOT NULL DEFAULT true,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  rating numeric(4,2),
  minutes_played integer,
  goals integer NOT NULL DEFAULT 0,
  assists integer NOT NULL DEFAULT 0,
  yellow_cards integer NOT NULL DEFAULT 0,
  red_cards integer NOT NULL DEFAULT 0,
  xg numeric(5,2),
  xa numeric(5,2),
  source text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id, match_id, source)
);

CREATE TABLE IF NOT EXISTS lineups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  lineup_status text NOT NULL DEFAULT 'probable',
  position text,
  formation_slot text,
  starting_probability integer,
  source text NOT NULL,
  provider_lineup_id text,
  confirmed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, team_id, player_id, source)
);

CREATE TABLE IF NOT EXISTS data_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  sync_type text NOT NULL,
  status text NOT NULL,
  records_upserted integer NOT NULL DEFAULT 0,
  records_skipped integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS provider_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_resource_type text NOT NULL,
  provider_resource_id text NOT NULL,
  local_table text NOT NULL,
  local_id uuid NOT NULL,
  metadata jsonb,
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_resource_type, provider_resource_id, local_table, local_id)
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_self_select ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_admin_select ON profiles FOR SELECT USING (public.is_admin());
CREATE POLICY profiles_self_update ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY profiles_admin_update ON profiles FOR UPDATE USING (public.is_admin());

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_admin ON user_roles FOR ALL USING (public.is_admin());

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY invitations_admin_select ON invitations FOR SELECT USING (public.is_admin());
CREATE POLICY invitations_admin_insert ON invitations FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY invitations_admin_update ON invitations FOR UPDATE USING (public.is_admin());

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY teams_select ON teams FOR SELECT USING (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);
CREATE POLICY teams_admin ON teams FOR INSERT, UPDATE, DELETE USING (public.is_admin());

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY players_select ON players FOR SELECT USING (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);
CREATE POLICY players_admin ON players FOR INSERT, UPDATE, DELETE USING (public.is_admin());

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY matches_select ON matches FOR SELECT USING (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);
CREATE POLICY matches_admin ON matches FOR INSERT, UPDATE, DELETE USING (public.is_admin());

ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY predictions_owner_select ON predictions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY predictions_insert ON predictions FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY predictions_owner_update ON predictions FOR UPDATE USING ((auth.uid() = user_id AND status = 'pending') OR public.is_admin());
CREATE POLICY predictions_admin_delete ON predictions FOR DELETE USING (public.is_admin());

ALTER TABLE special_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY special_predictions_owner_select ON special_predictions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY special_predictions_insert ON special_predictions FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY special_predictions_owner_update ON special_predictions FOR UPDATE USING ((auth.uid() = user_id AND is_locked = false) OR public.is_admin());

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_owner_select ON payments FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY payments_insert ON payments FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY payments_admin_update ON payments FOR UPDATE USING (public.is_admin());

ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY token_transactions_owner_select ON token_transactions FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY token_transactions_admin ON token_transactions FOR INSERT, UPDATE, DELETE USING (public.is_admin());

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY leaderboard_select ON leaderboard FOR SELECT USING (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);
CREATE POLICY leaderboard_admin ON leaderboard FOR INSERT, UPDATE, DELETE USING (public.is_admin());

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_owner_select ON notifications FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY notifications_admin ON notifications FOR INSERT, UPDATE, DELETE USING (public.is_admin());

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_select ON events FOR SELECT USING (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);
CREATE POLICY events_admin ON events FOR INSERT, UPDATE, DELETE USING (public.is_admin());

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_admin ON audit_logs FOR SELECT, INSERT, UPDATE, DELETE USING (public.is_admin());

ALTER TABLE player_market_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY player_market_values_select ON player_market_values FOR SELECT USING (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);
CREATE POLICY player_market_values_admin ON player_market_values FOR INSERT, UPDATE, DELETE USING (public.is_admin());

ALTER TABLE player_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY player_availability_select ON player_availability FOR SELECT USING (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);
CREATE POLICY player_availability_admin ON player_availability FOR INSERT, UPDATE, DELETE USING (public.is_admin());

ALTER TABLE player_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY player_ratings_select ON player_ratings FOR SELECT USING (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);
CREATE POLICY player_ratings_admin ON player_ratings FOR INSERT, UPDATE, DELETE USING (public.is_admin());

ALTER TABLE lineups ENABLE ROW LEVEL SECURITY;
CREATE POLICY lineups_select ON lineups FOR SELECT USING (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);
CREATE POLICY lineups_admin ON lineups FOR INSERT, UPDATE, DELETE USING (public.is_admin());

ALTER TABLE data_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY data_sync_logs_admin ON data_sync_logs FOR SELECT, INSERT, UPDATE, DELETE USING (public.is_admin());

ALTER TABLE provider_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY provider_mappings_admin ON provider_mappings FOR SELECT, INSERT, UPDATE, DELETE USING (public.is_admin());
