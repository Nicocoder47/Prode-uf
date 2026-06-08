type SeccionalLogoProps = {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClass = {
  sm: 'wc26-brand-logo wc26-brand-logo--sm',
  md: 'wc26-brand-logo wc26-brand-logo--md',
  lg: 'wc26-brand-logo wc26-brand-logo--lg',
}

export function SeccionalLogo({ size = 'sm', className = '' }: SeccionalLogoProps) {
  return (
    <img
      src="/logo-union-ferroviaria.png"
      alt="Unión Ferroviaria — Seccional Gran Buenos Aires Sud"
      className={`${sizeClass[size]} ${className}`.trim()}
      loading="eager"
      decoding="async"
    />
  )
}
