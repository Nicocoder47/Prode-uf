import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MOTION } from '../../constants/design';
import { adminFetch } from '../../lib/adminApi';

type TeamCoverageRow = {
  teamId: string;
  teamName: string;
  players: number;
  verified: number;
  verifiedPct: number;
  photos: number;
  photoPct: number;
  clubs: number;
  clubPct: number;
  ratings: number;
  ratingPct: number;
  marketValues: number;
  marketValuePct: number;
  uiReadiness: 'READY_FOR_UI' | 'IN_PROGRESS';
  isPriority: boolean;
};

type PriorityStatus = {
  totalPriority: number;
  readyCount: number;
  allReady: boolean;
  readyTeams: string[];
  pendingTeams: string[];
};

function MetricBar({ label, pct, tone = 'green' }: { label: string; pct: number; tone?: 'green' | 'blue' | 'gold' | 'red' }) {
  const color =
    tone === 'blue' ? 'bg-wc26-blue' : tone === 'gold' ? 'bg-wc26-fifaYellow' : tone === 'red' ? 'bg-wc26-red' : 'bg-wc26-green';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-wc26-text/50">
        <span>{label}</span>
        <span className="text-wc26-text">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-wc26-gray100">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export default function TeamCoveragePanel({
  runEnrich,
  actionMsg,
}: {
  runEnrich: (path: string, label: string, body?: Record<string, unknown>) => void;
  actionMsg: string | null;
}) {
  const [teams, setTeams] = useState<TeamCoverageRow[]>([]);
  const [priority, setPriority] = useState<PriorityStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminFetch('/api/admin/player-linking/team-progress').then(r => r.json()),
      adminFetch('/api/admin/player-linking/priority-status').then(r => r.json()),
    ])
      .then(([progress, pri]) => {
        setTeams(progress);
        setPriority(pri);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [actionMsg]);

  const ordered = [...teams].sort((a, b) => {
    if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
    if (a.uiReadiness !== b.uiReadiness) return a.uiReadiness === 'READY_FOR_UI' ? -1 : 1;
    return a.verifiedPct - b.verifiedPct;
  });

  if (loading) {
    return <p className="wc26-card p-5 text-center text-sm text-wc26-text/55">Cargando cobertura por equipo...</p>;
  }

  return (
    <div className="space-y-4">
      {priority && (
        <div className="wc26-card p-4">
          <p className="wc26-section-title">Equipos prioritarios · READY_FOR_UI</p>
          <p className="text-sm text-wc26-text/60">
            {priority.readyCount}/{priority.totalPriority} listos · umbral ≥80% verified / foto / club
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-wc26-gray100">
            <div
              className="h-full rounded-full bg-wc26-green transition-all"
              style={{ width: `${(priority.readyCount / priority.totalPriority) * 100}%` }}
            />
          </div>
          {priority.allReady ? (
            <p className="mt-2 text-xs font-black text-wc26-green">Gate abierto — podés ejecutar enrich global</p>
          ) : (
            <p className="mt-2 text-xs font-bold text-wc26-text/45">
              Pendientes: {priority.pendingTeams.join(', ') || '—'}
            </p>
          )}
        </div>
      )}

      <motion.div {...MOTION.enter} className="space-y-3">
        {ordered.map(team => (
          <div key={team.teamId} className="wc26-card overflow-hidden p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-wc26-text">{team.teamName}</span>
                  {team.isPriority && (
                    <span className="rounded-full bg-wc26-blue/10 px-2 py-0.5 text-[9px] font-black uppercase text-wc26-blue">
                      Prioritario
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                      team.uiReadiness === 'READY_FOR_UI'
                        ? 'bg-wc26-green/15 text-wc26-green'
                        : 'bg-wc26-gray100 text-wc26-text/45'
                    }`}
                  >
                    {team.uiReadiness === 'READY_FOR_UI' ? 'READY_FOR_UI' : 'En progreso'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-wc26-text/45">
                  {team.players} jugadores · ver {team.verified} · fotos {team.photos} · clubes {team.clubs}
                </p>
              </div>
              {team.isPriority && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      runEnrich(`/api/admin/link/country/${encodeURIComponent(team.teamName)}`, `Link ${team.teamName}`, {
                        batchSize: 26,
                      })
                    }
                    className="text-xs font-bold text-wc26-blue"
                  >
                    Link
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      runEnrich(`/api/admin/enrich/team/${team.teamId}`, `Enrich ${team.teamName}`, { verified: true })
                    }
                    className="text-xs font-bold text-[#006B3F]"
                  >
                    Enrich
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      runEnrich('/api/admin/enrich/missing-photos', `Fotos ${team.teamName}`, {
                        batchSize: 50,
                        teamId: team.teamId,
                      })
                    }
                    className="text-xs font-bold text-wc26-text/55"
                  >
                    Fotos
                  </button>
                </div>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <MetricBar label="Verified" pct={team.verifiedPct} />
              <MetricBar label="Fotos" pct={team.photoPct} tone="blue" />
              <MetricBar label="Clubes" pct={team.clubPct} tone="green" />
              <MetricBar label="Rating" pct={team.ratingPct} tone="gold" />
              <MetricBar label="Market value" pct={team.marketValuePct} tone="red" />
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
