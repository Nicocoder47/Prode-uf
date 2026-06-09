# RELEASE READINESS REPORT — PRODEMUNDIAL 2026

**Fecha:** 2026-06-09  
**Auditoría:** Release Manager / DevOps / QA  
**Alcance:** Validación pre-lanzamiento (solo lectura — sin cambios de código ni config)  
**Branch:** `main` (up to date with `origin/main`)

---

## Resumen ejecutivo

| Área | Estado | Notas |
|------|--------|-------|
| Git | ⚠️ RIESGO | Cambios críticos sin commit ni push |
| Build local | ✅ OK | Warning chunk >500 kB |
| Deploy Vercel (prod actual) | ❌ DESALINEADO | Frontend viejo vs DB post-190/200 |
| Supabase cloud | ✅ OK | Migraciones 190/200 verificadas |
| Seguridad env | ⚠️ ADVERTENCIAS | Sin service_role en bundle; ver detalle |
| Smoke / E2E | ✅ OK | 19/19 en cloud |
| **Decisión** | **BLOCK DEPLOY** | Ver sección 8 |

---

## 1. Estado Git

### Comando ejecutado

```bash
git status --short
git diff --stat HEAD
```

### Archivos modificados (15, sin stage)

| Archivo | Relevancia release |
|---------|-------------------|
| `src/hooks/useSavePrediction.ts` | **Crítico** — migra a RPC `save_prediction` |
| `src/services/worldcup/worldCupService.ts` | **Crítico** — usa `public_leaderboard_profiles` |
| `scripts/productionE2e.ts` | E2E corregido (19/19) |
| Otros 12 archivos frontend/admin/utils | Cambios asociados pre-launch |

**Diff total:** +305 / −172 líneas en 15 archivos.

### Archivos sin trackear — revisión

| Archivo | ¿Subir? | Motivo |
|---------|---------|--------|
| `supabase/migrations/20240119000000_prediction_security_hardening.sql` | ✅ Sí (commit) | Migración 190 — reproducibilidad |
| `supabase/migrations/20240120000000_prelaunch_security_lockdown.sql` | ✅ Sí (commit) | Migración 200 — reproducibilidad |
| `supabase/migrations/20240118000000_score_mark_only.sql` | ⚠️ Evaluar | Dependencia de cadena migraciones |
| `docs/FINAL_PRELAUNCH_REPORT.md` | ✅ Sí | Documentación |
| `docs/PRODUCTION_READINESS_AUDIT.md` | ✅ Sí | Documentación |
| `docs/SECURITY_AUDIT_REPORT.md` | ✅ Sí | Documentación |
| `reports/post-migration-verify.json` | ⚠️ Opcional | Evidencia; sin secretos |
| `reports/prelaunch-audit-raw.json` | ⚠️ Opcional | Evidencia |
| `reports/*b64chunks*.json`, `migration150-chunks.json` | ❌ NO | Artefactos temporales de apply |
| `public/datos usuarios.xlsx` | ❌ **NUNCA** | **PII** — datos personales de usuarios |
| `public/seccional vertical.jpeg` | ⚠️ Evaluar | Asset; no bloqueante |
| `scripts/buildDashboardSqlExpr.ts`, `generateCdpChunkCalls.ts` | ⚠️ Evaluar | Scripts auxiliares one-off |

### Secretos / tokens en working tree

| Verificación | Resultado |
|--------------|-----------|
| `.env`, `.env.local`, `.env.cloud` en git | ✅ Ignorados por `.gitignore` |
| Service role en archivos trackeados modificados | ✅ No detectado |
| Tokens hardcodeados en `src/` frontend bundle | ✅ Solo anon key pública (`supabaseEnv.ts`, `vercel.json`) |
| `reports/deploy-audit.json` (trackeado) | ⚠️ Contiene preview de `FOOTBALL_DATA_API_KEY` — riesgo histórico en repo |

### HEAD remoto vs local

