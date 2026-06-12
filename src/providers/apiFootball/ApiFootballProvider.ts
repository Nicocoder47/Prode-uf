import axios from 'axios';
import type { Match } from '../../types/worldcup';
import { supabase } from '../../database/supabaseClient';
import { resolveEventPlayerId, resetEventIdentityCaches } from '../../services/sync/eventPlayerIdentityResolver';
import { todayInArgentina } from '../../utils/matchDay';
import { formatCoachName, resolveTeamConfederation } from '../../utils/teamMetadata';

const API_URL = 'https://v3.football.api-sports.io';
const PROVIDER = 'api_football';
const HEADERS = {
  'x-rapidapi-host': 'v3.football.api-sports.io',
  'x-rapidapi-key': process.env.API_FOOTBALL_KEY || '',
};
const LEAGUE_ID = process.env.API_FOOTBALL_WORLD_CUP_LEAGUE_ID || '1'; // 1 = World Cup
const SEASON = process.env.API_FOOTBALL_WORLD_CUP_SEASON || '2026';

// Mapa provider_team_id -> uuid local (para resolver FKs de players/matches).
async function getTeamUuidMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('teams')
    .select('id,provider_team_id')
    .eq('provider', PROVIDER);
  if (error) {
    console.warn('[ApiFootball] No se pudo cargar el mapa de equipos:', error.message);
    return new Map();
  }
  return new Map((data ?? []).map((t: { provider_team_id: string; id: string }) => [String(t.provider_team_id), t.id]));
}

async function getPlayerUuidMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('players')
    .select('id,provider_player_id,api_football_id')
    .eq('provider', PROVIDER);
  if (error) {
    console.warn('[ApiFootball] No se pudo cargar el mapa de jugadores:', error.message);
    return new Map();
  }
  const map = new Map<string, string>();
  for (const p of data ?? []) {
    const row = p as { id: string; provider_player_id: string | null; api_football_id: string | null };
    if (row.provider_player_id) map.set(String(row.provider_player_id), row.id);
    if (row.api_football_id) map.set(String(row.api_football_id), row.id);
  }
  return map;
}

async function getMatchUuidByProviderId(providerMatchId: string): Promise<string | null> {
  const { data } = await supabase
    .from('matches')
    .select('id')
    .eq('provider', PROVIDER)
    .eq('provider_match_id', providerMatchId)
    .maybeSingle();
  return data?.id ?? null;
}

export class ApiFootballProvider {

  static isConfigured(): boolean {
    return !!process.env.API_FOOTBALL_KEY && process.env.API_FOOTBALL_KEY !== 'your_api_football_key_here';
  }

  static async syncWorldCupTeams(): Promise<any[]> {
    if (!this.isConfigured()) {
      console.warn('[ApiFootball] Missing API_FOOTBALL_KEY. Skipping sync teams.');
      return [];
    }

    console.log(`[ApiFootball] Fetching teams for League ${LEAGUE_ID}, Season ${SEASON}...`);
    const response = await axios.get(`${API_URL}/teams?league=${LEAGUE_ID}&season=${SEASON}`, { headers: HEADERS });
    const items = response.data.response || [];
    console.log(`[ApiFootball] Teams fetched: ${items.length}`);

    const teams = items.map((item: any) => this.normalizeTeam(item.team));
    await this.enrichTeamsWithCoach(teams);
    return teams;
  }

  /** Obtiene DT actual desde /coachs (API-Football). */
  static async fetchCoachForTeam(providerTeamId: string): Promise<string | null> {
    if (!this.isConfigured()) return null;
    try {
      const res = await axios.get(`${API_URL}/coachs`, {
        headers: HEADERS,
        params: { team: providerTeamId },
        timeout: 12_000,
      });
      const rows = res.data.response ?? [];
      if (rows.length === 0) return null;

      const teamId = Number(providerTeamId);
      const active =
        rows.find((c: any) =>
          (c.career ?? []).some(
            (entry: any) => entry.team?.id === teamId && (entry.end == null || entry.end === ''),
          ),
        ) ?? rows[0];

      return formatCoachName(active);
    } catch {
      return null;
    }
  }

  /** Completa coach en filas normalizadas (rate limit). */
  static async enrichTeamsWithCoach(teams: Array<{ provider_team_id: string; coach: string | null }>) {
    const delayMs = Number(process.env.TEAM_ENRICH_DELAY_MS || 600);
    let enriched = 0;
    for (const team of teams) {
      if (team.coach) continue;
      const coach = await this.fetchCoachForTeam(team.provider_team_id);
      if (coach) {
        team.coach = coach;
        enriched++;
      }
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    }
    if (enriched > 0) console.log(`[ApiFootball] Coaches enriquecidos: ${enriched}/${teams.length}`);
  }

