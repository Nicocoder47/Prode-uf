import { Redis } from 'ioredis';

import { supabase } from '../../database/supabaseClient';



let redis: Redis | null = null;

let redisDisabled = false;



function initRedis() {

  if (redis || redisDisabled) return;

  const url = process.env.REDIS_URL?.trim();

  if (!url) {

    redisDisabled = true;

    return;

  }

  try {

    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true,
      enableOfflineQueue: false,
      ...(url.startsWith('rediss://') ? { tls: {} } : {}),
    });

    redis.on('error', () => {

      // Redis es opcional: no bloquear sync ni spamear consola

      redisDisabled = true;

      redis?.disconnect();

      redis = null;

    });

    redis.connect().catch(() => {

      redisDisabled = true;

      redis = null;

    });

  } catch {

    redisDisabled = true;

    redis = null;

  }

}



export class SyncEngine {

  /**

   * Ejecuta una tarea de sincronización con lógica de reintentos

   */

  static async runWithRetry<T>(

    taskName: string,

    taskFn: () => Promise<T>,

    retries: number = 3,

    delayMs: number = 2000

  ): Promise<T | null> {

    for (let attempt = 1; attempt <= retries; attempt++) {

      try {

        console.log(`[SYNC] Ejecutando ${taskName} (Intento ${attempt}/${retries})...`);

        const result = await taskFn();

        console.log(`[SYNC] ✅ Éxito en ${taskName}`);

        return result;

      } catch (error) {

        console.error(`[SYNC] ❌ Fallo en ${taskName}:`, error);

        if (attempt === retries) {

          console.error(`[SYNC] 🚨 Tarea ${taskName} falló después de ${retries} intentos.`);

          return null;

        }

        await new Promise((res) => setTimeout(res, delayMs * attempt));

      }

    }

    return null;

  }



  /**

   * Actualiza BD y refresca caché Redis según el TTL indicado (opcional).

   */

  static async upsertAndCache(

    tableName: string,

    data: any[],

    cacheKey: string,

    ttlSeconds: number,

    conflictTarget: string = 'id'

  ) {

    if (!data || data.length === 0) return;



    const { error } = await supabase.from(tableName).upsert(data, { onConflict: conflictTarget });

    if (error) throw error;



    initRedis();

    if (redis && !redisDisabled) {

      try {

        await redis.setex(cacheKey, ttlSeconds, JSON.stringify(data));

      } catch {

        // Cache opcional

      }

    }

  }



  /** Registra errores de sync en data_sync_logs */

  static async logError(provider: string, syncType: string, error: unknown) {

    const message = error instanceof Error ? error.message : String(error);

    await supabase.from('data_sync_logs').insert({

      provider,

      sync_type: syncType,

      status: 'error',

      records_upserted: 0,

      error_message: message,

      finished_at: new Date().toISOString(),

    });

  }

}


