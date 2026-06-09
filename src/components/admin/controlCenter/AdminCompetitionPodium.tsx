import { Link } from 'react-router-dom'
import { HomeRankingGrid } from '../../worldcup/HomeRankingGrid'
import type { AdminRankingRow } from '../../../types/admin'
import type { LeaderboardEntry } from '../../../types/worldcup'
import { AdminControlGlass } from './AdminControlGlass'

function toLeaderboardEntries(rows: AdminRankingRow[]): LeaderboardEntry[] {
  return rows.slice(0, 5).map(row => ({
    userId: row.user_id,
    rank: row.rank,
    points: row.points,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    profile: { fullName: row.full_name, legajo: row.legajo ?? undefined },
  }))
}

export function AdminCompetitionPodium({ ranking }: { ranking: AdminRankingRow[] }) {
  const entries = toLeaderboardEntries(ranking)

  return (
    <AdminControlGlass
      kicker="Competencia"
      title="Top 5 ranking"
      description="Podio global del prode"
      action={
        <Link to="/leaderboard" className="admin-control-link">
          Ver ranking
        </Link>
      }
    >
      <div className="admin-control-podium-wrap">
        <HomeRankingGrid entries={entries} maxRows={5} />
      </div>
    </AdminControlGlass>
  )
}
