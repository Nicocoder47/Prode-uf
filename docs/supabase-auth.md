# PRODEMUNDIAL 2026 — Auth por email OTP (sin contraseña)

Proyecto: **Prode uf** · ref `irklqwsnehlfcgehvscm`  
Frontend: **https://prodemundialprode.vercel.app**

## Flujo de acceso

1. Usuario va a `/login`
2. Completa: **nombre completo**, **DNI**, **legajo** y **email**
3. Supabase envía **código OTP** al email (6 dígitos)
4. Usuario ingresa el código → sesión creada
5. RPC `sync_user_profile` guarda perfil con DNI y legajo vinculados

## Supabase Dashboard — obligatorio (OTP de 6 dígitos)

Sin esto el email manda un **link roto** en lugar del código.

### 1. Authentication → URL Configuration

| Campo | Valor |
|-------|-------|
| **Site URL** | `https://prodemundialprode.vercel.app` |
| **Redirect URLs** | `https://prodemundialprode.vercel.app/**` |
| | `http://localhost:5174/**` (dev) |

### 2. Authentication → Providers → Email

- Habilitar **Email**
- **Desactivar "Confirm email"** (recomendado para flujo OTP simple)
- OTP length: **6**

### 3. Authentication → Email Templates

Editar **Magic Link** y **Confirm signup**. Reemplazar el link por el código:

```html
<h2>Tu código para entrar al Prode</h2>
<p>Ingresá este código de 6 dígitos en la app:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:0.2em;">{{ .Token }}</p>
```

**No usar** `{{ .ConfirmationURL }}` — eso manda un link en vez del código.

Plantillas de referencia en el repo:

- `supabase/templates/magic_link.html`
- `supabase/templates/confirmation.html`

### 4. SQL — aplicar migración

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

## Código universal admin

Ingreso con rol **admin** (acceso a `/admin`):

1. Completar nombre, patente y email en `/login`
2. Tocar **Recibir código de ingreso** (puede ignorarse el email si usás el código admin)
3. Ingresar **`0047`** como código → sesión admin sin OTP de email

Requisitos en Supabase:

```bash
supabase db push
supabase functions deploy universal-admin-login --project-ref irklqwsnehlfcgehvscm
```

Opcional: secret `UNIVERSAL_ADMIN_CODE` en Edge Function (default `0047`).

**Seguridad:** el código se valida en la Edge Function; no compartirlo públicamente.

## Errores comunes

| Mensaje | Causa |
|---------|--------|
| Código incorrecto o vencido | OTP expirado (~60 min) o typo |
| Patente ya registrada | Otro usuario tiene esa patente |
| Email rate limit | Demasiados envíos; esperar |
| `validate_registration` not found | Migración SQL no aplicada |
