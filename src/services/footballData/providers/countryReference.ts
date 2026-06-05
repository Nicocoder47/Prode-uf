/** Sprint V2 — referencia factual ISO 3166 + códigos FIFA (no es dato inventado).
 *  source declarado: 'iso-3166-reference'. Confidence alta porque son estándares públicos.
 */
import { normalizeCountryName } from '../../../utils/playerIdentityNormalizer';

export interface CountryReference {
  name: string;
  officialName?: string;
  fifaCode: string;
  iso2: string;
  iso3: string;
  confederation: string;
  wikidataId?: string;
}

const REFERENCE: CountryReference[] = [
  { name: 'Argentina', fifaCode: 'ARG', iso2: 'AR', iso3: 'ARG', confederation: 'CONMEBOL', wikidataId: 'Q414' },
  { name: 'Brazil', fifaCode: 'BRA', iso2: 'BR', iso3: 'BRA', confederation: 'CONMEBOL', wikidataId: 'Q155' },
  { name: 'Uruguay', fifaCode: 'URU', iso2: 'UY', iso3: 'URY', confederation: 'CONMEBOL', wikidataId: 'Q77' },
  { name: 'Colombia', fifaCode: 'COL', iso2: 'CO', iso3: 'COL', confederation: 'CONMEBOL', wikidataId: 'Q739' },
  { name: 'Ecuador', fifaCode: 'ECU', iso2: 'EC', iso3: 'ECU', confederation: 'CONMEBOL', wikidataId: 'Q736' },
  { name: 'Paraguay', fifaCode: 'PAR', iso2: 'PY', iso3: 'PRY', confederation: 'CONMEBOL', wikidataId: 'Q733' },
  { name: 'Peru', fifaCode: 'PER', iso2: 'PE', iso3: 'PER', confederation: 'CONMEBOL', wikidataId: 'Q419' },
  { name: 'Chile', fifaCode: 'CHI', iso2: 'CL', iso3: 'CHL', confederation: 'CONMEBOL', wikidataId: 'Q298' },
  { name: 'Bolivia', fifaCode: 'BOL', iso2: 'BO', iso3: 'BOL', confederation: 'CONMEBOL', wikidataId: 'Q750' },
  { name: 'Venezuela', fifaCode: 'VEN', iso2: 'VE', iso3: 'VEN', confederation: 'CONMEBOL', wikidataId: 'Q717' },

  { name: 'France', fifaCode: 'FRA', iso2: 'FR', iso3: 'FRA', confederation: 'UEFA', wikidataId: 'Q142' },
  { name: 'Spain', fifaCode: 'ESP', iso2: 'ES', iso3: 'ESP', confederation: 'UEFA', wikidataId: 'Q29' },
  { name: 'Germany', fifaCode: 'GER', iso2: 'DE', iso3: 'DEU', confederation: 'UEFA', wikidataId: 'Q183' },
  { name: 'England', fifaCode: 'ENG', iso2: 'GB', iso3: 'GBR', confederation: 'UEFA', wikidataId: 'Q21' },
  { name: 'Portugal', fifaCode: 'POR', iso2: 'PT', iso3: 'PRT', confederation: 'UEFA', wikidataId: 'Q45' },
  { name: 'Netherlands', fifaCode: 'NED', iso2: 'NL', iso3: 'NLD', confederation: 'UEFA', wikidataId: 'Q55' },
  { name: 'Italy', fifaCode: 'ITA', iso2: 'IT', iso3: 'ITA', confederation: 'UEFA', wikidataId: 'Q38' },
  { name: 'Belgium', fifaCode: 'BEL', iso2: 'BE', iso3: 'BEL', confederation: 'UEFA', wikidataId: 'Q31' },
  { name: 'Croatia', fifaCode: 'CRO', iso2: 'HR', iso3: 'HRV', confederation: 'UEFA', wikidataId: 'Q224' },
  { name: 'Switzerland', fifaCode: 'SUI', iso2: 'CH', iso3: 'CHE', confederation: 'UEFA', wikidataId: 'Q39' },
  { name: 'Denmark', fifaCode: 'DEN', iso2: 'DK', iso3: 'DNK', confederation: 'UEFA', wikidataId: 'Q35' },
  { name: 'Poland', fifaCode: 'POL', iso2: 'PL', iso3: 'POL', confederation: 'UEFA', wikidataId: 'Q36' },
  { name: 'Serbia', fifaCode: 'SRB', iso2: 'RS', iso3: 'SRB', confederation: 'UEFA', wikidataId: 'Q403' },
  { name: 'Austria', fifaCode: 'AUT', iso2: 'AT', iso3: 'AUT', confederation: 'UEFA', wikidataId: 'Q40' },
  { name: 'Ukraine', fifaCode: 'UKR', iso2: 'UA', iso3: 'UKR', confederation: 'UEFA', wikidataId: 'Q212' },
  { name: 'Scotland', fifaCode: 'SCO', iso2: 'GB', iso3: 'GBR', confederation: 'UEFA', wikidataId: 'Q22' },
  { name: 'Wales', fifaCode: 'WAL', iso2: 'GB', iso3: 'GBR', confederation: 'UEFA', wikidataId: 'Q25' },
  { name: 'Turkey', fifaCode: 'TUR', iso2: 'TR', iso3: 'TUR', confederation: 'UEFA', wikidataId: 'Q43' },
  { name: 'Czechia', officialName: 'Czech Republic', fifaCode: 'CZE', iso2: 'CZ', iso3: 'CZE', confederation: 'UEFA', wikidataId: 'Q213' },
  { name: 'Norway', fifaCode: 'NOR', iso2: 'NO', iso3: 'NOR', confederation: 'UEFA', wikidataId: 'Q20' },
  { name: 'Sweden', fifaCode: 'SWE', iso2: 'SE', iso3: 'SWE', confederation: 'UEFA', wikidataId: 'Q34' },
  { name: 'Hungary', fifaCode: 'HUN', iso2: 'HU', iso3: 'HUN', confederation: 'UEFA', wikidataId: 'Q28' },
  { name: 'Greece', fifaCode: 'GRE', iso2: 'GR', iso3: 'GRC', confederation: 'UEFA', wikidataId: 'Q41' },

  { name: 'Morocco', fifaCode: 'MAR', iso2: 'MA', iso3: 'MAR', confederation: 'CAF', wikidataId: 'Q1028' },
  { name: 'Senegal', fifaCode: 'SEN', iso2: 'SN', iso3: 'SEN', confederation: 'CAF', wikidataId: 'Q1041' },
  { name: 'Tunisia', fifaCode: 'TUN', iso2: 'TN', iso3: 'TUN', confederation: 'CAF', wikidataId: 'Q948' },
  { name: 'Algeria', fifaCode: 'ALG', iso2: 'DZ', iso3: 'DZA', confederation: 'CAF', wikidataId: 'Q262' },
  { name: 'Egypt', fifaCode: 'EGY', iso2: 'EG', iso3: 'EGY', confederation: 'CAF', wikidataId: 'Q79' },
  { name: 'Nigeria', fifaCode: 'NGA', iso2: 'NG', iso3: 'NGA', confederation: 'CAF', wikidataId: 'Q1033' },
  { name: 'Ghana', fifaCode: 'GHA', iso2: 'GH', iso3: 'GHA', confederation: 'CAF', wikidataId: 'Q117' },
  { name: 'Cameroon', fifaCode: 'CMR', iso2: 'CM', iso3: 'CMR', confederation: 'CAF', wikidataId: 'Q1009' },
  { name: 'Ivory Coast', officialName: "Côte d'Ivoire", fifaCode: 'CIV', iso2: 'CI', iso3: 'CIV', confederation: 'CAF', wikidataId: 'Q1008' },
  { name: 'Mali', fifaCode: 'MLI', iso2: 'ML', iso3: 'MLI', confederation: 'CAF', wikidataId: 'Q912' },
  { name: 'South Africa', fifaCode: 'RSA', iso2: 'ZA', iso3: 'ZAF', confederation: 'CAF', wikidataId: 'Q258' },
  { name: 'Cape Verde', officialName: 'Cabo Verde', fifaCode: 'CPV', iso2: 'CV', iso3: 'CPV', confederation: 'CAF', wikidataId: 'Q1011' },

  { name: 'Japan', fifaCode: 'JPN', iso2: 'JP', iso3: 'JPN', confederation: 'AFC', wikidataId: 'Q17' },
  { name: 'Korea Republic', officialName: 'South Korea', fifaCode: 'KOR', iso2: 'KR', iso3: 'KOR', confederation: 'AFC', wikidataId: 'Q884' },
  { name: 'Iran', fifaCode: 'IRN', iso2: 'IR', iso3: 'IRN', confederation: 'AFC', wikidataId: 'Q794' },
  { name: 'Saudi Arabia', fifaCode: 'KSA', iso2: 'SA', iso3: 'SAU', confederation: 'AFC', wikidataId: 'Q851' },
  { name: 'Australia', fifaCode: 'AUS', iso2: 'AU', iso3: 'AUS', confederation: 'AFC', wikidataId: 'Q408' },
  { name: 'Qatar', fifaCode: 'QAT', iso2: 'QA', iso3: 'QAT', confederation: 'AFC', wikidataId: 'Q846' },
  { name: 'Iraq', fifaCode: 'IRQ', iso2: 'IQ', iso3: 'IRQ', confederation: 'AFC', wikidataId: 'Q796' },
  { name: 'Uzbekistan', fifaCode: 'UZB', iso2: 'UZ', iso3: 'UZB', confederation: 'AFC', wikidataId: 'Q265' },
  { name: 'Jordan', fifaCode: 'JOR', iso2: 'JO', iso3: 'JOR', confederation: 'AFC', wikidataId: 'Q810' },

  { name: 'United States', officialName: 'United States of America', fifaCode: 'USA', iso2: 'US', iso3: 'USA', confederation: 'CONCACAF', wikidataId: 'Q30' },
  { name: 'Mexico', fifaCode: 'MEX', iso2: 'MX', iso3: 'MEX', confederation: 'CONCACAF', wikidataId: 'Q96' },
  { name: 'Canada', fifaCode: 'CAN', iso2: 'CA', iso3: 'CAN', confederation: 'CONCACAF', wikidataId: 'Q16' },
  { name: 'Costa Rica', fifaCode: 'CRC', iso2: 'CR', iso3: 'CRI', confederation: 'CONCACAF', wikidataId: 'Q800' },
  { name: 'Panama', fifaCode: 'PAN', iso2: 'PA', iso3: 'PAN', confederation: 'CONCACAF', wikidataId: 'Q804' },
  { name: 'Jamaica', fifaCode: 'JAM', iso2: 'JM', iso3: 'JAM', confederation: 'CONCACAF', wikidataId: 'Q766' },
  { name: 'Honduras', fifaCode: 'HON', iso2: 'HN', iso3: 'HND', confederation: 'CONCACAF', wikidataId: 'Q783' },
  { name: 'Haiti', fifaCode: 'HAI', iso2: 'HT', iso3: 'HTI', confederation: 'CONCACAF', wikidataId: 'Q790' },

  { name: 'New Zealand', fifaCode: 'NZL', iso2: 'NZ', iso3: 'NZL', confederation: 'OFC', wikidataId: 'Q664' },

  { name: 'Bosnia and Herzegovina', officialName: 'Bosnia-Herzegovina', fifaCode: 'BIH', iso2: 'BA', iso3: 'BIH', confederation: 'UEFA', wikidataId: 'Q225' },
  { name: 'Curaçao', officialName: 'Curacao', fifaCode: 'CUW', iso2: 'CW', iso3: 'CUW', confederation: 'CONCACAF', wikidataId: 'Q25279' },
  { name: 'DR Congo', officialName: 'Congo DR', fifaCode: 'COD', iso2: 'CD', iso3: 'COD', confederation: 'CAF', wikidataId: 'Q974' },
];

