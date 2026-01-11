/**
 * Types for Skill Growth & Resource Ecosystem
 */

/**
 * User level enum matching database
 */
export enum UserLevel {
  BEGINNER = 'beginner',
  LEARNER = 'learner',
  SKILLED = 'skilled',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

/**
 * Level requirements and benefits
 */
export interface LevelDefinition {
  level: UserLevel
  name: string
  requirements: {
    sessions: number
    rating: number
  }
  benefits: string[]
}

/**
 * Level progress information
 */
export interface LevelProgress {
  current_level: UserLevel
  next_level: UserLevel | null
  completed_sessions: number
  reputation_score: number
  sessions_needed: number
  rating_needed: number
  sessions_progress: number
  rating_progress: number
  progress_percentage: number
  is_max_level: boolean
}

/**
 * Onboarding step
 */
export interface OnboardingStep {
  step_key: string
  title: string
  description: string | null
  step_order: number
  is_required: boolean
  component_type: string | null
  metadata: Record<string, any>
  completed?: boolean
  completed_at?: string | null
}

/**
 * User onboarding progress
 */
export interface UserOnboardingProgress {
  total_steps: number
  completed_steps: number
  progress_percentage: number
  is_complete: boolean
  steps: OnboardingStep[]
}

/**
 * Resource category
 */
export interface ResourceCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  order_index: number
  created_at: string
}

/**
 * Learning resource types
 */
export type ResourceType = 'video' | 'article' | 'tutorial' | 'documentation' | 'exercise' | 'path'

/**
 * Learning resource
 */
export interface LearningResource {
  id: string
  title: string
  description: string | null
  resource_type: ResourceType
  category_id: string | null
  category_name?: string | null
  url: string
  thumbnail_url: string | null
  duration_minutes: number | null
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null
  required_level: UserLevel
  skill_tags: string[]
  is_featured: boolean
  view_count: number
  created_by: string | null
  created_at: string
  updated_at: string
  progress?: ResourceProgress | null
}

/**
 * Resource progress
 */
export interface ResourceProgress {
  progress_percentage: number
  status: 'started' | 'in_progress' | 'completed' | 'skipped'
  completed_at: string | null
}

/**
 * Curated learning path
 */
export interface CuratedLearningPath {
  id: string
  title: string
  description: string | null
  created_by: string
  required_level: UserLevel
  is_published: boolean
  resource_ids: string[]
  estimated_hours: number | null
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null
  created_at: string
  updated_at: string
}

/**
 * User path progress
 */
export interface UserPathProgress {
  id: string
  user_id: string
  path_id: string
  current_resource_index: number
  completed_resources: string[]
  progress_percentage: number
  started_at: string
  completed_at: string | null
}

/**
 * Available resources response
 */
export interface AvailableResourcesResponse {
  total: number
  resources: LearningResource[]
}
