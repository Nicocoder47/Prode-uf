-- Columnas aditivas para football-data.org (mapeo sin romper esquema existente)

ALTER TABLE teams ADD COLUMN IF NOT EXISTS short_name text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS crest_url text;

ALTER TABLE players ADD COLUMN IF NOT EXISTS shirt_number integer;

ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_home_penalties integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_away_penalties integer;

ALTER TABLE standings ADD COLUMN IF NOT EXISTS competition_code text;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS season integer;
