import { supabase } from '../supabase'
import type {
  UserLevel,
  LevelProgress,
  UserOnboardingProgress,
  LearningResource,
  AvailableResourcesResponse,
  ResourceProgress,
  CuratedLearningPath,
  ResourceCategory,
} from '@/types/growth.types'

/**
 * Growth Service - Manages user levels, onboarding, and learning resources
 */
export class GrowthService {
  /**
   * Get user's current level
   */
  async getUserLevel(userId: string): Promise<{ level: UserLevel } | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('level')
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data as { level: UserLevel } | null
  }

  /**
   * Calculate and update user level based on progress
   */
  async updateUserLevel(userId: string): Promise<UserLevel> {
    const { data, error } = await supabase.rpc('update_user_level', {
      p_user_id: userId,
    } as any)

    if (error) throw error
    return data as UserLevel
  }

  /**
   * Get user's level progress toward next level
   */
  async getLevelProgress(userId: string): Promise<LevelProgress> {
    const { data, error } = await supabase.rpc('get_level_progress', {
      p_user_id: userId,
    } as any)

    if (error) throw error
    return data as LevelProgress
  }

  /**
   * Check if user has a specific level permission
   */
  async checkPermission(
    userId: string,
    permission: string
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_level_permission', {
      p_user_id: userId,
      p_permission: permission,
    } as any)

    if (error) throw error
    return data as boolean
  }

  /**
   * Complete an onboarding step
   */
  async completeOnboardingStep(
    userId: string,
    stepKey: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const { data, error } = await supabase.rpc('complete_onboarding_step', {
      p_user_id: userId,
      p_step_key: stepKey,
      p_metadata: metadata || {},
    } as any)

    if (error) throw error
    return data as string
  }

  /**
   * Get user's onboarding progress
   */
  async getOnboardingProgress(userId: string): Promise<UserOnboardingProgress> {
    const { data, error } = await supabase.rpc('get_user_onboarding_progress', {
      p_user_id: userId,
    } as any)

    if (error) throw error
    return data as UserOnboardingProgress
  }

  /**
   * Get available learning resources for user
   */
  async getAvailableResources(
    userId: string,
    options?: {
      categoryId?: string
      resourceType?: string
      limit?: number
      offset?: number
    }
  ): Promise<AvailableResourcesResponse> {
    const { data, error } = await supabase.rpc('get_available_resources', {
      p_user_id: userId,
      p_category_id: options?.categoryId || null,
      p_resource_type: options?.resourceType || null,
      p_limit: options?.limit || 20,
      p_offset: options?.offset || 0,
    } as any)

    if (error) throw error
    return data as AvailableResourcesResponse
  }

  /**
   * Update resource progress
   */
  async updateResourceProgress(
    userId: string,
    resourceId: string,
    progressPercentage: number,
    status: 'started' | 'in_progress' | 'completed' | 'skipped' = 'in_progress'
  ): Promise<string> {
    const { data, error } = await supabase.rpc('update_resource_progress', {
      p_user_id: userId,
      p_resource_id: resourceId,
      p_progress_percentage: progressPercentage,
      p_status: status,
    } as any)

    if (error) throw error
    return data as string
  }

  /**
   * Increment resource view count
   */
  async incrementResourceViews(resourceId: string): Promise<number> {
    const { data, error } = await supabase.rpc('increment_resource_views', {
      p_resource_id: resourceId,
    } as any)

    if (error) throw error
    return data as number
  }

  /**
   * Get resource categories
   */
  async getResourceCategories(): Promise<ResourceCategory[]> {
    const { data, error } = await supabase
      .from('resource_categories')
      .select('*')
      .order('order_index', { ascending: true })

    if (error) throw error
    return (data || []) as ResourceCategory[]
  }

  /**
   * Get curated learning paths
   */
  async getCuratedPaths(
    userId?: string,
    onlyPublished: boolean = true
  ): Promise<CuratedLearningPath[]> {
    let query = supabase.from('curated_learning_paths').select('*')

    if (onlyPublished) {
      query = query.eq('is_published', true)
    } else if (userId) {
      // Show published or user's own paths
      query = query.or(`is_published.eq.true,created_by.eq.${userId}`)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return (data || []) as CuratedLearningPath[]
  }

  /**
   * Start a learning path
   */
  async startLearningPath(userId: string, pathId: string): Promise<string> {
    const { data, error } = await supabase.rpc('start_learning_path', {
      p_user_id: userId,
      p_path_id: pathId,
    } as any)

    if (error) throw error
    return data as string
  }
}

// Export singleton instance
export const growthService = new GrowthService()
