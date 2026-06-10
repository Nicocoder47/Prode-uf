import type { Match, Team } from '../types/worldcup'
import type {
  WorldCupLiveCardType,
  WorldCupLiveInsightPayload,
} from './worldCupLiveInsights'

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
  next_match: {
    label: 'Próximo partido',
    emoji: '⚽',
    description: 'Countdown al siguiente partido programado con CTA para predecir.',
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
    emoji: '🏆',
    description: 'Cambios de posición en el leaderboard respecto al snapshot anterior.',
    sources: ['src/utils/worldCupLiveInsights.ts', 'src/components/worldcup/LiveInsightCard.tsx'],
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
    description: 'Top 3 goleadores del torneo con datos reales.',
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

  return [
    {
      id: 'preview-next_match',
      type: 'next_match',
      emoji: '⚽',
      title: 'PRÓXIMO PARTIDO',
      match,
      countdownLabel: 'Faltan 2 días',
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
      emoji: '🏆',
      title: 'MOVIMIENTO RANKING',
      lines: ['Subiste 3 puestos · ahora #12', 'Líder: Martín G. (+24 pts)', 'Zona premium: top 10'],
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
        { name: 'Mbappé', goals: 4 },
        { name: 'Haaland', goals: 3 },
        { name: 'Messi', goals: 3 },
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
