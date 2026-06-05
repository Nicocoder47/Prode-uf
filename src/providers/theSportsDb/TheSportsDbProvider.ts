/**
 * Optional enrichment provider — TheSportsDB.
 * Does not block build if THESPORTSDB_API_KEY is missing.
 */
const BASE = process.env.THESPORTSDB_BASE_URL || 'https://www.thesportsdb.com/api/v1/json';

export class TheSportsDbProvider {
  static isConfigured(): boolean {
    return Boolean(process.env.THESPORTSDB_API_KEY);
  }

  static async fetchPlayerPhoto(playerName: string): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const key = process.env.THESPORTSDB_API_KEY;
    try {
      const res = await fetch(`${BASE}/${key}/searchplayers.php?p=${encodeURIComponent(playerName)}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { player?: { strThumb?: string }[] };
      return data.player?.[0]?.strThumb ?? null;
    } catch {
      return null;
    }
  }

  static async syncPlayerPhotos(_limit = 20): Promise<number> {
    console.warn('[TheSportsDb] syncPlayerPhotos not implemented — use API-Football first');
    return 0;
  }
}
