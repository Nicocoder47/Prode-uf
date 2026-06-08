export const SECCIONAL_LOGO_SRC = '/logo-union-ferroviaria.png'
export const SECCIONAL_LOGO_ALT = 'Unión Ferroviaria — Seccional Gran Buenos Aires Sud'

type SeccionalLogoProps = {
  size?: 'header' | 'desktop' | 'login'
  className?: string
}

export function SeccionalLogo({ size = 'header', className = '' }: SeccionalLogoProps) {
  return (
    <img
      src={SECCIONAL_LOGO_SRC}
      alt={SECCIONAL_LOGO_ALT}
      className={`wc26-seccional-logo wc26-seccional-logo--${size}${className ? ` ${className}` : ''}`}
      loading="eager"
      decoding="async"
    />
  )
}
