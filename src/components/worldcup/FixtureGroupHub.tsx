import { Link } from 'react-router-dom'

import { ArrowRight, Check, ChevronLeft, Clock, Star } from 'lucide-react'

import { CompactMatchCard } from './CompactMatchCard'

import { GroupFixtureFit } from './fixture/GroupFixtureFit'

import { TeamCrest } from './TeamCrest'

import { groupColor } from '../../constants/groups'

import type { Match, Prediction, Team } from '../../types/worldcup'

import { teamAbbreviation, teamDisplayName } from '../../utils/teamDisplay'

import {

  buildPredictionMap,

  computeGroupProgress,

  formatPredictionClose,

  getGroupCardState,

  getGroupPointsEarned,

  getGroupPredictionClose,

  getGroupStatusLabel,

  getGroupTeams,

  getMatchPredictUiStatus,

  groupMatches,

  listGroupsWithMatches,

  MATCH_PREDICT_STATUS_LABEL,

  type GroupProgress,

} from '../../utils/predictionProgress'



type FixtureGroupHubProps = {

  matches: Match[]

  predictions: Prediction[]

  selectedGroup: string | null

  recommendedGroupId?: string | null

  onSelectGroup: (groupId: string | null) => void

  onPredict: (match: Match) => void

  onCompletePredictions?: () => void

  showCompleteCta?: boolean

  activeMatchId?: string | null

}



function TeamCodesRow({ teams }: { teams: Team[] }) {
  return (
    <div className="wc26-fgc-group-card__teams">
      {teams.map(team => (
        <div key={team.id} className="wc26-fgc-group-card__team">
          <TeamCrest
            flag={team.flag}
            code={team.code}
            name={team.name}
            size="md"
            premium
            className="wc26-fgc-group-card__crest"
          />
          <span className="wc26-fgc-group-card__team-code">
            {teamAbbreviation(team.code, team.name)}
          </span>
          <span className="wc26-fgc-group-card__team-name">{teamDisplayName(team)}</span>
        </div>
      ))}
    </div>
  )
}



