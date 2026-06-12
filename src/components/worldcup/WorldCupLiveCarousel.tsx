import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MOTION } from '../../constants/design'
import { AdaptiveSection, useMotionEnabled } from '../../utils/adaptiveMotion'
import { LiveInsightCard } from './LiveInsightCard'
import type { WorldCupLiveInsightPayload } from '../../utils/worldCupLiveInsights'
import type { Match } from '../../types/worldcup'

type WorldCupLiveCarouselProps = {
  cards: WorldCupLiveInsightPayload[]
  onPredict?: (match: Match) => void
}

function closestCardIndex(el: HTMLDivElement) {
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
  return closest
}

export function WorldCupLiveCarousel({ cards, onPredict }: WorldCupLiveCarouselProps) {
  const motionEnabled = useMotionEnabled()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const scrollLeftRef = useRef(0)
  const pauseUntilRef = useRef(0)
  const programmaticScrollRef = useRef(false)
  const scrollRafRef = useRef(0)

  const extendAutoPause = useCallback((ms = 6000) => {
    pauseUntilRef.current = Date.now() + ms
  }, [])

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = motionEnabled ? 'smooth' : 'auto') => {
      const el = scrollRef.current
      if (!el) return
      const child = el.children[index] as HTMLElement | undefined
      if (!child) return

      programmaticScrollRef.current = true
      const left = child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2
      el.scrollTo({ left: Math.max(0, left), behavior })
      scrollLeftRef.current = Math.max(0, left)
      activeRef.current = index
      setActive(index)

      window.setTimeout(() => {
        programmaticScrollRef.current = false
      }, behavior === 'smooth' ? 650 : 0)
    },
    [motionEnabled],
  )

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = scrollLeftRef.current
  }, [cards])

  useEffect(() => {
    if (cards.length <= 1 || !motionEnabled) return
    const id = window.setInterval(() => {
      if (Date.now() < pauseUntilRef.current) return
      if (programmaticScrollRef.current) return
      const next = (activeRef.current + 1) % cards.length
      scrollToIndex(next)
    }, 5500)
    return () => window.clearInterval(id)
  }, [cards.length, motionEnabled, scrollToIndex])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el || el.children.length === 0) return

    scrollLeftRef.current = el.scrollLeft

    if (programmaticScrollRef.current) return

    extendAutoPause(6000)
    window.cancelAnimationFrame(scrollRafRef.current)
    scrollRafRef.current = window.requestAnimationFrame(() => {
      const closest = closestCardIndex(el)
      if (closest !== activeRef.current) {
        activeRef.current = closest
        setActive(closest)
      }
    })
  }

  if (cards.length === 0) return null

  return (
    <AdaptiveSection motionProps={MOTION.enter} className="wc26-live-carousel mb-5">
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
        onTouchStart={() => extendAutoPause(8000)}
        onPointerDown={() => extendAutoPause(8000)}
        onMouseEnter={() => extendAutoPause(8000)}
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
    </AdaptiveSection>
  )
}
