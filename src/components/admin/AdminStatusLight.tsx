import type { HealthStatus } from '../../types/admin.ts'

const CLASS: Record<HealthStatus, string> = {
  green: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200',
  yellow: 'border-amber-400/35 bg-amber-500/10 text-amber-200',
  red: 'border-red-400/35 bg-red-500/10 text-red-200',
}

const DOT: Record<HealthStatus, string> = {
  green: 'bg-emerald-400',
  yellow: 'bg-amber-400',
  red: 'bg-red-400',
}

export function AdminStatusLight({ status, label }: { status: HealthStatus; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${CLASS[status]}`}>
      <span className={`h-2 w-2 rounded-full ${DOT[status]}`} />
      {label ?? status}
    </span>
  )
}

export function scoringStatusLight(status: string): HealthStatus {
  if (status === 'scored') return 'green'
  if (status === 'pending_scoring') return 'yellow'
  if (status === 'live') return 'yellow'
  if (status === 'scheduled') return 'green'
  return 'red'
}
