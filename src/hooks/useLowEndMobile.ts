import { useSyncExternalStore } from 'react'

type NetworkInformation = {
  saveData?: boolean
}

function detectLowEndMobile(): boolean {
  if (typeof window === 'undefined') return false

  const narrow = window.matchMedia('(max-width: 768px)').matches
  if (!narrow) return false

  const nav = navigator as Navigator & {
    deviceMemory?: number
    connection?: NetworkInformation
  }

  if (nav.connection?.saveData) return true

  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0 && nav.deviceMemory <= 3) {
    return true
  }

  if (
    typeof nav.hardwareConcurrency === 'number' &&
    nav.hardwareConcurrency > 0 &&
    nav.hardwareConcurrency <= 4
  ) {
    return true
  }

  return false
}

function subscribe(onStoreChange: () => void) {
  const mq = window.matchMedia('(max-width: 768px)')
  mq.addEventListener('change', onStoreChange)
  return () => mq.removeEventListener('change', onStoreChange)
}

/** Celular angosto con poca RAM/CPU o modo ahorro de datos. */
export function useLowEndMobile(): boolean {
  return useSyncExternalStore(subscribe, detectLowEndMobile, () => false)
}
