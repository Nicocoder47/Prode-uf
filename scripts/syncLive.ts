/**
 * Sync de partidos en vivo / resultados — una ejecución (GitHub Actions cada 10–15 min).
 * npm run sync:live
 */
import { loadCloudEnv } from './lib/loadCloudEnv.js';
import { runLiveSyncCycle } from '../src/services/sync/liveWorkerService.js';

loadCloudEnv();

async function main() {
  if (!process.env.SUPABASE_URL?.trim() && process.env.VITE_SUPABASE_URL?.trim()) {
    process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL.trim();
  }
  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('Configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (GitHub Secrets o .env.cloud)');
    process.exit(1);
  }
  if (!process.env.FOOTBALL_DATA_API_KEY?.trim() && !process.env.API_FOOTBALL_KEY?.trim()) {
    console.error('Configurar FOOTBALL_DATA_API_KEY o API_FOOTBALL_KEY (GitHub Secrets o .env.cloud)');
    process.exit(1);
  }
  if (/localhost|127\.0\.0\.1|:54321/.test(process.env.SUPABASE_URL)) {
    console.error('SUPABASE_URL apunta a local — usar cloud en CI/producción');
    process.exit(1);
  }

  const result = await runLiveSyncCycle();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
