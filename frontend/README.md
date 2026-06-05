# Frontend (legacy / no integrado)

Este directorio contiene hooks y stores sueltos (`useLiveMatch`, `useLiveStore`) de un prototipo anterior.

La app activa está en [`../src/`](../src/) y usa:
- `src/useWorldCupData.ts` para datos del Mundial
- `src/hooks/useSavePrediction.ts` para predicciones
- `useLiveMatches()` con realtime de Supabase

No importes desde aquí en la app principal.
