import { useEffect, useState } from 'react'
import { fetchActiveAdminCards } from '../../services/admin/adminService.ts'
import type { AdminCard } from '../../types/admin.ts'

const statusBorder: Record<AdminCard['status'], string> = {
  neutral: 'border-white/15',
  success: 'border-emerald-400/30',
  warning: 'border-amber-400/30',
  danger: 'border-red-400/30',
}

export function AdminCardsStrip() {
  const [cards, setCards] = useState<AdminCard[]>([])

  useEffect(() => {
    fetchActiveAdminCards().then(setCards).catch(() => setCards([]))
  }, [])

  if (cards.length === 0) return null

  return (
    <section className="mb-5">
      <p className="wc26-section-title">Info del torneo</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map(card => (
          <div
            key={card.id}
            className={`rounded-2xl border bg-white/5 p-3 ${statusBorder[card.status] ?? statusBorder.neutral}`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">{card.title}</p>
            <p className="mt-1 text-lg font-extrabold text-white">{card.value ?? '—'}</p>
            {card.subtitle && <p className="text-[11px] text-white/55">{card.subtitle}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