const ALIASES: Record<string, string> = {
  'cape verde islands': 'Cape Verde',
  'south korea': 'Korea Republic',
  'korea republic': 'Korea Republic',
  'bosnia herzegovina': 'Bosnia and Herzegovina',
  'congo dr': 'DR Congo',
  'democratic republic of the congo': 'DR Congo',
  curacao: 'Curaçao',
};

const BY_NAME = new Map(REFERENCE.map(c => [normalizeCountryName(c.name), c]));
for (const c of REFERENCE) {
  if (c.officialName) BY_NAME.set(normalizeCountryName(c.officialName), c);
}
for (const [alias, canonical] of Object.entries(ALIASES)) {
  const ref = BY_NAME.get(normalizeCountryName(canonical));
  if (ref) BY_NAME.set(normalizeCountryName(alias), ref);
}
const BY_FIFA = new Map(REFERENCE.map(c => [c.fifaCode.toUpperCase(), c]));
const BY_ISO3 = new Map(REFERENCE.map(c => [c.iso3.toUpperCase(), c]));

function normalizeConfederation(value: string | null | undefined): string {
  if (!value) return '';
  const u = value.toUpperCase().trim();
  const map: Record<string, string> = {
    EUROPE: 'UEFA',
    UEFA: 'UEFA',
    'SOUTH AMERICA': 'CONMEBOL',
    CONMEBOL: 'CONMEBOL',
    AFRICA: 'CAF',
    CAF: 'CAF',
    ASIA: 'AFC',
    AFC: 'AFC',
    'NORTH AMERICA': 'CONCACAF',
    'NORTH & CENTRAL AMERICA': 'CONCACAF',
    CONCACAF: 'CONCACAF',
    OCEANIA: 'OFC',
    OFC: 'OFC',
  };
  return map[u] ?? u;
}

export function lookupCountryReference(nameOrCode: string): CountryReference | null {
  if (!nameOrCode) return null;
  const key = nameOrCode.toUpperCase().trim();
  return (
    BY_FIFA.get(key) ??
    BY_ISO3.get(key) ??
    BY_NAME.get(normalizeCountryName(nameOrCode)) ??
    null
  );
}

export { normalizeConfederation };

export const COUNTRY_REFERENCE = REFERENCE;
