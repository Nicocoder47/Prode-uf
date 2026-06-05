# PRODEMUNDIAL 2026 — Arquitectura inicial

## Objetivo
Este repositorio ahora contiene un scaffold frontend premium para ProdeMundial 2026 con:
- Navegación privada por invitación
- Dashboard de alto impacto
- Rutas enterprise: Dashboard, Partidos, Predicciones, Leaderboard, Pagos y Admin
- UI oscuro cinematográfico con glassmorphism y motion
- Estructura preparada para integración con Supabase, pagos y realtime

## Frontend

### Stack
- React 18
- Vite
- TypeScript estricto
- Tailwind CSS
- Framer Motion
- Lucide React
- TanStack Query
- Zustand (presente en package)
- React Hook Form
- Zod

### Estructura actual
- `src/App.tsx` → enrutamiento principal y layout protegido
- `src/main.tsx` → bootstrap de React Router y React Query
- `src/components/layout/AppShell.tsx` → shell visual con sidebar y header
- `src/components/ui/*` → componentes reutilizables premium
- `src/features/*` → páginas de producto lanzables

### Estado actual
- Scaffold visual completo y compilación exitosa
- Rutas privadas básicas listas para conectar auth y datos reales
- Premium dashboard con hero, leaderboard, métricas e insights

## Backend propuesta

### Supabase / PostgreSQL
Debemos implementar:
- Auth por invitación con tokens JWT y refresh tokens
- RLS estricto para cada tabla de usuario
- Lógica crítica en SQL y Edge Functions
- Webhooks de Mercado Pago y ratelimits

### Tablas centrales
- `users`
- `invitations`
- `teams`
- `players`
- `matches`
- `predictions`
- `special_predictions`
- `payments`
- `notifications`
- `token_transactions`
- `leaderboard`
- `events`
- `audit_logs`

## Realtime y automatización

### Realtime
- Supabase Realtime para leaderboard, gol en vivo, saldo y notificaciones
- Actualizaciones de match state en tiempo real
- Eventos push desde edge functions y triggers PostgreSQL

### Automatización
- `pg_cron` para sincronización de fixtures y scoring automático
- Edge Functions para scoring instantáneo tras `FT`
- GitHub Actions para despliegues y validaciones de CI

## Próximos pasos recomendados

1. Definir e implementar el esquema Supabase y RLS en `supabase_schema.sql`
2. Conectar auth de invitaciones usando `invite_code` y validación server-side
3. Construir la integración de pagos automáticos con Mercado Pago
4. Implementar scoring engine en SQL + Edge Function
5. Agregar notificaciones WhatsApp con microservicio externo
6. Extender UI con páginas ricas de predicción y resultados post-match

---

Este es el primer sprint del producto: un frontend premium con estructura empresarial y un roadmap claro hacia una plataforma privada, realtime y segura.
