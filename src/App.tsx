import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell.tsx'
import { AdminShell } from './components/layout/AdminShell.tsx'
import { BackgroundProvider } from './components/layout/BackgroundProvider.tsx'
import { ToastProvider } from './components/ui/ToastProvider.tsx'
import { DeviceReporterBridge } from './components/layout/DeviceReporterBridge.tsx'
import { SocialContactBar } from './components/layout/SocialContactBar.tsx'
import ProtectedRoute from './routes/ProtectedRoute.tsx'
import AdminRoute from './routes/AdminRoute.tsx'

const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage.tsx'))
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
const RankingCompetitionPage = lazy(() => import('./features/leaderboard/RankingCompetitionPage.tsx'))
const ProfilePage = lazy(() => import('./features/auth/ProfilePage.tsx'))
const LoginPage = lazy(() => import('./features/auth/LoginPage.tsx'))
const ChangePasswordPage = lazy(() => import('./features/auth/ChangePasswordPage.tsx'))
const AdminHashRedirect = lazy(() => import('./features/admin/AdminHashRedirect.tsx'))
const AdminDashboardPage = lazy(() => import('./features/admin/AdminDashboardPage.tsx'))
const AdminUsersPage = lazy(() => import('./features/admin/AdminUsersPage.tsx'))
const AdminActivityPage = lazy(() => import('./features/admin/AdminActivityPage.tsx'))
const AdminNotificationsPage = lazy(() => import('./features/admin/AdminNotificationsPage.tsx'))
const AdminSystemOverviewPage = lazy(() => import('./features/admin/AdminSystemOverviewPage.tsx'))
const AdminCardsPage = lazy(() => import('./features/admin/AdminCardsPage.tsx'))
const AdminLiveCardsPage = lazy(() => import('./features/admin/AdminLiveCardsPage.tsx'))
const AdminOperationsCenterPage = lazy(() => import('./features/admin/AdminOperationsCenterPage.tsx'))
const LiveCardsPreviewPage = import.meta.env.DEV
  ? lazy(() => import('./features/dev/LiveCardsPreviewPage.tsx'))
  : null
const AdminSupportPage = lazy(() => import('./features/admin/AdminSupportPage.tsx'))
const AdminBetaCapacityPage = lazy(() => import('./features/admin/AdminBetaCapacityPage.tsx'))
const AdminScoringPage = lazy(() => import('./features/admin/AdminScoringPage.tsx'))
const AdminScoringDisplayPage = lazy(() => import('./features/admin/AdminScoringDisplayPage.tsx'))
const AdminTickerContentPage = lazy(() => import('./features/admin/AdminTickerContentPage.tsx'))
const AdminRankingLorePage = lazy(() => import('./features/admin/AdminRankingLorePage.tsx'))
const AdminSystemHealthPage = lazy(() => import('./features/admin/AdminSystemHealthPage.tsx'))
const AdminAnalyticsPage = lazy(() => import('./features/admin/AdminAnalyticsPage.tsx'))
const NotificationsPage = lazy(() => import('./features/notifications/NotificationsPage.tsx'))

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
        <DeviceReporterBridge />
        <SocialContactBar />
        <Suspense fallback={<PageLoader />}>
          <Routes>
        <Route path="/login" element={<LoginPage />} />
        {LiveCardsPreviewPage ? (
          <Route path="/dev/live-cards" element={<LiveCardsPreviewPage />} />
        ) : null}
        <Route path="/registro" element={<Navigate to="/login" replace />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/invite" element={<Navigate to="/login" replace />} />

        <Route element={<ProtectedRoute />}>
          <Route path="change-password" element={<ChangePasswordPage />} />
          <Route path="admin" element={<AdminRoute />}>
            <Route element={<AdminShell />}>
              <Route index element={<AdminHashRedirect />} />
              <Route path="dashboard" element={<AdminDashboardPage />} />
              <Route path="operations" element={<AdminOperationsCenterPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="activity" element={<AdminActivityPage />} />
              <Route path="notifications" element={<AdminNotificationsPage />} />
              <Route path="system" element={<AdminSystemOverviewPage />} />
              <Route path="health" element={<AdminSystemHealthPage />} />
              <Route path="scoring" element={<AdminScoringPage />} />
              <Route path="scoring-display" element={<AdminScoringDisplayPage />} />
              <Route path="ticker-content" element={<AdminTickerContentPage />} />
              <Route path="analytics" element={<AdminAnalyticsPage />} />
              <Route path="beta-capacity" element={<AdminBetaCapacityPage />} />
              <Route path="cards" element={<AdminCardsPage />} />
              <Route path="live-cards" element={<AdminLiveCardsPage />} />
              <Route path="ranking-lore" element={<AdminRankingLorePage />} />
              <Route path="support" element={<AdminSupportPage />} />
            </Route>
          </Route>

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
            <Route path="predictions" element={<RankingCompetitionPage />} />
            <Route path="mis-predicciones" element={<PredictionsPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </ToastProvider>
    </BackgroundProvider>
  )
}

export default App
