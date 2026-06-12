-- Textos editables del ticker horizontal (home).

INSERT INTO public.admin_cards (key, title, value, subtitle, description, status, order_index, is_active)
VALUES
  (
    'ticker_welcome',
    'PRODEMUNDIAL 2026',
    'Viví el Mundial · Hacé tus predicciones antes de cada partido',
    'Mensaje de bienvenida',
    'Título y cuerpo del primer mensaje del ticker en el home.',
    'neutral',
    103,
    false
  ),
  (
    'ticker_tip_title',
    'Título del tip',
    'Tip',
    'Etiqueta del tip',
    'Texto en negrita del mensaje de puntos en el ticker.',
    'neutral',
    104,
    false
  )
ON CONFLICT (key) DO NOTHING;
