import { WikimediaPhotoProvider } from '../../../providers/wikimedia/WikimediaPhotoProvider';
import type { ExternalPlayerCandidate } from '../playerMatching';

export class WikimediaPlayerProvider {
  static isConfigured(): boolean {
    return true;
  }

  static async searchCandidates(name: string, nationality?: string | null): Promise<ExternalPlayerCandidate[]> {
    const photoUrl = await WikimediaPhotoProvider.fetchPlayerPhoto(name, nationality);
    if (!photoUrl) return [];

    return [
      {
        source: 'wikimedia',
        name,
        nationality: nationality ?? null,
        photoUrl,
      },
    ];
  }
}
