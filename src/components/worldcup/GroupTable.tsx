import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { WC26 } from '../../constants/design';
import { WC26_GROUP_NAMES } from '../../constants/groups';
import { useGroupsOverview } from '../../useWorldCupData';
import { TeamCrest } from './TeamCrest';
import { EMPTY } from '../../utils/emptyState';

interface GroupTableProps {
  title?: string;
  compact?: boolean;
}

export function GroupTable({ title = 'Tablas de Posiciones', compact = false }: GroupTableProps) {
  const { data: groups = [], isLoading } = useGroupsOverview();

  if (isLoading) {
    return <div className="wc26-card p-6 text-center text-sm text-wc26-text/50">Cargando grupos...</div>;
  }

  const hasData = groups.some(g => g.standings.length > 0);

  if (!hasData) {
    return (
      <div className="wc26-card p-6 text-center text-sm text-wc26-text/55">
        {EMPTY.standings}
      </div>
    );
  }

  const gridClass = compact
    ? 'grid grid-cols-1 gap-3 sm:grid-cols-2'
    : 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {title && (
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-wc26-text">{title}</h2>
          <Link to="/groups" className="text-xs font-bold text-wc26-blue">Ver todos</Link>
        </div>
      )}

      <div className={gridClass}>
        {WC26_GROUP_NAMES.map(groupId => {
          const summary = groups.find(g => g.id === groupId);
          const standings = summary?.standings ?? [];

          return (
            <div key={groupId} className="wc26-card overflow-hidden">
              <Link
                to={`/groups/${groupId}`}
                className="block px-3 py-2 text-center text-sm font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${WC26.green}, ${WC26.blue})` }}
              >
                Grupo {groupId}
              </Link>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-wc26-text/80">
                  <thead>
                    <tr className="border-b border-wc26-gray300/40 text-wc26-text/45">
                      <th className="px-2 py-2 text-left">Equipo</th>
                      <th className="px-2 py-2 text-center">PJ</th>
                      <th className="px-2 py-2 text-center font-bold text-wc26-orange">PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-2 py-4 text-center text-wc26-text/40">Sin datos</td>
                      </tr>
                    ) : (
                      standings.map(row => (
                        <tr key={row.teamId} className="border-b border-wc26-gray100 last:border-0">
                          <td className="px-2 py-2">
                            <Link to={`/teams/${row.teamId}`} className="flex items-center gap-1.5 font-bold hover:text-wc26-blue">
                              <TeamCrest flag={row.team?.flag} code={row.team?.code} size="sm" />
                              {row.team?.code}
                            </Link>
                          </td>
                          <td className="px-2 py-2 text-center">{row.played}</td>
                          <td className="px-2 py-2 text-center font-bold text-wc26-orange">{row.points}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
