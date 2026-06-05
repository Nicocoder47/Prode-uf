import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { DataState } from '../../components/ui/DataState';
import { adminFetch } from '../../lib/adminApi';

export type LinkingKind = 'unlinked' | 'possible-matches' | 'conflicts' | 'verified';

type LinkRow = {
  playerId: string;
  localName: string;
  localCountry: string | null;
  localBirthDate: string | null;
  verificationStatus: string | null;
  score: number;
  provider: string | null;
  candidate: { name?: string; birthDate?: string | null; nationality?: string | null } | null;
  matchedFields: string[];
  conflictedFields: string[];
  hasExternalId: boolean;
  traceabilityScore: number;
};

const ENDPOINT: Record<LinkingKind, string> = {
  unlinked: '/api/admin/player-linking/unlinked',
  'possible-matches': '/api/admin/player-linking/possible-matches',
  conflicts: '/api/admin/player-linking/conflicts',
  verified: '/api/admin/player-linking/verified',
};

export default function PlayerLinkingPanel({ kind }: { kind: LinkingKind }) {
  const [rows, setRows] = useState<LinkRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(ENDPOINT[kind]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(playerId: string, action: 'approve' | 'reject' | 'conflict' | 'retry') {
    setBusy(playerId + action);
    try {
      await adminFetch(`/api/admin/player-linking/${playerId}/${action}`, {
        method: 'POST',
        body: '{}',
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <DataState isLoading loadingMessage="Cargando vínculos..." />;
  if (error) return <DataState isError errorMessage={`Error (${error}). ¿API corriendo?`} onRetry={load} />;
  if (!rows || rows.length === 0)
    return <p className="wc26-card p-4 text-sm text-wc26-text/55">Sin registros en esta categoría.</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-wc26-text/55">{rows.length} jugadores</p>
        <button type="button" onClick={load} className="wc26-btn-outline px-3 py-1 text-xs">
          <RefreshCw className="mr-1 inline h-3 w-3" /> Actualizar
        </button>
      </div>

      {rows.map(r => (
        <div key={r.playerId} className="wc26-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <Link to={`/players/${r.playerId}`} className="font-black text-wc26-text hover:text-wc26-blue">
                {r.localName}
              </Link>
              <p className="text-xs text-wc26-text/45">
                {r.localCountry ?? '—'} · nac. {r.localBirthDate ?? '—'}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  r.score >= 85
                    ? 'bg-wc26-green/15 text-wc26-green'
                    : r.score >= 70
                      ? 'bg-wc26-fifaYellow/15 text-wc26-fifaYellow'
                      : 'bg-wc26-gray100 text-wc26-text/50'
                }`}
              >
                score {r.score}
              </span>
              <p className="mt-1 text-[10px] text-wc26-text/40">trace {r.traceabilityScore}</p>
            </div>
          </div>

          {r.candidate && (
            <div className="mt-2 rounded-lg bg-wc26-gray100/60 p-2 text-xs">
              <p className="font-bold text-wc26-text/70">
                Candidato {r.provider ? `· ${r.provider}` : ''}: {r.candidate.name ?? '—'}
              </p>
              <p className="text-wc26-text/45">
                nac. {r.candidate.birthDate?.slice(0, 10) ?? '—'} · {r.candidate.nationality ?? '—'}
              </p>
            </div>
          )}

          <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
            {r.matchedFields.map(f => (
              <span key={f} className="rounded bg-wc26-green/10 px-2 py-0.5 font-bold text-wc26-green">
                ✓ {f}
              </span>
            ))}
            {r.conflictedFields.map(f => (
              <span key={f} className="rounded bg-red-500/10 px-2 py-0.5 font-bold text-red-400">
                ✗ {f}
              </span>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy === r.playerId + 'approve'}
              onClick={() => act(r.playerId, 'approve')}
              className="rounded-lg bg-wc26-green/15 px-3 py-1.5 text-xs font-black text-wc26-green disabled:opacity-50"
            >
              <Check className="mr-1 inline h-3 w-3" /> Aprobar
            </button>
            <button
              type="button"
              disabled={busy === r.playerId + 'reject'}
              onClick={() => act(r.playerId, 'reject')}
              className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-black text-red-400 disabled:opacity-50"
            >
              <X className="mr-1 inline h-3 w-3" /> Rechazar
            </button>
            <button
              type="button"
              disabled={busy === r.playerId + 'conflict'}
              onClick={() => act(r.playerId, 'conflict')}
              className="rounded-lg bg-wc26-fifaYellow/15 px-3 py-1.5 text-xs font-black text-wc26-fifaYellow disabled:opacity-50"
            >
              <AlertTriangle className="mr-1 inline h-3 w-3" /> Conflicto
            </button>
            <button
              type="button"
              disabled={busy === r.playerId + 'retry'}
              onClick={() => act(r.playerId, 'retry')}
              className="wc26-btn-outline px-3 py-1.5 text-xs disabled:opacity-50"
            >
              <RefreshCw className="mr-1 inline h-3 w-3" /> Reintentar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
