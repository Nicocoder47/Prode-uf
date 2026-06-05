const WIKI_API = 'https://commons.wikimedia.org/w/api.php';

/**
 * Busca foto de jugador en Wikimedia Commons vía Wikidata.
 */
export class WikimediaPhotoProvider {
  static async fetchPlayerPhoto(playerName: string, nationality?: string | null): Promise<string | null> {
    const searchTerms = [playerName, nationality ? `${playerName} ${nationality}` : null].filter(Boolean) as string[];

    for (const term of searchTerms) {
      const url = await this.searchCommonsImage(term);
      if (url) return url;
    }
    return null;
  }

  private static async searchCommonsImage(search: string): Promise<string | null> {
    try {
      const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrsearch: `filetype:bitmap ${search} football`,
        gsrlimit: '3',
        prop: 'imageinfo',
        iiprop: 'url',
        iiurlwidth: '400',
        origin: '*',
      });

      const res = await fetch(`${WIKI_API}?${params}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;

      const data = (await res.json()) as {
        query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url?: string }[] }> };
      };

      const pages = data.query?.pages ?? {};
      for (const page of Object.values(pages)) {
        const info = page.imageinfo?.[0];
        const candidate = info?.thumburl ?? info?.url;
        if (candidate && !candidate.includes('.svg')) return candidate;
      }
    } catch {
      // omitir errores de red
    }
    return null;
  }
}
