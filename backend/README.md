# Backend (legacy / no integrado)

Este directorio contiene un prototipo NestJS + Prisma + BullMQ que **no está conectado** a la app activa.

La aplicación canónica vive en [`../src/`](../src/) con:
- Frontend Vite + React (`src/features`, `src/components`)
- Supabase como base de datos
- Sync via `src/providers/apiFootball` + `scripts/sync*.ts` + `src/workers/scheduler.ts`

No ejecutes este backend en paralelo salvo que planifiques una migración explícita.