  /** Actualiza equipos ya persistidos (coach + confederación faltante). */
  static async enrichStoredTeamsMetadata(): Promise<{ updated: number; coaches: number; confederations: number }> {
    if (!this.isConfigured()) return { updated: 0, coaches: 0, confederations: 0 };

    const { data, error } = await supabase
      .from('teams')
      .select('id,provider_team_id,name,code,country_code,coach,confederation,fifa_ranking')
      .eq('provider', PROVIDER);
    if (error) throw error;

    const delayMs = Number(process.env.TEAM_ENRICH_DELAY_MS || 600);
    let updated = 0;
    let coaches = 0;
    let confederations = 0;

    for (const row of data ?? []) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (!row.confederation?.trim()) {
        const conf = resolveTeamConfederation(row.name, row.code, row.country_code);
        if (conf) {
          patch.confederation = conf;
          confederations++;
        }
      }

      if (!row.coach?.trim() && row.provider_team_id) {
        const coach = await this.fetchCoachForTeam(String(row.provider_team_id));
        if (coach) {
          patch.coach = coach;
          coaches++;
        }
        if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
      }

      if (Object.keys(patch).length <= 1) continue;

      const { error: upErr } = await supabase.from('teams').update(patch).eq('id', row.id);
      if (!upErr) updated++;
    }

