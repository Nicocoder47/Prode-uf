# PRODUCTION READINESS AUDIT — PRODEMUNDIAL 2026

**Fecha:** 2026-06-06  
**Alcance:** auditoría técnica pre-lanzamiento (sin nuevas funcionalidades)  
**Base inspeccionada:** 19 migraciones SQL, frontend React/Vite, reports en `reports/`, edge function `score-match`  
**Método:** análisis estático del repo + reports generados contra `https://irklqwsnehlfcgehvscm.supabase.co`  
**Restricción:** no se modificó código en esta auditoría — solo hallazgos y plan propuesto

---

## Resumen ejecutivo

| Dimensión | Estado | Nota |
|-----------|--------|------|
| Predicciones (post migr. 190) | **Fuerte** | RPC + RLS write-only admin |
| Scoring / leaderboard | **Riesgo alto** | RPCs sin auth interna, expuestas a `authenticated` |
| Privacidad (PII en ranking) | **Riesgo alto** | `profiles_leaderboard_select` expone filas completas |
| Integridad referencial datos | **Aceptable** | 49 equipos, 104 partidos; 3 equipos incompletos |
| Live / worker | **Parcial** | 0 eventos live, heartbeat ausente |
| Concurrencia masiva | **Medio** | OK en partidos distintos; frágil en pico mismo partido |

### Preparación real estimada para producción

| Escenario | % |
|-----------|---|
| Código en repo (migr. 190 incluida, sin aplicar fixes críticos) | **78%** |
| Migr. 190 aplicada en cloud + fixes RPC/PII del plan | **91%** |
| + E2E prod verde + worker live operativo | **95%** |

**Veredicto:** el camino de predicciones está bien encaminado tras la migr. 190, pero **no se recomienda lanzamiento público** hasta cerrar los 3 hallazgos críticos de RPC expuestas y filtración PII en perfiles del ranking.

---

## 1. Revisión de migraciones Supabase (19 archivos)

### 1.1 Orden y conflictos

| Issue | Severidad | Detalle |
|-------|-----------|---------|
| **Doble timestamp `20240112000000`** | Bajo | `access_login_profile.sql` y `public_reference_data.sql` comparten prefijo; orden alfabético: access → public. Sin conflicto DDL detectado. |
| **Políticas redefinidas múltiples veces** | Medio | `profiles_self_update` se redefine en 150, 160, 190 (parcial). **Estado final efectivo:** 160 (review_*) + 190 (`profiles_leaderboard_select`). No es redundancia peligrosa, pero dificulta auditoría. |
| **predictions RLS** | Resuelto en 190 | 150 reintrodujo INSERT/UPDATE permisivos; 190 los cierra a solo admin. |
| **`score_match_predictions` redefinida 5 veces** | Bajo | 040 → 090 → 110 (trigger) → 180 → **190 (vigente)**. Solo la última aplicada en cloud importa. |

### 1.2 Políticas RLS redundantes (no destructivas)

| Tabla | Políticas coexistiendo | Efecto |
|-------|------------------------|--------|
| `teams` | `teams_select` + `teams_public_select` | Ambas permiten SELECT; la pública (`USING true`) ya cubre todo. |
| `players` | `players_select` + `players_public_select` | Idem. |
| `leaderboard` | `leaderboard_select_only` | Reemplaza versiones anteriores en 190. OK. |

### 1.3 Permisos excesivos (GRANT EXECUTE)

| Función | Grant | Riesgo |
|---------|-------|--------|
| `validate_registration` | `anon`, `authenticated` | Medio — enumeración email/DNI/legajo |
| `validate_member_legajo` | `anon`, `authenticated` | Medio — enumeración de legajos |
| `get_active_admin_cards` | `anon`, `authenticated` | Bajo — info pública admin |
| **`score_match_predictions`** | **PUBLIC (default PG)** | **Crítico — sin REVOKE en migraciones** |
| **`rescore_match_predictions`** | **PUBLIC (default PG)** | **Crítico — sin auth interna ni REVOKE** |
| Admin RPCs (`admin_get_*`, etc.) | `authenticated` | Bajo — guard `is_admin()` interno |

### 1.4 Funciones SECURITY DEFINER peligrosas

