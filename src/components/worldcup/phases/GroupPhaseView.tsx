import { motion } from 'framer-motion'
import { FixtureGroupHub } from '../FixtureGroupHub'
import type { Match, Prediction } from '../../../types/worldcup'

interface GroupPhaseViewProps {
  matches: Match[]
  predictions: Prediction[]
  selectedGroup: string | null
  recommendedGroupId: string | null
  onSelectGroup: (groupId: string | null) => void
  onPredict: (match: Match) => void
  onCompletePredictions?: () => void
  showCompleteCta?: boolean
  activeMatchId?: string | null
}

export function GroupPhaseView({
  matches,
  predictions,
  selectedGroup,
  recommendedGroupId,
  onSelectGroup,
  onPredict,
  onCompletePredictions,
  showCompleteCta,
  activeMatchId,
}: GroupPhaseViewProps) {
  const groupMatches = matches.filter(m => m.stage === 'group')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <FixtureGroupHub
        matches={groupMatches}
        predictions={predictions}
        selectedGroup={selectedGroup}
        recommendedGroupId={recommendedGroupId}
        onSelectGroup={onSelectGroup}
        onPredict={onPredict}
        onCompletePredictions={onCompletePredictions}
        showCompleteCta={showCompleteCta}
        activeMatchId={activeMatchId}
      />
    </motion.div>
  )
}
