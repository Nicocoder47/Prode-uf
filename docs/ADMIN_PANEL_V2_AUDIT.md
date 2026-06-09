# ADMIN PANEL V2 — Auditoría completa

**Proyecto:** PRODEMUNDIAL 2026  
**Fecha:** 2026-06-09  
**Alcance:** Panel admin en producción (Supabase-only)  
**Modo:** Solo lectura — sin implementación  
**URL prod:** https://prodemundialprode.vercel.app/admin

---

## 1. Resumen ejecutivo

El panel admin actual es **funcional y seguro** para operaciones core (usuarios, revisión DNI, notificaciones, cards, activity logs), pero está construido como **SPA monolítica por hash** con **5 secciones montadas en paralelo**, sin paginación server-side, y con **~11 componentes huérfanos** de una era Express/Oracle no cableados en rutas.

| Dimensión | Calificación | Comentario |
|-----------|--------------|------------|
| Funcionalidad core | **7/10** | Usuarios + revisión + notificaciones operativos |
| UX / navegación | **5/10** | Hash scroll, sin rutas reales, carga todo junto |
| Rendimiento | **4/10** | 5–6 fetches al abrir; listas completas sin paginar |
| Seguridad | **8/10** | RLS + `is_admin()` sólido post-migr. 170/200 |
| Observabilidad | **3/10** | System health existe en código pero sin ruta |
| Consistencia diseño | **5/10** | Dos design systems (Premium vs wc26-card) |
| Extensibilidad | **6/10** | RPCs bien modelados; falta capa de analytics |

**Veredicto:** Base sólida para evolucionar a consola SaaS **sin cambiar arquitectura** (React + Supabase RPC). El riesgo principal no es seguridad sino **escala UX/rendimiento** y **deuda de código huérfano**.

---

## 2. Arquitectura de rutas

### 2.1 Rutas activas (`App.tsx`)

```
/login                          → LoginPage
/admin                          → AdminRoute → AdminShell → AdminUnifiedPage
/admin/users                    → Navigate → /admin#users
/admin/activity                 → Navigate → /admin#activity
/admin/notifications            → Navigate → /admin#notifications
/admin/cards                    → Navigate → /admin#cards
```

**Modelo:** una sola página React con anclas `#dashboard`, `#users`, `#activity`, `#notifications`, `#cards`.  
`AdminShell` usa `scrollIntoView` + `history.replaceState` — **no hay code-splitting por módulo**.

### 2.2 Guard de acceso (`AdminRoute.tsx`)

| Condición | Comportamiento |
|-----------|----------------|
| `VITE_PUBLIC_DEMO=true` | **Bypass total** — cualquier usuario accede a `/admin` |
| Sin sesión | Redirect `/login` |
| `profile.role !== 'admin'` | `AdminAccessDeniedPage` |
| Admin OK | Render `<Outlet />` |

**Riesgo producción:** si `VITE_PUBLIC_DEMO` se activa por error en Vercel, el panel queda expuesto.

### 2.3 Rutas inexistentes (enlaces rotos en código legacy)

| Ruta referenciada | Componente | Backend |
|-------------------|------------|---------|
| `/admin/system` | `AdminSystemPage` | Express `/api/admin/system/health` |
| `/admin/data-quality` | `AdminDataQualityPage` | Express múltiples endpoints |
| `/admin/knockout` | `AdminKnockoutPage` | Express knockout audit/sync |
| — | `AdminPageNew` | Hub con KPIs mock + sync buttons |

En producción $0 (sin `VITE_API_BASE_URL`), `adminFetch()` **lanza error** — estos paneles no funcionan.

---

## 3. Inventario de páginas y componentes

### 3.1 Conectados a producción (activos)

| Componente | Sección | Responsabilidad |
|------------|---------|-----------------|
| `AdminUnifiedPage` | Contenedor | Monta 5 secciones + banner fallback |
| `AdminDashboardPage` | `#dashboard` | KPIs, review queue, top 10, registros/logins |
| `AdminUsersPage` | `#users` | Tabla usuarios + filtros client-side |
| `AdminUserDetailDrawer` | Drawer | Detalle, acciones, tabs pred/activity/notif |
| `AdminActivityPage` | `#activity` | Logs filtrados (max 200) |
| `AdminNotificationsPage` | `#notifications` | Crear + listar notificaciones |
| `AdminCardsPage` | `#cards` | Editar cards del home |
| `AdminShell` | Layout | Header, sidebar hash, responsive chips |
| `AdminAccessDeniedPage` | Guard | Acceso denegado |

