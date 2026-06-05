import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import { MOTION } from '../../constants/design'
import { normalizeGroupId } from '../../constants/groups'
import { TeamHeroCard } from '../../components/premium/TeamHeroCard'
import { IntelligenceLink } from '../../components/premium/IntelligenceLink'
import { PremiumTabs } from '../../components/premium/PremiumTabs'
import { StatBar, FormBreakdownCard } from '../../components/premium/StatVisualizations'
import { AiInsights } from '../../components/premium/AiInsights'
import { PremiumGate } from '../../components/premium/PremiumGate'
import { SquadPlayerCard } from '../../components/worldcup/SquadPlayerCard'
import { CompactMatchCard } from '../../components/worldcup/CompactMatchCard'
import { useWorldCupTeam, useTeamPlayers, useTeamMatches, useTeamStanding, useStandings } from '../../useWorldCupData'
import { DataState } from '../../components/ui/DataState'
import { EMPTY } from '../../utils/emptyState'
import { computeAverageAge, computeSquadValue, computeTeamForm, formBreakdown } from '../../utils/teamAnalytics'
import { buildTeamIntelligence } from '../../utils/intelligenceAnalytics'

type Tab = 'resumen' | 'plantel' | 'partidos' | 'stats'

const TABS = [
  { id: 'resumen' as const, label: 'Resumen' },
  { id: 'plantel' as const, label: 'Plantel' },
  { id: 'partidos' as const, label: 'Partidos' },
  { id: 'stats' as const, label: 'Estadísticas' },
]

function positionBucket(pos: string | null): string {
  const p = (pos ?? '').toLowerCase()
  if (p.includes('goal')) return 'Arqueros'
  if (p.includes('def') || p.includes('back')) return 'Defensores'
  if (p.includes('mid')) return 'Mediocampistas'
  if (p.includes('off') || p.includes('wing') || p.includes('strik') || p.includes('forward')) return 'Delanteros'
  return 'Otros'
}

