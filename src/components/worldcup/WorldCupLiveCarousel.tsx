import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { MOTION } from '../../constants/design'
import { LiveInsightCard } from './LiveInsightCard'
import type { WorldCupLiveInsightPayload } from '../../utils/worldCupLiveInsights'
import type { Match } from '../../types/worldcup'

type WorldCupLiveCarouselProps = {
  cards: WorldCupLiveInsightPayload[]
  onPredict?: (match: Match) => void
}

export function WorldCupLiveCarousel({ cards, onPredict }: WorldCupLiveCarouselProps) {
  const reduceMotion = useReducedMotion()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const pauseRef = useRef(false)

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = scrollRef.current
      if (!el) return
      const child = el.children[index] as HTMLElement | undefined
      child?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' })
      setActive(index)
    },
    [reduceMotion],
  )

  useEffect(() => {
    if (cards.length <= 1 || reduceMotion) return
    const id = window.setInterval(() => {
      if (pauseRef.current) return
      setActive(prev => {
        const next = (prev + 1) % cards.length
        scrollToIndex(next)
        return next
      })
    }, 5500)
    return () => window.clearInterval(id)
  }, [cards.length, reduceMotion, scrollToIndex])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el || el.children.length === 0) return
    const center = el.scrollLeft + el.clientWidth / 2
    let closest = 0
    let minDist = Infinity
    Array.from(el.children).forEach((child, i) => {
      const node = child as HTMLElement
      const childCenter = node.offsetLeft + node.offsetWidth / 2
      const dist = Math.abs(center - childCenter)
      if (dist < minDist) {
        minDist = dist
        closest = i
      }
    })
    setActive(closest)
  }

  if (cards.length === 0) return null

  return (
    <motion.section {...MOTION.enter} className="wc26-live-carousel mb-5">
      <div className="wc26-live-carousel__head">
        <div>
          <p className="wc26-live-carousel__title">🔥 MUNDIAL EN VIVO</p>
          <p className="wc26-live-carousel__sub">Datos reales · se actualiza cada 30 min</p>
        </div>
        <span className="wc26-live-carousel__badge" aria-hidden="true">
          PREMIUM
        </span>
      </div>

      <div
        ref={scrollRef}
        className="wc26-live-carousel__track"
        onScroll={handleScroll}
        onTouchStart={() => {
          pauseRef.current = true
        }}
        onTouchEnd={() => {
          window.setTimeout(() => {
            pauseRef.current = false
          }, 4000)
        }}
        onMouseEnter={() => {
          pauseRef.current = true
        }}
        onMouseLeave={() => {
          pauseRef.current = false
        }}
      >
        {cards.map((card, index) => (
          <LiveInsightCard
            key={card.id}
            card={card}
            active={index === active}
            onPredict={onPredict}
          />
        ))}
      </div>

      <div className="wc26-live-carousel__dots" aria-hidden="true">
        {cards.map((card, i) => (
          <button
            key={card.id}
            type="button"
            className={`wc26-live-carousel__dot${i === active ? ' wc26-live-carousel__dot--active' : ''}`}
            onClick={() => scrollToIndex(i)}
            aria-label={`Tarjeta ${i + 1}`}
          />
        ))}
      </div>
    </motion.section>
  )
}
