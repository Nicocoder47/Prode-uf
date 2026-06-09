# ADMIN PANEL V2 — Roadmap y diseño

**Proyecto:** PRODEMUNDIAL 2026  
**Fecha:** 2026-06-09  
**Prerequisito:** [`ADMIN_PANEL_V2_AUDIT.md`](./ADMIN_PANEL_V2_AUDIT.md)  
**Modo:** Diseño y planificación — **sin implementación**

---

## 1. Visión del producto

Transformar `/admin` de una **página única con scroll por hash** en una **consola de operaciones modular**, estilo SaaS gaming, que permita a operadores internos:

- Monitorear salud del torneo y la plataforma en tiempo real.
- Gestionar usuarios y revisión de identidad con eficiencia.
- Entender comportamiento de predicciones sin tocar resultados.
- Comunicar campañas segmentadas.
- Auditar actividad y sistema en modo **solo lectura**.

**Principios de diseño:**

| Principio | Regla |
|-----------|-------|
| Compatibilidad | Cero breaking changes en RPCs existentes en Fase 1 |
| Arquitectura | React + Supabase RPC — sin Express, sin Oracle |
| Seguridad | Read-only donde no hay acción de negocio explícita |
| Performance | Lazy routes + paginación server-side |
| UX | Sidebar fija, breadcrumbs, estados loading/error unificados |

---

## 2. Arquitectura objetivo (sin cambiar stack)

```
┌─────────────────────────────────────────────────────────────┐
│  AdminShell V2 (sidebar + header + outlet)                  │
├──────────────┬──────────────────────────────────────────────┤
│  Sidebar     │  React Router nested routes                  │
│  9 módulos   │  /admin/dashboard | users | matches | ...    │
├──────────────┴──────────────────────────────────────────────┤
│  adminService V2 (React Query + RPCs existentes + nuevos)   │
├─────────────────────────────────────────────────────────────┤
│  Supabase PostgreSQL                                        │
│  • RPCs admin_* existentes                                  │
│  • RPCs admin_v2_* nuevos (read-only analytics)             │
│  • activity_logs, notifications, admin_cards, matches...    │
└─────────────────────────────────────────────────────────────┘
```

**Migración incremental:** cada fase entrega módulos en rutas nuevas; la SPA hash actual convive hasta Fase 1 complete, luego se depreca.

---

## 3. Navegación V2

### 3.1 Sidebar profesional

| Orden | Label | Ruta | Icono |
|-------|-------|------|-------|
| 1 | Dashboard | `/admin/dashboard` | LayoutDashboard |
| 2 | Usuarios | `/admin/users` | Users |
| 3 | Partidos | `/admin/matches` | Calendar |
| 4 | Predicciones | `/admin/predictions` | Target |
| 5 | Ranking | `/admin/ranking` | Trophy |
| 6 | Actividad | `/admin/activity` | Activity |
| 7 | Notificaciones | `/admin/notifications` | Bell |
| 8 | Sistema | `/admin/system` | Server |
| 9 | Cards | `/admin/cards` | CreditCard |

**Redirects de compatibilidad:**

| Legacy | Nuevo |
|--------|-------|
| `/admin` | `/admin/dashboard` |
| `/admin#users` | `/admin/users` |
| `/admin#activity` | `/admin/activity` |
| `/admin#notifications` | `/admin/notifications` |
| `/admin#cards` | `/admin/cards` |

### 3.2 Responsive

| Breakpoint | Comportamiento |
|------------|----------------|
| Desktop (≥1024px) | Sidebar fija 240px + content |
| Tablet (768–1023px) | Sidebar colapsable (icon-only) |
| Mobile (<768px) | Bottom nav 5 items principales + menú “Más” |

### 3.3 Patrones UX globales

- **Page header:** título + acciones primarias + rango de fechas (donde aplique).
- **Empty states** consistentes con copy operativo.
- **Toasts** en mutaciones (bloqueo, notif, card save).
- **Skeleton loaders** por sección (no spinner full-page).
- **Breadcrumbs:** Admin → Módulo → Detalle (ej. Usuario).

