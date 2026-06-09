-- Soporte / consultas de usuario — tickets con RLS

CREATE TABLE IF NOT EXISTS public.user_support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT user_support_tickets_category_check CHECK (
    category IN ('predicciones', 'ranking', 'puntos', 'login', 'perfil', 'pagos', 'otro')
  ),
  CONSTRAINT user_support_tickets_priority_check CHECK (priority IN ('normal', 'alta')),
  CONSTRAINT user_support_tickets_status_check CHECK (status IN ('open', 'in_review', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_user_support_tickets_user_id
  ON public.user_support_tickets (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_support_tickets_status
  ON public.user_support_tickets (status, created_at DESC);

ALTER TABLE public.user_support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_support_tickets_insert_own ON public.user_support_tickets;
CREATE POLICY user_support_tickets_insert_own ON public.user_support_tickets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_support_tickets_select ON public.user_support_tickets;
CREATE POLICY user_support_tickets_select ON public.user_support_tickets
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS user_support_tickets_admin_update ON public.user_support_tickets;
CREATE POLICY user_support_tickets_admin_update ON public.user_support_tickets
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT ON public.user_support_tickets TO authenticated;
GRANT UPDATE ON public.user_support_tickets TO authenticated;
