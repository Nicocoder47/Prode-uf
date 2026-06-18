import { useCallback, useEffect, useRef, type TouchEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type PrizeImageLightboxProps = {
  src: string
  open: boolean
  onClose: () => void
}

export function PrizeImageLightbox({ src, open, onClose }: PrizeImageLightboxProps) {
  const touchStartY = useRef<number | null>(null)
  const touchStartX = useRef<number | null>(null)

  const handleTouchStart = useCallback((event: TouchEvent) => {
    touchStartY.current = event.touches[0]?.clientY ?? null
    touchStartX.current = event.touches[0]?.clientX ?? null
  }, [])

  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      if (touchStartY.current === null || touchStartX.current === null) return
      const touch = event.changedTouches[0]
      if (!touch) return

      const deltaY = touch.clientY - touchStartY.current
      const deltaX = touch.clientX - touchStartX.current

      if (Math.abs(deltaY) > 72 && Math.abs(deltaY) > Math.abs(deltaX)) {
        onClose()
      }

      touchStartY.current = null
      touchStartX.current = null
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="wc26-prize-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Imagen del premio"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button type="button" className="wc26-prize-lightbox__backdrop" onClick={onClose} aria-label="Cerrar" />
      <button type="button" className="wc26-prize-lightbox__close" onClick={onClose} aria-label="Cerrar">
        <X className="h-5 w-5" aria-hidden />
      </button>
      <div className="wc26-prize-lightbox__stage">
        <img src={src} alt="" className="wc26-prize-lightbox__img" decoding="async" />
      </div>
    </div>,
    document.body,
  )
}
