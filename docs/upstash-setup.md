# Upstash Redis Free — PRODEMUNDIAL 2026

Redis es **opcional**. Si Upstash falla o no está configurado, el worker sigue operando con Supabase como fuente de verdad.

## 1. Crear base Redis

1. [console.upstash.com](https://console.upstash.com) → Create Database
2. Region: elegir la más cercana a Oracle VM (ej. US East)
3. Plan: **Free** (10K commands/day)

## 2. Obtener URL

Copiar **Redis URL** del dashboard. Formato típico:

```
rediss://default:AXxxxx@us1-xxxxx.upstash.io:6379
```

## 3. Configurar en Oracle VM

En `.env` del backend/worker:

```
REDIS_URL=rediss://default:PASSWORD@HOST.upstash.io:6379
```

Reiniciar PM2:

```bash
pm2 restart all
```

## 4. Verificar

```bash
curl http://localhost:3001/api/health
# checks.redis → { ok: true, detail: "ping ok" }
```

En `/admin/system`, Redis debe aparecer como configurado y reachable.

## Notas

- `rediss://` activa TLS automáticamente en `SyncEngine` e `/api/health`
- No configurar `REDIS_URL` en Vercel (solo backend)
- Docker local (`docker compose`) es solo para desarrollo
