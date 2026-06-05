import axios from 'axios';
import {
  namesMatch,
  nationalitiesMatch,
  parseHeightCm,
  parseRating,
  parseShirtNumber,
} from './playerMatch';
import type { EnrichmentCandidate } from './types';

const API_URL = 'https://v3.football.api-sports.io';
const HEADERS = {
  'x-rapidapi-host': 'v3.football.api-sports.io',
  'x-rapidapi-key': process.env.API_FOOTBALL_KEY || '',
};
const SEASON = process.env.API_FOOTBALL_WORLD_CUP_SEASON || '2026';

export class ApiFootballEnrichment {
  static isConfigured(): boolean {
    return !!process.env.API_FOOTBALL_KEY && process.env.API_FOOTBALL_KEY !== 'your_api_football_key_here';
  }

  private static async searchPlayerId(name: string, nationality?: string | null): Promise<number | null> {
    const parts = name.trim().split(/\s+/);
    const search = parts.length > 1 ? parts[parts.length - 1] : name;

    const res = await axios.get(`${API_URL}/players`, {
      headers: HEADERS,
      params: { search },
      timeout: 12_000,
    });

    const rows = res.data.response ?? [];
    for (const row of rows) {
      const player = row.player;
      if (!player?.id) continue;
      if (!namesMatch(player.name ?? '', name)) continue;
      if (!nationalitiesMatch(nationality, player.nationality)) continue;
      return Number(player.id);
    }
    return null;
  }

  static async lookup(name: string, nationality?: string | null): Promise<EnrichmentCandidate | null> {
    if (!this.isConfigured()) return null;

    try {
      const playerId = await this.searchPlayerId(name, nationality);
      if (!playerId) return null;

      const res = await axios.get(`${API_URL}/players`, {
        headers: HEADERS,
        params: { id: playerId, season: SEASON },
        timeout: 12_000,
      });

      const item = res.data.response?.[0];
      if (!item?.player) return null;

      const stats = item.statistics?.[0];
      const games = stats?.games ?? {};

      return {
        shirt_number: parseShirtNumber(games.number),
        height: parseHeightCm(item.player.height),
        preferred_foot: null,
        club: stats?.team?.name ?? null,
        photo_url: item.player.photo ?? null,
        rating: parseRating(games.rating),
      };
    } catch {
      return null;
    }
  }
}
