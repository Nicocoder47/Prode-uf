import { useCallback, useMemo, useState } from 'react';

export const PREMIUM_FEATURES = {
  intelligence: { cost: 4, label: 'Centro de Inteligencia' },
  aiInsights: { cost: 4, label: 'Análisis IA' },
  advancedStats: { cost: 4, label: 'Estadísticas Avanzadas' },
  compare: { cost: 4, label: 'Comparador de Equipos' },
} as const;

export type PremiumFeatureKey = keyof typeof PREMIUM_FEATURES;

const BALANCE_KEY = 'prode_token_balance';
const UNLOCKS_KEY = 'prode_premium_unlocks';

function readBalance(): number {
  try {
    const raw = localStorage.getItem(BALANCE_KEY);
    return raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
  } catch {
    return 0;
  }
}

function readUnlocks(): Set<PremiumFeatureKey> {
  try {
    const raw = localStorage.getItem(UNLOCKS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as PremiumFeatureKey[]);
  } catch {
    return new Set();
  }
}

function persistBalance(n: number) {
  localStorage.setItem(BALANCE_KEY, String(n));
}

function persistUnlocks(set: Set<PremiumFeatureKey>) {
  localStorage.setItem(UNLOCKS_KEY, JSON.stringify([...set]));
}

/** Arquitectura de tokens — preparada para Mercado Pago. Balance local hasta conectar pagos. */
export function usePremiumTokens() {
  const [balance, setBalance] = useState(readBalance);
  const [unlocks, setUnlocks] = useState(readUnlocks);

  const hasAccess = useCallback(
    (feature: PremiumFeatureKey) => unlocks.has(feature),
    [unlocks],
  );

  const unlockFeature = useCallback(
    (feature: PremiumFeatureKey): { ok: boolean; reason?: string } => {
      const { cost } = PREMIUM_FEATURES[feature];
      if (unlocks.has(feature)) return { ok: true };
      if (balance < cost) {
        return { ok: false, reason: `Necesitás ${cost} tokens. Tenés ${balance}.` };
      }
      const nextBalance = balance - cost;
      const nextUnlocks = new Set(unlocks);
      nextUnlocks.add(feature);
      setBalance(nextBalance);
      setUnlocks(nextUnlocks);
      persistBalance(nextBalance);
      persistUnlocks(nextUnlocks);
      return { ok: true };
    },
    [balance, unlocks],
  );

  /** Solo dev — agregar tokens sin Mercado Pago */
  const addTokens = useCallback((amount: number) => {
    const next = balance + amount;
    setBalance(next);
    persistBalance(next);
  }, [balance]);

  const features = useMemo(() => PREMIUM_FEATURES, []);

  return { balance, unlocks, hasAccess, unlockFeature, addTokens, features };
}
