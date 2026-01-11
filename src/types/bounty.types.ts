/**
 * Bounty Board Types
 */

/**
 * Bounty status enum
 */
export type BountyStatus = 'open' | 'claimed' | 'in_progress' | 'completed' | 'cancelled'

/**
 * Difficulty level for bounties
 */
export type BountyDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'

/**
 * Bounty interface matching database schema
 */
export interface Bounty {
  id: string
  poster_id: string // auth.users.id
  claimer_id: string | null // auth.users.id (Level 3+)
  title: string
  description: string
  credits_offered: number
  category_id: string | null
  skill_tags: string[]
  status: BountyStatus
  difficulty_level: BountyDifficulty | null
  expires_at: string | null
  claimed_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  session_id: string | null
  created_at: string
  updated_at: string
}

/**
 * Bounty with denormalized data for display
 */
export interface BountyWithPoster extends Bounty {
  poster_name: string
  poster_avatar_url: string | null
  category_name: string | null
  time_remaining: string | null
}

/**
 * Data for creating a new bounty
 */
export interface CreateBountyData {
  title: string
  description: string
  credits_offered: number
  category_id?: string | null
  skill_tags?: string[]
  difficulty_level?: BountyDifficulty | null
  expires_at?: string | null
}

/**
 * Response type for bounty service operations
 */
export type BountyServiceResponse<T> = {
  data: T | null
  error: Error | null
}
