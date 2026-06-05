import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider, QueryErrorResetBoundary } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      retryOnMount: false,
    },
  },
})

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  return createElement(
    QueryErrorResetBoundary,
    null,
    createElement(QueryClientProvider, { client: queryClient }, children),
  )
}
