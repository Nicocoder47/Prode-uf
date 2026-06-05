Edge Functions templates (SportMonks)
===================================

Qué hay
- `src/edge-functions/sync-fixtures.ts` — plantilla para sincronizar fixtures desde SportMonks
- `src/edge-functions/sync-teams.ts` — plantilla para sincronizar equipos
- `src/edge-functions/webhooks-live-events.ts` — plantilla para recibir webhooks de eventos en vivo

Variables de entorno necesarias (en despliegue)
- `SPORTMONKS_API_KEY`
- `SPORTMONKS_BASE_URL` (ej: https://api.sportmonks.com/v3)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (clave de servicio; mantener secreta)

Despliegue (Supabase Edge Functions - Deno)
1. Copiar los archivos a `functions/` según la estructura de Supabase (o adaptar a tu plataforma de funciones).
2. En el dashboard de Supabase, crear las variables de entorno indicadas.
3. Desplegar las funciones: `supabase functions deploy sync-fixtures --project-ref <your-ref>` y similares.

Llamadas desde frontend
- Define `VITE_SYNC_API_BASE_URL` apuntando al dominio donde expones las funciones (ej: `https://<project>.functions.supabase.co`).
- En `Admin` los botones llamarán a `${VITE_SYNC_API_BASE_URL}/sync-fixtures` y `/sync-teams`.

Notas de seguridad
- Nunca incluyas `SUPABASE_SERVICE_ROLE_KEY` en el frontend ni en el repositorio.
- Las funciones deben autenticarse con firmas o con la clave de servicio en la capa de servidor.

Adaptación a otros proveedores
- El código está comentado y usa `SPORTMONKS_*` como ejemplo. Para usar `API-Football` o `Sportradar`, reemplaza los endpoints y el mapeo de fields.
