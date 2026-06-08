-- Public read for reference data (teams/players) — avoids plantel failures when JWT refresh hiccups.
DROP POLICY IF EXISTS teams_public_select ON public.teams;
CREATE POLICY teams_public_select ON public.teams FOR SELECT USING (true);

DROP POLICY IF EXISTS players_public_select ON public.players;
CREATE POLICY players_public_select ON public.players FOR SELECT USING (true);
