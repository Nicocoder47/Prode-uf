// socket.gateway.ts - Node.js Socket.IO publisher (NestJS-like gateway sketch)
import { createServer } from 'http'
import { Server } from 'socket.io'
import Redis from 'ioredis'

const httpServer = createServer()
const io = new Server(httpServer, { cors: { origin: '*' } })

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379')
const sub = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379')

io.adapter(require('socket.io-redis')({ pubClient: redis, subClient: sub }))

io.on('connection', socket => {
  console.log('socket connected', socket.id)
  socket.on('join', (room) => socket.join(room))
  socket.on('leave', (room) => socket.leave(room))
})

// Subscribe to Redis channel for internal pubsub
sub.subscribe('live:events', (err) => {
  if (err) console.error('redis sub error', err)
})

sub.on('message', (channel, message) => {
  try {
    const parsed = JSON.parse(message)
    const { room, event } = parsed
    io.to(room).emit(event.type, event.payload)
  } catch (e) {
    console.error('failed to publish', e)
  }
})

export function ioPublish(room: string, event: any) {
  // publish to redis so all instances get it
  const payload = JSON.stringify({ room, event })
  return redis.publish('live:events', payload)
}

if (require.main === module) {
  const port = process.env.SOCKET_PORT || 4001
  httpServer.listen(port, () => console.log('Socket.IO server running on', port))
}

export { io }
