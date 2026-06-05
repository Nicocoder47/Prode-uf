/** Resuelve URL de escudo/bandera sin exponer texto al usuario. */
export function resolveTeamImageUrl(
  flag?: string | null,
  crest?: string | null,
  logo?: string | null
): string | null {
  for (const value of [flag, crest, logo]) {
    if (!value) continue
    const trimmed = value.trim()
    if (/^https?:\/\//i.test(trimmed)) return trimmed
  }
  return null
}

export function isLikelyImageUrl(value?: string | null): boolean {
  return !!value && /^https?:\/\//i.test(value.trim())
}

export function teamAbbreviation(code?: string, name?: string): string {
  if (code?.trim()) return code.trim().toUpperCase()
  if (name?.trim()) return name.trim().slice(0, 3).toUpperCase()
  return '—'
}