---

## 4. Diseño por módulo

### 4.1 Dashboard Ejecutivo

**Objetivo:** vista “control tower” del torneo en 10 segundos.

#### KPIs (cards superiores)

| Métrica | Fuente actual | Fuente V2 |
|---------|---------------|-----------|
| Usuarios totales | `admin_get_dashboard` | ✅ existente |
| Usuarios activos | ✅ | ✅ |
| Bloqueados | ✅ | ✅ |
| Nuevos hoy | `today_registrations` | ✅ + trend |
| Predicciones hoy | **Nuevo RPC** | `admin_v2_predictions_today` |
| Partidos próximos | `upcoming_matches` | ✅ |
| En vivo | `live_matches` | ✅ |
| Finalizados | `finished_matches` | ✅ |

#### Widgets

| Widget | Contenido |
|--------|-----------|
| Ranking top 10 | Tabla compacta (existente) |
| Registros recientes | Lista 10 (existente) |
| Actividad reciente | Stream 15 eventos (existente) |
| Cola revisión DNI | Tabla con CTA → Usuario |
| Gráfico registros | Línea 7/30 días (**nuevo**) |
| Gráfico predicciones | Barras por día (**nuevo**) |
| Variación semanal | % vs semana anterior (**nuevo**) |
| Sync status | Último sync + estado (existente parcial) |

#### Gráficos (Fase 2+)

- Librería: **Recharts** (ya común en stack React; verificar bundle).
- Datos: agregaciones SQL diarias materializadas o RPC con `date_trunc`.

**Restricción:** no editar partidos ni scoring desde dashboard.

---

### 4.2 Gestión de Usuarios

**Base:** `AdminUsersPage` + `AdminUserDetailDrawer` evolucionados.

#### Mejoras tabla

| Feature | Detalle |
|---------|---------|
| Búsqueda rápida | Debounce 300ms; server-side en V2 |
| Filtros avanzados | Revisión, cuenta, rol, predicciones, rango fechas alta |
| Paginación | 25/50/100 por página |
| Orden columnas | Puntos, predicciones, último login |
| Export CSV | Client-side Fase 1; server-side Fase 2 |
| Export Excel | Fase 2 (`xlsx` o CSV con BOM) |
| Bulk actions | Fase 3 (aprobar lote revisión) |

#### Drawer / página detalle

| Tab | Contenido |
|-----|-----------|
| Resumen | Datos + padrón + badges |
| Timeline | **Nuevo** — activity_logs del usuario ordenados |
| Predicciones | Tabla existente + % acierto |
| Notificaciones | Historial + enviar |
| Seguridad | Rol, bloqueo, delete (acciones existentes) |

#### Métricas por usuario (nuevas columnas)

| Métrica | Cálculo |
|---------|---------|
| Exactos logrados | `predictions WHERE points = 5` |
| % acierto | `(exact + result correct) / scored * 100` |
| Predicciones totales | count |
| Último login | `last_login_at` |
| Dispositivos | **Fase 4** — requiere logging ampliado |

**RPC nuevo sugerido:** `admin_v2_get_users_page(p_offset, p_limit, p_filters jsonb)`.

---

### 4.3 Centro de Partidos (nuevo)

**Objetivo:** visibilidad operativa del fixture sin editar resultados.

#### Vista principal — tabla fixture

| Columna | Fuente |
|---------|--------|
| Partido | home vs away |
| Fase / grupo | `matches.phase`, `group_label` |
| Kickoff | `kick_off` |
| Estado | scheduled / live / finished |
| Predicciones | count por match |
| % Local / Empate / Visitante | agregación `predicted_winner` |
| Marcador real | solo si finished |

#### Acciones permitidas

| Acción | Mecanismo | Fase |
|--------|-----------|------|
| Refrescar partido | Re-fetch match + prediction stats | 1 |
| Refrescar jornada | Filtro por fecha/fase | 1 |
| Ver estadísticas | Drawer con distribución barras | 2 |
| Ver predicciones | Link → Centro Predicciones filtrado | 1 |

