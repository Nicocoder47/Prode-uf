// My Predictions Panel - Shows user's pending predictions

import { motion } from 'framer-motion'
import { COLORS, TYPOGRAPHY } from '../../constants/design'
import { MatchCardPremium } from './MatchCardPremium'
import { useWorldCupMatches } from '../../useWorldCupData'
import type { Prediction } from '../../types/worldcup'

interface MyPredictionsPanelProps {
  predictions: Prediction[]
  onEditClick?: (predictionId: string) => void
  title?: string
}

export function MyPredictionsPanel({
  predictions,
  onEditClick,
  title = 'Mis Predicciones',
}: MyPredictionsPanelProps) {
  // Get matches for predictions
  const { data: matches = [] } = useWorldCupMatches()
  const predictionsWithMatches = predictions
    .map(pred => ({
      prediction: pred,
      match: matches.find(m => m.id === pred.matchId),
    }))
    .filter(item => item.match)

  if (predictionsWithMatches.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl border p-8 text-center"
        style={{
          backgroundColor: COLORS.cardDark,
          borderColor: `${COLORS.lightGray}20`,
        }}
      >
        <div className="text-4xl mb-4">⚽</div>
        <h3 className="text-lg font-bold text-white mb-2">Sin predicciones</h3>
        <p className="text-sm text-white/60">
          Aún no has hecho ninguna predicción. ¡Empieza a jugar!
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="mb-6">
        <h2
          className="text-3xl md:text-4xl font-bold text-white mb-2"
          style={{ fontFamily: TYPOGRAPHY.fontFamily.sans }}
        >
          {title}
        </h2>
        <div
          className="h-1 w-20 rounded-full"
          style={{ backgroundColor: COLORS.secondary }}
        />
        <p className="text-sm text-white/60 mt-2">
          {predictionsWithMatches.length} predicción{predictionsWithMatches.length !== 1 ? 'es' : ''}
        </p>
      </div>

      {/* Predictions grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {predictionsWithMatches.map((item, index) => {
          const { prediction, match } = item
          if (!match) return null

          const homeTeam = match.homeTeam
          const awayTeam = match.awayTeam

          return (
            <motion.div
              key={prediction.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative"
            >
              {/* Prediction indicator */}
              <div
                className="absolute top-4 right-4 z-20 px-2 py-1 rounded text-xs font-bold text-white"
                style={{ backgroundColor: COLORS.primary }}
              >
                Predicción
              </div>

              {/* Match card */}
              <MatchCardPremium
                match={match}
                hasPrediction={true}
                onPredictClick={() => onEditClick?.(prediction.id)}
              />

              {/* Prediction details */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 + 0.1 }}
                className="mt-3 p-3 rounded-lg border space-y-2"
                style={{
                  backgroundColor: `${COLORS.primary}15`,
                  borderColor: `${COLORS.primary}40`,
                }}
              >
                <div className="text-xs text-white/70">Tu predicción:</div>
                <div className="flex items-center justify-between text-sm">
                  <div className="font-bold">
                    {prediction.result === 'home' && (
                      <span className="text-yellow-400">
                        {homeTeam?.code || 'Local'} gana
                      </span>
                    )}
                    {prediction.result === 'draw' && (
                      <span className="text-cyan-400">Empate</span>
                    )}
                    {prediction.result === 'away' && (
                      <span className="text-yellow-400">
                        {awayTeam?.code || 'Visitante'} gana
                      </span>
                    )}
                  </div>
                  {prediction.exactScore && (
                    <span className="text-white/60">
                      {prediction.exactScore.home}-{prediction.exactScore.away}
                    </span>
                  )}
                </div>

                {/* Edit button */}
                <button
                  onClick={() => onEditClick?.(prediction.id)}
                  className="w-full mt-3 py-2 rounded text-xs font-bold transition-all"
                  style={{
                    backgroundColor: `${COLORS.secondary}40`,
                    color: COLORS.secondary,
                  }}
                >
                  Editar predicción
                </button>
              </motion.div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
