import axios from 'axios';
import {
  namesMatch,
  nationalitiesMatch,
  parseHeightCm,
  parseRating,
  parseShirtNumber,
} from '../../../providers/enrichment/playerMatch';
import type { ExternalPlayerCandidate } from '../playerMatching';

const API_URL = 'https://v3.football.api-sports.io';
const HEADERS = {
  'x-rapidapi-host': 'v3.football.api-sports.io',
  'x-rapidapi-key': process.env.API_FOOTBALL_KEY || '',
};
const SEASON = process.env.API_FOOTBALL_WORLD_CUP_SEASON || '2026';

export class ApiFootballPlayerProvider {
  static isConfigured(): boolean {
    return !!process.env.API_FOOTBALL_KEY && process.env.API_FOOTBALL_KEY !== 'your_api_football_key_here';
  }

  static async searchCandidates(name: string, nationality?: string | null): Promise<ExternalPlayerCandidate[]> {
    if (!this.isConfigured()) return [];

    const parts = name.trim().split(/\s+/);
    const search = parts.length > 1 ? parts[parts.length - 1] : name;

    try {
      const res = await axios.get(`${API_URL}/players`, {
        headers: HEADERS,
        params: { search },
        timeout: 12_000,
      });

      const rows = res.data.response ?? [];
      const out: ExternalPlayerCandidate[] = [];

      for (const row of rows.slice(0, 8)) {
        const player = row.player;
        if (!player?.id) continue;
        if (!namesMatch(player.name ?? '', name)) continue;
        if (!nationalitiesMatch(nationality, player.nationality)) continue;

        const detail = await axios.get(`${API_URL}/players`, {
          headers: HEADERS,
          params: { id: player.id, season: SEASON },
          timeout: 12_000,
        });

        const item = detail.data.response?.[0] ?? row;
        const p = item.player ?? player;
        const stats = item.statistics?.[0];
        const games = stats?.games ?? {};

        out.push({
          source: 'api-football',
          externalId: String(p.id),
          name: p.name,
          birthDate: p.birth?.date ?? null,
          nationality: p.nationality ?? null,
          position: p.position ?? games.position ?? null,
          club: stats?.team?.name ?? null,
          shirtNumber: parseShirtNumber(games.number),
          height: parseHeightCm(p.height),
          preferredFoot: null,
          photoUrl: p.photo ?? null,
          rating: parseRating(games.rating),
        });
      }

      return out;
    } catch {
      return [];
    }
  }
}
