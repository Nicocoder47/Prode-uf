-- Modo automático: lore del 2° puesto del leaderboard en vivo.

INSERT INTO public.admin_cards (key, title, value, subtitle, description, icon, status, order_index, is_active)
VALUES (
  'ranking_lore_auto',
  'Lore ranking automático',
  '1',
  '2° puesto en vivo',
  'Si está activo, protagonista, distancia y párrafo salen del leaderboard (se renueva cada ~30 s).',
  NULL,
  'success',
  109,
  true
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  subtitle = EXCLUDED.subtitle;
