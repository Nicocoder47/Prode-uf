import { AdminMatchResultEditor } from '../AdminMatchResultEditor.tsx'
import { PremiumButton } from '../../ui/PremiumButton'
import { AdminStatusLight, scoringStatusLight } from '../AdminStatusLight'
import type { AdminScoringMatchRow } from '../../../types/admin'

type Props = {
  match: AdminScoringMatchRow
  busy: boolean
  onScore: () => void
  onRescore: () => void
  onSaveResult: (home: number, away: number) => void | Promise<void>
}

function formatDate(v: string | null | undefined) {
  if (!v) return '—'
  return new Date(v).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export function AdminScoringMatchCard({ match: m, busy, onScore, onRescore, onSaveResult }: Props) {
  const finished = m.status === 'finished'
  const canScore = finished && m.scoring_status === 'pending_scoring'
  const canRescore = finished && m.scoring_status === 'scored' && m.score_home != null && m.score_away != null
  const disabledTitle = 'Solo partidos finalizados'

  return (
    <article className="admin-premium-card admin-scoring-match-card">
      <div className="admin-scoring-match-card__teams">
        <h3>
          {m.home_team ?? '?'} <span className="text-white/40">vs</span> {m.away_team ?? '?'}
        </h3>
        <p className="admin-scoring-match-card__meta">
          {m.phase ?? '—'} · {formatDate(m.kick_off)}
        </p>
      </div>

      <div className="admin-scoring-match-card__row">
        <AdminStatusLight status={scoringStatusLight(m.scoring_status)} label={m.scoring_status} />
      </div>

      <AdminMatchResultEditor
        scoreHome={m.score_home}
        scoreAway={m.score_away}
        busy={busy}
        compact
        onSave={onSaveResult}
      />

      <div className="admin-scoring-match-card__stats">
        <span>
          Pred: <strong>{m.predictions_scored}/{m.predictions_total}</strong>
        </span>
        <span>
          Pts: <strong className="text-wc26-yellow">{m.points_assigned}</strong>
        </span>
      </div>

      <div className="admin-scoring-match-card__actions">
        {canScore ? (
          <PremiumButton size="sm" disabled={busy} onClick={onScore}>
            Puntuar
          </PremiumButton>
        ) : (
          <PremiumButton size="sm" disabled title={!finished ? disabledTitle : undefined}>
            Puntuar
          </PremiumButton>
        )}
        {canRescore ? (
          <PremiumButton size="sm" variant="ghost" disabled={busy} onClick={onRescore}>
            Recalcular
          </PremiumButton>
        ) : (
          <PremiumButton size="sm" variant="ghost" disabled title={!finished ? disabledTitle : undefined}>
            Recalcular
          </PremiumButton>
        )}
      </div>
      {!finished && (
        <p className="admin-scoring-match-card__hint">{disabledTitle}</p>
      )}
    </article>
  )
}
