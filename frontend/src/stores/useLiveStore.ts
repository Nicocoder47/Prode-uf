import create from 'zustand'

type LiveState = {
  matches: Record<string, any>
  subscribeMatch: (matchId: string) => void
  updateMatch: (matchId: string, patch: any) => void
}

export const useLiveStore = create<LiveState>((set, get) => ({
  matches: {},
  subscribeMatch: (matchId: string) => {
    // ensure match exists
    set(state => ({ matches: { ...state.matches, [matchId]: state.matches[matchId] || { events: [], snapshot: null } } }))
  },
  updateMatch: (matchId, patch) => {
    set(state => ({ matches: { ...state.matches, [matchId]: { ...(state.matches[matchId] || {}), ...patch } } }))
  }
}))
