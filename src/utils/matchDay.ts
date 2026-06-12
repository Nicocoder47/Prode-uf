/** Fecha calendario en Argentina (YYYY-MM-DD) para partidos del día. */
export function todayInArgentina(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(now)
}
