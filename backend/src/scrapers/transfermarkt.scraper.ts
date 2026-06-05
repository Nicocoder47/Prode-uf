// transfermarkt.scraper.ts
// Enterprise scraper template for Transfermarkt: nightly runs, proxy rotation, parser

import got from 'got'
import pRetry from 'p-retry'
import { JSDOM } from 'jsdom'

export async function fetchPlayerMarketData(url: string) {
  const op = async () => {
    const res = await got(url, { timeout: 15000 })
    const dom = new JSDOM(res.body)
    const doc = dom.window.document
    // Example selectors (subject to change):
    const name = doc.querySelector('h1')?.textContent?.trim() || ''
    const valueStr = doc.querySelector('.marktwert')?.textContent?.trim() || ''
    const value = parseMarketValue(valueStr)
    const data = { name, value, raw: { valueStr } }
    return data
  }
  return pRetry(op, { retries: 2 })
}

function parseMarketValue(s: string) {
  // simple parser: '€20.00m' -> 20000000
  try {
    const cleaned = s.replace(/[€,\s]/g, '').toLowerCase()
    if (cleaned.endsWith('m')) return Math.round(parseFloat(cleaned) * 1000000)
    if (cleaned.endsWith('k')) return Math.round(parseFloat(cleaned) * 1000)
    return Math.round(parseFloat(cleaned))
  } catch (e) {
    return 0
  }
}

export default { fetchPlayerMarketData }
