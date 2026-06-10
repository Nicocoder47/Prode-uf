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
import { useWorldCupMatches, useLeaderboard, usePredictions, useTopScorers, useTopPlayers } from '../../useWorldCupData'
import { ENABLE_HEAVY_ANIMATIONS, ENABLE_LIVE_INSIGHTS } from '../../config/betaMode'
import { useAuth } from '../../lib/auth'
import { useSavePrediction } from '../../hooks/useSavePrediction'
import {
  computeGroupProgress,
  computeOverallProgress,
  computeAchievements,
  computeStreaks,
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
  const { data: featuredPlayers = [] } = useTopPlayers(20)

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

  const upcoming = useMemo(
    () =>
      matches
        .filter(m => m.status === 'scheduled')
        .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()),
    [matches]
  )

  const nextMatch = upcoming[0] ?? null

  const { cards: liveCards } = useWorldCupLiveInsights({
    matches,
    leaderboard: dbLeaderboard,
    topScorers,
    players: featuredPlayers,
    overall: overallProgress,
    groupProgress,
    userId: currentUserId,
    points: meLeaderboard?.points ?? 0,
    rank: meLeaderboard?.rank ?? null,
  })

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!nextMatch) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [nextMatch?.id, nextMatch?.kickoff])

  const countdown = useMemo(() => {
    if (!nextMatch) return undefined
    const diff = new Date(nextMatch.kickoff).getTime() - now
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    }
  }, [nextMatch, now])

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
            onPredict={() => (nextMatch ? openPredict(nextMatch) : navigate('/matches'))}
            hasPrediction={nextMatch ? predictionSet.has(nextMatch.id) : false}
          />

          <div className="wc26-content-sheet wc26-content-sheet--home mt-1 px-3 pb-3 pt-5">
            {ENABLE_LIVE_INSIGHTS && (
              <WorldCupLiveCarousel
                cards={liveCards}
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
                  matches={matches}
                  predictionSet={predictionSet}
                  predicted={overallProgress.predicted}
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
          hasPrediction={nextMatch ? predictionSet.has(nextMatch.id) : false}
          onPredict={() => (nextMatch ? openPredict(nextMatch) : navigate('/matches'))}
          onFixture={() => navigate('/matches')}
        />

        {ENABLE_LIVE_INSIGHTS && (
          <WorldCupLiveCarousel cards={liveCards} onPredict={openPredict} />
        )}

        <HomeNextMatchCard
          match={nextMatch}
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
              matches={matches}
              predictionSet={predictionSet}
              predicted={overallProgress.predicted}
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
