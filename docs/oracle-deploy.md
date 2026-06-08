# PRODEMUNDIAL 2026 — Deploy en Oracle Cloud Always Free

Backend Express + Workers 24/7 (PM2). Frontend en Vercel. DB en Supabase cloud.

**Repositorio:** https://github.com/Nicocoder47/Prode-uf  
**Frontend:** https://prodemundialprode.vercel.app  
**Supabase:** `irklqwsnehlfcgehvscm`

## Requisitos

- Cuenta Oracle Cloud (Always Free ARM VM recomendada: 4 OCPU / 24 GB RAM)
- Proyecto Supabase cloud configurado (migraciones ya aplicadas vía GitHub)
- Upstash Redis free (opcional)
- IP pública o dominio para la API

## 1. Crear VM Always Free

1. Oracle Cloud Console → Compute → Instances → Create
2. Shape: **Ampere A1** (Always Free eligible)
3. Image: **Ubuntu 22.04**
4. Abrir puertos en Security List / NSG:
   - **22** (SSH)
   - **3001** (Express API) o nginx reverse proxy en **443**

## 2. Instalar Node

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential

# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

## 3. Instalar PM2

```bash
sudo npm install -g pm2 tsx
pm2 -v
```

## 4. Clonar repo

```bash
git clone https://github.com/Nicocoder47/Prode-uf.git prode
cd prode
npm ci
```

## 5. Configurar variables

Crear `.env` en la raíz (nunca commitear). Copiar desde `.env.cloud.example`:

```bash
SUPABASE_URL=https://irklqwsnehlfcgehvscm.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

FOOTBALL_DATA_API_KEY=...
API_FOOTBALL_KEY=...

# Redis Upstash (opcional)
REDIS_URL=rediss://default:PASSWORD@HOST.upstash.io:6379

NODE_ENV=production
API_PORT=3001
API_HOST=0.0.0.0
WORKER_HOST=oracle-cloud
CORS_ORIGIN=https://prodemundialprode.vercel.app
```

## 6. Ejecutar API

Prueba manual:

```bash
npm run api:serve
curl http://localhost:3001/api/health
# → { "status": "ok", "ok": true, ... }
```

## 7. Ejecutar Worker + Worker Live (PM2)

`ecosystem.config.js` define tres procesos con **autorestart**:

| Proceso | Script | Rol |
|---------|--------|-----|
| `prodem-api` | `server/index.ts` | Express API |
| `prodem-worker` | `src/workers/scheduler.ts` | Fixtures, standings, enrich |
| `prodem-worker-live` | `src/workers/liveWorker.ts` | Live sync + heartbeat 60s |

```bash
pm2 start ecosystem.config.js
pm2 status
pm2 logs
```

## 8. Reinicio automático

```bash
pm2 save
pm2 startup
# ejecutar el comando sudo que PM2 imprime
```

Tras reinicio de la VM, PM2 levanta api + worker + worker-live automáticamente.

## 9. Sync inicial de datos (desde PC o VM)

Con `.env.cloud` apuntando a Supabase cloud:

```bash
npm run sync:cloud:all
```

Incluye: teams, players, fixtures, standings, enrich players/teams.

## 10. Firewall y Vercel

Exponer API (IP pública o dominio):

```bash
curl http://<IP-PUBLICA>:3001/api/health
```

En **Vercel** → Environment Variables:

```
VITE_API_BASE_URL=http://<IP-PUBLICA>:3001
```

(Recomendado: nginx + HTTPS en dominio propio.)

## 11. Docker (alternativa)

```bash
docker build -t prodemundial .
docker run -d --name prodem --env-file .env -p 3001:3001 --restart unless-stopped prodemundial
```

El Dockerfile usa `pm2-runtime ecosystem.config.js` (api + workers).

## 12. Monitoreo

Ver `docs/uptimerobot.md`.

```bash
npm run audit:worker-health   # worker-health.json + reports/
npm run audit:cloud
```

## 13. Comandos útiles

```bash
pm2 logs prodem-worker-live
pm2 logs prodem-worker
pm2 logs prodem-api
pm2 restart all
npm run audit:system-health
```

## 14. Checklist post-deploy

- [ ] `GET /api/health` → `{ "status": "ok" }`
- [ ] `worker-health.json` con heartbeat reciente (< 90s)
- [ ] `/admin/system` muestra worker **online**
- [ ] `VITE_API_BASE_URL` configurado en Vercel
- [ ] Auth Supabase URLs → `docs/supabase-auth.md`
