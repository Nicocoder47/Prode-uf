/** Códigos FIFA (3 letras) → ISO2 para banderas. */
const FIFA_TO_ISO2: Record<string, string> = {
  ALG: 'dz',
  ARG: 'ar',
  AUS: 'au',
  AUT: 'at',
  BEL: 'be',
  BRA: 'br',
  CAN: 'ca',
  CHI: 'cl',
  COL: 'co',
  CRC: 'cr',
  CRO: 'hr',
  CUW: 'cw',
  DEN: 'dk',
  ECU: 'ec',
  EGY: 'eg',
  ENG: 'gb',
  ESP: 'es',
  FRA: 'fr',
  GER: 'de',
  GHA: 'gh',
  HAI: 'ht',
  IRN: 'ir',
  ITA: 'it',
  JOR: 'jo',
  JPN: 'jp',
  KOR: 'kr',
  KSA: 'sa',
  MAR: 'ma',
  MEX: 'mx',
  NED: 'nl',
  NOR: 'no',
  NZL: 'nz',
  PAN: 'pa',
  PAR: 'py',
  PER: 'pe',
  POR: 'pt',
  QAT: 'qa',
  RSA: 'za',
  SCO: 'gb',
  SEN: 'sn',
  SRB: 'rs',
  SUI: 'ch',
  TUN: 'tn',
  TUR: 'tr',
  URU: 'uy',
  USA: 'us',
  UZB: 'uz',
  WAL: 'gb',
}

/** Resuelve ISO2 desde country_code (2 letras) o código FIFA (3 letras). */
export function resolveCountryIso2(fifaCode?: string | null, countryCode?: string | null): string | null {
  const iso = (countryCode ?? '').trim()
  if (/^[a-z]{2}$/i.test(iso)) return iso.toLowerCase()

  const fifa = (fifaCode ?? '').trim().toUpperCase()
  if (FIFA_TO_ISO2[fifa]) return FIFA_TO_ISO2[fifa]

  const isoUpper = iso.toUpperCase()
  if (FIFA_TO_ISO2[isoUpper]) return FIFA_TO_ISO2[isoUpper]

  return null
}

/** URL de bandera real (prioriza flagcdn por país; fallback a URLs guardadas). */
export function resolveTeamFlagUrl(
  flag?: string | null,
  crest?: string | null,
  countryCode?: string | null,
  fifaCode?: string | null,
): string | null {
  const iso2 = resolveCountryIso2(fifaCode, countryCode)
  if (iso2) return `https://flagcdn.com/w160/${iso2}.png`

  for (const value of [flag, crest]) {
    if (!value) continue
    const trimmed = value.trim()
    if (/^https?:\/\//i.test(trimmed)) return trimmed
  }
  return null
}

/** Resuelve URL de escudo/bandera sin exponer texto al usuario. */
export function resolveTeamImageUrl(
  flag?: string | null,
  crest?: string | null,
  logo?: string | null,
  countryCode?: string | null,
  fifaCode?: string | null,
): string | null {
  return resolveTeamFlagUrl(flag, crest ?? logo, countryCode, fifaCode)
}

export function isLikelyImageUrl(value?: string | null): boolean {
  return !!value && /^https?:\/\//i.test(value.trim())
}

export function teamAbbreviation(code?: string, name?: string): string {
  if (code?.trim()) return code.trim().toUpperCase()
  if (name?.trim()) return name.trim().slice(0, 3).toUpperCase()
  return '—'
}