### 3.2 Huérfanos (sin ruta)

| Componente | Dependencia | Estado |
|------------|-------------|--------|
| `AdminSystemPage` | Express health API | No accesible |
| `AdminDataQualityPage` | Express enrich/linking | No accesible |
| `AdminKnockoutPage` | Express knockout | No accesible |
| `PredictionsAuditPanel` | Express predictions audit/score | No accesible |
| `AdminPlatformKpis` | Express audit | No accesible |
| `CountryLinkingPanel` | Express | No accesible |
| `PlayerLinkingPanel` | Express | No accesible |
| `TeamCoveragePanel` | Express | No accesible |
| `AdminPageNew` | Mix mock + Express | No accesible |
| `AdminLayout` | Layout legacy NavLink | Reemplazado por AdminShell |
| `AdminPage` | Stub placeholder | Obsoleto |

---

## 4. Servicios y hooks

### 4.1 Capa de datos (`adminService.ts`)

**Patrón:** RPC Supabase primero → fallback directo a tablas si RPC missing (`PGRST202`).

| Función | RPC | Fallback | Usado en |
|---------|-----|----------|----------|
| `fetchAdminDashboard` | `admin_get_dashboard` | ✅ Pesado | Dashboard |
| `fetchAdminUsers` | `admin_get_users` | ✅ Muy pesado | Users, Notifications |
| `fetchAdminUserDetail` | `admin_get_user_detail` | ❌ Error migr. 170 | Drawer |
| `fetchAdminActivityLogs` | `admin_get_activity_logs` | ✅ `[]` | Activity |
| `fetchAdminNotifications` | `admin_get_notifications` | ✅ `[]` | Notifications |
| `fetchActiveAdminCards` | `get_active_admin_cards` | ✅ `[]` | Cards + home público |
| `adminSoftDeleteUser` | `admin_soft_delete_user` | ✅ | Drawer |
| `adminSetUserActive` | `admin_set_user_active` | ✅ | Drawer |
| `adminSetUserRole` | `admin_set_user_role` | ✅ | Drawer |
| `adminApproveUser` | `admin_approve_user` | ✅ | Drawer |
| `adminRejectUser` | `admin_reject_user` | ✅ | Drawer |
| `adminCreateNotification` | `admin_create_notification` | ❌ | Notifications, Drawer |
| `adminUpdateCard` | `admin_update_card` | ❌ | Cards |

**Hooks React Query:** el panel admin **no usa React Query** — cada página usa `useState` + `useEffect` manual. Contrasta con el resto de la app (`useLeaderboard`, etc.).

### 4.2 Consumidores fuera del panel

| Módulo | Servicio |
|--------|----------|
| `NotificationBell`, `NotificationsPage` | `fetchMyNotifications`, `markNotificationRead` |
| `AdminCardsStrip` (home) | `fetchActiveAdminCards` |
| `lib/auth.tsx` | `logUserLogin` |

---

## 5. RPCs y tablas Supabase

### 5.1 RPCs admin (12)

| RPC | Propósito |
|-----|-----------|
| `admin_get_dashboard` | KPIs agregados + colas + ranking top 10 |
| `admin_get_users` | Lista usuarios con stats predicciones |
| `admin_get_user_detail` | Detalle + padrón + predicciones + activity + notifs |
| `admin_soft_delete_user` | Eliminación lógica |
| `admin_set_user_active` | Bloqueo/desbloqueo |
| `admin_set_user_role` | Promover/degradar admin |
| `admin_approve_user` | Aprobación manual revisión DNI |
| `admin_reject_user` | Rechazo revisión |
| `admin_create_notification` | Notificación all/user/role |
| `admin_get_notifications` | Historial admin |
| `admin_update_card` | Upsert card home |
| `admin_get_activity_logs` | Logs filtrados (max 500 en RPC) |

**Autorización:** `GRANT EXECUTE TO authenticated` + check runtime `is_admin()` → `forbidden` si no admin.

### 5.2 Tablas con RLS admin

| Tabla | Acceso admin | Acceso usuario |
|-------|--------------|----------------|
| `profiles` | vía RPCs | self update restringido |
| `activity_logs` | SELECT all | SELECT own |
| `notifications` | ALL | vía `get_my_notifications` |
| `notification_reads` | SELECT | ALL own |
| `admin_cards` | ALL | SELECT active vía RPC |
| `member_reference` | ALL | ninguno directo |
| `allowed_members` | ALL | legacy, sin uso post-170 |
| `predictions` | DELETE admin; write vía RPC usuario | read own |
| `leaderboard` | write admin | read all |
| `matches` | vía service_role sync | read all |

