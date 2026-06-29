import { useMemo, useState } from 'react'
import { TeamProfileCard } from '../../components/worldcup/TeamProfileCard'
import { useWorldCupTeams, useStandings, useAllPlayers, useWorldCupMatches } from '../../useWorldCupData'
import { groupColor } from '../../constants/groups'
import { WC26_PARTICIPANT_COUNT } from '../../constants/wc26Participants'
import { computeTeamForm, computeTeamScoring } from '../../utils/teamAnalytics'
import { teamDisplayName } from '../../utils/teamDisplay'
import { buildTeamGroupMap, filterWc26Teams } from '../../utils/wc26Teams'
import type { Player } from '../../types/worldcup'
import { EMPTY } from '../../utils/emptyState'

export default function TeamsListPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { data: teams = [], isLoading } = useWorldCupTeams()
  const { data: standings = [] } = useStandings()
  const { data: players = [] } = useAllPlayers()
  const { data: matches = [] } = useWorldCupMatches()

  const participantTeams = useMemo(() => filterWc26Teams(teams), [teams])

  const groupByTeam = useMemo(
    () => buildTeamGroupMap(standings, matches, participantTeams),
    [standings, matches, participantTeams],
  )

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
    () =>
      [...participantTeams].sort((a, b) => {
        const ga = groupByTeam.get(a.id) ?? 'Z'
        const gb = groupByTeam.get(b.id) ?? 'Z'
        if (ga !== gb) return ga.localeCompare(gb)
        return teamDisplayName(a).localeCompare(teamDisplayName(b), 'es')
      }),
    [participantTeams, groupByTeam],
  )

  const teamCountLabel =
    participantTeams.length === WC26_PARTICIPANT_COUNT
      ? `${WC26_PARTICIPANT_COUNT} equipos`
      : `${participantTeams.length} equipos`

  const toggleTeam = (teamId: string) => {
    setExpandedId(current => (current === teamId ? null : teamId))
  }

  return (
    <div className="space-y-4 pb-3">
      <header className="wc26-page-header wc26-page-header--green wc26-page-header--teams">
        <p className="wc26-page-header__eyebrow">Selecciones</p>
        <h1 className="text-2xl font-extrabold text-white md:text-3xl">{teamCountLabel}</h1>
        <p className="mt-1 text-sm text-white/85">Tocá una selección para ver plantel, DT y destacados</p>
      </header>

      {isLoading && <p className="wc26-card p-5 text-center text-sm text-wc26-text/55">Cargando equipos...</p>}

      {!isLoading && sortedTeams.length === 0 && (
        <p className="wc26-card p-5 text-center text-sm text-wc26-text/55">{EMPTY.teams}</p>
      )}

      <div className="wc26-teams-grid grid grid-cols-2 gap-2 sm:gap-2.5 xl:grid-cols-3">
        {sortedTeams.map((team, i) => {
          const group = groupByTeam.get(team.id) || '—'
          const accent = group !== '—' ? groupColor(group) : '#006B3F'
          const teamPlayers = playersByTeam.get(team.id) ?? []
          const form = computeTeamForm(matches, team.id)
          const scoring = computeTeamScoring(matches, team.id)
          const standing = standingByTeam.get(team.id)
          const goalsPerMatch =
            scoring.perMatch ??
            (standing && standing.played > 0 ? standing.goalsFor / standing.played : null)
          const isExpanded = expandedId === team.id
          return (
            <div
              key={team.id}
              className={`min-w-0${isExpanded ? ' col-span-2 xl:col-span-3' : ''}`}
            >
              <TeamProfileCard
                team={team}
                groupId={group}
                players={teamPlayers}
                form={form}
                goalsPerMatch={goalsPerMatch}
                accent={accent}
                index={i}
                variant="tile"
                expanded={isExpanded}
                onToggle={() => toggleTeam(team.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

