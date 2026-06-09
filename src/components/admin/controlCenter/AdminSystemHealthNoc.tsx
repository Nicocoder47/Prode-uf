import type { SystemHealthItem } from '../../../utils/adminControlCenter'
import { AdminControlGlass } from './AdminControlGlass'

const STATUS_LABEL = {
  ok: 'OK',
  warning: 'WARNING',
  error: 'ERROR',
} as const

export function AdminSystemHealthNoc({ items }: { items: SystemHealthItem[] }) {
  return (
    <AdminControlGlass
      kicker="NOC"
      title="Salud del sistema"
      description="Indicadores operativos del Mundial"
    >
      <div className="admin-control-noc-grid">
        {items.map(item => (
          <div key={item.id} className={`admin-control-noc admin-control-noc--${item.status}`}>
            <div className="admin-control-noc__head">
              <span className="admin-control-noc__pulse" aria-hidden="true" />
              <p className="admin-control-noc__label">{item.label}</p>
              <span className="admin-control-noc__status">{STATUS_LABEL[item.status]}</span>
            </div>
            <p className="admin-control-noc__detail">{item.detail}</p>
          </div>
        ))}
      </div>
    </AdminControlGlass>
  )
}