- **Último commit en `main`:** `6f1dd77` — *Mejora UI mobile premium, admin Supabase y hardening produccion.*
- **Migraciones 190/200 en `origin/main`:** ❌ No presentes (solo en working tree local).
- **Frontend `save_prediction` en `origin/main`:** ❌ Sigue usando `.upsert()` directo sobre `predictions`.

---

## 2. Auditoría de variables de entorno

### Archivos revisados

| Archivo | Acceso | Hallazgo |
|---------|--------|----------|
| `.env.example` | ✅ OK | Sin secretos; documenta separación Vercel vs GitHub |
| `.env.cloud.example` | ✅ OK | Placeholders vacíos |
| `.env`, `.env.local`, `.env.cloud` | Gitignored | `npm run validate:production-env` → **✔ Variables críticas OK** |
| `.env.production` | No existe | — |

### Validación automática

```
npm run validate:production-env
✔ Variables críticas OK
⚠ VITE_USE_FOOTBALL_API=true sin VITE_API_BASE_URL — el frontend usará fallback Supabase
```

*(Warning local en `.env.cloud`; `vercel.json` tiene `VITE_USE_FOOTBALL_API=false`.)*

### Vercel (`vercel.json` + producción)

| Variable | En `vercel.json` | Riesgo |
|----------|------------------|--------|
| `VITE_SUPABASE_URL` | ✅ Cloud URL | OK — pública |
| `VITE_SUPABASE_ANON_KEY` | ✅ Anon JWT | OK — diseñada para browser (RLS) |
| `VITE_USE_FOOTBALL_API` | `false` | OK |
| `VITE_PUBLIC_DEMO` | `false` | OK |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ Ausente | ✅ Correcto — no en frontend |
| `VITE_API_BASE_URL` | ❌ Ausente | ✅ Correcto — modo Supabase-only |

**Vercel Dashboard:** no auditado en vivo (CLI `vercel env ls` no completado — sin auth). Se asume alineado con `vercel.json` documentado.

### Supabase Secrets

- Edge functions referencian `SUPABASE_SERVICE_ROLE_KEY` vía `Deno.env` — patrón correcto (servidor).
- `src/database/supabaseClient.ts` usa service role pero **no aparece en `dist/`** ni en bundle Vercel prod — solo workers/scripts Node.

### Frontend — checks de exposición

| Check | Resultado |
|-------|-----------|
| `VITE_*` contiene SERVICE_ROLE | ✅ No |
| Bundle prod contiene `SERVICE_ROLE` | ✅ No (grep en `dist/` y fetch a Vercel) |
| `VITE_DEV_ADMIN` en Vercel | ✅ No configurado en `vercel.json` |
| Anon key hardcodeada fallback | ⚠️ `src/config/supabaseEnv.ts` — aceptable (anon pública) |

---

## 3. Estado Build

### Comando

```bash
npm run build   # tsc -b && vite build
```

### Resultado

| Métrica | Valor |
|---------|-------|
| TypeScript | ✅ Sin errores |
| Vite build | ✅ Completado en ~4.8s |
| Exit code | 0 (con warning Rollup) |
| `dist/index.html` | 0.46 kB |
| CSS principal | 146 kB (gzip 26 kB) |
| JS principal `index-*.js` | **837 kB** (gzip 244 kB) ⚠️ |
| Chunks lazy relevantes | `useSavePrediction-*.js` incluye `save_prediction`; `useWorldCupData-*.js` incluye `public_leaderboard_profiles` |

### Warnings

```
(!) Some chunks are larger than 500 kB after minification.
```

**Evaluación:** no bloqueante para MVP; recomendable code-split futuro (fuera de alcance).

### Imports rotos

✅ Ninguno detectado — 2367 módulos transformados sin error.

---

## 4. Estado Deploy

### Vercel

| Item | Estado |
|------|--------|
| `vercel.json` presente | ✅ |
| Framework Vite | ✅ |
| `buildCommand`: `npm run build` | ✅ |
| `outputDirectory`: `dist` | ✅ |
| `installCommand`: `npm ci` | ✅ |
| SPA rewrites → `/index.html` | ✅ |
| Cache headers `/assets/*` | ✅ immutable 1y |
| URL prod | https://prodemundialprode.vercel.app |
| Rutas HTTP (audit previo) | ✅ 200 en `/`, `/fixture`, `/leaderboard`, `/predictions`, `/admin`, etc. |

