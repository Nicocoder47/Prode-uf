import axios from 'axios';
import {
  nationalitiesMatch,
  parseHeightCm,
  parseMarketValueFromSigning,
  parsePreferredFoot,
  parseShirtNumber,
} from '../../../providers/enrichment/playerMatch';
import { compareNames, removeAccents } from '../../../utils/playerIdentityNormalizer';
import type { ExternalPlayerCandidate } from '../playerMatching';

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
  dateBorn?: string;
  strPosition?: string;
};

function playerNamesCompatible(candidate: string, target: string): boolean {
  const cmp = compareNames(candidate, target);
  return cmp === 'exact' || cmp === 'strong' || cmp === 'weak';
}

function searchTermsFor(name: string): string[] {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const plain = removeAccents(name);
  const plainParts = plain.split(/\s+/).filter(Boolean);
  const terms = new Set<string>();
  terms.add(name.replace(/\s+/g, '_'));
  terms.add(plain.replace(/\s+/g, '_'));
  if (parts.length > 1) {
    terms.add(parts[parts.length - 1]!);
    terms.add(plainParts[plainParts.length - 1]!);
    terms.add(`${parts[0]} ${parts[parts.length - 1]}`);
    terms.add(`${plainParts[0]} ${plainParts[plainParts.length - 1]}`);
  }
  return [...terms].filter(t => t.length >= 3);
}

function mapRow(match: SportsDbPlayer): ExternalPlayerCandidate {
  const photo = match.strCutout || match.strRender || match.strThumb || null;
  return {
    source: 'thesportsdb',
    externalId: match.idPlayer ?? null,
    name: match.strPlayer ?? '',
    birthDate: match.dateBorn ?? null,
    nationality: match.strNationality ?? null,
    position: match.strPosition ?? null,
    club: match.strTeam?.trim() || match.strTeam2?.trim() || null,
    shirtNumber: parseShirtNumber(match.strNumber),
    height: parseHeightCm(match.strHeight),
    preferredFoot: parsePreferredFoot(match.strSide ?? match.strFoot),
    marketValue: parseMarketValueFromSigning(match.strSigning),
    photoUrl: photo,
  };
}

export class TheSportsDbPlayerProvider {
  static isConfigured(): boolean {
    return true;
  }

  static async searchCandidates(name: string, nationality?: string | null): Promise<ExternalPlayerCandidate[]> {
    const searchTerms = searchTermsFor(name);
    const out: ExternalPlayerCandidate[] = [];
    const seen = new Set<string>();

    for (const search of searchTerms) {
      const data = await sportsDbGet<{ player?: SportsDbPlayer[] }>(
        `${BASE}/${KEY}/searchplayers.php`,
        { p: search },
      );
      if (!data?.player?.length) continue;

      for (const match of data.player.slice(0, 8)) {
        const key = match.idPlayer ?? match.strPlayer ?? '';
        if (!key || seen.has(key)) continue;
        if (!playerNamesCompatible(match.strPlayer ?? '', name)) continue;
        if (nationality && match.strNationality && !nationalitiesMatch(nationality, match.strNationality)) continue;

        seen.add(key);
        if (match.idPlayer) {
          const detail = await sportsDbGet<{ players?: SportsDbPlayer[] }>(
            `${BASE}/${KEY}/lookupplayer.php`,
            { id: match.idPlayer },
          );
          const full = detail?.players?.[0];
          out.push(mapRow(full ?? match));
        } else {
          out.push(mapRow(match));
        }
      }

      if (out.length >= 3) break;
      await new Promise(r => setTimeout(r, 350));
    }

    return out;
  }
}
