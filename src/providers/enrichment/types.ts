export interface EnrichmentCandidate {
  shirt_number?: number | null;
  height?: number | null;
  preferred_foot?: string | null;
  club?: string | null;
  market_value?: number | null;
  rating?: number | null;
  photo_url?: string | null;
}

export interface DbPlayerEnrichmentRow {
  id: string;
  name: string;
  nationality: string | null;
  shirt_number: number | null;
  height: number | null;
  preferred_foot: string | null;
  club: string | null;
  market_value: number | null;
  rating: number | null;
  photo_url: string | null;
}

export type EnrichmentPatch = Partial<
  Pick<
    DbPlayerEnrichmentRow,
    | 'shirt_number'
    | 'height'
    | 'preferred_foot'
    | 'club'
    | 'market_value'
    | 'rating'
    | 'photo_url'
  >
> & { enriched_at?: string };
