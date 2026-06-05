import axios from 'axios';
import { supabase } from '../../database/supabaseClient';

const SOURCE = 'transfermarkt';

/**
 * Transfermarkt — market value, club, age enrichment.
 * Requiere TRANSFERMARKT_API_BASE configurado. Sin API: no inventa datos.
 */
export class TransfermarktProvider {
  static isConfigured(): boolean {
    return !!process.env.TRANSFERMARKT_API_BASE;
  }

  static async syncMarketValues(): Promise<number> {
    if (!this.isConfigured()) {
      console.warn('[Transfermarkt] TRANSFERMARKT_API_BASE no configurado. Sin valores.');
      return 0;
    }

    const base = process.env.TRANSFERMARKT_API_BASE!;
    const { data: players, error } = await supabase
      .from('players')
      .select('id,name,provider_player_id,market_value,club')
      .not('provider_player_id', 'is', null);
    if (error) throw error;

    let updated = 0;
    for (const p of players ?? []) {
      try {
        const res = await axios.get(`${base}/players/${p.provider_player_id}`, {
          headers: { Accept: 'application/json' },
        });
        const value = res.data?.marketValue?.value ?? res.data?.market_value;
        const club = res.data?.club?.name ?? res.data?.club;
        if (value == null && !club) continue;

        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (value != null) patch.market_value = Number(value);
        if (club) patch.club = club;

        await supabase.from('players').update(patch).eq('id', p.id);

        if (value != null) {
          await supabase.from('player_market_values').upsert(
            {
              player_id: p.id,
              market_value_eur: Number(value),
              provider: SOURCE,
              provider_player_id: p.provider_player_id,
              captured_at: new Date().toISOString(),
            },
            { onConflict: 'player_id,provider,captured_at', ignoreDuplicates: true }
          );
        }
        updated++;
      } catch {
        // jugador no encontrado en TM — omitir
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    return updated;
  }

  static async syncPlayerProfiles(): Promise<number> {
    return this.syncMarketValues();
  }
}
