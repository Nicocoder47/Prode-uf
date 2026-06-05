import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { MOTION } from '../../constants/design'
import { WC26_GROUP_NAMES, groupColor, normalizeGroupId } from '../../constants/groups'
import { useWorldCupTeams } from '../../useWorldCupData'

export function HomeGroupsStrip() {
  const { data: teams = [] } = useWorldCupTeams()

  const countByGroup = WC26_GROUP_NAMES.reduce<Record<string, number>>((acc, id) => {
    acc[id] = teams.filter(t => normalizeGroupId(t.group) === id).length
    return acc
  }, {})

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <p className="wc26-section-title !mb-0">Explorá los grupos</p>
        <Link to="/groups" className="flex items-center gap-0.5 text-xs font-black text-[#0057B8]">
          Ver todos <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <motion.div {...MOTION.enter} className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
        {WC26_GROUP_NAMES.map(id => {
          const count = countByGroup[id] || 4
          return (
            <motion.div key={id} {...MOTION.tap}>
              <Link
                to={`/groups/${id}`}
                className="wc26-group-chip shrink-0"
                style={{ '--group-color': groupColor(id) } as React.CSSProperties}
              >
                <span className="wc26-group-chip__letter">{id}</span>
                <span className="wc26-group-chip__meta">Grupo {id}</span>
                <span className="wc26-group-chip__count">{count} equipos</span>
              </Link>
            </motion.div>
          )
        })}
      </motion.div>
    </section>
  )
}
