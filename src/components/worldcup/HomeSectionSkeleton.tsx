type HomeSectionSkeletonProps = {
  tall?: boolean
  className?: string
}

export function HomeSectionSkeleton({ tall = false, className = '' }: HomeSectionSkeletonProps) {
  return (
    <div
      className={`wc26-deferred-section mb-5 rounded-[22px] border border-white/5 bg-white/[0.03] ${
        tall ? 'min-h-[20rem]' : 'min-h-[10rem]'
      } ${className}`}
      aria-busy="true"
      aria-label="Cargando sección"
    />
  )
}
