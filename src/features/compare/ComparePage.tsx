import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitCompare, Sparkles } from 'lucide-react';
import { MOTION } from '../../constants/design';
import { PremiumGate } from '../../components/premium/PremiumGate';
import { FormStrip } from '../../components/premium/StatVisualizations';
import { TeamCrest } from '../../components/worldcup/TeamCrest';
import { DataState } from '../../components/ui/DataState';
import { useTeamCompare } from '../../hooks/useIntelligence';
import { useWorldCupTeams } from '../../useWorldCupData';
import { fmtMarketCompact } from '../../utils/teamAnalytics';
import { fmtOptional } from '../../utils/formatDisplay';
import { usePremiumTokens } from '../../hooks/usePremiumTokens';

function CompareMetric({
  label,
  left,
  right,
  highlight,
}: {
  label: string;
  left: string | number;
  right: string | number;
  highlight?: 'left' | 'right' | 'tie';
}) {
  return (
    <div className="wc26-card overflow-hidden p-0">
      <p className="bg-wc26-gray100/80 px-4 py-2 text-center text-[10px] font-black uppercase tracking-widest text-wc26-text/45">
        {label}
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-4">
        <p
          className={`text-center text-lg font-black ${
            highlight === 'left' ? 'text-wc26-green' : 'text-wc26-text'
          }`}
        >
          {left}
        </p>
        <span className="rounded-full bg-wc26-night900 px-2 py-1 text-[10px] font-black text-white">VS</span>
        <p
          className={`text-center text-lg font-black ${
            highlight === 'right' ? 'text-wc26-green' : 'text-wc26-text'
          }`}
        >
          {right}
        </p>
      </div>
    </div>
  );
}

function pickHighlight(a: number | null, b: number | null, higherBetter = true): 'left' | 'right' | 'tie' | undefined {
  if (a == null || b == null) return undefined;
  if (a === b) return 'tie';
  if (higherBetter) return a > b ? 'left' : 'right';
  return a < b ? 'left' : 'right';
}

