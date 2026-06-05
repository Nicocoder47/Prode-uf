import { syncTeamGroupsFromStandings } from '../src/services/sync/syncTeamGroups';

async function main() {
  const n = await syncTeamGroupsFromStandings();
  console.log(`Updated group_label on ${n} teams`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
