/**
 * API Football Provider
 * Syncs match data from API-Football (formerly Football-Data.org API)
 * Primary source for: fixtures, live matches, lineups, statistics
 */

import { BaseProvider, DataSyncResult, SyncError, ProviderConfig } from '../base.provider';
import { PrismaClient } from '@prisma/client';

interface ApiFootballMatch {
  id: number;
  utcDate: string;
  status: string;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  score: {
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
}

interface ApiFootballLineup {
  matchId: number;
  teamId: number;
  formation: string;
  startXI: Array<{
    player: { id: number; name: string; position: string };
  }>;
  bench: Array<{
    player: { id: number; name: string; position: string };
  }>;
}

interface ApiFootballEvent {
  id: number;
  minute: number;
  type: string;
  team: { id: number; name: string };
  player: { id: number; name: string };
  assist?: { id: number; name: string };
}

export class ApiFootballProvider extends BaseProvider {
  private prisma: PrismaClient;

  constructor(config: ProviderConfig, prisma: PrismaClient) {
    super('API-Football', config);
    this.prisma = prisma;
  }

  /**
   * Sync fixtures for World Cup 2026
   */
  async syncFixtures(): Promise<DataSyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let created = 0;
    let updated = 0;

    try {
      const fixtures = await this.retry(() => this.fetchFixtures());

      for (const fixture of fixtures) {
        try {
          const homeTeam = await this.findTeamByProviderData(
            fixture.homeTeam.id
          );
          const awayTeam = await this.findTeamByProviderData(
            fixture.awayTeam.id
          );

          if (!homeTeam || !awayTeam) {
            errors.push({
              code: 'TEAM_NOT_FOUND',
              message: `Team not found for fixture ${fixture.id}`,
            });
            continue;
          }

          const existingMatch = await this.prisma.match.findFirst({
            where: {
              providerName: this.name,
              providerMatchId: String(fixture.id),
            },
          });

          const status = this.normalizeMatchStatus(fixture.status);

          if (existingMatch) {
            await this.prisma.match.update({
              where: { id: existingMatch.id },
              data: {
                status,
                homeScore: fixture.score.fullTime.home,
                awayScore: fixture.score.fullTime.away,
                updatedAt: new Date(),
              },
            });
            updated++;
          } else {
            await this.prisma.match.create({
              data: {
                providerName: this.name,
                providerMatchId: String(fixture.id),
                homeTeamId: homeTeam.id,
                awayTeamId: awayTeam.id,
                kickoff: new Date(fixture.utcDate),
                status,
                homeScore: fixture.score.fullTime.home,
                awayScore: fixture.score.fullTime.away,
              },
            });
            created++;
          }
        } catch (error) {
          errors.push({
            code: 'FIXTURE_SYNC_ERROR',
            message: `Failed to sync fixture ${fixture.id}`,
            details: error,
          });
        }
      }

      await this.logDataSyncLog(
        'fixtures',
        fixtures.length,
        created + updated,
        'SUCCESS'
      );

      return {
        success: true,
        provider: this.name,
        entity: 'fixtures',
        recordsProcessed: fixtures.length,
        recordsCreated: created,
        recordsUpdated: updated,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const syncError: SyncError = {
        code: 'FETCH_FIXTURES_ERROR',
        message: 'Failed to fetch fixtures from API-Football',
        details: error,
      };
      errors.push(syncError);

      return {
        success: false,
        provider: this.name,
        entity: 'fixtures',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Sync lineups for a match
   */
  async syncLineups(matchId: string): Promise<DataSyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let created = 0;

    try {
      const match = await this.prisma.match.findUnique({
        where: { id: matchId },
        include: { homeTeam: true, awayTeam: true },
      });

      if (!match) {
        throw new Error(`Match ${matchId} not found`);
      }

      const lineups = await this.retry(() =>
        this.fetchLineups(match.providerMatchId || matchId)
      );

      for (const lineup of lineups) {
        try {
          const team =
            lineup.teamId === match.homeTeam?.providerTeamId
              ? match.homeTeam
              : match.awayTeam;

          if (!team) {
            errors.push({
              code: 'TEAM_NOT_FOUND',
              message: `Team ${lineup.teamId} not found for lineup`,
            });
            continue;
          }

          await this.prisma.lineup.create({
            data: {
              matchId: match.id,
              teamId: team.id,
              formation: lineup.formation,
              players: lineup.startXI,
              bench: lineup.bench,
            },
          });
          created++;
        } catch (error) {
          errors.push({
            code: 'LINEUP_SYNC_ERROR',
            message: `Failed to sync lineup for team ${lineup.teamId}`,
            details: error,
          });
        }
      }

      await this.logDataSyncLog(
        'lineups',
        lineups.length,
        created,
        'SUCCESS'
      );

      return {
        success: true,
        provider: this.name,
        entity: 'lineups',
        recordsProcessed: lineups.length,
        recordsCreated: created,
        recordsUpdated: 0,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const syncError: SyncError = {
        code: 'FETCH_LINEUPS_ERROR',
        message: `Failed to fetch lineups for match ${matchId}`,
        details: error,
      };
      errors.push(syncError);

      return {
        success: false,
        provider: this.name,
        entity: 'lineups',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Sync match events
   */
  async syncMatchEvents(matchId: string): Promise<DataSyncResult> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    let created = 0;

    try {
      const match = await this.prisma.match.findUnique({
        where: { id: matchId },
      });

      if (!match) {
        throw new Error(`Match ${matchId} not found`);
      }

      const events = await this.retry(() =>
        this.fetchMatchEvents(match.providerMatchId || matchId)
      );

      for (const event of events) {
        try {
          await this.prisma.matchEvent.create({
            data: {
              matchId,
              minute: event.minute,
              type: event.type,
              teamId: event.team.id,
              playerId: String(event.player.id),
              assistId: event.assist ? String(event.assist.id) : null,
              data: {
                playerName: event.player.name,
                teamName: event.team.name,
                assistName: event.assist?.name,
              },
            },
          });
          created++;
        } catch (error) {
          errors.push({
            code: 'EVENT_SYNC_ERROR',
            message: `Failed to sync event ${event.id}`,
            details: error,
          });
        }
      }

      await this.logDataSyncLog(
        'match_events',
        events.length,
        created,
        'SUCCESS'
      );

      return {
        success: true,
        provider: this.name,
        entity: 'match_events',
        recordsProcessed: events.length,
        recordsCreated: created,
        recordsUpdated: 0,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const syncError: SyncError = {
        code: 'FETCH_EVENTS_ERROR',
        message: `Failed to fetch events for match ${matchId}`,
        details: error,
      };
      errors.push(syncError);

      return {
        success: false,
        provider: this.name,
        entity: 'match_events',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Protected methods
   */

  protected async fetchFixtures(): Promise<ApiFootballMatch[]> {
    const response = await fetch(
      `${this.config.baseUrl}/competitions/WC/matches?status=SCHEDULED,LIVE,FINISHED`,
      {
        headers: {
          'X-Auth-Token': this.config.apiKey,
        },
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      }
    );

    if (!response.ok) {
      throw new Error(`API-Football error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.matches || [];
  }

  protected async fetchLineups(
    matchId: string
  ): Promise<ApiFootballLineup[]> {
    const response = await fetch(
      `${this.config.baseUrl}/matches/${matchId}`,
      {
        headers: {
          'X-Auth-Token': this.config.apiKey,
        },
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      }
    );

    if (!response.ok) {
      throw new Error(`API-Football error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.lineups || [];
  }

  protected async fetchMatchEvents(matchId: string): Promise<ApiFootballEvent[]> {
    const response = await fetch(
      `${this.config.baseUrl}/matches/${matchId}`,
      {
        headers: {
          'X-Auth-Token': this.config.apiKey,
        },
        signal: AbortSignal.timeout(this.config.timeout || 30000),
      }
    );

    if (!response.ok) {
      throw new Error(`API-Football error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.events || [];
  }

  protected normalizeData(data: any): any {
    return data;
  }

  protected validateData(data: any): boolean {
    return !!(data && data.id);
  }

  /**
   * Helper methods
   */

  private async findTeamByProviderData(providerId: number): Promise<any> {
    return this.prisma.team.findFirst({
      where: {
        OR: [
          {
            providerTeamId: String(providerId),
          },
          {
            providerTeamId: String(providerId).padStart(6, '0'),
          },
        ],
      },
    });
  }

  private normalizeMatchStatus(status: string): string {
    const statusMap: { [key: string]: string } = {
      SCHEDULED: 'SCHEDULED',
      LIVE: 'LIVE',
      IN_PLAY: 'LIVE',
      PAUSED: 'LIVE',
      FINISHED: 'FINISHED',
      POSTPONED: 'POSTPONED',
      CANCELLED: 'CANCELLED',
      SUSPENDED: 'POSTPONED',
    };
    return statusMap[status] || 'SCHEDULED';
  }

  private async logDataSyncLog(
    entity: string,
    recordsProcessed: number,
    recordsAffected: number,
    status: string,
    message?: string
  ): Promise<void> {
    try {
      await this.prisma.dataSyncLog.create({
        data: {
          provider: this.name,
          entity,
          status,
          message: message || `Processed ${recordsProcessed} records, affected ${recordsAffected}`,
        },
      });
    } catch (error) {
      console.error('Failed to log sync operation:', error);
    }
  }
}
