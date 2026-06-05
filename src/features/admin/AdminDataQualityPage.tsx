import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RefreshCw, Sparkles, Users } from 'lucide-react';
import { MOTION } from '../../constants/design';
import { DataState } from '../../components/ui/DataState';
import PlayerLinkingPanel from './PlayerLinkingPanel';
import CountryLinkingPanel from './CountryLinkingPanel';
import TeamCoveragePanel from './TeamCoveragePanel';
import { adminFetch } from '../../lib/adminApi';

type AdminTab =
  | 'summary'
  | 'coverage'
  | 'countries'
  | 'verified'
  | 'unlinked'
  | 'possible-matches'
  | 'conflicts'
  | 'missing-fields'
  | 'review';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'summary', label: 'Resumen' },
  { id: 'coverage', label: 'Cobertura equipos' },
  { id: 'countries', label: 'Países' },
  { id: 'verified', label: 'Verificados' },
  { id: 'unlinked', label: 'Sin vínculo' },
  { id: 'possible-matches', label: 'Posibles' },
  { id: 'conflicts', label: 'Conflictos' },
  { id: 'missing-fields', label: 'Faltantes' },
  { id: 'review', label: 'Revisión' },
];

type QualityReport = {
  total: number;
  complete: number;
  incomplete: number;
  pending: number;
  needsReview: number;
  coverage: { field: string; count: number; pct: number }[];
  worstTeams: { teamName: string; avgQuality: number; incomplete: number; players: number }[];
  topIncomplete: { name: string; score: number; missing: number; id: string }[];
  duplicateGroups: number;
  withoutExternalId: number;
  providers: Record<string, boolean>;
  identity?: {
    verified: number;
    verifiedPct: number;
    needsReview: number;
    conflict: number;
    rejected: number;
    photoPct: number;
    clubPct: number;
    marketValuePct: number;
    withPhoto: number;
    withClub: number;
    withMarketValue: number;
    withoutPhoto: number;
  };
  teamProgress?: { teamName: string; players: number; avgQuality: number; incomplete: number }[];
};