### Desalineación crítica prod vs código local

Auditoría de bundles en **Vercel producción** (fetch 2026-06-09):

| Chunk prod | `save_prediction` RPC | `.upsert()` | `public_leaderboard_profiles` | `profiles(full_name` join |
|------------|----------------------|-------------|-------------------------------|---------------------------|
| `useSavePrediction-1YDsSdNg.js` | ❌ false | ✅ true | — | — |
| `useWorldCupData-D_EG4udv.js` | — | — | ❌ false | ✅ true |

**Build local** (mismo día, post-cambios sin commit):

| Chunk local | `save_prediction` | `public_leaderboard_profiles` |
|-------------|--------------------|-----------------------------|
| `useSavePrediction-BF7B-Inz.js` | ✅ true | — |
| `useWorldCupData-BHkcgt8H.js` | — | ✅ true |

**Impacto:** la DB cloud ya tiene migración 190 (RLS bloquea INSERT/UPDATE directo en `predictions`; escritura solo vía RPC). El frontend desplegado hoy **no puede guardar predicciones** para usuarios reales.

### GitHub Actions

Workflows presentes: `sync-fixtures.yml`, `sync-cloud-all.yml`, `sync-live.yml`.  
Secrets no verificados en esta auditoría (requiere acceso GitHub).

---

## 5. Estado Supabase

**Proyecto:** `irklqwsnehlfcgehvscm`  
**Evidencia:** `reports/post-migration-verify.json` + `npm run test:production-e2e` (2026-06-09)

| Check | Estado | Evidencia |
|-------|--------|-----------|
| Migración 190 aplicada | ✅ | RPC `save_prediction`; RLS predictions |
| Migración 200 aplicada | ✅ | REVOKE scoring; vista ranking |
| `save_prediction` existe | ✅ | E2E + post-migration probe |
| `public_leaderboard_profiles` existe | ✅ | HTTP 200 en probe anon |
| `score_match_predictions` protegida (authenticated) | ✅ | `permission denied` (42501) |
| `rescore_match_predictions` protegida (authenticated) | ✅ | `permission denied` (42501) |
| `validate_member_legajo` bloqueada (anon) | ✅ | `permission denied` |
| Scoring service_role | ✅ | Callable desde E2E admin client |

### Tablas (snapshot health report)

| Tabla | Filas |
|-------|-------|
| matches | 104 |
| standings | 48 |
| predictions | 0 |
| profiles | 0 |
| leaderboard | 0 |

*(Entorno pre-launch / post-reset auth documentado.)*

---

## 6. Estado Seguridad

| Control | Estado |
|---------|--------|
| Predicciones vía RPC SECURITY DEFINER | ✅ DB + local build |
| RLS predictions write bloqueado | ✅ DB |
| Scoring RPC solo service_role/admin | ✅ DB verificado |
| Ranking sin PII directa | ✅ Vista `public_leaderboard_profiles` en DB + build local |
| Anon key en frontend | ✅ Esperado |
| Service role fuera del browser | ✅ Verificado en bundles |
| E2E seguridad | ✅ 19/19 |

### Advertencias no críticas

1. **`public/datos usuarios.xlsx`** en `public/` — riesgo de exposición si se commitea (servido estáticamente).
2. **`reports/deploy-audit.json`** trackeado con preview de API key football-data.
3. **DNI como contraseña** — riesgo aceptado documentado en `docs/supabase-auth.md`.
4. **Worker live sin heartbeat** — `reports/production-readiness.json` marca Live PARTIAL (no bloquea MVP fixture/predictions).

---

## 7. Estado Smoke Test

### E2E producción (`npm run test:production-e2e`)

```
=== Resultado: 19 OK, 0 FAIL ===
Exit code: 0
```

