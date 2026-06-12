-- Configuración de visualización de puntos (ticker + banner de partidos).
-- No modifica el motor de scoring en DB; solo textos/números mostrados en la UI.

INSERT INTO public.admin_cards (key, title, value, subtitle, description, status, order_index, is_active)
VALUES
  (
    'scoring_exact_pts',
    'Puntos exacto (UI)',
    '5',
    'Marcador exacto',
    'Solo visualización en ticker y banner de partidos. No cambia el motor de scoring.',
    'success',
    100,
    false
  ),
  (
    'scoring_result_pts',
    'Puntos resultado (UI)',
    '3',
    'Ganador o empate',
    'Solo visualización en ticker y banner de partidos.',
    'success',
    101,
    false
  ),
  (
    'ticker_scoring_tip',
    'Tip del ticker',
    '',
    'Mensaje de puntos',
    'Dejá vacío para usar el texto automático con los puntos configurados arriba.',
    'neutral',
    102,
    false
  )
ON CONFLICT (key) DO NOTHING;
