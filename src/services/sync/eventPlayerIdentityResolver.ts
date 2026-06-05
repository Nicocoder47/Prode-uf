import { supabase } from '../../database/supabaseClient';
import { normalizePlayerName, normalizeShortName } from '../../utils/playerIdentityNormalizer';

const PROVIDER = 'api_football';

type PlayerLookupRow = {
  id: string;
  name: string;
  provider_player_id: string | null;
  api_football_id: string | null;
  team_id: string | null;
};

let playerCache: PlayerLookupRow[] | null = null;
let teamProviderCache: Map<string, string> | null = null;

async function loadCaches() {
  if (!playerCache) {
    const { data } = await supabase
      .from('players')
      .select('id,name,provider_player_id,api_football_id,team_id')
      .limit(5000);
    playerCache = (data ?? []) as PlayerLookupRow[];
  }
  if (!teamProviderCache) {
    const { data } = await supabase.from('teams').select('id,provider_team_id').eq('provider', PROVIDER);
    teamProviderCache = new Map(
      (data ?? []).map((t: { id: string; provider_team_id: string }) => [String(t.provider_team_id), t.id])
    );
  }
}

export function resetEventIdentityCaches() {
  playerCache = null;
  teamProviderCache = null;
}

export async function resolveEventPlayerId(opts: {
  providerPlayerId?: string | number | null;
  playerName?: string | null;
  teamProviderId?: string | number | null;
}): Promise<string | null> {
  await loadCaches();
  const players = playerCache ?? [];

  const extId = opts.providerPlayerId != null ? String(opts.providerPlayerId) : null;
  if (extId) {
    const byProvider = players.find(
      p => p.provider_player_id === extId || p.api_football_id === extId
    );
    if (byProvider) return byProvider.id;
  }

  const name = opts.playerName?.trim();
  if (!name) return null;

  const teamUuid =
    opts.teamProviderId != null ? teamProviderCache?.get(String(opts.teamProviderId)) : undefined;

  const normFull = normalizePlayerName(name);
  const normShort = normalizeShortName(name);

  const candidates = players.filter(p => {
    if (teamUuid && p.team_id !== teamUuid) return false;
    const pFull = normalizePlayerName(p.name);
    const pShort = normalizeShortName(p.name);
    return (
      pFull === normFull ||
      pShort === normShort ||
      pFull.includes(normFull) ||
      normFull.includes(pFull) ||
      pShort === normFull ||
      normShort === pFull
    );
  });

  if (candidates.length === 1) return candidates[0].id;
  if (candidates.length > 1) {
    const exact = candidates.find(p => normalizePlayerName(p.name) === normFull);
    if (exact) return exact.id;
  }

  return null;
}
