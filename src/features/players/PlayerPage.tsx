import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { MOTION } from '../../constants/design'
import { PlayerHeroCard } from '../../components/premium/PlayerHeroCard'
import { PlayerStatsSections } from '../../components/premium/PlayerStatsSections'
import { PlayerVerificationBadges } from '../../components/premium/PlayerVerificationBadges'
import { IntelligenceLink } from '../../components/premium/IntelligenceLink'
import { PremiumTabs } from '../../components/premium/PremiumTabs'
import { usePlayer, usePlayerLiveStatusForPlayer } from '../../useWorldCupData'
import { DataState } from '../../components/ui/DataState'
import { fmtVerifiedField } from '../../utils/formatDisplay'

type Tab = 'resumen' | 'stats' | 'partidos' | 'historial'

const TABS = [
  { id: 'resumen' as const, label: 'Resumen' },
  { id: 'stats' as const, label: 'Estadísticas' },
  { id: 'partidos' as const, label: 'Partidos' },
  { id: 'historial' as const, label: 'Historial' },
]

export default function PlayerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('resumen')
  const { data: player, isLoading, isError, refetch } = usePlayer(id)
  const { data: liveEntries = [] } = usePlayerLiveStatusForPlayer(id)

  const wc26Stats = useMemo(() => {
    let goals = 0
    let assists = 0
    let appearances = 0
    for (const e of liveEntries) {
      appearances += 1
      goals += Number(e.goals ?? 0)
      assists += Number(e.assists ?? 0)
    }
    return { goals, assists, appearances }
  }, [liveEntries])

  const historicalStats = useMemo(() => {
    if (!player) return { appearances: 0, goals: 0, assists: 0, rating: null as number | null, club: null as string | null }
    return {
      appearances: player.appearances ?? 0,
      goals: player.goals ?? 0,
      assists: player.assists ?? 0,
      rating: player.rating,
      club: player.club,
    }
  }, [player])

  const recentForm = useMemo(() => {
    if (liveEntries.length === 0) return null
    return liveEntries
      .slice(0, 10)
      .map(e => (e.goals > 0 ? 'G' : e.assists > 0 ? 'A' : '·'))
      .join('')
  }, [liveEntries])

  if (isLoading) return <DataState isLoading loadingMessage="Cargando jugador..." />
  if (isError) return <DataState isError errorMessage="No pudimos cargar el jugador." onRetry={() => refetch()} />
  if (!player) {
    return (
      <div className="wc26-card p-8 text-center">
        <p className="text-wc26-text/60">Jugador no encontrado.</p>
        <Link to="/players" className="mt-3 inline-block font-bold text-wc26-blue">Ver plantillas</Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      <motion.button
        type="button"
        onClick={() => navigate(-1)}
        {...MOTION.tap}
        className="flex items-center gap-2 rounded-full wc26-glass px-3 py-2 text-sm font-bold text-white/90"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </motion.button>

      <PlayerHeroCard
        player={player}
        rating={historicalStats.rating}
        marketValue={player.marketValue}
        recentForm={recentForm}
      />

      <PlayerVerificationBadges
        verificationStatus={player.verificationStatus}
        dataQualityScore={player.dataQualityScore}
      />

      <IntelligenceLink type="player" id={player.id} />

      <PremiumTabs<Tab> tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'resumen' && (
        <motion.div {...MOTION.enter} className="wc26-card space-y-4 p-5">
          <p className="wc26-section-title">Perfil</p>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { l: 'Edad', v: player.age ? `${player.age} años` : null },
              { l: 'Nacimiento', v: player.dateOfBirth },
              { l: 'Club', v: player.club },
              { l: 'Altura', v: player.height ? `${player.height} cm` : null },
              { l: 'Pie', v: player.preferredFoot },
              { l: 'Nacionalidad', v: player.nationality },
              { l: 'Rating', v: player.rating != null && player.rating > 0 ? player.rating.toFixed(1) : null },
              {
                l: 'Valor',
                v: player.marketValue != null && player.marketValue > 0 ? `€${(player.marketValue / 1_000_000).toFixed(1)}M` : null,
                gold: true,
              },
            ].map(r => (
              <div key={r.l} className="wc26-data-tile">
                <p className="wc26-data-tile__label">{r.l}</p>
                <p
                  className={`wc26-data-tile__value${!r.v ? ' is-empty' : ''}${'gold' in r && r.gold && r.v ? ' is-gold' : ''}`}
                >
                  {fmtVerifiedField(r.v)}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {tab === 'stats' && <PlayerStatsSections wc26={wc26Stats} historical={historicalStats} />}

      {tab === 'partidos' && (
        <div className="wc26-card p-5">
          {liveEntries.length === 0 ? (
            <DataState
              isEmpty
              emptyMessage="Las estadísticas del Mundial 2026 aparecerán cuando el jugador dispute partidos."
            />
          ) : (
            <motion.div initial={MOTION.stagger.initial} animate={MOTION.stagger.animate} className="space-y-2">
              {liveEntries.map(entry => (
                <motion.div
                  key={entry.id}
                  variants={MOTION.enter}
                  className="wc26-data-row"
                >
                  <span>Partido · {entry.match?.status || '—'}</span>
                  <span className="font-black uppercase text-emerald-300">{entry.status.replace('_', ' ')}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {tab === 'historial' && (
        <div className="wc26-card p-5">
          <p className="text-sm text-wc26-text/60">
            {historicalStats.appearances > 0 || historicalStats.club
              ? 'Historial de carrera disponible en la pestaña Estadísticas.'
              : 'Estadísticas históricas pendientes de verificación.'}
          </p>
        </div>
      )}
    </div>
  )
}
