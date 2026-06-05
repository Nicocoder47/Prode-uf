// sofascore.scraper.ts
// Controlled scraping template using Playwright to extract live ratings and advanced stats

import { chromium, Browser } from 'playwright'
import Redis from 'ioredis'
import pRetry from 'p-retry'

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379')

export class SofascoreScraper {
  browser: Browser | null = null

  async init() {
    if (this.browser) return
    this.browser = await chromium.launch({ headless: true })
  }

  async close() {
    if (!this.browser) return
    await this.browser.close()
    this.browser = null
  }

  async fetchMatchRatings(matchUrl: string) {
    await this.init()
    const page = await this.browser!.newPage({ userAgent: this.randomUA() })
    await page.setViewportSize({ width: 1200, height: 900 })

    const op = async () => {
      await page.goto(matchUrl, { waitUntil: 'networkidle' })
      // wait for ratings panel
      await page.waitForSelector('[data-test=player-rating]', { timeout: 8000 }).catch(() => {})
      // basic extraction example
      const data = await page.evaluate(() => {
        const players = Array.from(document.querySelectorAll('[data-test=player-rating]'))
        return players.map(p => ({ name: p.querySelector('.name')?.textContent?.trim(), rating: p.querySelector('.rating')?.textContent?.trim() }))
      })
      return data
    }

    const result = await pRetry(op, { retries: 2 })
    await page.close()
    return result
  }

  randomUA() {
    const uas = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.90 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15'
    ]
    return uas[Math.floor(Math.random() * uas.length)]
  }
}

export default new SofascoreScraper()