### 5.3 Función `is_admin()`

```sql
EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
```

Escalada por código `0047` **desactivada** en migración 170.

---

## 6. Auditoría UX

### 6.1 Fortalezas

- Tema oscuro coherente con identidad gaming (`admin-shell`, amber/gold).
- Drawer de usuario rico: padrón vs declarado, acciones en un lugar.
- Badges de revisión DNI claros (`verified`, `review_required`, etc.).
- Banner explícito cuando RPCs faltan (modo fallback).
- Responsive: chips horizontales en mobile, sidebar en desktop.
- Flujo revisión DNI alineado con negocio (padrón Excel).

### 6.2 Debilidades

| Problema | Impacto |
|----------|---------|
| Navegación por hash sin URL de módulo | No compartible, no bookmarkable, back button confuso |
| 5 secciones montadas al cargar `/admin` | Latencia inicial alta |
| Tabla usuarios `min-w-[1400px]` | Scroll horizontal incómodo en tablet |
| Sin paginación ni virtualización | Colapsa con 200+ usuarios |
| Sin feedback toast en acciones | Admin no sabe si bloqueo/notif OK sin mirar drawer |
| Sin export CSV/Excel | Operaciones manuales imposibles |
| Dashboard sin gráficos ni tendencias | No hay visión ejecutiva |
| Aprobar desde dashboard imposible | Hay que ir al drawer |
| Cards: solo editar, no crear/desactivar rápido | Limitado para campañas |
| Notificaciones: sin programación ni segmentación avanzada | Broadcast básico |
| Ranking admin top 10 vs app top 5 | Inconsistencia producto |
| Dos design systems en codebase | Confusión si se reactivan paneles Express |

### 6.3 Flujos críticos evaluados

| Flujo | Estado | Fricción |
|-------|--------|----------|
| Revisar usuario con DNI inválido | ✅ | 3+ clicks (users → detalle → aprobar) |
| Bloquear usuario | ✅ | Drawer → bloquear |
| Notificar a todos | ✅ | Formulario simple |
| Ver quién predijo qué | ⚠️ | Solo en drawer por usuario |
| Ver distribución por partido | ❌ | No existe |
| Ver salud del sistema | ❌ | Código huérfano Express |
| Exportar ranking | ❌ | No existe |

---

## 7. Auditoría de rendimiento

### 7.1 Carga inicial `/admin`

Al montar `AdminUnifiedPage` se disparan **en paralelo**:

1. `fetchAdminDashboard()`
2. `fetchAdminUsers()` (Users)
3. `fetchAdminUsers()` (Notifications — duplicado)
4. `fetchAdminActivityLogs()` (limit 200)
5. `fetchAdminNotifications()`
6. `fetchActiveAdminCards()`

**Estimación:** 5–6 round-trips Supabase antes de que el admin vea una sección usable.

### 7.2 Patrones costosos

| Patrón | Ubicación | Riesgo |
|--------|-----------|--------|
| Lista completa usuarios | `admin_get_users` / fallback full scan | O(n) usuarios |
| Todas las predictions en fallback | `adminServiceFallback.fetchAdminUsers` | O(n) predicciones |
| Activity sin cursor | max 200 fijo | Pérdida de historial |
| User detail sin límite predicciones | `admin_get_user_detail` | Usuario power-user |
| Sin lazy mount por sección | UnifiedPage | CPU + red desperdiciada |
| Sin React Query cache | Todas las páginas | Re-fetch al cambiar hash |

### 7.3 Escalabilidad proyectada

| Usuarios | Predicciones | Comportamiento esperado hoy |
|----------|--------------|----------------------------|
| ~200 (MVP) | ~5k | Aceptable con RPC |
| 500+ | 25k+ | Tabla usuarios lenta; fallback inviable |
| 1000+ | 50k+ | Requiere paginación server-side obligatoria |

---

## 8. Auditoría de seguridad

### 8.1 Fortalezas (post migr. 170/200)