    return { updated, coaches, confederations };
  }

  static async syncAllSquads(): Promise<any[]> {
    if (!this.isConfigured()) {
      console.warn('[ApiFootball] Missing API_FOOTBALL_KEY. Skipping sync players.');
      return [];
    }

    console.log(`[ApiFootball] Fetching all squads...`);
    // Resolvemos el team_id (uuid) desde la BD: los equipos ya deben estar sincronizados.
    const teamMap = await getTeamUuidMap();
    if (teamMap.size === 0) {
      console.warn('[ApiFootball] No hay equipos en la BD. Corre primero sync:teams.');
    }

    let allPlayers: any[] = [];
    for (const [providerTeamId, teamUuid] of teamMap) {
      const squad = await this.syncTeamSquad(providerTeamId, teamUuid);
      allPlayers = allPlayers.concat(squad);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // rate limit
    }

    console.log(`[ApiFootball] Total players fetched: ${allPlayers.length}`);
    return allPlayers;
  }

  static async syncTeamSquad(providerTeamId: string, teamUuid: string): Promise<any[]> {
    const response = await axios.get(`${API_URL}/players/squads?team=${providerTeamId}`, { headers: HEADERS });
    const data = response.data.response[0];
    if (!data || !data.players) {
      console.warn(`[ApiFootball] No squad found for team=${providerTeamId}`);
      return [];
    }
    return data.players.map((p: any) => this.normalizePlayer(p, teamUuid));
  }

  static async syncWorldCupFixtures(): Promise<any[]> {
    if (!this.isConfigured()) {
      console.warn('[ApiFootball] Missing API_FOOTBALL_KEY. Skipping sync fixtures.');
      return [];
    }

    console.log(`[ApiFootball] Fetching fixtures for League ${LEAGUE_ID}, Season ${SEASON}...`);
    const response = await axios.get(`${API_URL}/fixtures?league=${LEAGUE_ID}&season=${SEASON}`, { headers: HEADERS });
    const fixtures = response.data.response || [];
    console.log(`[ApiFootball] Fixtures fetched: ${fixtures.length}`);

    // Resolver FKs de equipos
    const teamMap = await getTeamUuidMap();
    return fixtures
      .map((item: any) => this.normalizeFixture(item, teamMap))
      .filter((row: any) => row.home_team_id && row.away_team_id);
  }

  // ============================================================================
  // NORMALIZADORES (columnas reales de SUPABASE_SCHEMA.sql)
  // ============================================================================

  private static normalizeTeam(team: any): any {
    const code = team.code || (team.name ? team.name.substring(0, 3).toUpperCase() : 'TBD');
    return {
      provider: PROVIDER,
      provider_team_id: String(team.id),
      name: team.name,
      code,
      country_code: team.country ?? null,
      flag_url: team.logo || null,
      group_label: null,
      fifa_ranking: null,
      coach: null,
      confederation: resolveTeamConfederation(team.name, code, team.country),
      updated_at: new Date().toISOString(),
    };
  }

  private static normalizePlayer(player: any, teamUuid: string): any {
    return {
      provider: PROVIDER,
      provider_player_id: String(player.id),
      team_id: teamUuid,
      name: player.name,
      position: player.position || null,
      shirt_number: player.number != null ? Number(player.number) : null,
      date_of_birth: player.birth?.date || null,
      nationality: player.nationality || null,
      market_value: null,
      photo_url: player.photo || null,
      club: null,
      updated_at: new Date().toISOString(),
    };
  }

  private static normalizeFixture(item: any, teamMap: Map<string, string>): any {
    const round: string = item.league?.round || '';
    return {
      provider: PROVIDER,
      provider_match_id: String(item.fixture.id),
      home_team_id: teamMap.get(String(item.teams.home.id)) || null,
      away_team_id: teamMap.get(String(item.teams.away.id)) || null,
      kick_off: item.fixture.date,
      stadium: item.fixture.venue?.name || null,
      city: item.fixture.venue?.city || null,
      phase: round,
      round,
      group_label: this.extractGroup(round),
      status: this.mapStatus(item.fixture.status.short),
      score_home: item.goals.home,
      score_away: item.goals.away,
      updated_at: new Date().toISOString(),
    };
  }

  // ============================================================================
  // PARTIDOS EN VIVO
  // ============================================================================

  static async syncTodayMatchResults(): Promise<any[]> {
    if (!this.isConfigured()) return [];
    const day = todayInArgentina();
    const response = await axios.get(
      `${API_URL}/fixtures?date=${day}&league=${LEAGUE_ID}&season=${SEASON}`,
      { headers: HEADERS },
    );
    const teamMap = await getTeamUuidMap();
    return (response.data.response || [])
      .map((item: any) => this.normalizeFixture(item, teamMap))
      .filter((row: any) => row.home_team_id && row.away_team_id);
  }

  static async syncLiveMatches(): Promise<any[]> {
    if (!this.isConfigured()) return [];
    const response = await axios.get(`${API_URL}/fixtures?live=all&league=${LEAGUE_ID}`, { headers: HEADERS });
    const teamMap = await getTeamUuidMap();
    return (response.data.response || [])
      .map((item: any) => this.normalizeFixture(item, teamMap))
      .filter((row: any) => row.home_team_id && row.away_team_id);
  }

  /** Alias V5 */
  static syncTeams = ApiFootballProvider.syncWorldCupTeams;
  static syncPlayers = ApiFootballProvider.syncAllSquads;
  static syncFixtures = ApiFootballProvider.syncWorldCupFixtures;

  static async syncStandings(): Promise<any[]> {
    if (!this.isConfigured()) {
      console.warn('[ApiFootball] Missing API_FOOTBALL_KEY. Skipping sync standings.');
      return [];
    }
    const teamMap = await getTeamUuidMap();
    const response = await axios.get(
      `${API_URL}/standings?league=${LEAGUE_ID}&season=${SEASON}`,
      { headers: HEADERS }
    );
    const groups = response.data.response?.[0]?.league?.standings ?? [];
    const rows: any[] = [];
    for (const group of groups) {
      const groupLabel = this.extractGroup(group?.[0]?.group ?? '') ?? group?.[0]?.group ?? null;
      for (const row of group) {
        const teamUuid = teamMap.get(String(row.team.id));
        if (!teamUuid) continue;
        rows.push({
          team_id: teamUuid,
          group_label: groupLabel,
          phase: 'group',
          rank: row.rank,
          played: row.all.played,
          won: row.all.win,
          drawn: row.all.draw,
          lost: row.all.lose,
          goals_for: row.all.goals.for,
          goals_against: row.all.goals.against,
          goal_diff: row.goalsDiff,
          points: row.points,
          provider: PROVIDER,
          updated_at: new Date().toISOString(),
        });
      }
    }
    console.log(`[ApiFootball] Standings rows: ${rows.length}`);
    return rows;
  }

  static async syncLineups(providerMatchId: string, matchUuid: string): Promise<any[]> {
    if (!this.isConfigured()) return [];
    const teamMap = await getTeamUuidMap();
    const playerMap = await getPlayerUuidMap();
    const response = await axios.get(`${API_URL}/fixtures/lineups?fixture=${providerMatchId}`, { headers: HEADERS });
    const lineups = response.data.response ?? [];
    const rows: any[] = [];
    for (const side of lineups) {
      const teamUuid = teamMap.get(String(side.team.id));
      if (!teamUuid) continue;
      const starters = side.startXI ?? [];
      const subs = side.substitutes ?? [];
      for (const entry of starters) {
        const playerUuid = playerMap.get(String(entry.player.id));
        if (!playerUuid) continue;
        rows.push({
          match_id: matchUuid,
          team_id: teamUuid,
          player_id: playerUuid,
          lineup_status: 'starting',
          position: entry.player.pos ?? null,
          formation_slot: entry.player.grid ?? null,
          source: PROVIDER,
          updated_at: new Date().toISOString(),
        });
      }
      for (const entry of subs) {
        const playerUuid = playerMap.get(String(entry.player.id));
        if (!playerUuid) continue;
        rows.push({
          match_id: matchUuid,
          team_id: teamUuid,
          player_id: playerUuid,
          lineup_status: 'bench',
          position: entry.player.pos ?? null,
          source: PROVIDER,
          updated_at: new Date().toISOString(),
        });
      }
    }
    return rows;
  }

  static async syncMatchEvents(providerMatchId: string, matchUuid: string): Promise<any[]> {
    if (!this.isConfigured()) return [];
    const playerMap = await getPlayerUuidMap();
    const response = await axios.get(`${API_URL}/fixtures/events?fixture=${providerMatchId}`, { headers: HEADERS });
    const events = response.data.response ?? [];
    return Promise.all(
      events.map(async (ev: any, idx: number) => {
        let playerUuid = ev.player?.id ? playerMap.get(String(ev.player.id)) ?? null : null;
        if (!playerUuid && ev.player?.name) {
          playerUuid = await resolveEventPlayerId({
            providerPlayerId: ev.player?.id,
            playerName: ev.player?.name,
            teamProviderId: ev.team?.id,
          });
        }
        return {
          match_id: matchUuid,
          provider: PROVIDER,
          provider_event_id: `${providerMatchId}-${idx}-${ev.time?.elapsed ?? 0}`,
          event_type: ev.type ?? 'unknown',
          event_time: ev.time?.elapsed != null ? String(ev.time.elapsed) : null,
          event_data: {
            detail: ev.detail,
            comments: ev.comments,
            team_id: ev.team?.id,
            player_id: playerUuid,
            provider_player_id: ev.player?.id ?? null,
            player_name: ev.player?.name,
            assist_id: ev.assist?.id,
            assist_name: ev.assist?.name,
          },
        };
      })
    );
  }

  static async syncFixturePlayerStats(providerMatchId: string, matchUuid: string): Promise<{
    liveStatus: any[];
    ratings: any[];
    mvpPlayerId: string | null;
  }> {
    if (!this.isConfigured()) return { liveStatus: [], ratings: [], mvpPlayerId: null };
    const teamMap = await getTeamUuidMap();
    const playerMap = await getPlayerUuidMap();
    const response = await axios.get(`${API_URL}/fixtures/players?fixture=${providerMatchId}`, { headers: HEADERS });
    const sides = response.data.response ?? [];
    const liveStatus: any[] = [];
    const ratings: any[] = [];
    let bestRating = 0;
    let mvpPlayerId: string | null = null;

    for (const side of sides) {
      const teamUuid = teamMap.get(String(side.team.id));
      if (!teamUuid) continue;
      for (const entry of side.players ?? []) {
        const playerUuid = playerMap.get(String(entry.player.id));
        if (!playerUuid) continue;
        const stats = entry.statistics?.[0] ?? {};
        const rating = stats.games?.rating ? Number(stats.games.rating) : null;
        const goals = Number(stats.goals?.total ?? 0);
        const assists = Number(stats.goals?.assists ?? 0);
        const minutes = stats.games?.minutes ?? null;
        const status = minutes && minutes > 0 ? 'playing' : 'bench';

        liveStatus.push({
          match_id: matchUuid,
          player_id: playerUuid,
          team_id: teamUuid,
          status,
          is_starting: status === 'playing' && (stats.games?.substitute === false),
          is_substitute: stats.games?.substitute === true,
          is_substituted: false,
          minute_in: minutes ? 0 : null,
          minute_out: null,
          goals,
          assists,
          yellow_cards: Number(stats.cards?.yellow ?? 0),
          red_cards: Number(stats.cards?.red ?? 0),
          rating,
          xg: stats.shots?.on ? Number(stats.shots.on) : null,
          xa: null,
          shots: Number(stats.shots?.total ?? 0),
          passes: Number(stats.passes?.total ?? 0),
          tackles: Number(stats.tackles?.total ?? 0),
          market_value: null,
          last_updated: new Date().toISOString(),
        });

        if (rating != null) {
          ratings.push({
            player_id: playerUuid,
            match_id: matchUuid,
            rating,
            minutes_played: minutes,
            goals,
            assists,
            yellow_cards: Number(stats.cards?.yellow ?? 0),
            red_cards: Number(stats.cards?.red ?? 0),
            xg: null,
            xa: null,
            source: PROVIDER,
            captured_at: new Date().toISOString(),
          });
          if (rating > bestRating) {
            bestRating = rating;
            mvpPlayerId = playerUuid;
          }
        }
      }
    }
    return { liveStatus, ratings, mvpPlayerId };
  }

  /** Pipeline completo para un partido en vivo */
  static async syncLiveMatchBundle(providerMatchId: string, matchUuid: string): Promise<void> {
    const [events, lineups, stats] = await Promise.all([
      this.syncMatchEvents(providerMatchId, matchUuid),
      this.syncLineups(providerMatchId, matchUuid),
      this.syncFixturePlayerStats(providerMatchId, matchUuid),
    ]);

    if (events.length > 0) {
      const { error } = await supabase.from('events').upsert(events, { onConflict: 'provider,provider_event_id' });
      if (error) console.warn('[ApiFootball] events upsert:', error.message);
    }
    if (lineups.length > 0) {
      const { error } = await supabase.from('lineups').upsert(lineups, { onConflict: 'match_id,team_id,player_id,source' });
      if (error) console.warn('[ApiFootball] lineups upsert:', error.message);
    }
    if (stats.liveStatus.length > 0) {
      const { error } = await supabase.from('player_live_status').upsert(stats.liveStatus, { onConflict: 'match_id,player_id' });
      if (error) console.warn('[ApiFootball] player_live_status upsert:', error.message);
    }
    if (stats.ratings.length > 0) {
      const { error } = await supabase.from('player_ratings').upsert(stats.ratings, { onConflict: 'player_id,match_id,source' });
      if (error) console.warn('[ApiFootball] player_ratings upsert:', error.message);
    }
    if (stats.mvpPlayerId) {
      await supabase.from('matches').update({ mvp_player_id: stats.mvpPlayerId }).eq('id', matchUuid);
    }
  }

  /** Worker live: sincroniza todos los partidos en vivo del mundial */
  static async syncLivePipeline(): Promise<number> {
    resetEventIdentityCaches();
    const liveMatches = await this.syncLiveMatches();
    if (liveMatches.length === 0) return 0;

    await supabase.from('matches').upsert(liveMatches, { onConflict: 'provider,provider_match_id' });

    let processed = 0;
    for (const m of liveMatches) {
      const matchUuid = await getMatchUuidByProviderId(m.provider_match_id);
      if (!matchUuid) continue;
      await this.syncLiveMatchBundle(m.provider_match_id, matchUuid);
      processed++;
      await new Promise((r) => setTimeout(r, 500));
    }
    return processed;
  }

  private static extractGroup(round: string): string | null {
    // "Group Stage - A" / "Group A" -> "A"
    const m = round.match(/group\s*(?:stage)?\s*-?\s*([A-L])/i);
    return m ? m[1].toUpperCase() : null;
  }

  private static mapStatus(shortStatus: string): Match['status'] {
    const statusMap: Record<string, Match['status']> = {
      '1H': 'live', '2H': 'live', 'ET': 'live', 'P': 'live', 'LIVE': 'live',
      'HT': 'halftime', 'FT': 'finished', 'AET': 'finished', 'PEN': 'finished',
      'NS': 'scheduled', 'TBD': 'scheduled', 'PST': 'postponed', 'CANC': 'cancelled',
    };
    return statusMap[shortStatus] || 'scheduled';
  }

  /** Enriquece photo_url en jugadores existentes desde squads API-Football. */
  static async syncPlayerPhotos(): Promise<number> {
    if (!this.isConfigured()) return 0;
    const players = await this.syncAllSquads();
    if (players.length === 0) return 0;

    const playerMap = await getPlayerUuidMap();
    let updated = 0;

    for (const p of players) {
      if (!p.photo_url) continue;

      const providerId = p.provider_player_id ? String(p.provider_player_id) : null;
      const playerUuid = providerId ? playerMap.get(providerId) : null;

      if (playerUuid) {
        const { error } = await supabase
          .from('players')
          .update({ photo_url: p.photo_url, updated_at: new Date().toISOString() })
          .eq('id', playerUuid);
        if (!error) updated += 1;
        continue;
      }

      if (!p.team_id || !p.name) continue;
      const { error } = await supabase
        .from('players')
        .update({ photo_url: p.photo_url, updated_at: new Date().toISOString() })
        .eq('team_id', p.team_id)
        .eq('name', p.name);
      if (!error) updated += 1;
    }

    return updated;
  }

  static syncPlayerStats = ApiFootballProvider.syncFixturePlayerStats;
  static syncLiveEvents = ApiFootballProvider.syncMatchEvents;
  static syncLivePlayerStatus = ApiFootballProvider.syncFixturePlayerStats;
}
