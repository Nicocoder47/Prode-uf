import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw, Server, Users, Zap } from 'lucide-react';
import { DataState } from '../../components/ui/DataState';
import { PremiumCard } from '../../components/ui/PremiumCard';
import { adminFetch } from '../../lib/adminApi';

type SystemHealthReport = {
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
  apis: Record<string, { configured: boolean; keyPresent?: boolean; optional?: boolean; reachable?: boolean; provider?: string }>;
  deployment?: {
    nodeEnv: string;
    workerHost: string | null;
    target: string;
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
  };
};

function statusColor(status: string) {
  if (status === 'online' || status === 'healthy') return 'text-green-300';
  if (status === 'stale' || status === 'warning') return 'text-amber-300';
  return 'text-red-300';
}

function StatusDot({ status }: { status: string }) {
  const bg =
    status === 'online'
      ? 'bg-green-500'
      : status === 'stale'
        ? 'bg-amber-500'
        : status === 'offline'
          ? 'bg-red-500'
          : 'bg-gray-500';
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${bg} animate-pulse`} />;
}

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-AR');
  } catch {
    return iso;
  }
}

export default function AdminSystemPage() {
  const [report, setReport] = useState<SystemHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/system/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReport(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando estado');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin" className="text-xs font-semibold text-white/50 hover:text-white/80">
            ← Admin
          </Link>
          <h1 className="mt-1 text-2xl font-black text-white">Operación Mundial — Sistema</h1>
          <p className="text-sm text-white/60">Monitoreo live, sync, APIs, jugadores y eventos</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <DataState isLoading={loading && !report} isError={!!error} errorMessage={error ?? undefined} onRetry={load}>
        {report && (
          <>
            {report.deployment && (
              <PremiumCard title="Deploy cloud">
                <p className="text-sm text-white/70">{report.deployment.target}</p>
                <p className="mt-1 text-xs text-white/50">
                  NODE_ENV={report.deployment.nodeEnv}
                  {report.deployment.workerHost ? ` · worker=${report.deployment.workerHost}` : ''}
                </p>
              </PremiumCard>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <PremiumCard title="Worker live">
                <div className="flex items-center gap-3">
                  <StatusDot status={report.worker.status} />
                  <div>
                    <p className={`text-lg font-bold capitalize ${statusColor(report.worker.status)}`}>
                      {report.worker.status}
                    </p>
                    <p className="text-xs text-white/50">cada {report.worker.expectedIntervalSec}s</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-white/60">
                  <Clock className="mr-1 inline h-3 w-3" />
                  Último heartbeat: {fmtTime(report.worker.lastHeartbeatAt)}
                </p>
              </PremiumCard>

              <PremiumCard title="Último sync">
                <p className="text-sm text-white/80">
                  Partidos: {fmtTime(report.sync.lastLiveMatches?.at ?? null)}
                </p>
                <p className="text-xs text-white/50">
                  {report.sync.lastLiveMatches?.records ?? 0} registros · {report.sync.lastLiveMatches?.provider ?? '—'}
                </p>
                <p className="mt-2 text-sm text-white/80">
                  Pipeline: {fmtTime(report.sync.lastLivePipeline?.at ?? null)}
                </p>
                <p className="text-xs text-white/50">
                  {report.sync.lastLivePipeline?.records ?? 0} bundles
                </p>
              </PremiumCard>

              <PremiumCard title="Eventos live">
                <p className="text-2xl font-black text-white">{report.live.liveMatches}</p>
                <p className="text-xs text-white/50">partidos en vivo</p>
                <p className="mt-2 text-sm text-white/70">
                  {report.live.totalEvents} eventos · {report.live.playerIdCoveragePct}% con player_id
                </p>
              </PremiumCard>

              <PremiumCard title="Scoring">
                <p className="text-sm text-white/80">
                  {report.scoring.scoredMatches}/{report.scoring.finishedMatches} puntuados
                </p>
                <p className="text-xs text-amber-200">{report.scoring.pendingScoring} pendientes</p>
                <p className="mt-1 text-xs text-white/50">{report.scoring.matchesWithMvp} con MVP</p>
              </PremiumCard>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <PremiumCard title="Estado APIs" description="Configuración servidor (sin llamadas desde browser)">
                <div className="space-y-2">
                  {Object.entries(report.apis).map(([name, cfg]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-white">
                        <Server className="h-4 w-4 text-white/40" />
                        {name}
                        {cfg.optional && <span className="text-[10px] text-white/40">(opcional)</span>}
                        {'provider' in cfg && cfg.provider && cfg.provider !== 'none' && (
                          <span className="text-[10px] text-white/40"> · {cfg.provider}</span>
                        )}
                      </span>
                      {cfg.configured && (cfg.reachable === false) ? (
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                      ) : cfg.configured || cfg.optional ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                      )}
                    </div>
                  ))}
                </div>
              </PremiumCard>

              <PremiumCard title="Cobertura jugadores">
                <div className="flex items-center gap-2 text-white">
                  <Users className="h-5 w-5 text-worldcup-gold" />
                  <span className="text-2xl font-black">{report.players.coveragePct}%</span>
                  <span className="text-sm text-white/50">con provider_player_id</span>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-white/70">
                  <li>Total: {report.players.total}</li>
                  <li>API-Football ID: {report.players.withApiFootballId}</li>
                  <li>Verificados: {report.players.verified}</li>
                </ul>
              </PremiumCard>
            </div>

            <PremiumCard title="Eventos recientes">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50">
                      <th className="py-2 pr-3">Tipo</th>
                      <th className="py-2 pr-3">Jugador</th>
                      <th className="py-2 pr-3">Min</th>
                      <th className="py-2">player_id</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.live.recentEvents.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-white/50">
                          Sin eventos en base de datos
                        </td>
                      </tr>
                    ) : (
                      report.live.recentEvents.map(ev => (
                        <tr key={ev.id} className="border-b border-white/5">
                          <td className="py-2 pr-3 text-white">{ev.type}</td>
                          <td className="py-2 pr-3 text-white/80">{ev.playerName ?? '—'}</td>
                          <td className="py-2 pr-3 text-white/60">{ev.time ?? '—'}</td>
                          <td className="py-2">
                            {ev.hasPlayerId ? (
                              <CheckCircle2 className="h-4 w-4 text-green-400" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-amber-400" />
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </PremiumCard>

            <PremiumCard title="Errores recientes">
              {report.sync.recentErrors.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-green-300">
                  <Activity className="h-4 w-4" />
                  Sin errores recientes en data_sync_logs
                </p>
              ) : (
                <ul className="space-y-2">
                  {report.sync.recentErrors.map((err, i) => (
                    <li
                      key={`${err.at}-${i}`}
                      className="rounded-xl border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm"
                    >
                      <p className="font-semibold text-red-200">
                        {err.syncType} · {err.provider}
                      </p>
                      <p className="text-xs text-white/50">{fmtTime(err.at)}</p>
                      <p className="mt-1 text-white/70">{err.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </PremiumCard>

            {report.worker.lastCycle && (
              <PremiumCard title="Último ciclo worker">
                <pre className="overflow-x-auto rounded-xl bg-black/30 p-3 text-xs text-white/70">
                  {JSON.stringify(report.worker.lastCycle, null, 2)}
                </pre>
              </PremiumCard>
            )}

            <p className="text-center text-xs text-white/40">
              <Zap className="mr-1 inline h-3 w-3" />
              Generado: {fmtTime(report.generatedAt)} · auto-refresh 30s
            </p>
          </>
        )}
      </DataState>
    </div>
  );
}
