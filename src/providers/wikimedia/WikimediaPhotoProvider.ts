const WIKI_COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const WIKI_EN_API = 'https://en.wikipedia.org/w/api.php';

/**
 * Busca foto de jugador en Wikipedia / Wikimedia Commons.
 */
export class WikimediaPhotoProvider {
  static async fetchPlayerPhoto(playerName: string, nationality?: string | null): Promise<string | null> {
    const wikiPage = await this.fetchWikipediaPagePhoto(playerName);
    if (wikiPage) return wikiPage;

    const searchTerms = [
      playerName,
      nationality ? `${playerName} ${nationality}` : null,
      `${playerName} footballer`,
    ].filter(Boolean) as string[];

    for (const term of searchTerms) {
      const url = await this.searchCommonsImage(term);
      if (url) return url;
    }

    return null;
  }

  private static async fetchWikipediaPagePhoto(playerName: string): Promise<string | null> {
    const titles = [
      playerName,
      `${playerName} (footballer)`,
      `${playerName} (football)`,
    ];

    for (const title of titles) {
      try {
        const params = new URLSearchParams({
          action: 'query',
          format: 'json',
          prop: 'pageimages',
          piprop: 'thumbnail',
          pithumbsize: '400',
          titles: title,
          origin: '*',
        });

        const res = await fetch(`${WIKI_EN_API}?${params}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) continue;

        const data = (await res.json()) as {
          query?: {
            pages?: Record<string, { missing?: boolean; thumbnail?: { source?: string } }>;
          };
        };

        for (const page of Object.values(data.query?.pages ?? {})) {
          if (page.missing) continue;
          const thumb = page.thumbnail?.source;
          if (thumb && !thumb.includes('.svg')) return thumb;
        }
      } catch {
        // omitir errores de red
      }
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

      const res = await fetch(`${WIKI_COMMONS_API}?${params}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
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
