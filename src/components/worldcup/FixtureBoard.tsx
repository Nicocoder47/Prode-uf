// World Cup Fixture Board - Shows all matches

import { motion } from 'framer-motion'
import type { Match } from '../../types/worldcup'
import { COLORS, TYPOGRAPHY } from '../../constants/design'
import { MatchCardPremium } from './MatchCardPremium'

interface FixtureBoardProps {
  matches: Match[]
  title?: string
  onMatchClick?: (matchId: string) => void
  predictions?: Record<string, any>
}

export function FixtureBoard({
  matches,
  title = 'Fixture del Mundial',

  onMatchClick,
  predictions = {},
}: FixtureBoardProps) {
  // Group matches by stage
  const matchesByStage = matches.reduce(
    (acc, match) => {
      if (!acc[match.stage]) {
        acc[match.stage] = []
      }
      acc[match.stage].push(match)
      return acc
    },
    {} as Record<string, Match[]>
  )

  const stageLabels: Record<string, string> = {
    group: 'Fase de Grupos',
    round32: '32avos de Final',
    round16: 'Octavos de Final',
    quarterfinals: 'Cuartos de Final',
    semifinals: 'Semifinales',
    final: 'Final',
    thirdplace: 'Tercer Puesto',
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* Title */}
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
      </div>

      {/* Matches by stage */}
      {Object.entries(matchesByStage).map(([stage, stageMatches]) => (
        <motion.div
          key={stage}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ staggerChildren: 0.1 }}
        >
          {/* Stage header */}
          <div className="mb-4">
            <h3
              className="text-lg font-bold text-white/80 flex items-center gap-2"
              style={{ fontFamily: TYPOGRAPHY.fontFamily.sans }}
            >
              <span
                className="w-1 h-6 rounded-full"
                style={{ backgroundColor: COLORS.primary }}
              />
              {stageLabels[stage] || stage}
            </h3>
          </div>

          {/* Matches grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stageMatches.map((match, index) => (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onMatchClick?.(match.id)}
                className="cursor-pointer"
              >
                <MatchCardPremium
                  match={match}
                  hasPrediction={!!predictions?.[match.id]}
                  onPredictClick={() => onMatchClick?.(match.id)}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}
