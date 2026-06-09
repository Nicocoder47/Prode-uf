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
    <div className="space-y-4 pb-3">
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
          className="wc26-groups-grid"
        >
          {WC26_GROUP_NAMES.map(groupId => {
            const summary = groups.find(g => g.id === groupId)
            const teams = summary?.teams ?? []
            const color = groupColor(groupId)
            return (
              <motion.div key={groupId} variants={MOTION.enter} className="wc26-groups-grid__item">
                <Link
                  to={`/groups/${groupId}`}
                  className="wc26-group-card wc26-group-card--premium"
                  style={{ '--group-accent': color } as React.CSSProperties}
                >
                  <div className="wc26-group-card__glow" aria-hidden="true" />
                  <div className="wc26-group-card__bar" />
                  <div className="wc26-group-card__head">
                    <p className="wc26-group-card__meta">Grupo</p>
                    <p className="wc26-group-card__letter" style={{ color }}>
                      {groupId}
                    </p>
                    <p className="wc26-group-card__count">
                      {teams.length > 0 ? `${teams.length} selecciones` : 'Cargando equipos…'}
                    </p>
                  </div>
                  <div className="wc26-group-card__flags">
                    {teams.length > 0 ? (
                      teams.slice(0, 4).map(t => (
                        <span key={t.id} className="wc26-group-card__flag">
                          <TeamCrest flag={t.flag} code={t.code} name={t.name} size="xs" />
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-white/35">{EMPTY.standings}</span>
                    )}
                  </div>
                  <span className="wc26-group-card__cta">
                    Ver
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      </DataState>
    </div>
  )
}
