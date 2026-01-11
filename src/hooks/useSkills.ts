import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { skillsService } from '@/lib/services/skillsService'
import type { SkillWithTeacher } from '@/types/skill.types'
import type { RequestExchangeResponse } from '@/lib/services/skillsService'

/**
 * React Query hook for skills operations
 * Provides fetching skills with teacher profiles and exchange functionality
 */
export const useSkills = () => {
  const queryClient = useQueryClient()

  // Fetching logic - gets skills with teacher profile data
  const skillsQuery = useQuery<SkillWithTeacher[], Error>({
    queryKey: ['skills'],
    queryFn: async () => {
      const result = await skillsService.fetchSkills()
      if (result.error) {
        throw result.error
      }
      return result.data
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  // Exchange logic with Optimistic Update
  const exchangeMutation = useMutation<
    RequestExchangeResponse,
    Error,
    { learnerId: string; teacherId: string }
  >({
    mutationFn: ({ learnerId, teacherId }) =>
      skillsService.requestExchange(learnerId, teacherId),
    onSuccess: () => {
      // Refresh the UI data automatically after a swap
      queryClient.invalidateQueries({ queryKey: ['skills'] })
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
  })

  return {
    skills: skillsQuery.data,
    isLoading: skillsQuery.isLoading,
    exchangeMutation,
  }
}
