# PRODEMUNDIAL 2026 — Auth por email OTP (sin contraseña)

Proyecto: **Prode uf** · ref `irklqwsnehlfcgehvscm`  
Frontend: **https://prodemundialprode.vercel.app**

## Flujo de acceso

1. Usuario va a `/login`
2. Completa: **nombre completo**, **dominio/patente**, **email**
3. Supabase envía **código OTP** al email (6 dígitos)
4. Usuario ingresa el código → sesión creada
5. RPC `sync_user_profile` guarda perfil con patente vinculada

## Supabase Dashboard — obligatorio

### Authentication → Providers → Email

- Habilitar **Email**
- Habilitar **Confirm email** (recomendado)
- Tipo: **OTP** (magic link opcional como fallback; redirect `/login`)

### Authentication → URL Configuration

| Campo | Valor |
|-------|-------|
| **Site URL** | `https://prodemundialprode.vercel.app` |
| **Redirect URLs** | `https://prodemundialprode.vercel.app/**` |
| | `http://localhost:5174/**` (dev) |

### SQL — aplicar migración

```bash
supabase db push
# o ejecutar supabase/migrations/20240112000000_access_login_profile.sql
```

Funciones creadas:

- `validate_registration(email, domain_plate)` — anon
- `sync_user_profile(full_name, domain_plate, email)` — authenticated
- Columna `profiles.domain_plate` (única normalizada)

## Variables Vercel (producción $0)

```
VITE_SUPABASE_URL=https://irklqwsnehlfcgehvscm.supabase.co
VITE_SUPABASE_ANON_KEY=<anon>
VITE_USE_FOOTBALL_API=false
VITE_PUBLIC_DEMO=false
```

**No** configurar `VITE_API_BASE_URL` en producción $0.

**Nunca** en Vercel: `SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_DATA_API_KEY`

## GitHub Actions (sync — no Vercel)

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
FOOTBALL_DATA_API_KEY=...
```

Ver [production-zero-cost.md](./production-zero-cost.md).

## Reglas de negocio

- Un **email** → un usuario auth (Supabase Auth)
- Un **dominio/patente** → un solo perfil (índice único normalizado)
- Mismo email puede actualizar nombre/patente al reingresar
- Predicciones usan `auth.users.id` = `profiles.id` = `predictions.user_id`

## Probar local

1. `npm run dev` + `.env.local` con Supabase cloud
2. Abrir http://localhost:5174/login
3. Completar formulario → revisar email → ingresar código
4. Verificar perfil en Supabase → Table Editor → `profiles`

## Errores comunes

| Mensaje | Causa |
|---------|--------|
| Código incorrecto o vencido | OTP expirado (~60 min) o typo |
| Patente ya registrada | Otro usuario tiene esa patente |
| Email rate limit | Demasiados envíos; esperar |
| `validate_registration` not found | Migración SQL no aplicada |
