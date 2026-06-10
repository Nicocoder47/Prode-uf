# Escalar PRODEMUNDIAL 2026 a 1000+ usuarios

> **Estado actual:** optimizado para beta **200–400 usuarios costo $0**.  
> Este documento es el plan futuro — **no implementar** hasta superar umbrales de migración.

## Qué mirar antes de migrar

| Señal | Dónde verla | Umbral de alerta |
|-------|-------------|------------------|
| Usuarios registrados | Admin → Beta / Capacidad | > 350 (naranja), > 500 (rojo) |
| Usuarios activos 7d | Admin → Beta / Capacidad | > 200 (preparar), > 300 (migrar) |
| Picos simultáneos | `npm run beta:capacity` | > 120 (naranja), > 150 (rojo) |
| Latencia lectura p95 | `npm run load:read-api` | > 3s sostenida |
| save_prediction p95 | `npm run load:save-prediction` | > 5s |
| Errores Auth 429 | logs Supabase / load tests | cualquier pico en registro |
| Realtime channels | `npm run load:realtime-estimate` | > 200 en plan Free |
| Ranking lento | UX + polling 30s | usuarios reportan retraso > 1 min |
| Sync live | Admin → Sistema / `data_sync_logs` | fallos repetidos en partidos |
| Scoring post-partido | `activity_logs` type `score_calculated` | retraso > 5 min tras final |

## Cuándo migrar

Migrar **antes** de abrir más invitaciones si ocurre **cualquiera** de:

1. **> 400 usuarios registrados** con crecimiento sostenido (> 20/semana).
2. **> 500 usuarios registrados** — límite duro del plan gratuito de Realtime.
3. **> 150 usuarios simultáneos** estimados (partido importante + ranking).
4. **save_prediction p95 > 5s** con 50+ concurrentes.
5. **Leaderboard/home p95 > 3s** en load test con 250 VUs.
6. **Errores Auth 429** al crear usuarios en picos.
7. **Inicio del Mundial** con tráfico concentrado en ventanas de 90 min.

## Qué pagar primero (orden recomendado)

1. **Supabase Pro (~USD 25/mes)** — más conexiones, Realtime, egress, backups.
2. **Render Worker Starter (~USD 7/mes)** — sync live cada 60s sin depender solo de GHA.
3. **Monitoreo externo** (Better Stack / UptimeRobot free tier primero).
4. **Vercel Pro** — solo si el edge o builds se convierten en cuello (poco probable antes de 1000).
5. **Redis** — no hasta tener evidencia de cache miss o colas (post-1000).

**Presupuesto mínimo viable:** ~USD 32/mes (Supabase Pro + Render Starter).

## Arquitectura objetivo 1000 usuarios (futuro)

```
Usuarios → Vercel (Hobby/Pro) → Supabase Pro (Postgres + Auth + RPC)
                ↓ polling 30–60s o Realtime centralizado (1 canal admin)
Render Worker → sync fixtures/live cada 60s
GitHub Actions → backup sync + audits
Materialized views → leaderboard, live_stats
Job post-scoring → tras status=finished
Alertas → heartbeat worker + beta:health cron
Load test mensual → load:read-api + load:save-prediction
```

## Qué NO hacer prematuramente

- Redis / CDN dedicado sin métricas.
- Reescribir scoring o save_prediction.
- Microservicios separados del monolito Supabase.
- Optimizar para 10.000 usuarios.
- Vercel Pro “por las dudas”.

## Scripts de monitoreo (ya disponibles en beta)

```bash
npm run beta:capacity          # → reports/beta-capacity.json
npm run beta:users             # → reports/beta-users.json
npm run beta:health            # → reports/beta-health.json
npm run beta:migration-check   # → reports/beta-migration-check.json
```

## Feature flags

| Variable | Beta (default) | Post-migración |
|----------|----------------|----------------|
| `VITE_BETA_MODE` | `true` | `false` |
| `VITE_ENABLE_REALTIME` | `false` | `true` (con Supabase Pro) |
| `VITE_ENABLE_HEAVY_ANIMATIONS` | `false` | `true` |
| `VITE_ENABLE_LIVE_INSIGHTS` | `true` | `true` |

## Checklist pre-migración

- [ ] Correr `npm run beta:migration-check` — semáforo naranja o rojo
- [ ] Correr load tests con 250 VUs lectura
- [ ] Confirmar p95 save_prediction < 5s con 50 concurrent
- [ ] Aplicar migración `system_capacity_snapshots` en cloud
- [ ] Activar Supabase Pro
- [ ] Desplegar Render worker
- [ ] Opcional: `VITE_ENABLE_REALTIME=true` tras validar canales
