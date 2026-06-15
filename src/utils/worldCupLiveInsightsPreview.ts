import { buildRankingLoreFromLeaderboard, DEFAULT_RANKING_LORE } from '../config/rankingLore.ts'
import type { LeaderboardEntry, Match, Team } from '../types/worldcup'
import {
  toRankingLoreDisplay,
  type WorldCupLiveCardType,
  type WorldCupLiveInsightPayload,
} from './worldCupLiveInsights'

const PREVIEW_LEADERBOARD: LeaderboardEntry[] = [
  {
    userId: 'preview-leader',
    rank: 1,
    points: 24,
    wins: 0,
    draws: 0,
    losses: 0,
    profile: { fullName: 'Martín García', legajo: '10482' },
  },
  {
    userId: 'preview-runner',
    rank: 2,
    points: 24,
    wins: 0,
    draws: 0,
    losses: 0,
    profile: { fullName: 'Marcelo Arguello', legajo: '25985' },
  },
]

function mockTeam(code: string, name: string, flag: string): Team {
  return {
    id: code.toLowerCase(),
    name,
    code,
    shortName: code,
    countryCode: code,
    flag,
    group: 'A',
    fifaRanking: 5,
    coach: null,
    confederation: 'CONMEBOL',
  }
}

function mockMatch(): Match {
  const kickoff = new Date(Date.now() + 2 * 86_400_000 + 5 * 3_600_000).toISOString()
  return {
    id: 'preview-match-1',
    stage: 'group',
    group: 'A',
    stadium: 'Estadio Azteca',
    city: 'Ciudad de México',
    homeTeamId: 'arg',
    awayTeamId: 'bra',
    homeTeam: mockTeam('ARG', 'Argentina', '🇦🇷'),
    awayTeam: mockTeam('BRA', 'Brasil', '🇧🇷'),
    kickoff,
    date: kickoff,
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
  }
}

/** Metadatos de cada tipo de card del carrusel «Mundial en Vivo». */
export const LIVE_CARD_TYPE_META: Record<
  WorldCupLiveCardType,
  { label: string; emoji: string; description: string; sources: string[] }
> = {
  played_matches: {
    label: 'Partidos jugados',
    emoji: '🏁',
    description: 'Resultados oficiales de partidos finalizados, sync diario con la API.',
    sources: [
      'src/utils/worldCupLiveInsights.ts',
      'src/hooks/usePlayedResultsSync.ts',
      'src/components/worldcup/LiveInsightCard.tsx',
    ],
  },
  next_match: {
    label: 'Próximos partidos',
    emoji: '⚽',
    description: 'Listado de partidos del día con CTA para predecir.',
    sources: [
      'src/components/worldcup/WorldCupLiveCarousel.tsx',
      'src/utils/worldCupLiveInsights.ts',
      'src/index.css (.wc26-live-card*)',
    ],
  },
  community_trend: {
    label: 'Tendencia comunidad',
    emoji: '📊',
    description: 'Distribución de predicciones (local / empate / visitante) del partido más votado.',
    sources: [
      'src/components/worldcup/LiveInsightCard.tsx',
      'src/utils/worldCupLiveInsights.ts',
      'src/index.css',
    ],
  },
  ranking_move: {
    label: 'Movimiento ranking',
    emoji: '🎯',
    description: 'Relato editorial del ranking (configurable en admin) o podio automático si el lore está desactivado.',
    sources: [
      'src/utils/worldCupLiveInsights.ts',
      'src/components/worldcup/LiveInsightCard.tsx',
      'src/features/admin/AdminRankingLorePage.tsx',
      'src/config/rankingLore.ts',
    ],
  },
  popular_match: {
    label: 'Partido popular',
    emoji: '🔥',
    description: 'Partido con más predicciones de la comunidad.',
    sources: ['src/utils/worldCupLiveInsights.ts'],
  },
  top_scorers: {
    label: 'Goleadores',
    emoji: '⚽',
    description: 'Top 10 goleadores del torneo con datos reales.',
    sources: ['src/utils/worldCupLiveInsights.ts', 'src/hooks/useWorldCupLiveInsights.ts'],
  },
  your_progress: {
    label: 'Tu progreso',
    emoji: '📈',
    description: 'Partidos predichos, porcentaje, puntos y puesto en el ranking.',
    sources: ['src/utils/worldCupLiveInsights.ts', 'src/utils/predictionProgress.ts'],
  },
  next_reward: {
    label: 'Próxima recompensa',
    emoji: '🎁',
    description: 'Milestone de predicciones por grupo para desbloquear recompensas.',
    sources: ['src/utils/predictionProgress.ts', 'src/components/worldcup/LiveInsightCard.tsx'],
  },
}