export default function ComparePage() {
  const { data: teams = [], isLoading } = useWorldCupTeams();
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const { addTokens, balance } = usePremiumTokens();

  const left = useTeamCompare(leftId || undefined);
  const right = useTeamCompare(rightId || undefined);

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams],
  );

  const canCompare = left && right && leftId && rightId && leftId !== rightId;

  return (
    <div className="space-y-4 pb-6">
      <header className="wc26-page-header">
        <div className="flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-wc26-fifaYellow" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-wc26-fifaYellow">Premium</p>
        </div>
        <h1 className="text-2xl font-extrabold text-white">Comparador</h1>
        <p className="mt-1 text-sm text-white/75">Análisis cara a cara · datos reales</p>
      </header>

      {import.meta.env.DEV && (
        <button
          type="button"
          onClick={() => addTokens(10)}
          className="text-xs font-bold text-wc26-fifaYellow underline"
        >
          [Dev] +10 tokens (saldo: {balance})
        </button>
      )}

      {isLoading ? (
        <DataState isLoading loadingMessage="Cargando equipos..." />
      ) : (
        <div className="wc26-card grid gap-3 p-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase text-wc26-text/45">Equipo A</label>
            <select value={leftId} onChange={e => setLeftId(e.target.value)} className="wc26-input text-sm">
              <option value="">Seleccionar...</option>
              {sortedTeams.map(t => (
                <option key={t.id} value={t.id} disabled={t.id === rightId}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase text-wc26-text/45">Equipo B</label>
            <select value={rightId} onChange={e => setRightId(e.target.value)} className="wc26-input text-sm">
              <option value="">Seleccionar...</option>
              {sortedTeams.map(t => (
                <option key={t.id} value={t.id} disabled={t.id === leftId}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {leftId && rightId && leftId === rightId && (
        <p className="wc26-card p-4 text-center text-sm text-wc26-text/55">Elegí dos equipos distintos.</p>
      )}

      {canCompare && (
        <PremiumGate
          feature="compare"
          preview={
            <div className="space-y-3">
              <div className="wc26-card h-32" />
              <div className="wc26-card h-48" />
            </div>
          }
        >
          <motion.div {...MOTION.enter} className="space-y-4">
            <div className="wc26-card-intelligence grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-5">
              <div className="flex flex-col items-center gap-2 text-center">
                <TeamCrest flag={left.team.flag} code={left.team.code} size="lg" />
                <p className="font-black text-white">{left.team.code}</p>
              </div>
              <div className="flex flex-col items-center">
                <Sparkles className="h-6 w-6 text-wc26-fifaYellow" />
                <p className="text-xs font-black text-white/60">VS</p>
              </div>
              <div className="flex flex-col items-center gap-2 text-center">
                <TeamCrest flag={right.team.flag} code={right.team.code} size="lg" />
                <p className="font-black text-white">{right.team.code}</p>
              </div>
            </div>

            <CompareMetric
              label="Ranking FIFA"
              left={fmtOptional(left.fifaRanking != null ? `#${left.fifaRanking}` : null, '—')}
              right={fmtOptional(right.fifaRanking != null ? `#${right.fifaRanking}` : null, '—')}
              highlight={pickHighlight(left.fifaRanking, right.fifaRanking, false)}
            />
            <CompareMetric
              label="Valor plantel"
              left={fmtMarketCompact(left.squadValue) ?? '—'}
              right={fmtMarketCompact(right.squadValue) ?? '—'}
              highlight={pickHighlight(left.squadValue, right.squadValue)}
            />
            <CompareMetric
              label="Edad promedio"
              left={fmtOptional(left.averageAge, '—')}
              right={fmtOptional(right.averageAge, '—')}
            />
            <CompareMetric
              label="Índice de forma"
              left={fmtOptional(left.formIndex, '—')}
              right={fmtOptional(right.formIndex, '—')}
              highlight={pickHighlight(left.formIndex, right.formIndex)}
            />
            <CompareMetric
              label="Victorias (últ. 10)"
              left={left.wins}
              right={right.wins}
              highlight={pickHighlight(left.wins, right.wins)}
            />
            <CompareMetric
              label="Derrotas (últ. 10)"
              left={left.losses}
              right={right.losses}
              highlight={pickHighlight(left.losses, right.losses, false)}
            />
            <CompareMetric
              label="Goles a favor"
              left={left.goalsFor}
              right={right.goalsFor}
              highlight={pickHighlight(left.goalsFor, right.goalsFor)}
            />
            <CompareMetric
              label="Goles en contra"
              left={left.goalsAgainst}
              right={right.goalsAgainst}
              highlight={pickHighlight(left.goalsAgainst, right.goalsAgainst, false)}
            />
            <CompareMetric
              label="Diferencia de gol"
              left={left.goalDifference > 0 ? `+${left.goalDifference}` : left.goalDifference}
              right={right.goalDifference > 0 ? `+${right.goalDifference}` : right.goalDifference}
              highlight={pickHighlight(left.goalDifference, right.goalDifference)}
            />

            {(left.form.length > 0 || right.form.length > 0) && (
              <div className="wc26-card space-y-4 p-5">
                <p className="wc26-section-title">Forma reciente</p>
                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs font-black text-wc26-text/45">{left.team.code}</p>
                    {left.form.length > 0 ? <FormStrip form={left.form} /> : <p className="text-sm text-wc26-text/40">—</p>}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-black text-wc26-text/45">{right.team.code}</p>
                    {right.form.length > 0 ? <FormStrip form={right.form} /> : <p className="text-sm text-wc26-text/40">—</p>}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Link
                to={`/intelligence?type=team&id=${left.team.id}`}
                className="wc26-btn-outline flex-1 py-3 text-center text-xs"
              >
                Intel {left.team.code}
              </Link>
              <Link
                to={`/intelligence?type=team&id=${right.team.id}`}
                className="wc26-btn-outline flex-1 py-3 text-center text-xs"
              >
                Intel {right.team.code}
              </Link>
            </div>
          </motion.div>
        </PremiumGate>
      )}
    </div>
  );
}
