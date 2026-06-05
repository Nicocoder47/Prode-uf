import { motion } from 'framer-motion'
import { WC26 } from '../../constants/design'

interface RankingUser {
  id: string
  name: string
  avatar?: string
  points: number
  position: number
  change: number
  streak: number
}

interface FriendRankingProps {
  users: RankingUser[]
  currentUserId?: string
  title?: string
  maxShow?: number
}

const PODIUM = [
  { bg: `linear-gradient(135deg, ${WC26.yellowBright}, ${WC26.yellow})`, ring: WC26.yellow },
  { bg: `linear-gradient(135deg, #E5E7EB, #D9D9D9)`, ring: '#D9D9D9' },
  { bg: `linear-gradient(135deg, ${WC26.orangeMid}, ${WC26.orange})`, ring: WC26.orange },
]

export function FriendRanking({
  users,
  currentUserId,
  title = 'Ranking',
  maxShow = 10,
}: FriendRankingProps) {
  const displayUsers = users.slice(0, maxShow)
  const top3 = displayUsers.filter(u => u.position <= 3).sort((a, b) => a.position - b.position)
  const rest = displayUsers.filter(u => u.position > 3)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <p className="wc26-section-title">{title}</p>

      {top3.length > 0 && (
        <div className="flex items-end justify-center gap-3 px-2 pb-2">
          {[1, 0, 2].map(idx => {
            const user = top3.find(u => u.position === idx + 1)
            if (!user) return <div key={idx} className="w-24" />
            const style = PODIUM[idx]
            const height = idx === 0 ? 'h-28' : 'h-24'
            return (
              <div key={user.id} className="flex w-24 flex-col items-center">
                <div
                  className="mb-2 grid h-12 w-12 place-items-center rounded-full text-lg font-extrabold text-white shadow-md"
                  style={{ background: style.bg }}
                >
                  {user.avatar || user.name.charAt(0)}
                </div>
                <p className="mb-1 max-w-full truncate text-center text-[11px] font-bold text-wc26-text">{user.name}</p>
                <div
                  className={`flex w-full flex-col items-center justify-end rounded-t-2xl ${height} px-2 pb-2 pt-3`}
                  style={{ background: style.bg, boxShadow: `0 0 0 2px ${style.ring}44` }}
                >
                  <span className="text-2xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                  <span className="text-sm font-extrabold text-wc26-text">{user.points}</span>
                  <span className="text-[9px] font-semibold text-wc26-text/60">pts</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="wc26-card overflow-hidden">
        {rest.length === 0 && top3.length === 0 ? (
          <p className="p-6 text-center text-sm text-wc26-text/50">Sin puntuaciones todavía</p>
        ) : (
          <div className="divide-y divide-wc26-gray100">
            {rest.map(user => {
              const isCurrentUser = currentUserId === user.id
              return (
                <div
                  key={user.id}
                  className={`flex items-center gap-3 px-4 py-3 ${isCurrentUser ? 'bg-wc26-blue/8' : ''}`}
                >
                  <span className="w-6 text-sm font-bold text-wc26-text/40">{user.position}</span>
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${WC26.blueBright}, ${WC26.blue})` }}
                  >
                    {user.avatar || user.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-wc26-text">
                      {user.name}
                      {isCurrentUser && <span className="ml-1 text-xs font-bold text-wc26-blue">· Vos</span>}
                    </p>
                  </div>
                  <span className="text-base font-extrabold text-wc26-orange">{user.points}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}
