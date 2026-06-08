import type { GroupSummary, Match, Player, Team } from '../../types/worldcup';
import type { PlayerStats } from '../../services/footballData/footballDataService';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

class FootballApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'FootballApiError';
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new FootballApiError(body || `HTTP ${res.status}`, res.status);
  }

  return res.json() as Promise<T>;
}

/** Solo activo con VITE_USE_FOOTBALL_API=true y URL de backend Express (no usado en producción $0). */
export const footballApiClient = {
  isEnabled: () =>
    import.meta.env.VITE_USE_FOOTBALL_API === 'true' &&
    Boolean(String(import.meta.env.VITE_API_BASE_URL ?? '').trim()),

  getGroups: () => apiGet<GroupSummary[]>('/api/groups'),

  getTeams: () => apiGet<Team[]>('/api/teams'),

  getGroupById: (id: string) => apiGet<GroupSummary>(`/api/groups/${encodeURIComponent(id)}`),

  getTeamById: (id: string) => apiGet<Team>(`/api/teams/${encodeURIComponent(id)}`),

  getTeamPlayers: (teamId: string) => apiGet<Player[]>(`/api/teams/${encodeURIComponent(teamId)}/players`),

  getAllPlayers: () => apiGet<Player[]>(`/api/players`),

  getPlayerById: (id: string) => apiGet<Player & { photoUrl?: string | null }>(`/api/players/${encodeURIComponent(id)}`),

  getPlayerStats: (id: string) => apiGet<PlayerStats>(`/api/players/${encodeURIComponent(id)}/stats`),

  getFixtures: (params?: { group?: string; teamId?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.group) qs.set('group', params.group);
    if (params?.teamId) qs.set('teamId', params.teamId);
    if (params?.status) qs.set('status', params.status);
    const suffix = qs.toString() ? `?${qs}` : '';
    return apiGet<Match[]>(`/api/fixtures${suffix}`);
  },

  getFixtureById: (id: string) => apiGet<Match>(`/api/fixtures/${encodeURIComponent(id)}`),
};

export { FootballApiError };
