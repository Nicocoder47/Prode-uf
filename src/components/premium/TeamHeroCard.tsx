import { motion } from 'framer-motion';
import { UserCog } from 'lucide-react';
import { MOTION } from '../../constants/design';
import { TeamCrest } from '../worldcup/TeamCrest';
import { FormStrip } from './StatVisualizations';
import type { Team } from '../../types/worldcup';
import type { FormResult } from '../../utils/teamAnalytics';
import { fmtMarketCompact } from '../../utils/teamAnalytics';

type TeamHeroCardProps = {
  team: Team;
  groupId: string;
  squadSize: number;
  fifaRanking: number | null;
  squadValue: number | null;
  averageAge: number | null;
  coach: string | null;
  form: FormResult[];
};

const CONFEDERATION_LABEL: Record<string, string> = {
  uefa: 'UEFA',
  conmebol: 'CONMEBOL',
  concacaf: 'CONCACAF',
  caf: 'CAF',
  afc: 'AFC',
  ofc: 'OFC',
};

function confederationLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return CONFEDERATION_LABEL[value.toLowerCase()] ?? value.toUpperCase();
}

export function TeamHeroCard({
  team,
  groupId,
  squadSize,
  fifaRanking,
  squadValue,
  averageAge,
  coach,
  form,
}: TeamHeroCardProps) {
  const market = fmtMarketCompact(squadValue);
  const confederation = confederationLabel(team.confederation);

  const stats = [
    fifaRanking != null ? { label: 'Ranking FIFA', value: `#${fifaRanking}`, gold: false } : null,
    { label: 'Plantel', value: String(squadSize), gold: false },
    averageAge != null ? { label: 'Edad prom.', value: String(averageAge), gold: false } : null,
    market ? { label: 'Valor plantel', value: market, gold: true } : null,
  ].filter(Boolean) as { label: string; value: string; gold: boolean }[];

  const meta = [team.code, groupId ? `Grupo ${groupId}` : null, confederation].filter(Boolean).join(' · ');

  return (
    <motion.header {...MOTION.enterScale} className="wc26-player-hero text-center">
      <div className="relative px-5 pb-6 pt-7">
        <div className="mx-auto mb-4 inline-flex rounded-[28px] bg-white/10 p-2.5 ring-1 ring-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <TeamCrest flag={team.flag} code={team.code} name={team.name} size="lg" className="!h-24 !w-24" />
        </div>

        <h1 className="text-[1.65rem] font-black tracking-tight text-white sm:text-3xl">{team.name}</h1>
        {meta && <p className="mt-1.5 text-sm font-semibold text-white/65">{meta}</p>}

        {stats.length > 0 && (
          <div className={`wc26-hero-stats ${stats.length >= 4 ? 'wc26-hero-stats--four' : ''}`}>
            {stats.map(stat => (
              <div key={stat.label} className="wc26-hero-stat">
                <p className="wc26-hero-stat__label">{stat.label}</p>
                <p className={`wc26-hero-stat__value${stat.gold ? ' wc26-hero-stat__value--gold' : ''}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {coach && (
          <p className="wc26-hero-coach">
            <UserCog className="h-3.5 w-3.5 shrink-0 text-white/50" aria-hidden="true" />
            DT · {coach}
          </p>
        )}

        {form.length > 0 && (
          <div className="mt-5 flex flex-col items-center gap-2 border-t border-white/10 pt-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/42">Forma reciente</p>
            <FormStrip form={form} />
          </div>
        )}
      </div>
    </motion.header>
  );
}
