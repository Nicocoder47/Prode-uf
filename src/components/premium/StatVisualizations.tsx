import { motion } from 'framer-motion';
import { MOTION } from '../../constants/design';

type StatBarProps = {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  color?: 'green' | 'blue' | 'gold';
};

const fills = {
  green: 'linear-gradient(90deg, #0b6b38, #12a058)',
  blue: 'linear-gradient(90deg, #0057B8, #2D7FF9)',
  gold: 'linear-gradient(90deg, #F7C600, #D4AF37)',
};

export function StatBar({ label, value, max, suffix = '', color = 'green' }: StatBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <motion.div {...MOTION.enter} className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-wc26-text/55">{label}</span>
        <span className="font-black text-wc26-text">
          {value}
          {suffix}
        </span>
      </div>
      <div className="wc26-stat-bar-track">
        <div className="wc26-stat-bar-fill" style={{ background: fills[color], width: `${pct}%` }} />
      </div>
    </motion.div>
  );
}

export function StatDonut({
  label,
  value,
  max,
  display,
}: {
  label: string;
  value: number;
  max: number;
  display?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <motion.div {...MOTION.enter} className="flex flex-col items-center gap-2">
      <div className="wc26-donut" style={{ ['--pct' as string]: pct }}>
        <div className="wc26-donut-inner">{display ?? value}</div>
      </div>
      <p className="text-center text-[10px] font-black uppercase tracking-wide text-wc26-text/45">{label}</p>
    </motion.div>
  );
}

export function FormStrip({ form }: { form: ('W' | 'D' | 'L')[] }) {
  if (form.length === 0) return null;

  return (
    <motion.div {...MOTION.enter} className="flex flex-wrap gap-1.5">
      {form.map((r, i) => (
        <span
          key={`${r}-${i}`}
          className={`wc26-form-pill ${r === 'W' ? 'win' : r === 'D' ? 'draw' : 'loss'}`}
        >
          {r}
        </span>
      ))}
    </motion.div>
  );
}

export function FormBreakdownCard({
  wins,
  draws,
  losses,
  title = 'Últimos partidos',
}: {
  wins: number;
  draws: number;
  losses: number;
  title?: string;
}) {
  const total = wins + draws + losses;
  if (total === 0) return null;

  return (
    <div className="wc26-card p-4">
      <p className="wc26-section-title">{title}</p>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-2xl font-black text-wc26-green">{wins}</p>
          <p className="text-[10px] font-bold uppercase text-wc26-text/45">Victorias</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-wc26-muted">{draws}</p>
          <p className="text-[10px] font-bold uppercase text-wc26-text/45">Empates</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-wc26-red">{losses}</p>
          <p className="text-[10px] font-bold uppercase text-wc26-text/45">Derrotas</p>
        </div>
      </div>
    </div>
  );
}
