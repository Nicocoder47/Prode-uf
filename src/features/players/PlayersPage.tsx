import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { MOTION } from '../../constants/design'
import { PlayerFifaCard } from '../../components/premium/PlayerFifaCard'
import { useAllPlayers, useWorldCupTeams } from '../../useWorldCupData'
import { EMPTY } from '../../utils/emptyState'

type SortKey = 'name' | 'team' | 'rating' | 'marketValue'

export default function PlayersPage() {
  const [query, setQuery] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [positionFilter, setPositionFilter] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('name')

  const { data: allPlayers = [], isLoading, error } = useAllPlayers()
  const { data: teams = [] } = useWorldCupTeams()

  const positions = useMemo(
    () => [...new Set(allPlayers.map(p => p.position).filter(Boolean))].sort() as string[],
    [allPlayers]
  )

  const filteredPlayers = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = allPlayers

    if (teamFilter) list = list.filter(p => p.teamId === teamFilter)
    if (positionFilter) list = list.filter(p => p.position === positionFilter)
    if (q) {
      list = list.filter(
        p =>
          (p.name ?? '').toLowerCase().includes(q) ||
          (p.club ?? '').toLowerCase().includes(q) ||
          (p.team?.name ?? '').toLowerCase().includes(q)
      )
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      if (sortBy === 'marketValue') return (b.marketValue ?? 0) - (a.marketValue ?? 0)
      if (sortBy === 'team') return (a.team?.name ?? '').localeCompare(b.team?.name ?? '')
      return (a.name ?? '').localeCompare(b.name ?? '')
    })
  }, [allPlayers, query, teamFilter, positionFilter, sortBy])

  return (
    <div className="space-y-5 pb-4">
      <header className="wc26-page-header wc26-page-header--green">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#F8B91E]">Plantillas</p>
        <h1 className="text-2xl font-extrabold text-white">Jugadores</h1>
        <p className="mt-1 text-sm text-white/85">{allPlayers.length} jugadores · estilo álbum FIFA</p>
      </header>

      <div className="wc26-card space-y-3 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wc26-text/35" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar jugador..."
            className="wc26-input pl-10"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className="wc26-input text-sm">
            <option value="">Todas las selecciones</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select value={positionFilter} onChange={e => setPositionFilter(e.target.value)} className="wc26-input text-sm">
            <option value="">Todas las posiciones</option>
            {positions.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'name', label: 'Nombre' },
            { id: 'team', label: 'Selección' },
            { id: 'rating', label: 'Rating' },
            { id: 'marketValue', label: 'Valor' },
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSortBy(opt.id as SortKey)}
              className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${
                sortBy === opt.id
                  ? 'border-[#006B3F] bg-[#006B3F] text-white'
                  : 'border-wc26-gray100 bg-white text-wc26-text/55'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="wc26-card p-5 text-center text-sm text-wc26-text/55">Cargando jugadores...</p>}
      {error && <p className="wc26-card p-5 text-center text-sm text-wc26-red">Error al cargar jugadores.</p>}

      {!isLoading && filteredPlayers.length === 0 && (
        <p className="wc26-card p-5 text-center text-sm text-wc26-text/55">{EMPTY.players}</p>
      )}

      <motion.div
        initial={MOTION.stagger.initial}
        animate={MOTION.stagger.animate}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {filteredPlayers.map(player => (
          <PlayerFifaCard key={player.id} player={player} />
        ))}
      </motion.div>
    </div>
  )
}
