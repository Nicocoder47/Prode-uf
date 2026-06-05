// live-worker.ts
// Worker that runs per-live-match, polls providers and publishes events
import { createWorker, liveQueue } from '../queues/bullmq'
import footballService from '../services/football.service'
import Redis from 'ioredis'
import { ioPublish } from '../socket/socket-publish'

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379')

// Processor for BullMQ
export async function liveProcessor(job: any) {
  const { matchId, providerMatchId } = job.data
  console.log('live-worker processing', matchId)

  // polling loop: fetch summary + events
  try {
    const events = await footballService.getMatchEvents(providerMatchId)
    // normalize events to canonical shape (example)
    const normalized = events.response || events
    // persist to DB (PRISMA calls here)
    // emit via socket publish
    await ioPublish(`match:${matchId}`, { type: 'match:update', payload: normalized })

    // schedule next poll (we rely on Bull repeat or re-add)
    return { ok: true }
  } catch (err) {
    console.error('live worker error', err)
    throw err
  }
}

// bootstrap a worker process
if (require.main === module) {
  createWorker('live', liveProcessor)
  console.log('live worker started')
}

export default liveProcessor