export default function AdminDataQualityPage() {
  const [report, setReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>('summary');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/player-data-quality');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReport(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando reporte');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runEnrich(path: string, label: string, body: Record<string, unknown> = {}) {
    setActionMsg(`Ejecutando ${label}...`);
    try {
      const res = await adminFetch(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setActionMsg(`${label}: ${JSON.stringify(data)}`);
      await load();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  const avgQuality = report
    ? report.coverage.reduce((s, c) => s + c.pct, 0) / (report.coverage.length || 1)
    : 0;

  return (
    <div className="space-y-5 pb-8">
      <header className="wc26-page-header">
        <p className="text-[11px] font-bold uppercase tracking-wider text-wc26-fifaYellow">Admin</p>
        <h1 className="text-2xl font-extrabold text-white">Calidad de datos · Jugadores</h1>
        <p className="mt-1 text-sm text-white/75">Identidad · trazabilidad · revisión manual</p>
      </header>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-black transition ${
              tab === t.id ? 'bg-wc26-blue text-white' : 'bg-wc26-gray100 text-wc26-text/55'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'countries' && <CountryLinkingPanel />}
      {tab === 'coverage' && <TeamCoveragePanel runEnrich={runEnrich} actionMsg={actionMsg} />}
      {tab === 'verified' && <PlayerLinkingPanel kind="verified" />}
      {tab === 'unlinked' && <PlayerLinkingPanel kind="unlinked" />}
      {tab === 'possible-matches' && <PlayerLinkingPanel kind="possible-matches" />}
      {tab === 'conflicts' && <PlayerLinkingPanel kind="conflicts" />}
      {tab === 'review' && <PlayerLinkingPanel kind="possible-matches" />}

      {(tab === 'summary' || tab === 'missing-fields') && loading && (
        <DataState isLoading loadingMessage="Cargando calidad de datos..." />
      )}
      {(tab === 'summary' || tab === 'missing-fields') && error && (
        <DataState
          isError
          errorMessage={`No se pudo cargar el panel (${error}). ¿Está corriendo npm run api:serve?`}
          onRetry={load}
        />
      )}

      {tab === 'summary' && report && (
        <SummaryView report={report} avgQuality={avgQuality} runEnrich={runEnrich} load={load} actionMsg={actionMsg} />
      )}

      {tab === 'missing-fields' && report && (
        <div className="wc26-card p-4">
          <p className="wc26-section-title">Datos faltantes por campo</p>
          <div className="space-y-2">
            {[...report.coverage]
              .sort((a, b) => a.pct - b.pct)
              .map(c => (
                <div key={c.field} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-wc26-text/60">{c.field}</span>
                    <span className="font-black text-red-400">{(100 - c.pct).toFixed(1)}% faltante</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-wc26-gray100">
                    <div className="h-full bg-wc26-green" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryView({
  report,
  avgQuality,
  runEnrich,
  load,
  actionMsg,
}: {
  report: QualityReport;
  avgQuality: number;
  runEnrich: (path: string, label: string, body?: Record<string, unknown>) => void;
  load: () => void;
  actionMsg: string | null;
}) {
  const id = report.identity;
  const [teamProgress, setTeamProgress] = useState<Array<{
    teamId: string;
    teamName: string;
    verified: number;
    verifiedPct: number;
    photos: number;
    players: number;
  }>>([]);

  useEffect(() => {
    adminFetch('/api/admin/player-linking/team-progress')
      .then(r => r.json())
      .then(setTeamProgress)
      .catch(() => {});
  }, [actionMsg]);

  const priority = ['Brazil', 'France', 'England', 'Spain', 'Portugal', 'Germany', 'Netherlands', 'Uruguay', 'Belgium', 'Argentina'];
  const orderedTeams = [...teamProgress].sort((a, b) => {
    const ai = priority.indexOf(a.teamName);
    const bi = priority.indexOf(b.teamName);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.verifiedPct - b.verifiedPct;
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: 'Con foto', v: id ? `${id.withPhoto}` : '—' },
          { l: 'Sin foto', v: id ? `${id.withoutPhoto ?? report.total - id.withPhoto}` : '—' },
          { l: 'Verificados', v: id ? `${id.verified} (${id.verifiedPct}%)` : '—' },
          { l: 'En revisión', v: id ? `${id.needsReview}` : '—' },
        ].map(s => (
          <div key={s.l} className="wc26-stat-card text-center">
            <p className="text-xl font-black text-wc26-text">{s.v}</p>
            <p className="text-[10px] font-black uppercase text-wc26-text/45">{s.l}</p>
          </div>
        ))}
      </div>

      {id && (
        <div className="wc26-card p-4">
          <p className="wc26-section-title">Identidad global</p>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            <div><span className="text-wc26-text/50">Conflictos</span><p className="font-black">{id.conflict}</p></div>
            <div><span className="text-wc26-text/50">Rechazados</span><p className="font-black">{id.rejected}</p></div>
            <div><span className="text-wc26-text/50">Clubes</span><p className="font-black">{id.withClub} ({id.clubPct}%)</p></div>
            <div><span className="text-wc26-text/50">Fotos</span><p className="font-black">{id.withPhoto} ({id.photoPct}%)</p></div>
            <div><span className="text-wc26-text/50">Sin foto</span><p className="font-black">{id.withoutPhoto ?? '—'}</p></div>
          </div>
        </div>
      )}

      <div className="wc26-card p-4">
        <p className="wc26-section-title">Cobertura por campo</p>
        <div className="space-y-2">
          {report.coverage.map(c => (
            <div key={c.field} className="flex items-center justify-between text-sm">
              <span className="font-semibold text-wc26-text/60">{c.field}</span>
              <span className="font-black text-wc26-green">{c.pct}%</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-wc26-text/45">Promedio cobertura: {avgQuality.toFixed(1)}%</p>
      </div>

      <div className="wc26-card p-4">
        <p className="wc26-section-title">Providers</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(report.providers).map(([k, ok]) => (
            <span
              key={k}
              className={`rounded-full px-3 py-1 text-xs font-black ${ok ? 'bg-wc26-green/15 text-wc26-green' : 'bg-wc26-gray100 text-wc26-text/45'}`}
            >
              {k}: {ok ? 'OK' : 'off'}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-wc26-text/45">
          Sin external_id: {report.withoutExternalId} · Duplicados por nombre: {report.duplicateGroups}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => runEnrich('/api/admin/enrich/players', 'Enrich verificados', { verified: true, batchSize: 50 })} className="wc26-btn-blue px-4 py-2 text-xs">
          <Sparkles className="mr-1 inline h-4 w-4" /> Enrich verificados
        </button>
        <button type="button" onClick={() => runEnrich('/api/admin/enrich/missing-photos', 'Fotos faltantes', { batchSize: 50, resume: true })} className="wc26-btn-blue px-4 py-2 text-xs">
          Enriquecer fotos faltantes
        </button>
        <button type="button" onClick={() => runEnrich('/api/admin/enrich/verified/resume', 'Resume enrich', { batchSize: 50 })} className="wc26-btn-outline px-4 py-2 text-xs">
          Resume enrich
        </button>
        <button type="button" onClick={load} className="wc26-btn-outline px-4 py-2 text-xs">
          <RefreshCw className="mr-1 inline h-4 w-4" /> Actualizar
        </button>
        <Link to="/admin" className="wc26-btn-outline px-4 py-2 text-xs">← Admin</Link>
      </div>

      {actionMsg && <p className="wc26-card p-3 text-xs text-wc26-text/60">{actionMsg}</p>}

      <section>
        <p className="wc26-section-title">Procesar por selección</p>
        <div className="wc26-card divide-y divide-wc26-gray100 overflow-hidden">
          {orderedTeams.slice(0, 12).map(t => (
            <div key={t.teamId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <span className="font-bold">{t.teamName}</span>
                <span className="ml-2 text-wc26-text/45">
                  ver {t.verified}/{t.players} · fotos {t.photos}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => runEnrich(`/api/admin/link/country/${encodeURIComponent(t.teamName)}`, `Link ${t.teamName}`, { batchSize: 26 })}
                  className="text-xs font-bold text-wc26-blue"
                >
                  Vincular
                </button>
                <button
                  type="button"
                  onClick={() => runEnrich(`/api/admin/enrich/team/${t.teamId}`, `Enrich ${t.teamName}`, { verified: true })}
                  className="text-xs font-bold text-[#006B3F]"
                >
                  Enriquecer
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="wc26-section-title">Equipos con peor calidad</p>
        <div className="wc26-card divide-y divide-wc26-gray100 overflow-hidden">
          {report.worstTeams.map(t => (
            <div key={t.teamName} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-bold">{t.teamName}</span>
              <span className="text-wc26-text/50">avg {t.avgQuality} · {t.incomplete}/{t.players}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="wc26-section-title">Jugadores más incompletos</p>
        <motion.div {...MOTION.enter} className="wc26-card divide-y divide-wc26-gray100 overflow-hidden">
          {report.topIncomplete.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <Users className="h-4 w-4 text-wc26-text/35" />
              <div className="min-w-0 flex-1">
                <Link to={`/players/${p.id}`} className="font-black text-wc26-text hover:text-wc26-blue">
                  {p.name}
                </Link>
                <p className="text-xs text-wc26-text/45">Score {p.score} · faltan {p.missing} campos</p>
              </div>
              <button
                type="button"
                onClick={() => runEnrich(`/api/admin/enrich/players/${p.id}`, p.name)}
                className="text-xs font-bold text-wc26-blue"
              >
                Enrich
              </button>
            </div>
          ))}
        </motion.div>
      </section>
    </div>
  );
}