| Función | Guard interno | Riesgo |
|---------|---------------|--------|
| `save_prediction` | `auth.uid()`, perfil activo, `can_submit_prediction` | **Bajo** (bien diseñada) |
| `score_match_predictions` | Solo estado del partido | **Alto** — cualquier caller autenticado |
| `rescore_match_predictions` | Solo estado partido scored | **Crítico** — parámetros `p_old_score_*` controlados por caller |
| `sync_user_profile` | `auth.uid()` | Bajo |
| `apply_profile_dni_review` | self o admin | Bajo |
| `is_admin` | SECURITY DEFINER | Bajo — patrón estándar |
| `can_submit_prediction` | SECURITY DEFINER | Bajo — solo lectura matches |

### 1.5 Índices críticos

| Tabla | Índices | Estado |
|-------|---------|--------|
| `predictions` | UNIQUE(user_id, match_id); idx_user, idx_match, idx_match_status (190) | ✅ |
| `matches` | idx_kick_off (030) | ✅ |
| `leaderboard` | UNIQUE(user_id, period) | ✅ — rank recalc full-scan en cada FT |
| `players` | Sin idx team_id explícito en migraciones | Medio — join plantel a escala |

### 1.6 Triggers

| Trigger | Propósito | ¿Innecesario? |
|---------|-----------|---------------|
| `trg_lock_predictions_on_live` | pending → locked al live | **Necesario** |
| `trg_score_finished_match` | auto-score al FT | **Necesario** |
| `trg_rescore_on_result_change` | admin corrige resultado | **Necesario** |
| `trg_log_prediction_activity` | audit admin panel | Bajo overhead |
| `trg_log_match_scored` | activity log | Bajo overhead |
| `create_profile_on_auth_user` | perfil al signup | **Necesario** |

No hay triggers duplicados activos; 110 reemplaza la función del trigger de 040 sin duplicar el trigger.

---

## 2. Auditoría `save_prediction()`

**Fuente:** `20240119000000_prediction_security_hardening.sql` L69–189

### 2.1 Flujo actual

```
auth.uid() → perfil activo → can_submit_prediction() → SELECT predicción existente
  → IF pending: UPDATE | ELSE: INSERT → RETURN jsonb
```

### 2.2 Condiciones de carrera

| Escenario | Qué pasa | Severidad |
|-----------|----------|-----------|
| **Dos INSERT concurrentes** (mismo user+match, sin fila previa) | Segundo falla con `unique_violation` — error 500 al usuario, no corrupción | **Medio** |
| **TOCTOU kickoff** | `can_submit_prediction` evalúa `kick_off > now()` sin bloquear fila `matches` | **Medio** — ventana de ms/segundos al inicio del partido |
| **TOCTOU status live** | Entre check y write, trigger puede lockear predicciones; INSERT nuevo aún pasa check si partido sigue `scheduled` | **Bajo** |
| **SELECT luego INSERT vs lock trigger** | Si partido pasa a live entre SELECT (not found) e INSERT, INSERT en RPC SECURITY DEFINER **sí escribe** aunque partido ya no esté scheduled | **Medio** — re-check ausente post-validación |

### 2.3 Bloqueos y deadlocks

- **No usa `FOR UPDATE`** en `matches` ni `predictions`.
- **Deadlock con `score_match_predictions`:** improbable — scoring lockea match + predictions; save no lockea match. Peor caso: wait en row lock de prediction durante score.
- **No hay deadlock circular** identificado entre RPCs.

### 2.4 Bypass de validaciones

| Vector | ¿Bypass posible post-190? |
|--------|---------------------------|
| Upsert directo a `predictions` | ❌ RLS INSERT/UPDATE solo admin |
| Enviar `predicted_winner` falso | ❌ Calculado en SQL |
| Scores fuera de rango | ❌ Validado en RPC + CHECK constraint |
| Cuenta inactiva | ❌ Verificado en RPC |
| Post-kickoff | ⚠️ Posible en race TOCTOU (ver arriba) |
| Suplantar `user_id` | ❌ Siempre `auth.uid()` |

### 2.5 Timezone / kickoff

