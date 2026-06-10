import { useDeviceReporter } from '../../hooks/useDeviceReporter'

/** Monta tracking de dispositivo sin UI. */
export function DeviceReporterBridge() {
  useDeviceReporter()
  return null
}