- Admin gate en frontend (`AdminRoute`) + backend (`is_admin()` en RPCs).
- DNI enmascarado en listados (`admin_get_users` post-170).
- Usuario no puede auto-promoverse admin (170).
- Scoring no invocable desde cliente authenticated (200).
- `validate_member_legajo` revocado de anon (200).
- Soft delete preserva auditoría en `activity_logs`.
- Admin no puede soft-deletearse a sí mismo.
- PII ranking público vía vista `public_leaderboard_profiles` (fuera del panel).

### 8.2 Riesgos identificados

| ID | Severidad | Riesgo | Mitigación V2 |
|----|-----------|--------|---------------|
| S1 | Media | `VITE_PUBLIC_DEMO` bypass admin | Verificar env Vercel; guard doble en RPC (ya existe) |
| S2 | Baja | Grants amplios `authenticated` en RPCs admin | Aceptable; barrera runtime |
| S3 | Baja | `admin_get_user_detail` expone padrón DNI completo a admin | Documentar; audit log de accesos (V2) |
| S4 | Baja | `activity_logs_self` — usuario ve sus logs | OK por diseño |
| S5 | Info | Puntos fantasma en leaderboard (E2E prod) | Reset pre-launch + E2E aislado |
| S6 | Media | Paneles Express con scoring manual si se reactivan sin guard | Solo read-only en V2 Sistema |
| S7 | Baja | Sin rate limit en RPCs admin | Supabase default; monitorear |

### 8.3 Permisos por acción admin

| Acción | Frontend | Backend | Usuario final afectado |
|--------|----------|---------|----------------------|
| Aprobar/rechazar | Drawer | `admin_approve/reject_user` | Pierde/gana acceso predicciones |
| Bloquear | Drawer | `admin_set_user_active` | RLS bloquea predicciones |
| Eliminar lógico | Drawer | `admin_soft_delete_user` | Cuenta invisible |
| Promover admin | Drawer | `admin_set_user_role` | Acceso total panel |
| Notificar | Form | `admin_create_notification` | In-app notification |
| Editar card | Form | `admin_update_card` | Visible en home todos |

**No permitido (correcto):** editar resultados de partidos, scoring manual desde UI prod, ver email/DNI completo en ranking público.

---

## 9. Gaps vs objetivo “consola SaaS”

| Módulo deseado V2 | Estado actual | Gap |
|-------------------|---------------|-----|
| Dashboard ejecutivo + gráficos | KPIs planos | Alto |
| Usuarios + export + timeline | Tabla + drawer | Medio |
| Centro de partidos | No existe | Alto |
| Centro de predicciones | Solo drawer por user | Alto |
| Ranking admin top 100 | Top 10 en dashboard | Medio |
| Actividad timeline global | Lista filtrada 200 | Medio |
| Notificaciones segmentadas | all/user/role | Medio |
| Centro de sistema read-only | Código Express huérfano | Alto |
| Cards con preview/dnd | Editor básico | Medio |
| Seguridad audit dashboard | Manual | Medio |

---

## 10. Deuda técnica priorizada

| # | Item | Tipo | Prioridad |
|---|------|------|-----------|
| D1 | Montaje simultáneo 5 secciones | Perf | P0 |
| D2 | Sin paginación usuarios/activity | Perf | P0 |
| D3 | Doble fetch `fetchAdminUsers` | Perf | P1 |
| D4 | 11 componentes huérfanos | Mantenimiento | P1 |
| D5 | Hash nav vs rutas React | UX | P1 |
| D6 | Sin React Query en admin | DX/Perf | P2 |
| D7 | Fallback dashboard/users pesado | Resiliencia | P2 |
| D8 | Inconsistencia top 5 vs top 10 ranking | Producto | P2 |
| D9 | Sin export datos | Ops | P2 |
| D10 | AdminSystemPage depende Express | Arquitectura | P1 |

---

## 11. Conclusión de auditoría

El panel admin **cumple el MVP operativo** para un prode interno de ~200 usuarios: gestión de identidad, moderación, comunicación y cards. **No está listo** como consola SaaS de nivel enterprise sin:

1. **Modularización de rutas** y lazy loading por sección.
2. **Paginación y agregaciones server-side** para usuarios, predicciones y activity.
3. **Nuevos RPCs read-only** para partidos, distribución de predicciones y sistema.
4. **Consolidación o eliminación** del código Express huérfano.
5. **Capa analytics** (tendencias diarias/semanales) en dashboard.

La arquitectura Supabase-only **no necesita cambiar** — la evolución es incremental sobre RPCs + React, compatible con producción actual.

---

*Documento generado en modo auditoría. No se modificó código ni configuración.*
