import { supabase } from '../supabase'
import { handleSkillExchange, type SkillExchangeResponse } from './creditExchange'
import type { SkillWithTeacher, Skill, SkillStatus, SkillLevel } from '@/types/skill.types'

/**
 * Response type for fetchSkills
 */
export interface FetchSkillsResponse {
  data: SkillWithTeacher[]
  error: Error | null
}

/**
 * Response type for requestExchange
 */
export interface RequestExchangeResponse {
  success: boolean
  learner_id: string
  teacher_id: string
  learner_new_credits?: number
  teacher_new_credits?: number
  message?: string
  error?: string
}

/**
 * Filters for fetching skills
 */
export interface SkillFilters {
  category?: string
  level?: SkillLevel
  status?: SkillStatus
  userId?: string
}

/**
 * TypeScript service for skills operations
 * Handles fetching skills with teacher profile data and skill exchanges
 */
export class SkillsService {
  private readonly skillsTable = 'skills'
  private readonly profilesTable = 'profiles'

  /**
   * Fetch skills with teacher profile information
   * Joins skills table with profiles table to get teacher details
   * 
   * @param filters - Optional filters to apply to the query
   * @returns Promise with skills array including teacher profile data
   */
  async fetchSkills(filters?: SkillFilters): Promise<FetchSkillsResponse> {
    try {
      // Build the query with join to profiles table
      // Using user_id to join profiles table
      let query = supabase
        .from(this.skillsTable)
        .select(`
          *,
          profiles!skills_user_id_fkey (
            user_id,
            username,
            full_name,
            avatar_url,
            bio,
            credits
          )
        `)
        .order('created_at', { ascending: false })

      // Apply optional filters
      if (filters?.category) {
        query = query.eq('category', filters.category)
      }

      if (filters?.level) {
        query = query.eq('level', filters.level)
      }

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId)
      }

      const { data, error } = await query

      if (error) {
        return {
          data: [],
          error: new Error(`Failed to fetch skills: ${error.message}`),
        }
      }

      // Transform the data to match SkillWithTeacher interface
      const skillsWithTeacher: SkillWithTeacher[] = (data || []).map((skill: any) => {
        // Handle both 'profiles' and 'teacher_profile' response formats
        const profileData = skill.profiles || skill.teacher_profile || null

        return {
          id: skill.id,
          user_id: skill.user_id,
          name: skill.name,
          description: skill.description,
          category: skill.category,
          level: skill.level,
          status: skill.status,
          credits_required: skill.credits_required,
          requests_count: skill.requests_count,
          created_at: skill.created_at,
          updated_at: skill.updated_at,
          teacher_profile: profileData
            ? {
              user_id: profileData.user_id,
              username: profileData.username,
              full_name: profileData.full_name,
              avatar_url: profileData.avatar_url,
              bio: profileData.bio,
              credits: profileData.credits,
            }
            : null,
        }
      })

      return {
        data: skillsWithTeacher,
        error: null,
      }
    } catch (error) {
      return {
        data: [],
        error: error instanceof Error
          ? error
          : new Error('Unknown error occurred while fetching skills'),
      }
    }
  }

  /**
   * Request a skill exchange between learner and teacher
   * Calls the handle_skill_exchange RPC function
   * 
   * @param learnerId - UUID of the learner (will lose 1 credit)
   * @param teacherId - UUID of the teacher (will gain 1 credit)
   * @returns Promise with exchange response including updated credit balances
   */
  async requestExchange(
    learnerId: string,
    teacherId: string
  ): Promise<RequestExchangeResponse> {
    try {
      // Validate inputs
      if (!learnerId || !teacherId) {
        return {
          success: false,
          learner_id: learnerId,
          teacher_id: teacherId,
          error: 'Learner ID and Teacher ID are required',
        }
      }

      if (learnerId === teacherId) {
        return {
          success: false,
          learner_id: learnerId,
          teacher_id: teacherId,
          error: 'Cannot exchange credits with yourself',
        }
      }

      // Call the RPC function
      const result: SkillExchangeResponse = await handleSkillExchange(
        learnerId,
        teacherId
      )

      return {
        success: result.success,
        learner_id: result.learner_id,
        teacher_id: result.teacher_id,
        learner_new_credits: result.learner_new_credits,
        teacher_new_credits: result.teacher_new_credits,
        message: result.message,
        error: result.error,
      }
    } catch (error) {
      return {
        success: false,
        learner_id: learnerId,
        teacher_id: teacherId,
        error: error instanceof Error
          ? error.message
          : 'Failed to request skill exchange',
      }
    }
  }

  /**
   * Fetch a single skill by ID with teacher profile
   * 
   * @param skillId - UUID of the skill to fetch
   * @returns Promise with skill data including teacher profile
   */
  async fetchSkillById(skillId: string): Promise<{
    data: SkillWithTeacher | null
    error: Error | null
  }> {
    try {
      const { data, error } = await supabase
        .from(this.skillsTable)
        .select(`
          *,
          profiles!skills_user_id_fkey (
            user_id,
            username,
            full_name,
            avatar_url,
            bio,
            credits
          )
        `)
        .eq('id', skillId)
        .single()

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to fetch skill: ${error.message}`),
        }
      }

      // Handle both 'profiles' and 'teacher_profile' response formats
      const profileData = (data as any).profiles || (data as any).teacher_profile || null

      // Transform the data to match SkillWithTeacher interface
      const skillWithTeacher: SkillWithTeacher = {
        id: data.id,
        user_id: data.user_id,
        name: data.name,
        description: data.description,
        category: data.category,
        level: data.level,
        status: data.status,
        credits_required: data.credits_required,
        requests_count: data.requests_count,
        created_at: data.created_at,
        updated_at: data.updated_at,
        teacher_profile: profileData
          ? {
            user_id: profileData.user_id,
            username: profileData.username,
            full_name: profileData.full_name,
            avatar_url: profileData.avatar_url,
            bio: profileData.bio,
            credits: profileData.credits,
          }
          : null,
      }

      return {
        data: skillWithTeacher,
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error
          ? error
          : new Error('Unknown error occurred while fetching skill'),
      }
    }
  }
}

// Export a singleton instance for convenience
export const skillsService = new SkillsService()

// Export convenience functions that use the singleton
export const fetchSkills = (filters?: SkillFilters) =>
  skillsService.fetchSkills(filters)

export const requestExchange = (learnerId: string, teacherId: string) =>
  skillsService.requestExchange(learnerId, teacherId)

export const fetchSkillById = (skillId: string) =>
  skillsService.fetchSkillById(skillId)
