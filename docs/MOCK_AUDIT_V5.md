# Auditoría V5 — Eliminación de mocks

Fecha: 2026-06-02

## Archivos eliminados

| Archivo | Líneas | Tipo eliminado |
|---------|--------|----------------|
| `src/data/worldcup2026/teams.ts` | 5-6 | `RAW_TEAMS`, `TEAMS` arrays estáticos |
| `src/data/worldcup2026/matches.ts` | 5-6 | `RAW_MATCHES`, `MATCHES` arrays estáticos |
| `src/data/worldcup2026/stadiums.ts` | 5-130 | `STADIUMS` hardcodeado (16 estadios fake) |
| `src/data/worldcup2026/index.ts` | — | Re-export de datos mock |
| `src/data/worldcup2026/types.ts` | — | Tipos legacy duplicados |
| `src/data/worldcup2026/syncStandings.ts` | — | Stub sin API real |
| `src/data/worldcup2026/syncRatings.ts` | — | Script apuntando a stub |
| `src/data/worldcup2026/TransfermarktProvider.ts` | — | Provider stub |
| `src/data/playerIntelligence.ts` | 33-247 | `playerIntelligence[]` hardcodeado (Messi, etc.) |
| `src/features/dashboard/SofascoreProvider.ts` | — | Provider stub (movido a `src/providers/sofascore/`) |

## Reemplazos

| Antes | Después |
|-------|---------|
| `sync:standings` → stub | `scripts/syncStandings.ts` → `ApiFootballProvider.syncStandings()` |
| `sync:ratings` → stub | `scripts/syncRatings.ts` → `SofascoreProvider.syncPlayerRatings()` |
| Datos locales en UI | Hooks `useWorldCup*` → Supabase |
| Standings calculados en cliente | Tabla `standings` + fallback cliente desde matches |

## Pendiente / no es mock deportivo

| Archivo | Notas |
|---------|-------|
| `src/lib/auth.tsx` | `fakeUser` solo para `VITE_DEV_ADMIN` — auth dev, no datos deportivos |
| `src/edge-functions/*.ts` | Templates con comentarios `Example:` — no se cargan en runtime |

## Verificación post-limpieza

```bash
rg "RAW_TEAMS|RAW_MATCHES|playerIntelligence|STADIUMS" src/
# → sin resultados en datos deportivos
```
