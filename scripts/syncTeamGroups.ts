import { loadCloudEnv } from './lib/loadCloudEnv.js';
import { syncTeamGroups } from '../src/services/sync/syncTeamGroups';

loadCloudEnv();

async function main() {
  const n = await syncTeamGroups();
  console.log(`Updated group_label on ${n} teams (from matches or standings)`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
