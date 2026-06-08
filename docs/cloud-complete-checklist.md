# PRODEMUNDIAL 2026 — Checklist cloud completo

Estado generado tras `npm run cloud:complete`.

## Completado automáticamente

| Item | Estado |
|------|--------|
| Frontend Vercel | https://prodemundialprode.vercel.app |
| Supabase DB + migraciones | Proyecto `irklqwsnehlfcgehvscm` |
| Sync teams/players/fixtures/standings | 49 equipos, 1267 jugadores, 104 partidos |
| Reportes `reports/*.json` | cloud-status, vercel-audit, production-readiness |
| Docs Oracle / Auth / UptimeRobot | `docs/oracle-deploy.md`, `docs/supabase-auth.md`, `docs/uptimerobot.md` |
| PM2 ecosystem (api + worker + worker-live) | `ecosystem.config.js` |
| Script bootstrap Oracle | `scripts/oracle-bootstrap.sh` |
| Pipeline local | `npm run cloud:complete` |

## Pendiente manual (requiere tu cuenta)

### 1. Oracle Cloud Always Free (~15 min)

```bash
# En la VM Ubuntu:
git clone https://github.com/Nicocoder47/Prode-uf.git prode
cd prode
# Copiar .env desde tu PC (.env.cloud → .env en la VM)
bash scripts/oracle-bootstrap.sh
curl http://TU-IP:3001/api/health   # → { "status": "ok" }
```

### 2. Vercel — API backend

En Vercel → Settings → Environment Variables:

```
VITE_API_BASE_URL=http://TU-IP-ORACLE:3001
```

Redeploy frontend.

### 3. Supabase Auth URLs

Dashboard → Authentication → URL Configuration:

- Site URL: `https://prodemundialprode.vercel.app`
- Redirect: `https://prodemundialprode.vercel.app/**`
- Redirect: `https://prodemundialprode.vercel.app/auth/callback`

Ver `docs/supabase-auth.md`.

### 4. API-Football (opcional, recomendado para live + fotos HD)

Agregar en `.env.cloud` y en Oracle `.env`:

```
API_FOOTBALL_KEY=tu_clave_rapidapi
```

Luego: `npm run sync:players:enrich -- 30`

### 5. UptimeRobot

Monitores HTTP cada 5 min:

- `https://prodemundialprode.vercel.app`
- `http://TU-IP-ORACLE:3001/api/health`

Ver `docs/uptimerobot.md`.

## Comandos útiles

```powershell
npm run cloud:complete          # sync + enrich + fotos + audits
npm run sync:cloud:all          # solo sync base
npm run sync:photos:cloud       # fotos TheSportsDB/Wikimedia
npm run audit:cloud:all         # regenerar reportes
npm run audit:production        # readiness final
```

## Readiness actual

Ver `reports/production-readiness.json`. Backend/Worker pasan a **READY** cuando Oracle tenga PM2 activo y heartbeat en `system_snapshots`.