export default function TeamPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab = (TABS.some(t => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'resumen') as Tab
  const [tab, setTab] = useState<Tab>(initialTab)
  const { data: team, isLoading, isError, refetch } = useWorldCupTeam(id)
  const { data: players = [], isLoading: playersLoading, isError: playersError, refetch: refetchPlayers } = useTeamPlayers(id)
  const { data: teamMatches = [] } = useTeamMatches(id)
  const { data: teamStanding } = useTeamStanding(id)
  const { data: allStandings = [] } = useStandings()

  const groupId = useMemo(() => {
    if (teamStanding?.groupLabel) return normalizeGroupId(teamStanding.groupLabel)
    if (team?.group) return normalizeGroupId(team.group)
    return ''
  }, [teamStanding, team])

  const groupStandings = useMemo(
    () => (groupId ? allStandings.filter(s => normalizeGroupId(s.groupLabel) === groupId).sort((a, b) => a.rank - b.rank) : []),
    [allStandings, groupId]
  )

  const form = useMemo(() => (team && id ? computeTeamForm(teamMatches, id) : []), [teamMatches, team, id])
  const formStats = useMemo(() => formBreakdown(form), [form])
  const squadValue = useMemo(() => computeSquadValue(players), [players])
  const averageAge = useMemo(() => computeAverageAge(players), [players])
  const teamIntel = useMemo(
    () => (team ? buildTeamIntelligence(team, teamMatches) : null),
    [team, teamMatches],
  )

  const upcomingMatches = useMemo(
    () => teamMatches.filter(m => m.status === 'scheduled').sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()),
    [teamMatches]
  )

  const finishedMatches = useMemo(
    () => teamMatches.filter(m => m.status === 'finished').sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime()),
    [teamMatches]
  )

  const playersByPosition = useMemo(() => {
    const map = new Map<string, typeof players>()
    for (const p of players) {
      const bucket = positionBucket(p.position)
      if (!map.has(bucket)) map.set(bucket, [])
      map.get(bucket)!.push(p)
    }
    const order = ['Arqueros', 'Defensores', 'Mediocampistas', 'Delanteros', 'Otros']
    return order.filter(k => map.has(k)).map(k => [k, map.get(k)!] as const)
  }, [players])

  if (isLoading) return <DataState isLoading loadingMessage="Cargando equipo..." />
  if (isError) return <DataState isError errorMessage="No pudimos cargar el equipo." onRetry={() => refetch()} />
  if (!team) {
    return (
      <div className="wc26-card p-8 text-center">
        <p className="text-wc26-text/60">Equipo no encontrado.</p>
        <Link to="/teams" className="mt-3 inline-block font-bold text-wc26-blue">Ver selecciones</Link>
      </div>
    )
  }

  const nextMatch = upcomingMatches[0]
  const maxStanding = Math.max(teamStanding?.played ?? 0, teamStanding?.points ?? 0, 1)

  return (
    <div className="space-y-4 pb-4">
      <motion.button
        type="button"
        onClick={() => navigate(-1)}
        {...MOTION.tap}
        className="flex items-center gap-2 rounded-full wc26-glass px-3 py-2 text-sm font-bold text-white/90"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </motion.button>

      <TeamHeroCard
        team={team}
        groupId={groupId}
        squadSize={players.length}
        fifaRanking={team.fifaRanking}
        squadValue={squadValue}
        averageAge={averageAge}
        coach={team.coach}
        form={form}
      />

      <IntelligenceLink type="team" id={team.id} />

      <Link
        to={`/teams/${team.id}/advanced-stats`}
        className="wc26-card flex items-center gap-3 p-4 transition active:scale-[0.99]"
      >
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-wc26-blue/10 text-wc26-blue">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-black text-wc26-text">Estadísticas avanzadas</p>
          <p className="text-xs font-semibold text-wc26-text/45">Forma, goles, rendimiento · Premium</p>
        </div>
      </Link>

      {teamIntel && teamIntel.sampleSize > 0 && (
        <PremiumGate feature="aiInsights" preview={<div className="h-28 rounded-[28px] bg-wc26-night900" />}>
          <AiInsights type="team" data={teamIntel} />
        </PremiumGate>
      )}

      <PremiumTabs<Tab> tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'resumen' && (
        <motion.div {...MOTION.enter} className="space-y-4">
          {form.length > 0 && (
            <FormBreakdownCard wins={formStats.wins} draws={formStats.draws} losses={formStats.losses} />
          )}
          {nextMatch && (
            <section>
              <p className="wc26-section-title">Próximo partido</p>
              <CompactMatchCard match={nextMatch} featured />
            </section>
          )}
          {groupStandings.length > 0 && (
            <section>
              <p className="wc26-section-title">Grupo {groupId}</p>
              <div className="wc26-card overflow-hidden">
                {groupStandings.map(row => (
                  <div
                    key={row.teamId}
                    className={`flex items-center justify-between border-b border-wc26-gray100 px-4 py-3 last:border-0 ${
                      row.teamId === team.id ? 'bg-wc26-green/5' : ''
                    }`}
                  >
                    <span className={`text-sm ${row.teamId === team.id ? 'font-black text-wc26-green' : 'font-semibold'}`}>
                      {row.rank}. {row.team?.code}
                    </span>
                    <span className="font-black text-wc26-fifaYellow">{row.points} pts</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {finishedMatches.length > 0 && (
            <section>
              <p className="wc26-section-title">Historial reciente</p>
              <div className="space-y-2">
                {finishedMatches.slice(0, 3).map(m => (
                  <CompactMatchCard key={m.id} match={m} />
                ))}
              </div>
            </section>
          )}
        </motion.div>
      )}

      {tab === 'plantel' && (
        <DataState
          isLoading={playersLoading}
          isError={playersError}
          isEmpty={!playersLoading && !playersError && players.length === 0}
          emptyMessage={EMPTY.players}
          onRetry={() => refetchPlayers()}
          loadingMessage="Cargando plantel..."
          errorMessage="No pudimos cargar el plantel."
        >
          <motion.div initial={MOTION.stagger.initial} animate={MOTION.stagger.animate} className="space-y-5">
            {playersByPosition.map(([label, list]) => (
              <motion.section key={label} variants={MOTION.enter}>
                <p className="wc26-section-title">{label}</p>
                <div className="wc26-card divide-y divide-wc26-gray100/80 overflow-hidden">
                  {list.map(player => (
                    <SquadPlayerCard key={player.id} player={player} />
                  ))}
                </div>
              </motion.section>
            ))}
          </motion.div>
        </DataState>
      )}

      {tab === 'partidos' && (
        <motion.div initial={MOTION.stagger.initial} animate={MOTION.stagger.animate} className="space-y-3">
          {teamMatches.length === 0 ? (
            <DataState isEmpty emptyMessage={EMPTY.matches} />
          ) : (
            teamMatches.map(m => <CompactMatchCard key={m.id} match={m} />)
          )}
        </motion.div>
      )}

      {tab === 'stats' && (
        teamStanding ? (
          <motion.div {...MOTION.enter} className="space-y-4">
            <div className="wc26-card space-y-4 p-5">
              <p className="wc26-section-title">Tabla de grupos</p>
              <StatBar label="Puntos" value={teamStanding.points} max={maxStanding * 1.2} color="gold" />
              <StatBar label="Partidos jugados" value={teamStanding.played} max={maxStanding} color="green" />
              <StatBar label="Goles a favor" value={teamStanding.goalsFor} max={Math.max(teamStanding.goalsFor, teamStanding.goalsAgainst, 1)} color="blue" />
              <StatBar label="Goles en contra" value={teamStanding.goalsAgainst} max={Math.max(teamStanding.goalsFor, teamStanding.goalsAgainst, 1)} color="green" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { l: 'G', v: teamStanding.won },
                { l: 'E', v: teamStanding.drawn },
                { l: 'P', v: teamStanding.lost },
                { l: 'DG', v: teamStanding.goalDiff },
              ].map(s => (
                <div key={s.l} className="wc26-stat-card text-center">
                  <p className="text-2xl font-black">{s.v}</p>
                  <p className="text-[10px] font-black uppercase text-wc26-text/45">{s.l}</p>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <DataState isEmpty emptyMessage="Las estadísticas del equipo se publicarán cuando comience la fase de grupos." />
        )
      )}
    </div>
  )
}
