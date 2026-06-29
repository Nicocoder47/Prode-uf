import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MOTION } from '../../constants/design'
import { AdaptiveSection } from '../../utils/adaptiveMotion'
import {
  WorldCupHero,
  MobileHomeHeader,
  HomeNextMatchCard,
} from '../../components/worldcup'
import { HomeSectionSkeleton } from '../../components/worldcup/HomeSectionSkeleton'
import { useLowEndMobile } from '../../hooks/useLowEndMobile.ts'
import { useTodayResultsSync } from '../../hooks/useTodayResultsSync.ts'
import { useHomePhaseClock } from '../../hooks/useHomePhaseClock.ts'
import { useWorldCupLiveInsights } from '../../hooks/useWorldCupLiveInsights'
import { useWorldCupMatches, useLeaderboard, usePredictions, useTopScorers } from '../../useWorldCupData'
import { ENABLE_LIVE_INSIGHTS } from '../../config/betaMode'
import { useAuth } from '../../lib/auth'
import { useSavePrediction } from '../../hooks/useSavePrediction'
import {
  computeGroupProgress,
  computeOverallProgress,
  computeAchievements,
  computeStreaks,
  getHeroDisplayMatch,
  resolveNextMatchForHome,
} from '../../utils/predictionProgress'
import type { Match } from '../../types/worldcup'

