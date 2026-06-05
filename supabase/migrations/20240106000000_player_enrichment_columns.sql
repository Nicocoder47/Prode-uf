-- Enriquecimiento de perfil de jugador (altura, pie, rating de temporada)

ALTER TABLE players ADD COLUMN IF NOT EXISTS height integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS weight integer;
ALTER TABLE players ADD COLUMN IF NOT EXISTS preferred_foot text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS rating numeric(4,2);
ALTER TABLE players ADD COLUMN IF NOT EXISTS enriched_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_players_enriched_at ON players (enriched_at);
