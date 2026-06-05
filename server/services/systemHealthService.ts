/**
 * Estado operativo del sistema — Fase A (Supabase service role).
 */
import { supabase } from '../../src/database/supabaseClient.js';

export type SystemHealthReport = {
  generatedAt: string;
  worker: {
    status: 'online' | 'stale' | 'offline' | 'unknown';
    lastHeartbeatAt: string | null;
    lastCycle: Record<string, unknown> | null;
    expectedIntervalSec: number;
  };
  sync: {
    lastLiveMatches: { at: string; provider: string; records: number; status: string } | null;
    lastLivePipeline: { at: string; records: number; status: string } | null;
    recentErrors: Array<{ at: string; syncType: string; provider: string; message: string }>;
  };
  apis: {
    apiFootball: { configured: boolean; keyPresent: boolean };
    sportmonks: { configured: boolean };
    transfermarkt: { configured: boolean };
    redis: { configured: boolean; optional: true };
    supabase: { configured: boolean };
  };
  players: {
    total: number;
    withProviderId: number;
    withApiFootballId: number;
    verified: number;
    coveragePct: number;
  };
  live: {
    liveMatches: number;
    totalEvents: number;
    goalEvents: number;
    eventsWithPlayerId: number;
    eventsWithoutPlayerId: number;
    playerIdCoveragePct: number;
    recentEvents: Array<{
      id: string;
      matchId: string;
      type: string;
      time: string | null;
      playerName: string | null;
      hasPlayerId: boolean;
    }>;
  };
  scoring: {
    finishedMatches: number;
    scoredMatches: number;
    pendingScoring: number;
    matchesWithMvp: number;
    matchesMvpFromRatingsFallback: number;
  };
  deployment: {
    nodeEnv: string;
    workerHost: string | null;
    target: string;
  };
};

async function pingRedis(): Promise<{ ok: boolean; provider: string }> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return { ok: true, provider: 'none' };
  try {
    const { default: Redis } = await import('ioredis');
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      connectTimeout: 3000,
      ...(url.startsWith('rediss://') ? { tls: {} } : {}),
    });
    await client.connect();
    await client.ping();
    await client.quit();
    return { ok: true, provider: url.includes('upstash') ? 'upstash' : 'redis' };
  } catch {
    return { ok: false, provider: url.includes('upstash') ? 'upstash' : 'redis' };
  }
}

function envConfigured(key: string): boolean {
  const v = process.env[key]?.trim();
  return !!v && !v.includes('your-');
}

