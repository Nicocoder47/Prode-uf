Deploy de Edge Functions (Supabase)
=================================

1) Requisitos

- `supabase` CLI instalado y autenticado (o `SUPABASE_ACCESS_TOKEN` set).
- Variables de entorno:
  - `SUPABASE_PROJECT_REF` (ref del proyecto)
  - `SUPABASE_ACCESS_TOKEN` (opcional si ya estás logueado en CLI)
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SPORTMONKS_API_KEY`, `SPORTMONKS_BASE_URL` en el entorno donde se ejecutarán las funciones.

2) Despliegue local con PowerShell

Ejecuta:

```powershell
cd path\to\prode
\.\scripts\deploy_functions.ps1
```

El script empaqueta cada archivo `src/edge-functions/<name>.ts` en `functions/<name>/index.ts` y llama a `supabase functions deploy <name>`.

3) Alternativa: desplegar manualmente

- Copia el archivo TypeScript a una carpeta `functions/<name>/index.ts` y usa `supabase functions deploy <name> --project-ref <ref>`.

4) Notas operativas

- Las plantillas hacen upserts idempotentes y tratan de mapear `provider_*` → `local id` consultando `teams` / `players` por `provider` y `provider_*_id`.
- Antes de ejecutar, pobla `teams` y `matches` con `sync-teams`/`sync-fixtures`.
- Revisa `data_sync_logs` para histórico y debugging.
