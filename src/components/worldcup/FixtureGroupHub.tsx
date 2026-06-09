import { Link } from 'react-router-dom'

import { motion } from 'framer-motion'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { CompactMatchCard } from './CompactMatchCard'

import { GroupTeamFlags } from './HomeGameHub'

import { groupColor } from '../../constants/groups'

import { MOTION } from '../../constants/design'

import type { Match, Prediction } from '../../types/worldcup'

import {

  buildPredictionMap,

  computeGroupProgress,

  computeRemainingPoints,

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

  onSelectGroup: (groupId: string | null) => void

  onPredict: (match: Match) => void

}



function GroupCard({

  progress,

  teams,

  matches,

  predictionSet,

  onClick,

}: {

  progress: GroupProgress

  teams: ReturnType<typeof getGroupTeams>

  matches: Match[]

  predictionSet: Set<string>

  onClick: () => void

}) {

  const done = progress.predicted

  const pct = progress.total > 0 ? Math.round((done / progress.total) * 100) : 0

  const remainingPts = computeRemainingPoints(matches, predictionSet, progress.groupId)



  return (
    <motion.button
      type="button"
      {...MOTION.tap}
      onClick={onClick}
      className="wc26-fixture-group-card text-left"
      style={{ '--group-color': groupColor(progress.groupId) } as React.CSSProperties}
    >
      <div className="wc26-fixture-group-card__head">
        <span className="wc26-fixture-group-card__badge">{progress.groupId}</span>
        <div className="wc26-fixture-group-card__title-wrap">
          <p className="wc26-fixture-group-card__title">Grupo {progress.groupId}</p>
          <p className="wc26-fixture-group-card__meta">{progress.total} partidos</p>
        </div>
        <ChevronRight className="wc26-fixture-group-card__chevron" aria-hidden="true" />
      </div>

      <GroupTeamFlags teams={teams} premium compact />

      <div className="wc26-fixture-group-card__stats">
        <p className="wc26-fixture-group-card__progress-text">
          {done} predichos · {progress.pending} pendientes
        </p>
        {progress.pending > 0 && (
          <p className="wc26-fixture-group-card__points">Máximo posible: {remainingPts} pts</p>
        )}
      </div>

      <div className="wc26-fixture-group-card__bar">
        <div className="wc26-fixture-group-card__bar-fill" style={{ width: `${pct}%` }} />
      </div>

      {progress.pending > 0 && (
        <span className="wc26-fixture-group-card__cta">
          Continuar
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      )}
    </motion.button>
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

  onSelectGroup,

  onPredict,

}: FixtureGroupHubProps) {

  const predictionMap = buildPredictionMap(predictions)

  const predictionSet = new Set(predictions.map(p => p.matchId))

  const groupProgress = computeGroupProgress(matches, predictionSet)



  if (selectedGroup) {

    const groupList = groupMatches(matches, selectedGroup)

    const teams = getGroupTeams(matches, selectedGroup)

    const progress = groupProgress.find(g => g.groupId === selectedGroup)



    return (

      <div>

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

        <GroupTeamFlags teams={teams} premium />

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

    )

  }



  const groupsWithMatches = listGroupsWithMatches(matches)

  const cards = groupProgress.filter(g => groupsWithMatches.includes(g.groupId))



  return (

    <div className="wc26-fixture-groups-grid">

      {cards.map(progress => (

        <GroupCard

          key={progress.groupId}

          progress={progress}

          teams={getGroupTeams(matches, progress.groupId)}

          matches={matches}

          predictionSet={predictionSet}

          onClick={() => onSelectGroup(progress.groupId)}

        />

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


