export function WorldCupRibbon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 24" className={className} aria-hidden="true" preserveAspectRatio="none">
      <rect x="0" y="0" width="320" height="8" fill="#E63946" opacity="0.9" />
      <rect x="0" y="8" width="320" height="8" fill="#FFFFFF" opacity="0.85" />
      <rect x="0" y="16" width="320" height="8" fill="#0057B8" opacity="0.9" />
      <rect x="0" y="0" width="320" height="24" fill="url(#ribbonGold)" opacity="0.12" />
      <defs>
        <linearGradient id="ribbonGold" x1="0" y1="0" x2="320" y2="0">
          <stop offset="0%" stopColor="#D4AF37" />
          <stop offset="50%" stopColor="#F8B91E" />
          <stop offset="100%" stopColor="#D4AF37" />
        </linearGradient>
      </defs>
    </svg>
  )
}