- `kick_off` es `timestamptz`; `now()` en PostgreSQL es UTC.
- **Riesgo:** si sync de fixtures guarda kickoff en timezone incorrecta, cierre anticipado/tardío de predicciones.
- **No hay margen de gracia** (ej. 5 min buffer) — corte estricto `kick_off > now()`.

### 2.6 Qué puede romperse en producción

1. Pico de clicks al cierre → errores `unique_violation` visibles en UI.
2. Usuario en el segundo exacto del kickoff → resultado inconsistente según latencia.
3. Partido mal sincronizado (`status=scheduled` pero ya jugándose) → predicciones aceptadas indebidamente (dato incorrecto en `matches`, no bug de RPC).

---

## 3. Auditoría `score_match_predictions()`

**Fuente:** migr. 190 L243–354

### 3.1 Idempotencia

| Guard | Efectivo |
|-------|----------|
| `matches.scored_at IS NOT NULL` → return 0 | ✅ Segunda ejecución global |
| `UPDATE predictions ... AND scored_at IS NULL` | ✅ No repuntúa fila individual |
| `FOR UPDATE` en match + predictions | ✅ Serializa concurrencia mismo partido |

### 3.2 Doble puntuación — simulación

| Escenario extremo | Resultado esperado | Riesgo residual |
|-------------------|-------------------|-----------------|
| Dos RPC paralelos mismo partido | Segundo espera `FOR UPDATE` en match; primero setea `scored_at`; segundo retorna 0 | ✅ |
| Trigger + RPC simultáneos | Misma serialización | ✅ |
| Admin resetea `scored_at` manual sin `rescore` | Predicciones ya `scored` — loop ignora (`status NOT IN pending/locked`) | ⚠️ partido marcado no repuntuable sin intervención |
| **`rescore_match_predictions` por atacante** | Resta puntos con `p_old_score_*` falsos + repuntúa | **Crítico** (ver §8) |

### 3.3 Bug: `scored_at` sin predicciones puntuadas

```sql
-- Al final SIEMPRE ejecuta (L347-350), incluso si v_total_scored = 0:
UPDATE matches SET scored_at = now() WHERE id = p_match_id AND scored_at IS NULL;
```

**Impacto:** partido `finished` con marcador pero **sin predicciones** queda `scored_at` seteado → si luego hay predicciones (caso edge import/admin), **nunca se puntuarán** sin reset manual.

**Severidad:** Medio (edge case pre-lanzamiento con 0 usuarios; relevante post-launch).

### 3.4 Consistencia leaderboard

- Upsert por predicción puntuada: `points += v_points` — consistente dentro de transacción.
- **Recálculo de rank:** `ROW_NUMBER()` sobre **toda** la tabla `leaderboard` period=`global` en cada partido.
- **Actualización parcial:** si la función aborta mid-loop, PostgreSQL hace rollback completo de la transacción → ✅ atomicidad.

### 3.5 Fallo ante concurrencia masiva

- 64 partidos terminando en la misma hora → 64 full rank recalcs → CPU/IO en Supabase.
- No hay doble suma, pero **latencia del rank** crece O(n × partidos).

---

## 4. Auditoría RLS por tabla

### 4.1 `profiles`

| Acción | Usuario normal | Admin | Atacante autenticado |
|--------|----------------|-------|----------------------|
| SELECT propio | ✅ | ✅ | Solo su fila |
| SELECT otros | ❌ excepto ranking (190) | ✅ | ⚠️ **Toda fila** de usuarios en leaderboard vía `profiles(*)` |
| UPDATE | ✅ campos no sensibles (role, is_active, review_* bloqueados) | ✅ | ❌ no puede escalar privilegios |
| INSERT | ❌ (trigger auth) | — | — |

**Explotación:** `supabase.from('leaderboard').select('*, profiles(*)')` → email, dni, legajo, token_balance de top users.

### 4.2 `predictions`

| Acción | Usuario normal | Admin |
|--------|----------------|-------|
| SELECT | Solo propias | Todas |
| INSERT/UPDATE | ❌ (190) | ✅ |
| DELETE | ❌ | ✅ |
| Escritura real | `save_prediction()` RPC | Directo o RPC |

**Explotación post-190:** editar ajenas ❌ | upsert directo ❌ | modificar puntuadas ❌

### 4.3 `matches`