#### Acciones prohibidas

- Editar `score_home` / `score_away`.
- Forzar scoring manual.
- Cambiar status (salvo futuro service_role script ops).

**RPC nuevo:** `admin_v2_get_matches_overview(p_phase, p_status, p_from, p_to)`.

---

### 4.4 Centro de Predicciones (nuevo)

**Objetivo:** analytics de comportamiento colectivo.

#### Vistas

| Vista | Descripción |
|-------|-------------|
| Por partido | Distribución marcadores + winner split |
| Por usuario | Top predictores activos |
| Tendencias | Predicciones/día, acierto global |
| Heatmap marcadores | Fase 3 — opcional |

#### Filtros

- Partido (select con búsqueda)
- Usuario (legajo/nombre)
- Rango fechas
- Estado partido

**RPCs nuevos:**

- `admin_v2_get_prediction_distribution(p_match_id)`
- `admin_v2_get_prediction_trends(p_from, p_to)`
- `admin_v2_get_top_predictors(p_limit)`

**Restricción:** solo lectura; no modificar predicciones ajenas (RLS ya lo impide).

---

### 4.5 Ranking Administrativo (nuevo módulo)

**Separar** ranking público (top 5 app) vs vista operativa admin.

| Feature | Detalle |
|---------|---------|
| Top 100 | Tabla paginada desde `leaderboard` period global |
| Evolución | Fase 3 — snapshot diario `leaderboard_history` |
| Ganadores históricos | Fase 4 |
| Export CSV/Excel | Fase 2 |
| Búsqueda | Por legajo/nombre |
| Comparador 2 usuarios | Fase 3 — side by side stats |

**RPC nuevo:** `admin_v2_get_leaderboard_page(p_offset, p_limit, p_search)`.

---

### 4.6 Centro de Actividad

**Base:** `AdminActivityPage` mejorado.

| Mejora | Detalle |
|--------|---------|
| Timeline visual | Iconos por tipo, agrupación por día |
| Filtros avanzados | Multi-select tipos, actor, rango |
| Paginación cursor | `created_at < cursor` |
| Export | CSV últimos N eventos |
| Live tail | Fase 3 — Supabase Realtime subscribe `activity_logs` (admin only) |

**RPC extendido:** `admin_get_activity_logs` + params `p_cursor`, `p_offset`.

---

### 4.7 Centro de Notificaciones

**Base:** `AdminNotificationsPage` mejorado.

| Feature | Fase | Detalle |
|---------|------|---------|
| Segmentación básica | 1 | all / user / role (existente) |
| Segmentación avanzada | 2 | activos, sin predicciones, bloqueados |
| Programadas | 2 | `scheduled_at` columna + cron edge |
| Expiración | 1 | ✅ parcialmente existente |
| Campañas | 3 | Agrupar notifs + métricas lectura |
| Historial + stats | 2 | read_rate por notificación |
| Preview in-app | 1 | Modal simulando campanita |

**Cambios DB Fase 2:** `notifications.scheduled_at`, `campaign_id` opcional.

**Sin breaking change Fase 1:** usar filtros client-side sobre usuarios para segmentos simples.

---

### 4.8 Centro de Sistema (nuevo — read-only)

**Reemplaza** `AdminSystemPage` Express por fuente Supabase/scripts.

| Panel | Fuente datos |
|-------|--------------|
| Supabase REST | ping `/rest/v1/` |
| Realtime | dashboard Supabase o health script |
| RPCs críticos | probe `save_prediction`, `admin_get_dashboard` exists |
| Sync GitHub Actions | `data_sync_logs` últimos 10 |
| Scoring reciente | `activity_logs` type `score_calculated` |
| Migraciones | Tabla `supabase_migrations.schema_migrations` o doc version |
| Errores sync | `sync_failed` logs |
| Worker heartbeat | `system_snapshots` si existe |

