-- Fase B: Knockout automático — placeholders, bracket metadata, equipo TBD

ALTER TABLE matches ALTER COLUMN home_team_id DROP NOT NULL;
ALTER TABLE matches ALTER COLUMN away_team_id DROP NOT NULL;

ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_team_placeholder text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_team_placeholder text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bracket_key text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bracket_home_source text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bracket_away_source text;

CREATE INDEX IF NOT EXISTS idx_matches_bracket_key ON matches (bracket_key);
CREATE INDEX IF NOT EXISTS idx_matches_knockout_phase ON matches (phase) WHERE phase IS NOT NULL AND phase <> 'GROUP_STAGE';

-- Equipo placeholder canónico (FK NOT NULL legacy paths / UI TBD)
INSERT INTO teams (id, provider, provider_team_id, name, short_name, code, country_code, group_label, updated_at)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'system',
  'TBD',
  'Por definir',
  'TBD',
  'TBD_SYS',
  'TBD',
  NULL,
  now()
)
ON CONFLICT (code) DO NOTHING;