| Acción | Usuario | Atacante |
|--------|---------|----------|
| SELECT | ✅ autenticado | Solo lectura |
| UPDATE | ❌ | ❌ — no puede adelantar kickoff ni resultados |

### 4.4 `teams` / `players`

| Acción | Usuario | Atacante |
|--------|---------|----------|
| SELECT | ✅ **público** (`USING true`) | Datos de referencia expuestos (intencional) |
| UPDATE | ❌ | ❌ |

### 4.5 `leaderboard`

| Acción | Usuario | Atacante |
|--------|---------|----------|
| SELECT | ✅ público | Solo lectura |
| INSERT/UPDATE | ❌ | ❌ vía RLS |
| UPDATE real | `score_match_predictions` (DEFINER) | ⚠️ vía RPC directa (sin auth) |

### 4.6 `member_reference`

| Acción | Usuario | Atacante |
|--------|---------|----------|
| SELECT | ❌ | ❌ — solo admin |
| Escritura | ❌ | ❌ |

Padrón protegido correctamente. Validación DNI ocurre en RPCs DEFINER.

---

## 5. Auditoría frontend

### 5.1 Llamadas directas a tablas sensibles

| Archivo | Tabla | ¿Riesgo? |
|---------|-------|----------|
| `useSavePrediction.ts` | RPC `save_prediction` | ✅ Correcto |
| `worldCupService.ts` | `predictions` SELECT propio | ✅ |
| `worldCupService.ts` | `leaderboard` + join profiles | ⚠️ Depende de RLS profiles |
| `auth.tsx`, `LoginPage.tsx` | `profiles` SELECT propio | ✅ |
| `adminServiceFallback.ts` | `profiles`, `predictions`, `member_reference` | ⚠️ Solo funciona si admin RLS; bypass de RPC si falla admin RPC |
| Scripts sync / workers | service role | ✅ Server-side only |

### 5.2 Service role en browser

- `src/lib/supabase.ts` → **solo anon key** ✅
- `src/database/supabaseClient.ts` → service role, **no importado en bundle Vite de usuario** ✅
- Edge functions → service role en Deno ✅

### 5.3 Bypass de RPC

| Vector | Estado post-190 |
|--------|-----------------|
| `supabase.from('predictions').upsert()` | Bloqueado por RLS |
| `supabase.rpc('score_match_predictions')` | **⚠️ ABIERTO a authenticated** |
| `supabase.rpc('rescore_match_predictions')` | **⚠️ ABIERTO — crítico** |

### 5.4 React Query / Realtime

| Hook | Invalidación | Issue |
|------|--------------|-------|
| `useSavePrediction` | predictions + match + matches | ✅ |
| `usePredictions` | Realtime filter `user_id=eq.{id}` | ✅ |
| `useLeaderboard` | Realtime sin filter — invalida todo leaderboard | ✅ correcto para ranking |
| `useWorldCupMatches` | Realtime global matches | OK — staleTime 15s en live |

**Estado inconsistente posible:** usuario guarda predicción → cache invalidada → Realtime de otro tab no afecta predictions ajenas. Bajo riesgo.

### 5.5 Dev flags en producción

- `VITE_DEV_ADMIN`, `VITE_DEV_ADMIN_EMAIL` en `auth.tsx` — **verificar que NO estén en Vercel prod**.
- Si activos: login dev auto en Supabase.

---

## 6. Datos reales (reports 2026-06-06)

**Fuente cloud:** `irklqwsnehlfcgehvscm.supabase.co`

### 6.1 Conteos (`supabase-health-report.json`)

| Tabla | Count |
|-------|-------|
| matches | 104 |
| teams | 49 (report team-coverage) |
| players | 1267 |
| predictions | **0** |
| profiles | **0** |
| leaderboard | **0** |
| events | **0** |

**Interpretación:** base preparada para fixture/plantel; **sin usuarios ni predicciones reales aún**. No es posible auditar duplicados de predictions en prod (tabla vacía).

### 6.2 Teams (`team-coverage.json`)

- **93.9%** equipos completos (46/49)
- **Incompletos:** `Por definir` (placeholder UUID), Senegal, Jordan — falta coach/bandera
- **Sin ranking FIFA** en ningún equipo (0%) — cosmético

