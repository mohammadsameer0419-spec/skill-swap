/**
 * Matching Service - AI-Powered Skill Matching
 * 
 * Uses Supabase Edge Function to find semantic matches between
 * desired skills and available skills using OpenAI embeddings
 */

import { supabase } from '../supabase'
import type {
  MatchSkillsRequest,
  MatchSkillsResponse,
  MatchResponse,
} from '@/types/matching.types'

/**
 * Service class for AI-powered skill matching
 */
export class MatchingService {
  private readonly functionName = 'match-skills'

  /**
   * Find matching skills using AI semantic matching
   * 
   * @param request - Matching request with desired skills and filters
   * @returns Promise with matched skills and metadata
   */
  async findMatches(
    request: MatchSkillsRequest
  ): Promise<MatchResponse<MatchSkillsResponse>> {
    try {
      // Validate request
      if (!request.desired_skills || request.desired_skills.length === 0) {
        return {
          data: null,
          error: new Error('desired_skills array is required and cannot be empty'),
        }
      }

      // Call Supabase Edge Function
      const { data, error } = await supabase.functions.invoke(this.functionName, {
        body: {
          desired_skills: request.desired_skills,
          limit: request.limit || 5,
          filters: request.filters,
          user_id: request.user_id,
        },
      })

      if (error) {
        return {
          data: null,
          error: new Error(`Failed to match skills: ${error.message}`),
        }
      }

      return {
        data: data as MatchSkillsResponse,
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof Error
            ? error
            : new Error('Unknown error occurred while matching skills'),
      }
    }
  }

  /**
   * Find matches for a single desired skill
   * 
   * @param desiredSkill - Skill name or description
   * @param filters - Optional filters
   * @param limit - Number of matches to return
   * @returns Promise with matched skills
   */
  async findMatchesForSkill(
    desiredSkill: string,
    filters?: SkillMatchFilters,
    limit: number = 5
  ): Promise<MatchResponse<MatchSkillsResponse>> {
    return this.findMatches({
      desired_skills: [desiredSkill],
      filters,
      limit,
    })
  }
}

// Export singleton instance
export const matchingService = new MatchingService()

// Export convenience functions
export const findMatches = (request: MatchSkillsRequest) =>
  matchingService.findMatches(request)

export const findMatchesForSkill = (
  desiredSkill: string,
  filters?: SkillMatchFilters,
  limit?: number
) => matchingService.findMatchesForSkill(desiredSkill, filters, limit)
