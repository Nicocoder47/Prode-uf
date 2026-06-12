-- Las cards de configuración del ticker deben publicarse aunque is_active sea false.

UPDATE public.admin_cards
SET is_active = true
WHERE key IN (
  'ticker_welcome',
  'ticker_tip_title',
  'ticker_scoring_tip',
  'scoring_exact_pts',
  'scoring_result_pts'
);

CREATE OR REPLACE FUNCTION public.get_active_admin_cards()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(row_to_json(c) ORDER BY c.order_index), '[]'::jsonb)
  FROM public.admin_cards c
  WHERE c.is_active = true
     OR c.key IN (
       'ticker_welcome',
       'ticker_tip_title',
       'ticker_scoring_tip',
       'scoring_exact_pts',
       'scoring_result_pts'
     );
$$;
