import '../../styles/profile.css'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataState } from '../../components/ui/DataState.tsx'
import { ProfileCompetitiveSummary } from '../../components/profile/ProfileCompetitiveSummary'
import { ProfileHeroCardContainer } from '../../components/profile/ProfileHeroCard'
import { ProfileQuickActions } from '../../components/profile/ProfileQuickActions'
import { ProfileRecentActivity } from '../../components/profile/ProfileRecentActivity'
import { ProfileSupportSection } from '../../components/profile/ProfileSupportSection'
import { ProfileWorldProgress } from '../../components/profile/ProfileWorldProgress'
import { useAuth } from '../../lib/auth.tsx'
import { useLeaderboard, usePredictions, useWorldCupMatches } from '../../useWorldCupData.ts'
import { computeOverallProgress, computeProfileStats } from '../../utils/predictionProgress'

function formatRole(role?: string | null) {
  if (!role) return 'Jugador'
  if (role === 'admin') return 'Administrador'
  if (role === 'member') return 'Jugador'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return parts[0] ?? 'Jugador'
  return parts.join(' ')
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { profile, user, signOut } = useAuth()
  const { data: leaderboard = [], isLoading: leaderboardLoading } = useLeaderboard()
  const { data: predictions = [], isLoading: predictionsLoading } = usePredictions(user?.id)
  const { data: matches = [] } = useWorldCupMatches()

  const fullName = splitName(profile?.full_name?.trim() || user?.email?.split('@')[0] || 'Jugador')
  const legajo = profile?.legajo ?? profile?.domain_plate ?? '—'
  const email = profile?.email ?? user?.email ?? ''

  const me = leaderboard.find(entry => entry.userId === user?.id)
  const predictionSet = useMemo(() => new Set(predictions.map(p => p.matchId)), [predictions])
  const overallProgress = useMemo(
    () => computeOverallProgress(matches, predictionSet),
    [matches, predictionSet]
  )
  const stats = useMemo(
    () => computeProfileStats(predictions, matches, me?.points, me?.draws),
    [predictions, matches, me?.points, me?.draws]
  )

  const isLoading = leaderboardLoading || predictionsLoading

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="wc26-profile-premium space-y-5 pb-4">
      <ProfileHeroCardContainer
        fullName={fullName}
        legajo={legajo}
        role={formatRole(profile?.role)}
        rank={me?.rank ?? null}
        totalPoints={stats.totalPoints}
        accuracy={stats.accuracy}
        dni={profile?.dni}
        email={email}
      />

      <DataState isLoading={isLoading} loadingMessage="Cargando tu perfil…">
        <ProfileCompetitiveSummary stats={stats} />
        <ProfileWorldProgress predicted={overallProgress.predicted} total={overallProgress.total} />
        <ProfileRecentActivity predictions={predictions} matches={matches} />
        <ProfileSupportSection userId={user?.id} />
        <ProfileQuickActions onSignOut={() => void handleSignOut()} />
      </DataState>
    </div>
  )
}
