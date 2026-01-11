import type { UserLevel } from './growth.types'

/**
 * Profile interface representing a user profile in the database
 */
export interface Profile {
  id: string
  user_id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  credits: number
  level: UserLevel
  level_progress: Record<string, any> | null
  level_unlocked_at: string | null
  reputation_score: number
  total_reviews: number
  completed_sessions: number
  created_at: string
  updated_at: string
}

/**
 * Update profile data structure
 */
export interface UpdateProfileData {
  username?: string | null
  full_name?: string | null
  avatar_url?: string | null
  bio?: string | null
}