**Implementación Fase 1:** consumir reports existentes (`reports/cloud-status.json` generado por CI) + RPC probes desde frontend.

**Modo:** 100% read-only — sin botones de scoring/sync destructivos.

---

### 4.9 Gestión de Cards

**Base:** `AdminCardsPage` mejorado.

| Feature | Fase |
|---------|------|
| Editor actual (title, value, status) | ✅ existente |
| Preview en vivo | 1 — iframe/mock del strip home |
| Drag & drop orden | 2 — `order_index` via RPC batch |
| Toggle activo rápido | 1 — switch sin abrir form |
| Crear card nueva | 2 — RPC extendido o admin-only insert |

---

### 4.10 Seguridad (módulo transversal)

| Control | Acción V2 |
|---------|-----------|
| Audit accesos admin | Log `admin_panel_view` en activity_logs Fase 3 |
| Review grants RPC | Script periódico + panel Sistema |
| Demo mode alert | Banner rojo si `VITE_PUBLIC_DEMO` |
| DNI exposure | Mantener masked en listados; full solo drawer |
| Rate limit | Documentar; Supabase plan limits |
| E2E admin smoke | Fase 2 — login maestro + navegar módulos |

---

## 5. Mapa de RPCs — existentes vs nuevos

### 5.1 Reutilizar sin cambios (Fase 1)

- `admin_get_dashboard`
- `admin_get_users` (hasta paginación Fase 2)
- `admin_get_user_detail`
- `admin_soft_delete_user`, `admin_set_user_active`, `admin_set_user_role`
- `admin_approve_user`, `admin_reject_user`
- `admin_create_notification`, `admin_get_notifications`
- `admin_update_card`, `admin_get_activity_logs`

### 5.2 Nuevos RPCs sugeridos (read-only, Fase 2–3)

| RPC | Propósito |
|-----|-----------|
| `admin_v2_get_users_page` | Paginación + filtros server-side |
| `admin_v2_get_matches_overview` | Fixture + stats predicciones |
| `admin_v2_get_prediction_distribution` | Histograma por partido |
| `admin_v2_get_prediction_trends` | Series temporales |
| `admin_v2_get_leaderboard_page` | Top 100 paginado |
| `admin_v2_get_dashboard_trends` | Agregados diarios 7/30 días |
| `admin_v2_export_users` | Opcional Fase 3 — JSON paginado para CSV |

**Convención:** prefijo `admin_v2_` para no romper contratos existentes.

---

## 6. Roadmap por fases

### Leyenda

| Campo | Valores |
|-------|---------|
| Prioridad | P0 crítico · P1 alto · P2 medio · P3 bajo |
| Impacto | Alto / Medio / Bajo |
| Complejidad | S · M · L · XL |
| Riesgo | Bajo / Medio / Alto |

---

### FASE 1 — Rápida (2–3 semanas)

**Objetivo:** consola modular usable sin tocar DB schema.

| # | Entrega | Prioridad | Impacto | Complejidad | Riesgo |
|---|---------|-----------|---------|-------------|--------|
| 1.1 | Rutas React anidadas `/admin/*` + redirects legacy | P0 | Alto | M | Bajo |
| 1.2 | Lazy load por módulo (code-split) | P0 | Alto | S | Bajo |
| 1.3 | React Query en adminService | P0 | Alto | M | Bajo |
| 1.4 | Sidebar V2 + mobile bottom nav | P0 | Alto | M | Bajo |
| 1.5 | Dashboard — reorganizar KPIs existentes | P1 | Medio | S | Bajo |
| 1.6 | Usuarios — mantener funcionalidad + toasts | P1 | Medio | S | Bajo |
| 1.7 | Cards — toggle activo + preview mock | P2 | Medio | S | Bajo |
| 1.8 | Sistema — panel read-only básico (probes + sync logs) | P1 | Alto | M | Bajo |
| 1.9 | Eliminar montaje simultáneo UnifiedPage | P0 | Alto | S | Bajo |
| 1.10 | Verificar `VITE_PUBLIC_DEMO=false` en prod | P0 | Alto | S | Bajo |

