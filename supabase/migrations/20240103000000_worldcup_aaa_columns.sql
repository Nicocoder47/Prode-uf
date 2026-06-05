-- PRODEMUNDIAL 2026 AAA: columnas aditivas para fixture (fase/grupo) y datos de equipo.
-- Migracion idempotente y NO destructiva. Correr en bases existentes.

-- matches: fase, ronda cruda del proveedor y etiqueta de grupo
ALTER TABLE matches ADD COLUMN IF NOT EXISTS phase text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS round text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS group_label text;

-- teams: metadata para la pagina de equipo (estilo Transfermarkt)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS fifa_ranking integer;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS coach text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS confederation text;

-- Indices utiles para el fixture y las tablas de posiciones
CREATE INDEX IF NOT EXISTS idx_matches_phase ON matches (phase);
CREATE INDEX IF NOT EXISTS idx_matches_group_label ON matches (group_label);
CREATE INDEX IF NOT EXISTS idx_matches_kick_off ON matches (kick_off);
CREATE INDEX IF NOT EXISTS idx_teams_group_label ON teams (group_label);
