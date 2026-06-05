import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useLiveMatches } from '../../useWorldCupData';
import { Link } from 'react-router-dom';

function TeamFlag({ flag, code }: { flag: string; code: string }) {
  if (flag?.startsWith('http')) {
    return <img src={flag} alt={code} loading="lazy" decoding="async" className="h-8 w-10 object-contain" />;
  }
  return <span className="text-3xl">{flag || '🏳️'}</span>;
}

export function LiveMatchesRail() {
  const { data: live = [], isLoading } = useLiveMatches();

  if (isLoading) {
    return <div className="wc26-card p-6 text-center text-sm text-wc26-dark/50">Cargando partidos en vivo...</div>;
  }

  if (live.length === 0) {
    return (
      <div className="wc26-card p-6 text-center text-sm text-wc26-dark/50">
        No hay partidos en vivo ahora. Volvé cuando arranque el torneo.
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
      {live.map((match, idx) => (
        <motion.div
          key={match.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.08 }}
          className="snap-start shrink-0 w-[min(100%,300px)]"
        >
          <Link
            to={`/matches/${match.id}`}
            className="block wc26-card p-4 ring-2 ring-wc26-red/20 transition-transform active:scale-[0.99]"
          >
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 animate-pulse text-wc26-red" />
              <span className="text-xs font-black uppercase tracking-widest text-wc26-red">En vivo</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-1 flex-col items-center gap-1">
                <TeamFlag flag={match.homeTeam?.flag || ''} code={match.homeTeam?.code || 'LOC'} />
                <span className="text-xs font-bold text-wc26-dark">{match.homeTeam?.code}</span>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-wc26-orange">
                  {match.homeScore ?? 0} - {match.awayScore ?? 0}
                </p>
              </div>
              <div className="flex flex-1 flex-col items-center gap-1">
                <TeamFlag flag={match.awayTeam?.flag || ''} code={match.awayTeam?.code || 'VIS'} />
                <span className="text-xs font-bold text-wc26-dark">{match.awayTeam?.code}</span>
              </div>
            </div>
            <p className="mt-3 truncate text-center text-[11px] text-wc26-dark/45">
              {match.stadium || 'Estadio'} • {match.city || ''}
            </p>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
