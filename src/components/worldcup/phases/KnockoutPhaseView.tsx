import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { CompactMatchCard } from '../CompactMatchCard'
import { getPhaseLabel } from '../../../constants/phases'
import type { Match, MatchStage, Prediction } from '../../../types/worldcup'

interface KnockoutPhaseViewProps {
  stage: MatchStage
  matches: Match[]
  predictions: Prediction[]
  onPredict: (match: Match) => void
}

export function KnockoutPhaseView({ stage, matches, predictions, onPredict }: KnockoutPhaseViewProps) {
  const stageMatches = matches
    .filter(m => m.stage === stage)
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())

  const predictionMap = new Map(predictions.map(p => [p.matchId, p]))

  if (stageMatches.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="wc26-ko-empty"
      >
        <Trophy className="h-10 w-10 text-white/20" />
        <p className="mt-3 text-sm font-semibold text-white/50">
          Los partidos de {getPhaseLabel(stage)} se definirán cuando avance el torneo.
        </p>
        <p className="mt-1 text-xs text-white/35">
          Los cruces aparecerán automáticamente cuando los equipos se clasifiquen.
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="wc26-fixture-premium"
    >
      <div className="wc26-ko-list">
        {stageMatches.map((match, i) => {
          const pred = predictionMap.get(match.id)
          const predictedHome = pred?.exactScore?.home ?? pred?.predictedHomeScore
          const predictedAway = pred?.exactScore?.away ?? pred?.predictedAwayScore
          const canPredict = match.status === 'scheduled' && !match.isLocked &&
            !!(match.homeTeam) && !!(match.awayTeam) &&
            match.homeTeam.code?.toUpperCase() !== 'TBD' &&
            match.awayTeam.code?.toUpperCase() !== 'TBD'

          return (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
            >
              <CompactMatchCard
                match={match}
                hasPrediction={!!pred}
                predictedHome={predictedHome}
                predictedAway={predictedAway}
                onPredict={canPredict ? () => onPredict(match) : undefined}
                compact
              />
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
