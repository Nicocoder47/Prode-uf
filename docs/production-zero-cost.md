# PRODEMUNDIAL 2026 — Producción $0 (Supabase-only)

Arquitectura sin Oracle, Render, PM2 ni backend permanente.

## Arquitectura final

```
Usuarios
   │
   ▼
Vercel (React/Vite) ──► Supabase Auth (OTP email)
   │                         │
   │                         ├── PostgreSQL (matches, predictions, leaderboard)
   │                         ├── RLS (cada usuario ve/edita lo suyo)
   │                         ├── Triggers (score_match_predictions al FT)
   │                         └── Realtime (leaderboard, partidos)
   │
   └── Lee datos directo de Supabase (sin Express)

GitHub Actions (cron)
   ├── sync-fixtures.yml   → cada 1 h
   ├── sync-live.yml       → cada 15 min
   └── sync-cloud-all.yml  → semanal + manual
         │
         └── FOOTBALL_DATA_API_KEY → upsert idempotente en Supabase
```

**Limitación:** no hay live cada 30 s. Los resultados se actualizan cada **10–15 min** vía GitHub Actions.

---

## Auditoría de dependencias del backend

| Uso | Archivo / patrón | Modo $0 |
|-----|------------------|---------|
| Lectura partidos/equipos | `worldCupService` + Supabase | **Activo** (fallback directo) |
| API Express `/api/*` | `footballApiClient.ts` | **Desactivado** (`VITE_USE_FOOTBALL_API=false`) |
| Admin enrich/linking | `adminApi.ts` → `/api/admin/*` | **No disponible** sin Express (usar Supabase Dashboard + scripts) |
| Predicciones | `useSavePrediction` → Supabase | **Activo** |
| Scoring | `score_match_predictions` (PostgreSQL) | **Activo** |
| Sync datos | `scripts/sync*.ts` | **GitHub Actions** |
| Workers PM2 | `ecosystem.config.js`, `src/workers/*` | **Opcional local** — no en producción |
| Oracle docs | `docs/oracle-deploy.md` | **Legacy** — no usar |

---

## Variables Vercel (Production)

| Variable | Valor |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon key del proyecto |
| `VITE_USE_FOOTBALL_API` | `false` |
| `VITE_PUBLIC_DEMO` | `false` (o omitir) |

**No configurar en Vercel:**

- `VITE_API_BASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FOOTBALL_DATA_API_KEY`
- `API_FOOTBALL_KEY`

---

## GitHub Actions — Secrets

En el repo → **Settings → Secrets and variables → Actions**:

| Secret | Descripción |
|--------|-------------|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service role (solo CI, nunca frontend) |
| `FOOTBALL_DATA_API_KEY` | API football-data.org |
| `API_FOOTBALL_KEY` | *(opcional)* si usás api-football en lugar de football-data |

### Workflows

| Workflow | Cron | Manual | Script |
|----------|------|--------|--------|
| `sync-fixtures.yml` | cada hora | ✅ | `npm run sync:fixtures` |
| `sync-live.yml` | cada 15 min | ✅ | `npm run sync:live` |
| `sync-cloud-all.yml` | domingos 06:00 UTC | ✅ | `npm run sync:cloud:all` |

**Ejecutar sync manual:** GitHub → Actions → elegir workflow → **Run workflow**.

**Local (con `.env.cloud`):**

```bash
npm run sync:fixtures
npm run sync:live
npm run sync:cloud:all
npm run sync:squads    # alias de sync:players
```

---

## Supabase Auth (login OTP)

1. Dashboard → Authentication → Email → OTP habilitado
2. Site URL: `https://prodemundialprode.vercel.app`
3. Redirect URLs: `https://prodemundialprode.vercel.app/**`
4. Aplicar migración `20240112000000_access_login_profile.sql`

Flujo:

1. `/login` → nombre, dominio/patente, email
2. Código OTP 6 dígitos por email
3. `sync_user_profile` guarda `full_name`, `domain_plate`, `email`
4. Predicciones con `auth.uid()` — sin modo demo en producción

Detalle: [supabase-auth.md](./supabase-auth.md)

---

## Scoring (PostgreSQL — no tocar)

- Función: `score_match_predictions(p_match_id)`
- Trigger: al pasar `matches.status` a `finished` (si `scored_at IS NULL`)
- Anti doble scoring: trigger solo corre en transición a `finished`; `scored_at` evita re-ejecutar
- Corrección de resultado: `rescore_match_predictions` + trigger `trg_rescore_on_result_change`
- Leaderboard: se actualiza dentro de `score_match_predictions`

El sync de GitHub Actions **solo escribe marcadores**; el scoring lo hace PostgreSQL automáticamente.

---

## Cómo probar

### 1. Build frontend

```bash
npm run build
```

### 2. Login OTP

1. Abrir `https://prodemundialprode.vercel.app/login`
2. Completar nombre, patente, email
3. Ingresar código de 6 dígitos
4. Verificar perfil en Supabase → `users`

### 3. Predicción

1. Elegir partido **scheduled** con kickoff futuro
2. Guardar marcador
3. Ver fila en `predictions` con tu `user_id`

### 4. Sync manual

GitHub Actions → **Sync Live Matches** → Run workflow  
(o local: `npm run sync:live` con `.env.cloud`)

### 5. Scoring + leaderboard

```bash
npm run test:production-e2e
```

Prueba: partido `finished`, puntos asignados, anti doble scoring al re-sync.

### 6. Validar env

```bash
npm run validate:production-env
```

---

## Seguridad

| Clave | Dónde |
|-------|-------|
| `VITE_SUPABASE_ANON_KEY` | Vercel (público, con RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub Secrets / `.env.cloud` local |
| `FOOTBALL_DATA_API_KEY` | GitHub Secrets / `.env.cloud` local |

RLS: usuarios solo leen/escriben sus predicciones y perfil. Admin vía `is_admin()`.

---

## Panel Admin en modo $0

Las pantallas `/admin/*` que llaman a Express (`/api/admin/...`) **no funcionan** sin backend.

Alternativas:

- Supabase Dashboard (SQL, tablas)
- Scripts locales con service role
- Workflows GitHub Actions para sync

El frontend de usuarios (login, partidos, predicciones, leaderboard) **sí funciona** completo.

---

## Migraciones pendientes en cloud

```bash
supabase link --project-ref irklqwsnehlfcgehvscm
supabase db push
```

Incluye: `20240111000000_production_hardening.sql`, `20240112000000_access_login_profile.sql`

---

## Referencias

- [vercel-deploy.md](./vercel-deploy.md) — deploy frontend
- [supabase-auth.md](./supabase-auth.md) — OTP y patente
- [oracle-deploy.md](./oracle-deploy.md) — *(legacy, no usar en $0)*
