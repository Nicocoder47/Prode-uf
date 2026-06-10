# Load tests — PRODEMUNDIAL 2026

## Requisitos

- `.env.cloud` con credenciales Supabase
- Node 20+ para scripts TS
- [k6](https://k6.io/) opcional para escenarios grandes

## Scripts Node (sin k6)

```bash
# Lectura mixta — 50 VUs, 30s
npm run load:read-api -- --vus=50 --duration=30

# Lectura — 250 VUs, 60s
npm run load:read-api -- --vus=250 --duration=60

# save_prediction — mismo partido
npm run load:save-prediction -- --users=50
npm run load:save-prediction -- --users=100
npm run load:save-prediction -- --users=250 --concurrency=50
```

## k6

```bash
export SUPABASE_URL=https://xxx.supabase.co
export SUPABASE_ANON_KEY=eyJ...

k6 run load-tests/k6-scenario-250.js
k6 run load-tests/k6-scenario-500.js
```

## Pico predicciones

```bash
npm run load:save-prediction -- --users=250 --concurrency=100
npm run load:save-prediction -- --users=500 --concurrency=100 --no-cleanup
```
