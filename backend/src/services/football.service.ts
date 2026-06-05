// football.service.ts
// Service responsible for talking to API-Football and providing canonical data

import Redis from 'ioredis'
import got from 'got'
import pRetry from 'p-retry'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

export class FootballService {
  apiBase = process.env.API_FOOTBALL_BASE || 'https://v3.football.api-sports.io'
  apiKey = process.env.API_FOOTBALL_KEY

  constructor(private http = got.extend({ responseType: 'json' })) {}

  // Cached fetch with retry and rate-limit handling
  async fetch(path: string, qs: Record<string, any> = {}) {
    const cacheKey = `api-football:${path}:${JSON.stringify(qs)}`
    const cached = await redis.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const op = async () => {
      const res: any = await this.http(`${this.apiBase}${path}`, {
        headers: { 'x-apisports-key': this.apiKey },
        searchParams: qs,
        timeout: 10000,
      })
      if (res.statusCode && res.statusCode >= 500) throw new Error('server error')
      return res.body
    }

    const body = await pRetry(op, { retries: 3 })
    // cache short lived (30s) for live endpoints, longer for fixtures
    const ttl = path.includes('/fixtures') ? 60 * 5 : 30
    await redis.set(cacheKey, JSON.stringify(body), 'EX', ttl)
    return body
  }

  async getFixturesByCompetition(competitionId: number, season?: string) {
    const qs: any = { league: competitionId }
    if (season) qs.season = season
    return this.fetch('/leagues', qs)
  }

  async getMatchesByDate(dateStr: string) {
    return this.fetch('/fixtures', { date: dateStr })
  }

  async getMatchEvents(providerMatchId: number) {
    return this.fetch('/fixtures/events', { fixture: providerMatchId })
  }

  // More helpers: teams, players, lineups, standings
}

export default new FootballService()
