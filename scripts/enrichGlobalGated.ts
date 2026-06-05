import { mkdirSync, writeFileSync } from 'node:fs';
import { linkingAdminService } from '../src/services/footballData/linkingAdminService';
import { linkPlayerIdentities } from '../src/services/footballData/playerIdentityLinkingService';
import { enrichVerifiedPlayers } from '../src/services/footballData/verifiedEnrichmentService';
import { PRIORITY_TEAMS } from '../src/constants/dataPipeline';

function parseArg(prefix: string): string | undefined {
  const arg = process.argv.find(a => a.startsWith(`--${prefix}=`));
  return arg?.split('=').slice(1).join('=');
}

async function main() {
  const force = process.argv.includes('--force');
  const batchSize = parseArg('batchSize') ? Number(parseArg('batchSize')) : 26;
  const gate = await linkingAdminService.priorityTeamStatus();

  console.log('\n=== ENRICH GLOBAL (GATED) ===\n');
  console.log(`Priority READY_FOR_UI: ${gate.readyCount}/${gate.totalPriority}`);
  console.log(`Pending: ${gate.pendingTeams.join(', ') || '—'}`);

  if (!gate.allReady && !force) {
    console.error('\nBLOQUEADO: los 10 equipos prioritarios deben alcanzar READY_FOR_UI (≥80% ver/foto/club).');
    console.error('Usá --force solo si querés ignorar el gate manualmente.');
    process.exit(1);
  }

  const progress = await linkingAdminService.teamProgress();
  const nonPriority = progress.filter(t => !(PRIORITY_TEAMS as readonly string[]).includes(t.teamName));

  console.log(`\nProcesando ${nonPriority.length} selecciones restantes...\n`);

  const results: Record<string, unknown>[] = [];

  for (const team of nonPriority) {
    console.log(`--- ${team.teamName} ---`);
    const link = await linkPlayerIdentities({ teamId: team.teamId, batchSize, skipVerified: true });
    const enrich = await enrichVerifiedPlayers({ teamId: team.teamId, batchSize });
    results.push({
      team: team.teamName,
      link,
      enrich,
    });
    console.log(`   link ver=${link.verified} enrich=${enrich.enriched}`);
  }

  const status = await linkingAdminService.playerStatus();
  const payload = {
    generatedAt: new Date().toISOString(),
    forced: force,
    gate,
    results,
    global: status,
  };

  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/enrich-global-gated.json', JSON.stringify(payload, null, 2));
  console.log('\nReporte: reports/enrich-global-gated.json');
  console.log(`Global: verified=${status.verified} photos=${status.withPhoto} clubs=${status.withClub}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
