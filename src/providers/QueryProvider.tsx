import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { toast } from 'sonner'

// Create a client with default options and global error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 10, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
      onError: (error) => {
        // Global error handler for queries
        // Individual components can override this with their own error handling
        console.error('Query error:', error)
        // Don't show toast for every error - let components handle their own errors
      },
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        // Global error handler for mutations
        console.error('Mutation error:', error)
        // Show toast for mutation errors by default
        if (error instanceof Error) {
          toast.error(error.message || 'An error occurred')
        } else {
          toast.error('An unexpected error occurred')
        }
      },
    },
  },
})

interface QueryProviderProps {
  children: ReactNode
}

/**
 * React Query Provider for managing server state
 * Provides caching, loading states, and error handling
 */
export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
