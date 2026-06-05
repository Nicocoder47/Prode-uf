import { useEffect } from 'react'
import io from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { useLiveStore } from '../stores/useLiveStore'
import { queryKeys } from '../../src/lib/queryKeys'

export function useLiveMatch(matchId: string) {
  const queryClient = useQueryClient()
  const subscribeMatch = useLiveStore(s => s.subscribeMatch)
  const updateMatch = useLiveStore(s => s.updateMatch)

  useEffect(() => {
    if (!matchId) return
    subscribeMatch(matchId)

    const socketUrl = import.meta.env.VITE_SOCKET_IO_URL ?? 'http://localhost:4001'
    const socket = io(socketUrl)
    socket.emit('join', `match:${matchId}`)

    socket.on('match:update', payload => {
      updateMatch(matchId, { snapshot: payload })
      queryClient.invalidateQueries({ queryKey: queryKeys.match(matchId) })
    })

    socket.on('player:rating:update', payload => {
      updateMatch(matchId, { playerRatings: payload })
      queryClient.invalidateQueries({ queryKey: queryKeys.matchRatings(matchId) })
    })

    return () => {
      socket.emit('leave', `match:${matchId}`)
      socket.disconnect()
    }
  }, [matchId])
}
