PRODEMUNDIAL 2026 — Arquitectura Live Data (resumen)

Objetivo
--------
Arquitectura enterprise-grade para ingestión y distribución de datos deportivos en tiempo real, tolerante a fallos, escalable y auditada.

Resumen de componentes
----------------------
- Frontend: React + TypeScript + Tailwind + Framer Motion + Zustand + React Query
- Backend: Node.js + NestJS (TS)
- Realtime: Socket.IO + Redis Pub/Sub (adapter para Socket.IO)
- Queue/Workers: BullMQ (Redis) para workers (live workers, scraping, syncs)
- DB: PostgreSQL (prisma ORM)
- Cache: Redis (hot cache para live snapshots y rate limits)
- Scraping/Playwright: workers aislados en Docker con rotating UA y proxy pool
- Providers: API-Football (principal), Sofascore (scraper), Transfermarkt (scraper), BallDontLie (fallback)
- Edge Functions/Supabase: para integraciones seguras (webhooks, payments, invite acceptance)

Módulos principales
-------------------
- matches: ingest fixtures, store canonical matches
- live-engine: detect kickoff, spawn live workers, orchestrador
- events: normalize provider events → canonical `match_events`
- players: canonical players, provider mappings
- ratings: pipeline para recibir ratings live, persistir historiales
- market-values: nightly scraping/upsert
- sync-engine: scheduled sync jobs, fallbacks y retry
- sockets: emitir events a frontend
- analytics: métricas, traces y dashboards

Realtime flow (alto nivel)
-------------------------
1. Provider upstream notifica webhook or polling detects kickoff.
2. `live-worker` se inicia: suscribe a provider live feed o poll 10-15s.
3. Worker normaliza events y los inserta en `match_events` + `player_ratings` y publica en Redis Pub/Sub.
4. Socket.IO adapter (backend) escucha Redis y emite `match:update`, `goal:scored`, `player:rating:update` a rooms `match:<id>`.
5. Frontend subscribe via Socket.IO, React Query invalida caches y actualiza UI.
6. Al finalizar, worker calcula MVP, persiste `mvp_history` y dispara `refresh-leaderboard` job.

Resiliencia
-----------
- Workers con reintentos exponenciales y dead-letter queues.
- Redis como cache y broker; Redis Cluster para producción.
- Database indices, partitioning por season o year para matches/eventos.
- Rate-limiter central (leaky-bucket) con backoff para providers.
- Circuit-breaker para providers con alerting.

Observabilidad
--------------
- Logs estructurados (JSON) con request_id, match_id, provider, trace_id
- Metrics: Prometheus (worker latencies, queue length, errors)
- Traces: OpenTelemetry (backend + workers)
- Alertas: PagerDuty/Slack para sync failures and high latency

Seguridad
---------
- Secrets in Vault or platform secrets (Railway, Render, Vercel secrets)
- Service role keys never in frontend
- Webhook verification (HMAC) where available
- RLS on Supabase/Postgres for multi-tenant isolation if needed

Próximos artefactos
-------------------
- `prisma/schema.prisma` (generado)
- `docker-compose.yml` para dev
- Plantillas: `football.service.ts`, `live-worker.ts`, `socket.gateway.ts`, `bullmq.ts`
- Frontend store/hook: `useLiveStore`, `useLiveMatch`


Licencias y ética
-----------------
- No scrapear sitios prohibidos; obtener acuerdos para Transfermarkt/FIFA data.
- Mostrar "Por confirmar" cuando datos no estén verificados.


Contacto
-------
Este documento es la base; puedo generar código y plantillas concretas para cada módulo.
