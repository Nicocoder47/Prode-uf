import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { PremiumCard } from '../../components/ui/PremiumCard.tsx'
import { WorldCupLiveCarousel } from '../../components/worldcup/WorldCupLiveCarousel.tsx'
import { LiveInsightCard } from '../../components/worldcup/LiveInsightCard.tsx'
import {
  LIVE_CARD_TYPE_META,
  buildLiveCardsPreviewFixtures,
  getLiveCardTypeOrder,
} from '../../utils/worldCupLiveInsightsPreview.ts'
import type { WorldCupLiveCardType } from '../../utils/worldCupLiveInsights.ts'

export default function AdminLiveCardsPage() {
  const fixtures = buildLiveCardsPreviewFixtures()
  const order = getLiveCardTypeOrder()

  const scrollToType = useCallback((type: WorldCupLiveCardType) => {
    document.getElementById(`live-card-${type}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">UI · Mundial en Vivo</p>
        <h2 className="text-xl font-extrabold text-white md:text-2xl">Carrusel premium — preview</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          Vista de las 7 cards del carrusel con datos mock. Usá los enlaces para ir al código y estilos que
          controlan cada variante.
        </p>
      </div>

      <PremiumCard title="Índice de cards" description="Saltar a cada tipo">
        <div className="flex flex-wrap gap-2">
          {order.map(type => {
            const meta = LIVE_CARD_TYPE_META[type]
            return (
              <button
                key={type}
                type="button"
                onClick={() => scrollToType(type)}
                className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-100 transition hover:bg-amber-400/20"
              >
                {meta.emoji} {meta.label}
              </button>
            )
          })}
        </div>
      </PremiumCard>

      <PremiumCard title="Carrusel completo (producción)" description="Mismo componente que el home">
        <div className="max-w-md">
          <WorldCupLiveCarousel cards={fixtures} />
        </div>
      </PremiumCard>

      <div className="grid gap-6">
        {order.map(type => {
          const meta = LIVE_CARD_TYPE_META[type]
          const card = fixtures.find(c => c.type === type)
          if (!card) return null

          return (
            <section key={type} id={`live-card-${type}`} className="scroll-mt-24">
              <PremiumCard
                title={`${meta.emoji} ${meta.label}`}
                description={`${type} · ${meta.description}`}
              >
                <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
                  {meta.sources.map(src => (
                    <span
                      key={src}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-white/60"
                    >
                      {src}
                    </span>
                  ))}
                </div>
                <div className="max-w-sm">
                  <LiveInsightCard card={card} active />
                </div>
              </PremiumCard>
            </section>
          )
        })}
      </div>

      {import.meta.env.DEV ? (
        <p className="text-center text-xs text-white/40">
          También disponible sin admin:{' '}
          <Link to="/dev/live-cards" className="text-emerald-300 underline">
            /dev/live-cards
          </Link>
        </p>
      ) : null}
    </div>
  )
}
