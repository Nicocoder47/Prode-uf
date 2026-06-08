// Match Detail Page - Sofascore-inspired AAA layout

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { COLORS } from '../../constants/design'
import { MatchTimeline, MatchPredictionModal } from '../../components/worldcup'
import { useWorldCupMatch, useMatchEvents, useMatchStats, usePredictions, usePlayerLiveStatus } from '../../useWorldCupData'
import { useAuth } from '../../lib/auth'
import { useSavePrediction } from '../../hooks/useSavePrediction'

function mapEventToTimeline(ev: any, homeTeamId: string) {
  const typeRaw = (ev.event_type || '').toLowerCase()
  const type = typeRaw.includes('goal') ? 'goal' as const
    : typeRaw.includes('card') ? 'card' as const
    : typeRaw.includes('sub') ? 'substitution' as const
    : 'corner' as const
  const data = ev.event_data ?? {}
  const teamSide = data.team_id === homeTeamId || data.team === 'home' ? 'home' as const : 'away' as const
  return {
    minute: parseInt(String(ev.event_time || data.minute || '0').replace(/\D/g, ''), 10) || 0,
    type,
    team: teamSide,
    player: data.player_name || data.player || 'Jugador',
    description: data.detail || ev.event_type || '',
    icon: type === 'goal' ? '⚽' : type === 'card' ? '🟨' : type === 'substitution' ? '🔄' : '🚩',
  }
}

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const savePrediction = useSavePrediction(user?.id)

  const { data: match, isLoading } = useWorldCupMatch(id)
  const { data: rawEvents = [] } = useMatchEvents(id)
  const { data: stats } = useMatchStats(id)
  const { data: predictions = [] } = usePredictions(user?.id)
  const { data: liveStatus = [] } = usePlayerLiveStatus(id)
  const [showPredictionModal, setShowPredictionModal] = useState(false)

  const userPrediction = predictions.find(p => p.matchId === id)

  if (isLoading) {
    return <div className="text-center p-12 text-white/50">Cargando partido...</div>
  }

  if (!match) {
    return (
      <div className="text-center p-12 text-white/50">
        Partido no encontrado.{' '}
        <button type="button" onClick={() => navigate('/')} className="text-worldcup-gold underline">Volver al inicio</button>
      </div>
    )
  }

  const homeTeam = match.homeTeam!
  const awayTeam = match.awayTeam!
  const isLive = match.status === 'live' || match.status === 'halftime'
  const isFinished = match.status === 'finished'
  const timelineEvents = rawEvents.map(ev => mapEventToTimeline(ev, match.homeTeamId))

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="sticky top-0 z-30 border-b backdrop-blur-xl"
        style={{ backgroundColor: `${COLORS.cardDark}95`, borderColor: `${COLORS.lightGray}20` }}
      >
        <div className="max-w-6xl mx-auto px-4 py-4">
          <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            Volver
          </button>
        </div>
      </motion.div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border p-8 text-center"
          style={{ backgroundColor: COLORS.cardDark, borderColor: `${COLORS.lightGray}20` }}
        >
          <div className="flex items-center justify-center gap-8 mb-6 flex-wrap">
            <div>
              {homeTeam.flag?.startsWith('http') ? (
                <img src={homeTeam.flag} alt={homeTeam.code} loading="lazy" className="h-16 mx-auto mb-3 object-contain" />
              ) : (
                <div className="text-6xl mb-3">{homeTeam.flag}</div>
              )}
              <h2 className="text-2xl font-black text-white">{homeTeam.name}</h2>
            </div>
            <div className="text-center px-4">
              <p className="text-6xl font-black" style={{ color: COLORS.trophy }}>
                {match.homeScore ?? 0} : {match.awayScore ?? 0}
              </p>
              <p className="text-sm text-white/50 mt-2 uppercase tracking-widest">
                {isLive ? 'En vivo' : isFinished ? 'Final' : 'Programado'}
              </p>
            </div>
            <div>
              {awayTeam.flag?.startsWith('http') ? (
                <img src={awayTeam.flag} alt={awayTeam.code} loading="lazy" className="h-16 mx-auto mb-3 object-contain" />
              ) : (
                <div className="text-6xl mb-3">{awayTeam.flag}</div>
              )}
              <h2 className="text-2xl font-black text-white">{awayTeam.name}</h2>
            </div>
          </div>
          {!isFinished && user && match.status === 'scheduled' && !match.isLocked && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowPredictionModal(true)}
              className="mt-4 px-8 py-3 rounded-lg font-bold text-white"
              style={{ backgroundColor: COLORS.secondary }}
            >
              Predecir Ahora
            </motion.button>
          )}
          {userPrediction && (
            <p className="mt-4 text-sm text-white/70">
              Tu predicción: {userPrediction.exactScore ? `${userPrediction.exactScore.home}-${userPrediction.exactScore.away}` : '—'}
              {' · '}{userPrediction.status}
              {userPrediction.status === 'scored' && ` · ${userPrediction.points} pts`}
            </p>
          )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border p-8"
              style={{ backgroundColor: COLORS.cardDark, borderColor: `${COLORS.lightGray}20` }}
            >
              <h3 className="text-2xl font-black text-white mb-8">Timeline del Partido</h3>
              {timelineEvents.length === 0 ? (
                <p className="text-center text-white/40 p-8 border border-white/10 rounded-lg">Sin eventos registrados aún.</p>
              ) : (
                <MatchTimeline events={timelineEvents} />
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border p-8"
              style={{ backgroundColor: COLORS.cardDark, borderColor: `${COLORS.lightGray}20` }}
            >
              <h3 className="text-2xl font-black text-white mb-8">Estadísticas</h3>
              {!stats ? (
                <p className="text-center text-white/40 p-8">Estadísticas disponibles cuando se sincronicen ratings del partido.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Goles', value: stats.goals },
                    { label: 'Asistencias', value: stats.assists },
                    { label: 'xG total', value: stats.xG.toFixed(2) },
                    { label: 'Amarillas', value: stats.yellowCards },
                    { label: 'Rojas', value: stats.redCards },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl bg-white/5 p-4 text-center border border-white/10">
                      <p className="text-2xl font-black text-white">{s.value}</p>
                      <p className="text-xs text-white/50 mt-1 uppercase tracking-wider">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: COLORS.cardDark, borderColor: `${COLORS.lightGray}20` }}>
                <h3 className="text-lg font-black text-white">Estado en vivo</h3>
                {liveStatus.length === 0 ? (
                  <p className="text-center text-white/40 p-4 border border-white/10 rounded-lg">Estado en vivo no disponible.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {liveStatus.slice(0, 20).map(row => (
                      <div key={row.id} className="flex items-center justify-between text-sm border-b border-white/10 py-2">
                        <span className="text-white">{row.player?.name || 'Jugador'}</span>
                        <span className="text-white/50 uppercase text-xs">{row.status.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: COLORS.cardDark, borderColor: `${COLORS.lightGray}20` }}>
              <div>
                <p className="text-xs text-white/60 uppercase font-bold tracking-wider mb-1">Fase</p>
                <p className="text-lg font-black text-white capitalize">{match.stage.replace('_', ' ')}</p>
              </div>
              {match.group && (
                <>
                  <div className="border-t border-white/10" />
                  <div>
                    <p className="text-xs text-white/60 uppercase font-bold tracking-wider mb-1">Grupo</p>
                    <p className="text-lg font-black text-white">{match.group}</p>
                  </div>
                </>
              )}
              <div className="border-t border-white/10" />
              <div>
                <p className="text-xs text-white/60 uppercase font-bold tracking-wider mb-1">Estadio</p>
                <p className="text-sm font-black text-white">{match.stadium || 'Por confirmar'}</p>
                <p className="text-xs text-white/60">{match.city || ''}</p>
              </div>
              <div className="border-t border-white/10" />
              <div>
                <p className="text-xs text-white/60 uppercase font-bold tracking-wider mb-1">Kick-off</p>
                <p className="text-sm text-white">{new Date(match.kickoff).toLocaleString('es-AR')}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <MatchPredictionModal
        match={match}
        isOpen={showPredictionModal}
        onClose={() => setShowPredictionModal(false)}
        existingPrediction={userPrediction}
        onSave={async (payload) => {
          await savePrediction.mutateAsync({
            matchId: match.id,
            result: payload.result,
            homeScore: payload.exactScore.home,
            awayScore: payload.exactScore.away,
            firstScorerId: payload.firstScorer,
            mvpId: payload.mvp,
          })
          setShowPredictionModal(false)
        }}
      />
    </div>
  )
}
