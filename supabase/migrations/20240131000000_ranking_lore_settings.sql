-- Lore narrativo para la card "Movimiento del ranking" (Mundial en Vivo).
-- Editable desde /admin/ranking-lore

INSERT INTO public.admin_cards (key, title, value, subtitle, description, icon, status, order_index, is_active)
VALUES
  (
    'ranking_lore_auto',
    'Lore ranking automático',
    '1',
    '2° puesto en vivo',
    'Si está activo, protagonista, distancia y párrafo salen del leaderboard (se renueva cada ~30 s).',
    NULL,
    'success',
    109,
    true
  ),
  (
    'ranking_lore_enabled',
    'Lore ranking activo',
    '1',
    'Mundial en Vivo',
    'Si está activo, la card de ranking muestra el relato editorial en lugar del podio automático.',
    NULL,
    'success',
    110,
    true
  ),
  (
    'ranking_lore_emoji',
    'Lore emoji',
    '🎯',
    'Icono del titular',
    NULL,
    '🎯',
    'neutral',
    111,
    true
  ),
  (
    'ranking_lore_headline',
    'Lore titular',
    'TIENE AL LÍDER EN LA MIRA',
    'Titular principal',
    NULL,
    NULL,
    'warning',
    112,
    true
  ),
  (
    'ranking_lore_subject',
    'Lore protagonista',
    'Marcelo Arguello',
    'Nombre destacado',
    NULL,
    NULL,
    'neutral',
    113,
    true
  ),
  (
    'ranking_lore_body',
    'Lore cuerpo',
    NULL,
    'Párrafo narrativo',
    'Marcelo Arguello sigue de cerca la pelea por el primer puesto. La diferencia es mínima y un resultado exacto podría cambiar el ranking en cualquier momento.',
    NULL,
    'neutral',
    114,
    true
  ),
  (
    'ranking_lore_distance',
    'Lore distancia (pts)',
    '0',
    'Distancia a la cima',
    NULL,
    NULL,
    'neutral',
    115,
    true
  ),
  (
    'ranking_lore_objective',
    'Lore objetivo',
    'superar al líder',
    'Próximo objetivo',
    NULL,
    NULL,
    'neutral',
    116,
    true
  )
ON CONFLICT (key) DO NOTHING;
