-- Player Data Quality Sprint V1 — trazabilidad, fuentes y score

ALTER TABLE players ADD COLUMN IF NOT EXISTS birth_place text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS detailed_position text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS market_value_eur numeric;
ALTER TABLE players ADD COLUMN IF NOT EXISTS api_football_id text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS sportmonks_id text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS transfermarkt_id text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS wikidata_id text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS thesportsdb_id text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS data_quality_score integer NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS data_sources jsonb NOT NULL DEFAULT '{}';
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz;
ALTER TABLE players ADD COLUMN IF NOT EXISTS enrichment_status text NOT NULL DEFAULT 'pending';
ALTER TABLE players ADD COLUMN IF NOT EXISTS enrichment_error text;

UPDATE players SET last_enriched_at = enriched_at
WHERE last_enriched_at IS NULL AND enriched_at IS NOT NULL;

UPDATE players SET market_value_eur = market_value
WHERE market_value_eur IS NULL AND market_value IS NOT NULL AND market_value > 0;

CREATE INDEX IF NOT EXISTS idx_players_team_id ON players (team_id);
CREATE INDEX IF NOT EXISTS idx_players_name ON players (name);
CREATE INDEX IF NOT EXISTS idx_players_api_football_id ON players (api_football_id);
CREATE INDEX IF NOT EXISTS idx_players_sportmonks_id ON players (sportmonks_id);
CREATE INDEX IF NOT EXISTS idx_players_transfermarkt_id ON players (transfermarkt_id);
CREATE INDEX IF NOT EXISTS idx_players_data_quality_score ON players (data_quality_score);
CREATE INDEX IF NOT EXISTS idx_players_enrichment_status ON players (enrichment_status);
