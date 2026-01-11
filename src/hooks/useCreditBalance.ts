import { useQuery } from '@tanstack/react-query'
import { creditService } from '@/lib/services/creditService'
import type { CreditBalance } from '@/types/credit.types'

/**
 * Hook to fetch user credit balance
 * Returns { total, available, reserved }
 */
export function useCreditBalance(userId: string | null | undefined) {
  return useQuery<CreditBalance, Error>({
    queryKey: ['credit-balance', userId],
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required')
      }

      const { data, error } = await creditService.getBalance(userId)

      if (error || !data) {
        throw error || new Error('Failed to fetch credit balance')
      }

      return data
    },
    enabled: !!userId,
    staleTime: 1000 * 30, // 30 seconds - balance changes frequently
    refetchInterval: 1000 * 60, // Refetch every minute
  })
}
