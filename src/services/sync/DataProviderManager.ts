import { ApiFootballProvider } from '../../providers/apiFootball/ApiFootballProvider';
import { FootballDataProvider } from '../../providers/footballData/FootballDataProvider';

export interface SportsDataProviderAdapter {
  name: string;
  syncTeams(): Promise<unknown[]>;
  syncPlayers(): Promise<unknown[]>;
  syncFixtures(): Promise<unknown[]>;
  syncStandings(): Promise<unknown[]>;
  syncLiveMatches?(): Promise<unknown[]>;
}

function footballDataAdapter(): SportsDataProviderAdapter {
  return {
    name: 'football-data.org',
    async syncTeams() {
      return FootballDataProvider.syncTeams();
    },
    async syncPlayers() {
      const { players } = await FootballDataProvider.syncPlayers();
      return players;
    },
    async syncFixtures() {
      return FootballDataProvider.syncFixtures();
    },
    async syncStandings() {
      return FootballDataProvider.syncStandings();
    },
    async syncLiveMatches() {
      return FootballDataProvider.syncLiveMatches();
    },
  };
}

function apiFootballAdapter(): SportsDataProviderAdapter {
  return {
    name: 'api-football',
    async syncTeams() {
      return ApiFootballProvider.syncWorldCupTeams();
    },
    async syncPlayers() {
      return ApiFootballProvider.syncAllSquads();
    },
    async syncFixtures() {
      return ApiFootballProvider.syncWorldCupFixtures();
    },
    async syncStandings() {
      return ApiFootballProvider.syncStandings();
    },
    async syncLiveMatches() {
      return ApiFootballProvider.syncLiveMatches();
    },
  };
}

/**
 * Orden de fallback:
 * 1. FOOTBALL_DATA_API_KEY
 * 2. API_FOOTBALL_KEY
 * 3. SPORTMONKS_API_TOKEN (no implementado)
 */
export function resolveSportsDataProvider(): SportsDataProviderAdapter {
  if (FootballDataProvider.isConfigured()) {
    return footballDataAdapter();
  }

  if (ApiFootballProvider.isConfigured()) {
    return apiFootballAdapter();
  }

  if (process.env.SPORTMONKS_API_TOKEN) {
    throw new Error('Sportmonks provider is not implemented yet');
  }

  throw new Error('No sports data provider configured');
}