**Criterio de éxito Fase 1:**

- Abrir `/admin/dashboard` carga **1 módulo**, no 5.
- Tiempo inicial < 2s en 200 usuarios.
- Zero regresiones en aprobar/bloquear/notificar.
- Redirects `/admin#users` → `/admin/users` funcionan.

**No incluye:** gráficos, export, partidos, predicciones analytics, paginación server.

---

### FASE 2 — Media (3–5 semanas)

**Objetivo:** analytics operativos + escala 500 usuarios.

| # | Entrega | Prioridad | Impacto | Complejidad | Riesgo |
|---|---------|-----------|---------|-------------|--------|
| 2.1 | RPC `admin_v2_get_users_page` + paginación UI | P0 | Alto | L | Medio |
| 2.2 | Export CSV usuarios y ranking | P1 | Alto | M | Bajo |
| 2.3 | Centro Partidos (read-only) + RPC overview | P0 | Alto | L | Bajo |
| 2.4 | Centro Predicciones básico (por partido) | P1 | Alto | L | Medio |
| 2.5 | Ranking admin top 100 paginado | P1 | Medio | M | Bajo |
| 2.6 | Dashboard gráficos 7 días (registros, predicciones) | P1 | Alto | L | Medio |
| 2.7 | Activity paginación cursor | P1 | Medio | M | Bajo |
| 2.8 | Notificaciones segmentación (activos, sin pred) | P2 | Medio | M | Bajo |
| 2.9 | User timeline tab en drawer | P1 | Medio | M | Bajo |
| 2.10 | Deprecar `AdminUnifiedPage` | P1 | Bajo | S | Bajo |

**Migración SQL Fase 2:** solo RPCs nuevos `admin_v2_*` — sin alter tables.

**Criterio de éxito Fase 2:**

- Tabla usuarios fluida con 500 filas.
- Admin ve distribución predicciones por partido.
- Export CSV < 30s.

---

### FASE 3 — Avanzada (5–8 semanas)

**Objetivo:** inteligencia operativa y campañas.

| # | Entrega | Prioridad | Impacto | Complejidad | Riesgo |
|---|---------|-----------|---------|-------------|--------|
| 3.1 | Dashboard tendencias semanales/mensuales | P1 | Alto | L | Medio |
| 3.2 | Notificaciones programadas (`scheduled_at`) | P2 | Medio | L | Medio |
| 3.3 | Campañas notificaciones + read rate | P2 | Medio | L | Medio |
| 3.4 | Ranking evolución (snapshots diarios) | P2 | Medio | XL | Medio |
| 3.5 | Comparador usuarios | P3 | Medio | M | Bajo |
| 3.6 | Activity Realtime tail | P2 | Medio | M | Medio |
| 3.7 | Cards drag & drop orden | P2 | Bajo | M | Bajo |
| 3.8 | Bulk approve revisión DNI | P2 | Medio | L | Alto |
| 3.9 | Export Excel | P3 | Bajo | M | Bajo |
| 3.10 | Limpiar código huérfano Express admin | P1 | Medio | M | Bajo |

**Migración SQL Fase 3:** `leaderboard_daily_snapshots`, `notifications.scheduled_at`, optional `campaigns` table.

---

### FASE 4 — Enterprise (8+ semanas)

**Objetivo:** observabilidad, compliance, escala 1000+ usuarios.

| # | Entrega | Prioridad | Impacto | Complejidad | Riesgo |
|---|---------|-----------|---------|-------------|--------|
| 4.1 | Audit log accesos admin (quién vio qué PII) | P1 | Alto | L | Medio |
| 4.2 | RBAC granular (operador vs super-admin) | P2 | Alto | XL | Alto |
| 4.3 | Dispositivos / sesiones activas | P3 | Medio | XL | Alto |
| 4.4 | Alertas automáticas (sync fail, spike registros) | P1 | Alto | L | Medio |
| 4.5 | Dashboard SLA uptime | P2 | Medio | L | Medio |
| 4.6 | API webhooks admin events | P3 | Bajo | XL | Medio |
| 4.7 | Multi-periodo ranking (por fase grupos) | P2 | Medio | L | Medio |
| 4.8 | Heatmap predicciones | P3 | Bajo | L | Bajo |

