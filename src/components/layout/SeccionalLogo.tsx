type SeccionalLogoProps = {
  size?: 'sm' | 'md' | 'lg' | 'header'
  className?: string
}

const sizeClass = {
  sm: 'wc26-brand-logo wc26-brand-logo--sm',
  md: 'wc26-brand-logo wc26-brand-logo--md',
  lg: 'wc26-brand-logo wc26-brand-logo--lg',
  header: 'wc26-brand-logo wc26-brand-logo--header',
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
