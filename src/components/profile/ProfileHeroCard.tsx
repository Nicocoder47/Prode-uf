import { Trophy } from 'lucide-react'
import { MOTION } from '../../constants/design'
import { AdaptiveSection } from '../../utils/adaptiveMotion'
import { getInitials, maskDni } from '../../utils/maskDni'

type ProfileHeroCardProps = {
  fullName: string
  legajo: string
  role: string
  rank: number | null
  totalPoints: number
  accuracy: number | null
  maskedDni: string
  email: string
}

export function ProfileHeroCard({
  fullName,
  legajo,
  role,
  rank,
  totalPoints,
  accuracy,
  maskedDni,
  email,
}: ProfileHeroCardProps) {
  return (
    <AdaptiveSection motionProps={MOTION.enter} className="wc26-profile-premium-hero">
      <div className="wc26-profile-premium-hero__glow" aria-hidden="true" />
      <div className="wc26-profile-premium-hero__top">
        <div className="wc26-profile-premium-hero__avatar">{getInitials(fullName)}</div>
        <div className="wc26-profile-premium-hero__identity">
          <p className="wc26-profile-premium-hero__kicker">Mi carnet PRODE</p>
          <h1 className="wc26-profile-premium-hero__name">{fullName}</h1>
          <p className="wc26-profile-premium-hero__legajo">Legajo {legajo}</p>
          <p className="wc26-profile-premium-hero__role">{role}</p>
          {email ? <p className="wc26-profile-premium-hero__email">{email}</p> : null}
        </div>
      </div>

      <div className="wc26-profile-premium-hero__metrics">
        <div className="wc26-profile-premium-hero__metric">
          <span className="wc26-profile-premium-hero__metric-label">Posición</span>
          <span className="wc26-profile-premium-hero__metric-value">
            {rank != null ? `#${rank}` : '—'}
          </span>
        </div>
        <div className="wc26-profile-premium-hero__metric wc26-profile-premium-hero__metric--gold">
          <span className="wc26-profile-premium-hero__metric-label">Puntos</span>
          <span className="wc26-profile-premium-hero__metric-value">{totalPoints}</span>
        </div>
        <div className="wc26-profile-premium-hero__metric">
          <span className="wc26-profile-premium-hero__metric-label">Precisión</span>
          <span className="wc26-profile-premium-hero__metric-value">
            {accuracy != null ? `${accuracy}%` : '—'}
          </span>
        </div>
        <div className="wc26-profile-premium-hero__metric">
          <span className="wc26-profile-premium-hero__metric-label">DNI</span>
          <span className="wc26-profile-premium-hero__metric-value">{maskedDni}</span>
        </div>
      </div>

      {rank != null ? (
        <span className="wc26-profile-premium-hero__badge">
          <Trophy className="h-4 w-4" />#{rank} en el ranking
        </span>
      ) : (
        <span className="wc26-profile-premium-hero__badge wc26-profile-premium-hero__badge--muted">
          <Trophy className="h-4 w-4" />
          Sin posición aún
        </span>
      )}
    </AdaptiveSection>
  )
}

export function ProfileHeroCardContainer({
  fullName,
  legajo,
  role,
  rank,
  totalPoints,
  accuracy,
  dni,
  email,
}: Omit<ProfileHeroCardProps, 'maskedDni'> & { dni: string | null | undefined }) {
  return (
    <ProfileHeroCard
      fullName={fullName}
      legajo={legajo}
      role={role}
      rank={rank}
      totalPoints={totalPoints}
      accuracy={accuracy}
      maskedDni={maskDni(dni)}
      email={email}
    />
  )
}
