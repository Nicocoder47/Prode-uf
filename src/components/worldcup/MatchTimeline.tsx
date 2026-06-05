// Match Timeline - Sofascore-inspired event display

import { motion } from 'framer-motion'
import { COLORS } from '../../constants/design'

interface TimelineEvent {
  minute: number
  type: 'goal' | 'card' | 'substitution' | 'corner'
  team: 'home' | 'away'
  player: string
  description: string
  icon: string
}

interface MatchTimelineProps {
  events: TimelineEvent[]
}

const getEventColor = (type: string) => {
  const colors = {
    goal: COLORS.secondary,
    card: COLORS.secondary,
    substitution: COLORS.primary,
    corner: COLORS.accent,
  }
  return colors[type as keyof typeof colors] || COLORS.primary
}

export function MatchTimeline({
  events,
}: MatchTimelineProps) {
  const sortedEvents = [...events].sort((a, b) => a.minute - b.minute)

  return (
    <div className="space-y-4">
      {/* Timeline */}
      <div className="relative">
        {/* Center line */}
        <div
          className="absolute left-1/2 top-0 bottom-0 w-1 -translate-x-1/2"
          style={{ backgroundColor: `${COLORS.lightGray}20` }}
        />

        {/* Events */}
        <div className="space-y-6">
          {sortedEvents.map((event, idx) => {
            const isHome = event.team === 'home'
            const eventColor = getEventColor(event.type)

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: isHome ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`flex gap-4 ${isHome ? 'flex-row-reverse' : ''}`}
              >
                {/* Content */}
                <div className={`flex-1 ${isHome ? 'text-right' : ''}`}>
                  <div
                    className="px-4 py-3 rounded-lg border inline-block"
                    style={{
                      backgroundColor: `${eventColor}15`,
                      borderColor: `${eventColor}40`,
                    }}
                  >
                    <div
                      className="text-xs font-black uppercase tracking-wider"
                      style={{ color: eventColor }}
                    >
                      {event.icon} {event.type === 'goal' ? 'GOOOOL' : event.type === 'card' ? 'TARJETA' : event.type === 'substitution' ? 'CAMBIO' : 'CÓRNER'}
                    </div>
                    <div className="text-sm font-bold text-white mt-1">
                      {event.player}
                    </div>
                    <div className="text-xs text-white/60 mt-0.5">
                      {event.description}
                    </div>
                  </div>
                </div>

                {/* Center point */}
                <div className="flex flex-col items-center justify-start pt-1">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    className="w-4 h-4 rounded-full border-2"
                    style={{
                      backgroundColor: eventColor,
                      borderColor: COLORS.cardDark,
                      boxShadow: `0 0 20px ${eventColor}40`,
                    }}
                  />
                  <div
                    className="text-xs font-black mt-1"
                    style={{ color: eventColor }}
                  >
                    {event.minute}'
                  </div>
                </div>

                {/* Empty space */}
                <div className="flex-1" />
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
