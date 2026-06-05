// Activity Feed - Social System Component

import { motion } from 'framer-motion'
import { COLORS, TYPOGRAPHY } from '../../constants/design'

interface ActivityItem {
  id: string
  type: 'prediction' | 'goal' | 'ranking' | 'challenge'
  user: string
  action: string
  timestamp: string
  highlight?: string
  emoji?: string
}

interface ActivityFeedProps {
  activities: ActivityItem[]
  title?: string
  maxShow?: number
}

export function ActivityFeed({
  activities,
  title = 'Actividad en Vivo',
  maxShow = 5,
}: ActivityFeedProps) {
  const displayActivities = activities.slice(0, maxShow)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: COLORS.cardDark,
        borderColor: `${COLORS.lightGray}20`,
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 border-b"
        style={{
          borderColor: `${COLORS.lightGray}10`,
          background: `linear-gradient(135deg, ${COLORS.primary}20, ${COLORS.secondary}10)`,
        }}
      >
        <h3
          className="text-lg font-black text-white"
          style={{ fontFamily: TYPOGRAPHY.fontFamily.sans }}
        >
          {title}
        </h3>
        <p className="text-xs text-white/60 mt-1">
          Actualizado cada minuto
        </p>
      </div>

      {/* Activities */}
      <div className="divide-y" style={{ borderColor: `${COLORS.lightGray}10` }}>
        {displayActivities.map((activity, idx) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="px-5 py-4 hover:bg-white/5 transition-colors border-b"
            style={{
              borderColor: `${COLORS.lightGray}10`,
            }}
          >
            {/* Activity Item */}
            <div className="flex gap-3">
              {/* Avatar */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
                }}
              >
                {activity.emoji || activity.user.charAt(0).toUpperCase()}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-black text-white">
                    {activity.user}
                  </span>
                  <span className="text-sm text-white/70">
                    {activity.action}
                  </span>
                  {activity.highlight && (
                    <span
                      className="text-sm font-bold px-2 py-0.5 rounded inline-block"
                      style={{
                        backgroundColor: `${COLORS.secondary}30`,
                        color: COLORS.secondary,
                      }}
                    >
                      {activity.highlight}
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/50 mt-1">
                  {activity.timestamp}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <div
        className="px-5 py-3 text-center border-t"
        style={{ borderColor: `${COLORS.lightGray}10` }}
      >
        <button
          className="text-sm font-bold transition-colors"
          style={{ color: COLORS.primary }}
        >
          Ver todo →
        </button>
      </div>
    </motion.div>
  )
}
