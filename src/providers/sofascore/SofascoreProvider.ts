import axios from 'axios';
import { supabase } from '../../database/supabaseClient';

const SOURCE = 'sofascore';

/**
 * Sofascore — ratings, MVP, xG/xA.
 * Requiere SOFASCORE_EVENT_MAP (JSON provider_match_id -> sofascore_event_id) o API configurada.
 * Sin configuración: no inventa datos.
 */
export class SofascoreProvider {
  static isConfigured(): boolean {
    return !!process.env.SOFASCORE_API_BASE;
  }

  static async syncPlayerRatings(matchScope: string): Promise<any[]> {
    if (!this.isConfigured()) {
      console.warn('[Sofascore] SOFASCORE_API_BASE no configurado. Sin ratings.');
      return [];
    }

    const base = process.env.SOFASCORE_API_BASE!;
    let matchIds: string[] = [];

    if (matchScope === 'all') {
      const { data } = await supabase
        .from('matches')
        .select('id,provider_match_id')
        .in('status', ['live', 'halftime', 'finished']);
      matchIds = (data ?? []).map((m) => m.id);
    } else {
      matchIds = [matchScope];
    }

    const rows: any[] = [];
    for (const matchId of matchIds) {
      const { data: match } = await supabase
        .from('matches')
        .select('id,provider_match_id')
        .eq('id', matchId)
        .maybeSingle();
      if (!match?.provider_match_id) continue;

      const eventMap = JSON.parse(process.env.SOFASCORE_EVENT_MAP || '{}') as Record<string, string>;
      const sofascoreId = eventMap[match.provider_match_id];
      if (!sofascoreId) continue;

      try {
        const res = await axios.get(`${base}/event/${sofascoreId}/lineups`, {
          headers: { Accept: 'application/json' },
        });
        const home = res.data?.home?.players ?? [];
        const away = res.data?.away?.players ?? [];
        for (const p of [...home, ...away]) {
          const { data: player } = await supabase
            .from('players')
            .select('id')
            .eq('name', p.player?.name)
            .maybeSingle();
          if (!player) continue;
          rows.push({
            player_id: player.id,
            match_id: matchId,
            rating: p.statistics?.rating ?? null,
            minutes_played: p.statistics?.minutesPlayed ?? null,
            goals: p.statistics?.goals ?? 0,
            assists: p.statistics?.assists ?? 0,
            yellow_cards: p.statistics?.yellowCards ?? 0,
            red_cards: p.statistics?.redCards ?? 0,
            xg: p.statistics?.expectedGoals ?? null,
            xa: p.statistics?.expectedAssists ?? null,
            source: SOURCE,
            captured_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn(`[Sofascore] Error en partido ${matchId}:`, err);
      }
    }
    return rows;
  }

  static async syncTopScorers(): Promise<number> {
    const ratings = await this.syncPlayerRatings('all');
    if (ratings.length === 0) return 0;
    const { error } = await supabase.from('player_ratings').upsert(ratings, {
      onConflict: 'player_id,match_id,source',
    });
    if (error) throw error;
    return ratings.length;
  }

  static async syncMVP(matchId: string): Promise<string | null> {
    const { data } = await supabase
      .from('player_ratings')
      .select('player_id,rating')
      .eq('match_id', matchId)
      .eq('source', SOURCE)
      .order('rating', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.player_id) return null;
    await supabase.from('matches').update({ mvp_player_id: data.player_id }).eq('id', matchId);
    return data.player_id;
  }
}
