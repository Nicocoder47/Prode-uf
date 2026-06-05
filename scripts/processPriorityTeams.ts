import { mkdirSync, writeFileSync } from 'node:fs';
import { linkPlayerIdentities } from '../src/services/footballData/playerIdentityLinkingService';
import { enrichVerifiedPlayers } from '../src/services/footballData/verifiedEnrichmentService';
import { linkingAdminService } from '../src/services/footballData/linkingAdminService';
import { PRIORITY_TEAMS } from '../src/constants/dataPipeline';

function parseArg(prefix: string): string | undefined {
  const arg = process.argv.find(a => a.startsWith(`--${prefix}=`));
  return arg?.split('=').slice(1).join('=');
}

function parseCountries(): string[] {
  const single = parseArg('country');
  if (single) return [single];
  if (process.argv.includes('--all-priority')) return [...PRIORITY_TEAMS];
  console.error('Uso: npm run process:priority-teams -- --country=Brazil | --all-priority');
  process.exit(1);
}

async function auditSnapshot() {
  const status = await linkingAdminService.playerStatus();
  const priority = await linkingAdminService.priorityTeamStatus();
  return { status, priority, at: new Date().toISOString() };
}

async function main() {
  const countries = parseCountries();
  const batchSize = parseArg('batchSize') ? Number(parseArg('batchSize')) : 26;
  const skipPhotos = process.argv.includes('--skip-photos');
  const results: Record<string, unknown>[] = [];

  console.log('\n=== PROCESS PRIORITY TEAMS ===');
  console.log({ countries, batchSize, skipPhotos }, '\n');

  for (const country of countries) {
    console.log(`\n--- ${country} ---`);

    console.log('1/4 link identities...');
    const link = await linkPlayerIdentities({ country, batchSize, skipVerified: true });
    console.log(`   verified=${link.verified} needsReview=${link.needsReview} rejected=${link.rejected}`);

    console.log('2/4 enrich verified...');
    const enrich = await enrichVerifiedPlayers({ country, batchSize });
    console.log(`   enriched=${enrich.enriched} skipped=${enrich.skipped} conflicts=${enrich.conflicts}`);

    let photos = { scanned: 0, enriched: 0, skipped: 0, conflicts: 0, errors: 0 };
    if (!skipPhotos) {
      console.log('3/4 missing photos...');
      photos = await enrichVerifiedPlayers({
        country,
        batchSize: 50,
        onlyMissingPhotos: true,
      });
      console.log(`   photos enriched=${photos.enriched} skipped=${photos.skipped}`);
    }

    console.log('4/4 audit snapshot...');
    const audit = await auditSnapshot();
    const team = audit.priority.teams.find(t => t.teamName === country);
    results.push({ country, link, enrich, photos, team });

    if (team) {
      console.log(
        `   ${country}: ver ${team.verifiedPct}% · foto ${team.photoPct}% · club ${team.clubPct}% → ${team.uiReadiness}`,
      );
    }
  }

  const finalAudit = await auditSnapshot();
  const payload = {
    generatedAt: new Date().toISOString(),
    countries,
    results,
    global: finalAudit.status,
    priority: finalAudit.priority,
  };

  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/priority-teams-pipeline.json', JSON.stringify(payload, null, 2));
  console.log('\nReporte: reports/priority-teams-pipeline.json');
  console.log(
    `Global: verified=${finalAudit.status.verified} photos=${finalAudit.status.withPhoto} clubs=${finalAudit.status.withClub}`,
  );
  console.log(`Priority READY_FOR_UI: ${finalAudit.priority.readyCount}/${finalAudit.priority.totalPriority}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
