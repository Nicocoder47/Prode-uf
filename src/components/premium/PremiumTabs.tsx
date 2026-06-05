import { motion } from 'framer-motion';
type PremiumTabsProps<T extends string> = {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  variant?: 'light' | 'glass';
};

export function PremiumTabs<T extends string>({ tabs, active, onChange, variant = 'glass' }: PremiumTabsProps<T>) {
  const shell = variant === 'glass' ? 'wc26-glass rounded-[22px] p-1 shadow-wc26-card' : 'rounded-[22px] bg-white/90 p-1 shadow-wc26-card';

  return (
    <div className={`sticky top-3 z-20 flex gap-1 overflow-x-auto scrollbar-none ${shell}`}>
      {tabs.map(t => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`relative flex-shrink-0 rounded-2xl px-4 py-2.5 text-xs font-black transition-colors ${
              isActive ? 'text-wc26-green' : 'text-wc26-text/45'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="premium-tab-indicator"
                className="absolute inset-0 rounded-2xl bg-white shadow-md"
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
            <span className="relative z-10">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
