import { supabase } from '../supabase'
import type {
  Bounty,
  BountyWithPoster,
  CreateBountyData,
  BountyServiceResponse,
  BountyStatus,
  BountyDifficulty,
} from '@/types/bounty.types'

/**
 * Bounty Service
 * Manages operations related to the bounty board
 */
export class BountyService {
  private readonly bountiesTable = 'bounties'

  /**
   * Fetches available (open) bounties
   * @param limit - Maximum number of bounties to return
   * @param offset - Offset for pagination
   * @param categoryId - Optional category filter
   * @param difficultyLevel - Optional difficulty filter
   * @returns Array of bounties with poster info or an error
   */
  async getAvailableBounties(
    limit: number = 20,
    offset: number = 0,
    categoryId?: string | null,
    difficultyLevel?: BountyDifficulty | null
  ): Promise<BountyServiceResponse<BountyWithPoster[]>> {
    try {
      const { data, error } = await supabase.rpc('get_available_bounties', {
        p_limit: limit,
        p_offset: offset,
        p_category_id: categoryId || null,
        p_difficulty_level: difficultyLevel || null,
      } as any)

      if (error) {
        return { data: null, error: new Error(error.message) }
      }
      return { data: (data || []) as BountyWithPoster[], error: null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }

  /**
   * Fetches bounties created by a specific user
   * @param userId - The auth.users.id of the user
   * @returns Array of bounties or an error
   */
  async getUserBounties(
    userId: string
  ): Promise<BountyServiceResponse<Bounty[]>> {
    try {
      const { data, error } = await supabase
        .from(this.bountiesTable)
        .select('*')
        .eq('poster_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        return { data: null, error: new Error(error.message) }
      }
      return { data: (data || []) as Bounty[], error: null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }

  /**
   * Fetches bounties claimed by a specific user
   * @param userId - The auth.users.id of the user (Level 3+)
   * @returns Array of bounties or an error
   */
  async getClaimedBounties(
    userId: string
  ): Promise<BountyServiceResponse<Bounty[]>> {
    try {
      const { data, error } = await supabase
        .from(this.bountiesTable)
        .select('*')
        .eq('claimer_id', userId)
        .order('claimed_at', { ascending: false })

      if (error) {
        return { data: null, error: new Error(error.message) }
      }
      return { data: (data || []) as Bounty[], error: null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }

  /**
   * Creates a new bounty
   * Automatically reserves credits and creates a credit transaction
   * @param bountyData - Bounty creation data
   * @returns The ID of the created bounty or an error
   */
  async createBounty(
    bountyData: CreateBountyData
  ): Promise<BountyServiceResponse<string>> {
    try {
      const { data, error } = await supabase.rpc('create_bounty', {
        p_title: bountyData.title,
        p_description: bountyData.description,
        p_credits_offered: bountyData.credits_offered,
        p_category_id: bountyData.category_id || null,
        p_skill_tags: bountyData.skill_tags || [],
        p_difficulty_level: bountyData.difficulty_level || null,
        p_expires_at: bountyData.expires_at || null,
      } as any)

      if (error) {
        return { data: null, error: new Error(error.message) }
      }
      return { data: data as string, error: null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }

  /**
   * Claims a bounty (Level 3+ users only)
   * Creates a skill session and links it to the bounty
   * @param bountyId - The ID of the bounty to claim
   * @returns The ID of the created skill session or an error
   */
  async claimBounty(bountyId: string): Promise<BountyServiceResponse<string>> {
    try {
      const { data, error } = await supabase.rpc('claim_bounty', {
        p_bounty_id: bountyId,
      } as any)

      if (error) {
        return { data: null, error: new Error(error.message) }
      }
      return { data: data as string, error: null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }

  /**
   * Cancels a bounty (only poster can cancel)
   * Refunds reserved credits if bounty was open
   * @param bountyId - The ID of the bounty to cancel
   * @returns True if successful, false otherwise
   */
  async cancelBounty(bountyId: string): Promise<BountyServiceResponse<boolean>> {
    try {
      const { data, error } = await supabase.rpc('cancel_bounty', {
        p_bounty_id: bountyId,
      } as any)

      if (error) {
        return { data: null, error: new Error(error.message) }
      }
      return { data: data as boolean, error: null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
      }
    }
  }
}

// Export singleton instance
export const bountyService = new BountyService()