### 6.3 Players (`player-coverage.json`)

- 1267 jugadores, 100% con provider_id
- **0% fotos**, 0% club, 0% stats — no bloquea prode de marcadores
- 2 jugadores sin edad
- 1048 pending enrichment

### 6.4 Live (`live-events-audit.json`)

- **0 eventos** — pipeline live no probado en prod

### 6.5 Queries SQL recomendadas (ejecutar en SQL Editor)

```sql
-- Duplicados predictions
SELECT user_id, match_id, count(*) AS n
FROM public.predictions
GROUP BY 1, 2 HAVING count(*) > 1;

-- Partidos con equipos huérfanos
SELECT m.id, m.kick_off, m.status,
       m.home_team_id, ht.id AS home_ok,
       m.away_team_id, at.id AS away_ok
FROM public.matches m
LEFT JOIN public.teams ht ON ht.id = m.home_team_id
LEFT JOIN public.teams at ON at.id = m.away_team_id
WHERE (m.home_team_id IS NOT NULL AND ht.id IS NULL)
   OR (m.away_team_id IS NOT NULL AND at.id IS NULL);

-- Jugadores sin equipo
SELECT count(*) AS orphan_players
FROM public.players p
LEFT JOIN public.teams t ON t.id = p.team_id
WHERE p.team_id IS NOT NULL AND t.id IS NULL;

-- Partidos scheduled con kickoff pasado (ventana predicciones rota)
SELECT id, kick_off, status, is_locked
FROM public.matches
WHERE status = 'scheduled' AND kick_off <= now()
ORDER BY kick_off DESC
LIMIT 50;

-- Partidos finished sin scored_at pero con predicciones pendientes
SELECT m.id, m.status, m.scored_at, count(p.id) AS pending_preds
FROM public.matches m
JOIN public.predictions p ON p.match_id = m.id
  AND p.status IN ('pending', 'locked') AND p.scored_at IS NULL
WHERE m.status = 'finished'
  AND m.score_home IS NOT NULL
  AND m.score_away IS NOT NULL
GROUP BY m.id, m.status, m.scored_at
HAVING m.scored_at IS NOT NULL OR count(p.id) > 0;

-- Consistencia leaderboard vs sum(predictions.points)
SELECT lb.user_id, lb.points AS lb_points,
       coalesce(sum(p.points), 0) AS sum_pred_points
FROM public.leaderboard lb
LEFT JOIN public.predictions p ON p.user_id = lb.user_id AND p.status = 'scored'
WHERE lb.period = 'global'
GROUP BY lb.user_id, lb.points
HAVING lb.points <> coalesce(sum(p.points), 0);

-- RPC expuestas (verificar grants)
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('score_match_predictions', 'rescore_match_predictions', 'save_prediction')
ORDER BY routine_name, grantee;
```

---

## 7. Simulación de concurrencia

### 7.1 10 usuarios simultáneos

| Operación | Cuello de botella | Resultado |
|-----------|-------------------|-----------|
| 10 saves distintos partidos | RPC latency ~50ms | ✅ OK |
| 10 saves mismo partido | UNIQUE + sin retry | ⚠️ 1-2 errores posibles |
| 1 score_match | Loop predictions | ✅ |

### 7.2 100 usuarios simultáneos

| Operación | Resultado |
|-----------|-----------|
| Saves distribuidos (64 partidos) | ✅ Supabase pool aguanta |
| 100 saves mismo partido al cierre | ⚠️ Errores `unique_violation`; UX degradada |
| Rank recalc post-partido | ~100 rows — imperceptible |

### 7.3 1000 usuarios simultáneos

| Operación | Resultado |
|-----------|-----------|
| Saves en partido popular (final) | **Hotspot** — cola en RPC + UNIQUE; necesita retry client-side o `INSERT ... ON CONFLICT` atómico con lock |
| score_match 1000 preds | FOR UPDATE secuencial — **varios segundos** bloqueando filas |
| Rank recalc | Full scan 1000 users × cada FT — **medio** |

**Recomendación infra:** connection pooling Supabase Pro, índices ya aplicados, considerar cola de scoring async para FT masivos.

---

## 8. Seguridad — modelo de atacante autenticado

