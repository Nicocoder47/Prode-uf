const AR_TIMEZONE = 'America/Argentina/Buenos_Aires'

function formatDateInArgentina(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: AR_TIMEZONE }).format(now)
}

/** Fecha calendario en Argentina (YYYY-MM-DD) para partidos del día. */
export function todayInArgentina(now = new Date()): string {
  return formatDateInArgentina(now)
}

/** Día anterior en Argentina (YYYY-MM-DD). */
export function yesterdayInArgentina(now = new Date()): string {
  const d = new Date(now)
  d.setDate(d.getDate() - 1)
  return formatDateInArgentina(d)
}

/** Fecha calendario AR del kick-off de un partido. */
export function kickOffDateInArgentina(kickOff: string): string {
  return formatDateInArgentina(new Date(kickOff))
}
