import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, RefreshCw, Trophy } from 'lucide-react';
import { DataState } from '../../components/ui/DataState';
import { PremiumCard } from '../../components/ui/PremiumCard';
import { adminFetch } from '../../lib/adminApi';

type KnockoutReport = {
  generatedAt: string;
  auditNote: string;
  allGroupsComplete: boolean;
  groupsComplete: string[];
  groupsPending: string[];
  matchesResolved: number;
  matchesPending: number;
  predictionsEnabled: number;
  errors: string[];
  qualifiers: {
    combinationKey: string | null;
    qualifyingThirdGroups: string[];
    bestThirds: Array<{ teamName: string; groupLabel: string; points: number }>;
    first: Record<string, { teamName: string; points: number }>;
    second: Record<string, { teamName: string; points: number }>;
  } | null;
  bracket: Array<{
    bracketKey: string;
    homePlaceholder: string;
    awayPlaceholder: string;
    resolved: boolean;
    predictionsOpen: boolean;
  }>;
};

export default function AdminKnockoutPage() {
  const [report, setReport] = useState<KnockoutReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/knockout/audit');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReport(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando knockout');
    } finally {
      setLoading(false);
    }
  }, []);

  const runSync = async () => {
    setSyncing(true);
    setMsg(null);
    try {
      const res = await adminFetch('/api/admin/knockout/sync', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMsg(`Sync OK — ${data.matchesResolved} resueltos, ${data.predictionsEnabled} con predicciones`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error en sync');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin" className="text-xs font-semibold text-white/50 hover:text-white/80">
            ← Admin
          </Link>
          <h1 className="mt-1 text-2xl font-black text-white">Knockout automático</h1>
          <p className="text-sm text-white/60">Clasificados, cruces y estado del bracket</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            type="button"
            onClick={runSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-50"
          >
            <Trophy className="h-4 w-4" />
            {syncing ? 'Sincronizando…' : 'Aplicar sync knockout'}
          </button>
        </div>
      </div>

      {msg && (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">{msg}</p>
      )}

      <DataState isLoading={loading && !report} isError={!!error} errorMessage={error ?? undefined} onRetry={load}>
        {report && (
          <>
            <PremiumCard title="Estado fase de grupos">
              <p className="text-sm text-white/80">{report.auditNote}</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase text-green-300">Completos ({report.groupsComplete.length})</p>
                  <p className="text-sm text-white/70">{report.groupsComplete.join(', ') || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-amber-300">Pendientes ({report.groupsPending.length})</p>
                  <p className="text-sm text-white/70">{report.groupsPending.join(', ') || '—'}</p>
                </div>
              </div>
            </PremiumCard>

            {report.qualifiers && (
              <PremiumCard title="Clasificados detectados">
                {report.qualifiers.combinationKey && (
                  <p className="mb-2 text-xs text-white/50">
                    Annex C: {report.qualifiers.combinationKey} · Terceros: {report.qualifiers.qualifyingThirdGroups.join(', ')}
                  </p>
                )}
                <div className="grid gap-4 lg:grid-cols-3">
                  <div>
                    <p className="mb-2 text-xs font-bold text-white/50">1.º por grupo</p>
                    <ul className="space-y-1 text-sm text-white/80">
                      {Object.entries(report.qualifiers.first).map(([g, t]) => (
                        <li key={g}>
                          {g}: {t.teamName} ({t.points} pts)
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold text-white/50">2.º por grupo</p>
                    <ul className="space-y-1 text-sm text-white/80">
                      {Object.entries(report.qualifiers.second).map(([g, t]) => (
                        <li key={g}>
                          {g}: {t.teamName} ({t.points} pts)
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold text-white/50">8 mejores terceros</p>
                    <ul className="space-y-1 text-sm text-white/80">
                      {report.qualifiers.bestThirds.map(t => (
                        <li key={t.groupLabel}>
                          {t.groupLabel}: {t.teamName} ({t.points} pts)
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </PremiumCard>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <PremiumCard title="Cruces resueltos">
                <p className="text-3xl font-black text-white">{report.matchesResolved}</p>
                <p className="text-xs text-white/50">de 32 partidos knockout</p>
              </PremiumCard>
              <PremiumCard title="Pendientes">
                <p className="text-3xl font-black text-amber-200">{report.matchesPending}</p>
              </PremiumCard>
              <PremiumCard title="Predicciones abiertas">
                <p className="text-3xl font-black text-emerald-300">{report.predictionsEnabled}</p>
              </PremiumCard>
            </div>

            <PremiumCard title="Bracket — cruces generados">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50">
                      <th className="py-2 pr-3">Partido</th>
                      <th className="py-2 pr-3">Local</th>
                      <th className="py-2 pr-3">Visitante</th>
                      <th className="py-2 pr-2">Estado</th>
                      <th className="py-2">Pred.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.bracket.map(row => (
                      <tr key={row.bracketKey} className="border-b border-white/5">
                        <td className="py-2 pr-3 font-mono text-white/90">{row.bracketKey}</td>
                        <td className="py-2 pr-3 text-white/80">{row.homePlaceholder}</td>
                        <td className="py-2 pr-3 text-white/80">{row.awayPlaceholder}</td>
                        <td className="py-2 pr-2">
                          {row.resolved ? (
                            <CheckCircle2 className="h-4 w-4 text-green-400" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                          )}
                        </td>
                        <td className="py-2">
                          {row.predictionsOpen ? (
                            <span className="text-xs text-emerald-300">abierta</span>
                          ) : (
                            <span className="text-xs text-white/40">bloqueada</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PremiumCard>

            {report.errors.length > 0 && (
              <PremiumCard title="Errores">
                <ul className="space-y-2">
                  {report.errors.map((e, i) => (
                    <li key={i} className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-200">
                      {e}
                    </li>
                  ))}
                </ul>
              </PremiumCard>
            )}
          </>
        )}
      </DataState>
    </div>
  );
}
