/** 48 selecciones clasificadas al Mundial 2026 (códigos FIFA verificados). */
export const WC26_PARTICIPANT_CODES: readonly string[] = [
  'ALG', 'ARG', 'AUS', 'AUT', 'BEL', 'BIH', 'BRA', 'CAN', 'CPV', 'COL', 'COD', 'CRO',
  'CUW', 'CZE', 'ECU', 'EGY', 'ENG', 'FRA', 'GER', 'GHA', 'HAI', 'IRN', 'IRQ', 'CIV',
  'JPN', 'JOR', 'MEX', 'MAR', 'NED', 'NZL', 'NOR', 'PAN', 'PAR', 'POR', 'QAT', 'KSA',
  'SCO', 'SEN', 'RSA', 'KOR', 'ESP', 'SWE', 'SUI', 'TUN', 'TUR', 'USA', 'URU', 'UZB',
] as const;

export const WC26_PARTICIPANT_SET = new Set<string>(WC26_PARTICIPANT_CODES);

export const WC26_PARTICIPANT_COUNT = WC26_PARTICIPANT_CODES.length;
