import { supabase } from '../../database/supabaseClient';
import { ApiFootballPlayerProvider } from './providers/ApiFootballPlayerProvider.js';
import { TheSportsDbPlayerProvider } from './providers/TheSportsDbPlayerProvider.js';
import { WikimediaPhotoProvider } from '../../providers/wikimedia/WikimediaPhotoProvider';
import { ApiFootballProvider } from '../../providers/apiFootball/ApiFootballProvider';

export type PhotoSource = 'provider' | 'api-football' | 'wikimedia' | 'thesportsdb' | 'none';

type PlayerPhotoRow = {
  id: string;
  name: string;
  nationality: string | null;
  photo_url: string | null;
  team_id?: string | null;
};

export async function resolvePlayerPhotoUrl(
  photoUrl: string | null | undefined,
  playerName: string,
  nationality?: string | null,
): Promise<{ photoUrl: string | null; source: PhotoSource }> {
  if (photoUrl?.trim()) {
    return { photoUrl: photoUrl.trim(), source: 'provider' };
  }

  const wiki = await WikimediaPhotoProvider.fetchPlayerPhoto(playerName, nationality);
  if (wiki) return { photoUrl: wiki, source: 'wikimedia' };

  try {
    const candidates = await TheSportsDbPlayerProvider.searchCandidates(playerName, nationality);
    const sportsDb = candidates.find(c => c.photoUrl)?.photoUrl ?? null;
    if (sportsDb) return { photoUrl: sportsDb, source: 'thesportsdb' };
  } catch {
    // TheSportsDB rate limit u otro error
  }

  if (ApiFootballPlayerProvider.isConfigured()) {
    const apiCandidates = await ApiFootballPlayerProvider.searchCandidates(playerName, nationality);
    const apiPhoto = apiCandidates.find(c => c.photoUrl)?.photoUrl ?? null;
    if (apiPhoto) return { photoUrl: apiPhoto, source: 'api-football' };
  }

  return { photoUrl: null, source: 'none' };
}

async function patchPlayerPhoto(playerId: string, photoUrl: string): Promise<boolean> {
  const { error } = await supabase
    .from('players')
    .update({
      photo_url: photoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', playerId);

  return !error;
}

/** Enriquece un lote de jugadores sin foto y persiste en Supabase. */
export async function syncMissingPlayerPhotos(limit = 40, teamId?: string): Promise<number> {
  let query = supabase
    .from('players')
    .select('id,name,nationality,photo_url,team_id')
    .is('photo_url', null)
    .order('name')
    .limit(limit);

  if (teamId) query = query.eq('team_id', teamId);

  const { data: players, error } = await query;
  if (error) throw error;

  let updated = 0;
  for (const player of (players ?? []) as PlayerPhotoRow[]) {
    const { photoUrl } = await resolvePlayerPhotoUrl(null, player.name, player.nationality);
    if (!photoUrl) continue;
    if (await patchPlayerPhoto(player.id, photoUrl)) updated++;
    await new Promise(r => setTimeout(r, 220));
  }

  return updated;
}

export async function countPlayersMissingPhotos(teamId?: string): Promise<number> {
  let query = supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .is('photo_url', null);

  if (teamId) query = query.eq('team_id', teamId);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export type SyncAllPhotosResult = {
  updated: number;
  scanned: number;
  remaining: number;
  apiFootballUpdated: number;
};

/** Sincroniza fotos hasta agotar jugadores sin foto (o maxPlayers). */
export async function syncAllMissingPlayerPhotos(options?: {
  batchSize?: number;
  maxPlayers?: number;
  delayMs?: number;
  teamId?: string;
  skipApiFootballSquads?: boolean;
}): Promise<SyncAllPhotosResult> {
  const batchSize = options?.batchSize ?? 50;
  const maxPlayers = options?.maxPlayers ?? 5000;
  const delayMs = options?.delayMs ?? 220;
  const teamId = options?.teamId;

  let apiFootballUpdated = 0;
  if (!options?.skipApiFootballSquads && ApiFootballProvider.isConfigured()) {
    try {
      apiFootballUpdated = await ApiFootballProvider.syncPlayerPhotos();
    } catch (err) {
      console.warn('[photos] API-Football squads:', err instanceof Error ? err.message : err);
    }
  }

  let updated = 0;
  let scanned = 0;

  while (scanned < maxPlayers) {
    let query = supabase
      .from('players')
      .select('id,name,nationality,photo_url,team_id')
      .is('photo_url', null)
      .order('name')
      .limit(batchSize);

    if (teamId) query = query.eq('team_id', teamId);

    const { data: players, error } = await query;
    if (error) throw error;
    if (!players?.length) break;

    for (const player of players as PlayerPhotoRow[]) {
      scanned++;
      const { photoUrl } = await resolvePlayerPhotoUrl(null, player.name, player.nationality);
      if (photoUrl && (await patchPlayerPhoto(player.id, photoUrl))) {
        updated++;
        if (updated % 10 === 0) {
          console.log(`  … ${updated} fotos (${player.name})`);
        }
      }
      await new Promise(r => setTimeout(r, delayMs));
      if (scanned >= maxPlayers) break;
    }

    if (players.length < batchSize) break;
  }

  const remaining = await countPlayersMissingPhotos(teamId);
  return { updated, scanned, remaining, apiFootballUpdated };
}
