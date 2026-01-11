/**
 * Session status enum matching database schema
 */
export enum SessionStatus {
  REQUESTED = 'requested',
  ACCEPTED = 'accepted',
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed',
}

/**
 * Skill session interface matching database schema
 */
export interface SkillSession {
  id: string
  learner_id: string
  teacher_id: string
  skill_id: string
  status: SessionStatus
  credits_amount: number
  credits_locked: boolean
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  cancelled_by: string | null
  cancellation_reason: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Session with related data (joined queries)
 */
export interface SkillSessionWithDetails extends SkillSession {
  skill?: {
    id: string
    name: string
    description: string | null
    level: string
  }
  learner?: {
    user_id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  }
  teacher?: {
    user_id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  }
}

/**
 * Create session request data
 */
export interface CreateSessionRequestData {
  learner_id: string
  teacher_id: string
  skill_id: string
}

/**
 * Schedule session data
 */
export interface ScheduleSessionData {
  session_id: string
  scheduled_at: string // ISO timestamp
  user_id: string // User scheduling (learner or teacher)
}

/**
 * Cancel session data
 */
export interface CancelSessionData {
  session_id: string
  user_id: string
  reason?: string | null
}

/**
 * Session filters for queries
 */
export interface SessionFilters {
  learner_id?: string
  teacher_id?: string
  skill_id?: string
  status?: SessionStatus | SessionStatus[]
  user_id?: string // Get sessions where user is either learner or teacher
}

/**
 * Database response type
 */
export type SessionResponse<T> = {
  data: T | null
  error: Error | null
}
