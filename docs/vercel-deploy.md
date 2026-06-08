# PRODEMUNDIAL 2026 — Deploy Frontend en Vercel (Free)

Modo recomendado: **producción $0 Supabase-only** — ver [production-zero-cost.md](./production-zero-cost.md).

## 1. Subir repo a GitHub

```bash
git init
git add .
git commit -m "PRODEMUNDIAL 2026 cloud ready"
git remote add origin https://github.com/TU_USUARIO/prode.git
git push -u origin main
```

## 2. Importar en Vercel

1. [vercel.com](https://vercel.com) → Add New Project
2. Importar el repo GitHub
3. Framework: **Vite** (detectado automáticamente)
4. Build: `npm run build`
5. Output: `dist`

## 3. Variables de entorno (Production)

| Variable | Valor |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon key del proyecto Supabase |
| `VITE_USE_FOOTBALL_API` | `false` |
| `VITE_PUBLIC_DEMO` | `false` (o omitir) |

**No** configurar en Vercel:

- `VITE_API_BASE_URL` (no hay backend Express en producción $0)
- `SUPABASE_SERVICE_ROLE_KEY` (solo GitHub Actions / scripts locales)
- `FOOTBALL_DATA_API_KEY` (solo GitHub Actions)

## 4. GitHub Actions (sync automático)

Configurar secrets en GitHub → ver [production-zero-cost.md](./production-zero-cost.md).

## 5. Deploy automático

Cada push a `main` dispara build + deploy.

Preview deployments en PRs.

## 6. Supabase Auth redirect

En Supabase Dashboard → Authentication → URL Configuration:

- **Site URL:** `https://tu-app.vercel.app`
- **Redirect URLs:** `https://tu-app.vercel.app/**`

## 7. Verificar

- App carga sin errores de env
- Login OTP en `/login` funciona
- Partidos cargan desde Supabase (sin API Oracle)
- Predicciones guardan en Supabase
- Leaderboard actualiza tras partidos `finished`

## 8. vercel.json

El proyecto incluye `vercel.json` con SPA rewrites y cache de assets.
