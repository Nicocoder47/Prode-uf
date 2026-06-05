/** Sprint V2 — busca IDs externos y banderas de selecciones nacionales */
import axios from 'axios';
import { normalizeCountryName } from '../../../utils/playerIdentityNormalizer';

export interface ExternalCountryCandidate {
  source: string;
  externalId?: string | null;
  name: string;
  flagUrl?: string | null;
  country?: string | null;
}

const AF_URL = 'https://v3.football.api-sports.io';
const AF_HEADERS = {
  'x-rapidapi-host': 'v3.football.api-sports.io',
  'x-rapidapi-key': process.env.API_FOOTBALL_KEY || '',
};

const SDB_BASE = process.env.THESPORTSDB_BASE_URL || 'https://www.thesportsdb.com/api/v1/json';
const SDB_KEY = process.env.THESPORTSDB_API_KEY || '3';

export class ApiFootballCountryProvider {
  static isConfigured(): boolean {
    return !!process.env.API_FOOTBALL_KEY && process.env.API_FOOTBALL_KEY !== 'your_api_football_key_here';
  }

  static async search(name: string): Promise<ExternalCountryCandidate | null> {
    if (!this.isConfigured()) return null;
    try {
      const res = await axios.get(`${AF_URL}/teams`, {
        headers: AF_HEADERS,
        params: { name },
        timeout: 12_000,
      });
      const rows = res.data.response ?? [];
      const wanted = normalizeCountryName(name);
      const hit =
        rows.find((r: any) => normalizeCountryName(r.team?.name ?? '') === wanted) ?? rows[0];
      if (!hit?.team) return null;
      return {
        source: 'api-football',
        externalId: hit.team.id != null ? String(hit.team.id) : null,
        name: hit.team.name,
        flagUrl: hit.team.logo ?? null,
        country: hit.team.country ?? null,
      };
    } catch {
      return null;
    }
  }
}

export class TheSportsDbCountryProvider {
  static async search(name: string): Promise<ExternalCountryCandidate | null> {
    try {
      const res = await axios.get(`${SDB_BASE}/${SDB_KEY}/searchteams.php`, {
        params: { t: name },
        timeout: 12_000,
      });
      const rows = res.data?.teams ?? [];
      const wanted = normalizeCountryName(name);
      const hit =
        rows.find((r: any) => normalizeCountryName(r.strTeam ?? '') === wanted) ?? rows[0];
      if (!hit) return null;
      return {
        source: 'thesportsdb',
        externalId: hit.idTeam ?? null,
        name: hit.strTeam ?? name,
        flagUrl: hit.strBadge || hit.strLogo || null,
        country: hit.strCountry ?? null,
      };
    } catch {
      return null;
    }
  }
}