async function latestSyncLog(syncType: string) {
  const { data } = await supabase
    .from('data_sync_logs')
    .select('finished_at,provider,records_upserted,status,error_message')
    .eq('sync_type', syncType)
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function latestWorkerHeartbeat() {
  const { data } = await supabase
    .from('system_snapshots')
    .select('created_at,payload')
    .eq('snapshot_type', 'worker_heartbeat')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

function workerStatusFromHeartbeat(at: string | null): SystemHealthReport['worker']['status'] {
  if (!at) return 'unknown';
  const ageSec = (Date.now() - new Date(at).getTime()) / 1000;
  if (ageSec <= 90) return 'online';
  if (ageSec <= 300) return 'stale';
  return 'offline';
}

export async function getSystemHealthReport(): Promise<SystemHealthReport> {
  const [
    heartbeat,
    lastLiveMatches,
    lastLivePipeline,
    recentErrorRows,
    playersRes,
    liveMatchesRes,
    eventsRes,
    goalEventsRes,
    eventsWithPlayerRes,
    recentEventsRes,
    finishedRes,
    scoredRes,
    mvpRes,
  ] = await Promise.all([
    latestWorkerHeartbeat(),
    latestSyncLog('live_matches'),
    latestSyncLog('live_pipeline'),
    supabase
      .from('data_sync_logs')
      .select('finished_at,sync_type,provider,error_message')
      .eq('status', 'error')
      .order('finished_at', { ascending: false })
      .limit(10),
    supabase.from('players').select('id,provider_player_id,api_football_id,verification_status', { count: 'exact', head: false }).limit(5000),
    supabase.from('matches').select('id', { count: 'exact', head: true }).in('status', ['live', '1H', '2H', 'HT', 'ET', 'P']),
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id', { count: 'exact', head: true }).in('event_type', ['Goal', 'goal', 'Penalty', 'penalty', 'Own Goal', 'own goal']),
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .not('event_data->player_id', 'is', null),
    supabase
      .from('events')
      .select('id,match_id,event_type,event_time,event_data')
      .order('created_at', { ascending: false })
      .limit(15),
    supabase.from('matches').select('id', { count: 'exact', head: true }).eq('status', 'finished'),
    supabase.from('matches').select('id', { count: 'exact', head: true }).not('scored_at', 'is', null),
    supabase.from('matches').select('id', { count: 'exact', head: true }).not('mvp_player_id', 'is', null),
  ]);

  const players = playersRes.data ?? [];
  const totalPlayers = playersRes.count ?? players.length;
  const withProviderId = players.filter(p => p.provider_player_id).length;
  const withApiFootballId = players.filter(p => p.api_football_id).length;
  const verified = players.filter(p => p.verification_status === 'verified').length;

  const totalEvents = eventsRes.count ?? 0;
  const goalEvents = goalEventsRes.count ?? 0;
  const eventsWithPlayerId = eventsWithPlayerRes.count ?? 0;
  const eventsWithoutPlayerId = Math.max(0, totalEvents - eventsWithPlayerId);

  const hbAt = heartbeat?.created_at ?? null;
  const payload = (heartbeat?.payload ?? null) as Record<string, unknown> | null;
  const redisPing = await pingRedis();

  return {
    generatedAt: new Date().toISOString(),
    worker: {
      status: workerStatusFromHeartbeat(hbAt),
      lastHeartbeatAt: hbAt,
      lastCycle: payload,
      expectedIntervalSec: 30,
    },
    sync: {
      lastLiveMatches: lastLiveMatches
        ? {
            at: lastLiveMatches.finished_at ?? '',
            provider: lastLiveMatches.provider,
            records: lastLiveMatches.records_upserted,
            status: lastLiveMatches.status,
          }
        : null,
      lastLivePipeline: lastLivePipeline
        ? {
            at: lastLivePipeline.finished_at ?? '',
            records: lastLivePipeline.records_upserted,
            status: lastLivePipeline.status,
          }
        : null,
      recentErrors: (recentErrorRows.data ?? []).map(r => ({
        at: r.finished_at ?? '',
        syncType: r.sync_type,
        provider: r.provider,
        message: r.error_message ?? 'unknown',
      })),
    },
    apis: {
      apiFootball: {
        configured: envConfigured('API_FOOTBALL_KEY'),
        keyPresent: !!process.env.API_FOOTBALL_KEY?.trim(),
      },
      sportmonks: { configured: envConfigured('SPORTMONKS_API_TOKEN') },
      transfermarkt: { configured: envConfigured('TRANSFERMARKT_API_URL') || envConfigured('TRANSFERMARKT_BASE_URL') },
      redis: {
        configured: !!process.env.REDIS_URL?.trim(),
        optional: true as const,
        reachable: redisPing.ok,
        provider: redisPing.provider,
      },
      supabase: {
        configured: envConfigured('SUPABASE_URL') && envConfigured('SUPABASE_SERVICE_ROLE_KEY'),
      },
    },
    players: {
      total: totalPlayers,
      withProviderId,
      withApiFootballId,
      verified,
      coveragePct: totalPlayers > 0 ? Math.round((withProviderId / totalPlayers) * 100) : 0,
    },
    live: {
      liveMatches: liveMatchesRes.count ?? 0,
      totalEvents,
      goalEvents,
      eventsWithPlayerId,
      eventsWithoutPlayerId,
      playerIdCoveragePct: totalEvents > 0 ? Math.round((eventsWithPlayerId / totalEvents) * 100) : 0,
      recentEvents: (recentEventsRes.data ?? []).map(e => {
        const ed = (e.event_data ?? {}) as Record<string, unknown>;
        return {
          id: e.id,
          matchId: e.match_id,
          type: e.event_type,
          time: e.event_time,
          playerName: (ed.player_name as string) ?? null,
          hasPlayerId: !!ed.player_id,
        };
      }),
    },
    scoring: {
      finishedMatches: finishedRes.count ?? 0,
      scoredMatches: scoredRes.count ?? 0,
      pendingScoring: Math.max(0, (finishedRes.count ?? 0) - (scoredRes.count ?? 0)),
      matchesWithMvp: mvpRes.count ?? 0,
      matchesMvpFromRatingsFallback: 0,
    },
    deployment: {
      nodeEnv: process.env.NODE_ENV ?? 'development',
      workerHost: process.env.WORKER_HOST ?? null,
      target: 'vercel(frontend)+oracle(api/worker)+supabase(db)+upstash(redis optional)',
    },
  };
}

export type LiveEventsAuditReport = {
  generatedAt: string;
  summary: {
    totalEvents: number;
    byType: Record<string, number>;
    goals: number;
    cards: number;
    substitutions: number;
    withPlayerId: number;
    withoutPlayerId: number;
    unresolvedGoals: Array<{
      eventId: string;
      matchId: string;
      playerName: string | null;
      providerPlayerId: string | null;
      eventTime: string | null;
    }>;
  };
  liveMatches: Array<{
    id: string;
    providerMatchId: string | null;
    status: string;
    eventCount: number;
    goalsWithPlayer: number;
    goalsWithoutPlayer: number;
  }>;
};

export async function getLiveEventsAuditReport(): Promise<LiveEventsAuditReport> {
  const { data: events } = await supabase
    .from('events')
    .select('id,match_id,event_type,event_time,event_data,created_at')
    .order('created_at', { ascending: false })
    .limit(2000);

  const rows = events ?? [];
  const byType: Record<string, number> = {};
  let goals = 0;
  let cards = 0;
  let substitutions = 0;
  let withPlayerId = 0;
  let withoutPlayerId = 0;
  const unresolvedGoals: LiveEventsAuditReport['summary']['unresolvedGoals'] = [];

  const goalTypes = new Set(['goal', 'penalty', 'own goal']);
  const cardTypes = new Set(['card', 'yellow card', 'red card']);
  const subTypes = new Set(['subst', 'substitution']);

  for (const e of rows) {
    const t = (e.event_type ?? 'unknown').toLowerCase();
    byType[t] = (byType[t] ?? 0) + 1;
    const ed = (e.event_data ?? {}) as Record<string, unknown>;
    const hasPid = !!ed.player_id;
    if (hasPid) withPlayerId++;
    else withoutPlayerId++;

    if (goalTypes.has(t) || t.includes('goal')) {
      goals++;
      if (!hasPid) {
        unresolvedGoals.push({
          eventId: e.id,
          matchId: e.match_id,
          playerName: (ed.player_name as string) ?? null,
          providerPlayerId: ed.provider_player_id != null ? String(ed.provider_player_id) : null,
          eventTime: e.event_time,
        });
      }
    }
    if (cardTypes.has(t) || t.includes('card')) cards++;
    if (subTypes.has(t) || t.includes('subst')) substitutions++;
  }

  const { data: liveMatches } = await supabase
    .from('matches')
    .select('id,provider_match_id,status')
    .in('status', ['live', '1H', '2H', 'HT', 'ET', 'P', 'LIVE']);

  const liveMatchAudit = await Promise.all(
    (liveMatches ?? []).map(async m => {
      const { data: me } = await supabase.from('events').select('id,event_type,event_data').eq('match_id', m.id);
      const evs = me ?? [];
      let goalsWithPlayer = 0;
      let goalsWithoutPlayer = 0;
      for (const ev of evs) {
        const t = (ev.event_type ?? '').toLowerCase();
        if (!t.includes('goal') && t !== 'penalty') continue;
        const pid = (ev.event_data as Record<string, unknown>)?.player_id;
        if (pid) goalsWithPlayer++;
        else goalsWithoutPlayer++;
      }
      return {
        id: m.id,
        providerMatchId: m.provider_match_id,
        status: m.status,
        eventCount: evs.length,
        goalsWithPlayer,
        goalsWithoutPlayer,
      };
    })
  );

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalEvents: rows.length,
      byType,
      goals,
      cards,
      substitutions,
      withPlayerId,
      withoutPlayerId,
      unresolvedGoals: unresolvedGoals.slice(0, 50),
    },
    liveMatches: liveMatchAudit,
  };
}
