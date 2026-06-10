import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { writeFileSync } from 'node:fs';
import { loadCloudEnv } from './lib/loadCloudEnv.js';

loadCloudEnv();
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const service = createClient(url, serviceKey, {
  auth: { persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
});

async function main() {
  const snapshots = await service.from('system_snapshots').select('created_at,snapshot_type,payload').order('created_at', { ascending: false }).limit(8);
  const syncLogs = await service.from('data_sync_logs').select('started_at,finished_at,sync_type,status,error_message,records_upserted').order('started_at', { ascending: false }).limit(8);
  const member = await service.from('member_reference').select('dni,full_name,last_name').limit(1);
  const incompleteTeams = await service.from('teams').select('id,name,code,coach_name,flag_url').or('coach_name.is.null,flag_url.is.null').limit(10);

  const out = {
    generatedAt: new Date().toISOString(),
    snapshots: snapshots.data,
    snapshotsError: snapshots.error?.message,
    syncLogs: syncLogs.data,
    syncLogsError: syncLogs.error?.message,
    memberSampleKeys: member.data?.[0] ? Object.keys(member.data[0]) : null,
    incompleteTeams: incompleteTeams.data,
  };
  writeFileSync('reports/cto-ops-probe.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main();
