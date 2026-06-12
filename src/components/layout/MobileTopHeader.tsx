import { Link } from 'react-router-dom'
import { User } from 'lucide-react'
import { SeccionalLogo } from './SeccionalLogo'

type MobileTopHeaderProps = {
  className?: string
  variant?: 'default' | 'fixture'
}

export function MobileTopHeader({ className = '', variant = 'default' }: MobileTopHeaderProps) {
  const isFixture = variant === 'fixture'

  return (
    <header className={`wc26-mobile-top-bar ${className}`.trim()}>
      <SeccionalLogo size="header" className="wc26-mobile-top-bar__logo" />
      <div className="wc26-mobile-top-bar__copy">
        <p className="wc26-mobile-top-bar__title">{isFixture ? 'PRODEMUNDIAL 2026' : 'PRODEMUNDIAL'}</p>
        <p className="wc26-mobile-top-bar__tagline">
          {isFixture ? 'Viví el Mundial. Pronosticá. Sumá puntos.' : 'de la seccional más grande del país'}
        </p>
      </div>
      <Link to="/profile" className="wc26-header-icon-btn wc26-mobile-top-bar__action" aria-label="Perfil">
        <User className="h-4 w-4" />
      </Link>
    </header>
  )
}
