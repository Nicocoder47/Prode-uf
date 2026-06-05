import { motion } from 'framer-motion';
import { Lock, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { MOTION } from '../../constants/design';
import { usePremiumTokens, type PremiumFeatureKey } from '../../hooks/usePremiumTokens';

type PremiumGateProps = {
  feature: PremiumFeatureKey;
  children: ReactNode;
  preview?: ReactNode;
};

export function PremiumGate({ feature, children, preview }: PremiumGateProps) {
  const { hasAccess, unlockFeature, balance, features } = usePremiumTokens();
  const unlocked = hasAccess(feature);
  const { cost, label } = features[feature];

  if (unlocked) return <>{children}</>;

  return (
    <div className="relative overflow-hidden rounded-[28px]">
      <div className="pointer-events-none select-none blur-[6px] opacity-40">
        {preview ?? children}
      </div>
      <motion.div
        {...MOTION.enterScale}
        className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-wc26-night950/80 to-wc26-night900/95 p-6 text-center backdrop-blur-md"
      >
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-wc26-fifaYellow/20 ring-2 ring-wc26-fifaYellow/40">
          <Lock className="h-6 w-6 text-wc26-fifaYellow" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-wc26-fifaYellow">{label}</p>
          <p className="mt-2 text-lg font-black text-white">Desbloquear por {cost} tokens</p>
          <p className="mt-1 text-xs font-semibold text-white/55">Saldo: {balance} tokens</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const r = unlockFeature(feature);
            if (!r.ok && r.reason) alert(r.reason);
          }}
          className="wc26-btn-gold flex items-center gap-2 px-6 py-3 text-sm"
        >
          <Sparkles className="h-4 w-4" />
          Desbloquear
        </button>
      </motion.div>
    </div>
  );
}

export function PremiumBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-wc26-fifaYellow/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-wc26-fifaYellow ring-1 ring-wc26-fifaYellow/30">
      <Sparkles className="h-3 w-3" />
      Premium
    </span>
  );
}
