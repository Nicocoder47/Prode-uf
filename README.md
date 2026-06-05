# PRODEMUNDIAL 2026

Plataforma de prode del Mundial con datos deportivos reales, Supabase y React.

## Seguridad

```txt
Rotar FOOTBALL_DATA_API_KEY antes de producción.
Nunca commitear .env.
```

El archivo `.env` está en `.gitignore`. Copiá `.env.example` a `.env` y completá las variables.

## Stack

- **Frontend:** React 18 + Vite + TanStack Query + Tailwind
- **Backend:** Supabase (Postgres, Auth, Realtime)
- **Sync:** football-data.org (principal) → SyncEngine → Supabase

## Proveedores de datos

Orden de fallback (`DataProviderManager`):

1. `FOOTBALL_DATA_API_KEY` → football-data.org
2. `API_FOOTBALL_KEY` → API-Football
3. `SPORTMONKS_API_TOKEN` → no implementado

## Scripts

```bash
# Diagnóstico football-data.org
npm run football-data:test

# Sync football-data.org
npm run football-data:sync:all

# Sync genérico (elige provider automáticamente)
npm run sync:all

# App
npm run dev          # http://localhost:5174
npm run build
npm run worker:live  # partidos en vivo cada 30s
```

## Infra local

```bash
docker compose up -d redis
npx supabase start
npx supabase db reset --yes
npm run football-data:sync:all
npm run dev
```

## Arquitectura de datos

```txt
FootballDataProvider → normalizers → SyncEngine → Supabase
                                              ↓
                         footballDataService (Express /api/*) → worldCupService → UI
```

### API REST (footballDataService)

```bash
npm run api:serve   # http://localhost:3001/api
npm run dev         # proxy /api → 3001 en Vite
```

Endpoints:
- `GET /api/groups`
- `GET /api/groups/:id`
- `GET /api/teams/:id`
- `GET /api/teams/:id/players`
- `GET /api/players/:id`
- `GET /api/players/:id/stats`
- `GET /api/fixtures`

### Sync diario

```bash
npm run worker              # scheduler (live 30s, fixture 1h, daily 02:00 + enrich)
npm run enrich:players      # enriquecer perfil (TheSportsDB + Wikimedia)
npm run enrich:players 200  # limitar lote (default 60)
```

Los dumps de diagnóstico se guardan en `debug/football-data/` (ignorados por git).

## Legacy

- `backend/` — NestJS prototipo, no integrado
- `frontend/` — hooks sueltos, no integrado
