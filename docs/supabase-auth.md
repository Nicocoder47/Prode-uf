# PRODEMUNDIAL 2026 — Auth email + DNI (sin códigos)

Proyecto: **Prode uf** · ref `irklqwsnehlfcgehvscm`  
Frontend: **https://prodemundialprode.vercel.app**

## Flujo de acceso

1. Usuario va a `/login` → **Registrarme**
2. Completa nombre, DNI, legajo y email → el **DNI queda como contraseña**
3. Supabase envía **email de confirmación** (link)
4. Usuario confirma el mail → **Iniciar sesión** con email + DNI
5. RPC `sync_user_profile` guarda perfil con DNI y legajo vinculados

## Supabase Dashboard — obligatorio

### Authentication → URL Configuration

| Campo | Valor |
|-------|-------|
| **Site URL** | `https://prodemundialprode.vercel.app` |
| **Redirect URLs** | `https://prodemundialprode.vercel.app/**` |
| | `http://localhost:5174/**` (dev) |

### Authentication → Providers → Email

- Habilitar **Email**
- Habilitar **Email + Password**
- **Activar "Confirm email"** (evita registros falsos con emails inventados)
- Site URL y Redirect URLs apuntando a `https://prodemundialprode.vercel.app/login`

### Authentication → Email Templates → Confirm signup

Usar link de confirmación (plantilla `supabase/templates/confirmation.html`):

```html
<a href="{{ .ConfirmationURL }}">Confirmar mi email</a>
```

Tras confirmar, el usuario entra con **email + DNI** (sin códigos OTP).

### Reiniciar usuarios (cuando cambiás de OTP a DNI)

```bash
npm run reset:auth
```

Borra usuarios auth, perfiles y predicciones. Todos se registran de nuevo.

## Variables Vercel (producción $0)

```
VITE_SUPABASE_URL=https://irklqwsnehlfcgehvscm.supabase.co
VITE_SUPABASE_ANON_KEY=<anon>
VITE_USE_FOOTBALL_API=false
VITE_PUBLIC_DEMO=false
```

## Errores comunes

| Mensaje | Causa |
|---------|--------|
| Email o DNI incorrectos | Datos mal ingresados |
| Confirmá tu email primero | Falta abrir el link del mail de registro |
| Ese email ya está registrado | Usar Iniciar sesión |
| `validate_registration` not found | Migración SQL no aplicada |

## Riesgo: DNI como contraseña

Por decisión funcional actual, el **DNI es la contraseña** del usuario.

| Aspecto | Detalle |
|---------|---------|
| Riesgo | DNI es dato semi-público; reutilización en otros sitios |
| Mitigación actual | Validación 7–8 dígitos, email confirmado, DNI enmascarado en admin |
| Panel admin | Solo muestra DNI enmascarado (`****1234`) salvo padrón parcial |
| Futuro | Migrar a contraseña elegida + opcional 2FA |

No compartir pantallas de admin en público ni registrar usuarios sin confirmar email.
