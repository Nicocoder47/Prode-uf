import { useMemo, useState } from 'react'
import { TeamProfileCard } from '../../components/worldcup/TeamProfileCard'
import { useWorldCupTeams, useStandings, useAllPlayers, useWorldCupMatches } from '../../useWorldCupData'
import { groupColor, normalizeGroupId } from '../../constants/groups'
import { computeTeamForm, computeTeamScoring } from '../../utils/teamAnalytics'
import type { Player } from '../../types/worldcup'
import { EMPTY } from '../../utils/emptyState'

export default function TeamsListPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { data: teams = [], isLoading } = useWorldCupTeams()
  const { data: standings = [] } = useStandings()
  const { data: players = [] } = useAllPlayers()
  const { data: matches = [] } = useWorldCupMatches()

  const groupByTeam = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of standings) {
      if (s.teamId && s.groupLabel) map.set(s.teamId, normalizeGroupId(s.groupLabel))
    }
    return map
  }, [standings])

  const playersByTeam = useMemo(() => {
    const map = new Map<string, Player[]>()
    for (const p of players) {
      if (!p.teamId) continue
      if (!map.has(p.teamId)) map.set(p.teamId, [])
      map.get(p.teamId)!.push(p)
    }
    return map
  }, [players])

  const standingByTeam = useMemo(() => {
    const map = new Map<string, (typeof standings)[number]>()
    for (const s of standings) {
      if (s.teamId) map.set(s.teamId, s)
    }
    return map
  }, [standings])

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams]
  )

  const toggleTeam = (teamId: string) => {
    setExpandedId(current => (current === teamId ? null : teamId))
  }

  return (
    <div className="space-y-4 pb-3">
      <header className="wc26-page-header wc26-page-header--green wc26-page-header--teams">
        <p className="wc26-page-header__eyebrow">Selecciones</p>
        <h1 className="text-2xl font-extrabold text-white md:text-3xl">48 equipos</h1>
        <p className="mt-1 text-sm text-white/85">Tocá una selección para ver plantel, DT y destacados</p>
      </header>

      {isLoading && <p className="wc26-card p-5 text-center text-sm text-wc26-text/55">Cargando equipos...</p>}

      {!isLoading && sortedTeams.length === 0 && (
        <p className="wc26-card p-5 text-center text-sm text-wc26-text/55">{EMPTY.teams}</p>
      )}

      <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-3 xl:grid-cols-3">
        {sortedTeams.map((team, i) => {
          const group = groupByTeam.get(team.id) || normalizeGroupId(team.group) || '—'
          const accent = group !== '—' ? groupColor(group) : '#006B3F'
          const teamPlayers = playersByTeam.get(team.id) ?? []
          const form = computeTeamForm(matches, team.id)
          const scoring = computeTeamScoring(matches, team.id)
          const standing = standingByTeam.get(team.id)
          const goalsPerMatch =
            scoring.perMatch ??
            (standing && standing.played > 0 ? standing.goalsFor / standing.played : null)
          return (
            <TeamProfileCard
              key={team.id}
              team={team}
              groupId={group}
              players={teamPlayers}
              form={form}
              goalsPerMatch={goalsPerMatch}
              accent={accent}
              index={i}
              expanded={expandedId === team.id}
              onToggle={() => toggleTeam(team.id)}
            />
          )
        })}
      </div>
    </div>
  )
}

