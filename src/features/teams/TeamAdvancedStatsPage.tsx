import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { MOTION } from '../../constants/design';
import { AiInsights } from '../../components/premium/AiInsights';
import { PremiumGate } from '../../components/premium/PremiumGate';
import { TeamIntelligencePanel } from '../../components/premium/IntelligencePanel';
import { FormBreakdownCard, FormStrip, StatBar } from '../../components/premium/StatVisualizations';
import { TeamHeroCard } from '../../components/premium/TeamHeroCard';
import { IntelligenceLink } from '../../components/premium/IntelligenceLink';
import { DataState } from '../../components/ui/DataState';
import { useTeamIntelligence } from '../../hooks/useIntelligence';
import { useTeamPlayers, useTeamStanding, useWorldCupTeam } from '../../useWorldCupData';
import { computeAverageAge, computeSquadValue, formBreakdown } from '../../utils/teamAnalytics';
import { normalizeGroupId } from '../../constants/groups';
import { useMemo } from 'react';

export default function TeamAdvancedStatsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: team, isLoading, isError } = useWorldCupTeam(id);
  const { data: players = [] } = useTeamPlayers(id);
  const { data: standing } = useTeamStanding(id);
  const { intelligence } = useTeamIntelligence(id);

  const groupId = useMemo(
    () => (team?.group ? normalizeGroupId(team.group) : ''),
    [team],
  );
  const squadValue = useMemo(() => computeSquadValue(players), [players]);
  const averageAge = useMemo(() => computeAverageAge(players), [players]);
  const formStats = useMemo(
    () => (intelligence ? formBreakdown(intelligence.form) : { wins: 0, draws: 0, losses: 0 }),
    [intelligence],
  );

  if (isLoading) return <DataState isLoading loadingMessage="Cargando estadísticas..." />;
  if (isError || !team) {
    return (
      <div className="wc26-card p-8 text-center">
        <p className="text-wc26-text/60">Equipo no encontrado.</p>
        <Link to="/teams" className="mt-3 inline-block font-bold text-wc26-blue">Ver selecciones</Link>
      </div>
    );
  }

  const maxG = intelligence
    ? Math.max(intelligence.goalsFor, intelligence.goalsAgainst, standing?.goalsFor ?? 0, 1)
    : 1;

  return (
    <div className="space-y-4 pb-6">
      <motion.button
        type="button"
        onClick={() => navigate(-1)}
        {...MOTION.tap}
        className="flex items-center gap-2 rounded-full wc26-glass px-3 py-2 text-sm font-bold text-white/90"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </motion.button>

      <header className="wc26-page-header">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-wc26-fifaYellow" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-wc26-fifaYellow">Premium</p>
        </div>
        <h1 className="text-2xl font-extrabold text-white">Estadísticas Avanzadas</h1>
        <p className="mt-1 text-sm text-white/75">{team.name}</p>
      </header>

      <TeamHeroCard
        team={team}
        groupId={groupId}
        squadSize={players.length}
        fifaRanking={team.fifaRanking}
        squadValue={squadValue}
        averageAge={averageAge}
        coach={team.coach}
        form={intelligence?.form ?? []}
      />

      <IntelligenceLink type="team" id={team.id} label="Centro de Inteligencia completo" />

      <PremiumGate
        feature="advancedStats"
        preview={
          <div className="space-y-3">
            <div className="wc26-card h-40" />
            <div className="wc26-card h-56" />
          </div>
        }
      >
        {intelligence && (
          <>
            <PremiumGate feature="aiInsights" preview={<div className="h-28 rounded-[28px] bg-wc26-night900" />}>
              <AiInsights type="team" data={intelligence} />
            </PremiumGate>

            {intelligence.form.length > 0 && (
              <div className="wc26-card-intelligence p-5">
                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-white/45">
                  Forma · últimos 10
                </p>
                <FormStrip form={intelligence.form} />
                <p className="mt-3 text-center font-mono text-lg font-black tracking-[0.2em] text-white">
                  {intelligence.form.join('')}
                </p>
              </div>
            )}

            {intelligence.sampleSize > 0 && (
              <FormBreakdownCard
                wins={formStats.wins}
                draws={formStats.draws}
                losses={formStats.losses}
                title="Victorias · Empates · Derrotas"
              />
            )}

            <div className="wc26-card space-y-4 p-5">
              <p className="wc26-section-title">Rendimiento ofensivo / defensivo</p>
              <StatBar label="Goles a favor (ventana)" value={intelligence.goalsFor} max={maxG} color="green" />
              <StatBar label="Goles en contra (ventana)" value={intelligence.goalsAgainst} max={maxG} color="blue" />
              {standing && (
                <>
                  <StatBar label="Goles a favor (torneo)" value={standing.goalsFor} max={maxG} color="gold" />
                  <StatBar label="Goles en contra (torneo)" value={standing.goalsAgainst} max={maxG} color="green" />
                </>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { l: 'DG ventana', v: intelligence.sampleSize > 0 ? intelligence.goalDifference : '—' },
                { l: 'Oficiales', v: intelligence.officialMatches },
                { l: 'Índice', v: intelligence.formIndex ?? '—' },
              ].map(s => (
                <div key={s.l} className="wc26-stat-card text-center">
                  <p className="text-2xl font-black text-wc26-text">{s.v}</p>
                  <p className="text-[10px] font-black uppercase text-wc26-text/45">{s.l}</p>
                </div>
              ))}
            </div>

            <TeamIntelligencePanel data={intelligence} />
          </>
        )}

        {!intelligence && (
          <DataState isEmpty emptyMessage="Las estadísticas avanzadas estarán disponibles cuando haya partidos finalizados." />
        )}
      </PremiumGate>
    </div>
  );
}
