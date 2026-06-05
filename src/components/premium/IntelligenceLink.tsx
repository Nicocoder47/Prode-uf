import { Link } from 'react-router-dom';
import { Brain, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { MOTION } from '../../constants/design';
import { PremiumBadge } from './PremiumGate';

type IntelligenceLinkProps = {
  type: 'team' | 'player' | 'match';
  id: string;
  label?: string;
  compact?: boolean;
};

export function IntelligenceLink({ type, id, label = 'Centro de Inteligencia', compact }: IntelligenceLinkProps) {
  const to = `/intelligence?type=${type}&id=${encodeURIComponent(id)}`;

  if (compact) {
    return (
      <Link
        to={to}
        className="inline-flex items-center gap-1.5 rounded-full bg-wc26-fifaYellow/15 px-3 py-1.5 text-[11px] font-black text-wc26-fifaYellow ring-1 ring-wc26-fifaYellow/25"
      >
        <Brain className="h-3.5 w-3.5" />
        Intel
      </Link>
    );
  }

  return (
    <motion.div {...MOTION.enter}>
      <Link
        to={to}
        className="wc26-card-intelligence flex items-center gap-4 p-4 transition active:scale-[0.99]"
      >
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-wc26-fifaYellow/20 ring-2 ring-wc26-fifaYellow/30">
          <Brain className="h-6 w-6 text-wc26-fifaYellow" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-black text-white">{label}</p>
            <PremiumBadge />
          </div>
          <p className="text-xs font-semibold text-white/55">Forma, tendencia, rivales y análisis exclusivo</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/40" />
      </Link>
    </motion.div>
  );
}
