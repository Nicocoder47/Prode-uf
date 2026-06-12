import { useEffect, useState } from 'react'
import { PremiumButton } from '../ui/PremiumButton.tsx'

type Props = {
  scoreHome: number | null
  scoreAway: number | null
  busy?: boolean
  compact?: boolean
  onSave: (home: number, away: number) => void | Promise<void>
}

export function AdminMatchResultEditor({ scoreHome, scoreAway, busy, compact, onSave }: Props) {
  const [home, setHome] = useState(String(scoreHome ?? ''))
  const [away, setAway] = useState(String(scoreAway ?? ''))

  useEffect(() => {
    setHome(String(scoreHome ?? ''))
    setAway(String(scoreAway ?? ''))
  }, [scoreHome, scoreAway])

  const changed =
    home !== String(scoreHome ?? '') ||
    away !== String(scoreAway ?? '')

  async function handleSave() {
    const parsedHome = Number.parseInt(home, 10)
    const parsedAway = Number.parseInt(away, 10)
    if (!Number.isFinite(parsedHome) || !Number.isFinite(parsedAway) || parsedHome < 0 || parsedAway < 0) {
      return
    }
    await onSave(parsedHome, parsedAway)
  }

  const inputClass = compact
    ? 'w-9 rounded-lg border border-white/15 bg-white/5 px-1.5 py-1 text-center text-xs font-bold text-white'
    : 'w-11 rounded-xl border border-white/15 bg-white/5 px-2 py-1.5 text-center text-sm font-bold text-white'

  return (
    <div className={`flex items-center gap-1.5${compact ? '' : ' flex-wrap'}`}>
      <input
        type="number"
        min={0}
        max={99}
        className={inputClass}
        value={home}
        onChange={e => setHome(e.target.value)}
        aria-label="Goles local"
      />
      <span className="text-xs font-bold text-white/40">-</span>
      <input
        type="number"
        min={0}
        max={99}
        className={inputClass}
        value={away}
        onChange={e => setAway(e.target.value)}
        aria-label="Goles visitante"
      />
      <PremiumButton size="sm" variant="ghost" disabled={busy || !changed} onClick={handleSave}>
        Guardar
      </PremiumButton>
    </div>
  )
}
