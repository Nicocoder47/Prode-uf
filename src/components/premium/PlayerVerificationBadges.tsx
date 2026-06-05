interface PlayerVerificationBadgesProps {
  verificationStatus?: string | null
  dataQualityScore?: number | null
}

function statusBadge(status?: string | null) {
  switch (status) {
    case 'verified':
      return { label: 'Verificado', className: 'bg-[#006B3F]/12 text-[#006B3F] border-[#006B3F]/30' }
    case 'needs_review':
      return { label: 'En revisión', className: 'bg-[#F8B91E]/15 text-[#8A6500] border-[#F8B91E]/40' }
    case 'conflict':
      return { label: 'Conflicto', className: 'bg-[#E63946]/12 text-[#E63946] border-[#E63946]/30' }
    case 'rejected':
      return { label: 'Rechazado', className: 'bg-wc26-gray100 text-wc26-text/50 border-wc26-gray100' }
    default:
      return { label: 'Pendiente de verificación', className: 'bg-[#0057B8]/10 text-[#0057B8] border-[#0057B8]/25' }
  }
}

export function PlayerVerificationBadges({ verificationStatus, dataQualityScore }: PlayerVerificationBadgesProps) {
  const identity = statusBadge(verificationStatus)
  const qualityLabel =
    dataQualityScore != null && dataQualityScore >= 80 ? 'Datos verificados' : 'Datos en revisión'
  const qualityClass =
    dataQualityScore != null && dataQualityScore >= 80
      ? 'bg-[#006B3F]/12 text-[#006B3F] border-[#006B3F]/30'
      : 'bg-[#F8B91E]/12 text-[#FFD75A] border-[#F8B91E]/30'

  return (
    <div className="flex flex-wrap justify-center gap-2">
      <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide ${identity.className}`}>
        {identity.label}
      </span>
      <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide ${qualityClass}`}>
        {qualityLabel}
        {dataQualityScore != null ? ` · ${dataQualityScore}%` : ''}
      </span>
    </div>
  )
}
