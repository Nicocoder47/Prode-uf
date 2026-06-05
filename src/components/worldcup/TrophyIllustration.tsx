import { WC26_ASSETS } from '../../constants/design'

type TrophyIllustrationProps = {
  className?: string
  variant?: 'hero' | 'header' | 'inline'
}

const variantClass = {
  hero: 'wc26-copita wc26-copita--hero',
  header: 'wc26-copita wc26-copita--header',
  inline: 'wc26-copita wc26-copita--inline',
}

export function TrophyIllustration({ className = '', variant = 'hero' }: TrophyIllustrationProps) {
  return (
    <div className={`wc26-copita-wrap ${variantClass[variant]} ${className}`}>
      <span className="wc26-copita-glow" aria-hidden="true" />
      <img
        src={WC26_ASSETS.copita}
        alt="Copa del Mundo FIFA"
        className="wc26-copita__img"
        loading="eager"
        decoding="async"
      />
    </div>
  )
}
