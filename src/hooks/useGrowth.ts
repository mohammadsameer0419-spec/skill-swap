import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { growthService } from '@/lib/services/growthService'
import type {
  LevelProgress,
  UserOnboardingProgress,
  AvailableResourcesResponse,
  CuratedLearningPath,
  ResourceCategory,
} from '@/types/growth.types'

/**
 * Hook to get user's level progress
 */
export function useLevelProgress(userId: string | null | undefined) {
  return useQuery<LevelProgress, Error>({
    queryKey: ['level-progress', userId],
    queryFn: () => {
      if (!userId) throw new Error('User ID required')
      return growthService.getLevelProgress(userId)
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook to update user level
 */
export function useUpdateUserLevel() {
  const queryClient = useQueryClient()

  return useMutation<UserLevel, Error, string>({
    mutationFn: (userId: string) => growthService.updateUserLevel(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['level-progress', userId] })
      queryClient.invalidateQueries({ queryKey: ['profiles', userId] })
    },
  })
}

/**
 * Hook to check level permission
 */
export function useLevelPermission(userId: string | null | undefined, permission: string) {
  return useQuery<boolean, Error>({
    queryKey: ['level-permission', userId, permission],
    queryFn: () => {
      if (!userId) throw new Error('User ID required')
      return growthService.checkPermission(userId, permission)
    },
    enabled: !!userId && !!permission,
    staleTime: 1000 * 60 * 10, // 10 minutes
  })
}

/**
 * Hook to get onboarding progress
 */
export function useOnboardingProgress(userId: string | null | undefined) {
  return useQuery<UserOnboardingProgress, Error>({
    queryKey: ['onboarding-progress', userId],
    queryFn: () => {
      if (!userId) throw new Error('User ID required')
      return growthService.getOnboardingProgress(userId)
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

/**
 * Hook to complete onboarding step
 */
export function useCompleteOnboardingStep() {
  const queryClient = useQueryClient()

  return useMutation<string, Error, { userId: string; stepKey: string; metadata?: Record<string, any> }>({
    mutationFn: ({ userId, stepKey, metadata }) =>
      growthService.completeOnboardingStep(userId, stepKey, metadata),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress', userId] })
    },
  })
}

/**
 * Hook to get available resources
 */
export function useAvailableResources(
  userId: string | null | undefined,
  options?: {
    categoryId?: string
    resourceType?: string
    limit?: number
    offset?: number
  }
) {
  return useQuery<AvailableResourcesResponse, Error>({
    queryKey: ['available-resources', userId, options],
    queryFn: () => {
      if (!userId) throw new Error('User ID required')
      return growthService.getAvailableResources(userId, options)
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook to update resource progress
 */
export function useUpdateResourceProgress() {
  const queryClient = useQueryClient()

  return useMutation<
    string,
    Error,
    { userId: string; resourceId: string; progressPercentage: number; status?: string }
  >({
    mutationFn: ({ userId, resourceId, progressPercentage, status }) =>
      growthService.updateResourceProgress(userId, resourceId, progressPercentage, status as any),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['available-resources', userId] })
    },
  })
}

/**
 * Hook to get resource categories
 */
export function useResourceCategories() {
  return useQuery<ResourceCategory[], Error>({
    queryKey: ['resource-categories'],
    queryFn: () => growthService.getResourceCategories(),
    staleTime: 1000 * 60 * 30, // 30 minutes (categories change rarely)
  })
}

/**
 * Hook to get curated learning paths
 */
export function useCuratedPaths(userId: string | null | undefined, onlyPublished: boolean = true) {
  return useQuery<CuratedLearningPath[], Error>({
    queryKey: ['curated-paths', userId, onlyPublished],
    queryFn: () => growthService.getCuratedPaths(userId || undefined, onlyPublished),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  })
}
