import { useEffect } from 'react';
import type { RealtimePostgresChangesFilter } from '@supabase/realtime-js';
import { supabase } from '../lib/supabase';

type PostgresChangeConfig = RealtimePostgresChangesFilter<'*'>;

/**
 * Suscripción Realtime con canal único por efecto.
 * Orden obligatorio: channel → on → subscribe
 */
export function useSupabaseRealtime(
  enabled: boolean,
  config: PostgresChangeConfig,
  onChange: () => void,
  deps: unknown[] = []
) {
  useEffect(() => {
    if (!enabled) return;

    const channelName = `rt-${config.table ?? 'all'}-${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', config, onChange)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, config.table, config.filter, onChange, ...deps]);
}
