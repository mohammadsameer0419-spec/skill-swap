/**
 * Types for AI-powered skill matching
 */

/**
 * Request to find matching skills
 */
export interface MatchSkillsRequest {
    user_id?: string
    desired_skills: string[] // Array of skill names/descriptions user wants to learn
    limit?: number // Number of matches to return (default: 5)
    filters?: SkillMatchFilters
}

/**
 * Filters for skill matching
 */
export interface SkillMatchFilters {
    level?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
    category_id?: string
    max_credits?: number
}

/**
 * Parameters for useSkillMatches hook
 */
export interface MatchParams {
    desired_skills: string[] // Array of skill names/descriptions user wants to learn
    limit?: number // Number of matches to return (default: 5)
    filters?: SkillMatchFilters
}

/**
 * A matched skill with similarity score
 */
export interface SkillMatch {
    skill_id: string
    skill_name: string
    skill_description: string | null
    teacher_name: string | null
    teacher_id: string
    similarity_score: number // 0-1, higher = better match
    credits_required: number
    level: string
    category_name: string | null
}

/**
 * Response from matching API
 */
export interface MatchSkillsResponse {
    matches: SkillMatch[]
    total_available: number
    processing_time_ms: number
}

/**
 * Database response wrapper
 */
export interface MatchResponse<T> {
    data: T | null
    error: Error | null
}