---

## 7. Matriz impacto vs esfuerzo (priorización visual)

```
Impacto Alto │ 1.1 Rutas      2.3 Partidos    3.1 Trends
             │ 1.3 React Query 2.1 Paginación  4.1 Audit PII
             │ 1.9 Lazy mount  2.4 Predictions
─────────────┼────────────────────────────────────────────
Impacto Medio│ 1.8 Sistema    2.6 Gráficos     3.3 Campañas
             │ 2.2 Export CSV  2.7 Activity+    3.10 Cleanup
─────────────┼────────────────────────────────────────────
Impacto Bajo │ 1.7 Cards preview              4.8 Heatmap
             └────────────────────────────────────────────→
                  Esfuerzo S/M              Esfuerzo L/XL
```

**Quick wins recomendados (primera sprint):** 1.1, 1.2, 1.3, 1.9, 1.10.

---

## 8. Riesgos del roadmap

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Regresión acciones usuario (bloqueo/aprobación) | Media | Alto | E2E admin + staging |
| RPC nuevos rompen prod | Baja | Alto | Prefijo v2; deploy migración antes frontend |
| Bundle admin muy grande | Media | Medio | Lazy routes + Recharts tree-shake |
| Scope creep enterprise Fase 4 | Alta | Medio | Gate por métricas Fase 2 |
| Datos fantasma leaderboard | Media | Bajo | Reset pre-launch documentado |
| Reactivar paneles Express por error | Baja | Alto | Eliminar en Fase 3; docs claros |

---

## 9. Métricas de éxito post-V2

| KPI | Baseline hoy | Target Fase 2 |
|-----|--------------|---------------|
| Time to interactive `/admin` | ~4–6s (5 fetches) | < 2s |
| Clicks para aprobar usuario | 3+ | 2 |
| Usuarios listables sin lag | ~200 | 500+ |
| Módulos con export | 0 | 2 (users, ranking) |
| Cobertura operativa fixture | 0% | 100% read-only |
| Incidentes admin en prod | — | 0 regresiones |

---

## 10. Decisiones explícitas (out of scope)

Para proteger producción, **no se incluye en ninguna fase** sin aprobación explícita:

- Edición manual de resultados de partidos desde admin.
- Scoring / rescore manual desde UI.
- Eliminación física de usuarios o predicciones.
- Migración a Express u otro backend admin.
- Eliminación del flujo revisión DNI/padrón.
- Exposición de email/DNI completo en ranking público.

---

## 11. Próximo paso recomendado

1. **Aprobar Fase 1** scope con stakeholders (operaciones + IT).
2. Crear branch `feature/admin-v2-phase-1` — sin tocar RPCs.
3. Implementar rutas + lazy + React Query manteniendo componentes actuales.
4. QA con cuenta maestro en staging Supabase.
5. Deploy Vercel tras E2E admin smoke.

---

## 12. Referencias

| Documento | Contenido |
|-----------|-----------|
| [`ADMIN_PANEL_V2_AUDIT.md`](./ADMIN_PANEL_V2_AUDIT.md) | Estado actual detallado |
| [`FINAL_PRELAUNCH_REPORT.md`](./FINAL_PRELAUNCH_REPORT.md) | Seguridad prod |
| [`supabase-auth.md`](./supabase-auth.md) | Login admin |
| Migración `20240115000000_admin_panel_supabase.sql` | RPCs base |
| Migración `20240117000000_production_zero_cost_hardening.sql` | Hardening admin |

---

*Roadmap vivo — actualizar al cerrar cada fase. No se implementó código en este entregable.*
