import axios from 'axios';
import type { ExternalPlayerCandidate } from '../playerMatching';

/** Sportmonks — requiere SPORTMONKS_API_TOKEN. Sin token: no devuelve candidatos. */
export class SportmonksPlayerProvider {
  static isConfigured(): boolean {
    return !!process.env.SPORTMONKS_API_TOKEN;
  }

  static async searchCandidates(name: string, _nationality?: string | null): Promise<ExternalPlayerCandidate[]> {
    if (!this.isConfigured()) return [];

    const base = process.env.SPORTMONKS_BASE_URL || 'https://api.sportmonks.com/v3/football';
    const token = process.env.SPORTMONKS_API_TOKEN!;

    try {
      const res = await axios.get(`${base}/players/search/${encodeURIComponent(name)}`, {
        params: { api_token: token },
        timeout: 12_000,
      });

      const rows = res.data?.data ?? [];
      return rows.slice(0, 5).map((p: Record<string, unknown>) => ({
        source: 'sportmonks',
        externalId: p.id != null ? String(p.id) : null,
        name: String(p.display_name ?? p.name ?? name),
        birthDate: (p.date_of_birth as string) ?? null,
        nationality: (p.nationality as string) ?? null,
        position: (p.position as string) ?? null,
        height: typeof p.height === 'number' ? p.height : null,
        photoUrl: (p.image_path as string) ?? null,
      }));
    } catch {
      return [];
    }
  }
}
