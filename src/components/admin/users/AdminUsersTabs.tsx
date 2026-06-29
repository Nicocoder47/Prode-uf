export type AdminUsersTab = 'all' | 'review' | 'verified' | 'recovery' | 'login_issues'

type TabDef = {
  id: AdminUsersTab
  label: string
  count: number
  tone?: 'red' | 'green' | 'amber' | 'orange'
}

type Props = {
  active: AdminUsersTab
  counts: { all: number; review: number; verified: number; recovery: number; login_issues: number }
  onChange: (tab: AdminUsersTab) => void
}

export function AdminUsersTabs({ active, counts, onChange }: Props) {
  const tabs: TabDef[] = [
    { id: 'all', label: 'Todos', count: counts.all },
    { id: 'review', label: 'En revisión', count: counts.review, tone: 'red' },
    { id: 'verified', label: 'Verificados', count: counts.verified, tone: 'green' },
    { id: 'login_issues', label: 'Login con error', count: counts.login_issues, tone: 'orange' },
    { id: 'recovery', label: 'Recuperar', count: counts.recovery, tone: 'amber' },
  ]

  return (
    <div className="admin-users-tabs" role="tablist" aria-label="Secciones de usuarios">
      {tabs.map(tab => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`admin-users-tabs__btn admin-users-tabs__btn--${tab.tone ?? 'default'}${isActive ? ' is-active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className="admin-users-tabs__count">{tab.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
