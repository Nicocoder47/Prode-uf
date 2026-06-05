# Legacy scoring scripts (DEPRECATED)

Estos archivos **no deben usarse en producción**. Contradicen el motor autoritativo de Supabase:

- Función: `public.score_match_predictions`
- Migración: `supabase/migrations/20240104000000_v5_realtime_scoring.sql`
- Edge function activa: `supabase/functions/score-match/index.ts` (delega al RPC)

## Problemas de los scripts legacy

| Archivo | Problema |
|---------|----------|
| `root-index.ts.deprecated` | Suma 3 + 2 por exacto (5 total) pero también suma 3 por resultado → puede dar 8 pts |
| `scripts-index.ts.deprecated` | Suma 3 + 5 por exacto → 8 pts; usa columnas `home_score`/`away_score` inexistentes |
| Solo puntúa predicciones `locked` | Ignora `pending` en partidos que no pasaron por live |

## Uso correcto

```bash
# Auditoría
npm run audit:predictions

# Scoring manual (admin API o RPC)
# POST /api/admin/predictions/score/:matchId
# supabase.rpc('score_match_predictions', { p_match_id: matchId })
```

Los archivos originales en la raíz y `scripts/index.ts` fueron reemplazados por stubs que lanzan error si se ejecutan.
