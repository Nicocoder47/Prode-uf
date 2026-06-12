import { useEffect, useMemo, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { CompactMatchCard } from '../CompactMatchCard'
import { TeamCrest } from '../TeamCrest'
import { groupColor } from '../../../constants/groups'
import type { Match, Prediction, Team } from '../../../types/worldcup'
import type { GroupProgress } from '../../../utils/predictionProgress'
import { getAdjacentGroupId } from '../../../utils/predictionProgress'

type GroupFixtureFitProps = {
  groupId: string
  groupIds: string[]
  matches: Match[]
  teams: Team[]
  progress?: GroupProgress
  predictionMap: Map<string, Prediction>
  activeMatchId?: string | null
  onBack: () => void
  onPredict: (match: Match) => void
  onGoToGroup: (groupId: string) => void
  onContinue?: () => void
  showContinue?: boolean
}

export function GroupFixtureFit({
  groupId,
  groupIds,
  matches,
  teams,
  progress,
  predictionMap,
  activeMatchId,
  onBack,
  onPredict,
  onGoToGroup,
  onContinue,
  showContinue,
}: GroupFixtureFitProps) {
  const pct = progress && progress.total > 0 ? Math.round((progress.predicted / progress.total) * 100) : 0
  const color = groupColor(groupId)
  const listRef = useRef<HTMLDivElement>(null)

  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()),
    [matches],
  )

  const focusMatch = useMemo(() => {
    if (activeMatchId) return sortedMatches.find(m => m.id === activeMatchId) ?? sortedMatches[0] ?? null
    return sortedMatches[0] ?? null
  }, [activeMatchId, sortedMatches])

  const nextGroupId = getAdjacentGroupId(groupIds, groupId, 'next')

  useEffect(() => {
    if (!focusMatch || !listRef.current) return
    const el = listRef.current.querySelector(`[data-match-id="${focusMatch.id}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
  }, [focusMatch?.id])

  const handleNextGroup = () => {
    if (nextGroupId) onGoToGroup(nextGroupId)
  }

  return (
    <section
      className="wc26-group-fixture-fit wc26-fixture-premium"
      style={{ '--group-color': color } as React.CSSProperties}
    >
      <header className="wc26-group-fixture-fit__hero wc26-group-fixture-fit__hero--compact">
        <div className="wc26-group-fixture-fit__hero-row">
          <button type="button" onClick={onBack} className="wc26-group-fixture-fit__back">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Grupos
          </button>
          <h1 className="wc26-group-fixture-fit__title">Grupo {groupId}</h1>
          {progress ? (
            <span className="wc26-group-fixture-fit__ratio">
              {progress.predicted}/{progress.total}
            </span>
          ) : null}
        </div>

        <div className="wc26-group-fixture-fit__flags">
          {teams.map(team => (
            <TeamCrest key={team.id} flag={team.flag} code={team.code} size="xs" premium />
          ))}
        </div>

        {progress ? (
          <div className="wc26-group-fixture-fit__progress-inline">
            <div className="wc26-group-fixture-fit__bar">
              <div className="wc26-group-fixture-fit__bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="wc26-group-fixture-fit__progress-meta">
              {pct}% · {progress.pending} pendientes
            </span>
          </div>
        ) : null}
      </header>

      <div ref={listRef} className="wc26-group-fixture-fit__list">
        {sortedMatches.map(match => {
          const pred = predictionMap.get(match.id)
          const predictedHome = pred?.exactScore?.home ?? pred?.predictedHomeScore
          const predictedAway = pred?.exactScore?.away ?? pred?.predictedAwayScore
          const canPredict = match.status === 'scheduled' && !match.isLocked
          const isFocused = focusMatch?.id === match.id

          return (
            <div
              key={match.id}
              data-match-id={match.id}
              className={`wc26-group-fixture-fit__card-wrap${isFocused ? ' is-focused' : ''}`}
            >
              <CompactMatchCard
                match={match}
                hasPrediction={!!pred}
                predictedHome={predictedHome}
                predictedAway={predictedAway}
                onPredict={canPredict ? () => onPredict(match) : undefined}
                compact
              />
            </div>
          )
        })}
      </div>

      {sortedMatches.length > 0 ? (
        <nav className="wc26-group-fixture-fit__nav" aria-label="Navegación del grupo">
          <button type="button" className="wc26-group-fixture-fit__nav-btn" onClick={onBack}>
            Atrás
          </button>
          <button
            type="button"
            className="wc26-group-fixture-fit__nav-btn wc26-group-fixture-fit__nav-btn--primary"
            onClick={onContinue}
            disabled={!showContinue || !onContinue}
          >
            Continuar
          </button>
          <button
            type="button"
            className="wc26-group-fixture-fit__nav-btn"
            onClick={handleNextGroup}
            disabled={!nextGroupId}
          >
            Siguiente grupo
          </button>
        </nav>
      ) : null}
    </section>
  )
}