const ORDER: WorldCupLiveCardType[] = [
  'played_matches',
  'next_match',
  'community_trend',
  'ranking_move',
  'popular_match',
  'top_scorers',
  'your_progress',
  'next_reward',
]

/** Fixtures de preview con datos representativos para diseño y QA. */
export function buildLiveCardsPreviewFixtures(): WorldCupLiveInsightPayload[] {
  const match = mockMatch()

  const finishedPreview: Match = {
    ...match,
    id: 'preview-played-1',
    status: 'finished',
    homeScore: 2,
    awayScore: 1,
    kickoff: new Date(Date.now() - 86_400_000).toISOString(),
    homeTeam: mockTeam('MEX', 'México', '🇲🇽'),
    awayTeam: mockTeam('POL', 'Polonia', '🇵🇱'),
  }

  return [
    {
      id: 'preview-played_matches',
      type: 'played_matches',
      emoji: '🏁',
      title: 'PARTIDOS JUGADOS',
      subtitle: '3 resultados · Sync diario con la API',
      matches: [
        finishedPreview,
        {
          ...finishedPreview,
          id: 'preview-played-2',
          homeScore: 0,
          awayScore: 0,
          homeTeam: mockTeam('KOR', 'Corea del Sur', '🇰🇷'),
          awayTeam: mockTeam('CZE', 'Rep. Checa', '🇨🇿'),
        },
      ],
      cta: { label: 'Ver todos', action: 'matches' },
    },
    {
      id: 'preview-next_match',
      type: 'next_match',
      emoji: '⚽',
      title: 'PRÓXIMOS PARTIDOS',
      match,
      countdownLabel: 'Faltan 2 días',
      todayMatches: [match],
      cta: { label: 'Predecir ahora', action: 'predict' },
    },
    {
      id: 'preview-community_trend',
      type: 'community_trend',
      emoji: '📊',
      title: 'TENDENCIA COMUNIDAD',
      subtitle: 'Argentina vs Brasil',
      match,
      homePct: 42,
      drawPct: 18,
      awayPct: 40,
      favoriteLabel: '42% cree que gana Argentina',
      hasEnoughData: true,
    },
    {
      id: 'preview-ranking_move',
      type: 'ranking_move',
      emoji: DEFAULT_RANKING_LORE.emoji,
      title: 'MOVIMIENTO RANKING',
      lines: [],
      leader: null,
      runnerUp: null,
      lore: toRankingLoreDisplay(
        buildRankingLoreFromLeaderboard(PREVIEW_LEADERBOARD, {
          ...DEFAULT_RANKING_LORE,
          enabled: true,
          autoFromLeaderboard: true,
        })!,
      ),
      cta: { label: 'Ver ranking', action: 'leaderboard' },
    },
    {
      id: 'preview-popular_match',
      type: 'popular_match',
      emoji: '🔥',
      title: 'PARTIDO POPULAR',
      match,
      predictionCount: 1284,
    },
    {
      id: 'preview-top_scorers',
      type: 'top_scorers',
      emoji: '⚽',
      title: 'GOLEADORES',
      scorers: [
        { id: 'p1', name: 'Kylian Mbappé', goals: 4, rank: 1, flag: '🇫🇷', countryCode: 'FRA' },
        { id: 'p2', name: 'Erling Haaland', goals: 3, rank: 2, flag: '🇳🇴', countryCode: 'NOR' },
        { id: 'p3', name: 'Lionel Messi', goals: 3, rank: 2, flag: '🇦🇷', countryCode: 'ARG' },
      ],
    },
    {
      id: 'preview-your_progress',
      type: 'your_progress',
      emoji: '📈',
      title: 'TU PROGRESO',
      subtitle: 'Mundial 2026',
      predicted: 18,
      total: 104,
      percent: 17,
      points: 142,
      rank: 12,
      cta: { label: 'Seguir prediciendo', action: 'matches' },
    },
    {
      id: 'preview-next_reward',
      type: 'next_reward',
      emoji: '🎁',
      title: 'PRÓXIMA RECOMPENSA',
      message: 'Te faltan 5 predicciones para completar Grupo A',
      cta: { label: 'Jugar ahora', action: 'matches' },
    },
  ]
}

export function getLiveCardTypeOrder(): WorldCupLiveCardType[] {
  return ORDER
}

export function getPreviewCardByType(
  type: WorldCupLiveCardType,
): WorldCupLiveInsightPayload | undefined {
  return buildLiveCardsPreviewFixtures().find(c => c.type === type)
}
