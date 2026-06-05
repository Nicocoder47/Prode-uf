import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Brain } from 'lucide-react';
import { motion } from 'framer-motion';
import { MOTION } from '../../constants/design';
import { AiInsights } from '../../components/premium/AiInsights';
import { PremiumGate } from '../../components/premium/PremiumGate';
import { TeamIntelligencePanel, PlayerIntelligencePanel } from '../../components/premium/IntelligencePanel';
import { TeamCrest } from '../../components/worldcup/TeamCrest';
import { PlayerAvatar } from '../../components/worldcup/PlayerAvatar';
import { DataState } from '../../components/ui/DataState';
import {
  useMatchIntelligence,
  usePlayerIntelligence,
  useTeamIntelligence,
} from '../../hooks/useIntelligence';
import { CompactMatchCard } from '../../components/worldcup/CompactMatchCard';

export default function IntelligencePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const type = params.get('type') as 'team' | 'player' | 'match' | null;
  const id = params.get('id') ?? '';

  const teamQ = useTeamIntelligence(type === 'team' ? id : undefined);
  const playerQ = usePlayerIntelligence(type === 'player' ? id : undefined);
  const matchQ = useMatchIntelligence(type === 'match' ? id : undefined);

  const isLoading =
    (type === 'team' && teamQ.isLoading) ||
    (type === 'player' && playerQ.isLoading) ||
    (type === 'match' && matchQ.isLoading);

  const isError =
    (type === 'team' && teamQ.isError) ||
    (type === 'player' && playerQ.isError) ||
    (type === 'match' && matchQ.isError);

  if (!type || !id || !['team', 'player', 'match'].includes(type)) {
    return (
      <div className="wc26-card p-8 text-center">
        <p className="text-wc26-text/60">Seleccioná un equipo, jugador o partido para ver inteligencia.</p>
        <Link to="/" className="mt-3 inline-block font-bold text-wc26-blue">Ir al inicio</Link>
      </div>
    );
  }

  if (isLoading) return <DataState isLoading loadingMessage="Analizando datos..." />;
  if (isError) return <DataState isError errorMessage="No pudimos cargar el análisis." />;

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
          <Brain className="h-5 w-5 text-wc26-fifaYellow" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-wc26-fifaYellow">Inteligencia</p>
        </div>
        <h1 className="text-2xl font-extrabold text-white">Centro de Análisis</h1>
        <p className="mt-1 text-sm text-white/75">Datos reales del torneo · sin simulaciones</p>
      </header>

      <PremiumGate
        feature="intelligence"
        preview={
          <div className="wc26-card h-48 p-6">
            <div className="h-full rounded-2xl bg-wc26-gray100" />
          </div>
        }
      >
        {type === 'team' && teamQ.intelligence && (
          <>
            <div className="flex items-center gap-3 px-1">
              <TeamCrest flag={teamQ.team!.flag} code={teamQ.team!.code} size="md" />
              <div>
                <h2 className="text-xl font-black text-white">{teamQ.team!.name}</h2>
                <Link to={`/teams/${id}/advanced-stats`} className="text-xs font-bold text-wc26-fifaYellow">
                  Ver estadísticas avanzadas →
                </Link>
              </div>
            </div>
            <PremiumGate feature="aiInsights" preview={<div className="h-32 rounded-[28px] bg-wc26-night900" />}>
              <AiInsights type="team" data={teamQ.intelligence} />
            </PremiumGate>
            <TeamIntelligencePanel data={teamQ.intelligence} />
          </>
        )}

        {type === 'player' && playerQ.intelligence && (
          <>
            <div className="flex items-center gap-3 px-1">
              <PlayerAvatar
                photo={playerQ.player!.photo}
                photoUrl={playerQ.player!.photoUrl}
                name={playerQ.player!.name}
                size="md"
              />
              <h2 className="text-xl font-black text-white">{playerQ.player!.name}</h2>
            </div>
            <PremiumGate feature="aiInsights" preview={<div className="h-32 rounded-[28px] bg-wc26-night900" />}>
              <AiInsights type="player" data={playerQ.intelligence} />
            </PremiumGate>
            <PlayerIntelligencePanel data={playerQ.intelligence} />
          </>
        )}

        {type === 'match' && matchQ.intelligence && (
          <>
            <CompactMatchCard match={matchQ.match!} featured />
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="wc26-section-title">{matchQ.match!.homeTeam!.name}</p>
                <PremiumGate feature="aiInsights" preview={<div className="h-24 rounded-[28px] bg-wc26-night900" />}>
                  <AiInsights type="team" data={matchQ.intelligence.home} />
                </PremiumGate>
                <TeamIntelligencePanel data={matchQ.intelligence.home} />
              </div>
              <div>
                <p className="wc26-section-title">{matchQ.match!.awayTeam!.name}</p>
                <PremiumGate feature="aiInsights" preview={<div className="h-24 rounded-[28px] bg-wc26-night900" />}>
                  <AiInsights type="team" data={matchQ.intelligence.away} />
                </PremiumGate>
                <TeamIntelligencePanel data={matchQ.intelligence.away} />
              </div>
            </div>
            {matchQ.intelligence.headToHead.length > 0 && (
              <section>
                <p className="wc26-section-title">Historial directo</p>
                <p className="wc26-card p-4 text-sm text-wc26-text/55">
                  {matchQ.intelligence.headToHead.length} encuentro(s) previo(s) registrado(s).
                </p>
              </section>
            )}
          </>
        )}
      </PremiumGate>
    </div>
  );
}
