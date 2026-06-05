import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { MOTION } from '../../constants/design'
import { WC26_GROUP_NAMES, groupColor } from '../../constants/groups'
import { TeamCrest } from '../../components/worldcup/TeamCrest'
import { useGroupsOverview } from '../../useWorldCupData'
import { DataState } from '../../components/ui/DataState'
import { EMPTY } from '../../utils/emptyState'

export default function GroupsPage() {
  const { data: groups = [], isLoading, isError, refetch } = useGroupsOverview()

  return (
    <div className="space-y-5 pb-4">
      <header className="wc26-page-header wc26-page-header--green">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#F8B91E]">Mundial 2026</p>
        <h1 className="text-2xl font-extrabold text-white md:text-3xl">Grupos del Mundial</h1>
        <p className="mt-1 text-sm text-white/85">48 selecciones · 12 grupos · explorá el camino al título</p>
      </header>

      <DataState
        isLoading={isLoading}
        isError={isError}
        loadingMessage="Cargando grupos..."
        errorMessage="No pudimos cargar los grupos."
        onRetry={() => refetch()}
      >
        <motion.div
          initial={MOTION.stagger.initial}
          animate={MOTION.stagger.animate}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {WC26_GROUP_NAMES.map(groupId => {
            const summary = groups.find(g => g.id === groupId)
            const teams = summary?.teams ?? []
            const color = groupColor(groupId)
            return (
              <motion.div key={groupId} variants={MOTION.enter}>
                <Link
                  to={`/groups/${groupId}`}
                  className="wc26-group-card"
                  style={{ '--group-accent': color } as React.CSSProperties}
                >
                  <div className="wc26-group-card__bar" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-wc26-text/45">Grupo</p>
                      <p className="text-3xl font-black leading-none" style={{ color }}>
                        {groupId}
                      </p>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm">
                      <ChevronRight className="h-5 w-5" style={{ color }} />
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-wc26-text/50">
                    {teams.length > 0 ? `${teams.length} selecciones` : 'Cargando equipos…'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {teams.length > 0 ? (
                      teams.slice(0, 4).map(t => (
                        <div key={t.id} className="flex items-center gap-1 rounded-lg bg-[#F8F5EF] px-1.5 py-1">
                          <TeamCrest flag={t.flag} code={t.code} size="sm" />
                          <span className="text-[10px] font-black text-wc26-text">{t.code}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-wc26-text/40">{EMPTY.standings}</span>
                    )}
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      </DataState>
    </div>
  )
}
