import { useCallback, useEffect, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { DataState } from '../../components/ui/DataState';
import { adminFetch } from '../../lib/adminApi';

type CountryRow = {
  id: string;
  name: string;
  fifa_code: string | null;
  iso3: string | null;
  verification_status: string | null;
};

export default function CountryLinkingPanel() {
  const [rows, setRows] = useState<CountryRow[] | null>(null);
  const [status, setStatus] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, u] = await Promise.all([
        adminFetch('/api/admin/country-linking/status').then(r => r.json()),
        adminFetch('/api/admin/country-linking/unlinked').then(r => r.json()),
      ]);
      setStatus(s);
      setRows(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(id: string) {
    setBusy(id);
    try {
      await adminFetch(`/api/admin/country-linking/${id}/approve`, {
        method: 'POST',
        body: '{}',
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <DataState isLoading loadingMessage="Cargando países..." />;
  if (error) return <DataState isError errorMessage={`Error (${error}). ¿API corriendo?`} onRetry={load} />;

  return (
    <div className="space-y-3">
      {status && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { l: 'Total', v: status.total },
            { l: 'Verificados', v: status.verified },
            { l: 'Revisión', v: status.needsReview },
            { l: 'Conflicto', v: status.conflict },
            { l: 'Sin código', v: status.missingCodes },
          ].map(s => (
            <div key={s.l} className="wc26-stat-card text-center">
              <p className="text-2xl font-black text-wc26-text">{s.v ?? 0}</p>
              <p className="text-[10px] font-black uppercase text-wc26-text/45">{s.l}</p>
            </div>
          ))}
        </div>
      )}

      <p className="wc26-section-title">Países sin vínculo / pendientes</p>
      {(!rows || rows.length === 0) && (
        <p className="wc26-card p-4 text-sm text-wc26-text/55">Todos los países están vinculados.</p>
      )}
      <div className="wc26-card divide-y divide-wc26-gray100 overflow-hidden">
        {(rows ?? []).map(c => (
          <div key={c.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-black text-wc26-text">{c.name}</p>
              <p className="text-xs text-wc26-text/45">
                FIFA {c.fifa_code ?? '—'} · ISO3 {c.iso3 ?? '—'} · {c.verification_status ?? 'unlinked'}
              </p>
            </div>
            <button
              type="button"
              disabled={busy === c.id}
              onClick={() => approve(c.id)}
              className="rounded-lg bg-wc26-green/15 px-3 py-1.5 text-xs font-black text-wc26-green disabled:opacity-50"
            >
              <Check className="mr-1 inline h-3 w-3" /> Aprobar
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={load} className="wc26-btn-outline px-3 py-1.5 text-xs">
        <RefreshCw className="mr-1 inline h-3 w-3" /> Actualizar
      </button>
    </div>
  );
}
