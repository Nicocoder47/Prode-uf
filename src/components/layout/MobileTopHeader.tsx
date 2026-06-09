import { Link } from 'react-router-dom'
import { User } from 'lucide-react'
import { SeccionalLogo } from './SeccionalLogo'

type MobileTopHeaderProps = {
  className?: string
}

export function MobileTopHeader({ className = '' }: MobileTopHeaderProps) {
  return (
    <header className={`wc26-mobile-top-bar ${className}`.trim()}>
      <SeccionalLogo size="header" className="wc26-mobile-top-bar__logo" />
      <div className="wc26-mobile-top-bar__copy">
        <p className="wc26-mobile-top-bar__title">PRODEMUNDIAL</p>
        <p className="wc26-mobile-top-bar__tagline">de la seccional más grande del país</p>
      </div>
      <Link to="/profile" className="wc26-header-icon-btn wc26-mobile-top-bar__action" aria-label="Perfil">
        <User className="h-4 w-4" />
      </Link>
    </header>
  )
}
