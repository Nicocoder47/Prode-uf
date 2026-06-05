import axios from 'axios';
import {
  namesMatch,
  nationalitiesMatch,
  parseHeightCm,
  parseMarketValueFromSigning,
  parsePreferredFoot,
  parseShirtNumber,
} from './playerMatch';
import type { EnrichmentCandidate } from './types';

const BASE = process.env.THESPORTSDB_BASE_URL || 'https://www.thesportsdb.com/api/v1/json';
const KEY = process.env.THESPORTSDB_API_KEY || '3';

async function sportsDbGet<T>(url: string, params: Record<string, string>, retries = 3): Promise<T | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await axios.get<T>(url, { params, timeout: 12_000 });
      return res.data;
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 429 && attempt < retries) {
        await new Promise(r => setTimeout(r, 1500 * attempt));
        continue;
      }
      return null;
    }
  }
  return null;
}

type SportsDbPlayer = {
  idPlayer?: string;
  strPlayer?: string;
  strNationality?: string;
  strNumber?: string;
  strHeight?: string;
  strFoot?: string;
  strSide?: string;
  strTeam?: string;
  strTeam2?: string;
  strSigning?: string;
  strThumb?: string;
  strCutout?: string;
  strRender?: string;
};

function mapSportsDbPlayer(match: SportsDbPlayer): EnrichmentCandidate {
  const photo = match.strCutout || match.strRender || match.strThumb || null;
  const club = match.strTeam?.trim() || match.strTeam2?.trim() || null;

  return {
    shirt_number: parseShirtNumber(match.strNumber),
    height: parseHeightCm(match.strHeight),
    preferred_foot: parsePreferredFoot(match.strSide ?? match.strFoot),
    club,
    market_value: parseMarketValueFromSigning(match.strSigning),
    photo_url: photo,
  };
}

export class TheSportsDbEnrichment {
  static isConfigured(): boolean {
    return true;
  }

  static async lookup(name: string, nationality?: string | null): Promise<EnrichmentCandidate | null> {
    const searchTerms = [name.replace(/\s+/g, '_'), name.split(' ').pop() ?? name];

    for (const search of searchTerms) {
      const data = await sportsDbGet<{ player?: SportsDbPlayer[] }>(
        `${BASE}/${KEY}/searchplayers.php`,
        { p: search }
      );
      if (!data?.player?.length) continue;

      const match = data.player.find(
        p => namesMatch(p.strPlayer ?? '', name) && nationalitiesMatch(nationality, p.strNationality)
      );
      if (!match?.idPlayer) continue;

      const detail = await sportsDbGet<{ players?: SportsDbPlayer[] }>(
        `${BASE}/${KEY}/lookupplayer.php`,
        { id: match.idPlayer }
      );

      const full = detail?.players?.[0];
      return mapSportsDbPlayer(full ?? match);
    }

    return null;
  }
}
