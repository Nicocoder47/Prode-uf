import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { GRADIENTS, MOTION } from '../../constants/design';
import { normalizeGroupId, WC26_GROUP_NAMES } from '../../constants/groups';
import { CompactMatchCard } from '../../components/worldcup/CompactMatchCard';
import { TeamCrest } from '../../components/worldcup/TeamCrest';
import { useGroupsOverview, useGroupMatches } from '../../useWorldCupData';
import { DataState } from '../../components/ui/DataState';
import { EMPTY } from '../../utils/emptyState';

export default function GroupDetailPage() {
  const { groupId = '' } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const id = normalizeGroupId(groupId);
  const valid = WC26_GROUP_NAMES.includes(id as (typeof WC26_GROUP_NAMES)[number]);

  const { data: groups = [], isLoading, isError, refetch } = useGroupsOverview();
  const { data: matches = [], isLoading: matchesLoading, isError: matchesError, refetch: refetchMatches } = useGroupMatches(valid ? id : undefined);

  const group = groups.find(g => g.id === id);
  const standings = group?.standings ?? [];

  if (!valid) {
    return (
      <div className="wc26-card p-8 text-center">
        <p className="text-wc26-text/60">Grupo no válido.</p>
        <Link to="/groups" className="mt-3 inline-block font-bold text-wc26-blue">Ver todos los grupos</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <button
        type="button"
        onClick={() => navigate('/groups')}
        className="flex items-center gap-2 text-sm font-semibold text-white/90"
      >
        <ArrowLeft className="h-4 w-4" /> Grupos
      </button>

      <motion.header
        {...MOTION.enter}
        className="relative overflow-hidden rounded-[32px] p-6 text-white shadow-wc26-glow"
        style={{ background: GRADIENTS.hero }}
      >
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
        <p className="relative text-xs font-black uppercase tracking-wider text-wc26-yellow">Fase de grupos</p>
        <h1 className="relative text-3xl font-black">Grupo {id}</h1>
        <p className="mt-1 text-sm text-white/80">{standings.length || 4} selecciones</p>
      </motion.header>

      <section>
        <p className="wc26-section-title">Selecciones</p>
        <DataState
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          loadingMessage="Cargando selecciones..."
          errorMessage="No pudimos cargar las selecciones del grupo."
        >
          <motion.div
            initial={MOTION.stagger.initial}
            animate={MOTION.stagger.animate}
            className="grid gap-3 sm:grid-cols-2"
          >
            {standings.map(row => {
              const team = row.team;
              if (!team) return null;
              return (
                <motion.div key={row.teamId} variants={MOTION.enter}>
                  <Link
                    to={`/teams/${team.id}`}
                    className="wc26-card flex items-center gap-3 p-4"
                  >
                    <TeamCrest flag={team.flag} code={team.code} name={team.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-wc26-text">{team.name}</p>
                      <p className="text-xs font-semibold text-wc26-text/50">
                        #{row.rank} · {row.points} pts · FIFA {team.fifaRanking ?? 'Dato no disponible'}
                      </p>
                    </div>
                    <span className="wc26-chip !px-2 !py-1 text-[10px]">Ver</span>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </DataState>
      </section>

      <section>
        <p className="wc26-section-title">Tabla de posiciones</p>
        <div className="wc26-card overflow-hidden">
          <div className="bg-wc26-green px-4 py-3 text-sm font-black text-white">Tabla Grupo {id}</div>
          <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-wc26-gray300/40 text-wc26-text/50">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Equipo</th>
                <th className="px-2 py-2 text-center">PJ</th>
                <th className="px-2 py-2 text-center">GF</th>
                <th className="px-2 py-2 text-center">GC</th>
                <th className="px-3 py-2 text-center font-bold text-wc26-orange">PTS</th>
              </tr>
            </thead>
            <tbody>
              {standings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-wc26-text/45">
                    {EMPTY.standings}
                  </td>
                </tr>
              ) : (
                standings.map(row => (
                  <tr key={row.teamId} className="border-b border-wc26-gray100 last:border-0">
                    <td className="px-3 py-2 font-bold">{row.rank}</td>
                    <td className="px-3 py-2">
                      <Link to={`/teams/${row.teamId}`} className="flex items-center gap-2 font-bold hover:text-wc26-blue">
                        <TeamCrest flag={row.team?.flag} code={row.team?.code} size="sm" />
                        {row.team?.code}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-center">{row.played}</td>
                    <td className="px-2 py-2 text-center">{row.goalsFor}</td>
                    <td className="px-2 py-2 text-center">{row.goalsAgainst}</td>
                    <td className="px-3 py-2 text-center font-extrabold text-wc26-orange">{row.points}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      <section>
        <p className="wc26-section-title">Partidos del grupo</p>
        <DataState
          isLoading={matchesLoading}
          isError={matchesError}
          isEmpty={!matchesLoading && !matchesError && matches.length === 0}
          emptyMessage={EMPTY.matches}
          onRetry={() => refetchMatches()}
          loadingMessage="Cargando partidos..."
          errorMessage="No pudimos cargar los partidos del grupo."
        >
          <motion.div initial={MOTION.stagger.initial} animate={MOTION.stagger.animate} className="space-y-3">
            {matches.map(m => (
              <CompactMatchCard key={m.id} match={m} onPredict={undefined} />
            ))}
          </motion.div>
        </DataState>
      </section>
    </div>
  );
}