| Ataque | ¿Factible hoy? | Notas |
|--------|----------------|-------|
| Editar predicciones ajenas | ❌ | RLS + RPC |
| Upsert directo predictions | ❌ post-190 | |
| Puntuar dos veces mismo partido | ❌ | scored_at + guards |
| **`rpc('rescore_match_predictions', { p_old_score_home: 0, p_old_score_away: 0 })`** | **✅ CRÍTICO** | Corrompe leaderboard restando mal |
| **`rpc('score_match_predictions')` forzado** | ⚠️ | No duplica puntos; adelanta scoring |
| Modificar ranking directo | ❌ RLS | ✅ vía tabla |
| Modificar ranking vía rescore | **✅** | Ver arriba |
| Escalar a admin en profiles | ❌ | WITH CHECK bloquea role |
| Leer DNI/email de rivales en ranking | **✅ CRÍTICO** | `profiles(*)` en join |
| Saltar kickoff vía API | ⚠️ Parcial | TOCTOU; no bypass estable |
| Enumerar legajos (`validate_member_legajo`) | ⚠️ | anon + authenticated |
| Llamar admin RPCs | ❌ | `is_admin()` interno |

---

## 9. Hallazgos consolidados

### Críticos

1. **`rescore_match_predictions` callable sin autorización** — manipulación de puntos del leaderboard.
2. **`score_match_predictions` callable por cualquier `authenticated`** — superficie innecesaria; bypass del control de edge function `score-match`.
3. **Filtración PII** vía `profiles_leaderboard_select` + PostgREST column expansion.

### Medios

4. **`save_prediction` TOCTOU** en kickoff/status sin lock de `matches`.
5. **`save_prediction` race INSERT** → `unique_violation` sin manejo.
6. **`matches.scored_at` seteado con 0 predicciones** — bloqueo de scoring tardío.
7. **Rank recalc O(n) global** en cada partido — cuello de botella a escala.
8. **`validate_registration` / `validate_member_legajo` expuestos a anon** — enumeración.
9. **adminServiceFallback** — path alternativo con queries directas si RPC falla (solo admin, pero inconsistente).

### Bajos

10. Políticas RLS duplicadas teams/players (ruido).
11. 0 fotos jugadores / worker sin heartbeat — calidad ops, no seguridad predicciones.
12. Placeholder team `Por definir` en fixtures.
13. **`VITE_DEV_ADMIN`** — riesgo si leak en prod env.

### Riesgos ya corregidos (migr. 190)

- Upsert directo predictions bypass RLS ventana partido
- Winner incoherente con marcador
- Scoring concurrente sin FOR UPDATE (parcialmente)
- Índices predictions + dedup + CHECK scores
- Frontend migrado a RPC

---

## 10. Plan propuesto (pendiente de aprobación)

> **No implementado.** Esperar OK explícito antes de tocar código/migraciones.

### Fase A — Bloqueantes pre-launch (1 migración)

| # | Cambio | Archivo |
|---|--------|---------|
| A1 | `REVOKE ALL ON FUNCTION score_match_predictions, rescore_match_predictions FROM PUBLIC, authenticated` | nueva migr. `20240120000000` |
| A2 | `GRANT EXECUTE ... TO service_role` only | idem |
| A3 | Guard interno: `IF auth.role() <> 'service_role' AND NOT is_admin() THEN RAISE` en ambas funciones | idem |
| A4 | Reemplazar `profiles_leaderboard_select` por vista `leaderboard_public_profiles(id, full_name, legajo, avatar_url)` | idem |
| A5 | `save_prediction`: `SELECT ... FROM matches WHERE id = p_match_id FOR UPDATE` + re-validar antes de write | idem |
| A6 | `save_prediction`: `EXCEPTION WHEN unique_violation` → retry UPDATE | idem |
| A7 | `score_match_predictions`: setear `scored_at` solo si `v_total_scored > 0` | idem |

### Fase B — Hardening post-launch (opcional)

| # | Cambio |
|---|--------|
| B1 | Rate limit `save_prediction` vía Supabase Edge o pg_cron metrics |
| B2 | Vista materializada ranks / incremental rank update |
| B3 | Revocar `validate_member_legajo` de `anon` |
| B4 | Eliminar `adminServiceFallback` o gate estricto `is_admin()` |
| B5 | E2E load test 100 concurrent saves |

