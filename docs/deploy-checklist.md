# Checklist final — PRODEMUNDIAL 2026 en la nube (0 USD)

Ejecutar después del deploy completo.

## Infraestructura

- [ ] Frontend Vercel accesible desde Internet
- [ ] Backend Oracle responde `GET /api/health`
- [ ] Worker PM2 `prodem-worker` activo (`pm2 status`)
- [ ] Supabase cloud con migraciones aplicadas
- [ ] Upstash Redis configurado (opcional) o sync sin Redis

## Scripts de auditoría (desde Oracle VM o CI)

```bash
npm run audit:deploy
npm run audit:supabase-health
npm run audit:worker-health
npm run audit:system-health
```

Reportes en `reports/`.

## Funcionalidad

- [ ] Auth / invite login
- [ ] Predicciones (scheduled + !is_locked)
- [ ] Leaderboard actualiza tras scoring
- [ ] Realtime partidos live (Supabase Realtime)
- [ ] Edge function `score-match` desplegada
- [ ] `/admin/system` — worker online, último sync, eventos
- [ ] `/admin/knockout` — bracket tras fase de grupos

## Monitoreo UptimeRobot

- [ ] Monitor frontend Vercel
- [ ] Monitor API `/api/health`
- [ ] Alertas email configuradas

## Variables sin localhost

- [ ] `VITE_SUPABASE_URL` → `https://*.supabase.co`
- [ ] `SUPABASE_URL` → cloud
- [ ] `VITE_API_BASE_URL` → URL pública Oracle
- [ ] `REDIS_URL` → `rediss://*.upstash.io` o vacío

## Sin dependencia local

- [ ] PC apagada → app sigue online
- [ ] Sin Docker local requerido
- [ ] Sin `supabase start` local en producción
