import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { MOTION } from '../../constants/design'
import {
  HomeNextMatchCard,
  MatchPredictionModal,
  HomeContinuePredicting,
  HomeGamificationPanel,
  WorldCupHero,
  MobileHomeHeader,
  QuickActionGrid,
  HomeRankingGrid,
  WorldCupLiveCarousel,
} from '../../components/worldcup'
import { useWorldCupLiveInsights } from '../../hooks/useWorldCupLiveInsights'
import { useWorldCupMatches, useLeaderboard, usePredictions, useTopScorers, useAllPlayers } from '../../useWorldCupData'
import { ENABLE_HEAVY_ANIMATIONS, ENABLE_LIVE_INSIGHTS } from '../../config/betaMode'
import { useAuth } from '../../lib/auth'
import { useSavePrediction } from '../../hooks/useSavePrediction'
import {
  buildMatchCountdown,
  computeGroupProgress,
  computeOverallProgress,
  computeAchievements,
  computeStreaks,
  resolveNextMatchForHome,
} from '../../utils/predictionProgress'
import type { Match } from '../../types/worldcup'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const currentUserId = user?.id
  const savePrediction = useSavePrediction(currentUserId)
  const [predictMatch, setPredictMatch] = useState<Match | null>(null)

  const { data: matches = [] } = useWorldCupMatches()
  const { data: dbPredictions = [] } = usePredictions(currentUserId)
  const { data: dbLeaderboard = [], isLoading: leaderboardLoading } = useLeaderboard()
  const { data: topScorers = [] } = useTopScorers()
  const { data: allPlayers = [] } = useAllPlayers()

  const predictionSet = useMemo(() => new Set(dbPredictions.map(p => p.matchId)), [dbPredictions])
  const groupProgress = useMemo(
    () => computeGroupProgress(matches, predictionSet),
    [matches, predictionSet]
  )
  const overallProgress = useMemo(
    () => computeOverallProgress(matches, predictionSet),
    [matches, predictionSet]
  )
  const meLeaderboard = useMemo(
    () => dbLeaderboard.find(lb => lb.userId === currentUserId),
    [dbLeaderboard, currentUserId]
  )
  const achievements = useMemo(
    () => computeAchievements(dbPredictions, meLeaderboard?.rank ?? null),
    [dbPredictions, meLeaderboard?.rank]
  )
  const streaks = useMemo(() => computeStreaks(dbPredictions, matches), [dbPredictions, matches])

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const nextResolved = useMemo(() => resolveNextMatchForHome(matches, now), [matches, now])
  const nextMatch = nextResolved.predictMatch
  const featuredMatch = nextResolved.featuredMatch

  const { cards: liveCards } = useWorldCupLiveInsights({
    matches,
    leaderboard: dbLeaderboard,
    topScorers,
    players: allPlayers,
    overall: overallProgress,
    groupProgress,
    userId: currentUserId,
    points: meLeaderboard?.points ?? 0,
    rank: meLeaderboard?.rank ?? null,
  })

  const countdown = useMemo(
    () => buildMatchCountdown(nextResolved.countdownMatch, now),
    [nextResolved.countdownMatch, now],
  )

  const countdownHint =
    nextResolved.phase === 'starting_soon' && !countdown
      ? '¡Arranca pronto!'
      : nextResolved.phase === 'live' && !countdown
        ? 'Partido en curso'
        : undefined

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

  const modal = predictMatch && (
    <MatchPredictionModal
      key={predictMatch.id}
      match={predictMatch}
      isOpen={!!predictMatch}
      onClose={() => setPredictMatch(null)}
      existingPrediction={dbPredictions.find(p => p.matchId === predictMatch.id)}
      onSave={async payload => {
        await savePrediction.mutateAsync({
          matchId: predictMatch.id,
          homeScore: payload.exactScore?.home ?? 0,
          awayScore: payload.exactScore?.away ?? 0,
        })
      }}
    />
  )

  return (
    <>
      <div className="md:hidden">
        <div className="wc26-scroll-content wc26-home-premium -mx-2">
          <MobileHomeHeader />
          <WorldCupHero
            variant="mobile"
            countdown={countdown}
            countdownHint={countdownHint}
            onPredict={() => (nextMatch ? openPredict(nextMatch) : navigate('/matches'))}
            hasPrediction={nextMatch ? predictionSet.has(nextMatch.id) : false}
          />

          <div className="wc26-content-sheet wc26-content-sheet--home mt-1 px-3 pb-3 pt-5">
            {ENABLE_LIVE_INSIGHTS && (
              <WorldCupLiveCarousel
                cards={liveCardsResolved}
                onPredict={openPredict}
              />
            )}

            <HomeRankingGrid
              entries={dbLeaderboard}
              currentUserId={currentUserId}
              isLoading={leaderboardLoading}
            />

            {ENABLE_HEAVY_ANIMATIONS ? (
              <motion.section {...MOTION.enter} className="mb-5">
                <p className="wc26-section-title">Jugá ahora</p>
                <QuickActionGrid compact />
              </motion.section>
            ) : (
              <section className="mb-5">
                <p className="wc26-section-title">Jugá ahora</p>
                <QuickActionGrid compact />
              </section>
            )}

            {currentUserId && (
              <>
                <HomeContinuePredicting
                  groups={groupProgress}
                  total={overallProgress.total}
                />
                <HomeGamificationPanel achievements={achievements} streaks={streaks} />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="hidden space-y-6 md:block">
        <WorldCupHero
          variant="desktop"
          countdown={countdown}
          countdownHint={countdownHint}
          hasPrediction={nextMatch ? predictionSet.has(nextMatch.id) : false}
          onPredict={() => (nextMatch ? openPredict(nextMatch) : navigate('/matches'))}
          onFixture={() => navigate('/matches')}
        />

        {ENABLE_LIVE_INSIGHTS && (
          <WorldCupLiveCarousel cards={liveCardsResolved} onPredict={openPredict} />
        )}

        <HomeNextMatchCard
          match={featuredMatch}
          phase={nextResolved.phase}
          hasPrediction={nextMatch ? predictionSet.has(nextMatch.id) : false}
          onPredict={() => (nextMatch ? openPredict(nextMatch) : navigate('/matches'))}
        />

        <HomeRankingGrid
          entries={dbLeaderboard}
          currentUserId={currentUserId}
          isLoading={leaderboardLoading}
        />

        {currentUserId && (
          <>
            <HomeContinuePredicting
              groups={groupProgress}
              total={overallProgress.total}
            />
            <HomeGamificationPanel achievements={achievements} streaks={streaks} />
          </>
        )}
      </div>

      {modal}
    </>
  )
}