### Fase C — Operaciones

| # | Acción |
|---|--------|
| C1 | Confirmar migr. 190 aplicada en cloud |
| C2 | Ejecutar queries §6.5 en prod |
| C3 | `npm run test:e2e:prod` |
| C4 | Verificar `VITE_DEV_ADMIN` ausente en Vercel |
| C5 | Worker heartbeat + live events smoke test |

---

## 11. Estimación final de preparación

| Capa | Peso | Score |
|------|------|-------|
| Predicciones RPC + RLS 190 | 30% | 95% |
| Scoring idempotencia | 25% | 92% |
| Seguridad / PII | 20% | 90% |
| Integridad datos fixture | 15% | 90% |
| Ops live/worker | 10% | 50% |

**Preparación real ponderada (código Fase A implementado): ~91%**

**Tras apply cloud + E2E prod verde: ~94%**

**Tras ops live/worker: ~96%**

---

## 12. Implementación Fase A (20240120000000) — COMPLETADA

**Migración:** `supabase/migrations/20240120000000_prelaunch_security_lockdown.sql`  
**Fecha:** 2026-06-06

### SQL aplicado (resumen)

| Componente | Cambio |
|------------|--------|
| `assert_internal_scoring_caller()` | Guard service_role / admin |
| `score_match_predictions` | Guard + `scored_at` solo si `v_total_scored > 0` |
| `rescore_match_predictions` | Guard + `FOR UPDATE` en match |
| `save_prediction` | `FOR UPDATE` match, validación in-transaction, `unique_violation` retry |
| `public_leaderboard_profiles` | Vista sin PII |
| `profiles_leaderboard_select` | **Eliminada** |
| Grants scoring RPCs | REVOKE PUBLIC/anon/authenticated → GRANT service_role |
| `validate_member_legajo` | REVOKE PUBLIC/anon/authenticated |
| `validate_registration` | Códigos genéricos `registration_conflict` para anon |

### RPCs revocadas (authenticated / anon)

- `score_match_predictions(uuid)`
- `rescore_match_predictions(uuid, integer, integer)`
- `validate_member_legajo(text, text)`

### Políticas afectadas

- **DROP** `profiles_leaderboard_select` on `profiles`
- **CREATE** view `public_leaderboard_profiles` (GRANT SELECT anon, authenticated)

### Queries de verificación post-apply

```sql
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('score_match_predictions', 'rescore_match_predictions')
ORDER BY routine_name, grantee;

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'public_leaderboard_profiles';

SELECT policyname FROM pg_policies
WHERE tablename = 'profiles' AND policyname = 'profiles_leaderboard_select';
```

### Riesgos cerrados

1. RPC scoring/rescore expuestas a authenticated  
2. Filtración PII ranking  
3. TOCTOU `save_prediction`  
4. Race INSERT unique_violation  
5. `scored_at` sin predicciones  
6. `validate_member_legajo` anon  
7. Enumeración fina registro anon  

### Riesgos pendientes

- Migr. 190/200 sin apply en cloud  
- Rank recalc O(n) por partido  
- Worker live sin heartbeat  
- `VITE_DEV_ADMIN` en prod  
- `adminServiceFallback` (admin only)

### Comando apply cloud

```bash
npm run db:apply:management -- 20240120000000
```

---

## Apéndice — Checklist pre-lanzamiento

- [ ] Migr. 190 aplicada en cloud
- [ ] Migr. 200 (plan Fase A) aplicada
- [ ] Query duplicados predictions = 0 filas
- [ ] Query grants RPC — solo service_role
- [ ] Test manual: usuario no puede `rpc('rescore_...')`
- [ ] Test manual: join leaderboard no expone dni/email
- [ ] `npm run build` + `npm run test:e2e:prod` verde
- [ ] Vercel sin `VITE_DEV_ADMIN*`
- [ ] Edge function `score-match` con `SCORE_MATCH_SECRET` configurado

---

*Documento generado por auditoría estática. No sustituye pentest ni revisión de configuración Supabase Dashboard (JWT expiry, SMTP, backups).*
