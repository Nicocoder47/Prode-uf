// sofascore-scraper.ts
// Controlled Playwright scraper for Sofascore (no public API).
// Usage: run as worker in isolated container with rotating proxies and user-agents.

import { chromium, Browser } from 'playwright'
import Redis from 'ioredis'
import { liveQueue } from '../queues/bullmq'
import pRetry from 'p-retry'

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379')

async function launchBrowser(proxy?: string): Promise<Browser> {
  const launchOptions: any = { headless: true }
  if (proxy) launchOptions.proxy = { server: proxy }
  return chromium.launch(launchOptions)
}

function getRandomUA() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
  ]
  return agents[Math.floor(Math.random() * agents.length)]
}

export async function scrapeMatchRatings(sofascoreMatchUrl: string) {
  const proxy = process.env.SCRAPER_PROXY // optional
  return pRetry(async () => {
    const browser = await launchBrowser(proxy)
    const context = await browser.newContext({ userAgent: getRandomUA() })
    const page = await context.newPage()

    try {
      await page.goto(sofascoreMatchUrl, { waitUntil: 'networkidle' })
      // Example: extract player ratings table
      const ratings = await page.$$eval('.sc-PlayerList .player', nodes => nodes.map(n => {
        // parser depends on Sofascore structure; keep defensive
        const name = (n.querySelector('.player-name')?.textContent || '').trim()
        const rating = parseFloat((n.querySelector('.rating')?.textContent || '0').trim()) || 0
        const idMatch = (n.getAttribute('data-player-id') || '').toString()
        return { name, rating, idMatch }
      }))

      await browser.close()
      return ratings
    } catch (err) {
      await browser.close()
      throw err
    }
  }, { retries: 3 })
}

// Worker entry: accept job with { sofascoreMatchUrl, matchId }
if (require.main === module) {
  const processJob = async (job: any) => {
    const { sofascoreMatchUrl, matchId } = job.data
    console.log('scraping sofascore for', sofascoreMatchUrl)
    try {
      const ratings = await scrapeMatchRatings(sofascoreMatchUrl)
      // push to Redis or DB
      await redis.publish('live:events', JSON.stringify({ room: `match:${matchId}`, event: { type: 'player:rating:update', payload: ratings } }))
      return { ok: true }
    } catch (err) {
      console.error('sofascore scraper failed', err)
      throw err
    }
  }

  // Simple local runner: read from env JOB_PAYLOAD as JSON
  const payload = process.env.JOB_PAYLOAD && JSON.parse(process.env.JOB_PAYLOAD as string)
  if (payload) processJob({ data: payload }).then(() => process.exit(0)).catch(() => process.exit(1))
}
