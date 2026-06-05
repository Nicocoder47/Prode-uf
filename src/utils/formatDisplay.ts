/** Placeholders elegantes — nunca "Dato no disponible". */

export function fmtOptional(value: string | number | null | undefined, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

/** Campo sin dato verificado — nunca inventar. */
export function fmtVerifiedField(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'Pendiente de verificación';
  if (typeof value === 'number' && value === 0) return 'Pendiente de verificación';
  return String(value);
}

export function fmtNumber(value: number | null | undefined, digits = 1, fallback = '—'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return value.toFixed(digits);
}

export function fmtPct(value: number | null | undefined, fallback = '—'): string {
  if (value === null || value === undefined) return fallback;
  return `${Math.round(value)}%`;
}

export function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
