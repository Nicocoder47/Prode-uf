// bullmq.ts - BullMQ connection helpers
import { Queue, Worker, QueueScheduler } from 'bullmq'
import IORedis from 'ioredis'

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379')

export const queueOptions = { connection }

export const liveQueue = new Queue('live', queueOptions)
export const liveScheduler = new QueueScheduler('live', queueOptions)

export function createWorker(name: string, processor: any) {
  return new Worker(name, processor, { connection })
}

export default { connection, liveQueue, createWorker }
