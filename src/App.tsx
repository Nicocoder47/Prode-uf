import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell.tsx'
import { BackgroundProvider } from './components/layout/BackgroundProvider.tsx'
import { ToastProvider } from './components/ui/ToastProvider.tsx'
import ProtectedRoute from './routes/ProtectedRoute.tsx'
import AdminRoute from './routes/AdminRoute.tsx'

const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage.tsx'))
const InviteLoginPage = lazy(() => import('./features/auth/InviteLoginPage.tsx'))
const LeaderboardPage = lazy(() => import('./features/leaderboard/LeaderboardPage.tsx'))
const MatchesPage = lazy(() => import('./features/matches/MatchesPage.tsx'))
const MatchDetailPage = lazy(() => import('./features/matches/MatchDetailPage.tsx'))
const PaymentsPage = lazy(() => import('./features/payments/PaymentsPage.tsx'))
const PlayersPage = lazy(() => import('./features/players/PlayersPage.tsx'))
const PlayerPage = lazy(() => import('./features/players/PlayerPage.tsx'))
const TeamPage = lazy(() => import('./features/teams/TeamPage.tsx'))
const TeamAdvancedStatsPage = lazy(() => import('./features/teams/TeamAdvancedStatsPage.tsx'))
const IntelligencePage = lazy(() => import('./features/intelligence/IntelligencePage.tsx'))
const ComparePage = lazy(() => import('./features/compare/ComparePage.tsx'))
const TeamsListPage = lazy(() => import('./features/teams/TeamsListPage.tsx'))
const GroupsPage = lazy(() => import('./features/groups/GroupsPage.tsx'))
const GroupDetailPage = lazy(() => import('./features/groups/GroupDetailPage.tsx'))
const PredictionsPage = lazy(() => import('./features/predictions/PredictionsPage.tsx'))
const ProfilePage = lazy(() => import('./features/auth/ProfilePage.tsx'))
const AdminPage = lazy(() => import('./features/admin/AdminPageNew.tsx'))
const AdminDataQualityPage = lazy(() => import('./features/admin/AdminDataQualityPage.tsx'))
const AdminSystemPage = lazy(() => import('./features/admin/AdminSystemPage.tsx'))
const AdminKnockoutPage = lazy(() => import('./features/admin/AdminKnockoutPage.tsx'))

function PageLoader() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-worldcup-gold border-t-transparent" />
    </div>
  )
}

function App() {
  return (
    <BackgroundProvider>
      <ToastProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
        <Route path="/invite" element={<InviteLoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell><Outlet /></AppShell>}>
            <Route index element={<DashboardPage />} />
            <Route path="home" element={<Navigate to="/" replace />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="groups/:groupId" element={<GroupDetailPage />} />
            <Route path="teams" element={<TeamsListPage />} />
            <Route path="teams/:id" element={<TeamPage />} />
            <Route path="teams/:id/advanced-stats" element={<TeamAdvancedStatsPage />} />
            <Route path="intelligence" element={<IntelligencePage />} />
            <Route path="compare" element={<ComparePage />} />
            <Route path="matches" element={<MatchesPage />} />
            <Route path="matches/:id" element={<MatchDetailPage />} />
            <Route path="players" element={<PlayersPage />} />
            <Route path="players/:id" element={<PlayerPage />} />
            <Route path="predictions" element={<PredictionsPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="admin" element={<AdminRoute />}>
              <Route index element={<AdminPage />} />
              <Route path="data-quality" element={<AdminDataQualityPage />} />
              <Route path="system" element={<AdminSystemPage />} />
              <Route path="knockout" element={<AdminKnockoutPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/invite" replace />} />
        </Routes>
        </Suspense>
      </ToastProvider>
    </BackgroundProvider>
  )
}

export default App
