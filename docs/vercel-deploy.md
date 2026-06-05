# PRODEMUNDIAL 2026 — Deploy Frontend en Vercel (Free)

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
| `VITE_API_BASE_URL` | `https://api.tudominio.com` (Oracle) |
| `VITE_USE_FOOTBALL_API` | `true` |

**No** configurar `SUPABASE_SERVICE_ROLE_KEY` en Vercel (solo backend Oracle).

## 4. Deploy automático

Cada push a `main` dispara build + deploy.

Preview deployments en PRs.

## 5. Supabase Auth redirect

En Supabase Dashboard → Authentication → URL Configuration:

- **Site URL:** `https://tu-app.vercel.app`
- **Redirect URLs:** `https://tu-app.vercel.app/**`

## 6. Verificar

- App carga sin errores de env
- Login / invite funciona
- Admin `/admin/system` muestra estado worker (requiere API Oracle online)
- Predicciones guardan en Supabase

## 7. vercel.json

El proyecto incluye `vercel.json` con SPA rewrites y cache de assets.