**Flujo cubierto:**

| Paso | Resultado |
|------|-----------|
| Login Supabase (usuario E2E) | ✅ |
| Guardar predicción (`save_prediction` RPC) | ✅ |
| Bloqueo partido live | ✅ `predictions_closed` |
| Scoring + puntos exactos (5) | ✅ |
| Leaderboard actualizado | ✅ |
| Anti-duplicación scoring | ✅ |
| Rescore admin (2-1 → 1-1) | ✅ |
| Checks negativos (scoring/rescore/legajo/RLS ajena) | ✅ |

### Flujo usuario nuevo (registro)

| Paso | Cobertura |
|------|-----------|
| Registro UI | ⚠️ Manual — requiere confirmación email (Supabase) |
| Login email + DNI | ✅ Parcial vía E2E (usuario admin-created) |
| Ver fixture | ✅ Rutas prod 200; datos en DB |
| Guardar predicción en **Vercel prod actual** | ❌ **Fallará** — bundle usa `.upsert()` bloqueado por RLS |
| Consultar ranking | ⚠️ Prod usa join `profiles` — puede fallar post-migración 200 |

---

## 8. Riesgos pendientes

| # | Riesgo | Severidad | Acción requerida (sin ejecutar en esta auditoría) |
|---|--------|-----------|-----------------------------------------------------|
| 1 | **Frontend prod desalineado con DB 190/200** | **CRÍTICA** | Commit + push cambios frontend; redeploy Vercel |
| 2 | Migraciones 190/200 no en `origin/main` | Alta | Commit migraciones al repo |
| 3 | `public/datos usuarios.xlsx` sin trackear pero en tree | Alta | Agregar a `.gitignore` o eliminar del tree |
| 4 | Worker live sin heartbeat | Media | Ops post-launch; GitHub Actions sync |
| 5 | Bundle JS >500 kB | Baja | Code-split futuro |
| 6 | API key preview en `reports/deploy-audit.json` | Baja | Rotar key si repo es público; sanitizar report |

---

## 9. Riesgos aceptados (MVP)

| Riesgo | Justificación |
|--------|---------------|
| Anon JWT en `vercel.json` / código | Patrón Supabase estándar; RLS protege datos |
| DNI como contraseña | Decisión funcional documentada |
| Legajo visible en ranking | Requisito prode interno |
| Live worker parcial | MVP no depende de live realtime para lanzamiento inicial |
| Sin verificación live Vercel Dashboard env | `vercel.json` cubre vars críticas |

---

## 10. Decisión final

# BLOCK DEPLOY

### Motivo exacto

La **base de datos en cloud ya está endurecida** (migraciones 190 y 200 aplicadas, E2E 19/19 OK), pero el **frontend desplegado en Vercel NO refleja esos cambios**:

1. **`useSavePrediction` en producción** sigue haciendo `.upsert()` directo sobre `predictions`. La migración 190 revocó INSERT/UPDATE para usuarios autenticados → **los usuarios reales no podrán guardar predicciones**.
2. **`worldCupService` en producción** sigue consultando `profiles(full_name, legajo, …)` en lugar de `public_leaderboard_profiles` → **ranking puede romperse o filtrar PII** post-migración 200.
3. **Los fixes están solo en working tree local** (15 archivos modificados, 0 staged, 0 pushed). Un deploy automático desde `origin/main` **no incluiría** el código compatible con la DB actual.

### Condición para pasar a READY TO DEPLOY

*(Requiere aprobación explícita — no ejecutado en esta auditoría)*

1. Commit + push de cambios frontend (`useSavePrediction`, `worldCupService`, etc.) y migraciones SQL al repo.
2. Confirmar que **`public/datos usuarios.xlsx` no entra** en el commit.
3. Redeploy Vercel desde el nuevo `main`.
4. Smoke manual post-deploy: registro → login → predicción → ranking en https://prodemundialprode.vercel.app.

---

*Informe generado en modo read-only. No se modificó código, configuración ni migraciones durante esta auditoría.*
