import { supabase } from '../../database/supabaseClient';
import { TheSportsDbProvider } from '../../providers/theSportsDb/TheSportsDbProvider';
import { WikimediaPhotoProvider } from '../../providers/wikimedia/WikimediaPhotoProvider';

export type PhotoSource = 'provider' | 'wikimedia' | 'thesportsdb' | 'none';

export async function resolvePlayerPhotoUrl(
  photoUrl: string | null | undefined,
  playerName: string,
  nationality?: string | null
): Promise<{ photoUrl: string | null; source: PhotoSource }> {
  if (photoUrl) {
    return { photoUrl, source: 'provider' };
  }

  const wiki = await WikimediaPhotoProvider.fetchPlayerPhoto(playerName, nationality);
  if (wiki) {
    return { photoUrl: wiki, source: 'wikimedia' };
  }

  const sportsDb = await TheSportsDbProvider.fetchPlayerPhoto(playerName);
  if (sportsDb) {
    return { photoUrl: sportsDb, source: 'thesportsdb' };
  }

  return { photoUrl: null, source: 'none' };
}

/** Enriquece jugadores sin foto y persiste en Supabase. */
export async function syncMissingPlayerPhotos(limit = 40): Promise<number> {
  const { data: players, error } = await supabase
    .from('players')
    .select('id,name,nationality,photo_url')
    .is('photo_url', null)
    .limit(limit);

  if (error) throw error;

  let updated = 0;
  for (const player of players ?? []) {
    const { photoUrl } = await resolvePlayerPhotoUrl(null, player.name, player.nationality);
    if (!photoUrl) continue;

    const { error: patchErr } = await supabase
      .from('players')
      .update({ photo_url: photoUrl, updated_at: new Date().toISOString() })
      .eq('id', player.id);

    if (!patchErr) updated++;
    await new Promise(r => setTimeout(r, 350));
  }

  return updated;
}
