-- Player Data Quality Sprint V2 — vinculación de identidad y trazabilidad

-- ── players: IDs externos, vínculos y verificación de identidad ──
ALTER TABLE players ADD COLUMN IF NOT EXISTS fifa_id text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS external_profile_url text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS linked_country_id uuid REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE players ADD COLUMN IF NOT EXISTS linked_team_id uuid REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE players ADD COLUMN IF NOT EXISTS identity_confidence_score integer NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unlinked';
ALTER TABLE players ADD COLUMN IF NOT EXISTS verified_fields jsonb NOT NULL DEFAULT '[]';
ALTER TABLE players ADD COLUMN IF NOT EXISTS conflicted_fields jsonb NOT NULL DEFAULT '[]';
ALTER TABLE players ADD COLUMN IF NOT EXISTS source_priority jsonb NOT NULL DEFAULT '{}';
ALTER TABLE players ADD COLUMN IF NOT EXISTS identity_key text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS identity_candidate jsonb;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_identity_check_at timestamptz;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

-- columnas V1 que pueden faltar si no se aplicó 20240107
ALTER TABLE players ADD COLUMN IF NOT EXISTS api_football_id text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS sportmonks_id text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS transfermarkt_id text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS wikidata_id text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS thesportsdb_id text;

-- ── teams (selecciones nacionales = países) ──
ALTER TABLE teams ADD COLUMN IF NOT EXISTS official_name text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS fifa_code text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS iso2 text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS iso3 text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS api_football_team_id text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS sportmonks_team_id text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS wikidata_id text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS thesportsdb_team_id text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS external_profile_url text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS data_sources jsonb NOT NULL DEFAULT '{}';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unlinked';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

-- ── historial de valores de mercado (conserva conflictos) ──
CREATE TABLE IF NOT EXISTS player_market_value_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  market_value_eur numeric NOT NULL,
  source text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id, source, market_value_eur)
);

-- ── índices ──
CREATE INDEX IF NOT EXISTS idx_players_name ON players (name);
CREATE INDEX IF NOT EXISTS idx_players_nationality ON players (nationality);
CREATE INDEX IF NOT EXISTS idx_players_api_football_id ON players (api_football_id);
CREATE INDEX IF NOT EXISTS idx_players_wikidata_id ON players (wikidata_id);
CREATE INDEX IF NOT EXISTS idx_players_transfermarkt_id ON players (transfermarkt_id);
CREATE INDEX IF NOT EXISTS idx_players_identity_key ON players (identity_key);
CREATE INDEX IF NOT EXISTS idx_players_verification_status ON players (verification_status);
CREATE INDEX IF NOT EXISTS idx_players_linked_country_id ON players (linked_country_id);

CREATE INDEX IF NOT EXISTS idx_teams_fifa_code ON teams (fifa_code);
CREATE INDEX IF NOT EXISTS idx_teams_iso3 ON teams (iso3);
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams (name);
CREATE INDEX IF NOT EXISTS idx_teams_verification_status ON teams (verification_status);
