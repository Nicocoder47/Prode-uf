import axios from 'axios';
import { parseHeightCm, parsePreferredFoot } from '../../../providers/enrichment/playerMatch';
import type { ExternalPlayerCandidate } from '../playerMatching';

export class TransfermarktPlayerProvider {
  static isConfigured(): boolean {
    return !!process.env.TRANSFERMARKT_API_BASE;
  }

  static async lookupByProviderId(providerPlayerId: string): Promise<ExternalPlayerCandidate | null> {
    if (!this.isConfigured() || !providerPlayerId) return null;

    try {
      const base = process.env.TRANSFERMARKT_API_BASE!;
      const res = await axios.get(`${base}/players/${providerPlayerId}`, {
        headers: { Accept: 'application/json' },
        timeout: 12_000,
      });
      const d = res.data;
      if (!d) return null;

      const value = d?.marketValue?.value ?? d?.market_value;
      return {
        source: 'transfermarkt',
        externalId: providerPlayerId,
        name: String(d.name ?? d.playerName ?? ''),
        birthDate: d.dateOfBirth ?? d.date_of_birth ?? null,
        nationality: d.citizenship?.[0] ?? d.nationality ?? null,
        position: d.position?.main ?? d.position ?? null,
        detailedPosition: d.position?.detail ?? null,
        club: d.club?.name ?? d.club ?? null,
        height: parseHeightCm(d.height ?? d.bodyHeight),
        preferredFoot: parsePreferredFoot(d.foot ?? d.preferredFoot),
        marketValue: value != null ? Number(value) : null,
        photoUrl: d.image ?? d.photo ?? null,
      };
    } catch {
      return null;
    }
  }
}
