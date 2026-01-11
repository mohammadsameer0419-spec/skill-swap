/**
 * Skill interface representing a skill in the database
 */
export interface Skill {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    category: string | null;
    level: SkillLevel;
    status: SkillStatus;
    credits_required: number;
    requests_count: number;
    created_at: string;
    updated_at: string;
}

/**
 * Skill with teacher profile information (joined with profiles table)
 */
export interface SkillWithTeacher extends Skill {
    teacher_profile: {
        user_id: string;
        username: string | null;
        full_name: string | null;
        avatar_url: string | null;
        bio: string | null;
        credits: number;
    } | null;
}

/**
 * Skill level enum
 */
export enum SkillLevel {
    BEGINNER = 'beginner',
    INTERMEDIATE = 'intermediate',
    ADVANCED = 'advanced',
    EXPERT = 'expert',
}

/**
 * Skill status enum
 */
export enum SkillStatus {
    ACTIVE = 'active',
    PAUSED = 'paused',
    INACTIVE = 'inactive',
}

/**
 * Data structure for creating a new skill
 */
export interface CreateSkillData {
    name: string;
    description?: string | null;
    category?: string | null;
    level: SkillLevel;
    credits_required: number;
}

/**
 * Data structure for updating an existing skill
 */
export interface UpdateSkillData {
    name?: string;
    description?: string | null;
    category?: string | null;
    level?: SkillLevel;
    status?: SkillStatus;
    credits_required?: number;
}

/**
 * Credit exchange data structure
 */
export interface CreditExchange {
    id: string;
    learner_id: string;
    teacher_id: string;
    skill_id: string;
    credits_amount: number;
    status: ExchangeStatus;
    created_at: string;
    updated_at: string;
}

/**
 * Exchange status enum
 */
export enum ExchangeStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
}

/**
 * Data structure for exchanging credits
 */
export interface ExchangeCreditsData {
    skill_id: string;
    credits_amount: number;
}

/**
 * Database response type from Supabase
 */
export type DatabaseResponse<T> = {
    data: T | null;
    error: Error | null;
};
