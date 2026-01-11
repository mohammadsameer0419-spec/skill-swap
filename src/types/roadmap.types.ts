/**
 * AI Roadmap Generator Types
 */

/**
 * Roadmap step with mapped resources
 */
export interface RoadmapStep {
  week: number
  title: string
  description: string
  learning_objectives: string[]
  mapped_resources: RoadmapResource[]
  estimated_hours: number
}

/**
 * Learning resource mapped to a roadmap step
 */
export interface RoadmapResource {
  id: string
  title: string
  url: string
  resource_type: 'video' | 'article' | 'tutorial' | 'documentation' | 'exercise' | 'path'
  duration_minutes: number | null
  thumbnail_url: string | null
}

/**
 * AI-generated roadmap structure
 */
export interface AIRoadmap {
  skill_name: string
  current_level: string
  target_level: string
  duration_weeks: number
  total_hours: number
  steps: RoadmapStep[]
  created_at: string
}

/**
 * Request to generate a roadmap
 */
export interface GenerateRoadmapRequest {
  skill_name: string
  current_level: string
  user_id?: string
}

/**
 * Response from roadmap generation
 */
export interface GenerateRoadmapResponse {
  roadmap: AIRoadmap
  success: boolean
  error?: string
}