const WorldCupLiveCarousel = lazy(() =>
  import('../../components/worldcup/WorldCupLiveCarousel').then(m => ({ default: m.WorldCupLiveCarousel })),
)
const HomeRankingGrid = lazy(() =>
  import('../../components/worldcup/HomeRankingGrid').then(m => ({ default: m.HomeRankingGrid })),
)
const QuickActionGrid = lazy(() =>
  import('../../components/worldcup/QuickActionGrid').then(m => ({ default: m.QuickActionGrid })),
)
const HomeContinuePredicting = lazy(() =>
  import('../../components/worldcup/HomeGameHub').then(m => ({ default: m.HomeContinuePredicting })),
)
const HomeGamificationPanel = lazy(() =>
  import('../../components/worldcup/HomeGameHub').then(m => ({ default: m.HomeGamificationPanel })),
)
const MatchPredictionModal = lazy(() =>
  import('../../components/worldcup/MatchPredictionModal').then(m => ({ default: m.MatchPredictionModal })),
)

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const currentUserId = user?.id
  const savePrediction = useSavePrediction(currentUserId)
  const [predictMatch, setPredictMatch] = useState<Match | null>(null)
  const phaseNow = useHomePhaseClock()

  const { data: matches = [] } = useWorldCupMatches()
  const { data: dbPredictions = [] } = usePredictions(currentUserId)
  const { data: dbLeaderboard = [], isLoading: leaderboardLoading } = useLeaderboard()
  const lowEndMobile = useLowEndMobile()
  const [deferHomeHeavy, setDeferHomeHeavy] = useState(() => !lowEndMobile)
  const { data: topScorers = [] } = useTopScorers()

  useEffect(() => {
    if (!lowEndMobile) {
      setDeferHomeHeavy(true)
      return
    }

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }

    if (win.requestIdleCallback) {
      const id = win.requestIdleCallback(() => setDeferHomeHeavy(true), { timeout: 1500 })
      return () => win.cancelIdleCallback?.(id)
    }

    const timer = window.setTimeout(() => setDeferHomeHeavy(true), 450)
    return () => window.clearTimeout(timer)
  }, [lowEndMobile])

  const predictionSet = useMemo(() => new Set(dbPredictions.map(p => p.matchId)), [dbPredictions])
  const groupProgress = useMemo(
    () => computeGroupProgress(matches, predictionSet),
    [matches, predictionSet],
  )
  const overallProgress = useMemo(
    () => computeOverallProgress(matches, predictionSet),
    [matches, predictionSet],
  )
  const meLeaderboard = useMemo(
    () => dbLeaderboard.find(lb => lb.userId === currentUserId),
    [dbLeaderboard, currentUserId],
  )
  const achievements = useMemo(
    () => computeAchievements(dbPredictions, meLeaderboard?.rank ?? null),
    [dbPredictions, meLeaderboard?.rank],
  )
  const streaks = useMemo(() => computeStreaks(dbPredictions, matches), [dbPredictions, matches])

  const nextResolved = useMemo(
    () => resolveNextMatchForHome(matches, phaseNow),
    [matches, phaseNow],
  )
  const nextMatch = nextResolved.predictMatch
  const featuredMatch = nextResolved.featuredMatch
  const heroMatch = useMemo(() => getHeroDisplayMatch(nextResolved), [nextResolved])

  useTodayResultsSync()

  const { cards: liveCards } = useWorldCupLiveInsights({
    matches,
    leaderboard: dbLeaderboard,
    topScorers,
    overall: overallProgress,
    groupProgress,
    userId: currentUserId,
    points: meLeaderboard?.points ?? 0,
    rank: meLeaderboard?.rank ?? null,
    enabled: deferHomeHeavy,
  })

  const liveCardsResolved = useMemo(() => {
    if (!featuredMatch) return liveCards
    return liveCards.map(card =>
      card.type === 'next_match' ? { ...card, match: featuredMatch } : card,
    )
  }, [liveCards, featuredMatch])

  const openPredict = (match: Match) => {
    if (!currentUserId) {
      navigate('/login')
      return
    }
    setPredictMatch(match)
  }

  const belowFoldGamification = currentUserId ? (
  <Suspense fallback={<HomeSectionSkeleton />}>
    <HomeContinuePredicting groups={groupProgress} total={overallProgress.total} />
    <HomeGamificationPanel achievements={achievements} streaks={streaks} />
  </Suspense>
  ) : null

  return (
    <>
      <div className="md:hidden">
        <div className="wc26-scroll-content wc26-home-premium -mx-2">
          <MobileHomeHeader />
          <WorldCupHero
            variant="mobile"
            useIsolatedCountdown
            countdownMatch={nextResolved.countdownMatch}
            phase={nextResolved.phase}
            nextMatch={heroMatch}
            onPredict={() => (nextMatch ? openPredict(nextMatch) : navigate('/matches'))}
            hasPrediction={nextMatch ? predictionSet.has(nextMatch.id) : false}
          />

          <div className="wc26-content-sheet wc26-content-sheet--home mt-1 px-3 pb-3 pt-5">
            {deferHomeHeavy && ENABLE_LIVE_INSIGHTS && (
              <Suspense fallback={<HomeSectionSkeleton tall />}>
                <WorldCupLiveCarousel cards={liveCardsResolved} onPredict={openPredict} />
              </Suspense>
            )}

            <Suspense fallback={<HomeSectionSkeleton tall />}>
              <HomeRankingGrid
                entries={dbLeaderboard}
                currentUserId={currentUserId}
                isLoading={leaderboardLoading}
              />
            </Suspense>

            <AdaptiveSection motionProps={MOTION.enter} className="wc26-deferred-section mb-5">
              <p className="wc26-section-title">Jugá ahora</p>
              <Suspense fallback={<HomeSectionSkeleton />}>
                <QuickActionGrid compact />
              </Suspense>
            </AdaptiveSection>

            {deferHomeHeavy ? belowFoldGamification : null}
          </div>
        </div>
      </div>

      <div className="hidden space-y-6 md:block">
        <WorldCupHero
          variant="desktop"
          useIsolatedCountdown
          countdownMatch={nextResolved.countdownMatch}
          phase={nextResolved.phase}
          nextMatch={heroMatch}
          hasPrediction={nextMatch ? predictionSet.has(nextMatch.id) : false}
          onPredict={() => (nextMatch ? openPredict(nextMatch) : navigate('/matches'))}
          onFixture={() => navigate('/matches')}
        />

        {deferHomeHeavy && ENABLE_LIVE_INSIGHTS && (
          <Suspense fallback={<HomeSectionSkeleton tall />}>
            <WorldCupLiveCarousel cards={liveCardsResolved} onPredict={openPredict} />
          </Suspense>
        )}

        <HomeNextMatchCard
          match={featuredMatch}
          phase={nextResolved.phase}
          hasPrediction={nextMatch ? predictionSet.has(nextMatch.id) : false}
          onPredict={() => (nextMatch ? openPredict(nextMatch) : navigate('/matches'))}
        />

        <Suspense fallback={<HomeSectionSkeleton tall />}>
          <HomeRankingGrid
            entries={dbLeaderboard}
            currentUserId={currentUserId}
            isLoading={leaderboardLoading}
          />
        </Suspense>

        {deferHomeHeavy ? belowFoldGamification : null}
      </div>

      {predictMatch && (
        <Suspense fallback={null}>
          <MatchPredictionModal
            key={predictMatch.id}
            match={predictMatch}
            isOpen={!!predictMatch}
            onClose={() => setPredictMatch(null)}
            allMatches={matches}
            onContinueNext={setPredictMatch}
            existingPrediction={dbPredictions.find(p => p.matchId === predictMatch.id)}
            onSave={async payload => {
              await savePrediction.mutateAsync({
                matchId: predictMatch.id,
                homeScore: payload.exactScore?.home ?? 0,
                awayScore: payload.exactScore?.away ?? 0,
                etHomeScore: payload.etScore?.home ?? null,
                etAwayScore: payload.etScore?.away ?? null,
                penaltyWinner: payload.penaltyWinner ?? null,
              })
            }}
          />
        </Suspense>
      )}
    </>
  )
}
