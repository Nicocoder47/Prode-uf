import { Link } from 'react-router-dom'

import { motion, useReducedMotion } from 'framer-motion'

import { ArrowRight, Check, ChevronLeft, Clock, Star } from 'lucide-react'

import { CompactMatchCard } from './CompactMatchCard'

import { TeamCrest } from './TeamCrest'

import { groupColor } from '../../constants/groups'

import { MOTION } from '../../constants/design'

import type { Match, Prediction, Team } from '../../types/worldcup'

import { teamAbbreviation } from '../../utils/teamDisplay'

import {

  buildPredictionMap,

  computeGroupProgress,

  formatPredictionClose,

  getGroupCardState,

  getGroupMaxPoints,

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

}



function TeamCodesRow({ teams }: { teams: Team[] }) {

  return (

    <div className="wc26-fgc-group-card__teams">

      {teams.map(team => (

        <div key={team.id} className="wc26-fgc-group-card__team">

          <TeamCrest flag={team.flag} code={team.code} size="md" premium />

          <span>{teamAbbreviation(team.code, team.name)}</span>

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

  const reduceMotion = useReducedMotion()

  const pct = progress.total > 0 ? Math.round((progress.predicted / progress.total) * 100) : 0

  const earnedPts = getGroupPointsEarned(predictions, matches, progress.groupId)

  const maxPts = getGroupMaxPoints(progress.total)

  const cardState = getGroupCardState(progress, recommendedGroupId ?? null)

  const statusLabel = getGroupStatusLabel(cardState)

  const closeDate = getGroupPredictionClose(matches, progress.groupId)



  const ctaLabel =

    cardState === 'not_started'

      ? `JUGAR GRUPO ${progress.groupId}`

      : cardState === 'complete'

        ? 'VER GRUPO'

        : 'CONTINUAR'



  return (

    <article

      id={`fixture-group-${progress.groupId}`}

      className={`wc26-fgc-group-card wc26-fgc-group-card--${cardState}`}

      style={{ '--group-color': groupColor(progress.groupId) } as React.CSSProperties}

    >

      <div className="wc26-fgc-group-card__head">

        <span className="wc26-fgc-group-card__letter">{progress.groupId}</span>

        <div className="wc26-fgc-group-card__title-wrap">

          <p className="wc26-fgc-group-card__title">Grupo {progress.groupId}</p>

          <span className={`wc26-fgc-group-card__status wc26-fgc-group-card__status--${cardState}`}>

            {statusLabel}

          </span>

        </div>

        <span className="wc26-fgc-group-card__max-badge">MÁX. {maxPts} PTS</span>

      </div>



      <TeamCodesRow teams={teams} />



      <ul className="wc26-fgc-group-card__stats">

        <li>

          <Check className="h-3 w-3" aria-hidden="true" />

          {progress.predicted} / {progress.total} predichos

        </li>

        <li>

          <Clock className="h-3 w-3" aria-hidden="true" />

          {progress.pending} pendientes

        </li>

        <li>

          <Star className="h-3 w-3" aria-hidden="true" />

          {earnedPts} pts ganados

        </li>

      </ul>



      <div className="wc26-fgc-group-card__bar">

        <motion.div

          className="wc26-fgc-group-card__bar-fill"

          initial={reduceMotion ? false : { width: 0 }}

          animate={{ width: `${pct}%` }}

          transition={{ duration: reduceMotion ? 0 : 0.55 }}

        />

      </div>

      <div className="wc26-fgc-group-card__progress-foot">

        <span>

          {progress.predicted} / {progress.total} partidos

        </span>

        <span>{pct}% completado</span>

      </div>



      {closeDate ? (

        <p className="wc26-fgc-group-card__close">

          <Clock className="h-3 w-3" aria-hidden="true" />

          Cierre: {formatPredictionClose(closeDate)}

        </p>

      ) : null}



      <motion.button

        type="button"

        {...MOTION.tap}

        onClick={onPlay}

        className={`wc26-fgc-group-card__play wc26-fgc-group-card__play--${cardState}`}

      >

        {ctaLabel}

        <ArrowRight className="h-4 w-4" aria-hidden="true" />

      </motion.button>

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

    <div className="wc26-fgc-groups-grid">

      {cards.map((progress, index) => (

        <motion.div

          key={progress.groupId}

          initial={{ opacity: 0, y: 12 }}

          animate={{ opacity: 1, y: 0 }}

          transition={{ delay: index * 0.04 }}

        >

          <GroupCard

            progress={progress}

            teams={getGroupTeams(matches, progress.groupId)}

            matches={matches}

            predictions={predictions}

            recommendedGroupId={recommendedGroupId}

            onPlay={() => onSelectGroup(progress.groupId)}

          />

        </motion.div>

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


