import { motion } from 'framer-motion';
import { COLORS, TYPOGRAPHY } from '../../constants/design';
import { useTopScorers } from '../../useWorldCupData';
import { Link } from 'react-router-dom';
import { withCompetitionRanks } from '../../utils/scorerRanking';

export function TopScorersPanel() {
  const { data: scorers = [], isLoading } = useTopScorers();

  if (isLoading) {
    return <div className="text-center p-8 text-worldcup-lightGray border border-white/10 rounded-lg">Cargando goleadores...</div>;
  }

  if (scorers.length === 0) {
    return (
      <div className="text-center p-8 text-worldcup-lightGray border border-worldcup-red/30 rounded-lg">
        Aún no hay goles registrados. Los datos aparecen cuando se sincronizan partidos y ratings.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {withCompetitionRanks(scorers.map(({ player, goals, assists }) => ({
        player,
        goals,
        assists,
      }))).map(({ player, goals, assists, rank }, idx) => (
        <motion.div
          key={player.id}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.05 }}
          className="p-4 rounded-xl border flex items-center gap-4 hover:bg-white/5 transition-colors"
          style={{ backgroundColor: `${COLORS.cardDark}`, borderColor: `${COLORS.lightGray}20` }}
        >
          <span className="text-2xl font-black w-8 text-center" style={{ color: rank <= 3 ? COLORS.trophy : COLORS.lightGray }}>
            {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
          </span>
          <div className="w-12 h-12 rounded-full overflow-hidden bg-worldcup-surface shrink-0">
            {player.photo ? (
              <img src={player.photo} alt={player.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            ) : (
              <span className="grid place-items-center h-full text-xl">⚽</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <Link to={`/players/${player.id}`} className="font-black text-white hover:underline block truncate" style={{ fontFamily: TYPOGRAPHY.fontFamily.sans }}>
              {player.name}
            </Link>
            <p className="text-xs text-white/60 truncate">{player.team?.name || 'Selección'} • {player.position || '—'}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black" style={{ color: COLORS.trophy }}>{goals}</p>
            <p className="text-xs text-white/50">{assists} asist.</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