function GroupCard({

  progress,

  teams,

  matches,

  predictions,

  recommendedGroupId,

  onPlay,

}: {

  progress: GroupProgress

  teams: Team[]

  matches: Match[]

  predictions: Prediction[]

  recommendedGroupId?: string | null

  onPlay: () => void

}) {

  const pct = progress.total > 0 ? Math.round((progress.predicted / progress.total) * 100) : 0

  const earnedPts = getGroupPointsEarned(predictions, matches, progress.groupId)
  const cardState = getGroupCardState(progress, recommendedGroupId ?? null)
  const statusLabel = cardState === 'complete' ? 'COMPLETADO' : getGroupStatusLabel(cardState)
  const closeDate = getGroupPredictionClose(matches, progress.groupId)

  const ctaLabel =
    cardState === 'not_started'
      ? `Jugar ${progress.groupId}`
      : cardState === 'complete'
        ? 'Ver grupo'
        : 'Continuar'

  return (
    <article
      id={`fixture-group-${progress.groupId}`}
      className={`wc26-fgc-group-card wc26-fgc-group-card--${cardState}`}
      style={{ '--group-color': groupColor(progress.groupId) } as React.CSSProperties}
    >
      <span className="wc26-fgc-group-card__shine" aria-hidden="true" />
      {cardState === 'recommended' ? (
        <span className="wc26-fgc-group-card__glow" aria-hidden="true" />
      ) : null}
      <header className="wc26-fgc-group-card__head">
        <span className="wc26-fgc-group-card__letter" aria-hidden="true">
          {progress.groupId}
        </span>
        <div className="wc26-fgc-group-card__head-main">
          <div className="wc26-fgc-group-card__head-top">
            <p className="wc26-fgc-group-card__title">Grupo {progress.groupId}</p>
            <span className={`wc26-fgc-group-card__status wc26-fgc-group-card__status--${cardState}`}>
              {cardState === 'complete' ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" /> : null}
              {statusLabel}
            </span>
          </div>
          <div className="wc26-fgc-group-card__bar">
            <div className="wc26-fgc-group-card__bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className="wc26-fgc-group-card__pct">{pct}% completado</span>
      </header>

      <TeamCodesRow teams={teams} />

      <div className="wc26-fgc-group-card__stats" role="list">
        <div className="wc26-fgc-group-card__stat" role="listitem">
          <Check className="wc26-fgc-group-card__stat-icon" aria-hidden="true" />
          <div className="wc26-fgc-group-card__stat-body">
            <span className="wc26-fgc-group-card__stat-value">
              {progress.predicted}/{progress.total}
            </span>
            <span className="wc26-fgc-group-card__stat-label">Predichos</span>
          </div>
        </div>
        <span className="wc26-fgc-group-card__stat-sep" aria-hidden="true" />
        <div className="wc26-fgc-group-card__stat" role="listitem">
          <Clock className="wc26-fgc-group-card__stat-icon" aria-hidden="true" />
          <div className="wc26-fgc-group-card__stat-body">
            <span className="wc26-fgc-group-card__stat-value">{progress.pending}</span>
            <span className="wc26-fgc-group-card__stat-label">Pendientes</span>
          </div>
        </div>
        <span className="wc26-fgc-group-card__stat-sep" aria-hidden="true" />
        <div className="wc26-fgc-group-card__stat" role="listitem">
          <Star className="wc26-fgc-group-card__stat-icon" aria-hidden="true" />
          <div className="wc26-fgc-group-card__stat-body">
            <span className="wc26-fgc-group-card__stat-value">{earnedPts}</span>
            <span className="wc26-fgc-group-card__stat-label">Pts ganados</span>
          </div>
        </div>
      </div>

      <footer className="wc26-fgc-group-card__foot">
        <p className="wc26-fgc-group-card__close">
          {closeDate ? (
            <>
              <Clock className="h-3 w-3" aria-hidden="true" />
              Cierre: {formatPredictionClose(closeDate)}
            </>
          ) : (
            <span className="wc26-fgc-group-card__close-placeholder">Sin cierre próximo</span>
          )}
        </p>
        <span className="wc26-fgc-group-card__matches-count">
          {progress.total} {progress.total === 1 ? 'partido' : 'partidos'}
        </span>
        <button
          type="button"
          onClick={onPlay}
          className={`wc26-fgc-group-card__play wc26-fgc-group-card__play--${cardState}`}
        >
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </footer>
    </article>
  )
}



function StatusPill({ status }: { status: ReturnType<typeof getMatchPredictUiStatus> }) {

  const tones: Record<string, string> = {

    available: 'bg-sky-500/15 text-sky-200',

    predicted: 'bg-emerald-500/15 text-emerald-200',

    closed: 'bg-orange-500/15 text-orange-200',

    scored: 'bg-violet-500/15 text-violet-200',

    missed: 'bg-white/10 text-white/45',

  }

  return (

    <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${tones[status]}`}>

      {MATCH_PREDICT_STATUS_LABEL[status]}

    </span>

  )

}



export function FixtureGroupHub({

  matches,

  predictions,

  selectedGroup,

  recommendedGroupId,

  onSelectGroup,

  onPredict,

  onCompletePredictions,

  showCompleteCta,

  activeMatchId,

}: FixtureGroupHubProps) {

  const predictionMap = buildPredictionMap(predictions)

  const predictionSet = new Set(predictions.map(p => p.matchId))

  const groupProgress = computeGroupProgress(matches, predictionSet)



  if (selectedGroup) {

    const groupList = groupMatches(matches, selectedGroup)

    const teams = getGroupTeams(matches, selectedGroup)

    const progress = groupProgress.find(g => g.groupId === selectedGroup)



    return (
      <>
        <GroupFixtureFit
          groupId={selectedGroup}
          groupIds={listGroupsWithMatches(matches)}
          matches={groupList}
          teams={teams}
          progress={progress}
          predictionMap={predictionMap}
          activeMatchId={activeMatchId}
          onBack={() => onSelectGroup(null)}
          onPredict={onPredict}
          onGoToGroup={onSelectGroup}
          onContinue={onCompletePredictions}
          showContinue={showCompleteCta}
        />

        <div className="hidden md:block">
          <button
            type="button"
            onClick={() => onSelectGroup(null)}
            className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-white/70"
          >
            <ChevronLeft className="h-4 w-4" />
            Todos los grupos
          </button>

          <div
            className="wc26-page-header mb-4 !py-4"
            style={{ borderLeft: `4px solid ${groupColor(selectedGroup)}` }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Grupo {selectedGroup}</p>
            <h2 className="text-xl font-extrabold text-white">{groupList.length} partidos</h2>
            {progress && (
              <p className="mt-1 text-xs text-white/60">
                {progress.predicted} predichos · {progress.pending} pendientes
              </p>
            )}
          </div>

          <TeamCodesRow teams={teams} />

          <div className="mt-4 space-y-3">
            {groupList.map(match => {
              const pred = predictionMap.get(match.id)
              const status = getMatchPredictUiStatus(match, pred)
              const canPredict =
                status === 'available' ||
                (status === 'predicted' && match.status === 'scheduled' && !match.isLocked)

              return (
                <div key={match.id} className="space-y-2">
                  <div className="flex justify-end px-1">
                    <StatusPill status={status} />
                  </div>
                  <CompactMatchCard
                    match={match}
                    hasPrediction={!!pred}
                    predictedHome={pred?.exactScore?.home ?? pred?.predictedHomeScore}
                    predictedAway={pred?.exactScore?.away ?? pred?.predictedAwayScore}
                    onPredict={canPredict ? () => onPredict(match) : undefined}
                  />
                  {status === 'scored' && pred && (
                    <p className="text-center text-xs font-bold text-wc26-yellow">+{pred.points} pts obtenidos</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </>
    )

  }



  const groupsWithMatches = listGroupsWithMatches(matches)

  const cards = groupProgress.filter(g => groupsWithMatches.includes(g.groupId))



  return (

    <div className="wc26-fgc-groups-grid">

      {cards.map(progress => (

        <div key={progress.groupId}>

          <GroupCard

            progress={progress}

            teams={getGroupTeams(matches, progress.groupId)}

            matches={matches}

            predictions={predictions}

            recommendedGroupId={recommendedGroupId}

            onPlay={() => onSelectGroup(progress.groupId)}

          />

        </div>

      ))}

      {cards.length === 0 && (

        <p className="col-span-full wc26-card p-5 text-center text-sm text-white/55">

          Todavía no hay partidos con grupo asignado.

        </p>

      )}

    </div>

  )

}



export function FixtureGroupQuickLink({ groupId }: { groupId: string }) {

  return (

    <Link

      to={`/matches?group=${groupId}`}

      className="text-xs font-black text-sky-300 underline-offset-2 hover:underline"

    >

      Ver fixture del grupo

    </Link>

  )

}


