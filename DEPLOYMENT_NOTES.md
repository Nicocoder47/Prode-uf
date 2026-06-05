DEPLOYMENT NOTES — PRODEMUNDIAL 2026

Entorno requerido (prod)
- Postgres (managed)
- Redis (cluster)
- Node.js (backend, workers)
- Vercel (frontend) — configure environment variables
- Railway / Render (backend) — secrets: DATABASE_URL, REDIS_URL, API_FOOTBALL_KEY, SPORTMONKS_KEY, TRANSFERMARKT_PROXY
- Storage: object storage for assets (S3-compatible)
- Monitoring: Prometheus + Grafana (or Datadog)

Env vars mínimas
- DATABASE_URL
- REDIS_URL
- API_FOOTBALL_KEY
- SPORTMONKS_KEY (if used)
- TRANSFERMARKT_PROXY (if scraping via proxy)
- SOCKET_PORT (socket server)
- JWT_SECRET

CI / CD
- Frontend: Vercel auto deploy from `main`
- Backend: Build + Docker image push; deploy on Railway/Render with autoscaling
- Workers: separate service with concurrency control

Secrets
- Use platform secrets manager; never expose service keys to frontend

Scaling tips
- Socket.IO: use Redis adapter and scale multiple socket nodes behind load balancer
- Redis: use cluster mode; separate DB indexes for pubsub and cache
- Postgres: partition `match_events` by date/season; async archiving to cheaper storage

Backups
- Regular DB backups and WAL archiving
- Export snapshots of market values and ratings weekly

Security
- Webhooks validated via HMAC
- Rate-limit external scraping to avoid blocks


Run locally (dev)
- Start services via `docker-compose up --build`
- Run `pnpm --filter backend dev` and `pnpm --filter frontend dev` as needed

